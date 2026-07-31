// ─────────────────────────────────────────────────────────────────────────────
// HR Direct Outreach — content.js
// Injected into linkedin.com pages.
// Scrapes hiring posts, extracts HR contacts (name, title, company, email, phone).
// Floating panel uses panel.css styles matching CareerPilotLinkedInExtension.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  if (window.__hroContentInjected) return;
  window.__hroContentInjected = true;

  let isScraping = false;
  let stopFlag = false;
  let collectedCount = 0;
  let scrapeTimeoutId = null;
  let panelEl = null;
  let toggleEl = null;
  let panelVisible = true;
  let seenPostKeys = new Set();
  let currentKeyword = '';
  let currentSearchDate = '';

  const STORAGE_KEY = 'hro_collected_contacts';
  const SAVED_KEYS_KEY = 'hro_saved_seen_keys';
  const SAVED_SCROLL_KEY = 'hro_saved_scroll_y';
  const SAVED_COUNT_KEY = 'hro_saved_collected_count';
  const PANEL_ID = 'hro-panel';
  const TOGGLE_ID = 'hro-toggle';

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function extractEmailFromText(text) {
    const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return match ? match[0] : null;
  }

  function extractPhoneFromText(text) {
    const patterns = [
      /\+?1\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,
      /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/,
    ];
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match) return match[0].trim();
    }
    return null;
  }

  function debugLog(event, data = {}) {
    chrome.runtime.sendMessage({
      type: 'HRO_DEBUG_EVENT',
      level: 'info',
      event: `content_${event}`,
      source: 'content',
      data,
    }).catch(() => {});
  }

  function buildContentSearchUrl(keyword, timeRange) {
    const base = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword || 'we are hiring')}&origin=FACETED_SEARCH&sortBy=%5B%22date_posted%22%5D`;
    if (timeRange && timeRange !== 'any') return `${base}&datesPosted=${timeRange}`;
    return base;
  }

  // ── Parse a post card ────────────────────────────────────────────────────────

  const JOB_SEEKER_HASHTAGS = new Set([
    'opentowork', 'openforwork', 'availableforwork', 'lookingforwork',
    'jobsearch', 'seekingopportunities',
  ]);

  const JOB_SEEKER_PATTERNS = [
    /\bopen\s+to\s+work\b/i,
    /\bavailable\s+for\s+work\b/i,
    /\blooking\s+for\s+(new\s+)?opportunities?\b/i,
    /\bseeking\s+(new\s+)?opportunities?\b/i,
    /\bactively\s+looking\b/i,
    /\blooking\s+for\s+work\b/i,
    /\blooking\s+for\s+a\s+job\b/i,
    /\b#opentowork\b/i,
    /\b#openforwork\b/i,
  ];

  function isJobSeekerPost(card, category) {
    const text = (card.innerText || '').toLowerCase();
    if (category && JOB_SEEKER_HASHTAGS.has(category.split(',')[0]?.trim().toLowerCase())) return true;
    for (const pat of JOB_SEEKER_PATTERNS) {
      if (pat.test(text)) return true;
    }
    return false;
  }

  function parsePostCard(card) {
    const contact = {
      name: '',
      title: '',
      company: '',
      email: '',
      phone: '',
      category: '',
      linkedinUrl: '',
      sourcePostUrl: window.location.href,
      searchKeyword: '',
      searchDate: '',
    };

    // 1. Email from mailto: link (most reliable)
    const mailtoLink = card.querySelector('a[href^="mailto:"]');
    if (mailtoLink) {
      const email = mailtoLink.getAttribute('href').replace('mailto:', '').split('?')[0].trim();
      if (email && email.includes('@')) contact.email = email;
    }

    // 2. LinkedIn profile URL + name from aria-label on profile links
    const profileLinks = card.querySelectorAll('a[href*="/in/"]');
    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      if (href.includes('/in/')) {
        contact.linkedinUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href.split('?')[0]}`;
        // aria-label format: "Name  3rd+" or "Name   2nd+"
        const ariaLabel = link.getAttribute('aria-label') || '';
        if (ariaLabel && !contact.name) {
          contact.name = ariaLabel.replace(/\s*\d+\w*\+?\s*$/, '').trim();
        }
        break;
      }
    }

    // 3. Title/Company from innerText structure
    const text = card.innerText || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const bulletIdx = lines.findIndex((l) => l.startsWith('•') || l === '•');
    // If aria-label didn't give us a name, try first line
    if (!contact.name && bulletIdx > 0) {
      contact.name = lines[bulletIdx - 1] || '';
    }
    // Find title/company line
    for (let i = Math.max(0, bulletIdx); i < Math.min(lines.length, bulletIdx + 5); i++) {
      const line = lines[i];
      const atMatch = line.match(/(.+?)\s+at\s+(.+)/i);
      if (atMatch) {
        contact.title = atMatch[1].replace(/^Ex[–-]\s*/i, '').trim();
        contact.company = atMatch[2].trim();
        break;
      }
    }

    // 4. Phone from post text
    const phone = extractPhoneFromText(text);
    if (phone) contact.phone = phone;

    // 5. Hashtags
    const hashtagEls = card.querySelectorAll('a[href*="/feed/hashtag/"]');
    const hashtags = [...hashtagEls].map((a) => a.innerText.replace('#', '').trim()).filter(Boolean);
    if (hashtags.length > 0) {
      contact.category = hashtags.slice(0, 3).join(', ');
    }

    return contact;
  }

  // ── Expand a post "see more" button ──────────────────────────────────────────

  let highlightedCard = null;

  function highlightCard(card) {
    if (highlightedCard) {
      highlightedCard.style.outline = '';
      highlightedCard.style.boxShadow = '';
      highlightedCard.style.transition = '';
    }
    if (card) {
      card.style.outline = '3px solid #6366f1';
      card.style.boxShadow = '0 0 0 6px rgba(99,102,241,0.25)';
      highlightedCard = card;
    }
  }

  function clearHighlight() {
    if (highlightedCard) {
      highlightedCard.style.outline = '';
      highlightedCard.style.boxShadow = '';
      highlightedCard.style.transition = '';
      highlightedCard = null;
    }
  }

  async function expandPost(card) {
    try {
      const btn = card.querySelector('[data-testid="expandable-text-button"]') ||
        card.querySelector('button[aria-label*="more"]');
      if (btn) {
        btn.click();
        await sleep(250);
        return true;
      }
    } catch {}
    return false;
  }

  // ── Extract emails/phones from expanded post text ────────────────────────────

  async function scrapePostDetail(card) {
    try {
      const pageText = card.innerText || '';
      const emails = (pageText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
        .filter((e) => !e.includes('example.com') && !e.includes('sentry.io') && !e.includes('placeholder') && !e.includes('linkedin.com') && !e.includes('noreply'));
      const phones = (pageText.match(/\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);

      return {
        emails: [...new Set(emails)],
        phones: [...new Set(phones.map((p) => p.trim()))],
      };
    } catch {
      return { emails: [], phones: [] };
    }
  }

  // ── Post deduplication ────────────────────────────────────────────────────────

  function getPostKey(card) {
    const profileLink = card.querySelector('a[href*="/in/"]');
    const profileHref = profileLink?.getAttribute('href')?.split('?')[0] || '';
    const text = (card.innerText || '').substring(0, 120).trim().replace(/\s+/g, ' ');
    return `${profileHref}||${text}`;
  }

  // ── Scrape visible posts ─────────────────────────────────────────────────────

  async function scrapeVisiblePosts() {
    const cardSelectors = [
      'div[role="listitem"]',
      'div[data-feed-id]',
      'li[data-feed-id]',
      '.feed-shared-update-v2',
      '.occludable-update',
      'article',
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      try {
        cards = [...document.querySelectorAll(sel)];
        if (cards.length > 0) break;
      } catch {}
    }

    if (cards.length === 0) {
      console.log('[HRO] scrapeVisiblePosts: 0 cards found, returning early');
      return;
    }

    console.log(`[HRO] scrapeVisiblePosts: ${cards.length} cards, ${seenPostKeys.size} seen, scanning...`);
    let scannedCount = 0;
    let skippedDupes = 0;
    for (let i = 0; i < cards.length; i++) {
      if (stopFlag) break;

      const card = cards[i];

      const postKey = getPostKey(card);
      if (seenPostKeys.has(postKey)) {
        skippedDupes++;
        continue;
      }
      seenPostKeys.add(postKey);
      scannedCount++;

      highlightCard(card);

      const contact = parsePostCard(card);
      contact.searchKeyword = currentKeyword;
      contact.searchDate = currentSearchDate;
      if (!contact.name && !contact.email) continue;

      if (isJobSeekerPost(card, contact.category)) continue;

      // Only expand if we don't already have email/phone
      if (contact.email || contact.phone) {
        const result = await chrome.runtime.sendMessage({
          type: 'HRO_ADD_CONTACT',
          contact,
        });
        if (result?.added) {
          collectedCount++;
          if (collectedCount % 3 === 0) updatePanelProgress(collectedCount);
        }
      } else {
        await expandPost(card);
        const detail = await scrapePostDetail(card);
        const emailsToUse = detail.emails.length > 0 ? detail.emails : [];
        const phonesToUse = detail.phones.length > 0 ? detail.phones : [];

        if (emailsToUse.length > 0 || phonesToUse.length > 0) {
          const contactWithEmail = {
            ...contact,
            email: emailsToUse[0] || '',
            phone: phonesToUse[0] || contact.phone,
          };
          const result = await chrome.runtime.sendMessage({
            type: 'HRO_ADD_CONTACT',
            contact: contactWithEmail,
          });
          if (result?.added) {
            collectedCount++;
            if (collectedCount % 3 === 0) updatePanelProgress(collectedCount);
          }
        }
      }

      await sleep(50);
    }
  }

  // ── Wait for feed ────────────────────────────────────────────────────────────

  async function waitForFeedReady(maxWaitMs = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (document.body.scrollHeight > 1200 || (document.body.innerText?.trim().length || 0) > 5000) {
        return true;
      }
      const feedEls = document.querySelectorAll(
        'div[data-feed-id], li[data-feed-id], div.feed-shared-update-v2, main article'
      );
      if (feedEls.length > 0) return true;
      await sleep(250);
    }
    return false;
  }

  function countCards() {
    const selectors = [
      'div[role="listitem"]',
      'div[data-feed-id]',
      'li[data-feed-id]',
      '.feed-shared-update-v2',
      '.occludable-update',
      'article',
    ];
    for (const sel of selectors) {
      try {
        const count = document.querySelectorAll(sel).length;
        if (count > 0) return count;
      } catch {}
    }
    return 0;
  }

  // ── Auto-scroll and scrape ───────────────────────────────────────────────────

  async function autoScrollAndScrape(maxScrolls = 30) {
    const startMs = Date.now();
    console.log('[HRO] ═══ SCRAPE START ═══ maxScrolls:', maxScrolls, 'seen:', seenPostKeys.size, 'saved:', collectedCount);

    const feedReady = await waitForFeedReady(8000);
    console.log('[HRO] feedReady:', feedReady, 'bodyHeight:', document.body.scrollHeight, 'textLen:', (document.body.innerText || '').length);

    let previousCardCount = 0;
    let previousBodyHeight = 0;
    let noNewContentStreak = 0;
    let totalCardsProcessed = seenPostKeys.size;

    for (let i = 0; i < maxScrolls && !stopFlag; i++) {
      const iterStart = Date.now();
      await scrapeVisiblePosts();

      const countBefore = countCards();
      const heightBefore = document.body.scrollHeight;

      if (countBefore === 0 && seenPostKeys.size === totalCardsProcessed && i > 0) {
        console.log('[HRO] ⛔ BREAK: No cards found on page');
        break;
      }

      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });

      let waited = 0;
      while (waited < 5000 && !stopFlag) {
        await sleep(200);
        waited += 200;
        const currentCount = countCards();
        const currentHeight = document.body.scrollHeight;
        if (currentCount > countBefore || currentHeight > heightBefore + 200) {
          break;
        }
      }

      const loadMoreBtn = document.querySelector('button[aria-label*="Load more"]') ||
        document.querySelector('button[aria-label*="Show more"]') ||
        document.querySelector('button[aria-label*="See more"]');
      if (loadMoreBtn) {
        console.log('[HRO] Clicked "Load more" button, waiting 500ms...');
        loadMoreBtn.click();
        await sleep(500);
      }

      const countAfter = countCards();
      const bodyHeightAfter = document.body.scrollHeight;

      const cardsMatch = countAfter === previousCardCount;
      const heightMatch = bodyHeightAfter === previousBodyHeight;
      const noPostsProcessed = seenPostKeys.size === totalCardsProcessed;
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const iterMs = Date.now() - iterStart;

      console.log(`[HRO] Scroll #${i + 1} | cards:${countBefore}→${countAfter} | height:${heightBefore}→${bodyHeightAfter} | seen:${seenPostKeys.size} | saved:${collectedCount} | streak:${noNewContentStreak} | iter:${iterMs}ms | total:${elapsed}s | cardsMatch:${cardsMatch} heightMatch:${heightMatch} noPosts:${noPostsProcessed}`);

      if (cardsMatch && heightMatch && noPostsProcessed) {
        noNewContentStreak++;
        console.log(`[HRO] ⚠ STUCK (all 3) streak:${noNewContentStreak}/3`);
        if (noNewContentStreak >= 3) {
          console.log('[HRO] ⛔ BREAK: No new content after 3 scrolls (cards+height+posts unchanged)');
          break;
        }
      } else if (cardsMatch && heightMatch) {
        noNewContentStreak++;
        console.log(`[HRO] ⚠ STUCK (cards+height) streak:${noNewContentStreak}/4`);
        if (noNewContentStreak >= 4) {
          console.log('[HRO] ⛔ BREAK: No new content after 4 scrolls (cards+height unchanged)');
          break;
        }
      } else {
        noNewContentStreak = 0;
      }
      previousCardCount = countAfter;
      previousBodyHeight = bodyHeightAfter;
      totalCardsProcessed = seenPostKeys.size;

      await sleep(150);
    }

    const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    if (stopFlag) {
      console.log(`[HRO] ═══ SCRAPE STOPPED ═══ stopFlag set | saved:${collectedCount} | seen:${seenPostKeys.size} | time:${totalElapsed}s`);
    } else {
      console.log(`[HRO] ═══ SCRAPE DONE ═══ saved:${collectedCount} | seen:${seenPostKeys.size} | time:${totalElapsed}s`);
    }
    clearHighlight();
  }

  // ── Floating panel ───────────────────────────────────────────────────────────

  function updatePanelStatus(message, detail) {
    const nowTitle = document.getElementById('hro-now-title');
    const nowDetail = document.getElementById('hro-now-detail');
    if (nowTitle) nowTitle.textContent = message;
    if (nowDetail) nowDetail.textContent = detail || '';
  }

  function updatePanelProgress(count) {
    const countEl = document.getElementById('hro-count');
    const barEl = document.getElementById('hro-bar');
    const subEl = document.getElementById('hro-sub');
    const nowTitle = document.getElementById('hro-now-title');
    const nowDetail = document.getElementById('hro-now-detail');
    const badgeEl = document.getElementById('hro-badge');
    if (countEl) countEl.textContent = count;
    if (barEl) barEl.style.width = `${Math.min(100, count)}%`;
    if (subEl) subEl.textContent = `${count}`;
    if (nowTitle) nowTitle.textContent = 'Collecting contacts...';
    if (nowDetail) nowDetail.textContent = `${count} contacts saved · ${seenPostKeys.size} unique posts scanned.`;
    if (badgeEl) {
      badgeEl.textContent = 'Running';
      badgeEl.className = 'hro-badge hro-run';
    }
  }

  function setPanelIdle(count) {
    clearHighlight();
    const countEl = document.getElementById('hro-count');
    const barEl = document.getElementById('hro-bar');
    const subEl = document.getElementById('hro-sub');
    const nowTitle = document.getElementById('hro-now-title');
    const nowDetail = document.getElementById('hro-now-detail');
    const badgeEl = document.getElementById('hro-badge');
    if (countEl) countEl.textContent = count;
    if (barEl) barEl.style.width = `${Math.min(100, count)}%`;
    if (subEl) subEl.textContent = `${count}`;
    if (nowTitle) nowTitle.textContent = count > 0 ? 'Collection paused' : 'Ready to collect';
    if (nowDetail) nowDetail.textContent = count > 0 ? `${count} contacts found. Click Start to continue.` : 'Click Start Collecting to begin scraping.';
    if (badgeEl) {
      badgeEl.textContent = 'Idle';
      badgeEl.className = 'hro-badge';
    }
    // Reset button
    const startBtn = document.getElementById('hro-start-btn');
    if (startBtn) {
      startBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start';
      startBtn.className = 'hro-start';
    }
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    chrome.storage.local.get([STORAGE_KEY, 'hro_is_collecting'], (data) => {
      const count = (data[STORAGE_KEY] || []).length;
      const collecting = data.hro_is_collecting || false;
      const pct = Math.min(100, count);

      panelEl = document.createElement('div');
      panelEl.id = PANEL_ID;
      panelEl.innerHTML = `
        <div class="hro-head" id="hro-drag-handle">
          <div class="hro-brand">
            <div class="hro-orb">
              <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="HR" />
            </div>
            <div>
              <div class="hro-title">HR Direct Outreach</div>
              <div class="hro-sub" id="hro-sub">${count}</div>
            </div>
          </div>
          <div class="hro-head-right">
            <span class="hro-badge ${collecting ? 'hro-run' : ''}" id="hro-badge">${collecting ? 'Running' : 'Idle'}</span>
            <div class="hro-window-actions">
              <button id="hro-minimize" title="Minimize">—</button>
              <button id="hro-close" title="Hide panel">✕</button>
            </div>
          </div>
        </div>
        <div class="hro-now">
          <div class="hro-now-title" id="hro-now-title">${collecting ? 'Collecting contacts...' : (count > 0 ? 'Collection paused' : 'Ready to collect')}</div>
          <div class="hro-now-detail" id="hro-now-detail">${collecting ? `${count} contacts found on this page.` : (count > 0 ? `${count} contacts found. Click Start to continue.` : 'Click Start Collecting to begin scraping.')}</div>
        </div>
        <div class="hro-progress">
          <div class="hro-progress-bar-bg">
            <div class="hro-progress-bar" id="hro-bar" style="width:${pct}%"></div>
          </div>
          <div class="hro-progress-text">
            <span>Progress</span>
            <span id="hro-count" style="font-weight:700;color:#6d7bff">${count}</span>
          </div>
        </div>
        <div class="hro-controls">
          <div class="hro-quick">
            <button class="hro-start" id="hro-start-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              ${collecting ? 'Collecting...' : 'Start'}
            </button>
            <button class="hro-stop" id="hro-stop-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              Stop
            </button>
            <button class="hro-dashboard" id="hro-dash-btn">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </button>
          </div>
          <div class="hro-info-row">
            <span class="hro-info-pill">Scrapes LinkedIn hiring posts</span>
            <span class="hro-info-pill">·</span>
            <span class="hro-info-pill">Extracts email & phone</span>
          </div>
        </div>
      `;
      document.body.appendChild(panelEl);
      panelVisible = true;

      // ── Event listeners ──

      document.getElementById('hro-start-btn').addEventListener('click', () => {
        if (isScraping) {
          chrome.runtime.sendMessage({ type: 'HRO_STOP_COLLECTING' });
          stopFlag = true;
          isScraping = false;
          setPanelIdle(collectedCount);
        } else {
          chrome.runtime.sendMessage({ type: 'HRO_START_COLLECTING', keyword: 'we are hiring' });
          const btn = document.getElementById('hro-start-btn');
          if (btn) {
            btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Collecting...';
          }
          updatePanelProgress(collectedCount);
        }
      });

      document.getElementById('hro-stop-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'HRO_STOP_COLLECTING' });
        stopFlag = true;
        isScraping = false;
        if (scrapeTimeoutId !== null) { clearTimeout(scrapeTimeoutId); scrapeTimeoutId = null; }
        setPanelIdle(collectedCount);
      });

      document.getElementById('hro-dash-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'HRO_SYNC_TO_DASHBOARD' }).catch(() => {});
        window.open('http://localhost:3000/dashboard/hr-outreach', '_blank');
      });

      document.getElementById('hro-minimize').addEventListener('click', () => {
        panelEl.classList.toggle('hro-minimized');
      });

      document.getElementById('hro-close').addEventListener('click', () => {
        panelEl.classList.add('hro-hidden');
        panelVisible = false;
        if (toggleEl) toggleEl.style.display = 'flex';
      });

      // ── Dragging ──
      enableDragging();

      // If collecting was active, update UI
      if (collecting) {
        const btn = document.getElementById('hro-start-btn');
        if (btn) {
          btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Collecting...';
        }
        updatePanelProgress(count);
      }
    });
  }

  function createToggle() {
    if (document.getElementById(TOGGLE_ID)) return;
    toggleEl = document.createElement('button');
    toggleEl.id = TOGGLE_ID;
    toggleEl.title = 'Show HR Outreach panel';
    toggleEl.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    toggleEl.style.display = 'none';
    document.body.appendChild(toggleEl);

    toggleEl.addEventListener('click', () => {
      if (panelEl) {
        panelEl.classList.remove('hro-hidden');
        panelVisible = true;
      }
      toggleEl.style.display = 'none';
    });
  }

  function enableDragging() {
    if (!panelEl) return;
    const handle = document.getElementById('hro-drag-handle');
    if (!handle) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseMove = (event) => {
      if (!dragging || !panelEl) return;
      const nextLeft = Math.max(8, Math.min(window.innerWidth - 120, event.clientX - offsetX));
      const nextTop = Math.max(8, Math.min(window.innerHeight - 80, event.clientY - offsetY));
      panelEl.style.left = `${nextLeft}px`;
      panelEl.style.top = `${nextTop}px`;
      panelEl.style.right = 'auto';
      panelEl.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      panelEl?.classList.remove('hro-dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.hro-window-actions, button')) return;
      if (!panelEl) return;
      const rect = panelEl.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      dragging = true;
      panelEl.classList.add('hro-dragging');
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  function removePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    if (toggleEl) { toggleEl.remove(); toggleEl = null; }
  }

  // ── Message listener ─────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'HRO_START_SCRAPE') {
      if (isScraping) { sendResponse({ ok: false, reason: 'already_running' }); return true; }

      console.log('[HRO] FRESH START — keyword:', msg.keyword, 'timeRange:', msg.timeRange);
      isScraping = true;
      stopFlag = false;
      collectedCount = 0;
      seenPostKeys = new Set();
      currentKeyword = msg.keyword || '';
      currentSearchDate = msg.searchDate || new Date().toISOString();

      // Increase timeout: 30 scrolls × ~7s each ≈ 3.5 min
      if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
      scrapeTimeoutId = setTimeout(() => {
        if (isScraping) {
          console.log('[HRO] ⏰ SAFETY TIMEOUT fired — forcing stop');
          isScraping = false;
          stopFlag = true;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }
      }, 120000);

      if (window.location.href.includes('linkedin.com/search') || window.location.href.includes('linkedin.com/feed')) {
        sendResponse({ ok: true });
        autoScrollAndScrape(30).then(() => {
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }).catch(() => {
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        });
      } else {
        const searchUrl = buildContentSearchUrl(msg.keyword, msg.timeRange);
        chrome.storage.local.set({
          hro_is_collecting: true,
          hro_keyword: msg.keyword,
          hro_time_range: msg.timeRange || 'any',
        }, () => {
          sendResponse({ ok: true });
          window.location.href = searchUrl;
        });
      }
      return true;
    }

    if (msg.type === 'HRO_STOP_SCRAPE') {
      stopFlag = true;
      isScraping = false;
      if (scrapeTimeoutId !== null) { clearTimeout(scrapeTimeoutId); scrapeTimeoutId = null; }
      chrome.storage.local.set({
        [SAVED_KEYS_KEY]: [...seenPostKeys],
        [SAVED_SCROLL_KEY]: window.scrollY,
        [SAVED_COUNT_KEY]: collectedCount,
      });
      sendResponse({ ok: true });
    }

    if (msg.type === 'HRO_RESUME_SCRAPE') {
      if (isScraping) { sendResponse({ ok: false, reason: 'already_running' }); return true; }
      chrome.storage.local.get([SAVED_KEYS_KEY, SAVED_SCROLL_KEY, SAVED_COUNT_KEY], (saved) => {
        const keysLen = saved[SAVED_KEYS_KEY]?.length || 0;
        const savedCount = saved[SAVED_COUNT_KEY] || 0;
        console.log('[HRO] RESUME — restoring seenKeys:', keysLen, 'collected:', savedCount);
        if (saved[SAVED_KEYS_KEY] && saved[SAVED_KEYS_KEY].length > 0) {
          seenPostKeys = new Set(saved[SAVED_KEYS_KEY]);
        }
        if (saved[SAVED_COUNT_KEY] != null) {
          collectedCount = saved[SAVED_COUNT_KEY];
        }
        isScraping = true;
        stopFlag = false;
        currentKeyword = msg.keyword || currentKeyword;
        currentSearchDate = msg.searchDate || new Date().toISOString();
        if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
        scrapeTimeoutId = setTimeout(() => {
          if (isScraping) {
            isScraping = false;
            stopFlag = true;
            chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
          }
        }, 210000);
        sendResponse({ ok: true });
        updatePanelProgress(collectedCount);
        autoScrollAndScrape(30).then(() => {
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        }).catch(() => {
          if (scrapeTimeoutId !== null) clearTimeout(scrapeTimeoutId);
          isScraping = false;
          chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        });
      });
      return true;
    }

    return true;
  });

  // ── Auto-resume if navigated during collection ───────────────────────────────

  chrome.storage.local.get(['hro_is_collecting', 'hro_keyword', 'hro_time_range', SAVED_KEYS_KEY, SAVED_COUNT_KEY], (data) => {
    if (
      data.hro_is_collecting &&
      (window.location.href.includes('/search/results/content') || window.location.href.includes('/feed'))
    ) {
      isScraping = true;
      stopFlag = false;
      const keysLen = data[SAVED_KEYS_KEY]?.length || 0;
      const savedCount = data[SAVED_COUNT_KEY] || 0;
      console.log('[HRO] AUTO-RESUME — restoring seenKeys:', keysLen, 'collected:', savedCount);
      if (data[SAVED_KEYS_KEY] && data[SAVED_KEYS_KEY].length > 0) {
        seenPostKeys = new Set(data[SAVED_KEYS_KEY]);
      } else {
        seenPostKeys = new Set();
      }
      collectedCount = data[SAVED_COUNT_KEY] || 0;
      currentKeyword = data.hro_keyword || '';
      currentSearchDate = new Date().toISOString();

      autoScrollAndScrape(30).then(() => {
        isScraping = false;
        chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        chrome.storage.local.remove('hro_is_collecting');
        chrome.storage.local.remove(SAVED_KEYS_KEY);
        chrome.storage.local.remove(SAVED_COUNT_KEY);
        chrome.storage.local.remove(SAVED_SCROLL_KEY);
      }).catch(() => {
        isScraping = false;
        chrome.runtime.sendMessage({ type: 'HRO_SCRAPE_DONE', count: collectedCount }).catch(() => {});
        chrome.storage.local.remove('hro_is_collecting');
      });
    }
  });

  // ── Status update listener ───────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'HRO_COLLECTING_STATUS') {
      updatePanelProgress(msg.count);
    }
    if (msg.type === 'HRO_COLLECTING_DONE') {
      setPanelIdle(msg.count);
      isScraping = false;
    }

    // ── Panel on/off toggle ──
    if (msg.type === 'HRO_PANEL_VISIBILITY') {
      if (msg.enabled) {
        if (!panelEl) {
          createPanel();
          createToggle();
        } else {
          panelEl.classList.remove('hro-hidden');
          panelVisible = true;
          if (toggleEl) toggleEl.style.display = 'none';
        }
      } else {
        removePanel();
      }
    }
  });

  // ── Show panel only if enabled in settings ───────────────────────────────────

  if (window.location.href.includes('linkedin.com')) {
    const initPanel = () => {
      chrome.storage.local.get('hro_panel_enabled', (data) => {
        if (data.hro_panel_enabled) {
          createPanel();
          createToggle();
        }
      });
    };

    if (document.body) {
      initPanel();
    } else {
      document.addEventListener('DOMContentLoaded', initPanel);
    }
  }
})();
