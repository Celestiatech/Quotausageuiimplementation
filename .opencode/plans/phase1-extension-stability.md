# Phase 1: Extension Stability Fixes

## Context
Scaling from 100 to 500 users. Biggest pain point: extension crashes/errors.
These 8 fixes address the most critical crash-prone areas in the CareerPilotLinkedInExtension.

## Fix 1.1: Automation Loop Guard Overflow
**File:** `CareerPilotLinkedInExtension/src/content.js:6666`
**Problem:** `while (guard < 200)` exits without sending `CP_STOP`, leaving background stuck in `running: true` forever.

```javascript
// BEFORE (line 6666):
      await sleep(1200);
    }
  } catch (error) {

// AFTER:
      await sleep(1200);
    }
    if (guard >= 200) {
      await logLine("Safety guard limit reached. Stopping run.", "warn");
      await sendMessage({ type: "CP_STOP" });
    }
  } catch (error) {
```

## Fix 1.2: Context Invalidation Recovery
**File:** `CareerPilotLinkedInExtension/src/content.js:6708-6730`
**Problem:** When extension reloads, content script detects invalidation but has no recovery — panel freezes.

```javascript
// BEFORE (line 6708-6730):
if (!window.__CP_COPILOT_ACTIVE__) {
  window.__CP_COPILOT_ACTIVE__ = true;
  ensurePanel();
  window.addEventListener("resize", () => {
    applyPanelLayout();
    logPanelDebug("window-resize");
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "c") {
      panelPrefs.left = Math.max(8, window.innerWidth - 440);
      panelPrefs.top = 84;
      panelPrefs.minimized = false;
      panelPrefs.maximized = false;
      savePanelPrefs();
      applyPanelLayout();
      logPanelDebug("hotkey-reset");
    }
  });
  startStatePolling().catch(() => null);
} else {
  ensurePanel();
  logPanelDebug("reused-script-instance");
}

// AFTER:
if (!window.__CP_COPILOT_ACTIVE__) {
  window.__CP_COPILOT_ACTIVE__ = true;
  ensurePanel();
  window.addEventListener("resize", () => {
    applyPanelLayout();
    logPanelDebug("window-resize");
  });
  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "c") {
      panelPrefs.left = Math.max(8, window.innerWidth - 440);
      panelPrefs.top = 84;
      panelPrefs.minimized = false;
      panelPrefs.maximized = false;
      savePanelPrefs();
      applyPanelLayout();
      logPanelDebug("hotkey-reset");
    }
  });
  startStatePolling().catch(() => null);
} else {
  ensurePanel();
  if (!extensionContextAlive) {
    extensionContextAlive = true;
    logPanelDebug("context-reconnected");
    startStatePolling().catch(() => null);
  } else {
    logPanelDebug("reused-script-instance");
  }
}
```

## Fix 1.3: PanelEl Staleness After SPA Navigation
**File:** `CareerPilotLinkedInExtension/src/content.js`
**Problem:** `panelEl` becomes a detached node after LinkedIn SPA re-render. All `panelEl.querySelector()` calls silently fail.

Add helper near line 3328 (before `ensurePanel`):
```javascript
function ensurePanelConnected() {
  if (!panelEl) {
    panelEl = document.getElementById(PANEL_ID);
  }
  if (panelEl && !panelEl.isConnected) {
    panelEl = document.getElementById(PANEL_ID);
  }
  return panelEl;
}
```

Then at line 3679-3680, replace:
```javascript
// BEFORE:
function renderState(state) {
  if (!panelEl) return;

// AFTER:
function renderState(state) {
  ensurePanelConnected();
  if (!panelEl) return;
```

## Fix 1.4: document.body Null Check
**File:** `CareerPilotLinkedInExtension/src/content.js:3372, 3422`
**Problem:** `document.body.appendChild()` throws if body doesn't exist yet.

```javascript
// BEFORE (line 3372):
  document.body.appendChild(toggle);

// AFTER:
  (document.body || document.documentElement).appendChild(toggle);
```

```javascript
// BEFORE (line 3422):
  document.body.appendChild(panel);

// AFTER:
  (document.body || document.documentElement).appendChild(panel);
```

## Fix 1.5: Fix sendMessage in popup.js/options.js
**Files:** `popup.js:1-5`, `options.js:1-5`
**Problem:** No `chrome.runtime.lastError` check — user sees no error when extension is broken.

```javascript
// BEFORE (popup.js line 1-5):
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => resolve(res || { ok: false }));
  });
}

// AFTER:
function sendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          resolve({ ok: false, error: err.message || "Extension unavailable" });
          return;
        }
        resolve(res || { ok: false });
      });
    } catch (e) {
      resolve({ ok: false, error: e?.message || "Extension unavailable" });
    }
  });
}
```

Same pattern for `options.js:1-5`.

## Fix 1.6: Service Worker Timer Survival
**File:** `CareerPilotLinkedInExtension/src/background.js:443-460`
**Problem:** `setInterval` killed when service worker terminates. No restart mechanism.

```javascript
// BEFORE (line 443-460):
let portalAnswerPollTimer = null;
function ensurePortalAnswerPoller() {
  if (portalAnswerPollTimer) return;
  portalAnswerPollTimer = setInterval(async () => {
    try {
      const snap = await chrome.storage.local.get("cpPendingQuestions");
      const pending = Array.isArray(snap?.cpPendingQuestions) ? snap.cpPendingQuestions : [];
      if (!pending.length) {
        clearInterval(portalAnswerPollTimer);
        portalAnswerPollTimer = null;
        return;
      }
      await refreshPortalScreeningAnswersIntoSettings();
    } catch {
      // ignore
    }
  }, 8000);
}

// AFTER:
function ensurePortalAnswerPoller() {
  try {
    chrome.alarms.create("cpPortalAnswerPoll", { periodInMinutes: 0.15 });
  } catch {
    // fallback: ignore if alarms permission not available
  }
}

// Add alarm listener (near other chrome.* listeners in background.js):
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "cpPortalAnswerPoll") return;
  try {
    const snap = await chrome.storage.local.get("cpPendingQuestions");
    const pending = Array.isArray(snap?.cpPendingQuestions) ? snap.cpPendingQuestions : [];
    if (!pending.length) {
      chrome.alarms.clear("cpPortalAnswerPoll");
      return;
    }
    await refreshPortalScreeningAnswersIntoSettings();
  } catch {
    // ignore
  }
});
```

Also add `"alarms"` to manifest.json permissions:
```json
"permissions": [
  "storage",
  "tabs",
  "scripting",
  "activeTab",
  "alarms"
],
```

## Fix 1.7: Add Error Reporting to Panel
**File:** `CareerPilotLinkedInExtension/src/content.js`
**Problem:** 90 empty `catch {}` blocks silently swallow errors. Users see frozen panel with no explanation.

Key HIGH-severity catches to add error reporting:

```javascript
// content.js:6702 - automation loop failure
// BEFORE:
  runAutomationLoop().catch(() => null);

// AFTER:
  runAutomationLoop().catch((err) => {
    console.error("[CP] Automation loop crashed:", err);
    sendMessage({ type: "CP_SET_ERROR", error: err?.message || String(err) });
  });

// content.js:6726 - polling failure
// BEFORE:
  startStatePolling().catch(() => null);

// AFTER:
  startStatePolling().catch((err) => {
    console.error("[CP] State polling crashed:", err);
  });
```

## Fix 1.8: LinkedIn Selector Health Monitoring
**File:** `CareerPilotLinkedInExtension/src/content.js`
**Problem:** If LinkedIn changes DOM, all selectors break silently → zero jobs → "no progress" → stop with no useful message.

Add selector health check at run start (inside `runCycle` or `prepareRun`):

```javascript
// Add near top of file (constants area):
const SELECTOR_HEALTH_CHECK_ATTEMPTS = 3;

// Add new function:
function checkSelectorHealth() {
  const jobCards = getAllBySelectorList([
    ".job-card-container",
    "[data-occludable-job-id]",
    "li.jobs-search-results__list-item",
    ".jobs-search-results-list__list-item",
    "li.scaffold-layout__list-item",
  ]);
  const hasJobCards = jobCards.length > 0;
  const hasSearchInput = !!getBySelectorList([
    "input.jobs-search-box__text-input",
    "input[aria-label*='Search by']",
    "input[placeholder*='Search']",
  ]);
  const hasApplyButton = !!getBySelectorList([
    "button.jobs-apply-button",
    "button[aria-label*='Easy Apply']",
    "button[aria-label*='Apply']",
  ]);
  return {
    ok: hasJobCards || hasSearchInput,
    hasJobCards,
    hasSearchInput,
    hasApplyButton,
    jobCardCount: jobCards.length,
  };
}
```

Then in the no-progress recovery section (~line 6618-6624), add selector health logging:

```javascript
// AFTER line 6624 ("Stuck on current page..."):
const health = checkSelectorHealth();
if (!health.ok) {
  await logLine(
    `Selector health warning: cards=${health.jobCardCount}, search=${health.hasSearchInput}, apply=${health.hasApplyButton}. LinkedIn layout may have changed.`,
    "warn"
  );
}
```

## Version Bump
**File:** `CareerPilotLinkedInExtension/manifest.json:4`
```json
// BEFORE:
"version": "1.1.3",

// AFTER:
"version": "1.2.0",
```

## Verification
1. Load extension in Chrome developer mode
2. Navigate to LinkedIn jobs page
3. Verify panel appears and shows "Idle" status
4. Click Start → verify automation runs and stops cleanly at guard limit
5. Simulate context invalidation by reloading extension while running
6. Verify panel recovers and shows "Extension reconnected"
7. Check console for `[CP]` error messages instead of silent failures
8. Verify popup shows error message when extension is disabled
