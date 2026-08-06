// Background service worker.
// Receives short-lived access tokens grabbed by the content script while the
// user is logged into the dashboard, and stores them for the popup to use.

const ORIGINS = ["http://localhost:3000", "https://autoapplycv.in"];
const TOKEN_REFRESH_MS = 10 * 60 * 1000; // tokens last 15 min, refresh at 10

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CP_ASSIST_TOKEN") {
    const origin = String(msg.origin || "");
    if (ORIGINS.includes(origin) && msg.token) {
      chrome.storage.local.set({
        assistToken: String(msg.token),
        assistTokenAt: Date.now(),
        assistOrigin: origin,
      });
      sendResponse({ ok: true });
      return false;
    }
  }
  if (msg && msg.type === "CP_ASSIST_TOKEN_REFRESH") {
    const origin = String(msg.origin || "");
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith(origin) && tab.id != null) {
          // Re-announce so the content script re-grabs a fresh token.
          chrome.tabs.sendMessage(tab.id, { type: "CP_ASSIST_GRAB_TOKEN" }).catch(() => {});
        }
      }
    });
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

// Periodically poke any open dashboard tab to refresh the token so the popup
// stays usable even when the dashboard tab is in the background.
setInterval(() => {
  chrome.storage.local.get("assistOrigin", ({ assistOrigin }) => {
    if (!assistOrigin) return;
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.url && tab.url.startsWith(assistOrigin) && tab.id != null) {
          chrome.tabs.sendMessage(tab.id, { type: "CP_ASSIST_GRAB_TOKEN" }).catch(() => {});
        }
      }
    });
  });
}, TOKEN_REFRESH_MS);
