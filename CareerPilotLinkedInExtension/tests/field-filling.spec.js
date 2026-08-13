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

test("field-filling: observe how location & city fields are filled during a run", async () => {
  test.setTimeout(120000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-ext-field-fill-"));
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
        searchLocation: "",
        filterLocations: [],
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

    // Read the final DOM state of every form field so we can see what the extension filled.
    const filledFields = await page.evaluate(() => {
      const city = document.getElementById("q-city");
      const phone = document.getElementById("q-phone");
      const pref = document.getElementById("q-pref-location");
      const checkboxes = Array.from(document.querySelectorAll("input[type='checkbox']")).map((cb) => ({
        name: String(cb.labels && cb.labels.length ? cb.labels[0].textContent : cb.id || "").trim(),
        checked: cb.checked
      }));
      return {
        q_city: city ? city.value : null,
        q_phone: phone ? phone.value : null,
        q_pref_location: pref ? pref.value : null,
        checkboxes
      };
    });

    // Snapshot settings AFTER the run: did the extension write any location-preference
    // answer into its own screeningAnswers while filling the form?
    const settingsSnapshot = await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get("cpSettings");
      const s = out?.cpSettings || {};
      const answers = s.screeningAnswers || {};
      return {
        currentCity: String(s.currentCity || "").trim(),
        searchLocation: String(s.searchLocation || "").trim(),
        filterLocations: Array.isArray(s.filterLocations) ? s.filterLocations : [],
        screeningAnswers: answers,
        locationKeys: {
          cp_pref_search_locations: String(answers.cp_pref_search_locations || "").trim(),
          preferred_locations: String(answers.preferred_locations || "").trim(),
          cp_pref_search_location: String(answers.cp_pref_search_location || "").trim(),
          current_city: String(answers.current_city || "").trim()
        }
      };
    });

    console.log("[field-fill] filledFields =", JSON.stringify(filledFields, null, 2));
    console.log("[field-fill] settingsSnapshot =", JSON.stringify(settingsSnapshot, null, 2));

    expect(filledFields.q_city).toBe("Chandigarh");
    expect(filledFields.q_phone).toBe("9876500001");
    expect(filledFields.q_pref_location).toBe("");

    // The location-preference answers must NOT be mutated/captured during a run:
    // the seeded value stays untouched and no new current_city / preferred_locations
    // entries get written to the extension's own screeningAnswers.
    expect(settingsSnapshot.locationKeys.cp_pref_search_locations).toBe("india");
    expect(settingsSnapshot.locationKeys.preferred_locations).toBe("");
    expect(settingsSnapshot.locationKeys.cp_pref_search_location).toBe("");

    await serviceWorker.evaluate(async () => {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_STOP" }, () => resolve(null));
      });
    });
  } finally {
    await context.close();
  }
});
