// Floating listener window logic.
// Listens to the client through the microphone (Web Speech API), and when the
// client pauses it auto-generates a polished answer and shows it live in a
// Q&A history so the user can read it out. The window is a separate Chrome
// popup, so sharing only the Meet tab / browser window keeps it out of the
// screen share. Supports drag-to-move, minimize-to-pill, auto-copy, and a
// Ctrl+Shift+Space toggle from the background hotkey.
"use strict";

const $ = (id) => document.getElementById(id);
const DEFAULT_ORIGIN = "http://localhost:3000";
const SILENCE_MS = 2200;
const MIN_QUESTION_MS = 1400;
const WINDOW_W = 400;
const PILL_H = 56;
const FULL_H = 620;

let rec = null;
let listening = false;
let busy = false;
let minimized = false;
let finalizedText = "";
let interimText = "";
let lastActivityAt = 0;
let lastAnsweredAt = 0;
let lastGeneratedText = "";
let tone = "concise";
let history = [];

function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }

const DBG = true;
function dbg(...args) {
  if (DBG) console.log("[LiveAnswerListener]", ...args);
}

function getWindow() {
  return new Promise((resolve) => chrome.windows.getCurrent((win) => resolve(win || null)));
}

async function setPillHeight(pill) {
  const win = await getWindow();
  if (!win) return;
  await chrome.windows.update(win.id, { height: pill ? PILL_H : FULL_H });
}

function enterPillMode() {
  minimized = true;
  hide("fullMode");
  show("pillMode");
  $("pillText").textContent = listening ? "Listening…" : "Start listening";
  $("pillDot").className = "pill-dot" + (listening ? " pulse" : " off");
  void setPillHeight(true);
}

function exitPillMode() {
  minimized = false;
  hide("pillMode");
  show("fullMode");
  void setPillHeight(false);
}

async function getStored() {
  return chrome.storage.local.get(["assistToken", "assistTokenAt", "assistOrigin"]);
}

async function setStatus(text, kind) {
  const node = $("connStatus");
  node.textContent = text;
  node.className = "status" + (kind ? ` ${kind}` : "");
}

async function refreshConnection() {
  const stored = await getStored();
  const token = stored.assistToken;
  const origin = stored.assistOrigin || DEFAULT_ORIGIN;
  dbg("refreshConnection: token=", !!token, "origin=", origin, "ageMs=", Date.now() - (Number(stored.assistTokenAt) || 0));
  if (!token) {
    await setStatus("Connect: open the dashboard & log in", "bad");
    return { ok: false, origin };
  }
  const ageMs = Date.now() - (Number(stored.assistTokenAt) || 0);
  const fresh = ageMs < 14 * 60 * 1000;
  await setStatus(
    fresh ? `Connected · ${new URL(origin).host}` : "Session expiring · reconnect to refresh",
    fresh ? "ok" : "bad",
  );
  dbg("connection", fresh ? "fresh" : "stale");
  return { ok: true, origin, token, fresh };
}

// Ensures the cached token is fresh. If it's stale, pokes the background to
// re-grab a token from any open dashboard tab, waits a moment, then re-reads.
async function ensureFreshToken() {
  const conn = await refreshConnection();
  if (!conn.ok) return conn;
  if (conn.fresh) return conn;
  dbg("token stale — requesting refresh via background");
  try {
    chrome.runtime.sendMessage({ type: "CP_ASSIST_TOKEN_REFRESH", origin: conn.origin }).catch(() => {});
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 900));
  const retry = await refreshConnection();
  dbg("token after refresh attempt:", retry.fresh ? "fresh" : "still stale", "has token:", !!retry.token);
  return retry;
}

async function callApi(origin, token, payload) {
  const res = await fetch(`${origin}/api/interview/assist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function getSpeechRecognition() {
  const w = window;
  const Ctor =
    (w.SpeechRecognition && w.SpeechRecognition) ||
    (w.webkitSpeechRecognition && w.webkitSpeechRecognition);
  return Ctor ? new Ctor() : null;
}

function setPillState(state) {
  const dot = $("dot");
  if (state === "live") {
    $("pillText").textContent = interimText ? "Speaking…" : "Listening…";
    $("pillDot").className = "pill-dot pulse";
    dot.className = "dot pulse";
  } else if (state === "wait") {
    $("pillText").textContent = "Generating…";
    $("pillDot").className = "pill-dot wait";
    dot.className = "dot";
  } else {
    $("pillText").textContent = "Start listening";
    $("pillDot").className = "pill-dot off";
    dot.className = "dot";
  }
}

function renderTranscript() {
  const live = finalizedText + (interimText ? " " + interimText : "");
  $("transcript").textContent = live.trim();
  $("clearBtn").classList.toggle("hidden", !live.trim());
  // Live "Speaking" indicator while interim words are flowing.
  $("speakInd").classList.toggle("hidden", !interimText || !listening);
  if (minimized && listening) {
    $("pillText").textContent = interimText ? "Speaking…" : "Listening…";
  }
  const box = $("transcript");
  box.scrollTop = box.scrollHeight;
}

function showError(message) {
  const node = $("errorBox");
  node.textContent = message;
  show("errorBox");
}

function hideError() {
  hide("errorBox");
}

function setBusy(value) {
  busy = value;
  $("listenBtn").disabled = value;
}

async function autoCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard blocked — ignore, per-entry Copy buttons still work
  }
}

function renderHistory() {
  const list = $("historyList");
  list.innerHTML = "";
  if (!history.length) {
    hide("historyBox");
    return;
  }
  show("historyBox");
  for (const entry of history) {
    const card = document.createElement("div");
    card.className = "qa-entry";

    const q = document.createElement("div");
    q.className = "qa-q";
    q.textContent = entry.question;
    card.appendChild(q);

    const a = document.createElement("div");
    a.className = "qa-a";
    a.textContent = entry.answer;
    card.appendChild(a);

    const meta = document.createElement("div");
    meta.className = "qa-meta";
    meta.textContent = `via ${entry.provider || "AI"}${entry.model ? ` · ${entry.model}` : ""}`;
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "qa-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "ghost";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(entry.answer).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
      }).catch(() => {});
    });
    actions.appendChild(copyBtn);

    const regenBtn = document.createElement("button");
    regenBtn.className = "ghost";
    regenBtn.textContent = "Regenerate";
    regenBtn.addEventListener("click", () => {
      void regenerate(entry);
    });
    actions.appendChild(regenBtn);

    card.appendChild(actions);
    list.appendChild(card);
  }
}

function addHistoryEntry(question, answer, provider, model) {
  history.unshift({ question, answer, provider, model });
  renderHistory();
}

async function generateAnswer(forceRegenerate) {
  if (busy) return;
  const question = finalizedText.trim();
  if (!question) return;
  if (!forceRegenerate && question === lastGeneratedText) return;
  dbg("generateAnswer: question=", JSON.stringify(question), "tone=", tone);

  const conn = await ensureFreshToken();
  if (!conn.ok || !conn.token) {
    showError("Not connected. Open the dashboard, log in, then press Reconnect.");
    return;
  }

  setBusy(true);
  setPillState("wait");
  hideError();

  try {
    dbg("generateAnswer: calling API at", conn.origin, "token fresh:", conn.fresh);
    const data = await callApi(conn.origin, conn.token, {
      question,
      mode: "assist",
      tone,
    });
    dbg("generateAnswer: response success=", data && data.success);
    if (!data || data.success === false) {
      showError((data && data.message) || "Request failed. Is the dev server running?");
      return;
    }
    const d = data.data || {};
    const draft = d.draft || "";
    const provider = d.provider || "AI";
    const model = d.model || "";
    addHistoryEntry(question, draft, provider, model);
    lastGeneratedText = question;
    lastAnsweredAt = Date.now();
    if (minimized) exitPillMode();
    dbg("generateAnswer: draft len=", draft.length, "provider=", provider, "model=", model);
    await autoCopy(draft);
  } catch (err) {
    dbg("generateAnswer error:", err);
    showError("Network error: " + (err && err.message ? err.message : String(err)));
  } finally {
    setBusy(false);
    setPillState(listening ? "live" : "off");
  }
}

async function regenerate(entry) {
  if (busy) return;
  dbg("regenerate: question=", JSON.stringify(entry.question));
  const conn = await ensureFreshToken();
  if (!conn.ok || !conn.token) {
    showError("Not connected. Open the dashboard, log in, then press Reconnect.");
    return;
  }
  setBusy(true);
  setPillState("wait");
  hideError();
  try {
    const data = await callApi(conn.origin, conn.token, {
      question: entry.question,
      mode: "assist",
      tone,
    });
    dbg("regenerate: response success=", data && data.success);
    if (!data || data.success === false) {
      showError((data && data.message) || "Request failed. Is the dev server running?");
      return;
    }
    const d = data.data || {};
    const updated = { ...entry, answer: d.draft || "", provider: d.provider || "AI", model: d.model || "" };
    const idx = history.findIndex((e) => e === entry);
    if (idx >= 0) history[idx] = updated;
    renderHistory();
    if (minimized) exitPillMode();
    await autoCopy(updated.answer);
  } catch (err) {
    dbg("regenerate error:", err);
    showError("Network error: " + (err && err.message ? err.message : String(err)));
  } finally {
    setBusy(false);
    setPillState(listening ? "live" : "off");
  }
}

function startListening() {
  const Ctor = getSpeechRecognition();
  if (!Ctor) {
    showError("Speech recognition isn't supported in this browser. Use Chrome.");
    return;
  }
  dbg("startListening: SpeechRecognition available");
  runMicProbe();

  const r = Ctor;
  r.continuous = true;
  r.interimResults = true;
  r.lang = "en-US";

  // Lifecycle debug hooks.
  r.onstart = () => dbg("EVT onstart");
  r.onaudiostart = () => dbg("EVT onaudiostart");
  r.onsoundstart = () => dbg("EVT onsoundstart");
  r.onspeechstart = () => dbg("EVT onspeechstart");
  r.onspeechend = () => dbg("EVT onspeechend");

  r.onresult = (event) => {
    dbg("EVT onresult  results=", event && event.results && event.results.length);
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const chunk = result[0] && result[0].transcript ? result[0].transcript : "";
      if (result.isFinal) final += chunk;
      else interim += chunk;
    }
    if (final) {
      finalizedText = (finalizedText ? finalizedText + " " : "") + final.trim();
      interimText = "";
    }
    interimText = interim.trim();
    if (final || interim) lastActivityAt = Date.now();
    dbg("onresult LIVE >>", JSON.stringify({ final: final.trim(), interim: interim.trim() }));
    dbg("onresult full >>", JSON.stringify(finalizedText + (interimText ? " " + interimText : "")));
    renderTranscript();
  };

  r.onerror = (event) => {
    dbg("EVT onerror:", event && event.error, event && event.message);
    if (event && (event.error === "not-allowed" || event.error === "service-not-allowed")) {
      stopListening();
      showError("Microphone access was blocked. Allow mic access and press Start listening again.");
    } else if (event && event.error === "no-speech") {
      // Chrome fires this sometimes; the restart loop below recovers.
    }
  };

  r.onend = () => {
    dbg("EVT onend; listening=", listening);
    if (listening) {
      try {
        r.start();
        dbg("recognition restarted after onend");
      } catch {
        stopListening();
      }
    }
  };

  rec = r;
  listening = true;
  interimText = "";
  $("listenLabel").textContent = "Listening… (click to stop)";
  setPillState("live");
  hideError();
  try {
    r.start();
    dbg("recognition started");
  } catch (err) {
    dbg("recognition start threw:", err);
    stopListening();
  }
}

// Probe the microphone directly (getUserMedia + AnalyserNode) to confirm the
// mic produces signal at all. Logs permission state and live volume.
let micProbeStream = null;
async function runMicProbe() {
  try {
    const perms = navigator.permissions && await navigator.permissions.query({ name: "microphone" });
    dbg("mic permission state:", perms && perms.state);
  } catch (err) {
    dbg("permissions.query mic error:", err);
  }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      dbg("getUserMedia NOT available — this browser blocks mic in extension pages");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micProbeStream = stream;
    dbg("getUserMedia OK — got mic stream, tracks:", stream.getAudioTracks().length);
    stream.getAudioTracks().forEach((t) => dbg("  track:", t.label, "enabled:", t.enabled, "state:", t.readyState));
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let silentTicks = 0;
    const meter = window.setInterval(() => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      if (rms > 0.02) {
        silentTicks = 0;
        dbg("MIC LEVEL rms=", rms.toFixed(3), "(audio detected!)");
      } else {
        silentTicks += 1;
        if (silentTicks % 10 === 1) dbg("MIC LEVEL rms=", rms.toFixed(3), "(silent — check mic/input device)");
      }
    }, 500);
    window.__stopMicProbe = () => { window.clearInterval(meter); ctx.close().catch(() => {}); stream.getTracks().forEach((t) => t.stop()); };
  } catch (err) {
    dbg("getUserMedia FAILED:", err && err.name, err && err.message);
    showError("Microphone error: " + (err && err.name ? err.name : String(err)) + ". Check Chrome's mic permission for this extension.");
  }
}

function stopListening() {
  dbg("stopListening");
  listening = false;
  interimText = "";
  if (rec) {
    try { rec.abort(); } catch {}
    rec = null;
  }
  if (window.__stopMicProbe) {
    try { window.__stopMicProbe(); } catch {}
    window.__stopMicProbe = null;
  }
  $("listenLabel").textContent = "Start listening";
  setPillState("off");
  renderTranscript();
}

function toggleListening() {
  dbg("toggleListening; currently listening=", listening);
  if (listening) stopListening();
  else void refreshConnection().then(() => startListening());
}

function openDashboard() {
  chrome.storage.local.get("assistOrigin", ({ assistOrigin }) => {
    const base = assistOrigin || DEFAULT_ORIGIN;
    chrome.tabs.create({ url: `${base}/dashboard/client-assistant` });
  });
}

function initDrag() {
  const handle = $("dragHandle");
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let winLeft = 0;
  let winTop = 0;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.screenX;
    startY = e.screenY;
    getWindow().then((win) => {
      if (!win) { dragging = false; return; }
      winLeft = win.left || 0;
      winTop = win.top || 0;
    });
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    chrome.runtime.sendMessage({
      type: "CP_ASSIST_MOVE_WINDOW",
      left: winLeft + dx,
      top: winTop + dy,
    }).catch(() => {});
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  dbg("DOMContentLoaded — window initialized");
  $("listenBtn").addEventListener("click", toggleListening);
  $("minimizeBtn").addEventListener("click", enterPillMode);
  $("closeBtn").addEventListener("click", () => {
    stopListening();
    chrome.storage.local.set({ autoOpenListener: false }, () => window.close());
  });
  $("pillExpandBtn").addEventListener("click", exitPillMode);
  $("clearBtn").addEventListener("click", () => {
    finalizedText = "";
    interimText = "";
    lastGeneratedText = "";
    renderTranscript();
  });
  $("openDash").addEventListener("click", openDashboard);
  $("tone").addEventListener("change", (e) => { tone = e.target.value; });

  // Hotkey toggle from background (Ctrl+Shift+Space).
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "CP_ASSIST_TOGGLE_LISTEN") {
      toggleListening();
    }
  });

  initDrag();
  setPillState("off");
  void refreshConnection();

  // Auto-generate when the client pauses.
  setInterval(() => {
    if (!listening || busy) return;
    const now = Date.now();
    const sinceActivity = now - lastActivityAt;
    const sinceAnswer = now - lastAnsweredAt;
    const question = finalizedText.trim();
    if (!question) return;
    if (sinceActivity < SILENCE_MS) return;
    if (sinceAnswer < MIN_QUESTION_MS) return;
    if (question === lastGeneratedText) return;
    dbg("silence detected, auto-generating for question=", JSON.stringify(question));
    void generateAnswer(false);
  }, 400);
});
