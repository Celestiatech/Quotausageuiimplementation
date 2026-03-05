const BRIDGE_VERSION = "2026.03.03";
const BRIDGE_DEBUG = (() => {
  try {
    return localStorage.getItem("cpBridgeDebug") === "1";
  } catch {
    return false;
  }
})();

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

function nowIso() {
  return new Date().toISOString();
}

function bridgeMeta() {
  return {
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

function markDomBridgeReady() {
  if (!BRIDGE_ENABLED) return;
  try {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute("data-cp-bridge-ready", "1");
    root.setAttribute("data-cp-bridge-version", BRIDGE_VERSION);
    root.setAttribute("data-cp-bridge-runtime-id", chrome?.runtime?.id || "");
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
    installed: true,
    runtimeId: chrome?.runtime?.id || "",
    bridge: bridgeMeta(),
    ts: nowIso(),
  });
  logBridge("bridge ready", bridgeMeta(), "runtimeId=", chrome?.runtime?.id || "");
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
  const quota = await fetchPortalQuota();
  if (!quota) return;
  try {
    chrome.runtime.sendMessage(
      { type: "CP_SET_PORTAL_QUOTA", data: { ...quota, _origin: window.location.origin } },
      () => void 0,
    );
  } catch {
    // ignore
  }
}

if (BRIDGE_ENABLED) {
  announceBridgeReady();
  // Keep portal quota reasonably fresh for LinkedIn tabs.
  window.setInterval(() => void pushQuotaToExtension(), 8000);
}

// Allow the extension service worker to notify the dashboard tab that it just synced/charged.
try {
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "CP_PORTAL_SYNCED") return;
    try {
      // Trigger React listeners (DashboardLayout listens for this to refresh the user wallet immediately).
      window.dispatchEvent(new Event("cp:extensionImported"));
    } catch {
      // ignore
    }
    safePost({
      type: "CP_WEB_PORTAL_SYNCED",
      imported: Number(message.imported || 0),
      ts: message.ts || nowIso(),
      bridge: bridgeMeta(),
    });
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
  const response = {
    type: "CP_WEB_PONG",
    requestId,
    installed: false,
    runtimeId: chrome?.runtime?.id || "",
    state: null,
    dailyCap: null,
    linkedIn: {
      hasLinkedInTab: false,
      hasJobsTab: false
    },
    pendingQuestions: [],
    history: {
      applied: [],
      failed: [],
      external: [],
      skipped: [],
    },
    runtimeBootstrapOk: false,
    screeningAnswers: {},
    error: null,
    bridge: {
      ...bridgeMeta(),
      ts: nowIso(),
    },
  };

  try {
    const bootstrap = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_GET_BOOTSTRAP" }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    });
    if (bootstrap && bootstrap.ok) {
      response.state = bootstrap.state || null;
      response.dailyCap = bootstrap.dailyCap || null;
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
      const pending = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_GET_PENDING_QUESTIONS" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false });
            return;
          }
          resolve(res || { ok: false });
        });
      });
      if (pending && pending.ok) {
        response.pendingQuestions = Array.isArray(pending.questions) ? pending.questions : [];
      }

      const settingsRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_LOAD_SETTINGS" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false });
            return;
          }
          resolve(res || { ok: false });
        });
      });
      if (settingsRes && settingsRes.ok) {
        response.screeningAnswers = settingsRes.settings?.screeningAnswers || {};
      }

      const historyRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_GET_RUN_HISTORY" }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false });
            return;
          }
          resolve(res || { ok: false });
        });
      });
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
    const linkedInStatus = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_LINKEDIN_STATUS" }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false });
          return;
        }
        resolve(res || { ok: false });
      });
    });
    if (linkedInStatus && linkedInStatus.ok) {
      response.linkedIn = linkedInStatus.data || response.linkedIn;
    }
  } catch {
    // Ignore linkedIn tab status failures.
  }

  logBridge("sending CP_WEB_PONG", {
    requestId,
    installed: response.installed,
    runtimeBootstrapOk: response.runtimeBootstrapOk,
    runtimeId: response.runtimeId,
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
    const saved = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "CP_SAVE_QUESTION_ANSWER",
          questionKey: data.questionKey,
          questionLabel: data.questionLabel,
          answer: data.answer,
        },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res || { ok: false });
        },
      );
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
    const loaded = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_LOAD_SETTINGS" }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    });
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
    const saved = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CP_SAVE_SETTINGS", settings: merged }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(res || { ok: false });
      });
    });
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
