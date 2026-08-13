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

function setStatus(text, ok = true) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.style.color = ok ? "#166534" : "#b91c1c";
}

function setValue(id, value = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
}

function getValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return String(el.value || "").trim();
}

let searchTermsValues = [];

function renderSearchTermsChips() {
  const chipsEl = document.getElementById("searchTermsChips");
  if (!chipsEl) return;
  chipsEl.innerHTML = "";
  searchTermsValues.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      searchTermsValues = searchTermsValues.filter((t) => t !== tag);
      renderSearchTermsChips();
    });
    chip.appendChild(remove);
    chipsEl.appendChild(chip);
  });
}

function initSearchTermsInput() {
  const input = document.getElementById("searchTermsInput");
  const box = document.getElementById("searchTermsTags");
  if (!input || !box) return;
  box.addEventListener("click", () => input.focus());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      e.preventDefault();
      const val = input.value.trim();
      if (!searchTermsValues.includes(val)) searchTermsValues.push(val);
      input.value = "";
      renderSearchTermsChips();
    }
    if (e.key === "Backspace" && !input.value && searchTermsValues.length) {
      searchTermsValues.pop();
      renderSearchTermsChips();
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim()) {
      const val = input.value.trim();
      if (!searchTermsValues.includes(val)) searchTermsValues.push(val);
      input.value = "";
      renderSearchTermsChips();
    }
  });
}

function setForm(settings) {
  setValue("workMode", Array.isArray(settings.onSite) && settings.onSite.length ? settings.onSite[0] : "");
  setValue("jobType", Array.isArray(settings.jobType) && settings.jobType.length ? settings.jobType[0] : "");
  setValue(
    "searchLocations",
    Array.isArray(settings.filterLocations) ? settings.filterLocations.join(", ") : "",
  );
  setValue("salaryMin", settings.salaryMin || "");
  setValue("salaryMax", settings.salaryMax || "");
  setValue("confidenceLevel", settings.confidenceLevel || "");
  searchTermsValues = Array.isArray(settings.searchTerms) ? [...settings.searchTerms] : [];
  renderSearchTermsChips();
}

function readForm() {
  const settings = {
    onSite: getValue("workMode") ? [getValue("workMode")] : [],
    jobType: getValue("jobType") ? [getValue("jobType")] : [],
    filterLocations: String(getValue("searchLocations") || "")
      .split(/[\n,]/g)
      .map((v) => v.trim())
      .filter(Boolean),
    salaryMin: getValue("salaryMin"),
    salaryMax: getValue("salaryMax"),
    confidenceLevel: getValue("confidenceLevel"),
    searchTerms: [...searchTermsValues],
    searchLocation: "",
  };

  return settings;
}

async function init() {
  const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
  if (loaded.ok) setForm(loaded.settings || {});
}

function installAutoRefresh() {
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      if (!changes || !changes.cpSettings) return;
      void (async () => {
        const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
        if (loaded.ok) {
          setForm(loaded.settings || {});
          setStatus("Settings updated (synced).");
        }
      })();
    });
  } catch {
    // ignore
  }

  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      void init();
    });
  } catch {
    // ignore
  }
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("searchTermsInput");
  if (input && input.value.trim()) {
    const val = input.value.trim();
    if (!searchTermsValues.includes(val)) searchTermsValues.push(val);
    input.value = "";
    renderSearchTermsChips();
  }
  const settings = readForm();
  if (!settings) return;
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings });
  if (saved.ok) {
    setStatus("Settings saved");
    return;
  }
  setStatus(saved.error || "Failed to save settings", false);
});

initSearchTermsInput();
init().catch(() => setStatus("Failed to load settings", false));
installAutoRefresh();
