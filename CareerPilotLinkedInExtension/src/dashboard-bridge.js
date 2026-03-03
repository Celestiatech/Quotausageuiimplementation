function safePost(message) {
  window.postMessage(message, window.location.origin);
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_PING") return;

  const requestId = data.requestId || "";
  const response = {
    type: "CP_WEB_PONG",
    requestId,
    installed: true,
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
    screeningAnswers: {},
    error: null
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
    } else if (bootstrap && bootstrap.error) {
      response.error = bootstrap.error;
    }
  } catch (error) {
    response.error = String(error?.message || error);
  }

  try {
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
  } catch {
    // ignore
  }

  try {
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

  safePost(response);
});

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_SAVE_ANSWER") return;
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
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "CP_WEB_SYNC_SETTINGS") return;
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
