// Content script — runs only on the dashboard origins (localhost:3000,
// autoapplycv.in). While the user is logged in, it swaps the httpOnly session
// cookie (which the popup can't read) for a short-lived Bearer access token
// that the popup CAN use cross-origin.

const ORIGIN = window.location.origin;
const ASSIST_ORIGINS = ["http://localhost:3000", "https://autoapplycv.in"];
const GRAB_INTERVAL_MS = 5 * 60 * 1000;

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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CP_ASSIST_GRAB_TOKEN") {
    grabToken().finally(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});

grabToken();
setInterval(grabToken, GRAB_INTERVAL_MS);
