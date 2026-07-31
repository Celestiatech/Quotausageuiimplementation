// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — background.js
// Service worker: manages collection state, storage, badge, communication.
// ─────────────────────────────────────────────────────────────────────────────

console.log('[HRO Background] Service worker loaded at', new Date().toISOString());

const MAX_CONTACTS = 100000;
const STORAGE_KEY = 'hro_collected_contacts';
const SAVED_COUNT_KEY = 'hro_saved_collected_count';

function buildSearchUrl(keyword, timeRange) {
  const base = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D`;
  if (timeRange && timeRange !== 'any') return `${base}&datesPosted=${timeRange}`;
  return base;
}

// ── Contact deduplication and storage ──────────────────────────────────────────

function makeKey(c) {
  return (c.email || `${c.name}||${c.company}`).toLowerCase().trim();
}

async function addContact(contact) {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const contacts = data[STORAGE_KEY] || [];

  const key = makeKey(contact);
  const existing = new Set(contacts.map(makeKey));

  if (existing.has(key)) {
    return { duplicate: true, count: contacts.length };
  }

  if (contacts.length >= MAX_CONTACTS) {
    return { capped: true, count: contacts.length };
  }

  const newContact = {
    ...contact,
    id: `hro_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    collectedAt: new Date().toISOString(),
  };

  contacts.push(newContact);
  await chrome.storage.local.set({ [STORAGE_KEY]: contacts });

  updateBadge(contacts.length);

  // Milestone logs
  if (contacts.length % 10 === 0 || contacts.length <= 3 || contacts.length === MAX_CONTACTS) {
    console.log(`[HRO] Milestone: ${contacts.length} contacts collected`);
  }

  return { added: true, count: contacts.length };
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: count >= 50 ? '#10b981' : '#6366f1' });
}

// ── Collection orchestration ───────────────────────────────────────────────────

async function runCollection(keyword, timeRange, isResume = false) {
  console.log('[HRO Background] runCollection called with keyword:', keyword, 'timeRange:', timeRange, 'isResume:', isResume);
  const searchUrl = buildSearchUrl(keyword, timeRange);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('[HRO Background] Active tab:', tab?.url);

    let linkedinTab = tab;
    if (!tab?.url?.includes('linkedin.com')) {
      const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
      if (tabs.length > 0) {
        linkedinTab = tabs[0];
        await chrome.tabs.update(linkedinTab.id, { active: true });
      } else {
        linkedinTab = await chrome.tabs.create({ url: searchUrl, active: true });
      }
    }

    const alreadyOnSearch = linkedinTab?.url?.includes('/search/results/content') ||
      linkedinTab?.url?.includes('/feed');

    if (!alreadyOnSearch) {
      await chrome.tabs.update(linkedinTab.id, { url: searchUrl });
    }

    // Wait for tab to load (skip if already loaded and on search)
    await new Promise((resolve) => {
      if (alreadyOnSearch && linkedinTab?.status === 'complete') {
        resolve();
        return;
      }
      const listener = (tabId, changeInfo) => {
        if (tabId === linkedinTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(resolve, 7000);
    });

    const msgType = isResume ? 'HRO_RESUME_SCRAPE' : 'HRO_START_SCRAPE';
    const msgPayload = isResume
      ? { type: msgType, keyword, searchDate: new Date().toISOString() }
      : { type: msgType, keyword, timeRange, searchDate: new Date().toISOString() };

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        console.log('[HRO Background] Sending', msgType, 'to tab', linkedinTab.id, 'attempt:', attempt);
        const response = await chrome.tabs.sendMessage(linkedinTab.id, msgPayload);
        console.log('[HRO Background]', msgType, 'response:', JSON.stringify(response));
        if (response?.ok) return { ok: true };
      } catch (err) {
        console.log('[HRO Background]', msgType, 'attempt', attempt, 'failed:', err.message);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (linkedinTab.url?.includes('linkedin.com') && !alreadyOnSearch) {
      await chrome.tabs.update(linkedinTab.id, { url: searchUrl });
      return { ok: true };
    }

    return { ok: false, reason: 'could_not_start' };
  } catch (err) {
    console.error('[HRO] Collection error:', err);
    return { ok: false, reason: err.message };
  }
}

// ── Message handler ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[HRO Background] Received message:', msg.type, msg);
  switch (msg.type) {
    case 'HRO_GET_CONTACTS':
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        sendResponse({
          contacts: data[STORAGE_KEY] || [],
          count: (data[STORAGE_KEY] || []).length,
          max: MAX_CONTACTS,
        });
      });
      return true;

    case 'HRO_ADD_CONTACT':
      console.log('[HRO Background] HRO_ADD_CONTACT:', JSON.stringify(msg.contact));
      addContact(msg.contact).then((result) => {
        console.log('[HRO Background] HRO_ADD_CONTACT result:', JSON.stringify(result));
        sendResponse(result);
        // Notify popup of progress
        chrome.runtime.sendMessage({
          type: 'HRO_COLLECTING_STATUS',
          count: result.count,
          max: MAX_CONTACTS,
        }).catch(() => {});
      });
      return true;

    case 'HRO_CLEAR_CONTACTS':
      chrome.storage.local.remove([STORAGE_KEY, SAVED_COUNT_KEY, 'hro_saved_seen_keys', 'hro_saved_scroll_y'], () => {
        updateBadge(0);
        sendResponse({ ok: true });
      });
      return true;

    case 'HRO_START_COLLECTING':
      chrome.storage.local.get(SAVED_COUNT_KEY, (prev) => {
        const isResume = (prev[SAVED_COUNT_KEY] || 0) > 0;
        chrome.storage.local.set({
          hro_is_collecting: true,
          hro_keyword: msg.keyword,
          hro_time_range: msg.timeRange || 'any',
        }, () => {
          if (!isResume) updateBadge(0);
          runCollection(msg.keyword || 'we are hiring', msg.timeRange || 'any', isResume);
          sendResponse({ ok: true });
        });
      });
      return true;

    case 'HRO_STOP_COLLECTING':
      chrome.storage.local.set({ hro_is_collecting: false }, () => {
        // Notify all LinkedIn tabs to stop
        chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, { type: 'HRO_STOP_SCRAPE' }).catch(() => {});
          }
        });
        sendResponse({ ok: true });
      });
      return true;

    case 'HRO_GET_STATUS':
      chrome.storage.local.get([STORAGE_KEY, 'hro_is_collecting', 'hro_keyword', 'hro_time_range'], (data) => {
        sendResponse({
          count: (data[STORAGE_KEY] || []).length,
          max: MAX_CONTACTS,
          isCollecting: data.hro_is_collecting || false,
          keyword: data.hro_keyword || '',
          timeRange: data.hro_time_range || 'any',
        });
      });
      return true;

    case 'HRO_SCRAPE_DONE':
      console.log('[HRO Background] HRO_SCRAPE_DONE, count:', msg.count);
      chrome.storage.local.set({ hro_is_collecting: false }, () => {
        chrome.storage.local.remove(['hro_saved_seen_keys', 'hro_saved_scroll_y', SAVED_COUNT_KEY]);
        chrome.runtime.sendMessage({
          type: 'HRO_COLLECTING_DONE',
          count: msg.count || 0,
        }).catch(() => {});
      });
      sendResponse({ ok: true });
      return true;

    case 'HRO_TOGGLE_PANEL':
      chrome.storage.local.set({ hro_panel_enabled: !!msg.enabled }, () => {
        // Notify all LinkedIn tabs to show/hide panel
        chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'HRO_PANEL_VISIBILITY',
              enabled: !!msg.enabled,
            }).catch(() => {});
          }
        });
        sendResponse({ ok: true, enabled: !!msg.enabled });
      });
      return true;

    case 'HRO_GET_PANEL_ENABLED':
      chrome.storage.local.get('hro_panel_enabled', (data) => {
        sendResponse({ ok: true, enabled: !!data.hro_panel_enabled });
      });
      return true;

    case 'HRO_EXPORT_CSV':
      chrome.storage.local.get(STORAGE_KEY, (data) => {
        const contacts = data[STORAGE_KEY] || [];
        const headers = ['Name', 'Title', 'Company', 'Email', 'Phone', 'Category', 'LinkedIn URL', 'Collected At'];
        const rows = contacts.map((c) => [
          c.name, c.title, c.company, c.email, c.phone || '', c.category, c.linkedinUrl, c.collectedAt,
        ]);
        const csv = [headers, ...rows].map((r) => r.map((v) => `"${(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        sendResponse({ csv });
      });
      return true;

    case 'HRO_HEARTBEAT':
      sendResponse({ ok: true, ts: Date.now() });
      return true;

    default:
      console.log('[HRO Background] Unknown message type:', msg.type);
      return false;
  }
});

// ── Restore badge on service worker restart ─────────────────────────────────────

chrome.storage.local.get(STORAGE_KEY, (data) => {
  const contacts = data[STORAGE_KEY] || [];
  updateBadge(contacts.length);
});
