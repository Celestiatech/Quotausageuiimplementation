const BRIDGE_VERSION = "2026.03.03";
const EXTENSION_PROVIDER = "linkedin";
const PLATFORM_STATUS_MESSAGE = "CP_LINKEDIN_STATUS";
const PLATFORM_STATUS_KEY = "linkedIn";
const BRIDGE_DEBUG = true;

const DEFAULT_ALLOWLIST = [
  "https://autoapplycv.in",
  "https://www.autoapplycv.in",
  "https://autoapplycv.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
];

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin.toLowerCase();
  } catch {
    return "";
  }
}

function isAllowedDashboardOrigin(origin, allowlist) {
  const set = new Set((Array.isArray(allowlist) ? allowlist : []).map((item) => normalizeOrigin(item)).filter(Boolean));
  if (set.has(normalizeOrigin(origin))) return true;
  try {
    const hostname = new URL(String(origin || "")).hostname.toLowerCase();
    return (
      hostname === "autoapplycv.in" ||
      hostname.endsWith(".autoapplycv.in") ||
      hostname === "autoapplycv.vercel.app"
    );
  } catch {
    return false;
  }
}

let dynamicAllowlist = [...DEFAULT_ALLOWLIST];
let BRIDGE_ENABLED = isAllowedDashboardOrigin(window.location.origin, dynamicAllowlist);
console.log('[CP Bridge] BRIDGE_ENABLED =', BRIDGE_ENABLED, '| origin =', window.location.origin);
let bridgeHeartbeatTimer = null;

function nowIso() {
  return new Date().toISOString();
}

function bridgeMeta() {
  return {
    provider: EXTENSION_PROVIDER,
    version: BRIDGE_VERSION,
    pageUrl: window.location.href,
    origin: window.location.origin,
  };
}

function logBridge(...args) {
  if (!BRIDGE_DEBUG) return;
  try {
    console.debug("[AutoApplyCVBridge]", ...args);
  } catch {
    // ignore
  }
}

function safePost(message) {
  if (!BRIDGE_ENABLED) return;
  try {
    window.postMessage(message, window.location.origin);
  } catch (error) {
    logBridge("postMessage failed", String(error?.message || error));
  }
}

function isRuntimeContextValid() {
  try {
    return Boolean(chrome?.runtime?.id) && !chrome.runtime.lastError;
  } catch {
    return false;
  }
}

function getRuntimeMeta() {
  if (!isRuntimeContextValid()) return { runtimeId: "", extensionVersion: "" };
  try {
    return {
      runtimeId: chrome?.runtime?.id || "",
      extensionVersion: chrome?.runtime?.getManifest?.()?.version || "",
    };
  } catch {
    return { runtimeId: "", extensionVersion: "" };
  }
}

function runtimeSendMessage(message) {
  return new Promise((resolve) => {
    let error = null;
    try {
      chrome.runtime.sendMessage(message, (res) => {
        let lastError = null;
        try {
          lastError = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
        } catch {
          lastError = "Extension context invalidated";
        }
        if (lastError) {
          resolve({ ok: false, error: lastError });
          return;
        }
        resolve(res || { ok: false });
      });
    } catch (caught) {
      error = String(caught?.message || caught) || "Extension context invalidated";
    }
    if (error) {
      resolve({ ok: false, error });
    }
  });
}

function markDomBridgeReady() {
  if (!BRIDGE_ENABLED) return;
  try {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute("data-cp-bridge-ready", "1");
    root.setAttribute("data-cp-bridge-version", BRIDGE_VERSION);
    root.setAttribute("data-cp-bridge-runtime-id", getRuntimeMeta().runtimeId);
    root.setAttribute("data-cp-bridge-ts", nowIso());
  } catch (error) {
    logBridge("failed to mark dom bridge ready", String(error?.message || error));
  }
}

function announceBridgeReady() {
  if (!BRIDGE_ENABLED) return;
  markDomBridgeReady();
  safePost({
    type: "CP_WEB_BRIDGE_READY",
    provider: EXTENSION_PROVIDER,
    installed: true,
    runtimeId: getRuntimeMeta().runtimeId,
    bridge: bridgeMeta(),
    ts: nowIso(),
  });
  logBridge("bridge ready", bridgeMeta(), "runtimeId=", getRuntimeMeta().runtimeId);
}

function ensureBridgeHeartbeat() {
  if (!BRIDGE_ENABLED) return;
  if (bridgeHeartbeatTimer) return;
  bridgeHeartbeatTimer = window.setInterval(() => {
    if (!BRIDGE_ENABLED) return;
    markDomBridgeReady();
    safePost({
      type: "CP_WEB_BRIDGE_HEARTBEAT",
      provider: EXTENSION_PROVIDER,
      installed: true,
      runtimeId: getRuntimeMeta().runtimeId,
      bridge: bridgeMeta(),
      ts: nowIso(),
    });
    void pushQuotaToExtension();
  }, 10000);
}

async function hydrateDynamicAllowlist() {
  try {
    const res = await fetch(`${window.location.origin}/api/public/extension-config`, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return;
    const data = await res.json();
    const incoming = Array.isArray(data?.data?.allowedDashboardOrigins)
      ? data.data.allowedDashboardOrigins.map((item) => String(item || ""))
      : [];
    if (!incoming.length) return;
    dynamicAllowlist = Array.from(new Set([...DEFAULT_ALLOWLIST, ...incoming.map((item) => normalizeOrigin(item)).filter(Boolean)]));
    const wasEnabled = BRIDGE_ENABLED;
    BRIDGE_ENABLED = isAllowedDashboardOrigin(window.location.origin, dynamicAllowlist);
    if (!wasEnabled && BRIDGE_ENABLED) {
      announceBridgeReady();
      ensureBridgeHeartbeat();
    }
  } catch (error) {
    logBridge("failed to hydrate extension config", String(error?.message || error));
  }
}

let lastQuotaFetchAt = 0;
let cachedQuota = null;

async function fetchPortalQuota() {
  const now = Date.now();
  if (now - lastQuotaFetchAt < 5000 && cachedQuota) return cachedQuota;
  lastQuotaFetchAt = now;
  try {
    const res = await fetch(`${window.location.origin}/api/user/quota`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) return cachedQuota;
    cachedQuota = body.data || null;
    return cachedQuota;
  } catch {
    return cachedQuota;
  }
}

async function pushQuotaToExtension() {
  if (!BRIDGE_ENABLED) return;
  if (!isRuntimeContextValid()) return;
  const quota = await fetchPortalQuota();
  if (!quota) return;
  void runtimeSendMessage({ type: "CP_SET_PORTAL_QUOTA", data: { ...quota, _origin: window.location.origin } });
}

if (BRIDGE_ENABLED) {
  announceBridgeReady();
  ensureBridgeHeartbeat();
}

// Allow the extension service worker to notify the dashboard tab that it just synced/charged.
try {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return;
    console.log('[CP Bridge] onMessage:', message.type, message);
    if (message.type === "CP_PORTAL_SYNCED") {
      console.log('[CP Bridge] CP_PORTAL_SYNCED:', message);
      try {
        // Trigger React listeners (DashboardLayout listens for this to refresh the user wallet immediately).
        window.dispatchEvent(new CustomEvent("cp:extensionImported", { detail: message }));
      } catch {
        // ignore
      }
      safePost({
        type: "CP_WEB_PORTAL_SYNCED",
        imported: Number(message.imported || 0),
        ts: message.ts || nowIso(),
        chargedJobs: Number(message.chargedJobs || 0),
        consumedTotal: Number(message.consumedTotal || 0),
        freeConsumed: Number(message.freeConsumed || 0),
        paidConsumed: Number(message.paidConsumed || 0),
        chargeFailures: Number(message.chargeFailures || 0),
        lastChargedJobId: String(message.lastChargedJobId || ""),
        bridge: bridgeMeta(),
      });
      return;
    }
    if (message.type === "CP_WEB_IMPORT_OUTCOMES") {
      console.log('[CP Bridge] CP_WEB_IMPORT_OUTCOMES received, entries:', message.entries?.length || 0);
      (async () => {
        try {
          const entries = Array.isArray(message.entries) ? message.entries : [];
          if (!entries.length) {
            console.log('[CP Bridge] No entries to import');
            sendResponse({ attempted: true, status: 400, body: { success: false, message: "No entries to import" } });
            return;
          }
          console.log('[CP Bridge] Importing entries:', JSON.stringify(entries.slice(0, 3)), '... total:', entries.length);
          const res = await fetch(`${window.location.origin}/api/extension/import`, {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entries }),
          });
          const body = await res.json().catch(() => null);
          console.log('[CP Bridge] Import response:', res.status, body);
          if (res.ok && body?.success) {
            try {
              window.dispatchEvent(new Event("cp:extensionImported"));
            } catch {
              // ignore
            }
          }
          sendResponse({ attempted: true, status: res.status, body });
        } catch (error) {
          console.error('[CP Bridge] Import failed:', error);
          sendResponse({
            attempted: true,
            status: 0,
            body: { success: false, message: String(error?.message || error || "Import failed") },
          });
        }
      })();
      return true;
    }
  });
} catch {
  // ignore
}

void hydrateDynamicAllowlist();
window.addEventListener("message", async (event) => {
  if (!BRIDGE_ENABLED) return;
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_PING") return;
  logBridge("received CP_WEB_PING", { requestId: data.requestId || "" });

  const requestId = data.requestId || "";
  const defaultPlatformStatus = {
    hasLinkedInTab: false,
    hasJobsTab: false,
  };

  const runtimeAvailable = isRuntimeContextValid();
  const runtimeError = runtimeAvailable ? null : "Extension context invalidated";

  const response = {
    type: "CP_WEB_PONG",
    provider: EXTENSION_PROVIDER,
    requestId,
    installed: runtimeAvailable,
    runtimeId: runtimeAvailable ? getRuntimeMeta().runtimeId : "",
    extensionVersion: runtimeAvailable ? getRuntimeMeta().extensionVersion : "",
    state: null,
    dailyCap: null,
    historySummary: null,
    currentRunSummary: null,
    linkedIn: defaultPlatformStatus,
    pendingQuestions: [],
    history: {
      applied: [],
      failed: [],
      external: [],
      skipped: [],
    },
    runtimeBootstrapOk: false,
    screeningAnswers: {},
    error: runtimeError,
    bridge: {
      ...bridgeMeta(),
      ts: nowIso(),
    },
  };

  if (!runtimeAvailable) {
    safePost(response);
    return;
  }

  try {
    const bootstrap = await runtimeSendMessage({ type: "CP_GET_BOOTSTRAP" });
    if (bootstrap && bootstrap.ok) {
      response.state = bootstrap.state || null;
      response.dailyCap = bootstrap.dailyCap || null;
      response.historySummary = bootstrap.historySummary || null;
      response.currentRunSummary = bootstrap.currentRunSummary || null;
      response.portalQuota = bootstrap.portalQuota || null;
      response.installed = true;
      response.runtimeBootstrapOk = true;
    } else if (bootstrap && bootstrap.error) {
      response.error = bootstrap.error;
      response.installed = false;
      response.runtimeBootstrapOk = false;
    }
  } catch (error) {
    response.error = String(error?.message || error);
    response.installed = false;
    response.runtimeBootstrapOk = false;
  }

  try {
    if (!response.installed) {
      logBridge("runtime unavailable for CP_WEB_PONG", { requestId, error: response.error || "" });
    }
    if (response.installed) {
      // Best-effort update of portal quota cache inside the extension.
      await pushQuotaToExtension();
      const pending = await runtimeSendMessage({ type: "CP_GET_PENDING_QUESTIONS" });
      if (pending && pending.ok) {
        response.pendingQuestions = Array.isArray(pending.questions) ? pending.questions : [];
      }

      const settingsRes = await runtimeSendMessage({ type: "CP_LOAD_SETTINGS" });
      if (settingsRes && settingsRes.ok) {
        response.screeningAnswers = settingsRes.settings?.screeningAnswers || {};
      }

      const historyRes = await runtimeSendMessage({ type: "CP_GET_RUN_HISTORY" });
      if (historyRes && historyRes.ok) {
        response.history = historyRes.history || response.history;
      }
    }
  } catch {
    // ignore
  }

  try {
    if (!response.installed) {
      safePost(response);
      return;
    }
    const linkedInStatus = await runtimeSendMessage({ type: PLATFORM_STATUS_MESSAGE });
    if (linkedInStatus && linkedInStatus.ok) {
      response[PLATFORM_STATUS_KEY] = linkedInStatus.data || response[PLATFORM_STATUS_KEY];
    }
  } catch {
    // Ignore linkedIn tab status failures.
  }

  logBridge("sending CP_WEB_PONG", {
    requestId,
    installed: response.installed,
    runtimeBootstrapOk: response.runtimeBootstrapOk,
    runtimeId: response.runtimeId,
    extensionVersion: response.extensionVersion,
    linkedIn: response.linkedIn,
    error: response.error,
  });
  safePost(response);
});

window.addEventListener("message", async (event) => {
  if (!BRIDGE_ENABLED) return;
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_SAVE_ANSWER") return;
  logBridge("received CP_WEB_SAVE_ANSWER", {
    requestId: data.requestId || "",
    questionKey: data.questionKey || "",
  });
  const requestId = data.requestId || "";

  try {
    const saved = await runtimeSendMessage({
      type: "CP_SAVE_QUESTION_ANSWER",
      questionKey: data.questionKey,
      questionLabel: data.questionLabel,
      answer: data.answer,
    });
    safePost({
      type: "CP_WEB_SAVE_ANSWER_ACK",
      requestId,
      ok: Boolean(saved && saved.ok),
      data: saved,
      error: saved?.error || null,
    });
  } catch (error) {
    safePost({
      type: "CP_WEB_SAVE_ANSWER_ACK",
      requestId,
      ok: false,
      error: String(error?.message || error),
    });
  }
});

window.addEventListener("message", async (event) => {
  if (!BRIDGE_ENABLED) return;
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_SYNC_SETTINGS") return;
  logBridge("received CP_WEB_SYNC_SETTINGS", { requestId: data.requestId || "" });
  const requestId = data.requestId || "";
  try {
    const incoming = data.settings && typeof data.settings === "object" ? data.settings : {};
    const loaded = await runtimeSendMessage({ type: "CP_LOAD_SETTINGS" });
    if (!loaded || !loaded.ok) {
      safePost({
        type: "CP_WEB_SYNC_SETTINGS_ACK",
        requestId,
        ok: false,
        error: loaded?.error || "Failed to load extension settings",
      });
      return;
    }

    const merged = {
      ...(loaded.settings || {}),
      ...incoming,
      screeningAnswers: {
        ...(loaded.settings?.screeningAnswers || {}),
        ...(incoming.screeningAnswers || {}),
      },
    };
    const saved = await runtimeSendMessage({ type: "CP_SAVE_SETTINGS", settings: merged });
    safePost({
      type: "CP_WEB_SYNC_SETTINGS_ACK",
      requestId,
      ok: Boolean(saved && saved.ok),
      data: saved,
      error: saved?.error || null,
    });
  } catch (error) {
    safePost({
      type: "CP_WEB_SYNC_SETTINGS_ACK",
      requestId,
      ok: false,
      error: String(error?.message || error),
    });
  }
});
