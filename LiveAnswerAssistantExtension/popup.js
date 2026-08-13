// Popup logic for the Live Answer Assistant extension.
"use strict";

const $ = (id) => document.getElementById(id);
const DASHBOARD_PATHS = {};

const DEFAULT_ORIGIN = "http://localhost:3000";

let state = {
  mode: "assist",
  tone: "detailed",
  busy: false,
};

function el(id) { return $(id); }

function show(id) { el(id).classList.remove("hidden"); }
function hide(id) { el(id).classList.add("hidden"); }

async function getStored() {
  return chrome.storage.local.get(["assistToken", "assistTokenAt", "assistOrigin"]);
}

async function setStatus(text, kind) {
  const node = el("connStatus");
  node.textContent = text;
  node.className = "status" + (kind ? ` ${kind}` : "");
}

async function refreshConnection() {
  const stored = await getStored();
  const token = stored.assistToken;
  const origin = stored.assistOrigin || DEFAULT_ORIGIN;
  if (!token) {
    await setStatus("Connect: open the dashboard & log in", "bad");
    return { ok: false, origin };
  }
  const ageMs = Date.now() - (Number(stored.assistTokenAt) || 0);
  const fresh = ageMs < 14 * 60 * 1000;
  await setStatus(
    fresh
      ? `Connected · ${new URL(origin).host}`
      : "Session expiring · reconnect to refresh",
    fresh ? "ok" : "bad",
  );
  return { ok: true, origin, token, fresh };
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

async function run() {
  if (state.busy) return;

  const question = el("question").value.trim();
  if (!question) {
    showError("Please enter the question first.");
    return;
  }

  const conn = await refreshConnection();
  if (!conn.ok || !conn.token) {
    showError("Not connected. Open the dashboard, log in, then press Reconnect.");
    return;
  }

  const payload = {
    question,
    mode: state.mode,
    tone: state.tone,
  };
  if (state.mode === "score") {
    const userAnswer = el("userAnswer").value.trim();
    if (!userAnswer) {
      showError("Type your spoken answer so it can be scored.");
      return;
    }
    payload.userAnswer = userAnswer;
  }

  setBusy(true);
  hide("errorBox");
  hide("resultBox");
  el("meta").textContent = "";

  try {
    const data = await callApi(conn.origin, conn.token, payload);
    if (!data || data.success === false) {
      if (data && (data.errorCode === "RATE_LIMITED" || data.status === 429)) {
        showError("Rate limit hit — wait a minute and try again.");
      } else if (data && data.message && /provider/i.test(data.message)) {
        showError(`AI provider error: ${data.message}`);
      } else {
        showError((data && data.message) || "Request failed. Is the dev server running?");
      }
      return;
    }

    const d = data.data || {};
    if (state.mode === "score") {
      renderScoreCard(d.scorecard);
      el("meta").textContent = providerMeta(d);
    } else {
      el("resultLabel").textContent = "Answer";
      el("resultText").textContent = d.draft || "";
      el("meta").textContent = providerMeta(d);
      show("resultBox");
    }
  } catch (err) {
    showError("Network error: " + (err && err.message ? err.message : String(err)));
  } finally {
    setBusy(false);
  }
}

function providerMeta(d) {
  if (!d) return "";
  const model = d.model ? ` · ${d.model}` : "";
  return `via ${d.provider || "AI"}${model}`;
}

function renderScoreCard(card) {
  if (!card) {
    el("resultLabel").textContent = "Feedback";
    el("resultText").textContent = "No feedback returned.";
    show("resultBox");
    return;
  }
  const lines = [];
  lines.push(`Score: ${card.score}/10`);
  lines.push("");
  if (Array.isArray(card.strengths) && card.strengths.length) {
    lines.push("What went well:");
    card.strengths.forEach((s) => lines.push(`  + ${s}`));
    lines.push("");
  }
  if (Array.isArray(card.improvements) && card.improvements.length) {
    lines.push("Improve:");
    card.improvements.forEach((s) => lines.push(`  - ${s}`));
    lines.push("");
  }
  if (card.modelAnswer) {
    lines.push("Stronger answer:");
    lines.push(card.modelAnswer);
  }
  el("resultLabel").textContent = "Scorecard";
  el("resultText").textContent = lines.join("\n");
  show("resultBox");
}

function showError(message) {
  el("errorBox").textContent = message;
  show("errorBox");
}

function setBusy(value) {
  state.busy = value;
  el("runBtn").disabled = value;
  el("spinner").classList.toggle("hidden", !value);
  el("runLabel").textContent = value ? (state.mode === "score" ? "Scoring…" : "Generating…") : (state.mode === "score" ? "Score my answer" : "Generate answer");
}

async function copyResult() {
  const text = el("resultText").textContent;
  try {
    await navigator.clipboard.writeText(text);
    el("copyBtn").textContent = "Copied!";
    setTimeout(() => { el("copyBtn").textContent = "Copy"; }, 1200);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function setMode(mode) {
  state.mode = mode;
  el("modeAssist").classList.toggle("chip-active", mode === "assist");
  el("modeScore").classList.toggle("chip-active", mode === "score");
  el("userAnswerField").classList.toggle("hidden", mode !== "score");
  el("runLabel").textContent = mode === "score" ? "Score my answer" : "Generate answer";
  el("resultLabel").textContent = mode === "score" ? "Scorecard" : "Answer";
}

function openDashboard() {
  chrome.storage.local.get("assistOrigin", ({ assistOrigin }) => {
    const base = assistOrigin || DEFAULT_ORIGIN;
    chrome.tabs.create({ url: `${base}/dashboard/client-assistant` });
  });
}

async function sendToDashboard() {
  const question = el("question").value.trim();
  if (!question) {
    showError("Please enter the question first.");
    return;
  }  hide("errorBox");
  setBusy(true);
  el("resultLabel").textContent = "Dashboard answer";
  el("resultText").textContent = "Sending to the Client Assistant page…";
  show("resultBox");
  el("meta").textContent = "";

  const stored = await getStored();
  const origin = stored.assistOrigin || DEFAULT_ORIGIN;

  const tabs = await chrome.tabs.query({});
  let target = null;
  for (const tab of tabs) {
    if (tab.id != null && tab.url && tab.url.startsWith(origin) && tab.url.includes("/dashboard")) {
      target = tab;
      break;
    }
  }

  if (!target) {
    // Open the Client Assistant page, then retry once it has loaded.
    const created = await chrome.tabs.create({ url: `${origin}/dashboard/client-assistant` });
    await new Promise((resolve) => setTimeout(resolve, 1800));
    target = created;
  }

  try {
    const resp = await chrome.tabs.sendMessage(target.id, {
      type: "CP_ASSIST_ASK_PAGE",
      question,
      tone: state.tone,
    });
    if (!resp || resp.ok === false) {
      throw new Error((resp && resp.error) || "No response from the dashboard page.");
    }
    el("resultText").textContent = resp.draft || "No answer returned.";
    el("meta").textContent = providerMeta(resp);
  } catch (err) {
    el("resultText").textContent = "";
    hide("resultBox");
    showError(
      "Couldn't reach the dashboard page: " +
        (err && err.message ? err.message : String(err)) +
        ". Open the Client Assistant page first, then retry.",
    );
  } finally {
    setBusy(false);
  }
}

async function openFloatingListener() {
  hide("errorBox");
  el("listenerSpinner").classList.remove("hidden");
  el("listenOpenLabel").textContent = "Opening…";
  try {
    await chrome.storage.local.set({ autoOpenListener: true });
    const resp = await chrome.runtime.sendMessage({ type: "CP_ASSIST_OPEN_LISTENER" });
    if (!resp || resp.ok === false) {
      throw new Error("No response from the background script.");
    }
    window.close();
  } catch (err) {
    el("listenOpenLabel").textContent = "Open floating listener";
    showError("Couldn't open the listener window: " + (err && err.message ? err.message : String(err)));
  } finally {
    el("listenerSpinner").classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  el("question").addEventListener("input", () => hide("errorBox"));
  el("tone").addEventListener("change", (e) => { state.tone = e.target.value; });
  el("modeAssist").addEventListener("click", () => setMode("assist"));
  el("modeScore").addEventListener("click", () => setMode("score"));
  el("listenOpenBtn").addEventListener("click", () => void openFloatingListener());
  el("runBtn").addEventListener("click", () => void run());
  el("sendDashBtn").addEventListener("click", () => void sendToDashboard());
  el("copyBtn").addEventListener("click", () => void copyResult());
  el("openDash").addEventListener("click", openDashboard);
  el("refreshBtn").addEventListener("click", async () => {
    const stored = await getStored();
    const origin = stored.assistOrigin || DEFAULT_ORIGIN;
    try {
      chrome.runtime.sendMessage({ type: "CP_ASSIST_TOKEN_REFRESH", origin }).catch(() => {});
    } catch {}
    await setStatus("Refreshing…");
    setTimeout(() => void refreshConnection(), 600);
  });

  setMode("assist");
  void refreshConnection();
});
