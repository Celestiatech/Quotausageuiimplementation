function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => resolve(res || { ok: false }));
  });
}

const JOBS_SEARCH_URL = "https://www.linkedin.com/jobs/search/?f_AL=true";
const PROD_BASE_URL = "https://careerpilot.ai";
const DEV_BASE_URL = "http://localhost:3001";
let accountConnected = false;
let portalBaseUrl = PROD_BASE_URL;

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function stripLogPrefix(raw) {
  const text = String(raw || "").trim();
  if (text.startsWith("You:")) return text.slice(4).trim();
  if (text.startsWith("Copilot:")) return text.slice(8).trim();
  if (text.startsWith("[debug]")) return text.slice(7).trim();
  return text;
}

function setStatus(text, kind = "info") {
  const el = document.getElementById("status");
  el.textContent = String(text || "");
  el.dataset.kind = kind;
}

function buildPortalUrl(path) {
  const safePath = String(path || "/").startsWith("/") ? String(path || "/") : `/${String(path || "")}`;
  return `${portalBaseUrl.replace(/\/+$/, "")}${safePath}`;
}

async function resolvePortalBaseUrl() {
  try {
    const tabs = await chrome.tabs.query({
      url: ["http://localhost:3001/*", "http://127.0.0.1:3001/*"],
    });
    if (Array.isArray(tabs) && tabs.length) {
      portalBaseUrl = DEV_BASE_URL;
      return;
    }
  } catch {
    // ignore and use prod default
  }
  portalBaseUrl = PROD_BASE_URL;
}

function isAccountConnected(settings) {
  if (!settings || typeof settings !== "object") return false;
  const email = String(settings.contactEmail || "").trim();
  const fullName = String(settings.fullName || settings.firstName || "").trim();
  const screeningAnswers = settings.screeningAnswers && typeof settings.screeningAnswers === "object"
    ? settings.screeningAnswers
    : {};
  const hasAnswers = Object.keys(screeningAnswers).length > 0;
  return Boolean(email && (fullName || hasAnswers));
}

async function detectSignedInUserFromTabs() {
  const patterns = [
    "http://localhost:3001/*",
    "http://127.0.0.1:3001/*",
    "https://careerpilot.ai/*",
    "https://www.careerpilot.ai/*",
  ];
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: patterns });
  } catch {
    return null;
  }
  for (const tab of tabs) {
    if (!tab?.id) continue;
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
            let data = null;
            try {
              data = await res.json();
            } catch {
              data = null;
            }
            const user = data?.data?.user || data?.user || null;
            return {
              ok: Boolean(res.ok && data?.success && user?.email),
              email: String(user?.email || ""),
              name: String(user?.name || ""),
              origin: window.location.origin,
            };
          } catch (error) {
            return { ok: false, error: String(error?.message || error) };
          }
        },
      });
      const payload = result?.[0]?.result;
      if (payload?.ok) return payload;
    } catch {
      // continue scanning tabs
    }
  }
  return null;
}

function renderAccountState(settings, sessionUser) {
  const card = document.getElementById("accountCard");
  const title = document.getElementById("accountTitle");
  const badge = document.getElementById("accountBadge");
  const text = document.getElementById("accountText");
  const action = document.getElementById("accountAction");
  const runArea = document.getElementById("runArea");

  const connectedFromSettings = isAccountConnected(settings || {});
  const connectedFromSession = Boolean(sessionUser?.ok && sessionUser?.email);
  accountConnected = connectedFromSettings || connectedFromSession;
  const contactEmail = String(sessionUser?.email || settings?.contactEmail || "").trim();
  if (accountConnected) {
    card.classList.remove("disconnected");
    card.classList.add("connected");
    badge.classList.remove("disconnected");
    badge.classList.add("connected");
    badge.textContent = "Connected";
    title.textContent = "Account connected";
    if (connectedFromSession) {
      text.textContent = contactEmail
        ? `Signed in on ${sessionUser.origin} as ${contactEmail}. You can run auto-apply now.`
        : "Website session detected. You can run auto-apply now.";
    } else {
      text.textContent = contactEmail
        ? `Signed in as ${contactEmail}. You can run auto-apply now.`
        : "Your account is connected. You can run auto-apply now.";
    }
    action.textContent = "Open CareerPilot Dashboard";
    action.dataset.action = "dashboard";
    action.classList.add("btn-primary");
    if (runArea) runArea.style.display = "block";
  } else {
    card.classList.remove("connected");
    card.classList.add("disconnected");
    badge.classList.remove("connected");
    badge.classList.add("disconnected");
    badge.textContent = "Disconnected";
    title.textContent = "Sign in required";
    text.textContent = "Sign in to CareerPilot to continue.";
    action.textContent = "Sign in to CareerPilot";
    action.dataset.action = "login";
    action.classList.add("btn-primary");
    if (runArea) runArea.style.display = "none";
  }

  for (const id of ["start", "pause", "stop"]) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !accountConnected;
  }
}

function updateStatusBadge(state) {
  const badge = document.getElementById("statusBadge");
  const running = Boolean(state?.running);
  const paused = Boolean(state?.paused);
  badge.textContent = running ? "Running" : paused ? "Paused" : "Idle";
  badge.className = `status-badge ${running ? "running" : paused ? "paused" : "idle"}`;
}

function deriveNowCard(state) {
  const logs = Array.isArray(state?.logs) ? state.logs : [];
  const latestAny = logs.length ? logs[logs.length - 1] : null;
  const latestNonDebug = [...logs].reverse().find((entry) => !String(entry?.message || "").startsWith("[debug]")) || latestAny;
  const message = stripLogPrefix(latestNonDebug?.message || "");
  const norm = normalizeText(message);

  let title = "Idle and ready to start.";
  if (state?.paused) {
    title = "Run is paused.";
  } else if (state?.running) {
    if (norm.includes("preparing run")) {
      title = "Preparing search and filters.";
    } else if (norm.includes("found") && norm.includes("job cards")) {
      title = "Scanning job cards.";
    } else if (norm.includes("opening:")) {
      title = "Opening selected job.";
    } else if (norm.includes("modal step")) {
      title = "Filling Easy Apply form.";
    } else if (norm.includes("application submitted")) {
      title = "Application submitted.";
    } else if (norm.includes("submit blocked") || norm.includes("submit did not complete")) {
      title = "Submit blocked. Running fallbacks.";
    } else if (norm.includes("skipped")) {
      title = "Skipping current job and continuing.";
    } else {
      title = "Automation running.";
    }
  }

  const detail = message || (state?.running ? "Working on next action..." : "Press Start to begin.");
  return { title, detail };
}

function getFeedVisual(entry) {
  const raw = String(entry?.message || "");
  const level = String(entry?.level || "info").toLowerCase();
  const isUser = level === "user" || raw.startsWith("You:");
  const isDebug = raw.startsWith("[debug]");
  const sender = isUser ? "You" : "Copilot";
  const kind = level === "error"
    ? "Error"
    : level === "warn"
      ? "Warning"
      : isDebug
        ? "Debug"
        : isUser
          ? "Command"
          : "Update";
  const className = isUser ? "user" : level === "error" ? "error" : level === "warn" ? "warn" : "";
  return {
    sender,
    kind,
    className,
    text: stripLogPrefix(raw),
    time: String(entry?.ts || "").slice(11, 19)
  };
}

function renderFeed(logs) {
  const feed = document.getElementById("feed");
  feed.innerHTML = "";
  const items = Array.isArray(logs) ? logs.slice(-12) : [];
  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "feed-item";
    const msg = document.createElement("p");
    msg.className = "feed-msg";
    msg.textContent = "No events yet. Start a run to see live steps.";
    empty.appendChild(msg);
    feed.appendChild(empty);
    return;
  }

  for (const entry of items) {
    const visual = getFeedVisual(entry);
    const li = document.createElement("li");
    li.className = `feed-item ${visual.className}`.trim();

    const head = document.createElement("div");
    head.className = "feed-head";

    const sender = document.createElement("span");
    sender.className = "feed-sender";
    sender.textContent = visual.sender;

    const kind = document.createElement("span");
    kind.className = "feed-kind";
    kind.textContent = visual.kind;

    const time = document.createElement("span");
    time.className = "feed-time";
    time.textContent = visual.time;

    head.append(sender, kind, time);

    const msg = document.createElement("p");
    msg.className = "feed-msg";
    msg.textContent = visual.text || "(empty log)";

    li.append(head, msg);
    feed.appendChild(li);
  }
  feed.scrollTop = feed.scrollHeight;
}

function setStats(state) {
  document.getElementById("applied").textContent = String(state?.applied || 0);
  document.getElementById("skipped").textContent = String(state?.skipped || 0);
  document.getElementById("failed").textContent = String(state?.failed || 0);
  updateStatusBadge(state || {});
  const now = deriveNowCard(state || {});
  document.getElementById("nowTitle").textContent = now.title;
  document.getElementById("nowDetail").textContent = now.detail;
  renderFeed(state?.logs || []);
}

async function refresh() {
  await resolvePortalBaseUrl();
  const [boot, loadedSettings, sessionUser] = await Promise.all([
    sendMessage({ type: "CP_GET_BOOTSTRAP" }),
    sendMessage({ type: "CP_LOAD_SETTINGS" }),
    detectSignedInUserFromTabs(),
  ]);
  if (!boot.ok) {
    setStatus("Extension service unavailable.", "error");
    return;
  }
  renderAccountState(loadedSettings?.settings || {}, sessionUser);
  if (!accountConnected) {
    setStatus("Sign in to CareerPilot to enable run controls.", "warn");
    return;
  }
  setStats(boot.state || {});
  setStatus(boot.state?.running ? "Run active." : boot.state?.paused ? "Run paused." : "Ready.");
}

document.getElementById("start").addEventListener("click", async () => {
  if (!accountConnected) {
    setStatus("Sign in to CareerPilot first.", "warn");
    return;
  }
  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
  if (!tabs.length) {
    await chrome.tabs.create({ url: JOBS_SEARCH_URL });
  }
  const started = await sendMessage({ type: "CP_START", forceRestart: true });
  if (!started.ok) {
    setStatus(started.error || "Failed to start run", "error");
    return;
  }
  await refresh();
  setStatus("Run started.");
});

document.getElementById("pause").addEventListener("click", async () => {
  if (!accountConnected) {
    setStatus("Sign in to CareerPilot first.", "warn");
    return;
  }
  await sendMessage({ type: "CP_PAUSE" });
  await refresh();
  setStatus("Run paused.");
});

document.getElementById("stop").addEventListener("click", async () => {
  if (!accountConnected) {
    setStatus("Sign in to CareerPilot first.", "warn");
    return;
  }
  await sendMessage({ type: "CP_STOP" });
  await refresh();
  setStatus("Run stopped.");
});

document.getElementById("openLinkedIn").addEventListener("click", async () => {
  await chrome.tabs.create({ url: JOBS_SEARCH_URL });
  setStatus("Opened LinkedIn Jobs.");
});

document.getElementById("openOptions").addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
  setStatus("Opened settings.");
});

document.getElementById("accountAction").addEventListener("click", async () => {
  const action = document.getElementById("accountAction").dataset.action || "login";
  const url = action === "dashboard" ? buildPortalUrl("/dashboard") : buildPortalUrl("/login");
  await chrome.tabs.create({ url });
  setStatus(action === "dashboard" ? "Opened dashboard." : "Opened login.");
});

document.getElementById("copyLogs").addEventListener("click", async () => {
  const res = await sendMessage({ type: "CP_GET_LOG_EXPORT" });
  if (!res.ok || !res.logsJson) {
    setStatus("Failed to export logs", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(res.logsJson);
    setStatus("Debug logs copied.");
  } catch {
    setStatus("Clipboard failed", "error");
  }
});

document.getElementById("clearLogs").addEventListener("click", async () => {
  await sendMessage({ type: "CP_CLEAR_LOGS" });
  await refresh();
  setStatus("Logs cleared.");
});

refresh().catch(() => setStatus("Unavailable", "error"));
