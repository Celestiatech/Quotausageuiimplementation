const MAX_LOG_ENTRIES = 500;
const MAX_HISTORY_ENTRIES = 1000;
const API_TIMEOUT_MS = 8000;

const HISTORY_KEY_MAP = {
  APPLIED: "cpAppliedHistory",
  FAILED: "cpFailedHistory",
  EXTERNAL: "cpExternalHistory",
  SKIPPED: "cpSkippedHistory"
};

const DEFAULT_STATE = {
  running: false,
  paused: false,
  startedAt: null,
  applied: 0,
  skipped: 0,
  failed: 0,
  logs: [],
  lastError: null
};

const DEFAULT_SETTINGS = {
  apiBaseUrl: "http://localhost:5000/api",
  authToken: "",
  enableBackendSync: false,
  aiAnswerPath: "/ai/answer",
  dryRun: true,
  autoSubmit: false,
  liveModeAcknowledged: false,
  autoResumeOnAnswer: true,
  runNonStop: false,
  alternateSortBy: false,
  cycleDatePosted: false,
  stopDateCycleAt24hr: true,
  maxApplicationsPerRun: 3,
  maxSkipsPerRun: 50,
  switchNumber: 30,
  searchLocation: "",
  searchTerms: [],
  randomizeSearchOrder: false,
  sortBy: "",
  datePosted: "Past week",
  easyApplyOnly: true,
  salary: "",
  experienceLevel: [],
  jobType: [],
  onSite: [],
  companies: [],
  filterLocations: [],
  industry: [],
  jobFunction: [],
  jobTitles: [],
  benefits: [],
  commitments: [],
  under10Applicants: false,
  inYourNetwork: false,
  fairChanceEmployer: false,
  debugMode: true,
  blacklistedCompanies: [],
  aboutCompanyBadWords: [],
  aboutCompanyGoodWords: [],
  badWords: [],
  currentExperience: -1,
  didMasters: false,
  securityClearance: false,
  followCompanies: false,
  pauseBeforeSubmit: false,
  pauseAtFailedQuestion: true,
  overwritePreviousAnswers: false,
  manualAnswerWaitMs: 45000,
  currentCity: "",
  contactEmail: "",
  phoneNumber: "",
  phoneCountryCode: "",
  marketingConsent: "No",
  requireVisa: "No",
  usCitizenship: "",
  veteranStatus: "",
  disabilityStatus: "",
  gender: "",
  ethnicity: "",
  yearsOfExperienceAnswer: "",
  desiredSalary: "",
  currentCtc: "",
  noticePeriodDays: "",
  linkedinUrl: "",
  websiteUrl: "",
  recentEmployer: "",
  confidenceLevel: "",
  linkedinHeadline: "",
  linkedinSummary: "",
  coverLetter: "",
  firstName: "",
  middleName: "",
  lastName: "",
  fullName: "",
  streetAddress: "",
  stateRegion: "",
  postalCode: "",
  country: "",
  screeningAnswers: {}
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || "").trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[\n,]/g)
    .map((v) => v.trim())
    .filter(Boolean);
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

function resolveScreeningAnswer(screeningAnswers, questionLabel) {
  const source = screeningAnswers && typeof screeningAnswers === "object" ? screeningAnswers : {};
  const raw = String(questionLabel || "").trim();
  const norm = normalizeLabel(raw);
  const key = questionKeyFromLabel(raw);

  const directCandidates = [raw, key, norm];
  for (const candidate of directCandidates) {
    if (!candidate) continue;
    const value = String(source[candidate] || "").trim();
    if (value) return value;
  }
  for (const [k, value] of Object.entries(source)) {
    const answer = String(value || "").trim();
    if (!answer) continue;
    if (normalizeLabel(k) === norm) return answer;
  }
  return "";
}

async function getState() {
  const { cpState } = await chrome.storage.local.get("cpState");
  return { ...DEFAULT_STATE, ...(cpState || {}) };
}

async function setState(next) {
  await chrome.storage.local.set({ cpState: next });
  return next;
}

async function getSettings() {
  const { cpSettings } = await chrome.storage.local.get("cpSettings");
  return {
    ...DEFAULT_SETTINGS,
    ...(cpSettings || {}),
    apiBaseUrl: sanitizeApiBaseUrl(cpSettings?.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl),
    searchTerms: normalizeArray(cpSettings?.searchTerms ?? DEFAULT_SETTINGS.searchTerms),
    experienceLevel: normalizeArray(cpSettings?.experienceLevel ?? DEFAULT_SETTINGS.experienceLevel),
    jobType: normalizeArray(cpSettings?.jobType ?? DEFAULT_SETTINGS.jobType),
    onSite: normalizeArray(cpSettings?.onSite ?? DEFAULT_SETTINGS.onSite),
    companies: normalizeArray(cpSettings?.companies ?? DEFAULT_SETTINGS.companies),
    filterLocations: normalizeArray(cpSettings?.filterLocations ?? DEFAULT_SETTINGS.filterLocations),
    industry: normalizeArray(cpSettings?.industry ?? DEFAULT_SETTINGS.industry),
    jobFunction: normalizeArray(cpSettings?.jobFunction ?? DEFAULT_SETTINGS.jobFunction),
    jobTitles: normalizeArray(cpSettings?.jobTitles ?? DEFAULT_SETTINGS.jobTitles),
    benefits: normalizeArray(cpSettings?.benefits ?? DEFAULT_SETTINGS.benefits),
    commitments: normalizeArray(cpSettings?.commitments ?? DEFAULT_SETTINGS.commitments),
    blacklistedCompanies: normalizeArray(cpSettings?.blacklistedCompanies ?? DEFAULT_SETTINGS.blacklistedCompanies),
    aboutCompanyBadWords: normalizeArray(cpSettings?.aboutCompanyBadWords ?? DEFAULT_SETTINGS.aboutCompanyBadWords),
    aboutCompanyGoodWords: normalizeArray(cpSettings?.aboutCompanyGoodWords ?? DEFAULT_SETTINGS.aboutCompanyGoodWords),
    badWords: normalizeArray(cpSettings?.badWords ?? DEFAULT_SETTINGS.badWords)
  };
}

function apiHeaders(settings) {
  const headers = {
    "Content-Type": "application/json"
  };
  const token = String(settings?.authToken || "").trim();
  if (token) {
    headers.Authorization = token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
  }
  return headers;
}

async function postToApi(settings, path, payload) {
  if (!settings?.enableBackendSync) {
    return { ok: false, skipped: true, error: "backend sync disabled" };
  }
  const baseUrl = sanitizeApiBaseUrl(settings.apiBaseUrl);
  if (!baseUrl) {
    return { ok: false, skipped: true, error: "api base url missing" };
  }
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${normalizedPath}`, {
      method: "POST",
      headers: apiHeaders(settings),
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      error: response.ok ? null : body?.error || `HTTP ${response.status}`
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function pushLog(message, level = "info", meta = undefined) {
  const state = await getState();
  const entry = { ts: nowIso(), level, message, meta };
  const logs = [...(state.logs || []), entry].slice(-MAX_LOG_ENTRIES);
  await setState({ ...state, logs });

  const settings = await getSettings();
  void postToApi(settings, "/extension/logs", {
    ...entry,
    state: {
      running: state.running,
      paused: state.paused,
      applied: state.applied,
      skipped: state.skipped,
      failed: state.failed
    }
  });

  return entry;
}

async function exportLogs() {
  const state = await getState();
  const histories = await getRunHistory();
  const payload = {
    exportedAt: nowIso(),
    state: {
      running: state.running,
      paused: state.paused,
      applied: state.applied,
      skipped: state.skipped,
      failed: state.failed,
      startedAt: state.startedAt,
      lastError: state.lastError
    },
    logs: state.logs || [],
    history: histories
  };
  return JSON.stringify(payload, null, 2);
}

async function resetRunState() {
  const state = await getState();
  return setState({
    ...state,
    running: false,
    paused: false,
    startedAt: null,
    applied: 0,
    skipped: 0,
    failed: 0,
    lastError: null
  });
}

async function getRunHistory() {
  const snapshot = await chrome.storage.local.get(Object.values(HISTORY_KEY_MAP));
  return {
    applied: Array.isArray(snapshot.cpAppliedHistory) ? snapshot.cpAppliedHistory : [],
    failed: Array.isArray(snapshot.cpFailedHistory) ? snapshot.cpFailedHistory : [],
    external: Array.isArray(snapshot.cpExternalHistory) ? snapshot.cpExternalHistory : [],
    skipped: Array.isArray(snapshot.cpSkippedHistory) ? snapshot.cpSkippedHistory : []
  };
}

async function appendRunHistory(outcomeType, data = {}) {
  const key = HISTORY_KEY_MAP[String(outcomeType || "").toUpperCase()] || HISTORY_KEY_MAP.SKIPPED;
  const current = await chrome.storage.local.get(key);
  const list = Array.isArray(current[key]) ? current[key] : [];
  const entry = {
    ts: nowIso(),
    outcomeType: String(outcomeType || "SKIPPED").toUpperCase(),
    data
  };
  const next = [...list, entry].slice(-MAX_HISTORY_ENTRIES);
  await chrome.storage.local.set({ [key]: next });

  const settings = await getSettings();
  void postToApi(settings, "/extension/outcomes", entry);
  return entry;
}

async function persistProgress(applied, skipped, failed) {
  const state = await getState();
  const next = await setState({
    ...state,
    applied: Number(applied ?? state.applied),
    skipped: Number(skipped ?? state.skipped),
    failed: Number(failed ?? state.failed)
  });
  const settings = await getSettings();
  void postToApi(settings, "/extension/progress", {
    ts: nowIso(),
    applied: next.applied,
    skipped: next.skipped,
    failed: next.failed,
    running: next.running,
    paused: next.paused
  });
  return next;
}

async function saveSettings(incoming = {}) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...(incoming || {}),
    apiBaseUrl: sanitizeApiBaseUrl(incoming?.apiBaseUrl ?? current.apiBaseUrl),
    searchTerms: normalizeArray(incoming?.searchTerms ?? current.searchTerms),
    experienceLevel: normalizeArray(incoming?.experienceLevel ?? current.experienceLevel),
    jobType: normalizeArray(incoming?.jobType ?? current.jobType),
    onSite: normalizeArray(incoming?.onSite ?? current.onSite),
    companies: normalizeArray(incoming?.companies ?? current.companies),
    filterLocations: normalizeArray(incoming?.filterLocations ?? current.filterLocations),
    industry: normalizeArray(incoming?.industry ?? current.industry),
    jobFunction: normalizeArray(incoming?.jobFunction ?? current.jobFunction),
    jobTitles: normalizeArray(incoming?.jobTitles ?? current.jobTitles),
    benefits: normalizeArray(incoming?.benefits ?? current.benefits),
    commitments: normalizeArray(incoming?.commitments ?? current.commitments),
    blacklistedCompanies: normalizeArray(incoming?.blacklistedCompanies ?? current.blacklistedCompanies),
    aboutCompanyBadWords: normalizeArray(incoming?.aboutCompanyBadWords ?? current.aboutCompanyBadWords),
    aboutCompanyGoodWords: normalizeArray(incoming?.aboutCompanyGoodWords ?? current.aboutCompanyGoodWords),
    badWords: normalizeArray(incoming?.badWords ?? current.badWords),
    maxApplicationsPerRun: Math.max(1, Number((incoming?.maxApplicationsPerRun ?? current.maxApplicationsPerRun) ?? 1)),
    maxSkipsPerRun: Math.max(1, Number((incoming?.maxSkipsPerRun ?? current.maxSkipsPerRun) ?? 1)),
    switchNumber: Math.max(1, Number((incoming?.switchNumber ?? current.switchNumber) ?? 1)),
    manualAnswerWaitMs: Math.max(3000, Math.min(300000, Number((incoming?.manualAnswerWaitMs ?? current.manualAnswerWaitMs) ?? 45000))),
    currentExperience: Number.isFinite(Number(incoming?.currentExperience ?? current.currentExperience))
      ? Number(incoming?.currentExperience ?? current.currentExperience)
      : -1
  };
  await chrome.storage.local.set({ cpSettings: merged });
  return merged;
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await chrome.storage.local.set({
    cpSettings: settings,
    cpState: await getState(),
    cpPendingQuestions: [],
    cpAppliedHistory: [],
    cpFailedHistory: [],
    cpExternalHistory: [],
    cpSkippedHistory: []
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) return;

    if (message.type === "CP_GET_BOOTSTRAP") {
      sendResponse({
        ok: true,
        state: await getState(),
        settings: await getSettings()
      });
      return;
    }

    if (message.type === "CP_START") {
      const settings = await getSettings();
      if (!settings.dryRun && settings.autoSubmit && !settings.liveModeAcknowledged) {
        await pushLog("Blocked start: Live mode requires explicit acknowledgement in settings", "error");
        sendResponse({
          ok: false,
          error: "Live mode is not acknowledged. Open extension settings and enable live mode acknowledgement first."
        });
        return;
      }

      const state = await getState();
      const forceRestart = Boolean(message.forceRestart);
      if (state.running && !state.paused) {
        if (forceRestart) {
          const reset = await setState({
            ...state,
            running: false,
            paused: false,
            startedAt: null,
            applied: 0,
            skipped: 0,
            failed: 0,
            lastError: null
          });
          await pushLog("Run force-restarted by operator", "warn");
          const next = await setState({
            ...reset,
            running: true,
            paused: false,
            startedAt: nowIso(),
            lastError: null
          });
          await pushLog(settings.dryRun ? "Run started in dry-run mode" : "Run started in live mode", "info");
          sendResponse({ ok: true, state: next });
          return;
        }
        await pushLog("Start ignored (already running)", "warn");
        sendResponse({ ok: true, state });
        return;
      }
      const next = await setState({
        ...state,
        running: true,
        paused: false,
        startedAt: state.startedAt || nowIso(),
        lastError: null
      });
      await pushLog(settings.dryRun ? "Run started in dry-run mode" : "Run started in live mode", "info");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_PAUSE") {
      const state = await getState();
      const next = await setState({
        ...state,
        paused: true,
        running: false
      });
      await pushLog("Run paused", "warn");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_RESUME") {
      const state = await getState();
      const next = await setState({
        ...state,
        paused: false,
        running: true
      });
      await pushLog("Run resumed", "info");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_STOP") {
      const next = await resetRunState();
      await pushLog("Run stopped", "warn");
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_LOG") {
      await pushLog(message.message || "log", message.level || "info", message.meta);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_PROGRESS") {
      const next = await persistProgress(message.applied, message.skipped, message.failed);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_RECORD_OUTCOME") {
      const outcomeType = String(message.outcomeType || "SKIPPED").toUpperCase();
      const entry = await appendRunHistory(outcomeType, message.data || {});
      sendResponse({ ok: true, entry });
      return;
    }

    if (message.type === "CP_GET_RUN_HISTORY") {
      sendResponse({ ok: true, history: await getRunHistory() });
      return;
    }

    if (message.type === "CP_CLEAR_RUN_HISTORY") {
      await chrome.storage.local.set({
        cpAppliedHistory: [],
        cpFailedHistory: [],
        cpExternalHistory: [],
        cpSkippedHistory: []
      });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_SET_ERROR") {
      const state = await getState();
      const next = await setState({
        ...state,
        lastError: message.error || "Unknown error",
        running: false
      });
      await pushLog(`Error: ${next.lastError}`, "error");
      await appendRunHistory("FAILED", {
        reasonCode: "ENGINE_ERROR",
        reason: next.lastError
      });
      sendResponse({ ok: true, state: next });
      return;
    }

    if (message.type === "CP_SAVE_SETTINGS") {
      const next = await saveSettings(message.settings || {});
      sendResponse({ ok: true, settings: next });
      return;
    }

    if (message.type === "CP_LOAD_SETTINGS") {
      sendResponse({ ok: true, settings: await getSettings() });
      return;
    }

    if (message.type === "CP_CLEAR_LOGS") {
      const state = await getState();
      await setState({ ...state, logs: [], lastError: null });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "CP_GET_LOG_EXPORT") {
      const logsJson = await exportLogs();
      sendResponse({ ok: true, logsJson });
      return;
    }

    if (message.type === "CP_GET_PENDING_QUESTIONS") {
      const { cpPendingQuestions } = await chrome.storage.local.get("cpPendingQuestions");
      sendResponse({ ok: true, questions: Array.isArray(cpPendingQuestions) ? cpPendingQuestions : [] });
      return;
    }

    if (message.type === "CP_REGISTER_PENDING_QUESTIONS") {
      const incoming = Array.isArray(message.questions) ? message.questions : [];
      const { cpPendingQuestions } = await chrome.storage.local.get("cpPendingQuestions");
      const merged = Array.isArray(cpPendingQuestions) ? [...cpPendingQuestions] : [];
      for (const q of incoming) {
        const key = String(q.questionKey || "").trim();
        const label = String(q.questionLabel || "").trim();
        if (!key || !label) continue;
        if (!merged.find((m) => String(m.questionKey) === key)) {
          merged.push({
            questionKey: key,
            questionLabel: label,
            validationMessage: String(q.validationMessage || "").trim(),
            createdAt: nowIso()
          });
        }
      }
      await chrome.storage.local.set({ cpPendingQuestions: merged });
      sendResponse({ ok: true, questions: merged });
      return;
    }

    if (message.type === "CP_SAVE_QUESTION_ANSWER") {
      const questionKey = String(message.questionKey || "").trim();
      const questionLabel = String(message.questionLabel || "").trim();
      const answer = String(message.answer || "").trim();
      if (!questionKey || !answer) {
        sendResponse({ ok: false, error: "questionKey and answer are required" });
        return;
      }

      const settings = await getSettings();
      const nextSettings = {
        ...settings,
        screeningAnswers: {
          ...(settings.screeningAnswers || {}),
          [questionKey]: answer,
          ...(questionLabel ? { [questionLabel.toLowerCase()]: answer } : {})
        }
      };
      await chrome.storage.local.set({ cpSettings: nextSettings });

      const { cpPendingQuestions } = await chrome.storage.local.get("cpPendingQuestions");
      const nextQuestions = (Array.isArray(cpPendingQuestions) ? cpPendingQuestions : []).filter(
        (q) => String(q.questionKey || "") !== questionKey
      );
      await chrome.storage.local.set({ cpPendingQuestions: nextQuestions });

      const state = await getState();
      let nextState = state;
      if (nextSettings.autoResumeOnAnswer && nextQuestions.length === 0 && state.paused) {
        nextState = await setState({
          ...state,
          paused: false,
          running: true,
          startedAt: state.startedAt || nowIso(),
          lastError: null
        });
        await pushLog("Run auto-resumed after required answer saved", "info");
      }

      sendResponse({ ok: true, settings: nextSettings, questions: nextQuestions, state: nextState });
      return;
    }

    if (message.type === "CP_AI_ANSWER") {
      const settings = await getSettings();
      const screeningAnswer = resolveScreeningAnswer(settings.screeningAnswers || {}, message.question);
      if (screeningAnswer) {
        sendResponse({ ok: true, answer: screeningAnswer, source: "screening_answers" });
        return;
      }
      const path = String(settings.aiAnswerPath || "/ai/answer").trim() || "/ai/answer";
      const result = await postToApi(settings, path, {
        ts: nowIso(),
        question: String(message.question || "").trim(),
        questionType: String(message.questionType || "text").trim(),
        options: Array.isArray(message.options) ? message.options : [],
        validationMessage: String(message.validationMessage || "").trim(),
        jobContext: message.jobContext && typeof message.jobContext === "object" ? message.jobContext : {}
      });
      if (!result.ok) {
        sendResponse({ ok: false, error: result.error || "AI answer request failed" });
        return;
      }
      const body = result.body && typeof result.body === "object" ? result.body : {};
      const answer = String(body.answer ?? body.data?.answer ?? body.result?.answer ?? "").trim();
      if (!answer) {
        sendResponse({ ok: false, error: "AI response did not include answer" });
        return;
      }
      sendResponse({ ok: true, answer, raw: body });
      return;
    }

    if (message.type === "CP_LINKEDIN_STATUS") {
      const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
      const hasLinkedInTab = tabs.length > 0;
      const hasJobsTab = tabs.some((t) => String(t.url || "").includes("/jobs"));
      sendResponse({
        ok: true,
        data: {
          hasLinkedInTab,
          hasJobsTab
        }
      });
      return;
    }
  })().catch(async (error) => {
    await pushLog(error?.message || String(error), "error");
    sendResponse({ ok: false, error: error?.message || "Internal extension error" });
  });

  return true;
});
