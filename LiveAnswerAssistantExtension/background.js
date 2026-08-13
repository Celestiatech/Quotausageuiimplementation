// Background service worker.
// Receives short-lived access tokens grabbed by the content script while the
// user is logged into the dashboard, and stores them for the popup to use.
// Also manages the floating listener window (opened via the popup or hotkey),
// places it top-right, remembers its position, and forwards hotkey toggles.

const ORIGINS = ["http://localhost:3000", "https://autoapplycv.in"];
const TOKEN_REFRESH_MS = 10 * 60 * 1000; // tokens last 15 min, refresh at 10
const WINDOW_W = 400;
const WINDOW_H = 620;

const DBG = true;
function dbg(...args) {
  if (DBG) console.log("[LiveAnswerBG]", ...args);
}

let listenerWindowId = null;

async function getListenerPos() {
  const { listenerPos } = await chrome.storage.local.get("listenerPos");
  return listenerPos && typeof listenerPos.left === "number" && typeof listenerPos.top === "number"
    ? listenerPos
    : null;
}

async function saveListenerPos(left, top) {
  await chrome.storage.local.set({ listenerPos: { left, top } });
}

async function topRightPos() {
  try {
    const displays = await chrome.system.display.getPrimaryDisplay();
    const area = displays.workArea;
    return { left: area.left + area.width - WINDOW_W - 16, top: area.top + 12 };
  } catch (err) {
    dbg("topRightPos error:", err);
    return null;
  }
}

async function openListenerWindow() {
  if (listenerWindowId != null) {
    try {
      const existing = await chrome.windows.get(listenerWindowId);
      await chrome.windows.update(existing.id, { focused: true });
      dbg("listener window already open:", existing.id);
      return existing.id;
    } catch {
      listenerWindowId = null; // window closed
    }
  }
  const saved = await getListenerPos();
  let left = saved ? saved.left : null;
  let top = saved ? saved.top : null;
  if (left == null || top == null) {
    const tr = await topRightPos();
    if (tr) {
      left = tr.left;
      top = tr.top;
    }
  }
  const createArgs = {
    url: "listen.html",
    type: "popup",
    width: WINDOW_W,
    height: WINDOW_H,
    focused: true,
  };
  if (left != null && top != null) {
    createArgs.left = left;
    createArgs.top = top;
  }
  dbg("creating listener window", createArgs);
  const win = await chrome.windows.create(createArgs);
  listenerWindowId = win.id;
  dbg("listener window created:", win.id);
  return win.id;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CP_ASSIST_OPEN_LISTENER") {
    openListenerWindow()
      .then((id) => sendResponse({ ok: true, windowId: id }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (msg && msg.type === "CP_ASSIST_MOVE_WINDOW") {
    const left = Number(msg.left);
    const top = Number(msg.top);
    if (listenerWindowId != null && Number.isFinite(left) && Number.isFinite(top)) {
      chrome.windows
        .update(listenerWindowId, { left, top })
        .then(() => saveListenerPos(Math.round(left), Math.round(top)))
        .catch(() => {});
    }
    sendResponse({ ok: true });
    return false;
  }
  if (msg && msg.type === "CP_ASSIST_TOGGLE_LISTEN") {
    // Broadcast to extension pages (the listen window) — not content scripts.
    chrome.runtime.sendMessage({ type: "CP_ASSIST_TOGGLE_LISTEN" }).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }
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

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === listenerWindowId) listenerWindowId = null;
  dbg("window removed:", windowId);
});

// Ctrl+Shift+L opens/focuses the floating listener window.
// Ctrl+Shift+Space toggles listening.
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-listener") {
    openListenerWindow().catch(() => {});
  } else if (command === "toggle-listen") {
    chrome.runtime.sendMessage({ type: "CP_ASSIST_TOGGLE_LISTEN" }).catch(() => {});
  }
});

// Always open: open the listener window on browser start and after install.
chrome.runtime.onStartup.addListener(() => {
  dbg("browser startup — auto-opening listener");
  openListenerWindow().catch((err) => dbg("auto-open startup error:", err));
});
chrome.runtime.onInstalled.addListener(() => {
  dbg("extension installed/updated — auto-opening listener");
  openListenerWindow().catch((err) => dbg("auto-open install error:", err));
});

// Keep-alive: if the listener window was closed and autoOpen is enabled,
// reopen it every few seconds so it is effectively always available.
const KEEPALIVE_MS = 5000;
setInterval(() => {
  chrome.storage.local.get("autoOpenListener", ({ autoOpenListener }) => {
    if (autoOpenListener === false) return;
    if (listenerWindowId != null) {
      chrome.windows
        .get(listenerWindowId)
        .catch(() => {
          listenerWindowId = null;
          dbg("keep-alive: window gone, reopening");
          openListenerWindow().catch(() => {});
        });
      return;
    }
    dbg("keep-alive: reopening listener");
    openListenerWindow().catch(() => {});
  });
}, KEEPALIVE_MS);

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
