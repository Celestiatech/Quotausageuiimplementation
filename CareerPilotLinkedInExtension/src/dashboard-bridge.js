const BRIDGE_VERSION = "2026.03.03";
const BRIDGE_DEBUG = (() => {
  try {
    return localStorage.getItem("cpBridgeDebug") === "1";
  } catch {
    return false;
  }
})();

function isAllowedDashboardOrigin(origin) {
  const allowlist = new Set([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1",
    "https://127.0.0.1",
  ]);
  if (allowlist.has(String(origin || ""))) return true;
  try {
    const hostname = new URL(String(origin || "")).hostname.toLowerCase();
    return hostname === "careerpilot.ai" || hostname.endsWith(".careerpilot.ai");
  } catch {
    return false;
  }
}

const BRIDGE_ENABLED = isAllowedDashboardOrigin(window.location.origin);

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
    console.debug("[CareerPilotBridge]", ...args);
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

if (BRIDGE_ENABLED) {
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

if (BRIDGE_ENABLED) window.addEventListener("message", async (event) => {
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

if (BRIDGE_ENABLED) window.addEventListener("message", async (event) => {
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

if (BRIDGE_ENABLED) window.addEventListener("message", async (event) => {
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
