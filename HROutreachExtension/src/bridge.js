// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — bridge.js
// Content script injected into the AutoApplyCV dashboard.
// Communication is entirely via postMessage (content scripts run in an
// isolated world in MV3, so window.__xxx is invisible to the page).
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  if (window.__hroBridgeInjected) return;
  window.__hroBridgeInjected = true;

  console.log('[HRO Bridge] bridge.js executing on', window.location.href);

  // ── Unique ID generator for request/response matching ────────────────────────

  let _rid = 0;
  function nextId() {
    return `hro_${Date.now()}_${++_rid}`;
  }

  // ── RPC: webapp sends a typed request → bridge forwards to background → posts response ──

  window.addEventListener('message', async (event) => {
    const msg = event.data;
    if (!msg || msg._src !== 'webapp' || !msg.type?.startsWith('HRO_')) return;
    if (msg.type === 'HRO_WEB_PING') {
      // Simple ping — respond immediately
      window.postMessage({ _src: 'hro_bridge', type: 'HRO_WEB_PONG', _id: msg._id }, '*');
      return;
    }

    const requestId = msg._id || nextId();
    console.log('[HRO Bridge] RPC request:', msg.type, requestId);

    try {
      const response = await chrome.runtime.sendMessage({
        type: msg.type,
        keyword: msg.keyword,
        enabled: msg.enabled,
        timeRange: msg.timeRange,
        _id: requestId,
      });
      console.log('[HRO Bridge] RPC response:', msg.type, requestId, response);
      window.postMessage({
        _src: 'hro_bridge',
        type: 'HRO_RES',
        _id: requestId,
        action: msg.type,
        data: response,
      }, '*');
    } catch (err) {
      console.error('[HRO Bridge] RPC error:', msg.type, requestId, err.message);
      // Extension context invalidated — extension was reloaded/reinstalled.
      // Reset guard so this bridge can be re-injected by Chrome.
      if (err.message?.includes('Extension context invalidated')) {
        console.warn('[HRO Bridge] Context invalidated — resetting for re-injection');
        window.__hroBridgeInjected = false;
        window.postMessage({ _src: 'hro_bridge', type: 'HRO_BRIDGE_DISCONNECTED' }, '*');
      }
      window.postMessage({
        _src: 'hro_bridge',
        type: 'HRO_RES',
        _id: requestId,
        action: msg.type,
        error: err.message,
      }, '*');
    }
  });

  // ── Background → webapp (push notifications) ────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg._src === 'background') {
      window.postMessage(msg, '*');
      sendResponse({ ok: true });
    }
    return false;
  });

  // ── Announce bridge ready ────────────────────────────────────────────────────

  window.postMessage({ _src: 'hro_bridge', type: 'HRO_BRIDGE_READY' }, '*');
  console.log('[HRO Bridge] Posted HRO_BRIDGE_READY');

  try {
    chrome.runtime.sendMessage({
      type: 'HRO_BRIDGE_READY',
      origin: window.location.origin,
    }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // ignore
  }

  // ── Keep service worker alive with periodic heartbeat ─────────────────────────
  // MV3 service workers terminate after ~30s idle. Ping every 25s.

  setInterval(() => {
    try {
      chrome.runtime.sendMessage({ type: 'HRO_HEARTBEAT' }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // context invalidated — extension was reloaded, stop heartbeat
    }
  }, 25000);
})();
