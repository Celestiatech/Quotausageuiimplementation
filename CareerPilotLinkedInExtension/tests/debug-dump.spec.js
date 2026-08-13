const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "linkedin-jobs-search-pref-location.html");

test("debug: dump state + logs after start", async () => {
  test.setTimeout(60000);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-ext-debug-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
  });
  try {
    const sw = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
    const html = fs.readFileSync(FIXTURE_PATH, "utf8");
    await context.route("https://www.linkedin.com/jobs/search/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));
    await context.route("https://www.linkedin.com/jobs/view/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));

    await sw.evaluate(async () => {
      const settings = { dryRun: true, autoSubmit: false, liveModeAcknowledged: true, enableBackendSync: false, debugMode: true, easyApplyOnly: true, followCompanies: false, pauseAtFailedQuestion: true, maxApplicationsPerRun: 1, maxSkipsPerRun: 20, datePosted: "Past week", sortBy: "", searchTerms: [], randomizeSearchOrder: false, currentCity: "Chandigarh", phoneNumber: "9876500001" };
      await new Promise((res) => chrome.runtime.sendMessage({ type: "CP_SAVE_SETTINGS", settings }, () => res(null)));
      const saved = await chrome.storage.local.get("cpSettings");
      await chrome.storage.local.set({ debugProbeA: { currentCity: String(saved?.cpSettings?.currentCity || ""), phoneNumber: String(saved?.cpSettings?.phoneNumber || "") } });
      const viaLoad = await new Promise((res) => chrome.runtime.sendMessage({ type: "CP_LOAD_SETTINGS" }, (r) => res(r)));
      await chrome.storage.local.set({ debugProbeB: { currentCity: String(viaLoad?.settings?.currentCity || ""), phoneNumber: String(viaLoad?.settings?.phoneNumber || "") } });
      await chrome.storage.local.set({ cpState: { running: false, paused: false, startedAt: null, applied: 0, skipped: 0, failed: 0, logs: [], lastError: null }, cpPendingQuestions: [], cpAppliedHistory: [], cpFailedHistory: [], cpExternalHistory: [], cpSkippedHistory: [] });
    });

    const page = await context.newPage();
    await page.goto("https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800", { waitUntil: "load" });
    await page.locator("#cp-linkedin-copilot-panel").waitFor({ timeout: 15000 });
    await page.locator("#cp-start").click();

    await page.waitForTimeout(20000);
    const snap = await sw.evaluate(async () => {
      const out = await chrome.storage.local.get(["cpState", "cpAppliedHistory", "cpSkippedHistory", "cpFailedHistory", "debugProbeA", "debugProbeB", "cpSettings"]);
      return {
        probeA: out.debugProbeA,
        probeB: out.debugProbeB,
        settingsCurrentCity: String(out.cpSettings?.currentCity || ""),
        settingsPhone: String(out.cpSettings?.phoneNumber || ""),
        state: out.cpState,
        applied: (out.cpAppliedHistory || []).length,
        skipped: (out.cpSkippedHistory || []).length,
        failed: (out.cpFailedHistory || []).length,
        logs: (out.cpState?.logs || []).slice(0, 60).map((l) => String(l?.message || l || ""))
      };
    });
    console.log(JSON.stringify(snap, null, 2));
  } finally {
    await context.close();
  }
});
