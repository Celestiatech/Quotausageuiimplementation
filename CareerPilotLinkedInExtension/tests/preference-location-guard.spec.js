const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "linkedin-jobs-search-pref-location.html");

function readFixture(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

async function getServiceWorker(context) {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  }
  return serviceWorker;
}

test("preference-location select is never auto-answered with the job's work location", async () => {
  test.setTimeout(120000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-ext-pref-loc-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  try {
    const serviceWorker = await getServiceWorker(context);
    expect(serviceWorker).toBeTruthy();

    const html = readFixture(FIXTURE_PATH);
    await context.route("https://www.linkedin.com/jobs/search/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await context.route("https://www.linkedin.com/jobs/view/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });

    await serviceWorker.evaluate(async () => {
      const settings = {
        dryRun: true,
        autoSubmit: false,
        liveModeAcknowledged: true,
        enableBackendSync: false,
        debugMode: true,
        easyApplyOnly: true,
        followCompanies: false,
        pauseAtFailedQuestion: true,
        maxApplicationsPerRun: 1,
        maxSkipsPerRun: 20,
        datePosted: "Past week",
        sortBy: "",
        searchTerms: [],
        randomizeSearchOrder: false,
        currentCity: "Chandigarh",
        phoneNumber: "9876500001",
        screeningAnswers: {
          cp_pref_search_locations: "india"
        }
      };
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_SAVE_SETTINGS", settings }, () => resolve(null));
      });
      await chrome.storage.local.set({
        cpState: {
          running: false,
          paused: false,
          startedAt: null,
          applied: 0,
          skipped: 0,
          failed: 0,
          logs: [],
          lastError: null
        },
        cpPendingQuestions: [],
        cpAppliedHistory: [],
        cpFailedHistory: [],
        cpExternalHistory: [],
        cpSkippedHistory: []
      });
    });

    const page = await context.newPage();
    await page.goto("https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800", { waitUntil: "load" });
    await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible();
    await page.locator("#cp-start").click();

    await expect.poll(async () => {
      return await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get([
          "cpAppliedHistory",
          "cpState"
        ]);
        const applied = Array.isArray(out.cpAppliedHistory) ? out.cpAppliedHistory : [];
        return {
          applied: applied.length,
          running: Boolean(out?.cpState?.running)
        };
      });
    }, { timeout: 90000 }).toEqual({ applied: 1, running: false });

    const prefSelectValue = await page.evaluate(() => {
      const el = document.getElementById("q-pref-location");
      return el ? el.value : null;
    });

    const settingsSnapshot = await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get("cpSettings");
      const answers = out?.cpSettings?.screeningAnswers || {};
      return {
        cp_pref_search_locations: String(answers.cp_pref_search_locations || "").trim(),
        preferred_locations: String(answers.preferred_locations || "").trim(),
        cp_pref_search_location: String(answers.cp_pref_search_location || "").trim()
      };
    });

    expect(prefSelectValue).toBe("");
    expect(settingsSnapshot.cp_pref_search_locations).toBe("india");
    expect(settingsSnapshot.preferred_locations).toBe("");
    expect(settingsSnapshot.cp_pref_search_location).toBe("");

    await serviceWorker.evaluate(async () => {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_STOP" }, () => resolve(null));
      });
    });
  } finally {
    await context.close();
  }
});
