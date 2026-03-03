const PANEL_ID = "cp-linkedin-copilot-panel";
const TOGGLE_ID = "cp-linkedin-copilot-toggle";
const STATE_POLL_MS = 1200;
const STEP_DELAY_MS = 900;
const NO_PROGRESS_TIMEOUT_MS = 120000;
const NO_PROGRESS_MAX_CYCLES = 25;
const MANUAL_ANSWER_WAIT_MS = 45000;
const MANUAL_ANSWER_POLL_MS = 1200;
const JOBS_SEARCH_URL = "https://www.linkedin.com/jobs/search/?f_AL=true";
const PANEL_PREFS_KEY = "cpPanelPrefs";
const RUN_SEEN_STORAGE_KEY = "cpRunSeenSnapshot";

let panelEl = null;
let runningLoop = false;
let runStats = { applied: 0, skipped: 0, failed: 0 };
let preparedRun = false;
let extensionContextAlive = true;
let debugBadgeEl = null;
let runSeenJobKeys = new Set();
let runSearchTermCursor = 0;
let runSearchTermSuccessCount = 0;
let lastRunStartedAt = null;
let resumeChoiceCache = new Map();
let currentJobContext = {
  title: "",
  company: "",
  workLocation: "",
  description: "",
  aboutCompany: "",
  jobId: "",
  jobUrl: ""
};
let panelPrefs = {
  left: null,
  top: null,
  width: null,
  height: null,
  minimized: false,
  maximized: false
};

function ensureDebugBadge() {
  if (debugBadgeEl && document.body.contains(debugBadgeEl)) return debugBadgeEl;
  const el = document.createElement("div");
  el.id = "cp-panel-debug-badge";
  Object.assign(el.style, {
    position: "fixed",
    left: "10px",
    top: "10px",
    zIndex: "2147483647",
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    fontSize: "11px",
    padding: "4px 8px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    fontFamily: "monospace",
    cursor: "pointer",
    maxWidth: "70vw",
  });
  el.title = "Click to reset copilot panel position";
  el.addEventListener("click", () => {
    panelPrefs.left = Math.max(8, window.innerWidth - 440);
    panelPrefs.top = 84;
    panelPrefs.minimized = false;
    panelPrefs.maximized = false;
    savePanelPrefs();
    applyPanelLayout();
    logPanelDebug("debug-badge-reset");
  });
  document.body.appendChild(el);
  debugBadgeEl = el;
  return el;
}

function logPanelDebug(reason = "state") {
  try {
    const badge = ensureDebugBadge();
    if (!panelEl) {
      badge.textContent = `CP: panel missing (${reason})`;
      console.debug("[CP]", reason, "panel missing");
      return;
    }
    const rect = panelEl.getBoundingClientRect();
    const visible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    badge.textContent = `CP: ${visible ? "visible" : "offscreen"} x=${Math.round(rect.left)} y=${Math.round(rect.top)} w=${Math.round(rect.width)} h=${Math.round(rect.height)} (${reason})`;
    console.debug("[CP]", reason, {
      visible,
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      prefs: panelPrefs,
      className: panelEl.className,
    });
  } catch {
    // ignore debug failures
  }
}

function markContextInvalidated() {
  extensionContextAlive = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadRunSeenJobKeys(runStartedAt) {
  const runId = String(runStartedAt || "").trim();
  if (!runId) return new Set();
  try {
    const raw = localStorage.getItem(RUN_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Set();
    if (String(parsed.startedAt || "") !== runId) return new Set();
    const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
    return new Set(keys.map((k) => String(k || "").trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

function persistRunSeenJobKeys(runStartedAt) {
  const runId = String(runStartedAt || "").trim();
  try {
    if (!runId) {
      localStorage.removeItem(RUN_SEEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      RUN_SEEN_STORAGE_KEY,
      JSON.stringify({
        startedAt: runId,
        keys: Array.from(runSeenJobKeys).slice(0, 5000)
      })
    );
  } catch {
    // ignore storage failures
  }
}

function markJobSeen(jobKey) {
  const key = String(jobKey || "").trim();
  if (!key) return;
  runSeenJobKeys.add(key);
  persistRunSeenJobKeys(lastRunStartedAt);
}

function clearSeenJobsForRun(runStartedAt = "") {
  runSeenJobKeys = new Set();
  persistRunSeenJobKeys(runStartedAt);
}

function loadPanelPrefs() {
  try {
    const raw = localStorage.getItem(PANEL_PREFS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    panelPrefs = {
      ...panelPrefs,
      ...parsed
    };
  } catch {
    // ignore corrupted prefs
  }
}

function savePanelPrefs() {
  try {
    localStorage.setItem(PANEL_PREFS_KEY, JSON.stringify(panelPrefs));
  } catch {
    // ignore storage failures
  }
}

function applyPanelLayout() {
  if (!panelEl) return;
  panelEl.classList.toggle("cp-minimized", Boolean(panelPrefs.minimized));
  panelEl.classList.toggle("cp-maximized", Boolean(panelPrefs.maximized));
  if (panelPrefs.maximized) {
    panelEl.style.left = "12px";
    panelEl.style.top = "12px";
    panelEl.style.right = "12px";
    panelEl.style.bottom = "12px";
    panelEl.style.width = "auto";
    panelEl.style.maxHeight = "none";
    panelEl.style.height = "calc(100vh - 24px)";
    return;
  }

  panelEl.style.right = "auto";
  panelEl.style.bottom = "auto";
  const fallbackLeft = Math.max(8, window.innerWidth - 440);
  const fallbackTop = 84;
  if (typeof panelPrefs.left === "number") {
    const maxLeft = Math.max(8, window.innerWidth - 140);
    panelEl.style.left = `${Math.max(8, Math.min(maxLeft, panelPrefs.left))}px`;
  } else {
    panelEl.style.left = `${fallbackLeft}px`;
    panelPrefs.left = fallbackLeft;
  }
  if (typeof panelPrefs.top === "number") {
    const maxTop = Math.max(8, window.innerHeight - 90);
    panelEl.style.top = `${Math.max(8, Math.min(maxTop, panelPrefs.top))}px`;
  } else {
    panelEl.style.top = `${fallbackTop}px`;
    panelPrefs.top = fallbackTop;
  }
  if (typeof panelPrefs.width === "number" && panelPrefs.width >= 320) {
    panelEl.style.width = `${Math.min(window.innerWidth - 16, panelPrefs.width)}px`;
  } else {
    panelEl.style.width = "min(420px, calc(100vw - 22px))";
  }
  panelEl.style.height = "";
  panelEl.style.maxHeight = "78vh";
  logPanelDebug("apply-layout");
}

function setPanelMinimized(minimized) {
  panelPrefs.minimized = Boolean(minimized);
  savePanelPrefs();
  applyPanelLayout();
}

function setPanelMaximized(maximized) {
  panelPrefs.maximized = Boolean(maximized);
  if (maximized) {
    panelPrefs.minimized = false;
  }
  savePanelPrefs();
  applyPanelLayout();
}

function enablePanelDragging() {
  if (!panelEl) return;
  const head = panelEl.querySelector(".cp-head");
  if (!head) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = (event) => {
    if (!dragging || !panelEl) return;
    const nextLeft = Math.max(8, Math.min(window.innerWidth - 120, event.clientX - offsetX));
    const nextTop = Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY));
    panelPrefs.left = nextLeft;
    panelPrefs.top = nextTop;
    panelEl.style.left = `${nextLeft}px`;
    panelEl.style.top = `${nextTop}px`;
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    panelEl?.classList.remove("cp-dragging");
    savePanelPrefs();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  head.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".cp-window-actions, button, input")) {
      return;
    }
    if (panelPrefs.maximized) {
      setPanelMaximized(false);
    }
    if (!panelEl) return;
    const rect = panelEl.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    dragging = true;
    panelEl.classList.add("cp-dragging");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });
}

function sendMessage(message) {
  return new Promise((resolve) => {
    if (!extensionContextAlive) {
      resolve({ ok: false, error: "Extension context invalidated" });
      return;
    }
    if (!chrome?.runtime?.id) {
      markContextInvalidated();
      resolve({ ok: false, error: "Extension runtime unavailable" });
      return;
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const runtimeError = chrome.runtime?.lastError;
        if (runtimeError) {
          const msg = String(runtimeError.message || "Runtime message error");
          if (msg.toLowerCase().includes("context invalidated")) {
            markContextInvalidated();
          }
          resolve({ ok: false, error: msg });
          return;
        }
        resolve(response || { ok: false });
      });
    } catch (error) {
      const msg = String(error?.message || error || "Runtime sendMessage failed");
      if (msg.toLowerCase().includes("context invalidated")) {
        markContextInvalidated();
      }
      resolve({ ok: false, error: msg });
    }
  });
}

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event?.reason?.message || event?.reason || "");
  if (msg.toLowerCase().includes("extension context invalidated")) {
    markContextInvalidated();
    event.preventDefault();
  }
});

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function logLine(message, level = "info", meta = undefined) {
  return sendMessage({ type: "CP_LOG", message, level, meta });
}

function userChat(text) {
  return logLine(`You: ${String(text || "").trim()}`, "user");
}

function botChat(text, level = "info") {
  return logLine(`Copilot: ${String(text || "").trim()}`, level);
}

async function debugLog(settings, message, meta = undefined) {
  if (!settings?.debugMode) return;
  await logLine(`[debug] ${message}`, "info", meta);
}

function getBySelectorList(selectors, root = document) {
  for (const s of selectors) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
}

function getAllBySelectorList(selectors, root = document) {
  for (const s of selectors) {
    const list = root.querySelectorAll(s);
    if (list.length) return Array.from(list);
  }
  return [];
}

function safeQuerySelectorAll(root, selector, settings = null, context = "querySelectorAll") {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch (error) {
    void debugLog(settings || { debugMode: true }, `${context} selector failed`, {
      selector,
      error: error?.message || String(error)
    });
    return [];
  }
}

function isJobsPage() {
  return window.location.pathname.startsWith("/jobs");
}

function isJobsSearchPage() {
  return window.location.pathname.startsWith("/jobs/search");
}

function isJobsViewPage() {
  return window.location.pathname.startsWith("/jobs/view") || window.location.href.includes("/jobs/view/");
}

function isPostApplySearchPage() {
  return window.location.pathname.startsWith("/jobs/search/post-apply");
}

async function isRunActive() {
  const boot = await getBootstrap();
  return Boolean(boot?.state?.running && !boot?.state?.paused);
}

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function questionKeyFromLabel(label) {
  const n = normalizeLabel(label);
  if (!n) return "";
  return n.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

function cleanQuestionLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getQuestionLabel(block) {
  if (!block) return "";
  const candidates = [];
  const labelNodes = block.querySelectorAll(
    "label, legend, .fb-dash-form-element__label, .artdeco-text-input--label, [data-test-form-builder-radio-button-form-component__title], [class*='label']"
  );
  for (const el of labelNodes) {
    const text = cleanQuestionLabel(el.textContent || "");
    if (text) candidates.push(text);
  }

  const inputLike = block.querySelector(
    "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], [aria-labelledby]"
  );
  if (inputLike) {
    const ariaLabel = cleanQuestionLabel(inputLike.getAttribute("aria-label") || "");
    if (ariaLabel) candidates.push(ariaLabel);
    const labelledBy = String(inputLike.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/g)) {
        const el = document.getElementById(id);
        const txt = cleanQuestionLabel(el?.textContent || "");
        if (txt) candidates.push(txt);
      }
    }
  }

  if (!candidates.length) return "";
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function normalizePhoneForInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

function normalizeNumberString(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.round(n)));
}

function normalizeAmount(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatNumericAnswer(value, maxFractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Number(n.toFixed(maxFractionDigits));
  return String(rounded);
}

function getSalaryAnswer(label, settings) {
  const l = normalizeLabel(label);
  const useCurrent = l.includes("current") || l.includes("present");
  const amount = normalizeAmount(useCurrent ? settings.currentCtc : settings.desiredSalary);
  if (amount === null) return "";
  if (l.includes("month")) return formatNumericAnswer(amount / 12, 2);
  if (l.includes("lakh") || l.includes("lac")) return formatNumericAnswer(amount / 100000, 2);
  return String(Math.round(amount));
}

function normalizeCityAnswer(currentCityValue, workLocationValue = "") {
  const source = String(currentCityValue || "").trim() || String(workLocationValue || "").trim();
  if (!source) return "";
  const noParen = source.split("(", 1)[0].trim();
  const firstPart = noParen.split(",", 1)[0].trim();
  const normalized = normalizeLabel(firstPart);
  if (!firstPart || ["remote", "united states", "usa", "india", "worldwide"].includes(normalized)) {
    return "";
  }
  return firstPart;
}

function buildFullName(settings) {
  const explicit = String(settings.fullName || "").trim();
  if (explicit) return explicit;
  return [settings.firstName, settings.middleName, settings.lastName]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function visibleText(el) {
  return normalizeLabel(el?.textContent || el?.innerText || "");
}

function isMarketingConsentQuestion(label) {
  const l = normalizeLabel(label);
  return (
    (l.includes("receive") && (l.includes("email") || l.includes("text") || l.includes("phone"))) ||
    l.includes("matching opportunities") ||
    l.includes("prerecorded voice")
  );
}

function answerCommonQuestion(label, settings) {
  const l = normalizeLabel(label);
  const key = questionKeyFromLabel(l);
  const manualByKey = settings?.screeningAnswers?.[key];
  if (manualByKey) return String(manualByKey);
  const manualByLabel = settings?.screeningAnswers?.[l];
  if (manualByLabel) return String(manualByLabel);

  const fullName = buildFullName(settings);
  const currentCity = normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  const yearsValue =
    String(settings.yearsOfExperienceAnswer || "").trim() ||
    (Number(settings.currentExperience) >= 0 ? String(Number(settings.currentExperience)) : "");
  const noticeDays = normalizeNumberString(settings.noticePeriodDays);
  const noticeMonths = noticeDays ? String(Math.floor(Number(noticeDays) / 30)) : "";
  const noticeWeeks = noticeDays ? String(Math.floor(Number(noticeDays) / 7)) : "";

  if (l.includes("visa") || l.includes("sponsorship")) return settings.requireVisa || "No";
  if (
    l.includes("citizenship") ||
    l.includes("employment eligibility") ||
    l.includes("work authorization") ||
    (l.includes("authorized") && l.includes("work"))
  ) {
    return settings.usCitizenship || "";
  }
  if (l.includes("protected") && l.includes("veteran")) return settings.veteranStatus || "";
  if (l.includes("veteran")) return settings.veteranStatus || "";
  if (l.includes("disability") || l.includes("handicapped")) return settings.disabilityStatus || "";
  if (l.includes("gender") || l.includes("sex")) return settings.gender || "";
  if (l.includes("ethnicity") || l.includes("race")) return settings.ethnicity || "";
  if (isMarketingConsentQuestion(l)) {
    return settings.marketingConsent || "No";
  }
  if (l.includes("experience") && l.includes("year")) return yearsValue;
  if (l.includes("notice")) {
    if (l.includes("month")) return noticeMonths;
    if (l.includes("week")) return noticeWeeks;
    return noticeDays;
  }
  if (l.includes("salary") || l.includes("compensation") || l.includes("ctc") || l.includes("pay")) {
    return getSalaryAnswer(l, settings);
  }
  if (l.includes("location") || l.includes("city") || l.includes("address")) return currentCity || "";
  if (l.includes("email")) return settings.contactEmail || "";
  if (l.includes("phone number") || l === "phone" || l.includes("mobile")) return normalizePhoneForInput(settings.phoneNumber || "");
  if (l.includes("phone country code")) return settings.phoneCountryCode || "";
  if (l.includes("signature")) return fullName;
  if (l.includes("name")) {
    if (l.includes("full")) return fullName;
    if (l.includes("first") && !l.includes("last")) return settings.firstName || fullName;
    if (l.includes("middle") && !l.includes("last")) return settings.middleName || "";
    if (l.includes("last") && !l.includes("first")) return settings.lastName || fullName;
    if (l.includes("employer")) return settings.recentEmployer || "";
    return fullName;
  }
  if (l.includes("linkedin")) return settings.linkedinUrl || "";
  if (l.includes("website") || l.includes("blog") || l.includes("portfolio") || l.includes("link")) return settings.websiteUrl || "";
  if (l.includes("scale of 1-10") || l.includes("confidence level")) return settings.confidenceLevel || "";
  if ((l.includes("hear") || l.includes("come across")) && l.includes("this") && (l.includes("job") || l.includes("position"))) {
    return settings.websiteUrl || settings.linkedinUrl || "https://github.com/GodsScion/Auto_job_applier_linkedIn";
  }
  if (l.includes("headline")) return settings.linkedinHeadline || "";
  if (l.includes("summary")) return settings.linkedinSummary || "";
  if (l.includes("cover")) return settings.coverLetter || "";
  if (l.includes("street")) return settings.streetAddress || "";
  if (l.includes("state") || l.includes("province")) return settings.stateRegion || "";
  if (l.includes("zip") || l.includes("postal")) return settings.postalCode || "";
  if (l.includes("country")) return settings.country || "";
  return "";
}

async function resilientClick(el, name) {
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(180);
    el.click();
    return true;
  } catch {
    try {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch {
      await logLine(`Failed to click ${name}`, "warn");
      return false;
    }
  }
}

function getApplyButtonFromDetailPane() {
  // Scope strictly to job detail/top-card areas to avoid matching filter pills.
  const detailRoots = getAllBySelectorList([
    ".jobs-search__job-details",
    ".jobs-details",
    ".jobs-unified-top-card",
    ".jobs-details-top-card",
    ".scaffold-layout__detail"
  ]);
  const roots = detailRoots.length ? detailRoots : [document];

  const candidates = [];
  for (const root of roots) {
    const localButtons = Array.from(
      root.querySelectorAll(
        "button.jobs-apply-button, .jobs-s-apply button, button[aria-label*='Apply'], button[data-control-name*='jobdetails_topcard']"
      )
    );
    candidates.push(...localButtons);
  }

  const enabled = candidates.filter((b) => {
    if (!b || b.disabled) return false;
    // Ignore job search filter buttons and pill controls.
    if (b.closest(".jobs-search-box__filters-bar, .search-reusables__filters-bar, .jobs-search-box__filter-item")) return false;
    const cls = normalizeLabel(b.className || "");
    const aria = normalizeLabel(b.getAttribute("aria-label") || "");
    const txt = normalizeLabel(b.textContent || "");
    if (cls.includes("filter") || aria.includes("filter")) return false;
    if (txt === "easy apply" && cls.includes("filter")) return false;
    return true;
  });

  const easyApply = enabled.find((b) => {
    const txt = `${normalizeLabel(b.getAttribute("aria-label") || "")} ${normalizeLabel(b.textContent || "")}`;
    return txt.includes("easy apply");
  });
  if (easyApply) return { type: "easy", button: easyApply };

  const externalApply = enabled.find((b) => {
    const txt = `${normalizeLabel(b.getAttribute("aria-label") || "")} ${normalizeLabel(b.textContent || "")}`;
    if (!txt.includes("apply")) return false;
    if (txt.includes("easy apply")) return false;
    return true;
  });
  if (externalApply) return { type: "external", button: externalApply };
  return { type: "none", button: null };
}

async function waitForApplyButtonFromDetailPane(settings, timeoutMs = 7000, context = "detail pane") {
  const timeout = Math.max(1000, Number(timeoutMs || 7000));
  const start = Date.now();
  let polls = 0;
  while (Date.now() - start < timeout) {
    polls += 1;
    const action = getApplyButtonFromDetailPane();
    if (action.button) {
      if (polls > 1) {
        await debugLog(settings, "Apply button appeared after wait", {
          context,
          polls,
          elapsedMs: Date.now() - start,
          type: action.type
        });
      }
      return action;
    }

    if (polls % 5 === 0) {
      const detailRoot = getBySelectorList([
        ".jobs-search__job-details",
        ".jobs-details",
        ".jobs-unified-top-card",
        ".jobs-details-top-card",
        ".scaffold-layout__detail"
      ]);
      if (detailRoot && typeof detailRoot.scrollBy === "function") {
        detailRoot.scrollBy({ top: 120, behavior: "smooth" });
      }
    }
    await sleep(220);
  }
  await debugLog(settings, "Apply button wait timed out", {
    context,
    elapsedMs: Date.now() - start,
    detailRoots: document.querySelectorAll(".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail").length,
    applyButtonsVisible: document.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button").length
  });
  return { type: "none", button: null };
}

function isAlreadyAppliedCard(card) {
  const cardText = normalizeLabel(card?.textContent || "");
  if (cardText.includes("applied")) return true;
  const footer = card?.querySelector(".job-card-container__footer-job-state, .job-card-list__footer-wrapper, .jobs-card__listdate");
  const footerText = normalizeLabel(footer?.textContent || "");
  return footerText.includes("applied");
}

function getJobKeyFromCard(card) {
  const idHolder = card?.closest?.("[data-occludable-job-id]") || card;
  const explicit = idHolder?.getAttribute?.("data-occludable-job-id");
  if (explicit) return explicit;
  const anchor = getCardAnchor(card);
  const href = String(anchor?.href || "");
  const match = href.match(/\/jobs\/view\/(\d+)/);
  if (match?.[1]) return match[1];
  const title = normalizeLabel(anchor?.textContent || card?.textContent || "");
  return title.slice(0, 140);
}

function parseListSetting(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function extractCardMeta(card) {
  const titleRaw = String(getCardAnchor(card)?.textContent || card?.querySelector("a span")?.textContent || "").trim();
  const title = normalizeLabel(titleRaw);
  const companyCandidates = [
    card?.querySelector(".artdeco-entity-lockup__subtitle"),
    card?.querySelector(".job-card-container__primary-description"),
    card?.querySelector(".job-card-list__subtitle"),
  ].filter(Boolean);
  const locationCandidates = [
    card?.querySelector(".job-card-container__metadata-item"),
    card?.querySelector(".job-card-container__metadata-wrapper li"),
    card?.querySelector(".job-card-list__location"),
    card?.querySelector(".artdeco-entity-lockup__caption")
  ].filter(Boolean);
  const companyRaw = String(companyCandidates[0]?.textContent || "").trim();
  const workLocationRaw = String(locationCandidates[0]?.textContent || "").trim();
  const company = normalizeLabel(companyRaw);
  const workLocation = normalizeLabel(workLocationRaw);
  return { title, titleRaw, company, companyRaw, workLocation, workLocationRaw };
}

function shouldSkipByRules(card, settings) {
  const { title, company } = extractCardMeta(card);
  const blacklistCompanies = parseListSetting(settings.blacklistedCompanies).map((s) => normalizeLabel(s));
  const badWords = parseListSetting(settings.badWords).map((s) => normalizeLabel(s));

  if (company && blacklistCompanies.some((name) => name && company.includes(name))) {
    return { skip: true, reasonCode: "BLACKLISTED_COMPANY", reason: `Company blacklisted: ${company}` };
  }
  if (title && badWords.some((w) => w && title.includes(w))) {
    return { skip: true, reasonCode: "BAD_WORD_TITLE", reason: "Blocked by title bad word rule" };
  }
  return { skip: false, reasonCode: "", reason: "" };
}

function extractYearsOfExperience(text) {
  const raw = String(text || "");
  const matches = [...raw.matchAll(/(?:^|\s)(\d{1,2})\s*(?:\+|plus|-|to)?\s*(?:\d{0,2})?\s*years?/gi)];
  if (!matches.length) return 0;
  const values = matches
    .map((m) => Number(m?.[1] || 0))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 40);
  return values.length ? Math.max(...values) : 0;
}

function getJobDescriptionText() {
  const el = getBySelectorList([
    ".jobs-box__html-content",
    ".jobs-description__content",
    ".jobs-description-content__text",
    ".jobs-unified-top-card__job-insight",
    ".jobs-details__main-content"
  ]);
  const text = String(el?.textContent || "").trim();
  return text || "";
}

function shouldSkipByDescription(description, settings) {
  const text = normalizeLabel(description);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const badWords = parseListSetting(settings.badWords).map((s) => normalizeLabel(s));
  if (badWords.some((w) => w && text.includes(w))) {
    return {
      skip: true,
      reasonCode: "BAD_WORD_DESCRIPTION",
      reason: "Blocked by description bad word rule"
    };
  }

  const hasClearanceRequirement =
    text.includes("polygraph") ||
    text.includes("security clearance") ||
    text.includes("clearance required") ||
    text.includes("secret clearance");
  if (!settings.securityClearance && hasClearanceRequirement) {
    return {
      skip: true,
      reasonCode: "SECURITY_CLEARANCE_REQUIRED",
      reason: "Security clearance requirement detected"
    };
  }

  const configuredExperience = Number(settings.currentExperience);
  if (Number.isFinite(configuredExperience) && configuredExperience >= 0) {
    const required = extractYearsOfExperience(text);
    if (required > 0) {
      const allowed = configuredExperience + (settings.didMasters ? 2 : 0);
      if (required > allowed) {
        return {
          skip: true,
          reasonCode: "EXPERIENCE_TOO_HIGH",
          reason: `Required experience ${required} > allowed ${allowed}`
        };
      }
    }
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function getAboutCompanyText() {
  const el = getBySelectorList([
    ".jobs-company__box",
    ".jobs-company__company-description",
    ".jobs-company__overview",
    ".jobs-company__inline-information"
  ]);
  return String(el?.textContent || "").trim();
}

function shouldSkipByAboutCompany(aboutCompanyText, settings) {
  const text = normalizeLabel(aboutCompanyText);
  if (!text) return { skip: false, reasonCode: "", reason: "" };

  const goodWords = parseListSetting(settings.aboutCompanyGoodWords).map((s) => normalizeLabel(s));
  if (goodWords.some((w) => w && text.includes(w))) {
    return { skip: false, reasonCode: "", reason: "" };
  }

  const badWords = parseListSetting(settings.aboutCompanyBadWords).map((s) => normalizeLabel(s));
  const match = badWords.find((w) => w && text.includes(w));
  if (match) {
    return {
      skip: true,
      reasonCode: "ABOUT_COMPANY_BAD_WORD",
      reason: `About company contains blocked word: ${match}`
    };
  }

  return { skip: false, reasonCode: "", reason: "" };
}

function hasDailyEasyApplyLimitSignal(root = document) {
  const candidates = getAllBySelectorList(
    [
      ".artdeco-inline-feedback__message",
      "[role='alert']",
      ".jobs-apply-button--top-card + .artdeco-inline-feedback__message",
      ".jobs-unified-top-card .artdeco-inline-feedback__message"
    ],
    root
  );
  const combined = normalizeLabel(candidates.map((el) => String(el?.textContent || "")).join(" "));
  return combined.includes("daily application limit") || combined.includes("exceeded the daily application limit");
}

async function recordOutcome(outcomeType, data) {
  await sendMessage({
    type: "CP_RECORD_OUTCOME",
    outcomeType,
    data: {
      ...(data || {}),
      pageUrl: window.location.href
    }
  });
}

async function requestAiAnswer(questionLabel, questionType, options = [], validationMessage = "") {
  const response = await sendMessage({
    type: "CP_AI_ANSWER",
    question: questionLabel,
    questionType,
    options,
    validationMessage,
    jobContext: currentJobContext
  });
  if (!response?.ok) return "";
  return String(response.answer || "").trim();
}

function buildAnswerPhrases(answer) {
  const normalized = normalizeLabel(answer);
  if (!normalized) return [];
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const phrases = [normalized];
  if (compact && compact !== normalized) phrases.push(compact);
  if (normalized === "decline" || normalized.includes("prefer not")) {
    phrases.push("decline", "prefer not", "not wish", "don't wish", "not want", "opt out", "do not contact", "no");
  } else if (normalized.includes("yes")) {
    phrases.push("yes", "agree", "i do", "i have", "accept", "consent", "opt in");
  } else if (normalized.includes("no")) {
    phrases.push("no", "disagree", "i don't", "i do not", "decline", "do not contact", "opt out");
  }
  return [...new Set(phrases.filter(Boolean))];
}

function optionFingerprint(value) {
  return normalizeLabel(value).replace(/[^a-z0-9]/g, "");
}

function selectBestOption(options, answer) {
  const phrases = buildAnswerPhrases(answer);
  if (!phrases.length) return null;
  for (const phrase of phrases) {
    const phraseFp = optionFingerprint(phrase);
    const target =
      options.find((o) => normalizeLabel(o.text || "") === phrase) ||
      options.find((o) => normalizeLabel(o.text || "").includes(phrase)) ||
      options.find((o) => phrase.includes(normalizeLabel(o.text || ""))) ||
      options.find((o) => optionFingerprint(o.text || "") === phraseFp) ||
      options.find((o) => optionFingerprint(o.text || "").includes(phraseFp)) ||
      options.find((o) => phraseFp.includes(optionFingerprint(o.text || "")));
    if (target) return target;
  }
  return null;
}

function selectFallbackOption(options) {
  if (!Array.isArray(options) || !options.length) return null;
  const cleaned = options.filter((o) => !isPlaceholderOptionText(String(o?.text || "")));
  if (!cleaned.length) return null;

  const safeNo = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return (
      t === "no" ||
      t.includes(" no ") ||
      t.startsWith("no ") ||
      t.endsWith(" no") ||
      t.includes("decline") ||
      t.includes("prefer not")
    );
  });
  if (safeNo) return safeNo;

  const notApplicable = cleaned.find((o) => {
    const t = normalizeLabel(o.text || "");
    return t.includes("not applicable") || t === "n/a";
  });
  if (notApplicable) return notApplicable;

  // Deterministic fallback avoids oscillating answers across retries.
  return cleaned[0];
}

function getRadioOptionText(input, root = document) {
  if (!input) return "";
  const candidates = [];
  const inlineLabel = input.closest("label");
  if (inlineLabel) candidates.push(cleanQuestionLabel(inlineLabel.textContent || ""));
  if (input.id) {
    const forLabel =
      root?.querySelector?.(`label[for='${CSS.escape(input.id)}']`) ||
      document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (forLabel) candidates.push(cleanQuestionLabel(forLabel.textContent || ""));
  }
  const parentText = cleanQuestionLabel(input.parentElement?.textContent || "");
  if (parentText) candidates.push(parentText);
  const ariaText = cleanQuestionLabel(input.getAttribute("aria-label") || "");
  if (ariaText) candidates.push(ariaText);
  const valueText = cleanQuestionLabel(input.value || "");
  if (valueText) candidates.push(valueText);
  candidates.sort((a, b) => b.length - a.length);
  return candidates.find(Boolean) || "";
}

function getRadioClickTarget(input, root = document) {
  if (!input) return null;
  if (input.id) {
    const forLabel =
      root?.querySelector?.(`label[for='${CSS.escape(input.id)}']`) ||
      document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (forLabel) return forLabel;
  }
  return input.closest("label") || input;
}

function isResumeOptionText(value) {
  const text = normalizeLabel(value);
  if (!text) return false;
  if (text.includes("select resume") || text.includes("deselect resume")) return true;
  if (text.includes("resume") && (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx"))) return true;
  return false;
}

function getResumeOptionIdentity(value) {
  const raw = normalizeLabel(value);
  if (!raw) return "";
  const cleaned = raw
    .replace(/\bselect resume\b/g, "")
    .replace(/\bdeselect resume\b/g, "")
    .replace(/\buploaded\b.*$/g, "")
    .replace(/\blast updated\b.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return optionFingerprint(cleaned || raw);
}

function getResumeChoiceCacheKey(questionLabel = "") {
  const jobKey = String(currentJobContext.jobId || currentJobContext.jobUrl || window.location.pathname || "job")
    .trim()
    .slice(0, 180);
  const labelKey = questionKeyFromLabel(questionLabel || "resume") || "resume";
  return `${jobKey}::${labelKey}`;
}

function getResumeOptionRecencyScore(textValue) {
  const raw = String(textValue || "");
  const norm = normalizeLabel(raw);
  if (!norm) return 0;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (norm.includes("today")) return now;
  if (norm.includes("yesterday")) return now - dayMs;

  const agoMatch = norm.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s+ago/);
  if (agoMatch) {
    const amount = Number(agoMatch[1] || 0);
    const unit = agoMatch[2] || "";
    if (Number.isFinite(amount) && amount >= 0) {
      const multipliers = {
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: dayMs,
        week: 7 * dayMs,
        month: 30 * dayMs,
        year: 365 * dayMs
      };
      const unitMs = multipliers[unit] || 0;
      if (unitMs > 0) return now - amount * unitMs;
    }
  }

  const monthMap = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
  };
  const monthMatch = raw.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,|\s)\s*(\d{2,4})\b/i);
  if (monthMatch) {
    const monthKey = String(monthMatch[1] || "").slice(0, 3).toLowerCase();
    const day = Number(monthMatch[2] || 0);
    let year = Number(monthMatch[3] || 0);
    if (year < 100) year += 2000;
    if (monthKey in monthMap && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return new Date(year, monthMap[monthKey], day).getTime();
    }
  }

  const numericMatch = raw.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (numericMatch) {
    let month = Number(numericMatch[1] || 0);
    let day = Number(numericMatch[2] || 0);
    let year = Number(numericMatch[3] || 0);
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const tmp = month;
      month = day;
      day = tmp;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      return new Date(year, month - 1, day).getTime();
    }
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPreferredResumeOption(options, questionLabel = "") {
  if (!Array.isArray(options) || !options.length) return null;
  const resumeOptions = options.filter((option) => isResumeOptionText(option?.text || option?.value || ""));
  if (!resumeOptions.length) return null;

  const cacheKey = getResumeChoiceCacheKey(questionLabel);
  const cachedIdentity = resumeChoiceCache.get(cacheKey);
  if (cachedIdentity) {
    const cached = resumeOptions.find(
      (option) => getResumeOptionIdentity(option?.text || option?.value || "") === cachedIdentity
    );
    if (cached) return cached;
  }

  const ranked = resumeOptions
    .map((option, index) => {
      const text = String(option?.text || option?.value || "");
      const norm = normalizeLabel(text);
      const recencyScore = getResumeOptionRecencyScore(text);
      const selectionScore = norm.includes("select resume") ? 2 : norm.includes("deselect resume") ? 1 : 0;
      const checkedScore = option?.input?.checked ? 1 : 0;
      return { option, index, recencyScore, selectionScore, checkedScore };
    })
    .sort((a, b) => {
      if (b.recencyScore !== a.recencyScore) return b.recencyScore - a.recencyScore;
      if (b.selectionScore !== a.selectionScore) return b.selectionScore - a.selectionScore;
      if (b.checkedScore !== a.checkedScore) return b.checkedScore - a.checkedScore;
      return a.index - b.index;
    });

  const picked = ranked[0]?.option || null;
  if (picked) {
    resumeChoiceCache.set(cacheKey, getResumeOptionIdentity(picked?.text || picked?.value || ""));
  }
  return picked;
}

async function logOutcome(kind, message, reasonCode = "", meta = undefined) {
  const m = reasonCode ? `${message}` : message;
  await logLine(m, kind, { ...(meta || {}), reasonCode: reasonCode || undefined });
}

function getConfiguredSearchTerms(settings) {
  return parseListSetting(settings.searchTerms);
}

function getSwitchNumber(settings) {
  return Math.max(1, Number(settings.switchNumber || 1));
}

function getCurrentSearchKeyword() {
  try {
    const url = new URL(window.location.href);
    return String(url.searchParams.get("keywords") || "").trim();
  } catch {
    return "";
  }
}

function buildJobsSearchUrl(keyword = "") {
  const url = new URL(JOBS_SEARCH_URL);
  const cleanKeyword = String(keyword || "").trim();
  if (cleanKeyword) {
    url.searchParams.set("keywords", cleanKeyword);
  }
  return url.toString();
}

function getActiveRunSearchUrl(settings) {
  const term = getConfiguredSearchTerms(settings)[runSearchTermCursor] || "";
  const url = new URL(buildJobsSearchUrl(term));
  const dateParam = datePostedToLinkedInParam(settings?.datePosted || "");
  const sortParam = sortByToLinkedInParam(settings?.sortBy || "");
  if (dateParam) url.searchParams.set("f_TPR", dateParam);
  if (sortParam) url.searchParams.set("sortBy", sortParam);
  return url.toString();
}

function datePostedToLinkedInParam(value) {
  const v = normalizeLabel(value);
  if (v === "past 24 hours") return "r86400";
  if (v === "past week") return "r604800";
  if (v === "past month") return "r2592000";
  return "";
}

function getNextDatePostedValue(currentValue, stopAt24Hours = true) {
  const options = ["Any time", "Past month", "Past week", "Past 24 hours"];
  const normalizedCurrent = normalizeLabel(currentValue);
  const currentIndex = Math.max(
    0,
    options.findIndex((value) => normalizeLabel(value) === normalizedCurrent)
  );
  const nextIndex = Math.min(options.length - 1, currentIndex + 1);
  if (stopAt24Hours) {
    return options[nextIndex];
  }
  return options[(currentIndex + 1) % options.length];
}

function sortByToLinkedInParam(value) {
  const v = normalizeLabel(value);
  if (v === "most recent") return "DD";
  if (v === "most relevant") return "R";
  return "";
}

function getAlternateSortValue(currentValue) {
  return normalizeLabel(currentValue) === "most recent" ? "Most relevant" : "Most recent";
}

async function ensureSearchQueryParams(settings) {
  if (!isJobsSearchPage()) return true;
  try {
    const url = new URL(window.location.href);
    const before = url.toString();
    const dateParam = datePostedToLinkedInParam(settings.datePosted || "");
    const sortParam = sortByToLinkedInParam(settings.sortBy || "");

    if (dateParam) url.searchParams.set("f_TPR", dateParam);
    else url.searchParams.delete("f_TPR");

    if (sortParam) url.searchParams.set("sortBy", sortParam);
    else url.searchParams.delete("sortBy");

    const after = url.toString();
    if (after !== before) {
      await logLine("Applied search query preferences (date/sort)", "info");
      window.location.href = after;
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

async function ensureSearchTermIfNeeded(settings) {
  if (!isJobsSearchPage()) return true;
  const terms = getConfiguredSearchTerms(settings);
  if (!terms.length) return true;
  if (runSearchTermCursor < 0 || runSearchTermCursor >= terms.length) {
    runSearchTermCursor = 0;
  }
  const selected = terms[runSearchTermCursor];
  const currentKeyword = getCurrentSearchKeyword();
  if (normalizeLabel(currentKeyword) === normalizeLabel(selected)) return true;
  await logLine(`Switching search term: ${selected}`);
  window.location.href = buildJobsSearchUrl(selected);
  return false;
}

async function rotateSearchTerm(settings) {
  const terms = getConfiguredSearchTerms(settings);
  if (terms.length <= 1) return false;
  runSearchTermCursor = (runSearchTermCursor + 1) % terms.length;
  runSearchTermSuccessCount = 0;
  const nextTerm = terms[runSearchTermCursor];
  await logLine(`Moving to next search term: ${nextTerm}`, "info");
  window.location.href = buildJobsSearchUrl(nextTerm);
  return true;
}

async function gotoNextResultsPage(settings) {
  const currentPageButton = getBySelectorList([
    ".artdeco-pagination__indicator--number.active button",
    ".artdeco-pagination__indicator--number.selected button",
    "li.artdeco-pagination__indicator--number.active button"
  ]);
  const currentPage = Number(String(currentPageButton?.textContent || "").trim() || "0");

  let nextButton = null;
  if (Number.isFinite(currentPage) && currentPage > 0) {
    nextButton = getBySelectorList([
      `.artdeco-pagination__pages button[aria-label='Page ${currentPage + 1}']`,
      `.artdeco-pagination__pages button[aria-label='page ${currentPage + 1}']`
    ]);
  }
  if (!nextButton) {
    nextButton = getBySelectorList([
      "button[aria-label='Next']",
      "button[aria-label='Page next']",
      "button.artdeco-pagination__button--next"
    ]);
  }
  if (!nextButton || nextButton.disabled) return false;

  const clicked = await resilientClick(nextButton, "Next page");
  if (!clicked) return false;
  await sleep(1400);
  await waitForJobsToRender(settings, 5000);
  await logLine("Navigated to next results page", "info");
  return true;
}

async function setSearchLocationIfNeeded(settings) {
  const location = String(settings.searchLocation || "").trim();
  if (!location) return;
  const input = getBySelectorList([
    "input[aria-label*='City, state, or zip code']",
    "input[placeholder*='City, state, or zip code']",
    "input.jobs-search-box__text-input"
  ]);
  if (!input) {
    await logLine("Search location input not found", "warn");
    await debugLog(settings, "Location selectors failed", { url: window.location.href });
    return;
  }
  input.focus();
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.value = location;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await logLine(`Search location set: ${location}`);
  await sleep(800);
}

async function applyEasyApplyFilterIfNeeded(settings) {
  if (!settings.easyApplyOnly) return;
  let urlHasEasyApplyParam = false;
  try {
    const url = new URL(window.location.href);
    urlHasEasyApplyParam = url.searchParams.get("f_AL") === "true";
  } catch {
    urlHasEasyApplyParam = window.location.href.includes("f_AL=true");
  }
  let easyBtn = getBySelectorList([
    "button[aria-label*='Easy Apply filter']",
    "button[aria-label*='Easy Apply']",
    "button.jobs-search-box__filter-pill-button"
  ]);
  if (!easyBtn) {
    const candidates = Array.from(document.querySelectorAll("button, label, span"));
    easyBtn = candidates.find((el) => visibleText(el).includes("easy apply")) || null;
  }
  if (!easyBtn) {
    // Fallback: use "All filters" modal and toggle Easy Apply there.
    const allFiltersBtn = getBySelectorList([
      "button[aria-label*='All filters']",
      "button[aria-label='All filters']",
      "button.search-reusables__all-filters-pill-button"
    ]);
    if (!allFiltersBtn) {
      if (urlHasEasyApplyParam) {
        await debugLog(settings, "Easy Apply button not visible, but URL already has f_AL=true", { url: window.location.href });
      } else {
        await logLine("Easy Apply filter button not found", "warn");
        await debugLog(settings, "Easy Apply filter selectors failed", { url: window.location.href });
      }
      return;
    }
    await resilientClick(allFiltersBtn, "All filters");
    await sleep(700);
    const switchInput = getBySelectorList([
      "input[role='switch'][aria-label*='Easy Apply']",
      "input[role='switch'][id*='easy-apply']"
    ]);
    if (switchInput) {
      const checked = switchInput.getAttribute("aria-checked") === "true" || switchInput.checked;
      if (!checked) {
        await resilientClick(switchInput, "Easy Apply switch");
        await logLine("Easy Apply filter enabled (all filters)");
      }
      const showResults = getBySelectorList([
        "button[aria-label*='Apply current filters']",
        "button[aria-label*='Show']",
        "button[data-control-name*='all_filters_apply']"
      ]);
      if (showResults) {
        await resilientClick(showResults, "Show results");
      } else {
        const dismiss = getBySelectorList(["button[aria-label='Dismiss']", "button[aria-label*='Close']"]);
        if (dismiss) await resilientClick(dismiss, "Close filters");
      }
      await sleep(700);
      return;
    }
    if (urlHasEasyApplyParam) {
      await debugLog(settings, "Easy Apply switch not found in filters modal, but URL already has f_AL=true", { url: window.location.href });
    } else {
      await logLine("Easy Apply filter button not found", "warn");
      await debugLog(settings, "Easy Apply filter selectors failed", { url: window.location.href });
    }
    return;
  }
  const active = easyBtn.getAttribute("aria-pressed") === "true" || /active|selected/i.test(easyBtn.className);
  if (active) {
    await logLine("Easy Apply filter already active");
    return;
  }
  await resilientClick(easyBtn, "Easy Apply filter");
  await logLine("Easy Apply filter enabled");
  await sleep(900);
}

function hasAdvancedFiltersConfigured(settings) {
  return (
    Boolean(String(settings.salary || "").trim()) ||
    parseListSetting(settings.experienceLevel).length > 0 ||
    parseListSetting(settings.jobType).length > 0 ||
    parseListSetting(settings.onSite).length > 0 ||
    parseListSetting(settings.companies).length > 0 ||
    parseListSetting(settings.filterLocations).length > 0 ||
    parseListSetting(settings.industry).length > 0 ||
    parseListSetting(settings.jobFunction).length > 0 ||
    parseListSetting(settings.jobTitles).length > 0 ||
    parseListSetting(settings.benefits).length > 0 ||
    parseListSetting(settings.commitments).length > 0 ||
    Boolean(settings.under10Applicants) ||
    Boolean(settings.inYourNetwork) ||
    Boolean(settings.fairChanceEmployer)
  );
}

function optionTextMatches(candidate, target) {
  const c = normalizeLabel(candidate);
  const t = normalizeLabel(target);
  if (!c || !t) return false;
  if (c === t) return true;
  if (c.startsWith(`${t} `)) return true;
  if (c.endsWith(` ${t}`)) return true;
  if (c.includes(` ${t} `)) return true;
  return false;
}

function isVisibleElement(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findVisibleControlByText(root, text) {
  const labels = Array.from(root.querySelectorAll("label"));
  for (const label of labels) {
    if (!isVisibleElement(label)) continue;
    if (optionTextMatches(label.textContent || "", text)) return label;
  }

  const controls = Array.from(root.querySelectorAll("button, [role='button'], span"));
  for (const control of controls) {
    if (!isVisibleElement(control)) continue;
    if (optionTextMatches(control.textContent || "", text)) return control;
  }
  return null;
}

function findFiltersModal() {
  return getBySelectorList([
    ".artdeco-modal[role='dialog']",
    ".search-reusables__all-filters-modal",
    ".jobs-search-box__all-filters"
  ]);
}

async function waitForFiltersModalOpen(timeoutMs = 3500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = findFiltersModal();
    if (modal) return modal;
    await sleep(120);
  }
  return null;
}

function findFilterApplyButton(modal) {
  return getBySelectorList([
    "button[aria-label*='Apply current filters']",
    "button[aria-label*='Show']",
    "button[data-control-name*='all_filters_apply']"
  ], modal);
}

async function setSwitchFilterByLabel(modal, labelText, enabled, settings) {
  const label = findVisibleControlByText(modal, labelText);
  if (!label) {
    await debugLog(settings, "Boolean filter label not found", { labelText });
    return false;
  }
  const container = label.closest("fieldset, section, li, div") || modal;
  const input = container.querySelector("input[role='switch'], input[type='checkbox']");
  if (!input) {
    await debugLog(settings, "Boolean filter switch not found", { labelText });
    return false;
  }
  const checked = input.getAttribute("aria-checked") === "true" || input.checked;
  if (checked === Boolean(enabled)) return true;
  const control = input.closest("label") || label;
  await resilientClick(control, `${labelText} filter switch`);
  await sleep(120);
  return true;
}

function findAutocompleteInputByHint(modal, hint) {
  const targetHint = normalizeLabel(hint);
  const inputs = Array.from(modal.querySelectorAll("input[placeholder], input[aria-label]"));
  return (
    inputs.find((input) => {
      const label = `${input.getAttribute("placeholder") || ""} ${input.getAttribute("aria-label") || ""}`;
      return normalizeLabel(label).includes(targetHint);
    }) || null
  );
}

async function addAutocompleteFilterValues(modal, hint, values, settings) {
  const cleaned = parseListSetting(values);
  if (!cleaned.length) return;
  for (const value of cleaned) {
    const input = findAutocompleteInputByHint(modal, hint);
    if (!input) {
      await debugLog(settings, "Autocomplete filter input not found", { hint, value });
      return;
    }
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(180);
  }
}

async function applyAdvancedFiltersIfNeeded(settings) {
  if (!hasAdvancedFiltersConfigured(settings)) return;
  const allFiltersBtn = getBySelectorList([
    "button[aria-label*='All filters']",
    "button[aria-label='All filters']",
    "button.search-reusables__all-filters-pill-button"
  ]);
  if (!allFiltersBtn) {
    await logLine("All filters button not found (advanced filters skipped)", "warn");
    await debugLog(settings, "All filters button missing", { url: window.location.href });
    return;
  }

  await resilientClick(allFiltersBtn, "All filters");
  const modal = await waitForFiltersModalOpen();
  if (!modal) {
    await logLine("Advanced filters modal did not open", "warn");
    return;
  }

  const optionTextValues = [
    ...parseListSetting(settings.experienceLevel),
    ...parseListSetting(settings.jobType),
    ...parseListSetting(settings.onSite),
    ...parseListSetting(settings.industry),
    ...parseListSetting(settings.jobFunction),
    ...parseListSetting(settings.jobTitles),
    ...parseListSetting(settings.benefits),
    ...parseListSetting(settings.commitments)
  ];
  const salary = String(settings.salary || "").trim();
  if (salary) optionTextValues.push(salary);

  for (const value of optionTextValues) {
    const control = findVisibleControlByText(modal, value);
    if (control) {
      await resilientClick(control, `filter option "${value}"`);
      await sleep(100);
    } else {
      await debugLog(settings, "Advanced filter option not found", { value });
    }
  }

  await addAutocompleteFilterValues(modal, "company", settings.companies, settings);
  await addAutocompleteFilterValues(modal, "location", settings.filterLocations, settings);

  await setSwitchFilterByLabel(modal, "Under 10 applicants", settings.under10Applicants, settings);
  await setSwitchFilterByLabel(modal, "In your network", settings.inYourNetwork, settings);
  await setSwitchFilterByLabel(modal, "Fair Chance Employer", settings.fairChanceEmployer, settings);

  const showResults = findFilterApplyButton(modal);
  if (showResults) {
    await resilientClick(showResults, "Apply current filters");
    await sleep(800);
    return;
  }

  const dismiss = getBySelectorList(["button[aria-label='Dismiss']", "button[aria-label*='Close']"], modal);
  if (dismiss) {
    await resilientClick(dismiss, "Close filters");
  }
}

async function prepareRun(settings) {
  if (!isJobsPage()) {
    await logLine("Not on Jobs page. Redirecting to LinkedIn Jobs Search.", "warn");
    await debugLog(settings, "Redirecting to jobs search (not jobs path)", { url: window.location.href });
    const initialTerm = getConfiguredSearchTerms(settings)[runSearchTermCursor] || "";
    window.location.href = buildJobsSearchUrl(initialTerm);
    return false;
  }
  if (!isJobsSearchPage()) {
    if (isPostApplySearchPage()) {
      await logLine("Returning to Jobs Search after previous submission.", "info");
      await debugLog(settings, "Redirecting out of post-apply page", { path: window.location.pathname });
      const initialTerm = getConfiguredSearchTerms(settings)[runSearchTermCursor] || "";
      window.location.href = buildJobsSearchUrl(initialTerm);
      return false;
    }
    if (isJobsViewPage()) {
      await debugLog(settings, "On jobs view page; continuing without redirect", { url: window.location.href });
      preparedRun = true;
      return true;
    }
    await logLine("Opening Jobs Search results page.", "info");
    await debugLog(settings, "Redirecting to jobs search (landing page)", { url: window.location.href });
    const initialTerm = getConfiguredSearchTerms(settings)[runSearchTermCursor] || "";
    window.location.href = buildJobsSearchUrl(initialTerm);
    return false;
  }
  await debugLog(settings, "Preparing run", { url: window.location.href });
  const keywordReady = await ensureSearchTermIfNeeded(settings);
  if (!keywordReady) return false;
  const queryReady = await ensureSearchQueryParams(settings);
  if (!queryReady) return false;
  await setSearchLocationIfNeeded(settings);
  await applyAdvancedFiltersIfNeeded(settings);
  await applyEasyApplyFilterIfNeeded(settings);
  preparedRun = true;
  return true;
}

async function handleChatCommand(input) {
  const raw = String(input || "").trim();
  if (!raw) return;
  await userChat(raw);
  const cmd = normalizeLabel(raw);

  if (cmd === "start live" || cmd === "live start" || cmd === "/live") {
    await sendMessage({
      type: "CP_SAVE_SETTINGS",
      settings: { dryRun: false, autoSubmit: true, liveModeAcknowledged: true }
    });
    const startRes = await sendMessage({ type: "CP_START", forceRestart: true });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Live run start failed. Check settings.", "error");
      return;
    }
    await botChat("Live run started. Auto-submit is ON.");
    return;
  }

  if (cmd === "start" || cmd === "/start" || cmd.includes("start applying")) {
    const boot = await getBootstrap();
    if (boot?.settings?.dryRun) {
      await botChat("Dry-run is ON: I will not click Submit. Use: start live", "warn");
    } else if (!boot?.settings?.autoSubmit) {
      await botChat("Auto-submit is OFF. I will fill forms, but submit may need manual click.", "warn");
    }
    const startRes = await sendMessage({ type: "CP_START", forceRestart: true });
    if (!startRes?.ok) {
      await botChat(startRes?.error || "Run start failed. Check settings.", "error");
      return;
    }
    await botChat("Run started.");
    return;
  }
  if (cmd === "pause" || cmd === "/pause") {
    await sendMessage({ type: "CP_PAUSE" });
    await botChat("Run paused.");
    return;
  }
  if (cmd === "resume" || cmd === "/resume") {
    await sendMessage({ type: "CP_RESUME" });
    await botChat("Run resumed.");
    return;
  }
  if (cmd === "stop" || cmd === "/stop") {
    await sendMessage({ type: "CP_STOP" });
    await botChat("Run stopped.");
    return;
  }
  if (cmd.startsWith("set city ")) {
    const city = raw.slice(9).trim();
    if (!city) {
      await botChat("City value is empty. Use: set city New York", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { currentCity: city, searchLocation: city } });
    await botChat(`Saved city as ${city}.`);
    return;
  }
  if (cmd.startsWith("set phone ")) {
    const phone = raw.slice(10).trim();
    if (!phone) {
      await botChat("Phone value is empty. Use: set phone 9876543210", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { phoneNumber: phone } });
    await botChat("Saved phone number.");
    return;
  }
  if (cmd.startsWith("set email ")) {
    const email = raw.slice(10).trim();
    if (!email) {
      await botChat("Email value is empty. Use: set email you@example.com", "warn");
      return;
    }
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { contactEmail: email } });
    await botChat("Saved contact email.");
    return;
  }
  if (cmd === "dry run on") {
    await sendMessage({ type: "CP_SAVE_SETTINGS", settings: { dryRun: true, autoSubmit: false } });
    await botChat("Dry run enabled.");
    return;
  }
  if (cmd === "dry run off" || cmd === "live mode") {
    await sendMessage({
      type: "CP_SAVE_SETTINGS",
      settings: { dryRun: false, autoSubmit: true, liveModeAcknowledged: true }
    });
    await botChat("Live mode enabled. Auto-submit is ON.");
    return;
  }
  if (cmd === "export logs") {
    const res = await sendMessage({ type: "CP_GET_LOG_EXPORT" });
    if (res?.ok && res.logsJson) {
      try {
        await navigator.clipboard.writeText(res.logsJson);
        await botChat("Logs copied to clipboard.");
      } catch {
        await botChat("Could not copy logs.", "warn");
      }
      return;
    }
  }
  await botChat("Unknown command. Try: start, start live, pause, resume, stop, set city <name>, set phone <num>, set email <mail>, dry run on/off", "warn");
}

function ensurePanel() {
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.classList.remove("cp-hidden");
    panelEl = existing;
    applyPanelLayout();
    logPanelDebug("ensure-existing");
    return;
  }
  loadPanelPrefs();
  ensureDebugBadge();

  const toggle = document.createElement("button");
  toggle.id = TOGGLE_ID;
  toggle.textContent = "CP";
  toggle.title = "CareerPilot Copilot";
  toggle.addEventListener("click", () => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    // Keep panel always visible; toggle now acts as "bring to front/show".
    panel.classList.remove("cp-hidden");
    panel.style.zIndex = "2147483646";
  });
  document.body.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="cp-head">
      <div class="cp-brand">
        <div class="cp-orb"></div>
        <div class="cp-title-wrap">
          <div class="cp-title">CareerPilot Copilot</div>
          <div class="cp-sub">LinkedIn job assistant</div>
        </div>
      </div>
      <div class="cp-head-right">
        <div class="cp-badge" id="cp-status-badge">Idle</div>
        <div class="cp-window-actions">
          <button id="cp-minimize" title="Minimize">-</button>
          <button id="cp-maximize" title="Maximize">+</button>
        </div>
      </div>
    </div>
    <div class="cp-stats">
      <div class="cp-stat"><span class="cp-stat-k">Applied</span><span id="cp-applied">0</span></div>
      <div class="cp-stat"><span class="cp-stat-k">Skipped</span><span id="cp-skipped">0</span></div>
      <div class="cp-stat"><span class="cp-stat-k">Failed</span><span id="cp-failed">0</span></div>
    </div>
    <div class="cp-quick">
      <button id="cp-start">Start</button>
      <button id="cp-pause">Pause</button>
      <button id="cp-stop">Stop</button>
      <button id="cp-copy-logs">Copy</button>
      <button id="cp-clear-logs">Clear</button>
    </div>
    <div class="cp-now" id="cp-now-card">
      <div class="cp-now-title" id="cp-now-title">Idle. Waiting for command.</div>
      <div class="cp-now-detail" id="cp-now-detail">Press Start or type "start" in chat.</div>
      <div class="cp-now-meta" id="cp-now-meta">Applied: 0 | Skipped: 0 | Failed: 0</div>
    </div>
    <div class="cp-log" id="cp-log" aria-live="polite"></div>
    <div class="cp-composer">
      <input id="cp-chat-input" type="text" placeholder="Chat command: start, pause, stop, set city Delhi" />
      <button id="cp-chat-send">Send</button>
    </div>
  `;
  document.body.appendChild(panel);
  panelEl = panel;
  panelEl.classList.remove("cp-hidden");

  panel.querySelector("#cp-start").addEventListener("click", async () => handleChatCommand("start"));
  panel.querySelector("#cp-pause").addEventListener("click", async () => handleChatCommand("pause"));
  panel.querySelector("#cp-stop").addEventListener("click", async () => handleChatCommand("stop"));
  panel.querySelector("#cp-copy-logs").addEventListener("click", async () => {
    const res = await sendMessage({ type: "CP_GET_LOG_EXPORT" });
    if (!res?.ok || !res.logsJson) {
      await botChat("Failed to export logs.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(res.logsJson);
      await botChat("Logs copied to clipboard.");
    } catch {
      await botChat("Clipboard write failed.", "warn");
    }
  });
  panel.querySelector("#cp-clear-logs").addEventListener("click", async () => {
    await sendMessage({ type: "CP_CLEAR_LOGS" });
    await botChat("Log history cleared.");
  });
  panel.querySelector("#cp-minimize").addEventListener("click", () => {
    setPanelMinimized(!panelPrefs.minimized);
  });
  panel.querySelector("#cp-maximize").addEventListener("click", () => {
    setPanelMaximized(!panelPrefs.maximized);
  });
  const chatInput = panel.querySelector("#cp-chat-input");
  const sendBtn = panel.querySelector("#cp-chat-send");
  sendBtn.addEventListener("click", async () => {
    const text = chatInput.value;
    chatInput.value = "";
    await handleChatCommand(text);
  });
  chatInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const text = chatInput.value;
    chatInput.value = "";
    await handleChatCommand(text);
  });
  applyPanelLayout();
  enablePanelDragging();
  logPanelDebug("ensure-new");
}

function trimLogPrefix(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("You:")) return text.slice(4).trim();
  if (text.startsWith("Copilot:")) return text.slice(8).trim();
  if (text.startsWith("[debug]")) return text.slice(7).trim();
  return text;
}

function summarizeMeta(meta) {
  if (!meta || typeof meta !== "object") return "";
  const parts = [];
  const add = (label, value) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    parts.push(`${label}: ${text}`);
  };
  add("reason", meta.reasonCode);
  add("step", meta.stepAttempt);
  add("validation", meta.validation);
  add("pending", meta.unresolvedRequired);
  add("cards", meta.cards);
  add("url", meta.url);
  if (Array.isArray(meta.unresolvedFields) && meta.unresolvedFields.length) {
    add("fields", meta.unresolvedFields.slice(0, 2).join(" | "));
  }
  if (parts.length) return parts.join(" | ");
  try {
    const raw = JSON.stringify(meta);
    return raw.length > 220 ? `${raw.slice(0, 219)}...` : raw;
  } catch {
    return "";
  }
}

function getLogVisual(entry) {
  const level = String(entry?.level || "info").toLowerCase();
  const raw = String(entry?.message || "");
  const isUser = level === "user" || raw.startsWith("You:");
  const isDebug = raw.startsWith("[debug]");
  const role = isUser ? "cp-user" : "cp-bot";
  const sender = isUser ? "You" : "Copilot";
  const kind = level === "error"
    ? "Error"
    : level === "warn"
      ? "Warning"
      : isDebug
        ? "Debug"
        : isUser
          ? "Command"
          : "Update";
  return {
    level,
    role,
    sender,
    kind,
    isDebug,
    message: trimLogPrefix(raw)
  };
}

function deriveNowCard(state, logs) {
  const entries = Array.isArray(logs) ? logs : [];
  const latestAny = entries.length ? entries[entries.length - 1] : null;
  const latestNonDebug = [...entries].reverse().find((entry) => !String(entry?.message || "").startsWith("[debug]")) || latestAny;
  const latestMessage = trimLogPrefix(latestNonDebug?.message || "");
  const norm = normalizeLabel(latestMessage);

  let title = "Idle. Waiting for command.";
  if (state.paused) {
    title = "Paused. Waiting for your input.";
  } else if (state.running) {
    if (norm.includes("preparing run")) {
      title = "Preparing search and filters.";
    } else if (norm.includes("found") && norm.includes("job cards")) {
      title = "Scanning jobs on this page.";
    } else if (norm.includes("opening:")) {
      title = "Opening selected job.";
    } else if (norm.includes("modal step")) {
      title = "Filling Easy Apply steps.";
    } else if (norm.includes("application submitted")) {
      title = "Application submitted.";
    } else if (norm.includes("submit click did not complete")) {
      title = "Submit blocked. Trying fallback answers.";
    } else if (norm.includes("skipped")) {
      title = "Skipping current job and moving ahead.";
    } else if (norm.includes("error")) {
      title = "Error detected in current run.";
    } else {
      title = "Automation running.";
    }
  }

  const detail = latestMessage || (state.running ? "Working on next action..." : "Press Start to begin.");
  const meta = `Applied: ${Number(state.applied || 0)} | Skipped: ${Number(state.skipped || 0)} | Failed: ${Number(state.failed || 0)}`;
  return { title, detail, meta };
}

function renderState(state) {
  if (!panelEl) return;
  panelEl.classList.remove("cp-hidden");
  if (state.running && panelPrefs.minimized) {
    setPanelMinimized(false);
  }
  const status = panelEl.querySelector("#cp-status-badge");
  status.textContent = state.running ? "Running" : state.paused ? "Paused" : "Idle";
  status.className = `cp-badge ${state.running ? "cp-run" : state.paused ? "cp-pause" : ""}`;
  panelEl.querySelector("#cp-applied").textContent = String(state.applied || 0);
  panelEl.querySelector("#cp-skipped").textContent = String(state.skipped || 0);
  panelEl.querySelector("#cp-failed").textContent = String(state.failed || 0);

  const logEl = panelEl.querySelector("#cp-log");
  const logs = state.logs || [];
  const nowCard = deriveNowCard(state, logs);
  const nowTitle = panelEl.querySelector("#cp-now-title");
  const nowDetail = panelEl.querySelector("#cp-now-detail");
  const nowMeta = panelEl.querySelector("#cp-now-meta");
  if (nowTitle) nowTitle.textContent = nowCard.title;
  if (nowDetail) nowDetail.textContent = nowCard.detail;
  if (nowMeta) nowMeta.textContent = nowCard.meta;

  const typingLine = state.running
    ? `<div class="cp-line cp-bot cp-typing"><div class="cp-bubble"><div class="cp-msg-head"><span class="cp-sender">Copilot</span><span class="cp-kind">Live</span></div><div class="cp-msg-text"><span class="cp-dot"></span><span class="cp-dot"></span><span class="cp-dot"></span> Working on next step...</div></div></div>`
    : "";
  logEl.innerHTML = logs
    .slice(-80)
    .map((l) => {
      const visual = getLogVisual(l);
      const level = escapeHtml(visual.level || "info");
      const role = escapeHtml(visual.role || "cp-bot");
      const sender = escapeHtml(visual.sender || "Copilot");
      const kind = escapeHtml(visual.kind || "Update");
      const msg = escapeHtml(visual.message || "");
      const metaText = summarizeMeta(l?.meta);
      const metaHtml = metaText ? `<div class="cp-msg-meta">${escapeHtml(metaText)}</div>` : "";
      const debugClass = visual.isDebug ? " cp-debug" : "";
      return `<div class="cp-line ${role} cp-${level}${debugClass}"><div class="cp-bubble"><div class="cp-msg-head"><span class="cp-sender">${sender}</span><span class="cp-kind">${kind}</span><span class="cp-time">${escapeHtml(l.ts?.slice(11, 19) || "")}</span></div><div class="cp-msg-text">${msg}</div>${metaHtml}</div></div>`;
    })
    .join("") + typingLine;
  logEl.scrollTop = logEl.scrollHeight;
  logPanelDebug("render");
}

async function getBootstrap() {
  const boot = await sendMessage({ type: "CP_GET_BOOTSTRAP" });
  return boot.ok ? boot : { state: {}, settings: {} };
}

function getEasyApplyButton() {
  const candidates = Array.from(
    document.querySelectorAll(
      "button.jobs-apply-button, button[aria-label*='Easy Apply'], button[aria-label*='Apply']"
    )
  );
  for (const btn of candidates) {
    const label = normalizeLabel(btn.getAttribute("aria-label") || "");
    const text = normalizeLabel(btn.textContent || "");
    const combined = `${label} ${text}`;
    if (combined.includes("easy apply")) {
      return btn;
    }
  }
  return null;
}

function collectJobCards() {
  const directCards = getAllBySelectorList([
    ".job-card-container",
    "[data-occludable-job-id]",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item"
  ]);
  if (directCards.length) return directCards;

  const anchors = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
  const cardSet = new Set();
  for (const a of anchors) {
    const card = a.closest(
      "li.jobs-search-results__list-item, li.scaffold-layout__list-item, .jobs-search-results-list__list-item, .job-card-container, li, article, div"
    );
    if (card) cardSet.add(card);
  }
  return Array.from(cardSet);
}

function getCardAnchor(card) {
  return card.querySelector("a[href*='/jobs/view/']") || card.querySelector("a");
}

async function waitForJobsToRender(settings, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cards = collectJobCards();
    if (cards.length) return cards;
    await sleep(250);
  }
  await debugLog(settings, "Job list render timeout", { timeoutMs, url: window.location.href });
  return [];
}

function getActiveModal() {
  return getBySelectorList([
    ".jobs-easy-apply-modal",
    ".artdeco-modal[role='dialog']"
  ]);
}

async function waitForModalOpen(timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = getActiveModal();
    if (modal) return modal;
    await sleep(180);
  }
  return null;
}

function collectQuestionBlocks(modal) {
  if (!modal) return [];
  const selectors = [
    ".fb-dash-form-element",
    ".jobs-easy-apply-form-section__grouping",
    ".jobs-easy-apply-form-element",
    "div[data-test-form-element]",
    "div[data-test-single-line-text-form-component]",
    "div[data-test-text-entity-list-form-component]",
    "div[data-test-multiline-text-form-component]",
    "div[data-test-checkbox-form-component]",
    "div[data-test-date-form-component]",
    "div[data-test-form-builder-dropdown-form-component]",
    "fieldset[data-test-form-builder-radio-button-form-component='true']",
    "fieldset"
  ];
  const all = safeQuerySelectorAll(modal, selectors.join(","), null, "collectQuestionBlocks(all)");
  const unique = [];
  const seen = new Set();
  for (const block of all) {
    if (!(block instanceof HTMLElement)) continue;
    if (seen.has(block)) continue;
    seen.add(block);
    if (!isVisibleElement(block)) {
      const visibleControl = block.querySelector(
        "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], button[aria-label*='today'], input[type='date'], input[data-test-date-input]"
      );
      if (!visibleControl || !isVisibleElement(visibleControl)) continue;
    }
    unique.push(block);
  }

  if (unique.length) return unique;

  // Fallback: derive blocks from visible controls when LinkedIn wrapper selectors change.
  const fallbackControls = safeQuerySelectorAll(
    modal,
    "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], button[aria-label*='today'], input[type='date'], input[data-test-date-input]",
    null,
    "collectQuestionBlocks(fallbackControls)"
  ).filter((el) => isVisibleElement(el));
  const fallbackBlocks = [];
  const fallbackSeen = new Set();
  for (const control of fallbackControls) {
    const block =
      control.closest(selectors.join(",")) ||
      control.closest("div, fieldset, section, li, article");
    if (!(block instanceof HTMLElement) || fallbackSeen.has(block)) continue;
    fallbackSeen.add(block);
    fallbackBlocks.push(block);
  }
  return fallbackBlocks;
}

function truncateDebugText(value, max = 72) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function isRequiredQuestionBlock(block, rawLabel = "") {
  const labelNorm = normalizeLabel(rawLabel || "");
  if (String(block?.getAttribute?.("data-required") || "").toLowerCase() === "true") return true;
  if (Boolean(block?.querySelector?.("[required], [aria-required='true']"))) return true;
  if (labelNorm.includes(" required")) return true;
  if (String(rawLabel || "").includes("*")) return true;
  return false;
}

function getQuestionBlockState(block) {
  const rawLabel = getQuestionLabel(block) || "LinkedIn required field";
  const label = cleanQuestionLabel(rawLabel) || "LinkedIn required field";
  const required = isRequiredQuestionBlock(block, rawLabel);
  const questionKey = questionKeyFromLabel(label) || questionKeyFromLabel(rawLabel) || "";

  const select = block.querySelector("select");
  if (select && isVisibleElement(select)) {
    const selected = select.options?.[select.selectedIndex];
    const selectedText = String(selected?.textContent || "").trim();
    const answered = Boolean(selectedText && !isPlaceholderOptionText(selectedText));
    return {
      questionKey,
      label,
      required,
      type: "select",
      answered,
      value: selectedText
    };
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']")).filter((r) => isVisibleElement(r));
  if (radios.length) {
    const selected = radios.find((r) => r.checked);
    const selectedLabel = selected
      ? cleanQuestionLabel((selected.closest("label")?.textContent || selected.value || "").trim())
      : "";
    return {
      questionKey,
      label,
      required,
      type: "radio",
      answered: Boolean(selected),
      value: selectedLabel
    };
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']", "textarea"],
    block
  );
  if (textInput && isVisibleElement(textInput)) {
    const value = String(textInput.value || "").trim();
    return {
      questionKey,
      label,
      required,
      type: textInput.tagName.toLowerCase() === "textarea" ? "textarea" : "text",
      answered: Boolean(value),
      value
    };
  }

  const combobox = getBySelectorList(
    ["[role='combobox']", "button[aria-haspopup='listbox']", "input[role='combobox']"],
    block
  );
  if (combobox && isVisibleElement(combobox)) {
    const comboText = String(combobox.value || combobox.textContent || combobox.getAttribute("aria-label") || "").trim();
    const answered = Boolean(comboText && !isPlaceholderOptionText(comboText));
    return {
      questionKey,
      label,
      required,
      type: "combobox",
      answered,
      value: comboText
    };
  }

  const checkboxes = Array.from(block.querySelectorAll("input[type='checkbox']")).filter((c) => isVisibleElement(c));
  if (checkboxes.length) {
    const requiredBoxes = checkboxes.filter(
      (c) => c.required || c.getAttribute("aria-required") === "true" || required
    );
    const targetBoxes = requiredBoxes.length ? requiredBoxes : checkboxes;
    const answered = targetBoxes.every((c) => c.checked || c.getAttribute("aria-checked") === "true");
    return {
      questionKey,
      label,
      required,
      type: "checkbox",
      answered,
      value: answered ? "checked" : ""
    };
  }

  const dateInput = getBySelectorList(["input[type='date']", "input[data-test-date-input]"], block);
  if (dateInput && isVisibleElement(dateInput)) {
    const value = String(dateInput.value || "").trim();
    return {
      questionKey,
      label,
      required,
      type: "date",
      answered: Boolean(value),
      value
    };
  }

  const dateHint = normalizeLabel(label || rawLabel || "");
  const hiddenDateInput = getBySelectorList(
    [
      "input[type='hidden'][id*='date']",
      "input[type='hidden'][name*='date']",
      "input[id*='date']",
      "input[name*='date']"
    ],
    block
  );
  const hiddenDateValue = String(hiddenDateInput?.value || "").trim();
  if (dateHint.includes("date") || dateHint.includes("start")) {
    if (hiddenDateValue) {
      return {
        questionKey,
        label,
        required,
        type: "date",
        answered: true,
        value: hiddenDateValue
      };
    }
  }

  const todayButton = getBySelectorList(
    [
      "button[aria-label*='This is today']",
      "button[aria-label*='today']",
      ".artdeco-calendar__today button"
    ],
    block
  );
  if (todayButton && isVisibleElement(todayButton)) {
    const value = hiddenDateValue;
    const answered = Boolean(value || todayButton.dataset.cpAutoSelectedToday === "1");
    return {
      questionKey,
      label,
      required,
      type: "date-picker",
      answered,
      value: value || (answered ? "today-selected" : "")
    };
  }

  return {
    questionKey,
    label,
    required,
    type: "unknown",
    answered: !required,
    value: ""
  };
}

function summarizeQuestionBlockState(state) {
  const label = truncateDebugText(state?.label || "Unknown");
  const type = String(state?.type || "unknown");
  const required = state?.required ? "required" : "optional";
  const answered = state?.answered ? "answered" : "missing";
  const value = truncateDebugText(state?.value || "", 36);
  return `${type}|${required}|${answered}|${label}${value ? ` -> ${value}` : ""}`;
}

function collectQuestionBlockDiagnostics(modal) {
  const blocks = collectQuestionBlocks(modal);
  return blocks.map((block) => getQuestionBlockState(block));
}

function isBlankValue(value) {
  return String(value || "").trim().length === 0;
}

function isPlaceholderOption(optionText) {
  const t = normalizeLabel(optionText);
  return !t || t.includes("select an option") || t.includes("choose an option");
}

function collectUnansweredQuestions(modal) {
  const diagnostics = collectQuestionBlockDiagnostics(modal);
  const pending = [];
  const seen = new Set();
  for (const d of diagnostics) {
    if (!d?.required || d?.answered) continue;
    const questionKey = d.questionKey || questionKeyFromLabel(d.label) || "linkedin_required_selection";
    const questionLabel = d.label || "LinkedIn required selection";
    const dedupeKey = `${questionKey}::${normalizeLabel(questionLabel)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    pending.push({ questionKey, questionLabel });
  }
  return pending;
}

function buildPendingQuestionsFromValidation(modal, validationMessage) {
  const questions = collectUnansweredQuestions(modal);
  if (questions.length) {
    return questions.map((q) => ({
      ...q,
      validationMessage: validationMessage || "Required field answer missing"
    }));
  }

  // Fallback for LinkedIn custom components that do not expose native select/radio state clearly.
  const firstBlock = collectQuestionBlocks(modal)[0];
  const rawLabel = firstBlock ? getQuestionLabel(firstBlock) : "";
  const fallbackLabel = rawLabel || "LinkedIn required selection";
  const fallbackKey = questionKeyFromLabel(fallbackLabel || "linkedin_required_selection");
  return [
    {
      questionKey: fallbackKey || "linkedin_required_selection",
      questionLabel: fallbackLabel,
      validationMessage: validationMessage || "Please make a selection"
    }
  ];
}

function buildPendingQuestionsFromDiagnostics(unresolvedDiagnostics, validationMessage = "") {
  const items = Array.isArray(unresolvedDiagnostics) ? unresolvedDiagnostics : [];
  const pending = [];
  const seen = new Set();
  for (const d of items) {
    if (!d || !d.required || d.answered) continue;
    const questionKey = d.questionKey || questionKeyFromLabel(d.label) || "linkedin_required_selection";
    const questionLabel = d.label || "LinkedIn required selection";
    const dedupeKey = `${questionKey}::${normalizeLabel(questionLabel)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    pending.push({
      questionKey,
      questionLabel,
      validationMessage: validationMessage || "Required field answer missing"
    });
  }
  return pending;
}

function resolveManualAnswer(screeningAnswers, questionKey, questionLabel) {
  const source = screeningAnswers && typeof screeningAnswers === "object" ? screeningAnswers : {};
  const key = String(questionKey || "").trim();
  const labelNorm = normalizeLabel(questionLabel || "");
  if (key && !isBlankValue(source[key])) return String(source[key] || "").trim();
  if (labelNorm && !isBlankValue(source[labelNorm])) return String(source[labelNorm] || "").trim();
  for (const [k, value] of Object.entries(source)) {
    if (isBlankValue(value)) continue;
    if (normalizeLabel(k) === labelNorm) return String(value || "").trim();
  }
  return "";
}

async function waitForPendingAnswersFromSettings(questions, timeoutMs = MANUAL_ANSWER_WAIT_MS, pollMs = MANUAL_ANSWER_POLL_MS) {
  const pending = Array.isArray(questions) ? questions.filter(Boolean) : [];
  if (!pending.length) {
    return { ok: false, screeningAnswers: {} };
  }
  const timeout = Math.max(3000, Number(timeoutMs || MANUAL_ANSWER_WAIT_MS));
  const poll = Math.max(400, Number(pollMs || MANUAL_ANSWER_POLL_MS));
  const started = Date.now();

  while (Date.now() - started < timeout) {
    if (!await isRunActive()) {
      return { ok: false, screeningAnswers: {} };
    }
    const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
    const screeningAnswers = loaded?.ok ? (loaded.settings?.screeningAnswers || {}) : {};
    const allResolved = pending.every((q) =>
      Boolean(resolveManualAnswer(screeningAnswers, q.questionKey, q.questionLabel))
    );
    if (allResolved) {
      return { ok: true, screeningAnswers };
    }
    await sleep(poll);
  }
  return { ok: false, screeningAnswers: {} };
}

function getModalValidationMessage(modal) {
  const err = getBySelectorList([
    ".artdeco-inline-feedback__message",
    "[role='alert']",
    ".fb-dash-form-element__error",
    ".jobs-easy-apply-form-element__error"
  ], modal);
  return err ? normalizeLabel(err.textContent || "") : "";
}

function getModalSignature(modal) {
  const labels = Array.from(
    modal.querySelectorAll("label, legend, .fb-dash-form-element__label, [data-test-form-element] label")
  )
    .map((el) => normalizeLabel(el.textContent || ""))
    .filter(Boolean)
    .slice(0, 12);
  const heading = normalizeLabel(
    getBySelectorList(["h3", "h2", ".artdeco-modal__header h2", ".jobs-easy-apply-content__title"], modal)?.textContent || ""
  );
  const validation = getModalValidationMessage(modal);
  return `${heading}|${validation}|${labels.join("|")}`;
}

function isPlaceholderOptionText(text) {
  const t = normalizeLabel(text);
  return !t || t.includes("select an option") || t.includes("choose an option");
}

async function selectTodayDateIfPresent(modal) {
  if (!modal) return false;

  const dateInput = getBySelectorList(["input[type='date']", "input[data-test-date-input]"], modal);
  if (dateInput && isVisibleElement(dateInput)) {
    const prev = String(dateInput.value || "").trim();
    if (!prev) {
      const today = new Date().toISOString().slice(0, 10);
      dateInput.focus();
      dateInput.value = today;
      dateInput.dispatchEvent(new Event("input", { bubbles: true }));
      dateInput.dispatchEvent(new Event("change", { bubbles: true }));
      await logLine("Selected today's date for date-picker field");
      return true;
    }
  }

  const buttons = Array.from(
    modal.querySelectorAll(
      "button[aria-label*='This is today'], button[aria-label*='today'], .artdeco-calendar__today button"
    )
  ).filter((b) => !b.disabled && isVisibleElement(b));
  for (const button of buttons) {
    const label = normalizeLabel(button.getAttribute("aria-label") || button.textContent || "");
    if (!label.includes("today")) continue;
    if (button.dataset.cpAutoSelectedToday === "1") continue;
    await resilientClick(button, "Date picker today");
    button.dataset.cpAutoSelectedToday = "1";
    await logLine("Selected today's date for date-picker field");
    return true;
  }
  return false;
}

function findSubmitButton(modal) {
  const buttons = Array.from(modal.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("submit application")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("submit application")) ||
    buttons.find((b) => normalizeLabel(b.textContent) === "submit")
  );
}

function findDoneOrCloseButton(modalOrRoot = document) {
  const buttons = Array.from(modalOrRoot.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("done")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("done")) ||
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("dismiss")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("close")) ||
    null
  );
}

function getVisibleModalButtons(modalOrRoot = document) {
  return Array.from(modalOrRoot.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
}

function findModalButtonByIncludes(modalOrRoot, includesList) {
  const buttons = getVisibleModalButtons(modalOrRoot);
  for (const button of buttons) {
    const text = normalizeLabel(`${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`);
    if (includesList.some((needle) => text.includes(needle))) return button;
  }
  return null;
}

function isSaveApplicationPrompt(modal) {
  const text = normalizeLabel(modal?.textContent || "");
  if (!text) return false;
  return (
    text.includes("save this application") ||
    text.includes("if you choose to not save") ||
    text.includes("your application will be discarded")
  );
}

async function dismissSaveApplicationPrompt(modal) {
  const discardBtn =
    findModalButtonByIncludes(modal, ["discard"]) ||
    findModalButtonByIncludes(modal, ["don't save", "dont save"]);
  if (!discardBtn) return false;
  await resilientClick(discardBtn, "Discard draft application");
  await logLine("Dismissed 'Save this application?' prompt by discarding draft.");
  return true;
}

async function closePostSubmitUi(settings, options = {}) {
  const preferDiscardDraft = Boolean(options.discardDraft);
  try {
    for (let i = 0; i < 6; i += 1) {
      const modal = getActiveModal();
      if (!modal) break;
      if (preferDiscardDraft && isSaveApplicationPrompt(modal)) {
        const dismissed = await dismissSaveApplicationPrompt(modal);
        if (dismissed) {
          await sleep(240);
          continue;
        }
      }
      const doneBtn = findDoneOrCloseButton(modal);
      if (doneBtn) {
        await resilientClick(doneBtn, "Done/Close");
        await sleep(220);
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await sleep(180);
      }
    }
    if (preferDiscardDraft) {
      const modal = getActiveModal();
      if (modal && isSaveApplicationPrompt(modal)) {
        await dismissSaveApplicationPrompt(modal);
      }
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(120);
  } catch {
    // best effort
  }

  if (isPostApplySearchPage()) {
    await debugLog(settings, "Redirecting out of post-apply page", { path: window.location.pathname });
    window.location.href = JOBS_SEARCH_URL;
  }
}

function findNextOrReviewButton(modal) {
  const buttons = Array.from(modal.querySelectorAll("button")).filter((b) => !b.disabled && isVisibleElement(b));
  return (
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("next")) ||
    buttons.find((b) => normalizeLabel(b.getAttribute("aria-label")).includes("review")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("next")) ||
    buttons.find((b) => normalizeLabel(b.textContent).includes("review"))
  );
}

function didSubmitComplete(modal) {
  if (isPostApplySearchPage()) return true;
  const activeModal = getActiveModal();
  if (!activeModal || !isVisibleElement(activeModal)) return true;
  const validation = getModalValidationMessage(activeModal);
  if (validation) return false;
  const successText = normalizeLabel(activeModal.textContent || "");
  if (
    successText.includes("application submitted") ||
    successText.includes("application sent") ||
    successText.includes("your application was sent")
  ) {
    return true;
  }
  const stillSubmit = findSubmitButton(activeModal);
  return !stillSubmit;
}

async function applyFollowCompanyPreference(modal, settings) {
  const checkbox = getBySelectorList(
    [
      "input#follow-company-checkbox",
      "input[id*='follow-company'][type='checkbox']",
      "input[name*='follow'][type='checkbox']"
    ],
    modal
  );
  if (!checkbox) return false;
  const shouldFollow = Boolean(settings.followCompanies);
  const checked = checkbox.checked || checkbox.getAttribute("aria-checked") === "true";
  if (checked === shouldFollow) return true;

  const label =
    modal.querySelector("label[for='follow-company-checkbox']") ||
    checkbox.closest("label") ||
    checkbox;
  await resilientClick(label, "Follow company");
  await logLine(shouldFollow ? "Enabled follow-company option" : "Disabled follow-company option");
  return true;
}

function isFollowCompanyCheckbox(input) {
  if (!input) return false;
  const id = normalizeLabel(input.id || "");
  const name = normalizeLabel(input.getAttribute("name") || "");
  const aria = normalizeLabel(input.getAttribute("aria-label") || "");
  if (id.includes("follow-company") || name.includes("follow-company") || aria.includes("follow company")) return true;
  const label = input.closest("label") || (input.id ? document.querySelector(`label[for='${CSS.escape(input.id)}']`) : null);
  const txt = normalizeLabel(label?.textContent || "");
  return txt.includes("follow") && txt.includes("company");
}

function getCheckboxLabel(input, root) {
  if (!input) return "";
  const inline = input.closest("label");
  if (inline) return cleanQuestionLabel(inline.textContent || "");
  if (input.id) {
    const byFor = root?.querySelector(`label[for='${CSS.escape(input.id)}']`) || document.querySelector(`label[for='${CSS.escape(input.id)}']`);
    if (byFor) return cleanQuestionLabel(byFor.textContent || "");
  }
  const container = input.closest("div, li, fieldset, section");
  return cleanQuestionLabel(container?.textContent || "");
}

async function applySubmitConsentCheckboxes(modal, settings) {
  const checkboxes = Array.from(modal.querySelectorAll("input[type='checkbox']")).filter((c) => isVisibleElement(c));
  if (!checkboxes.length) return false;
  let changed = false;
  for (const checkbox of checkboxes) {
    if (isFollowCompanyCheckbox(checkbox)) continue;
    const checked = checkbox.checked || checkbox.getAttribute("aria-checked") === "true";
    if (checked) continue;
    const label = normalizeLabel(getCheckboxLabel(checkbox, modal));
    const isRequired =
      checkbox.required ||
      checkbox.getAttribute("aria-required") === "true" ||
      label.includes("required") ||
      label.includes("i agree") ||
      label.includes("i acknowledge") ||
      label.includes("terms") ||
      label.includes("privacy") ||
      label.includes("employment rights") ||
      label.includes("notice");
    if (!isRequired) continue;
    const clickable =
      (checkbox.id ? modal.querySelector(`label[for='${CSS.escape(checkbox.id)}']`) : null) ||
      checkbox.closest("label") ||
      checkbox;
    const clicked = await resilientClick(clickable, "Consent checkbox");
    if (clicked) {
      changed = true;
      await logLine(`Checked submit consent field: ${label.slice(0, 80) || "required consent"}`);
    }
  }
  return changed;
}

function isCustomEntitySelectionBlock(block) {
  return Boolean(
    getBySelectorList(
      [
        "[data-test-text-entity-list-form-component]",
        "[data-test-form-builder-dropdown-form-component]",
        "[role='combobox']",
        "button[aria-haspopup='listbox']"
      ],
      block
    )
  );
}

function getYearsFallback(settings) {
  const configured = String(settings.yearsOfExperienceAnswer || "").trim();
  if (configured) return configured;
  const fromExperience = Number(settings.currentExperience);
  if (Number.isFinite(fromExperience) && fromExperience >= 0) return String(fromExperience);
  return "1";
}

function getSelectRuleAnswer(label, settings, optionsForMatch, currentOptionText = "") {
  const l = normalizeLabel(label);
  if (l.includes("email") && !isMarketingConsentQuestion(l)) {
    return optionsForMatch.find((o) => String(o.text || "").includes("@"))?.text || "";
  }
  if (l.includes("phone country code")) {
    if (!isPlaceholderOptionText(currentOptionText || "")) return currentOptionText;
    return String(settings.phoneCountryCode || "").trim();
  }
  if (l.includes("phone")) {
    if (!isPlaceholderOptionText(currentOptionText || "")) return currentOptionText;
  }
  if (l.includes("visa") || l.includes("sponsorship")) return String(settings.requireVisa || "No").trim();
  if (
    l.includes("citizenship") ||
    l.includes("employment eligibility") ||
    l.includes("work authorization") ||
    (l.includes("authorized") && l.includes("work"))
  ) {
    return String(settings.usCitizenship || "").trim();
  }
  if (l.includes("protected") && l.includes("veteran")) return String(settings.veteranStatus || "").trim();
  if (l.includes("veteran")) return String(settings.veteranStatus || "").trim();
  if (l.includes("disability") || l.includes("handicapped")) return String(settings.disabilityStatus || "").trim();
  if (l.includes("gender") || l.includes("sex")) return String(settings.gender || "").trim();
  if (l.includes("ethnicity") || l.includes("race")) return String(settings.ethnicity || "").trim();
  if (isMarketingConsentQuestion(l)) return String(settings.marketingConsent || "No").trim();
  if (l.includes("proficiency")) return "Professional";
  if (l.includes("salary") || l.includes("compensation") || l.includes("ctc") || l.includes("pay")) {
    return getSalaryAnswer(l, settings);
  }
  if (l.includes("country")) return String(settings.country || "").trim();
  if (l.includes("state") || l.includes("province")) return String(settings.stateRegion || "").trim();
  if (l.includes("city")) return normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  if (l.includes("location")) {
    return String(currentJobContext.workLocation || "").trim() || normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  }
  return "";
}

async function applyComboboxOption(block, label, answer, settings) {
  const trigger = getBySelectorList(
    [
      "button[aria-haspopup='listbox']",
      "[role='combobox']",
      "input[role='combobox']",
      ".artdeco-dropdown__trigger"
    ],
    block
  );
  if (!trigger) return false;

  const triggerText = String(trigger.textContent || trigger.value || "").trim();
  if (triggerText && !isPlaceholderOptionText(triggerText) && !String(answer || "").trim()) {
    return false;
  }
  if (!settings.overwritePreviousAnswers && triggerText && !isPlaceholderOptionText(triggerText)) {
    return false;
  }

  await resilientClick(trigger, "Combobox trigger");
  await sleep(180);
  const optionEls = Array.from(
    document.querySelectorAll(
      "[role='listbox'] [role='option'], [role='option'], .artdeco-typeahead__result, li[role='option']"
    )
  ).filter((el) => isVisibleElement(el));
  const optionsForMatch = optionEls
    .map((el) => ({
      text: String(el.textContent || "").trim(),
      value: String(el.getAttribute("data-value") || ""),
      el
    }))
    .filter((o) => Boolean(o.text));
  if (!optionsForMatch.length) return false;

  let resolvedAnswer = String(answer || "").trim();
  if (!resolvedAnswer) {
    resolvedAnswer = getSelectRuleAnswer(label, settings, optionsForMatch, triggerText);
  }
  if (!resolvedAnswer) {
    resolvedAnswer = await requestAiAnswer(label, "select", optionsForMatch.map((o) => o.text), getModalValidationMessage(getActiveModal()));
  }
  const matchedTarget = selectBestOption(optionsForMatch, resolvedAnswer);
  const target = matchedTarget || selectFallbackOption(optionsForMatch);
  if (!target?.el) return false;
  if (normalizeLabel(target.text || "") === normalizeLabel(triggerText || "")) return false;

  await resilientClick(target.el, "Combobox option");
  await logLine(
    matchedTarget
      ? `Selected combobox option for: ${label.slice(0, 60)}`
      : `Selected combobox fallback for: ${label.slice(0, 60)}`
  );
  return true;
}

async function fillUnlabeledQuestionBlock(block, settings) {
  let changed = false;

  const select = block.querySelector("select");
  if (select) {
    const selected = select.options?.[select.selectedIndex];
    if (selected && !isPlaceholderOptionText(selected.textContent || "")) {
      return changed;
    }
    const options = Array.from(select.options || [])
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => Boolean(o.text));
    const target = selectFallbackOption(options);
    if (target && select.value !== target.value) {
      select.value = target.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await logLine("Selected fallback option for unlabeled required field");
      changed = true;
    }
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (!changed && radios.length) {
    const options = radios.map((r) => ({
      text: getRadioOptionText(r, block),
      value: String(r.value || ""),
      input: r,
      clickTarget: getRadioClickTarget(r, block)
    }));
    const resumeTarget = getPreferredResumeOption(options, "resume");
    if (resumeTarget) {
      const validationNorm = normalizeLabel(getModalValidationMessage(getActiveModal()) || "");
      const resumeRequired = validationNorm.includes("resume") && validationNorm.includes("required");
      if (!resumeTarget.input?.checked || resumeRequired) {
        const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume radio option");
        if (clicked) {
          await sleep(220);
          await logLine("Selected latest resume option for unlabeled required field");
          changed = true;
        }
      } else {
        return changed;
      }
    } else if (!radios.some((r) => r.checked)) {
      const target = selectFallbackOption(options);
      if (target?.input) {
        const clicked = await resilientClick(target.clickTarget || target.input, "Radio fallback option");
        if (clicked) {
          await logLine("Radio fallback answered for unlabeled required field");
          changed = true;
        }
      }
    }
  }

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']"],
    block
  );
  if (!changed && textInput) {
    const prev = String(textInput.value || "").trim();
    if (!prev) {
      const answer = getYearsFallback(settings);
      if (answer && prev !== answer) {
        textInput.focus();
        textInput.value = answer;
        textInput.dispatchEvent(new Event("input", { bubbles: true }));
        textInput.dispatchEvent(new Event("change", { bubbles: true }));
        await logLine("Answered unlabeled required field with fallback value");
        changed = true;
      }
    }
  }

  if (!changed) {
    const dateChanged = await selectTodayDateIfPresent(block);
    if (dateChanged) {
      changed = true;
      return changed;
    }
  }

  if (!changed) {
    const comboLabel = getQuestionLabel(block) || "LinkedIn required selection";
    changed = await applyComboboxOption(block, comboLabel, "", { ...settings, overwritePreviousAnswers: true });
  }

  const checkbox = block.querySelector("input[type='checkbox']");
  if (!changed && checkbox && !checkbox.checked) {
    checkbox.click();
    await logLine("Checkbox selected for unlabeled required field");
    changed = true;
  }

  return changed;
}

async function fillQuestionBlock(block, settings) {
  let changed = false;
  const labelRaw = getQuestionLabel(block);
  const label = normalizeLabel(labelRaw);
  if (!label) {
    return fillUnlabeledQuestionBlock(block, settings);
  }
  if (label.includes("date") || label.includes("start date") || label.includes("available start")) {
    const dateChanged = await selectTodayDateIfPresent(block);
    if (dateChanged) return true;
    const dateState = getQuestionBlockState(block);
    if ((dateState.type === "date" || dateState.type === "date-picker") && dateState.answered) {
      return false;
    }
  }
  let answer = answerCommonQuestion(label, settings);

  const modal = getActiveModal();
  const validationMessage = getModalValidationMessage(modal);
  const aiQuestionLabel = labelRaw || label;

  const textInput = getBySelectorList(
    ["input[type='text']", "input[type='email']", "input[type='tel']", "input[type='number']", "textarea"],
    block
  );
  const isEntityListBlock = isCustomEntitySelectionBlock(block);
  if (textInput && isEntityListBlock) {
    const handledByCombobox = await applyComboboxOption(block, aiQuestionLabel, answer, settings);
    if (handledByCombobox) return true;
  }
  if (textInput && !answer) {
    answer = await requestAiAnswer(aiQuestionLabel, textInput.tagName.toLowerCase() === "textarea" ? "textarea" : "text", [], validationMessage);
  }
  if (textInput && !answer && textInput.tagName.toLowerCase() === "textarea") {
    answer = String(settings.coverLetter || "").trim();
  }
  if (textInput && !answer && textInput.tagName.toLowerCase() !== "textarea") {
    answer = getYearsFallback(settings);
  }
  if (textInput && answer) {
    const prev = String(textInput.value || "").trim();
    if (prev && !settings.overwritePreviousAnswers) return false;
    if (prev === String(answer).trim()) return false;
    textInput.focus();
    textInput.value = answer;
    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    textInput.dispatchEvent(new Event("change", { bubbles: true }));
    const normalizedAnswer = normalizeLabel(answer);
    const shouldTryAutocomplete =
      isEntityListBlock ||
      label.includes("city") ||
      label.includes("location") ||
      label.includes("address") ||
      (isMarketingConsentQuestion(label) && (normalizedAnswer === "yes" || normalizedAnswer === "no"));
    if (shouldTryAutocomplete) {
      textInput.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      textInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    }
    if (textInput.dataset.cpLastAutoValue !== String(answer).trim()) {
      await logLine(`Answered: ${label.slice(0, 60)} -> ${answer}`);
      textInput.dataset.cpLastAutoValue = String(answer).trim();
    }
    changed = true;
    return changed;
  }

  const select = block.querySelector("select");
  if (select) {
    const options = Array.from(select.options || []);
    const optionsForMatch = options
      .map((o) => ({ text: String(o.textContent || "").trim(), value: String(o.value || "") }))
      .filter((o) => Boolean(o.text));
    const current = options.find((o) => o.value === select.value);
    if (current && !isPlaceholderOptionText(current.textContent || "") && !settings.overwritePreviousAnswers) return false;

    if (!answer) {
      answer = getSelectRuleAnswer(label, settings, optionsForMatch, String(current?.textContent || ""));
    }

    if (!answer) {
      answer = await requestAiAnswer(aiQuestionLabel, "select", optionsForMatch.map((o) => o.text), validationMessage);
    }

    const matchedTarget = selectBestOption(optionsForMatch, answer);
    const target = matchedTarget || selectFallbackOption(optionsForMatch);
    if (target) {
      if (select.value === target.value) return false;
      select.value = target.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const marker = `${label}::${target.value}`;
      if (select.dataset.cpLastAutoValue !== marker) {
        await logLine(
          matchedTarget
            ? `Selected option for: ${label.slice(0, 60)}`
            : `Selected fallback option for: ${label.slice(0, 60)}`
        );
        select.dataset.cpLastAutoValue = marker;
      }
      changed = true;
      return changed;
    }
  }

  const radios = Array.from(block.querySelectorAll("input[type='radio']"));
  if (radios.length) {
    const options = radios.map((r) => ({
      text: getRadioOptionText(r, block),
      value: String(r.value || ""),
      input: r,
      clickTarget: getRadioClickTarget(r, block)
    }));
    const validationNorm = normalizeLabel(validationMessage || "");
    const resumeTarget = getPreferredResumeOption(options, aiQuestionLabel);
    if (resumeTarget) {
      const resumeRequired = validationNorm.includes("resume") && validationNorm.includes("required");
      const alreadySelectedResume = Boolean(resumeTarget.input?.checked);
      if (!alreadySelectedResume || settings.overwritePreviousAnswers || resumeRequired) {
        const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume option");
        if (clicked) {
          await sleep(220);
          const marker = getResumeOptionIdentity(resumeTarget.text || resumeTarget.value || "resume");
          if (block.dataset.cpLastResumeChoice !== marker) {
            await logLine(`Selected resume option: ${cleanQuestionLabel(resumeTarget.text || "").slice(0, 80)}`);
            block.dataset.cpLastResumeChoice = marker;
          }
          changed = true;
          return changed;
        }
      }
      if (alreadySelectedResume && !settings.overwritePreviousAnswers && !resumeRequired) {
        return false;
      }
    }

    const alreadySelected = radios.some((r) => r.checked);
    if (alreadySelected && !settings.overwritePreviousAnswers) return false;
    if (!answer) {
      answer = await requestAiAnswer(aiQuestionLabel, "radio", options.map((o) => o.text), validationMessage);
    }
    const matchedTarget = selectBestOption(options, answer);
    const target = matchedTarget || selectFallbackOption(options);
    if (target) {
      if (target.input?.checked) {
        return false;
      }
      const clicked = await resilientClick(target.clickTarget || target.input, "Radio option");
      if (!clicked) return false;
      const marker = normalizeLabel(target.value || target.text || "selected");
      if (block.dataset.cpLastRadioValue !== marker) {
        await logLine(
          matchedTarget
            ? `Radio answered for: ${label.slice(0, 60)}`
            : `Radio fallback answered for: ${label.slice(0, 60)}`
        );
        block.dataset.cpLastRadioValue = marker;
      }
      changed = true;
      return changed;
    }
  }

  if (isEntityListBlock) {
    const handledByCombobox = await applyComboboxOption(block, aiQuestionLabel, answer, settings);
    if (handledByCombobox) return true;
  }

  const checkbox = block.querySelector("input[type='checkbox']");
  if (checkbox && !checkbox.checked) {
    checkbox.click();
    await logLine(`Checkbox selected for: ${label.slice(0, 60)}`);
    return true;
  }
  return changed;
}

function collectValidationSignals(modal) {
  const text = normalizeLabel(modal?.textContent || "");
  const inline = getModalValidationMessage(modal);
  return {
    full: text,
    inline
  };
}

async function attemptValidationAutoFix(modal, settings) {
  const { full, inline } = collectValidationSignals(modal);
  let changed = false;

  const hasPhoneValidation =
    inline.includes("valid phone") ||
    full.includes("valid phone") ||
    full.includes("enter a valid phone number");
  if (hasPhoneValidation) {
    const phoneValue = normalizePhoneForInput(settings.phoneNumber || "");
    const telInput = getBySelectorList(["input[type='tel']", "input[aria-label*='phone']", "input[name*='phone']"], modal);
    if (telInput && phoneValue) {
      telInput.focus();
      telInput.value = phoneValue;
      telInput.dispatchEvent(new Event("input", { bubbles: true }));
      telInput.dispatchEvent(new Event("change", { bubbles: true }));
      changed = true;
      await debugLog(settings, "Auto-fixed phone validation", { phoneLength: phoneValue.length });
    }
  }

  const hasEmailValidation = inline.includes("valid email") || full.includes("enter a valid email");
  if (hasEmailValidation) {
    const email = String(settings.contactEmail || "").trim();
    const emailInput = getBySelectorList(["input[type='email']", "input[aria-label*='email']", "input[name*='email']"], modal);
    if (emailInput && email) {
      emailInput.focus();
      emailInput.value = email;
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      changed = true;
      await debugLog(settings, "Auto-fixed email validation");
    }
  }

  const hasResumeValidation =
    inline.includes("resume is required") ||
    full.includes("resume is required") ||
    (inline.includes("resume") && inline.includes("required"));
  if (hasResumeValidation) {
    const blocks = collectQuestionBlocks(modal);
    for (const block of blocks) {
      const radios = Array.from(block.querySelectorAll("input[type='radio']"));
      if (!radios.length) continue;
      const options = radios.map((r) => ({
        text: getRadioOptionText(r, block),
        value: String(r.value || ""),
        input: r,
        clickTarget: getRadioClickTarget(r, block)
      }));
      const resumeTarget = getPreferredResumeOption(options, getQuestionLabel(block) || "resume");
      if (!resumeTarget) continue;
      const clicked = await resilientClick(resumeTarget.clickTarget || resumeTarget.input, "Resume option auto-fix");
      if (!clicked) continue;
      await sleep(220);
      changed = true;
      await debugLog(settings, "Auto-fixed resume validation", {
        option: truncateDebugText(resumeTarget.text || resumeTarget.value || "")
      });
      break;
    }
  }

  return changed;
}

async function forceAnswerModalQuestions(modal, settings) {
  if (!modal) return false;
  let changed = false;
  const aggressiveSettings = { ...settings, overwritePreviousAnswers: true };
  const blocks = collectQuestionBlocks(modal);
  for (const block of blocks) {
    const didChange = await fillQuestionBlock(block, aggressiveSettings);
    if (didChange) changed = true;
  }
  const selectedToday = await selectTodayDateIfPresent(modal);
  if (selectedToday) changed = true;
  return changed;
}

async function processEasyApplyModal(settings) {
  const modal = getActiveModal();
  if (!modal) return { submitted: false, skipped: true, reason: "No apply modal found" };

  let activeSettings = {
    ...settings,
    screeningAnswers: { ...(settings?.screeningAnswers || {}) }
  };
  let safety = 0;
  let stagnantSteps = 0;
  const stepStateBySignature = new Map();
  const shouldPauseForInput = settings.pauseAtFailedQuestion !== false;
  const maxStagnantSteps = shouldPauseForInput ? 10 : 6;
  let previousSignature = getModalSignature(modal);
  while (safety < 16) {
    if (!await isRunActive()) {
      return { submitted: false, skipped: true, reachedSubmit: false, reason: "Run stopped by operator" };
    }
    safety += 1;
    const questionBlocks = collectQuestionBlocks(modal);
    let changedAny = false;
    const filledThisStep = [];
    const beforeDiagnostics = collectQuestionBlockDiagnostics(modal);
    const unresolvedBefore = beforeDiagnostics.filter((d) => d.required && !d.answered);
    await debugLog(settings, "Modal step coverage (before fill)", {
      stepAttempt: safety,
      totalBlocks: beforeDiagnostics.length,
      requiredBlocks: beforeDiagnostics.filter((d) => d.required).length,
      unresolvedRequired: unresolvedBefore.length,
      unresolvedFields: unresolvedBefore.slice(0, 10).map((d) => summarizeQuestionBlockState(d))
    });
    for (const block of questionBlocks) {
      const beforeState = settings?.debugMode ? getQuestionBlockState(block) : null;
      const changed = await fillQuestionBlock(block, activeSettings);
      if (changed) changedAny = true;
      if (settings?.debugMode) {
        const afterState = getQuestionBlockState(block);
        if (changed || (beforeState && !beforeState.answered && afterState.answered)) {
          filledThisStep.push(summarizeQuestionBlockState(afterState));
        }
      }
    }
    const todaySelected = await selectTodayDateIfPresent(modal);
    if (todaySelected) {
      changedAny = true;
      filledThisStep.push("date|required|answered|date picker -> today");
    }
    const consentChecked = await applySubmitConsentCheckboxes(modal, activeSettings);
    if (consentChecked) {
      changedAny = true;
      filledThisStep.push("checkbox|required|answered|submit consent");
    }
    const afterDiagnostics = collectQuestionBlockDiagnostics(modal);
    const unresolvedAfter = afterDiagnostics.filter((d) => d.required && !d.answered);
    const unresolvedImproved = unresolvedAfter.length < unresolvedBefore.length;
    const unresolvedKnownAfter = unresolvedAfter.filter((d) => d.type !== "unknown");
    const unresolvedUnknownOnly = unresolvedAfter.length > 0 && unresolvedKnownAfter.length === 0;
    await debugLog(settings, "Modal step coverage (after fill)", {
      stepAttempt: safety,
      changedAny,
      filledThisStep: filledThisStep.slice(0, 12),
      totalBlocks: afterDiagnostics.length,
      requiredBlocks: afterDiagnostics.filter((d) => d.required).length,
      unresolvedRequired: unresolvedAfter.length,
      unresolvedFields: unresolvedAfter.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
    });

    const stepSignature = getModalSignature(modal);
    const stepState = stepStateBySignature.get(stepSignature) || { preflightAttempts: 0, nextClicks: 0, manualAnswerWaits: 0 };
    const modalValidationBeforeAction = getModalValidationMessage(modal);
    const hasVisibleSubmit = Boolean(findSubmitButton(modal));
    const hasVisibleNext = Boolean(findNextOrReviewButton(modal));
    const hasVisibleDone = Boolean(findDoneOrCloseButton(modal));

    await debugLog(settings, "Modal step plan", {
      stepAttempt: safety,
      signature: truncateDebugText(stepSignature, 120),
      preflightAttempts: stepState.preflightAttempts,
      nextClicks: stepState.nextClicks,
      manualAnswerWaits: stepState.manualAnswerWaits,
      unresolvedRequired: unresolvedAfter.length,
      unresolvedUnknownOnly,
      hasVisibleNext,
      hasVisibleSubmit,
      hasVisibleDone,
      validation: modalValidationBeforeAction || ""
    });

    // Preflight pass: detect visible required fields first and resolve them before advancing.
    if (unresolvedAfter.length > 0 && !unresolvedUnknownOnly) {
      if (changedAny && unresolvedImproved) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await debugLog(settings, "Preflight waiting after detected field updates", {
          preflightAttempts: stepState.preflightAttempts,
          unresolvedRequired: unresolvedAfter.length,
          unresolvedImproved
        });
        previousSignature = stepSignature;
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      const preflightAutoFixed = await attemptValidationAutoFix(modal, activeSettings);
      if (preflightAutoFixed) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await debugLog(settings, "Preflight validation auto-fix applied", {
          preflightAttempts: stepState.preflightAttempts
        });
        previousSignature = getModalSignature(modal);
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      const preflightAggressiveFill = await forceAnswerModalQuestions(modal, activeSettings);
      if (preflightAggressiveFill) {
        stepState.preflightAttempts += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await debugLog(settings, "Preflight aggressive fill applied", {
          preflightAttempts: stepState.preflightAttempts
        });
        previousSignature = getModalSignature(modal);
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }

      stepState.preflightAttempts += 1;
      stepStateBySignature.set(stepSignature, stepState);
      await debugLog(settings, "Preflight unresolved fields remain", {
        preflightAttempts: stepState.preflightAttempts,
        unresolvedRequired: unresolvedAfter.length,
        unresolvedFields: unresolvedAfter.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
      });

      const unresolvedQuestions = buildPendingQuestionsFromDiagnostics(
        unresolvedAfter,
        modalValidationBeforeAction || "Required field answer missing"
      );
      const shouldTryManualAnswerWait =
        unresolvedQuestions.length > 0 &&
        !unresolvedImproved &&
        stepState.preflightAttempts >= 2 &&
        stepState.manualAnswerWaits < 1;
      if (shouldTryManualAnswerWait) {
        stepState.manualAnswerWaits += 1;
        stepStateBySignature.set(stepSignature, stepState);
        await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: unresolvedQuestions });
        await logLine("Required custom fields detected. Waiting for answers from dashboard...", "warn");
        const waitResult = await waitForPendingAnswersFromSettings(
          unresolvedQuestions,
          Number(activeSettings.manualAnswerWaitMs || MANUAL_ANSWER_WAIT_MS),
          MANUAL_ANSWER_POLL_MS
        );
        if (waitResult.ok) {
          activeSettings = {
            ...activeSettings,
            screeningAnswers: {
              ...(activeSettings.screeningAnswers || {}),
              ...(waitResult.screeningAnswers || {})
            }
          };
          await logLine("Received answers for required fields. Continuing application.", "info");
          stagnantSteps = 0;
          previousSignature = getModalSignature(modal);
          continue;
        }
        await debugLog(settings, "Manual answer wait timed out", {
          unresolvedRequired: unresolvedAfter.length,
          waitedMs: Number(activeSettings.manualAnswerWaitMs || MANUAL_ANSWER_WAIT_MS)
        });
        if (shouldPauseForInput) {
          await logLine("Need your input for required fields. Open dashboard Jobs to answer, then resume run.", "warn");
          await sendMessage({ type: "CP_PAUSE" });
          return {
            submitted: false,
            skipped: true,
            reachedSubmit: false,
            reason: "Waiting for required custom field answers"
          };
        }
      }

      // Avoid blind next-click loops by giving a few no-click preflight attempts first.
      if (stepState.preflightAttempts <= 2) {
        previousSignature = stepSignature;
        await sleep(Math.min(700, Math.floor(STEP_DELAY_MS * 0.7)));
        continue;
      }
    } else if (unresolvedUnknownOnly) {
      await debugLog(settings, "Unresolved fields are unknown type; proceeding to action button to trigger explicit validation", {
        unresolvedRequired: unresolvedAfter.length,
        unresolvedFields: unresolvedAfter.slice(0, 8).map((d) => summarizeQuestionBlockState(d))
      });
    }

    const submitBtn = findSubmitButton(modal);
    if (submitBtn) {
      await applyFollowCompanyPreference(modal, activeSettings);
      if (!settings.dryRun && settings.pauseBeforeSubmit) {
        await logLine("Paused before submit. Review the form, submit manually, then resume run.", "warn");
        await sendMessage({ type: "CP_PAUSE" });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: "Paused before submit for manual review"
        };
      }
      if (!settings.dryRun && !settings.autoSubmit) {
        await logLine("Auto-submit is OFF. Paused at submit step. Submit manually, then resume run.", "warn");
        await sendMessage({ type: "CP_PAUSE" });
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: "Paused before submit because auto-submit is disabled"
        };
      }
      if (!settings.dryRun && settings.autoSubmit) {
        const clicked = await resilientClick(submitBtn, "Submit");
        await sleep(STEP_DELAY_MS);
        const submitCompleted = didSubmitComplete(modal);
        if (submitCompleted) {
          await logLine("Application submitted", "info");
          await closePostSubmitUi(settings, { discardDraft: false });
          return { submitted: true, skipped: false, reachedSubmit: true };
        }
        const submitValidation = getModalValidationMessage(getActiveModal() || modal);
        const unresolvedAfterSubmit = collectQuestionBlockDiagnostics(getActiveModal() || modal)
          .filter((d) => d.required && !d.answered);
        await debugLog(settings, "Submit click did not complete application", {
          clicked,
          validation: submitValidation,
          unresolvedRequired: unresolvedAfterSubmit.length,
          unresolvedFields: unresolvedAfterSubmit.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
        });
        const submitFixedValidation = await attemptValidationAutoFix(getActiveModal() || modal, activeSettings);
        const submitForcedAnswers = await forceAnswerModalQuestions(getActiveModal() || modal, activeSettings);
        if (submitFixedValidation || submitForcedAnswers) {
          await logLine("Submit was blocked. Filled remaining fields and retrying submit.", "warn");
          stagnantSteps = 0;
          previousSignature = getModalSignature(getActiveModal() || modal);
          continue;
        }
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: true,
          reason: submitValidation || "Submit click did not complete application"
        };
      }
      await logLine("Dry-run: reached submit step (not submitting). Use 'start live' to submit for real.", "warn");
      await closePostSubmitUi(settings, { discardDraft: true });
      return { submitted: false, skipped: false, reachedSubmit: true };
    }

    const nextBtn = findNextOrReviewButton(modal);
    if (!nextBtn) {
      const doneBtn = findDoneOrCloseButton(modal);
      if (doneBtn) {
        await resilientClick(doneBtn, "Done/Close");
        return {
          submitted: Boolean(settings.autoSubmit && !settings.dryRun),
          skipped: false,
          reachedSubmit: true
        };
      }
      const validation = getModalValidationMessage(modal);
      return {
        submitted: false,
        skipped: true,
        reachedSubmit: false,
        reason: validation ? `No next/review button. Validation: ${validation}` : "No next/review button"
      };
    }

    await debugLog(settings, "Clicking modal action", {
      text: normalizeLabel(nextBtn.textContent || ""),
      ariaLabel: normalizeLabel(nextBtn.getAttribute("aria-label") || ""),
      disabled: Boolean(nextBtn.disabled)
    });
    stepState.nextClicks += 1;
    stepStateBySignature.set(stepSignature, stepState);
    if (!await resilientClick(nextBtn, "Next/Review")) break;
    await sleep(STEP_DELAY_MS);

    const currentSignature = getModalSignature(modal);
    const autoFixed = await attemptValidationAutoFix(modal, activeSettings);
    if (!changedAny && !autoFixed && currentSignature === previousSignature) {
      stagnantSteps += 1;
      const validation = getModalValidationMessage(modal);
      const postClickDiagnostics = collectQuestionBlockDiagnostics(modal);
      const unresolvedPostClick = postClickDiagnostics.filter((d) => d.required && !d.answered);
      await debugLog(settings, "No modal progress detected", {
        stagnantSteps,
        validation,
        unresolvedRequired: unresolvedPostClick.length,
        unresolvedFields: unresolvedPostClick.slice(0, 12).map((d) => summarizeQuestionBlockState(d))
      });
      if (stagnantSteps >= 2) {
        const aggressiveChanged = await forceAnswerModalQuestions(modal, activeSettings);
        if (aggressiveChanged) {
          await logLine("Applied aggressive fallback answers and retrying next step.", "warn");
          stagnantSteps = 0;
          previousSignature = getModalSignature(modal);
          continue;
        }
      }
      if (stagnantSteps >= maxStagnantSteps) {
        const validationNorm = normalizeLabel(validation || "");
        const blockedDiagnostics = collectQuestionBlockDiagnostics(modal);
        const unresolvedBlocked = blockedDiagnostics.filter((d) => d.required && !d.answered);
        await debugLog(settings, "Modal blocked at step", {
          stagnantSteps,
          validation,
          unresolvedRequired: unresolvedBlocked.length,
          unresolvedFields: unresolvedBlocked.slice(0, 16).map((d) => summarizeQuestionBlockState(d))
        });
        if (validationNorm.includes("resume") && validationNorm.includes("required")) {
          if (shouldPauseForInput) {
            await sendMessage({
              type: "CP_REGISTER_PENDING_QUESTIONS",
              questions: [
                {
                  questionKey: "resume_upload_required",
                  questionLabel: "LinkedIn resume upload required",
                  validationMessage:
                    "A resume is required. Upload resume in LinkedIn Easy Apply profile. Copilot will auto-pick the latest attached resume after you resume."
                }
              ]
            });
            await logLine(
              "Resume required: upload resume in LinkedIn Easy Apply profile, then resume run. Copilot will auto-pick the latest attached resume.",
              "warn"
            );
            await sendMessage({ type: "CP_PAUSE" });
          } else {
            await logLine("Resume required and pause-at-failed-question is disabled. Skipping job.", "warn");
          }
          return {
            submitted: false,
            skipped: true,
            reachedSubmit: false,
            reason: "a resume is required"
          };
        }

        const unanswered = buildPendingQuestionsFromValidation(modal, validation || "Required field answer missing");
        if (unanswered.length && shouldPauseForInput) {
          await sendMessage({ type: "CP_REGISTER_PENDING_QUESTIONS", questions: unanswered });
          await logLine("Need your input for required application fields. Open dashboard Jobs to answer.", "warn");
          await sendMessage({ type: "CP_PAUSE" });
        } else if (unanswered.length) {
          await logLine("Required fields unresolved and pause-at-failed-question is disabled. Skipping job.", "warn");
        }
        return {
          submitted: false,
          skipped: true,
          reachedSubmit: false,
          reason: validation || "Could not progress modal (likely unanswered required field)"
        };
      }
    } else {
      stagnantSteps = 0;
    }
    previousSignature = currentSignature;
  }

  return { submitted: false, skipped: true, reachedSubmit: false, reason: "Could not reach submit step" };
}

async function runCycle(settings) {
  if (!isJobsPage()) {
    await logLine("Left jobs page. Pausing run.", "warn");
    return false;
  }
  if (isPostApplySearchPage()) {
    await debugLog(settings, "Detected post-apply page during run cycle; redirecting", { path: window.location.pathname });
    window.location.href = JOBS_SEARCH_URL;
    return false;
  }

  if (isJobsViewPage()) {
    await debugLog(settings, "Running from jobs view page");
    const viewDescription = getJobDescriptionText();
    const aboutCompany = getAboutCompanyText();
    currentJobContext = {
      ...currentJobContext,
      title: String(document.querySelector("h1")?.textContent || "").trim(),
      company: String(document.querySelector(".jobs-unified-top-card__company-name, .jobs-details-top-card__company-url")?.textContent || "").trim(),
      description: viewDescription,
      aboutCompany,
      jobUrl: window.location.href,
      jobId: (window.location.href.match(/\/jobs\/view\/(\d+)/)?.[1] || "")
    };
    const viewJobKey = String(currentJobContext.jobId || "").trim();
    if (viewJobKey && runSeenJobKeys.has(viewJobKey)) {
      await debugLog(settings, "Skipping already-seen jobs view in this run", { jobKey: viewJobKey });
      window.location.href = getActiveRunSearchUrl(settings);
      return false;
    }
    const viewAboutCompanyDecision = shouldSkipByAboutCompany(currentJobContext.aboutCompany, settings);
    if (viewAboutCompanyDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${viewAboutCompanyDecision.reason}`, viewAboutCompanyDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: viewAboutCompanyDecision.reasonCode,
        reason: viewAboutCompanyDecision.reason,
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(viewJobKey);
      window.location.href = getActiveRunSearchUrl(settings);
      return true;
    }
    const viewDescriptionDecision = shouldSkipByDescription(currentJobContext.description, settings);
    if (viewDescriptionDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${viewDescriptionDecision.reason}`, viewDescriptionDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: viewDescriptionDecision.reasonCode,
        reason: viewDescriptionDecision.reason,
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(viewJobKey);
      window.location.href = getActiveRunSearchUrl(settings);
      return true;
    }
    const applyAction = await waitForApplyButtonFromDetailPane(settings, 9000, "jobs view");
    if (applyAction.type === "none" || !applyAction.button) {
      if (hasDailyEasyApplyLimitSignal()) {
        await logLine("LinkedIn daily Easy Apply limit detected. Stopping run.", "warn");
        await recordOutcome("SKIPPED", {
          reasonCode: "DAILY_EASY_APPLY_LIMIT",
          reason: "LinkedIn daily Easy Apply limit reached",
          ...currentJobContext
        });
        await sendMessage({ type: "CP_STOP" });
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "No Apply button on current job view", "NO_APPLY_BUTTON");
      await recordOutcome("SKIPPED", {
        reasonCode: "NO_APPLY_BUTTON",
        reason: "No apply button on jobs view",
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(viewJobKey);
      await debugLog(settings, "Recovering from jobs view without apply button", {
        jobKey: viewJobKey || undefined,
        redirectUrl: getActiveRunSearchUrl(settings)
      });
      window.location.href = getActiveRunSearchUrl(settings);
      return true;
    }
    if (applyAction.type === "external") {
      if (settings.easyApplyOnly) {
        runStats.skipped += 1;
        await logOutcome("warn", "Skipped (external apply)", "EXTERNAL_APPLY_ONLY");
        await recordOutcome("SKIPPED", {
          reasonCode: "EXTERNAL_APPLY_ONLY",
          reason: "External apply blocked because easyApplyOnly is enabled",
          ...currentJobContext
        });
      } else {
        await resilientClick(applyAction.button, "External Apply");
        runStats.skipped += 1;
        runSearchTermSuccessCount += 1;
        await logOutcome("info", "Opened external apply link (manual completion required)", "EXTERNAL_APPLY_OPENED");
        await recordOutcome("EXTERNAL", {
          reasonCode: "EXTERNAL_APPLY_OPENED",
          reason: "External apply opened",
          ...currentJobContext
        });
      }
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(viewJobKey);
      return true;
    }
    await resilientClick(applyAction.button, "Easy Apply");
    const modal = await waitForModalOpen(4500);
    if (!modal) {
      if (hasDailyEasyApplyLimitSignal()) {
        await logLine("LinkedIn daily Easy Apply limit detected. Stopping run.", "warn");
        await recordOutcome("SKIPPED", {
          reasonCode: "DAILY_EASY_APPLY_LIMIT",
          reason: "LinkedIn daily Easy Apply limit reached",
          ...currentJobContext
        });
        await sendMessage({ type: "CP_STOP" });
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: Easy Apply click did not open modal", "MODAL_NOT_FOUND");
      await recordOutcome("SKIPPED", {
        reasonCode: "MODAL_NOT_FOUND",
        reason: "Easy Apply modal not found",
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(viewJobKey);
      window.location.href = getActiveRunSearchUrl(settings);
      return true;
    }
    await sleep(400);
    const resultFromView = await processEasyApplyModal(settings);
    await debugLog(settings, "Modal result (view page)", resultFromView);
    if (resultFromView.submitted || (settings.dryRun && resultFromView.reachedSubmit)) {
      runStats.applied += 1;
      runSearchTermSuccessCount += 1;
      await recordOutcome("APPLIED", {
        reasonCode: settings.dryRun ? "DRY_RUN_REACHED_SUBMIT" : "SUBMITTED",
        reason: settings.dryRun ? "Dry-run reached submit stage" : "Application submitted",
        ...currentJobContext
      });
    } else if (resultFromView.skipped) {
      runStats.skipped += 1;
      if (resultFromView.reason) await logLine(`Skipped: ${resultFromView.reason}`, "warn");
      await recordOutcome("SKIPPED", {
        reasonCode: "VIEW_MODAL_SKIPPED",
        reason: resultFromView.reason || "Modal flow skipped",
        ...currentJobContext
      });
    } else {
      runStats.failed += 1;
      await recordOutcome("FAILED", {
        reasonCode: "VIEW_MODAL_FAILED",
        reason: resultFromView.reason || "Modal flow failed",
        ...currentJobContext
      });
    }
    await sendMessage({ type: "CP_PROGRESS", ...runStats });
    markJobSeen(viewJobKey);
    if (runSearchTermSuccessCount >= getSwitchNumber(settings)) {
      runSearchTermSuccessCount = 0;
      const switched = await rotateSearchTerm(settings);
      if (switched) return true;
    }
    return true;
  }

  let cards = collectJobCards();
  if (!cards.length) {
    cards = await waitForJobsToRender(settings, 7000);
  }
  await debugLog(settings, "Selector diagnostics", {
    jobCardContainer: document.querySelectorAll(".job-card-container").length,
    occludable: document.querySelectorAll("[data-occludable-job-id]").length,
    listItems: document.querySelectorAll("li.jobs-search-results__list-item").length,
    jobAnchors: document.querySelectorAll("a[href*='/jobs/view/']").length,
    cards: cards.length,
    path: window.location.pathname
  });
  if (!cards.length) {
    await logLine("No jobs found on current page", "warn");
    const scrollRoot =
      document.querySelector(".jobs-search-results-list") ||
      document.querySelector(".scaffold-layout__list-detail-inner") ||
      document.scrollingElement ||
      document.body;
    if (scrollRoot && typeof scrollRoot.scrollBy === "function") {
      scrollRoot.scrollBy({ top: 900, behavior: "smooth" });
    } else {
      window.scrollBy({ top: 900, behavior: "smooth" });
    }
    await sleep(900);
    const movedToNextPage = await gotoNextResultsPage(settings);
    if (movedToNextPage) return true;
    const movedToNextTerm = await rotateSearchTerm(settings);
    if (movedToNextTerm) return true;
    return false;
  }

  await logLine(`Found ${cards.length} job cards`);
  for (const card of cards) {
    const state = (await sendMessage({ type: "CP_GET_BOOTSTRAP" })).state;
    if (!state.running || state.paused) return false;
    if (runSearchTermSuccessCount >= getSwitchNumber(settings) && getConfiguredSearchTerms(settings).length > 1) {
      runSearchTermSuccessCount = 0;
      const switched = await rotateSearchTerm(settings);
      if (switched) return true;
    }
    if (runStats.applied >= Number(settings.maxApplicationsPerRun || 3)) {
      await logLine("Reached max applications for this run");
      return false;
    }
    if (runStats.skipped >= Number(settings.maxSkipsPerRun || 50)) {
      await logLine("Reached max skips for this run", "warn");
      await sendMessage({ type: "CP_STOP" });
      return false;
    }

    const jobKey = getJobKeyFromCard(card);
    if (jobKey && runSeenJobKeys.has(jobKey)) {
      await debugLog(settings, "Skipping already-seen card in this run", { jobKey });
      continue;
    }
    if (isAlreadyAppliedCard(card)) {
      runStats.skipped += 1;
      await logOutcome("info", "Skipped (already applied)", "ALREADY_APPLIED");
      await recordOutcome("SKIPPED", {
        reasonCode: "ALREADY_APPLIED",
        reason: "LinkedIn card marked as already applied",
        jobId: jobKey || "",
        ...extractCardMeta(card)
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }
    const ruleDecision = shouldSkipByRules(card, settings);
    if (ruleDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${ruleDecision.reason}`, ruleDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: ruleDecision.reasonCode,
        reason: ruleDecision.reason,
        jobId: jobKey || "",
        ...extractCardMeta(card)
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }

    const cardMeta = extractCardMeta(card);
    const anchor = getCardAnchor(card);
    const title = cardMeta.titleRaw || anchor?.textContent?.trim() || card.textContent?.trim()?.slice(0, 80) || "Job";
    await debugLog(settings, "Processing card", { title, company: cardMeta.companyRaw || cardMeta.company || "" });
    await logLine(`Opening: ${title}`);
    await resilientClick(card, "Job card");
    await sleep(1200);

    const description = getJobDescriptionText();
    const aboutCompany = getAboutCompanyText();
    currentJobContext = {
      title,
      company: cardMeta.companyRaw || cardMeta.company || "",
      workLocation: cardMeta.workLocationRaw || cardMeta.workLocation || "",
      description,
      aboutCompany,
      jobId: jobKey || "",
      jobUrl: anchor?.href || window.location.href
    };

    const aboutCompanyDecision = shouldSkipByAboutCompany(aboutCompany, settings);
    if (aboutCompanyDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${aboutCompanyDecision.reason}`, aboutCompanyDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: aboutCompanyDecision.reasonCode,
        reason: aboutCompanyDecision.reason,
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }

    const descriptionDecision = shouldSkipByDescription(description, settings);
    if (descriptionDecision.skip) {
      runStats.skipped += 1;
      await logOutcome("warn", `Skipped: ${descriptionDecision.reason}`, descriptionDecision.reasonCode);
      await recordOutcome("SKIPPED", {
        reasonCode: descriptionDecision.reasonCode,
        reason: descriptionDecision.reason,
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }

    let applyAction = await waitForApplyButtonFromDetailPane(settings, 5000, "search card detail");
    if (!applyAction.button && isJobsViewPage()) {
      await debugLog(settings, "Card click navigated to jobs view page");
    }
    if (!applyAction.button) {
      if (anchor) {
        const retryClick = await resilientClick(anchor, "Job card anchor retry");
        if (retryClick) {
          await sleep(900);
          applyAction = await waitForApplyButtonFromDetailPane(settings, 7000, "search card anchor retry");
          if (applyAction.button) {
            await debugLog(settings, "Apply button found after anchor retry click", {
              type: applyAction.type
            });
          }
        }
      }
    }
    if (!applyAction.button) {
      if (hasDailyEasyApplyLimitSignal()) {
        await logLine("LinkedIn daily Easy Apply limit detected. Stopping run.", "warn");
        await recordOutcome("SKIPPED", {
          reasonCode: "DAILY_EASY_APPLY_LIMIT",
          reason: "LinkedIn daily Easy Apply limit reached",
          ...currentJobContext
        });
        await sendMessage({ type: "CP_STOP" });
        return false;
      }
      await debugLog(settings, "No detail apply button found", {
        detailRoots: document.querySelectorAll(".jobs-search__job-details, .jobs-details, .jobs-unified-top-card, .jobs-details-top-card, .scaffold-layout__detail").length,
        applyButtonsVisible: document.querySelectorAll("button.jobs-apply-button, .jobs-s-apply button").length
      });
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped (no Easy Apply button)", "NO_APPLY_BUTTON");
      await recordOutcome("SKIPPED", {
        reasonCode: "NO_APPLY_BUTTON",
        reason: "No apply button found in job detail pane",
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }
    if (applyAction.type === "external") {
      if (settings.easyApplyOnly) {
        runStats.skipped += 1;
        await logOutcome("warn", "Skipped (external apply)", "EXTERNAL_APPLY_ONLY");
        await recordOutcome("SKIPPED", {
          reasonCode: "EXTERNAL_APPLY_ONLY",
          reason: "External apply blocked because easyApplyOnly is enabled",
          ...currentJobContext
        });
      } else {
        await resilientClick(applyAction.button, "External Apply");
        runStats.skipped += 1;
        runSearchTermSuccessCount += 1;
        await logOutcome("info", "Opened external apply link (manual completion required)", "EXTERNAL_APPLY_OPENED");
        await recordOutcome("EXTERNAL", {
          reasonCode: "EXTERNAL_APPLY_OPENED",
          reason: "External apply opened",
          ...currentJobContext
        });
      }
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }

    await resilientClick(applyAction.button, "Easy Apply");
    const modal = await waitForModalOpen(4500);
    if (!modal) {
      if (hasDailyEasyApplyLimitSignal()) {
        await logLine("LinkedIn daily Easy Apply limit detected. Stopping run.", "warn");
        await recordOutcome("SKIPPED", {
          reasonCode: "DAILY_EASY_APPLY_LIMIT",
          reason: "LinkedIn daily Easy Apply limit reached",
          ...currentJobContext
        });
        await sendMessage({ type: "CP_STOP" });
        return false;
      }
      runStats.skipped += 1;
      await logOutcome("warn", "Skipped: Easy Apply click did not open modal", "MODAL_NOT_FOUND");
      await recordOutcome("SKIPPED", {
        reasonCode: "MODAL_NOT_FOUND",
        reason: "Easy Apply modal not found",
        ...currentJobContext
      });
      await sendMessage({ type: "CP_PROGRESS", ...runStats });
      markJobSeen(jobKey);
      continue;
    }
    await sleep(400);
    const result = await processEasyApplyModal(settings);
    await debugLog(settings, "Modal result", result);
    if (result.submitted || (settings.dryRun && result.reachedSubmit)) {
      runStats.applied += 1;
      runSearchTermSuccessCount += 1;
      await recordOutcome("APPLIED", {
        reasonCode: settings.dryRun ? "DRY_RUN_REACHED_SUBMIT" : "SUBMITTED",
        reason: settings.dryRun ? "Dry-run reached submit stage" : "Application submitted",
        ...currentJobContext
      });
    } else if (result.skipped) {
      runStats.skipped += 1;
      if (result.reason) {
        const reasonNorm = normalizeLabel(result.reason);
        const reasonCode = reasonNorm.includes("resume is required")
          ? "RESUME_REQUIRED"
          : reasonNorm.includes("valid phone")
          ? "VALIDATION_BLOCKED_PHONE"
          : (reasonNorm.includes("required") || reasonNorm.includes("selection"))
            ? "PENDING_USER_INPUT"
            : "SUBMIT_NOT_REACHED";
        await logOutcome("warn", `Skipped: ${result.reason}`, reasonCode);
        await recordOutcome("SKIPPED", {
          reasonCode,
          reason: result.reason,
          ...currentJobContext
        });
      } else {
        await recordOutcome("SKIPPED", {
          reasonCode: "SUBMIT_NOT_REACHED",
          reason: "Submit step not reached",
          ...currentJobContext
        });
      }
    } else {
      runStats.failed += 1;
      await logOutcome("error", "Failed to process easy apply modal", "MODAL_FLOW_ERROR");
      await recordOutcome("FAILED", {
        reasonCode: "MODAL_FLOW_ERROR",
        reason: "Failed to process easy apply modal",
        ...currentJobContext
      });
    }
    await sendMessage({ type: "CP_PROGRESS", ...runStats });
    markJobSeen(jobKey);
    if (runSearchTermSuccessCount >= getSwitchNumber(settings)) {
      runSearchTermSuccessCount = 0;
      const switched = await rotateSearchTerm(settings);
      if (switched) return true;
    }
    await sleep(900);
  }
  const movedToNextPage = await gotoNextResultsPage(settings);
  if (movedToNextPage) return true;
  await rotateSearchTerm(settings);
  return true;
}

async function runAutomationLoop() {
  if (runningLoop) return;
  runningLoop = true;
  try {
    const boot = await getBootstrap();
    runSeenJobKeys = loadRunSeenJobKeys(boot?.state?.startedAt || "");
    runStats = {
      applied: Number(boot.state.applied || 0),
      skipped: Number(boot.state.skipped || 0),
      failed: Number(boot.state.failed || 0)
    };
    let lastProgressAt = Date.now();
    let noProgressCycles = 0;
    let lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
    await logLine("Automation engine initialized");

    let guard = 0;
    while (guard < 200) {
      guard += 1;
      const { state, settings } = await getBootstrap();
      if (!state.running || state.paused) break;

      if (state.startedAt && state.startedAt !== lastRunStartedAt) {
        lastRunStartedAt = state.startedAt;
        runSeenJobKeys = loadRunSeenJobKeys(lastRunStartedAt);
        resumeChoiceCache.clear();
        runSearchTermSuccessCount = 0;
        currentJobContext = {
          title: "",
          company: "",
          workLocation: "",
          description: "",
          aboutCompany: "",
          jobId: "",
          jobUrl: ""
        };
        const terms = getConfiguredSearchTerms(settings);
        if (terms.length > 0) {
          runSearchTermCursor = settings.randomizeSearchOrder
            ? Math.floor(Math.random() * terms.length)
            : 0;
        } else {
          runSearchTermCursor = 0;
        }
        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      }

      const maxPerRun = Number(settings.maxApplicationsPerRun || 3);
      if (runStats.applied >= maxPerRun) {
        if (settings.runNonStop) {
          const settingsPatch = {};
          if (settings.cycleDatePosted) {
            settingsPatch.datePosted = getNextDatePostedValue(settings.datePosted, settings.stopDateCycleAt24hr !== false);
          }
          if (settings.alternateSortBy) {
            settingsPatch.sortBy = getAlternateSortValue(settings.sortBy);
          }
          if (Object.keys(settingsPatch).length > 0) {
            await sendMessage({ type: "CP_SAVE_SETTINGS", settings: settingsPatch });
            await logLine(
              `Starting next cycle with date "${settingsPatch.datePosted || settings.datePosted}" and sort "${settingsPatch.sortBy || settings.sortBy}".`,
              "info"
            );
          } else {
            await logLine("Starting next non-stop cycle.", "info");
          }
          runStats = { applied: 0, skipped: 0, failed: 0 };
          clearSeenJobsForRun(lastRunStartedAt);
          resumeChoiceCache.clear();
          runSearchTermSuccessCount = 0;
          preparedRun = false;
          await sendMessage({ type: "CP_PROGRESS", ...runStats });
          continue;
        }
        await logLine("Max applications reached. Stopping run.");
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      if (!preparedRun) {
        const ok = await prepareRun(settings);
        if (!ok) break;
      }
      const beforeMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      const cycled = await runCycle(settings);
      const afterMarker = `${runStats.applied}|${runStats.skipped}|${runStats.failed}`;
      if (afterMarker !== beforeMarker) {
        lastProgressAt = Date.now();
        noProgressCycles = 0;
        lastProgressMarker = afterMarker;
      } else {
        noProgressCycles += 1;
        if (noProgressCycles % 5 === 0) {
          await debugLog(settings, "No progress cycle", {
            noProgressCycles,
            elapsedMs: Date.now() - lastProgressAt,
            marker: lastProgressMarker
          });
        }
      }

      const noProgressElapsedMs = Date.now() - lastProgressAt;
      if (noProgressCycles >= NO_PROGRESS_MAX_CYCLES || noProgressElapsedMs >= NO_PROGRESS_TIMEOUT_MS) {
        await logLine(
          `No progress detected for ${Math.round(noProgressElapsedMs / 1000)}s. Stopping run to avoid stuck loop.`,
          "warn"
        );
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      if (!cycled && runStats.applied >= maxPerRun) {
        await sendMessage({ type: "CP_STOP" });
        break;
      }
      await sleep(1200);
    }
  } catch (error) {
    await sendMessage({ type: "CP_SET_ERROR", error: error?.message || String(error) });
  } finally {
    try {
      const modal = getActiveModal();
      if (modal && isSaveApplicationPrompt(modal)) {
        await dismissSaveApplicationPrompt(modal);
      }
    } catch {
      // best-effort modal cleanup
    }
    runningLoop = false;
  }
}

async function startStatePolling() {
  while (true) {
    if (!extensionContextAlive) break;
    const boot = await getBootstrap();
    if (!boot || !boot.state) {
      await sleep(STATE_POLL_MS);
      continue;
    }
    renderState(boot.state);
    if (!boot.state.running) {
      preparedRun = false;
      lastRunStartedAt = null;
      runSearchTermSuccessCount = 0;
      clearSeenJobsForRun();
      resumeChoiceCache.clear();
    }
    if (boot.state.running && !runningLoop) {
      runAutomationLoop().catch(() => null);
    }
    await sleep(STATE_POLL_MS);
  }
}

if (!window.__CP_COPILOT_ACTIVE__) {
  window.__CP_COPILOT_ACTIVE__ = true;
  ensurePanel();
  window.addEventListener("resize", () => {
    applyPanelLayout();
    logPanelDebug("window-resize");
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "c") {
      panelPrefs.left = Math.max(8, window.innerWidth - 440);
      panelPrefs.top = 84;
      panelPrefs.minimized = false;
      panelPrefs.maximized = false;
      savePanelPrefs();
      applyPanelLayout();
      logPanelDebug("hotkey-reset");
    }
  });
  startStatePolling().catch(() => null);
} else {
  ensurePanel();
  logPanelDebug("reused-script-instance");
}
