import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";

const EXT_BRIDGE_PING_TIMEOUT_MS = 4500;
const EXT_BRIDGE_ACK_TIMEOUT_MS = 5000;

type SyncUser = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  currentCity?: string | null;
  addressLine?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
};

type SyncResult = {
  ok: boolean;
  error?: string;
  installed?: boolean;
};

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWords(label: string, words: string[]) {
  return words.every((word) => label.includes(word));
}

function toQuestionKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  if (normalized === "full name" || normalized === "full legal name" || normalized === "legal name") return "full_name";
  if (normalized === "first name" || normalized === "given name") return "first_name";
  if (normalized === "last name" || normalized === "family name" || normalized === "surname") return "last_name";
  if (normalized === "email" || normalized === "email address") return "email_address";
  if (
    normalized === "phone" ||
    normalized === "phone number" ||
    normalized === "mobile phone" ||
    normalized === "mobile phone number" ||
    normalized === "contact number"
  ) {
    return "phone_number";
  }
  if (normalized.includes("linkedin") && (normalized.includes("profile") || normalized.includes("url"))) return "linkedin_url";
  if (
    normalized.includes("portfolio") &&
    (normalized.includes("url") || normalized.includes("website") || normalized.includes("site") || normalized === "portfolio")
  ) {
    return "portfolio_url";
  }
  if (normalized === "current city" || normalized === "city" || normalized.includes("location city") || normalized.includes("city state")) {
    return "current_city";
  }
  if (normalized === "state" || normalized === "state region" || normalized === "region") return "state_region";
  if (normalized === "country") return "country";
  if (
    (hasWords(normalized, ["authorized", "work"]) || hasWords(normalized, ["eligible", "work"]) || hasWords(normalized, ["work", "authorization"])) &&
    (normalized.includes("united states") || normalized.includes("u s") || normalized.includes("us"))
  ) {
    return "work_authorization_us";
  }
  if (hasWords(normalized, ["visa", "sponsorship"]) || hasWords(normalized, ["require", "sponsorship"])) return "visa_sponsorship_required";
  if (normalized.includes("onsite") || normalized.includes("on site")) return "comfortable_working_onsite";
  if (normalized.includes("commut")) return "comfortable_commuting";
  if (normalized.includes("relocat")) return "comfortable_relocation";
  if ((normalized.includes("salary") || normalized.includes("compensation") || normalized.includes("pay")) && normalized.includes("expect")) {
    return "expected_salary";
  }
  if (normalized.includes("year") && normalized.includes("experience")) return "years_of_experience";
  if (normalized.includes("bachelor") && normalized.includes("degree")) return "bachelors_degree_completed";
  if (normalized.includes("english") && normalized.includes("proficiency")) return "english_proficiency";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160);
}

function pickFirstNonEmpty(answers: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const direct = String(answers[key] || "").trim();
    if (direct) return direct;
    const normalized = normalizeLabel(key);
    const viaNormalized = String((answers as any)[normalized] || "").trim();
    if (viaNormalized) return viaNormalized;
  }
  return "";
}

function splitFullName(value: string) {
  const parts = String(value || "").trim().split(/\s+/g).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseSearchTermsInput(value: string) {
  return String(value || "").split(/[,\n;|]+/g).map((item) => item.trim()).filter(Boolean).slice(0, 25);
}

function parsePreferenceListInput(value: string) {
  return String(value || "").split(/[,\n;|]+/g).map((item) => item.trim()).filter(Boolean).slice(0, 25);
}

function isRemoteLikeValue(value: string) {
  const normalized = normalizeLabel(value);
  return normalized === "remote" || normalized === "work from home" || normalized === "wfh" || normalized === "anywhere" || normalized === "worldwide";
}

function sanitizeLocationFilterValues(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => !isRemoteLikeValue(value))
    .filter((value) => {
      const normalized = normalizeLabel(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 25);
}

function derivePhoneCountryCode(phone?: string) {
  const raw = String(phone || "").trim();
  if (!raw) return "+91";
  if (raw.startsWith("+")) {
    const m = raw.match(/^\+\d{1,3}/);
    return m ? m[0] : "+91";
  }
  return "+91";
}

function derivePhoneNumber(phone?: string) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

export async function syncProfileToExtension(
  user: SyncUser,
  screeningAnswers: Record<string, string>,
): Promise<SyncResult> {
  if (typeof window === "undefined") return { ok: false, error: "Not in browser" };

  let snapshot = await collectExtensionBridgeSnapshot({
    timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
    settleMs: 500,
    requestIdPrefix: "cp_overview",
  });
  if (!snapshot.installed) {
    snapshot = await collectExtensionBridgeSnapshot({
      timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
      settleMs: 500,
      requestIdPrefix: "cp_overview_retry",
    });
  }
  if (!snapshot.installed) {
    return { ok: false, installed: false, error: "Extension not detected. Install and open LinkedIn first." };
  }

  const mergedAnswers: Record<string, string> = { ...screeningAnswers };

  const preferredSearchLocation = pickFirstNonEmpty(mergedAnswers, ["cp_pref_search_location", "careerpilot_preference_search_location"]);
  const preferredSearchTermsRaw = pickFirstNonEmpty(mergedAnswers, ["cp_pref_search_terms", "preferred_job_titles", "careerpilot_preference_search_terms"]);
  const preferredSearchTerms = parseSearchTermsInput(preferredSearchTermsRaw);
  const preferredLocations = parsePreferenceListInput(
    pickFirstNonEmpty(mergedAnswers, ["cp_pref_search_locations", "cp_pref_search_location", "preferred_locations"]),
  );
  const preferredJobTypes = parsePreferenceListInput(pickFirstNonEmpty(mergedAnswers, ["cp_pref_job_types", "job_types"]));
  const preferredCountries = parsePreferenceListInput(pickFirstNonEmpty(mergedAnswers, ["cp_pref_preferred_countries", "preferred_countries"]));
  const preferredWorkMode = parsePreferenceListInput(
    pickFirstNonEmpty(mergedAnswers, ["cp_pref_work_mode", "remote_onsite_hybrid", "work_mode_preference"]),
  );
  const remoteModeSelected = preferredWorkMode.some((value) => normalizeLabel(value) === "remote");
  const preferredYearsOfExperience = pickFirstNonEmpty(mergedAnswers, [
    "cp_pref_years_of_experience",
    "careerpilot_preference_years_of_experience",
    "years_of_experience",
  ]);
  const preferredConfidenceLevel = pickFirstNonEmpty(mergedAnswers, ["cp_pref_confidence_level", "careerpilot_preference_confidence_level"]);
  const preferredRequireVisa = pickFirstNonEmpty(mergedAnswers, [
    "cp_pref_require_visa",
    "careerpilot_preference_need_visa_sponsorship",
    "careerpilot_preference_require_visa",
  ]);
  const preferredUsCitizenship = pickFirstNonEmpty(mergedAnswers, ["cp_pref_us_citizenship", "careerpilot_preference_us_work_authorization"]);

  const screeningAnswersForSync: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(mergedAnswers)) {
    const answer = String(rawValue || "").trim();
    if (!answer) continue;
    const canonicalKey = toQuestionKey(rawKey);
    if (!canonicalKey) continue;
    screeningAnswersForSync[canonicalKey] = answer;
  }
  if (preferredYearsOfExperience) {
    screeningAnswersForSync["years_of_experience"] = String(preferredYearsOfExperience).trim();
  }

  const fullName =
    pickFirstNonEmpty(mergedAnswers, ["full_name", "full legal name"]) ||
    String(user?.name || "").trim();
  const { firstName, lastName } = splitFullName(
    pickFirstNonEmpty(mergedAnswers, ["first_name"])
      ? `${pickFirstNonEmpty(mergedAnswers, ["first_name"])} ${pickFirstNonEmpty(mergedAnswers, ["last_name"])}`
      : fullName,
  );
  const phoneAnswer = pickFirstNonEmpty(mergedAnswers, ["phone_number", "phone", "mobile_phone_number"]);
  const currentCity = pickFirstNonEmpty(mergedAnswers, ["current_city", "your_location_city_state"]) || user?.currentCity || "";
  const linkedinUrl = pickFirstNonEmpty(mergedAnswers, ["linkedin_url", "linkedin_profile"]) || user?.linkedinUrl || "";
  const websiteUrl = pickFirstNonEmpty(mergedAnswers, ["portfolio_url"]) || user?.portfolioUrl || "";
  const streetAddress = pickFirstNonEmpty(mergedAnswers, ["address_line"]) || user?.addressLine || "";
  const stateRegion = pickFirstNonEmpty(mergedAnswers, ["state_region"]);
  const country = pickFirstNonEmpty(mergedAnswers, ["country"]);
  const resolvedSearchLocation =
    preferredSearchLocation || preferredLocations[0] || (!remoteModeSelected ? currentCity || preferredCountries[0] : "");
  const filterLocations = sanitizeLocationFilterValues(
    remoteModeSelected ? preferredLocations : [...preferredLocations, ...preferredCountries],
  );

  const badWordsRaw = pickFirstNonEmpty(mergedAnswers, ["bad_words", "exclude_keywords"]);
  const badWords = parsePreferenceListInput(badWordsRaw);
  const blacklistedCompaniesRaw = pickFirstNonEmpty(mergedAnswers, ["blacklisted_companies", "company_blacklist"]);
  const blacklistedCompanies = parsePreferenceListInput(blacklistedCompaniesRaw);
  const oneWordRaw = pickFirstNonEmpty(mergedAnswers, ["one_word_keywords", "keywords"]);
  const oneWordKeywords = parsePreferenceListInput(oneWordRaw);
  const twoWordsRaw = pickFirstNonEmpty(mergedAnswers, ["two_words_keywords", "search_phrases"]);
  const twoWordsKeywords = parsePreferenceListInput(twoWordsRaw);
  const skillsRaw = pickFirstNonEmpty(mergedAnswers, ["core_skills", "skills"]);
  const skills = parsePreferenceListInput(skillsRaw);

  const settingsPayload = {
    currentCity,
    searchLocation: resolvedSearchLocation,
    searchTerms: preferredSearchTerms,
    oneWordKeywords,
    twoWordsKeywords,
    skills,
    filterLocations,
    jobType: preferredJobTypes,
    onSite: preferredWorkMode,
    contactEmail: user?.email || "",
    phoneNumber: derivePhoneNumber(phoneAnswer || user?.phone),
    phoneCountryCode: derivePhoneCountryCode(phoneAnswer || user?.phone),
    marketingConsent: "Yes",
    requireVisa: preferredRequireVisa || "No",
    usCitizenship: preferredUsCitizenship || "",
    yearsOfExperienceAnswer: preferredYearsOfExperience || "",
    currentExperience: preferredYearsOfExperience ? Number.parseInt(String(preferredYearsOfExperience), 10) : -1,
    confidenceLevel: preferredConfidenceLevel || "",
    easyApplyOnly: true,
    debugMode: false,
    dryRun: false,
    autoSubmit: true,
    autoResumeOnAnswer: true,
    submitRateMinSec: 40,
    submitRateMaxSec: 70,
    maxApplicationsPerRun: 200,
    maxSkipsPerRun: 50,
    blacklistedCompanies,
    badWords,
    fullName,
    firstName,
    lastName,
    linkedinUrl,
    websiteUrl,
    streetAddress,
    stateRegion,
    country,
    screeningAnswers: screeningAnswersForSync,
  };

  const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
    const requestId = `cp_sync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "Extension did not acknowledge settings sync" });
    }, EXT_BRIDGE_ACK_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as any;
      if (!data || data.type !== "CP_WEB_SYNC_SETTINGS_ACK" || data.requestId !== requestId) return;
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve({ ok: Boolean(data.ok), error: data.error || undefined });
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "CP_WEB_SYNC_SETTINGS", requestId, settings: settingsPayload }, window.location.origin);
  });

  if (!ack.ok) {
    return { ok: false, installed: true, error: ack.error || "Failed to sync settings" };
  }

  return { ok: true, installed: true };
}
