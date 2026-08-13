// Content script — runs only on the dashboard origins (localhost:3000,
// autoapplycv.in). While the user is logged in, it swaps the httpOnly session
// cookie (which the popup can't read) for a short-lived Bearer access token
// that the popup CAN use cross-origin. It answers a web ping so the dashboard
// page can detect whether the extension is installed, and relays questions
// from the extension popup into the Client Assistant page and back.

const ORIGIN = window.location.origin;
const ASSIST_ORIGINS = ["http://localhost:3000", "https://autoapplycv.in"];
const GRAB_INTERVAL_MS = 5 * 60 * 1000;

const EXT_SOURCE = "CP_ASSIST_EXT";
const PAGE_SOURCE = "CP_ASSIST_PAGE";
const ANSWER_TIMEOUT_MS = 90 * 1000;

async function grabToken() {
  if (!ASSIST_ORIGINS.includes(ORIGIN)) return;
  try {
    const res = await fetch(`${ORIGIN}/api/extension/token`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = await res.json();
    const token = data && data.data && data.data.token;
    if (token) {
      chrome.runtime.sendMessage({
        type: "CP_ASSIST_TOKEN",
        token,
        origin: ORIGIN,
      }).catch(() => {});
    }
  } catch (err) {
    // Network / offline — silently ignore.
  }
}

// Respond to the dashboard page so it knows the extension is installed.
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.source !== PAGE_SOURCE || data.type !== "CP_ASSIST_PING") return;
  window.postMessage(
    {
      source: EXT_SOURCE,
      type: "CP_ASSIST_PONG",
      version: chrome.runtime.getManifest().version || "",
    },
    "*",
  );
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CP_ASSIST_GRAB_TOKEN") {
    grabToken().finally(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg && msg.type === "CP_ASSIST_ASK_PAGE") {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const question = String(msg.question || "").trim();

    if (!question) {
      sendResponse({ ok: false, error: "Question is empty." });
      return false;
    }

    const respond = (payload) => {
      window.removeEventListener("message", onPageMessage);
      sendResponse(payload);
    };

    const onPageMessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== PAGE_SOURCE || data.type !== "CP_ASSIST_ANSWER") return;
      if (String(data.requestId || "") !== requestId) return;
      respond({
        ok: true,
        draft: data.draft || null,
        provider: data.provider || null,
        model: data.model || null,
      });
    };

    window.addEventListener("message", onPageMessage);

    window.postMessage(
      {
        source: EXT_SOURCE,
        type: "CP_ASSIST_QUESTION",
        requestId,
        question,
        tone: msg.tone || "concise",
      },
      "*",
    );

    setTimeout(() => {
      respond({ ok: false, error: "Timed out waiting for the dashboard. Is the Client Assistant page open?" });
    }, ANSWER_TIMEOUT_MS);

    return true;
  }
  return false;
});

grabToken();
setInterval(grabToken, GRAB_INTERVAL_MS);
