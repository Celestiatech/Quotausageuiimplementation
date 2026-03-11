const PANEL_ID = "cp-linkedin-copilot-panel";
const TOGGLE_ID = "cp-linkedin-copilot-toggle";
const EXTENSION_PROVIDER = "indeed";
const JOBS_SEARCH_URL = "https://www.indeed.com/jobs";
const PANEL_POLL_MS = 1200;
const CARD_OPEN_DELAY_MS = 1400;
const APPLY_STEP_DELAY_MS = 1600;
const MAX_PAGES_PER_RUN = 12;
const MAX_APPLY_STEPS = 4;

let panelMounted = false;
let engineRunning = false;
let engineToken = 0;
let localProgress = { applied: 0, skipped: 0, failed: 0 };
let processedJobIds = new Set();
let appliedJobIdsCache = new Set();
let currentJobContext = {};

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabel(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseListSetting(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[,\n;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNormalizedValues(value) {
  const seen = new Set();
  const values = [];
  for (const item of parseListSetting(value)) {
    const normalized = normalizeLabel(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(normalized);
  }
  return values;
}

function textIncludesNormalized(text, target) {
  const left = normalizeLabel(text);
  const right = normalizeLabel(target);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  return left.includes(` ${right} `);
}

function matchesConfiguredValues(text, values) {
  const normalizedValues = uniqueNormalizedValues(values);
  if (!normalizedValues.length) return true;
  return normalizedValues.some((value) => textIncludesNormalized(text, value));
}

function isRemoteLikeValue(value) {
  const normalized = normalizeLabel(value);
  return (
    normalized === "remote" ||
    normalized === "work from home" ||
    normalized === "wfh" ||
    normalized === "anywhere" ||
    normalized === "worldwide"
  );
}

function listHasRemoteValue(values) {
  return parseListSetting(values).some((value) => isRemoteLikeValue(value));
}

function workModeMatches(text, configuredValues) {
  const values = uniqueNormalizedValues(configuredValues);
  if (!values.length) return true;
  const normalized = normalizeLabel(text);
  return values.some((value) => {
    if (value === "remote") {
      return normalized.includes("remote") || normalized.includes("work from home");
    }
    if (value === "hybrid") {
      return normalized.includes("hybrid");
    }
    if (value === "on site" || value === "onsite") {
      return normalized.includes("on site") || normalized.includes("onsite");
    }
    if (value === "flexible") {
      return normalized.includes("flexible");
    }
    return normalized.includes(value);
  });
}

function extractYearsOfExperience(text) {
  const raw = String(text || "");
  const matches = [...raw.matchAll(/(?:^|\s)(\d{1,2})\s*(?:\+|plus|-|to)?\s*(?:\d{0,2})?\s*years?/gi)];
  if (!matches.length) return 0;
  const values = matches
    .map((match) => Number(match?.[1] || 0))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 40);
  return values.length ? Math.max(...values) : 0;
}

function extractMoneyValues(text) {
  const values = [];
  const matches = String(text || "").matchAll(/\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?/gi);
  for (const match of matches) {
    const base = Number(String(match?.[1] || "").replace(/,/g, ""));
    if (!Number.isFinite(base) || base <= 0) continue;
    values.push(match?.[2] ? base * 1000 : base);
  }
  return values;
}

function salaryFilterMatches(jobText, salaryFilter) {
  const rawFilter = String(salaryFilter || "").trim();
  if (!rawFilter) return true;
  if (textIncludesNormalized(jobText, rawFilter)) return true;
  const requiredFloor = Math.min(...extractMoneyValues(rawFilter));
  if (!Number.isFinite(requiredFloor)) return false;
  const jobAmounts = extractMoneyValues(jobText);
  if (!jobAmounts.length) return false;
  return Math.max(...jobAmounts) >= requiredFloor;
}

function lowApplicantHintMatches(text) {
  const normalized = normalizeLabel(text);
  return (
    normalized.includes("be among the first 5 applicants") ||
    normalized.includes("be among the first 10 applicants") ||
    normalized.includes("few applicants") ||
    normalized.includes("first applicants")
  );
}

function fairChanceHintMatches(text) {
  const normalized = normalizeLabel(text);
  return (
    normalized.includes("fair chance") ||
    normalized.includes("fair chance employer") ||
    normalized.includes("second chance") ||
    normalized.includes("ban the box") ||
    normalized.includes("justice impacted")
  );
}

function datePostedToIndeedParam(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "past 24 hours") return "1";
  if (normalized === "past week") return "7";
  if (normalized === "past month") return "30";
  return "";
}

function jobTypeToIndeedParam(value) {
  const normalized = normalizeLabel(value);
  if (normalized === "full time" || normalized === "full-time") return "fulltime";
  if (normalized === "part time" || normalized === "part-time") return "parttime";
  if (normalized === "contract") return "contract";
  if (normalized === "internship") return "internship";
  if (normalized === "temporary") return "temporary";
  return "";
}

const ignoredIndeedFilterWarnings = new Set();

async function warnUnsupportedFilters(settings) {
  const warnings = [];
  if (settings?.inYourNetwork) {
    warnings.push("Indeed does not expose 'In your network'; that filter is ignored on Indeed runs.");
  }
  for (const warning of warnings) {
    if (ignoredIndeedFilterWarnings.has(warning)) continue;
    ignoredIndeedFilterWarnings.add(warning);
    await pushLog(warning, "warn");
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false });
      });
    } catch (error) {
      resolve({ ok: false, error: String(error?.message || error) });
    }
  });
}

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function textFromNode(node) {
  return normalizeText(node?.textContent || "");
}

function extractIndeedJobId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/[?&](?:jk|vjk)=([a-z0-9_-]+)/i);
  if (match?.[1]) return String(match[1]);
  if (/^[a-z0-9_-]{8,}$/i.test(raw)) return raw;
  return "";
}

function buildSearchUrl(settings = {}, pageStart = 0) {
  const params = new URLSearchParams();
  const terms = Array.isArray(settings.searchTerms) ? settings.searchTerms.filter(Boolean) : [];
  const firstTerm = normalizeText(terms[0] || settings.keywords || "developer");
  if (firstTerm) params.set("q", firstTerm);

  const location =
    normalizeText(settings.searchLocation) ||
    normalizeText(Array.isArray(settings.filterLocations) ? settings.filterLocations[0] : "");
  if (location && normalizeLabel(location) !== "remote") {
    params.set("l", location);
  }

  const sortBy = normalizeLabel(settings.sortBy);
  if (sortBy === "most recent") {
    params.set("sort", "date");
  }

  const datePosted = datePostedToIndeedParam(settings.datePosted);
  if (datePosted) {
    params.set("fromage", datePosted);
  }

  const jobTypeValues = uniqueNormalizedValues(settings.jobType)
    .map((value) => jobTypeToIndeedParam(value))
    .filter(Boolean);
  if (jobTypeValues.length === 1) {
    params.set("jt", jobTypeValues[0]);
  }

  if (Number(pageStart) > 0) params.set("start", String(pageStart));
  return `${JOBS_SEARCH_URL}?${params.toString()}`;
}

function isJobsPage() {
  try {
    const url = new URL(window.location.href);
    return url.hostname.endsWith("indeed.com") && (url.pathname.startsWith("/jobs") || url.pathname.startsWith("/viewjob"));
  } catch {
    return false;
  }
}

function getPanelElements() {
  return {
    panel: document.getElementById(PANEL_ID),
    toggle: document.getElementById(TOGGLE_ID),
    statusBadge: document.getElementById("cp-status-badge"),
    title: document.getElementById("cp-now-title"),
    detail: document.getElementById("cp-now-detail"),
    applied: document.getElementById("cp-stat-applied"),
    skipped: document.getElementById("cp-stat-skipped"),
    failed: document.getElementById("cp-stat-failed"),
    logs: document.getElementById("cp-log"),
    start: document.getElementById("cp-start"),
    pause: document.getElementById("cp-pause"),
    stop: document.getElementById("cp-stop"),
    mode: document.getElementById("cp-run-mode"),
  };
}

function ensurePanel() {
  if (panelMounted) return;
  if (document.getElementById(PANEL_ID) || document.getElementById(TOGGLE_ID)) {
    panelMounted = true;
    return;
  }

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.type = "button";
  toggle.textContent = "AI";
  toggle.title = "Toggle AutoApply CV Indeed Copilot";

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb">
          <img class="cp-orb-img" src="${chrome.runtime.getURL("icons/icon48.png")}" alt="AutoApply CV" />
        </div>
        <div class="cp-title-wrap">
          <div class="cp-title">AutoApply CV Copilot</div>
          <div class="cp-sub">Indeed job assistant</div>
        </div>
      </div>
      <div class="cp-head-right">
        <span id="cp-status-badge" class="cp-badge">Idle</span>
      </div>
    </div>
    <div class="cp-stats">
      <div class="cp-stat"><div class="cp-stat-k">Applied</div><div id="cp-stat-applied">0</div></div>
      <div class="cp-stat"><div class="cp-stat-k">Skipped</div><div id="cp-stat-skipped">0</div></div>
      <div class="cp-stat"><div class="cp-stat-k">Failed</div><div id="cp-stat-failed">0</div></div>
    </div>
    <div class="cp-run-mode">
      <div class="cp-run-mode-label">Mode</div>
      <div id="cp-run-mode" class="cp-run-mode-chip cp-dry">Dry run</div>
    </div>
    <div class="cp-now">
      <div id="cp-now-title" class="cp-now-title">Indeed copilot ready.</div>
      <div id="cp-now-detail" class="cp-now-detail">Open Indeed Jobs and start the run.</div>
    </div>
    <div class="cp-quick">
      <button id="cp-start" type="button">Start</button>
      <button id="cp-pause" type="button">Pause</button>
      <button id="cp-stop" type="button">Stop</button>
    </div>
    <div id="cp-log" class="cp-log"></div>
  `;

  document.documentElement.appendChild(toggle);
  document.documentElement.appendChild(panel);

  toggle.addEventListener("click", () => {
    panel.classList.toggle("cp-hidden");
  });

  const els = getPanelElements();
  els.start?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_START", forceRestart: false });
    if (!isJobsPage()) {
      window.location.href = buildSearchUrl(await loadSettings());
      return;
    }
    await sendMessage({ type: "CP_LOG", level: "info", message: "Copilot: Run started." });
  });
  els.pause?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_PAUSE" });
  });
  els.stop?.addEventListener("click", async () => {
    await sendMessage({ type: "CP_STOP" });
  });

  panelMounted = true;
}

function renderLogs(logs) {
  const container = getPanelElements().logs;
  if (!container) return;
  const items = Array.isArray(logs) ? logs.slice(-10) : [];
  container.innerHTML = items
    .map((entry) => {
      const kind = normalizeLabel(entry?.level || "info");
      const message = normalizeText(entry?.message || "");
      const ts = normalizeText(entry?.ts || "");
      return `
        <div class="cp-line cp-${kind}">
          <div class="cp-bubble">
            <div class="cp-msg-head">
              <span class="cp-sender">${kind === "user" ? "You" : "Copilot"}</span>
              <span class="cp-time">${ts ? new Date(ts).toLocaleTimeString() : ""}</span>
            </div>
            <div class="cp-msg-text">${message || "-"}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function updatePanel(state, settings) {
  ensurePanel();
  const els = getPanelElements();
  if (!els.panel) return;

  const running = Boolean(state?.running);
  const paused = Boolean(state?.paused) && !running;
  const applied = Math.max(0, Number(state?.applied || localProgress.applied || 0));
  const skipped = Math.max(0, Number(state?.skipped || localProgress.skipped || 0));
  const failed = Math.max(0, Number(state?.failed || localProgress.failed || 0));
  const lastLog = Array.isArray(state?.logs) && state.logs.length ? state.logs[state.logs.length - 1] : null;

  if (els.statusBadge) {
    els.statusBadge.textContent = running ? "Running" : paused ? "Paused" : "Idle";
    els.statusBadge.className = `cp-badge ${running ? "cp-run" : paused ? "cp-pause" : ""}`.trim();
  }
  if (els.title) {
    els.title.textContent = running
      ? "Scanning Indeed job results."
      : paused
      ? "Run paused."
      : "Indeed copilot ready.";
  }
  if (els.detail) {
    els.detail.textContent =
      normalizeText(lastLog?.message) ||
      (running ? "Working through visible jobs and syncing outcomes." : "Open Indeed Jobs and click Start.");
  }
  if (els.applied) els.applied.textContent = String(applied);
  if (els.skipped) els.skipped.textContent = String(skipped);
  if (els.failed) els.failed.textContent = String(failed);
  if (els.mode) {
    const live = Boolean(settings?.autoSubmit) && !Boolean(settings?.dryRun);
    const manual = !Boolean(settings?.autoSubmit) && !Boolean(settings?.dryRun);
    els.mode.textContent = live ? "Live auto submit" : manual ? "Manual review" : "Dry run";
    els.mode.className = `cp-run-mode-chip ${live ? "cp-live" : manual ? "cp-manual" : "cp-dry"}`;
  }
  renderLogs(state?.logs);
}

async function loadSettings() {
  const result = await sendMessage({ type: "CP_LOAD_SETTINGS" });
  return result?.ok ? result.settings || {} : {};
}

async function pushLog(message, level = "info", meta = null) {
  await sendMessage({
    type: "CP_LOG",
    level,
    message,
    meta,
  });
}

async function reportProgress() {
  const response = await sendMessage({
    type: "CP_PROGRESS",
    applied: localProgress.applied,
    skipped: localProgress.skipped,
    failed: localProgress.failed,
  });
  if (!response?.ok && response?.errorCode === "DAILY_CAP_REACHED") {
    await sendMessage({ type: "CP_PAUSE" });
  }
}

async function recordOutcome(outcomeType, data = {}) {
  await sendMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType,
    data: {
      ...data,
      provider: EXTENSION_PROVIDER,
      pageUrl: window.location.href,
    },
  });

  if (outcomeType === "APPLIED") localProgress.applied += 1;
  else if (outcomeType === "FAILED") localProgress.failed += 1;
  else localProgress.skipped += 1;

  await reportProgress();
}

async function refreshAppliedIdsCache() {
  const result = await sendMessage({ type: "CP_GET_APPLIED_JOB_IDS", limit: 8000 });
  if (!result?.ok || !Array.isArray(result.jobIds)) return;
  appliedJobIdsCache = new Set(result.jobIds.map((value) => String(value || "").trim()).filter(Boolean));
}

function queryAllVisible(selectors) {
  return selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .filter((node) => node instanceof HTMLElement && isVisible(node));
}

function getJobCards() {
  const anchors = Array.from(
    document.querySelectorAll(
      'a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk], [data-jk] a',
    ),
  );
  const seen = new Set();
  const cards = [];
  for (const anchor of anchors) {
    const jobId =
      extractIndeedJobId(anchor.getAttribute("href")) ||
      extractIndeedJobId(anchor.getAttribute("data-jk")) ||
      extractIndeedJobId(anchor.closest("[data-jk]")?.getAttribute("data-jk"));
    if (!jobId || seen.has(jobId)) continue;
    seen.add(jobId);
    cards.push(anchor.closest("[data-jk], [data-testid='slider_item'], .job_seen_beacon, .result, .tapItem") || anchor);
  }
  return cards.filter(Boolean);
}

function getCardAnchor(card) {
  if (card instanceof HTMLAnchorElement) return card;
  return (
    card?.querySelector('a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk]') ||
    null
  );
}

function extractCardSnapshot(card) {
  const anchor = getCardAnchor(card);
  const href = anchor?.href || "";
  const jobId =
    extractIndeedJobId(href) ||
    extractIndeedJobId(anchor?.getAttribute("data-jk")) ||
    extractIndeedJobId(card?.getAttribute?.("data-jk"));
  const title =
    normalizeText(
      card?.querySelector?.("[data-testid='job-title'], h2, h3, .jobTitle")?.textContent || anchor?.textContent,
    ) || "Indeed Job";
  const company =
    normalizeText(
      card?.querySelector?.("[data-testid='company-name'], [data-testid='company'], .companyName")?.textContent,
    ) || "";
  const workLocation =
    normalizeText(
      card?.querySelector?.("[data-testid='text-location'], [data-testid='job-location'], .companyLocation")?.textContent,
    ) || "";

  return {
    provider: EXTENSION_PROVIDER,
    jobId,
    externalJobId: jobId,
    jobUrl: href,
    pageUrl: window.location.href,
    title,
    company,
    workLocation,
    description: "",
  };
}

async function focusCard(card) {
  try {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    // ignore
  }
  await sleep(250);
  const clickable =
    getCardAnchor(card) ||
    card?.querySelector?.("button") ||
    card;
  if (clickable instanceof HTMLElement) clickable.click();
  await sleep(CARD_OPEN_DELAY_MS);
}

function extractDetailSnapshot(fallback) {
  const title =
    normalizeText(
      document.querySelector("[data-testid='jobsearch-JobInfoHeader-title'], [data-testid='viewJobTitle'], h1")?.textContent,
    ) || fallback.title;
  const company =
    normalizeText(
      document.querySelector("[data-testid='inlineHeader-companyName'], [data-testid='company-name'], .jobsearch-CompanyInfoWithoutHeaderImage div")?.textContent,
    ) || fallback.company;
  const workLocation =
    normalizeText(
      document.querySelector("[data-testid='job-location'], [data-testid='inlineHeader-companyLocation'], .jobsearch-DesktopStickyContainer-subtitle")?.textContent,
    ) || fallback.workLocation;
  const description =
    normalizeText(
      document.querySelector("#jobDescriptionText, [data-testid='jobsearch-JobComponent-description'], .jobsearch-JobComponent-description")?.textContent,
    ) || "";
  const metadataText = normalizeText(
    [
      document.querySelector("[data-testid='jobsearch-OtherJobDetailsContainer']")?.textContent,
      document.querySelector("#salaryInfoAndJobType")?.textContent,
      document.querySelector("[data-testid='attribute_snippet_testid']")?.textContent,
      document.querySelector("[data-testid='jobsearch-JobMetadataHeader']")?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const aboutCompany = normalizeText(
    [
      document.querySelector("[data-testid='companyInfo-metadata']")?.textContent,
      document.querySelector("[data-testid='companyInfo-container']")?.textContent,
      document.querySelector("#jobCompanyDescription")?.textContent,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const detailUrl =
    window.location.href.includes("/viewjob")
      ? window.location.href
      : fallback.jobUrl || window.location.href;

  return {
    ...fallback,
    title,
    company,
    workLocation,
    description,
    metadataText,
    aboutCompany,
    jobUrl: detailUrl,
    pageUrl: window.location.href,
  };
}

function shouldSkipByCardRules(detail, settings) {
  const title = normalizeLabel(detail?.title);
  const company = normalizeLabel(detail?.company);
  const blacklistCompanies = uniqueNormalizedValues(settings?.blacklistedCompanies);
  const badWords = uniqueNormalizedValues(settings?.badWords);

  if (company && blacklistCompanies.some((item) => company.includes(item))) {
    return {
      skip: true,
      reasonCode: "BLACKLISTED_COMPANY",
      reason: `Company blacklisted: ${detail.company}`,
    };
  }

  if (title && badWords.some((item) => title.includes(item))) {
    return {
      skip: true,
      reasonCode: "BAD_WORD_TITLE",
      reason: "Blocked by title keyword filter",
    };
  }

  if (!matchesConfiguredValues(detail?.title || "", settings?.jobTitles)) {
    return {
      skip: true,
      reasonCode: "JOB_TITLE_FILTER_MISMATCH",
      reason: "Job title did not match configured job-title filters",
    };
  }

  if (!matchesConfiguredValues(detail?.company || "", settings?.companies)) {
    return {
      skip: true,
      reasonCode: "COMPANY_FILTER_MISMATCH",
      reason: "Company did not match configured company filters",
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function shouldSkipByDescription(description, settings) {
  const text = normalizeLabel(description);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const badWords = uniqueNormalizedValues(settings?.badWords);
  if (badWords.some((item) => text.includes(item))) {
    return {
      skip: true,
      reasonCode: "BAD_WORD_DESCRIPTION",
      reason: "Blocked by description keyword filter",
    };
  }

  const hasClearanceRequirement =
    text.includes("polygraph") ||
    text.includes("security clearance") ||
    text.includes("clearance required") ||
    text.includes("secret clearance");
  if (!settings?.securityClearance && hasClearanceRequirement) {
    return {
      skip: true,
      reasonCode: "SECURITY_CLEARANCE_REQUIRED",
      reason: "Security clearance requirement detected",
    };
  }

  const configuredExperience = Number(settings?.currentExperience);
  if (Number.isFinite(configuredExperience) && configuredExperience >= 0) {
    const requiredYears = extractYearsOfExperience(text);
    if (requiredYears > 0) {
      const allowedYears = configuredExperience + (settings?.didMasters ? 2 : 0);
      if (requiredYears > allowedYears) {
        return {
          skip: true,
          reasonCode: "EXPERIENCE_TOO_HIGH",
          reason: `Required experience ${requiredYears} > allowed ${allowedYears}`,
        };
      }
    }
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function shouldSkipByAboutCompany(aboutCompanyText, settings) {
  const text = normalizeLabel(aboutCompanyText);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const goodWords = uniqueNormalizedValues(settings?.aboutCompanyGoodWords);
  if (goodWords.some((item) => text.includes(item))) {
    return { skip: false, reasonCode: "", reason: "" };
  }

  const badWords = uniqueNormalizedValues(settings?.aboutCompanyBadWords);
  const match = badWords.find((item) => text.includes(item));
  if (match) {
    return {
      skip: true,
      reasonCode: "ABOUT_COMPANY_BAD_WORD",
      reason: `About company contains blocked word: ${match}`,
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function shouldSkipByConfiguredFilters(detail, settings) {
  const locationText = `${detail?.workLocation || ""} ${detail?.metadataText || ""}`;
  const combinedText = normalizeText(
    [
      detail?.title,
      detail?.company,
      detail?.workLocation,
      detail?.metadataText,
      detail?.aboutCompany,
      detail?.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!matchesConfiguredValues(locationText, settings?.filterLocations)) {
    const configuredLocations = parseListSetting(settings?.filterLocations);
    const remoteConfigured = configuredLocations.some((value) => isRemoteLikeValue(value));
    if (!remoteConfigured || !workModeMatches(locationText, ["Remote"])) {
      return {
        skip: true,
        reasonCode: "LOCATION_FILTER_MISMATCH",
        reason: "Location did not match configured location filters",
      };
    }
  }

  if (!workModeMatches(locationText, settings?.onSite)) {
    return {
      skip: true,
      reasonCode: "WORK_MODE_FILTER_MISMATCH",
      reason: "Work mode did not match configured on-site filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.experienceLevel)) {
    return {
      skip: true,
      reasonCode: "EXPERIENCE_LEVEL_FILTER_MISMATCH",
      reason: "Experience level did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.jobType)) {
    return {
      skip: true,
      reasonCode: "JOB_TYPE_FILTER_MISMATCH",
      reason: "Job type did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.industry)) {
    return {
      skip: true,
      reasonCode: "INDUSTRY_FILTER_MISMATCH",
      reason: "Industry did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.jobFunction)) {
    return {
      skip: true,
      reasonCode: "JOB_FUNCTION_FILTER_MISMATCH",
      reason: "Job function did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.benefits)) {
    return {
      skip: true,
      reasonCode: "BENEFITS_FILTER_MISMATCH",
      reason: "Benefits did not match configured filters",
    };
  }

  if (!matchesConfiguredValues(combinedText, settings?.commitments)) {
    return {
      skip: true,
      reasonCode: "COMMITMENTS_FILTER_MISMATCH",
      reason: "Commitments did not match configured filters",
    };
  }

  if (!salaryFilterMatches(`${detail?.metadataText || ""} ${detail?.description || ""}`, settings?.salary)) {
    return {
      skip: true,
      reasonCode: "SALARY_FILTER_MISMATCH",
      reason: "Salary did not match configured salary filter",
    };
  }

  if (settings?.under10Applicants && !lowApplicantHintMatches(combinedText)) {
    return {
      skip: true,
      reasonCode: "LOW_APPLICANT_HINT_MISSING",
      reason: "Indeed did not show a low-applicant hint for this job",
    };
  }

  if (settings?.fairChanceEmployer && !fairChanceHintMatches(combinedText)) {
    return {
      skip: true,
      reasonCode: "FAIR_CHANCE_EMPLOYER_REQUIRED",
      reason: "Indeed did not show a fair-chance signal for this job",
    };
  }

  const descriptionRule = shouldSkipByDescription(detail?.description, settings);
  if (descriptionRule.skip) return descriptionRule;

  const aboutCompanyRule = shouldSkipByAboutCompany(detail?.aboutCompany, settings);
  if (aboutCompanyRule.skip) return aboutCompanyRule;

  return { skip: false, reasonCode: "", reason: "" };
}

function classifyApplyButton(button) {
  const label = normalizeLabel(button.textContent || button.getAttribute("aria-label") || "");
  const href = String(button.getAttribute?.("href") || "").trim();
  const hrefUrl = href ? new URL(href, window.location.href) : null;
  const externalHost = hrefUrl && !hrefUrl.hostname.endsWith("indeed.com");
  if (externalHost || label.includes("company site") || label.includes("company website")) return "external";
  if (label.includes("apply now") || label.includes("easily apply") || label.includes("continue to apply")) return "direct";
  if (label.includes("apply")) return "direct";
  return "unknown";
}

function findApplyButton() {
  const candidates = queryAllVisible([
    "button",
    "a[role='button']",
    "a[href]",
  ]);
  for (const node of candidates) {
    const label = normalizeLabel(node.textContent || node.getAttribute("aria-label") || "");
    if (!label) continue;
    if (
      label.includes("apply now") ||
      label.includes("easily apply") ||
      label.includes("continue to apply") ||
      label === "apply" ||
      label.includes("apply on company site") ||
      label.includes("company site")
    ) {
      return node;
    }
  }
  return null;
}

function fieldLabelFor(element) {
  const ariaLabel = normalizeText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  const placeholder = normalizeText(element.getAttribute("placeholder"));
  if (placeholder) return placeholder;
  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label) return normalizeText(label.textContent);
  }
  const wrappingLabel = element.closest("label");
  if (wrappingLabel) return normalizeText(wrappingLabel.textContent);
  const parentText = normalizeText(element.parentElement?.textContent || "");
  return parentText;
}

function resolveFieldAnswer(label, settings) {
  const normalized = normalizeLabel(label);
  const screeningAnswers =
    settings?.screeningAnswers && typeof settings.screeningAnswers === "object"
      ? settings.screeningAnswers
      : {};
  if (screeningAnswers[normalized]) return String(screeningAnswers[normalized] || "").trim();

  if (normalized.includes("email")) return normalizeText(settings.contactEmail);
  if (normalized.includes("phone")) return normalizeText(settings.phoneNumber || settings.phone);
  if (normalized === "full name" || normalized.includes("legal name")) {
    return normalizeText(settings.fullName || `${settings.firstName || ""} ${settings.lastName || ""}`);
  }
  if (normalized.includes("first name")) return normalizeText(settings.firstName || settings.fullName);
  if (normalized.includes("last name") || normalized.includes("surname")) return normalizeText(settings.lastName);
  if (normalized.includes("city")) return normalizeText(settings.currentCity || settings.searchLocation);
  if (normalized.includes("linkedin")) return normalizeText(settings.linkedinUrl);
  if (normalized.includes("website") || normalized.includes("portfolio")) {
    return normalizeText(settings.websiteUrl || settings.portfolioUrl || settings.linkedinUrl);
  }
  if (normalized.includes("experience")) {
    const years = Number(settings.currentExperience);
    if (Number.isFinite(years) && years >= 0) return String(years);
  }
  if (normalized.includes("salary")) return normalizeText(settings.salary);
  if (normalized.includes("visa") || normalized.includes("sponsor")) return normalizeText(settings.requireVisa || "No");
  if (normalized.includes("citizen") || normalized.includes("authorized")) {
    return normalizeText(settings.usCitizenship || settings.workAuthorizationUS || "");
  }
  if (normalized.includes("country")) return normalizeText(settings.country);
  return "";
}

function isRequiredField(element) {
  return (
    Boolean(element.required) ||
    String(element.getAttribute("aria-required") || "").toLowerCase() === "true"
  );
}

function isFilledField(element) {
  if (!(element instanceof HTMLElement)) return true;
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") return element.checked;
    if (element.type === "file") return element.files?.length > 0;
    return Boolean(normalizeText(element.value));
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return Boolean(normalizeText(element.value));
  }
  return true;
}

function setInputValue(element, value) {
  const setter = Object.getOwnPropertyDescriptor(element.__proto__, "value")?.set;
  setter ? setter.call(element, value) : (element.value = value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function chooseSelectOption(select, answer) {
  const normalizedAnswer = normalizeLabel(answer);
  const option =
    Array.from(select.options).find((item) => normalizeLabel(item.textContent || item.value) === normalizedAnswer) ||
    Array.from(select.options).find((item) => normalizeLabel(item.textContent || item.value).includes(normalizedAnswer)) ||
    null;
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function fillBasicFields(root, settings) {
  const pending = [];
  const handledRadioGroups = new Set();
  const fields = Array.from(root.querySelectorAll("input, textarea, select")).filter((field) => isVisible(field));

  for (const field of fields) {
    if (!(field instanceof HTMLElement)) continue;
    if (field instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(field.type)) continue;

    if (field instanceof HTMLInputElement && field.type === "radio") {
      const groupName = String(field.name || field.id || "").trim();
      if (!groupName || handledRadioGroups.has(groupName)) continue;
      handledRadioGroups.add(groupName);
      const group = fields.filter((item) => item instanceof HTMLInputElement && item.type === "radio" && item.name === field.name);
      const label = fieldLabelFor(field) || group.map((item) => fieldLabelFor(item)).find(Boolean) || groupName;
      const answer = resolveFieldAnswer(label, settings);
      const matched = group.find((item) => normalizeLabel(fieldLabelFor(item) || item.value).includes(normalizeLabel(answer)));
      if (matched) matched.click();
      if (!matched && isRequiredField(field) && !group.some((item) => item.checked)) {
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_required_choice",
          questionLabel: label || "Indeed required selection",
          validationMessage: "Choose one option to continue",
        });
      }
      continue;
    }

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      const label = fieldLabelFor(field);
      const normalized = normalizeLabel(label);
      if ((normalized.includes("follow") || normalized.includes("newsletter") || normalized.includes("marketing")) && field.checked) {
        field.click();
      } else if ((normalized.includes("consent") || normalized.includes("terms")) && isRequiredField(field) && !field.checked) {
        field.click();
      }
      continue;
    }

    if (field instanceof HTMLInputElement && field.type === "file") {
      if (isRequiredField(field)) {
        const label = fieldLabelFor(field) || "Resume upload";
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_resume_upload",
          questionLabel: label,
          validationMessage: "Manual file upload required",
        });
      }
      continue;
    }

    const label = fieldLabelFor(field);
    const answer = resolveFieldAnswer(label, settings);
    if (field instanceof HTMLSelectElement) {
      if (answer) chooseSelectOption(field, answer);
      if (isRequiredField(field) && !isFilledField(field)) {
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_required_select",
          questionLabel: label || "Indeed required field",
          validationMessage: "Choose an answer to continue",
        });
      }
      continue;
    }

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      if (!isFilledField(field) && answer) setInputValue(field, answer);
      if (isRequiredField(field) && !isFilledField(field)) {
        pending.push({
          questionKey: normalizeLabel(label).replace(/\s+/g, "_") || "indeed_required_field",
          questionLabel: label || "Indeed required field",
          validationMessage: "Provide an answer to continue",
        });
      }
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const item of pending) {
    const key = `${item.questionKey}:${item.questionLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function findApplySurface() {
  return (
    document.querySelector("[role='dialog'], .ia-IndeedApplyForm, .jobsearch-IndeedApplyModal-content, form") ||
    document.body
  );
}

function findPrimaryApplyAction(root) {
  const candidates = Array.from(root.querySelectorAll("button, a[role='button'], input[type='submit']"))
    .filter((node) => node instanceof HTMLElement && isVisible(node));
  for (const node of candidates) {
    const label = normalizeLabel(node.textContent || node.getAttribute("value") || node.getAttribute("aria-label") || "");
    if (
      label.includes("submit") ||
      label.includes("review") ||
      label.includes("continue") ||
      label.includes("next")
    ) {
      return node;
    }
  }
  return null;
}

function hasSubmissionSuccess() {
  const pageText = normalizeLabel(document.body?.textContent || "");
  return (
    pageText.includes("application submitted") ||
    pageText.includes("you applied") ||
    pageText.includes("thanks for applying") ||
    pageText.includes("your application has been submitted")
  );
}

function closeApplySurface() {
  const candidates = Array.from(document.querySelectorAll("button, [role='button']")).filter((node) => {
    if (!(node instanceof HTMLElement) || !isVisible(node)) return false;
    const label = normalizeLabel(node.textContent || node.getAttribute("aria-label") || "");
    return label === "close" || label.includes("dismiss");
  });
  candidates[0]?.click();
}

async function runIndeedApplyFlow(applyButton, settings, token) {
  applyButton.click();
  await sleep(APPLY_STEP_DELAY_MS);

  for (let step = 0; step < MAX_APPLY_STEPS; step += 1) {
    if (!engineRunning || token !== engineToken) return { status: "aborted" };
    if (hasSubmissionSuccess()) return { status: "applied" };

    const surface = findApplySurface();
    const pendingQuestions = fillBasicFields(surface, settings);
    if (pendingQuestions.length) {
      await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: pendingQuestions });
      await pushLog("Paused: manual Indeed questions need answers.", "warn", {
        questionCount: pendingQuestions.length,
      });
      await sendMessage({ type: "CP_PAUSE" });
      return {
        status: "pending",
        reasonCode: "REQUIRED_CUSTOM_FIELDS",
        pendingQuestions,
      };
    }

    const action = findPrimaryApplyAction(surface);
    if (!action) break;
    action.click();
    await sleep(APPLY_STEP_DELAY_MS);
  }

  if (hasSubmissionSuccess()) return { status: "applied" };
  closeApplySurface();
  return {
    status: "failed",
    reasonCode: "INDEED_APPLY_FLOW_INCOMPLETE",
  };
}

async function handleJobCard(card, settings, state) {
  const snapshot = extractCardSnapshot(card);
  if (!snapshot.jobId) return false;
  if (processedJobIds.has(snapshot.jobId)) return false;
  processedJobIds.add(snapshot.jobId);

  currentJobContext = snapshot;
  if (appliedJobIdsCache.has(snapshot.jobId)) {
    await pushLog("Skipped (already applied earlier)", "info", { reasonCode: "APPLIED_CACHE_HIT" });
    await recordOutcome("SKIPPED", {
      ...snapshot,
      reasonCode: "APPLIED_CACHE_HIT",
      reason: "Known applied job id cache hit",
    });
    return true;
  }

  const quickRule = shouldSkipByCardRules(snapshot, settings);
  if (quickRule.skip) {
    await pushLog(`Skipped (${quickRule.reason})`, "info", { reasonCode: quickRule.reasonCode });
    await recordOutcome("SKIPPED", {
      ...snapshot,
      reasonCode: quickRule.reasonCode,
      reason: quickRule.reason,
    });
    return true;
  }

  await focusCard(card);
  const detail = extractDetailSnapshot(snapshot);
  currentJobContext = detail;

  await pushLog(`Opening: ${detail.title}`, "info");

  const detailRule = shouldSkipByConfiguredFilters(detail, settings);
  if (detailRule.skip) {
    await pushLog(`Skipped (${detailRule.reason})`, "info", { reasonCode: detailRule.reasonCode });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: detailRule.reasonCode,
      reason: detailRule.reason,
    });
    return true;
  }

  const applyButton = findApplyButton();
  if (!applyButton) {
    await pushLog("Skipped (no apply button)", "warn", { reasonCode: "NO_APPLY_BUTTON" });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "NO_APPLY_BUTTON",
      reason: "No apply button found on Indeed job detail",
    });
    return true;
  }

  const applyKind = classifyApplyButton(applyButton);
  if (applyKind === "external") {
    const reasonCode = "EXTERNAL_APPLY_ONLY";
    await pushLog("Skipped (external apply)", "warn", { reasonCode });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode,
      reason: "External apply blocked because easyApplyOnly is enabled",
    });
    return true;
  }

  if (settings?.dryRun) {
    await pushLog("Dry run: detected Indeed apply flow.", "info", { reasonCode: "DRY_RUN_ONLY" });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "DRY_RUN_ONLY",
      reason: "Dry run mode does not submit applications",
    });
    return true;
  }

  if (!settings?.autoSubmit) {
    await pushLog("Manual mode: Indeed apply flow requires review.", "info", {
      reasonCode: "MANUAL_REVIEW_REQUIRED",
    });
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: "MANUAL_REVIEW_REQUIRED",
      reason: "Manual review required before submit",
    });
    return true;
  }

  const applyResult = await runIndeedApplyFlow(applyButton, settings, engineToken);
  if (applyResult.status === "applied") {
    appliedJobIdsCache.add(detail.jobId);
    await pushLog("Application submitted", "info");
    await recordOutcome("APPLIED", {
      ...detail,
      reasonCode: "SUBMITTED",
      reason: "Application submitted",
    });
    return true;
  }

  if (applyResult.status === "pending") {
    await recordOutcome("SKIPPED", {
      ...detail,
      reasonCode: applyResult.reasonCode || "REQUIRED_CUSTOM_FIELDS",
      reason: "Indeed application requires manual answers",
    });
    return true;
  }

  if (applyResult.status === "aborted") return true;

  await pushLog("Apply flow failed on Indeed.", "error", { reasonCode: applyResult.reasonCode || "INDEED_APPLY_FLOW_INCOMPLETE" });
  await recordOutcome("FAILED", {
    ...detail,
    reasonCode: applyResult.reasonCode || "INDEED_APPLY_FLOW_INCOMPLETE",
    reason: "Indeed apply flow did not complete",
  });
  return true;
}

async function stopRun(message) {
  if (message) await pushLog(message, "warn");
  await sendMessage({ type: "CP_STOP" });
}

async function goToNextPage(settings, pageIndex) {
  if (pageIndex + 1 >= MAX_PAGES_PER_RUN) return false;
  const nextStart = (pageIndex + 1) * 10;
  await pushLog("Moving to next Indeed results page.", "info");
  window.location.href = buildSearchUrl(settings, nextStart);
  return true;
}

async function runEngine(token) {
  if (engineRunning) return;
  engineRunning = true;

  try {
    const boot = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
    localProgress = {
      applied: Math.max(0, Number(boot?.state?.applied || 0)),
      skipped: Math.max(0, Number(boot?.state?.skipped || 0)),
      failed: Math.max(0, Number(boot?.state?.failed || 0)),
    };

    const settings = await loadSettings();
    await warnUnsupportedFilters(settings);
    await refreshAppliedIdsCache();
    await pushLog("Automation engine initialized", "info");

    if (!isJobsPage()) {
      await pushLog("Opening Indeed Jobs results page.", "info");
      window.location.href = buildSearchUrl(settings, 0);
      return;
    }

    const url = new URL(window.location.href);
    if (!url.searchParams.get("q") && !url.pathname.startsWith("/viewjob")) {
      window.location.href = buildSearchUrl(settings, Number(url.searchParams.get("start") || 0));
      return;
    }

    const pageIndex = Math.max(0, Math.floor(Number(url.searchParams.get("start") || 0) / 10));
    const cards = getJobCards();
    await pushLog(`Found ${cards.length} job cards`, "info");

    if (!cards.length) {
      const moved = await goToNextPage(settings, pageIndex);
      if (!moved) await stopRun("No more Indeed results to scan.");
      return;
    }

    let handled = 0;
    for (const card of cards) {
      if (token !== engineToken) return;
      const latest = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
      if (!latest?.state?.running || latest?.state?.paused) return;
      await handleJobCard(card, settings, latest.state || {});
      handled += 1;

      if (localProgress.applied >= Math.max(1, Number(settings.maxApplicationsPerRun || 200))) {
        await stopRun("Reached max applications per run.");
        return;
      }
      if (localProgress.skipped >= Math.max(1, Number(settings.maxSkipsPerRun || 200))) {
        await stopRun("Reached max skips per run.");
        return;
      }
    }

    if (!handled) {
      await stopRun("Indeed results exhausted without new jobs.");
      return;
    }

    const moved = await goToNextPage(settings, pageIndex);
    if (!moved) await stopRun("Indeed run finished.");
  } catch (error) {
    await pushLog(String(error?.message || error || "Indeed automation failed"), "error");
    await sendMessage({ type: "CP_SET_ERROR", error: String(error?.message || error || "Indeed automation failed") });
    await sendMessage({ type: "CP_STOP" });
  } finally {
    engineRunning = false;
  }
}

async function pollBootstrap() {
  ensurePanel();
  const boot = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
  const state = boot?.state || {};
  const settings = await loadSettings();
  updatePanel(state, settings);

  if (state.running && !state.paused && !engineRunning) {
    engineToken += 1;
    void runEngine(engineToken);
  }
  if ((!state.running || state.paused) && engineRunning) {
    engineToken += 1;
  }
}

function boot() {
  ensurePanel();
  void pollBootstrap();
  window.setInterval(() => {
    void pollBootstrap();
  }, PANEL_POLL_MS);
}

boot();
