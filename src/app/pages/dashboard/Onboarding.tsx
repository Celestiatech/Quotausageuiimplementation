import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Play,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ExtensionInstallGuide, type ExtensionInstallGuideStep } from "../../components/ExtensionInstallGuide";
import {
  DASHBOARD_TOUR_EVENT_NAME,
  DASHBOARD_TOUR_ONBOARDING_EXTENSION,
  consumeDashboardTourRequest,
} from "src/lib/dashboard-tour";

type TabKey = "profile" | "preferences" | "screening";

type ScreeningAnswerType = "text" | "boolean" | "number" | "choice" | "multiselect";
type ScreeningSource = "manual" | "linkedin_import" | "resume_parse" | "extension_capture" | "system";

type ScreeningAnswerApiItem = {
  questionKey?: string;
  questionLabel?: string;
  answer?: string;
  answerType?: ScreeningAnswerType;
  source?: ScreeningSource;
  lastUsed?: string;
  updatedAt?: string;
};

type PendingIssueItem = {
  questionKey?: string;
  questionLabel?: string;
  validationMessage?: string;
  updatedAt?: string;
};

type OnboardingProgressApi = {
  currentStep?: number;
  profileQuestionIndex?: number;
  preferences?: Record<string, unknown>;
  screeningRows?: Array<{
    questionKey?: string;
    questionLabel?: string;
    answer?: string;
  }>;
  savedAt?: string;
};

type OnboardingProfileApi = {
  user?: {
    name?: string;
    phone?: string;
    currentCity?: string;
    addressLine?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
  };
  progress?: OnboardingProgressApi | null;
};

type ExtensionStatus = {
  installed: boolean;
  runtimeId?: string;
  version?: string;
  linkedIn?: {
    hasLinkedInTab: boolean;
    hasJobsTab: boolean;
  };
};

type ExtensionReleaseMeta = {
  version: string;
  displayName: string;
  downloadFileName: string;
  downloadBaseName: string;
};

type ScreeningRow = {
  id: string;
  questionLabel: string;
  normalizedKey: string;
  answer: string;
  answerType: ScreeningAnswerType;
  source: ScreeningSource;
  lastUsed: string;
};

type PendingQuestion = {
  questionKey: string;
  questionLabel: string;
  validationMessage: string;
  updatedAt: string;
};

type MasterProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  addressLine: string;
  linkedinUrl: string;
  portfolioUrl: string;
  workAuthorizationUS: string;
  visaSponsorship: string;
  yearsOfExperience: string;
  englishProficiency: string;
  educationLevel: string;
  resumeUrl: string;
  preferredJobTitles: string[];
  preferredLocations: string[];
  workModePreference: string;
};

type JobPreferences = {
  searchTerms: string[];
  searchLocations: string[];
  confidenceLevel: string;
  yearsOfExperience: string;
  workMode: string;
  jobTypes: string[];
  salaryMin: string;
  salaryMax: string;
  preferredCountries: string[];
  excludedCompanies: string[];
  excludedKeywords: string[];
};

type ScreeningPayload = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType: ScreeningAnswerType;
  source: ScreeningSource;
  lastUsed?: string;
};

type WizardStep = {
  title: string;
  description: string;
  tab: TabKey;
};

const EXT_BRIDGE_PING_TIMEOUT_MS = 4500;
const EXT_BRIDGE_ACK_TIMEOUT_MS = 5000;
const EXTENSION_PACKAGE_PREFIX = "AutoApplyCVExtensionVersion";

function formatExtensionPackageName(version: string) {
  const normalized = String(version || "").trim();
  return normalized ? `${EXTENSION_PACKAGE_PREFIX}${normalized}` : EXTENSION_PACKAGE_PREFIX;
}

function formatExtensionPackageFileName(version: string) {
  return `${formatExtensionPackageName(version)}.zip`;
}

const WIZARD_STEPS: WizardStep[] = [
  { title: "Basic Details", description: "Name, email, phone, and location", tab: "profile" },
  { title: "Work Eligibility", description: "Work authorization and sponsorship", tab: "profile" },
  { title: "Experience", description: "Years, education, and English", tab: "profile" },
  { title: "Job Preferences", description: "Titles, locations, remote/onsite", tab: "preferences" },
  { title: "Saved Answers", description: "Reusable LinkedIn screening answers", tab: "screening" },
  { title: "Resume + LinkedIn", description: "Resume status and profile links", tab: "profile" },
];

const PROFILE_KEY_LABELS: Array<{ key: keyof MasterProfile; label: string; answerType?: ScreeningAnswerType }> = [
  { key: "fullName", label: "Full Name" },
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "email", label: "Email Address" },
  { key: "phone", label: "Phone Number" },
  { key: "city", label: "Current City" },
  { key: "state", label: "State / Region" },
  { key: "country", label: "Country" },
  { key: "addressLine", label: "Address Line" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "portfolioUrl", label: "Portfolio URL" },
  { key: "workAuthorizationUS", label: "U.S. Work Authorization", answerType: "choice" },
  { key: "visaSponsorship", label: "Need Visa Sponsorship", answerType: "boolean" },
  { key: "yearsOfExperience", label: "Years of Experience", answerType: "number" },
  { key: "englishProficiency", label: "English Proficiency", answerType: "choice" },
  { key: "educationLevel", label: "Education Level", answerType: "choice" },
  { key: "resumeUrl", label: "Resume URL" },
  { key: "workModePreference", label: "Remote / Onsite / Hybrid", answerType: "choice" },
];

const PREFERENCE_KEY_LABELS: Array<{ key: keyof JobPreferences; questionKey: string; label: string; answerType?: ScreeningAnswerType }> = [
  { key: "searchTerms", questionKey: "cp_pref_search_terms", label: "Preferred Job Titles / Search Terms", answerType: "multiselect" },
  { key: "searchLocations", questionKey: "cp_pref_search_locations", label: "Preferred Locations", answerType: "multiselect" },
  { key: "yearsOfExperience", questionKey: "cp_pref_years_of_experience", label: "Years of Experience", answerType: "number" },
  { key: "workMode", questionKey: "cp_pref_work_mode", label: "Remote / Onsite / Hybrid", answerType: "choice" },
  { key: "jobTypes", questionKey: "cp_pref_job_types", label: "Job Types", answerType: "multiselect" },
  { key: "salaryMin", questionKey: "cp_pref_salary_min", label: "Salary Range Min", answerType: "number" },
  { key: "salaryMax", questionKey: "cp_pref_salary_max", label: "Salary Range Max", answerType: "number" },
  { key: "preferredCountries", questionKey: "cp_pref_preferred_countries", label: "Preferred Countries", answerType: "multiselect" },
  { key: "excludedCompanies", questionKey: "cp_pref_excluded_companies", label: "Excluded Companies", answerType: "multiselect" },
  { key: "excludedKeywords", questionKey: "cp_pref_excluded_keywords", label: "Excluded Keywords", answerType: "multiselect" },
];

const LEGACY_PREFERENCE_KEYS = {
  searchTerms: "cp_pref_search_terms",
  searchLocation: "cp_pref_search_location",
  yearsOfExperience: "cp_pref_years_of_experience",
  requireVisa: "cp_pref_require_visa",
  usCitizenship: "cp_pref_us_citizenship",
  desiredSalary: "cp_pref_desired_salary",
  confidenceLevel: "cp_pref_confidence_level",
};

const WORK_MODE_OPTIONS = ["Remote", "Hybrid", "Onsite", "Flexible"];
const JOB_TYPE_OPTIONS = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
const ENGLISH_PROFICIENCY_OPTIONS = ["Native or bilingual", "Professional", "Limited", "Basic"];
const EDUCATION_LEVEL_OPTIONS = [
  "High School",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate",
  "Diploma / Certificate",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRemoteLikeValue(value: string) {
  const normalized = normalizeLabel(value);
  return (
    normalized === "remote" ||
    normalized === "work from home" ||
    normalized === "wfh" ||
    normalized === "anywhere" ||
    normalized === "worldwide"
  );
}

function isRemoteWorkModeSelected(value: string) {
  return normalizeLabel(value) === "remote";
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

function slugifyKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  return normalized.replace(/\s+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160);
}

function hasWords(label: string, words: string[]) {
  return words.every((word) => label.includes(word));
}

function canonicalizeQuestionKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";

  if (
    (hasWords(normalized, ["authorized", "work"]) ||
      hasWords(normalized, ["eligible", "work"]) ||
      hasWords(normalized, ["work", "authorization"])) &&
    (normalized.includes("united states") || normalized.includes("u s") || normalized.includes("us"))
  ) {
    return "work_authorization_us";
  }
  if (hasWords(normalized, ["visa", "sponsorship"]) || hasWords(normalized, ["require", "sponsorship"])) {
    return "visa_sponsorship_required";
  }
  if (normalized.includes("onsite") || normalized.includes("on site")) {
    return "comfortable_working_onsite";
  }
  if (normalized.includes("commut") || normalized.includes("travel to office")) {
    return "comfortable_commuting";
  }
  if (normalized.includes("relocat")) {
    return "comfortable_relocation";
  }
  if ((normalized.includes("salary") || normalized.includes("compensation") || normalized.includes("pay")) && normalized.includes("expect")) {
    return "expected_salary";
  }
  if (normalized.includes("year") && normalized.includes("experience")) {
    return "years_of_experience";
  }
  if (normalized.includes("bachelor") && normalized.includes("degree")) {
    return "bachelors_degree_completed";
  }
  if (normalized.includes("english") && normalized.includes("proficiency")) {
    return "english_proficiency";
  }
  if (normalized.includes("notice") && normalized.includes("period")) {
    return "notice_period_days";
  }
  if (normalized.includes("start") && normalized.includes("date")) {
    return "start_date_availability";
  }

  return slugifyKey(normalized);
}

function inferAnswerType(answer: string): ScreeningAnswerType {
  const value = String(answer || "").trim();
  if (!value) return "text";
  const lower = value.toLowerCase();
  if (lower === "yes" || lower === "no") return "boolean";
  if (/^\d+(\.\d+)?$/.test(value)) return "number";
  if (value.includes(",")) return "multiselect";
  return "text";
}

function parseTags(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,|;]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function stringifyTags(value: string[]) {
  return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

function splitName(fullName: string) {
  const tokens = String(fullName || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (!tokens.length) return { firstName: "", lastName: "" };
  return {
    firstName: tokens[0] || "",
    lastName: tokens.slice(1).join(" "),
  };
}

function splitCityState(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return { city: "", state: "" };
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { city: raw, state: "" };
  return { city: parts[0], state: parts.slice(1).join(", ") };
}

function combineCityState(city: string, state: string) {
  const c = String(city || "").trim();
  const s = String(state || "").trim();
  if (!c && !s) return "";
  if (!s) return c;
  if (!c) return s;
  return `${c}, ${s}`;
}

function isValidUrl(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function extractPhoneCountryCode(value: string) {
  const raw = String(value || "").trim();
  const plus = raw.match(/^\+\d{1,3}/);
  return plus ? plus[0] : "+1";
}

function extractPhoneNumber(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

function toTitleCase(input: string) {
  return String(input || "")
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function friendlyLabel(questionKey: string, questionLabel: string) {
  const cleanLabel = String(questionLabel || "").trim();
  if (cleanLabel) return cleanLabel;
  const key = String(questionKey || "").trim();
  if (!key) return "Screening Question";

  const prettyByKnownKey: Record<string, string> = {
    work_authorization_us: "U.S. Work Authorization",
    visa_sponsorship_required: "Need Visa Sponsorship",
    comfortable_working_onsite: "Comfortable Working Onsite",
    comfortable_commuting: "Comfortable Commuting",
    comfortable_relocation: "Comfortable Relocation",
    expected_salary: "Expected Salary",
    years_of_experience: "Years of Experience",
    bachelors_degree_completed: "Bachelor's Degree Completed",
    english_proficiency: "English Proficiency",
    start_date_availability: "Start Date Availability",
    cp_pref_search_terms: "Preferred Job Titles / Search Terms",
    cp_pref_search_location: "Primary Search Location",
    cp_pref_search_locations: "Preferred Locations",
    cp_pref_years_of_experience: "Years of Experience",
    cp_pref_require_visa: "Need Visa Sponsorship",
    cp_pref_us_citizenship: "U.S. Work Authorization",
    cp_pref_desired_salary: "Desired Salary",
    cp_pref_confidence_level: "Confidence Level",
    cp_pref_work_mode: "Remote / Onsite / Hybrid",
    cp_pref_job_types: "Job Types",
    cp_pref_salary_min: "Salary Range Min",
    cp_pref_salary_max: "Salary Range Max",
    cp_pref_preferred_countries: "Preferred Countries",
    cp_pref_excluded_companies: "Excluded Companies",
    cp_pref_excluded_keywords: "Excluded Keywords",
  };
  return prettyByKnownKey[key] || toTitleCase(key);
}

function compactAnswer(value: string, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function toPayloadQuestionKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("cp_pref_")) return raw;
  return canonicalizeQuestionKey(raw);
}

function getSuggestedAnswer(question: PendingQuestion, profile: MasterProfile, preferences: JobPreferences, existingRows: ScreeningRow[]) {
  const normalizedKey = toPayloadQuestionKey(question.questionKey || question.questionLabel);
  const label = normalizeLabel(question.questionLabel);

  const existing = existingRows.find((row) => toPayloadQuestionKey(row.normalizedKey) === normalizedKey && row.answer.trim());
  if (existing) return existing.answer;

  if (normalizedKey === "work_authorization_us") return profile.workAuthorizationUS || "";
  if (normalizedKey === "visa_sponsorship_required") return profile.visaSponsorship || "No";
  if (normalizedKey === "comfortable_working_onsite") return preferences.workMode === "Remote" ? "No" : "Yes";
  if (normalizedKey === "comfortable_commuting") return preferences.workMode === "Remote" ? "No" : "Yes";
  if (normalizedKey === "comfortable_relocation") return preferences.workMode === "Remote" ? "No" : "Yes";
  if (normalizedKey === "years_of_experience") return profile.yearsOfExperience || preferences.yearsOfExperience || "";
  if (normalizedKey === "expected_salary") {
    if (preferences.salaryMin && preferences.salaryMax) return `${preferences.salaryMin}-${preferences.salaryMax}`;
    return preferences.salaryMax || preferences.salaryMin || "";
  }
  if (normalizedKey === "bachelors_degree_completed") {
    const edu = normalizeLabel(profile.educationLevel);
    if (!edu) return "";
    if (
      edu.includes("bachelor") ||
      edu.includes("master") ||
      edu.includes("doctor") ||
      edu.includes("mca") ||
      edu.includes("btech") ||
      edu.includes("be")
    ) {
      return "Yes";
    }
    return "No";
  }
  if (normalizedKey === "english_proficiency") return profile.englishProficiency || "Professional";

  if (label.includes("visa") || label.includes("sponsorship")) return profile.visaSponsorship || "No";
  if (label.includes("authorized") && label.includes("work")) return profile.workAuthorizationUS || "";
  if (label.includes("salary") || label.includes("compensation") || label.includes("pay")) {
    if (preferences.salaryMin && preferences.salaryMax) return `${preferences.salaryMin}-${preferences.salaryMax}`;
    return preferences.salaryMax || preferences.salaryMin || "";
  }
  if (label.includes("experience") && label.includes("year")) return profile.yearsOfExperience || preferences.yearsOfExperience || "";
  if (label.includes("onsite") || label.includes("on site")) return preferences.workMode === "Remote" ? "No" : "Yes";
  if (label.includes("commut") || label.includes("relocat")) return preferences.workMode === "Remote" ? "No" : "Yes";
  return "";
}

const SYSTEM_KEYS = new Set<string>([
  "full_name",
  "first_name",
  "last_name",
  "email_address",
  "phone_number",
  "current_city",
  "state_region",
  "country",
  "address_line",
  "linkedin_url",
  "portfolio_url",
  "work_authorization_us",
  "visa_sponsorship_required",
  "years_of_experience",
  "english_proficiency",
  "education_level",
  "resume_url",
  "preferred_job_titles",
  "preferred_locations",
  "work_mode_preference",
  "cp_pref_search_terms",
  "cp_pref_search_location",
  "cp_pref_search_locations",
  "cp_pref_years_of_experience",
  "cp_pref_require_visa",
  "cp_pref_us_citizenship",
  "cp_pref_desired_salary",
  "cp_pref_confidence_level",
  "cp_pref_work_mode",
  "cp_pref_job_types",
  "cp_pref_salary_min",
  "cp_pref_salary_max",
  "cp_pref_preferred_countries",
  "cp_pref_excluded_companies",
  "cp_pref_excluded_keywords",
]);

const DEFAULT_PROFILE: MasterProfile = {
  fullName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  country: "United States",
  addressLine: "",
  linkedinUrl: "",
  portfolioUrl: "",
  workAuthorizationUS: "",
  visaSponsorship: "No",
  yearsOfExperience: "",
  englishProficiency: "Professional",
  educationLevel: "",
  resumeUrl: "",
  preferredJobTitles: [],
  preferredLocations: [],
  workModePreference: "Remote",
};

const DEFAULT_PREFERENCES: JobPreferences = {
  searchTerms: [],
  searchLocations: [],
  confidenceLevel: "8",
  yearsOfExperience: "",
  workMode: "Remote",
  jobTypes: ["Full-time"],
  salaryMin: "",
  salaryMax: "",
  preferredCountries: [],
  excludedCompanies: [],
  excludedKeywords: [],
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [wizardStep, setWizardStep] = useState(0);
  const [profile, setProfile] = useState<MasterProfile>(DEFAULT_PROFILE);
  const [preferences, setPreferences] = useState<JobPreferences>(DEFAULT_PREFERENCES);
  const [screeningRows, setScreeningRows] = useState<ScreeningRow[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [savingAnswerKey, setSavingAnswerKey] = useState("");
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({ installed: false });
  const [extensionRelease, setExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "1.1.3",
    displayName: "AutoApply CV LinkedIn Copilot",
    downloadFileName: formatExtensionPackageFileName("1.1.3"),
    downloadBaseName: formatExtensionPackageName("1.1.3"),
  });
  const currentPackageBaseName =
    extensionRelease.downloadBaseName || formatExtensionPackageName(extensionRelease.version || "1.1.3");
  const currentPackageFileName =
    extensionRelease.downloadFileName || formatExtensionPackageFileName(extensionRelease.version || "1.1.3");
  const installedPackageName =
    extensionStatus.installed && extensionStatus.version ? formatExtensionPackageName(extensionStatus.version) : "";
  const checkExtensionButtonRef = useRef<HTMLButtonElement | null>(null);
  const saveAndFinishButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentPackageLabelRef = useRef<HTMLParagraphElement | null>(null);
  const downloadOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const downloadZipButtonRef = useRef<HTMLAnchorElement | null>(null);
  const openLinkedInJobsButtonRef = useRef<HTMLAnchorElement | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installGuideStepIndex, setInstallGuideStepIndex] = useState(0);
  const [installGuideCompletedIds, setInstallGuideCompletedIds] = useState<string[]>([]);

  const loadedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const canDownloadExtensionZip = Boolean(
    String(process.env.NEXT_PUBLIC_EXTENSION_ZIP_URL || "/api/public/extension-download").trim(),
  );

  const extensionZipUrl = String(process.env.NEXT_PUBLIC_EXTENSION_ZIP_URL || "/api/public/extension-download").trim();

  const installGuideSteps = useMemo<ExtensionInstallGuideStep[]>(
    () => [
      {
        id: "download-zip",
        title: "Download extension",
        body: `Download ${currentPackageFileName} from this page.`,
        note: "This is the ZIP file you will extract in the next step.",
        actionLabel: "Download current ZIP",
        targetRef: downloadZipButtonRef,
      },
      {
        id: "extract-folder",
        title: "Extract folder",
        body: "Extract the ZIP after downloading it.",
        note: `The extracted folder should look like ${currentPackageBaseName} and contain manifest.json.`,
        targetRef: currentPackageLabelRef,
      },
      {
        id: "open-chrome-extensions",
        title: "Load unpacked",
        body: "Open Chrome menu (three dots) > Extensions > Manage Extensions. Turn on Developer mode on the top-right, then click Load unpacked on the top-left.",
        note: `Select the extracted folder ${currentPackageBaseName}. This matches the screenshot: Developer mode on the right, Load unpacked on the left.`,
        actionLabel: "Download + Open Extensions",
        targetRef: downloadOpenButtonRef,
      },
      {
        id: "verify-install",
        title: "Check extension",
        body: "After the extension card appears in Chrome, click the extension icon, make sure you are signed in to LinkedIn, then come back here and click Check Extension.",
        note: installedPackageName
          ? `Detected right now: ${installedPackageName}. If this is the new version, click Step done.`
          : "If detection still fails, refresh this page and click Check Extension again, then click Step done.",
        actionLabel: checkingExtension ? "Checking..." : "Check extension",
        actionDisabled: checkingExtension,
        targetRef: checkExtensionButtonRef,
      },
    ],
    [checkingExtension, currentPackageBaseName, currentPackageFileName, installedPackageName],
  );

  const checkExtensionStatus = async (opts?: { silent?: boolean }) => {
    if (typeof window === "undefined") return;
    const silent = Boolean(opts?.silent);
    setCheckingExtension(true);
    try {
      const result = await new Promise<ExtensionStatus>((resolve) => {
        const requestId = `cp_onboarding_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let settled = false;

        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener("message", onMessage);
          resolve({ installed: false });
        }, EXT_BRIDGE_PING_TIMEOUT_MS);

        const onMessage = (event: MessageEvent) => {
          const data = event.data as any;
          if (!data || data.type !== "CP_WEB_PONG" || data.requestId !== requestId) return;
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          const bridgeError = String(data.error || "").trim();
          const runtimeBootstrapOk =
            Boolean(data.state) &&
            typeof data.state === "object" &&
            !Array.isArray(data.state);
          const installed = Boolean(data.installed) && !bridgeError && runtimeBootstrapOk;
          resolve({
            installed,
            runtimeId: data.runtimeId || undefined,
            version: data.extensionVersion || undefined,
            linkedIn: data.linkedIn || undefined,
          });
        };

        window.addEventListener("message", onMessage);
        window.postMessage({ type: "CP_WEB_PING", requestId }, window.location.origin);
      });

      setExtensionStatus(result);
      if (!silent && !result.installed) {
        setMessage("Extension not detected yet. You can still complete onboarding and sync later.");
      }
    } finally {
      setCheckingExtension(false);
    }
  };

  const onInstallOrReloadExtension = async () => {
    if (typeof window === "undefined") return;
    setError("");
    setMessage("");
    const downloadFileName = currentPackageFileName;
    try {
      const res = await fetch(`${extensionZipUrl}?ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const anchor = document.createElement("a");
      anchor.href = `${extensionZipUrl}?ts=${Date.now()}`;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    setMessage(
      `ZIP downloaded: ${downloadFileName}. Extract it, open Manage Extensions, turn on Developer mode, then click Load unpacked and choose the extracted folder.`,
    );

    window.setTimeout(() => {
      window.open("chrome://extensions/", "_blank");
    }, 160);
  };

  const downloadCurrentZipOnly = async () => {
    if (typeof window === "undefined") return;
    setError("");
    const downloadFileName = currentPackageFileName;
    try {
      const res = await fetch(`${extensionZipUrl}?ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const anchor = document.createElement("a");
      anchor.href = `${extensionZipUrl}?ts=${Date.now()}`;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }

    setMessage(`ZIP downloaded: ${downloadFileName}. Unzip it before the next step.`);
  };

  const openLinkedInJobsTab = () => {
    if (typeof window === "undefined") return;
    const opened = window.open("https://www.linkedin.com/jobs/", "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
  };

  const openInstallGuide = () => {
    setError("");
    setMessage("");
    setActiveTab("preferences");
    setInstallGuideCompletedIds([]);
    setInstallGuideStepIndex(0);
    setInstallGuideOpen(true);
  };

  const closeInstallGuide = () => {
    setInstallGuideOpen(false);
  };

  const jumpToInstallGuideStep = (index: number) => {
    setInstallGuideStepIndex(Math.max(0, Math.min(installGuideSteps.length - 1, index)));
  };

  const previousInstallGuideStep = () => {
    setInstallGuideStepIndex((prev) => Math.max(0, prev - 1));
  };

  const nextInstallGuideStep = () => {
    setInstallGuideStepIndex((prev) => Math.min(installGuideSteps.length - 1, prev + 1));
  };

  const markInstallGuideStepDone = () => {
    const currentStep = installGuideSteps[installGuideStepIndex];
    if (!currentStep) return;

    setInstallGuideCompletedIds((prev) => (prev.includes(currentStep.id) ? prev : [...prev, currentStep.id]));

    if (currentStep.id === "verify-install") {
      void checkExtensionStatus();
    }

    if (installGuideStepIndex >= installGuideSteps.length - 1) {
      setInstallGuideOpen(false);
      setMessage("Guided install completed. If the version still looks old, reload the unpacked extension once in chrome://extensions.");
      return;
    }

    setInstallGuideStepIndex((prev) => Math.min(installGuideSteps.length - 1, prev + 1));
  };

  const runInstallGuideStepAction = (step: ExtensionInstallGuideStep) => {
    if (step.id === "download-zip") {
      void downloadCurrentZipOnly();
      return;
    }
    if (step.id === "open-chrome-extensions") {
      void onInstallOrReloadExtension();
      return;
    }
    if (step.id === "verify-install") {
      void checkExtensionStatus();
      return;
    }
    if (step.id === "save-and-sync") {
      void persistAll();
      return;
    }
    if (step.id === "open-linkedin-jobs") {
      openLinkedInJobsTab();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeOpenQueuedTour = () => {
      if (!consumeDashboardTourRequest(DASHBOARD_TOUR_ONBOARDING_EXTENSION)) return;
      openInstallGuide();
    };

    const onDashboardTourRequest = (event: Event) => {
      const tourId = (event as CustomEvent<{ tourId?: string }>).detail?.tourId || "";
      if (tourId !== DASHBOARD_TOUR_ONBOARDING_EXTENSION) return;
      maybeOpenQueuedTour();
    };

    maybeOpenQueuedTour();
    window.addEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    return () => {
      window.removeEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    };
  }, [openInstallGuide]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [profileRes, answersRes, issuesRes] = await Promise.all([
        fetch("/api/user/onboarding", { credentials: "include" }),
        fetch("/api/user/screening/answers?limit=500&scanLimit=2500", { credentials: "include" }),
        fetch("/api/user/screening/issues?limit=200&scanLimit=2500", { credentials: "include" }),
      ]);
      const [profileJson, answersJson, issuesJson] = await Promise.all([
        profileRes.json().catch(() => null),
        answersRes.json().catch(() => null),
        issuesRes.json().catch(() => null),
      ]);

      const profileApi = (profileJson?.data || null) as OnboardingProfileApi | null;
      const savedUser = profileApi?.user || {};
      const savedProgress = profileApi?.progress || null;

      const answers = Array.isArray(answersJson?.data?.answers)
        ? (answersJson.data.answers as ScreeningAnswerApiItem[])
        : [];

      const pending = Array.isArray(issuesJson?.data?.pending)
        ? (issuesJson.data.pending as PendingIssueItem[])
        : [];

      const answerByKey = new Map<string, ScreeningAnswerApiItem>();
      for (const item of answers) {
        const key = toPayloadQuestionKey(String(item?.questionKey || item?.questionLabel || ""));
        const answer = String(item?.answer || "").trim();
        if (!key || !answer) continue;
        if (!answerByKey.has(key)) {
          answerByKey.set(key, item);
        }
      }

      const readAnswer = (...keys: string[]) => {
        for (const key of keys) {
          const canonical = toPayloadQuestionKey(key);
          const found = answerByKey.get(canonical);
          const value = String(found?.answer || "").trim();
          if (value) return value;
        }
        return "";
      };

      const userName = String(savedUser.name || user?.name || "").trim();
      const nameParts = splitName(userName);
      const currentCity = String(savedUser.currentCity || user?.currentCity || "").trim();
      const cityState = splitCityState(currentCity);

      const nextProfile: MasterProfile = {
        fullName: userName,
        firstName: readAnswer("first_name") || nameParts.firstName,
        lastName: readAnswer("last_name") || nameParts.lastName,
        email: String(user?.email || "").trim(),
        phone: normalizePhoneDigits(String(savedUser.phone || user?.phone || readAnswer("phone_number") || "")),
        city: readAnswer("current_city", "city") || cityState.city,
        state: readAnswer("state_region") || cityState.state,
        country: readAnswer("country") || "United States",
        addressLine: String(savedUser.addressLine || user?.addressLine || readAnswer("address_line") || "").trim(),
        linkedinUrl: String(savedUser.linkedinUrl || user?.linkedinUrl || readAnswer("linkedin_url") || "").trim(),
        portfolioUrl: String(savedUser.portfolioUrl || user?.portfolioUrl || readAnswer("portfolio_url") || "").trim(),
        workAuthorizationUS: readAnswer("work_authorization_us", LEGACY_PREFERENCE_KEYS.usCitizenship),
        visaSponsorship: readAnswer("visa_sponsorship_required", LEGACY_PREFERENCE_KEYS.requireVisa) || "No",
        yearsOfExperience: readAnswer("years_of_experience", LEGACY_PREFERENCE_KEYS.yearsOfExperience),
        englishProficiency: readAnswer("english_proficiency") || "Professional",
        educationLevel: readAnswer("education_level", "bachelors_degree_completed"),
        resumeUrl: readAnswer("resume_url"),
        preferredJobTitles: parseTags(readAnswer("preferred_job_titles", LEGACY_PREFERENCE_KEYS.searchTerms)),
        preferredLocations: parseTags(
          readAnswer("preferred_locations", "cp_pref_search_locations", LEGACY_PREFERENCE_KEYS.searchLocation),
        ),
        workModePreference: readAnswer("work_mode_preference", "cp_pref_work_mode") || "Remote",
      };

      const parsedJobTypes = parseTags(readAnswer("cp_pref_job_types"));

      const nextPreferences: JobPreferences = {
        searchTerms: parseTags(readAnswer(LEGACY_PREFERENCE_KEYS.searchTerms) || stringifyTags(nextProfile.preferredJobTitles)),
        searchLocations: parseTags(
          readAnswer("cp_pref_search_locations", LEGACY_PREFERENCE_KEYS.searchLocation) ||
            stringifyTags(nextProfile.preferredLocations),
        ),
        confidenceLevel: readAnswer(LEGACY_PREFERENCE_KEYS.confidenceLevel) || "8",
        yearsOfExperience: readAnswer(LEGACY_PREFERENCE_KEYS.yearsOfExperience) || nextProfile.yearsOfExperience,
        workMode: readAnswer("cp_pref_work_mode") || nextProfile.workModePreference || "Remote",
        jobTypes: parsedJobTypes.length ? parsedJobTypes : ["Full-time"],
        salaryMin: readAnswer("cp_pref_salary_min"),
        salaryMax: readAnswer("cp_pref_salary_max", LEGACY_PREFERENCE_KEYS.desiredSalary),
        preferredCountries: parseTags(readAnswer("cp_pref_preferred_countries") || nextProfile.country || ""),
        excludedCompanies: parseTags(readAnswer("cp_pref_excluded_companies")),
        excludedKeywords: parseTags(readAnswer("cp_pref_excluded_keywords")),
      };

      const customRows: ScreeningRow[] = [];
      const seenRows = new Set<string>();
      for (const item of answers) {
        const normalizedKey = toPayloadQuestionKey(String(item?.questionKey || item?.questionLabel || ""));
        const answer = String(item?.answer || "").trim();
        if (!normalizedKey || !answer || SYSTEM_KEYS.has(normalizedKey) || seenRows.has(normalizedKey)) continue;
        seenRows.add(normalizedKey);
        customRows.push({
          id: makeId(),
          questionLabel: friendlyLabel(normalizedKey, String(item?.questionLabel || "")),
          normalizedKey,
          answer,
          answerType: (item?.answerType as ScreeningAnswerType) || inferAnswerType(answer),
          source: (item?.source as ScreeningSource) || "manual",
          lastUsed: String(item?.lastUsed || item?.updatedAt || ""),
        });
      }

      const nextPending: PendingQuestion[] = [];
      for (const issue of pending) {
        const questionLabel = String(issue?.questionLabel || "").trim();
        const questionKey = toPayloadQuestionKey(String(issue?.questionKey || questionLabel));
        if (!questionKey || !questionLabel) continue;
        nextPending.push({
          questionKey,
          questionLabel,
          validationMessage: String(issue?.validationMessage || "").trim(),
          updatedAt: String(issue?.updatedAt || ""),
        });
      }

      const suggestedDrafts: Record<string, string> = {};
      for (const p of nextPending) {
        const suggestion = getSuggestedAnswer(p, nextProfile, nextPreferences, customRows);
        if (suggestion) {
          suggestedDrafts[p.questionKey] = suggestion;
        }
      }

      const timestamps = [
        String(savedProgress?.savedAt || ""),
        ...answers.map((item) => String(item?.lastUsed || item?.updatedAt || "")),
        ...nextPending.map((item) => String(item.updatedAt || "")),
      ]
        .map((value) => value.trim())
        .filter(Boolean)
        .sort();

      setProfile(nextProfile);
      setPreferences(nextPreferences);
      setScreeningRows(customRows.sort((a, b) => a.questionLabel.localeCompare(b.questionLabel)));
      setPendingQuestions(nextPending);
      setAnswerDrafts(suggestedDrafts);
      setWizardStep(
        typeof savedProgress?.currentStep === "number"
          ? Math.max(0, Math.min(WIZARD_STEPS.length - 1, Math.floor(savedProgress.currentStep)))
          : 0,
      );
      setDraftSavedAt(String(savedProgress?.savedAt || ""));
      setLastSyncAt(timestamps[timestamps.length - 1] || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load onboarding data");
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadExtensionMeta = async () => {
      try {
        const res = await fetch("/api/public/extension-meta", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.success || !active) return;
        setExtensionRelease((prev) => ({
          ...prev,
          ...(data.data || {}),
        }));
      } catch {
        // Best effort.
      }
    };
    void loadExtensionMeta();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadData();
    void checkExtensionStatus({ silent: true });

    const extensionTimer = window.setInterval(() => {
      void checkExtensionStatus({ silent: true });
    }, 7000);

    return () => {
      window.clearInterval(extensionTimer);
    };
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildDraftPayload = () => {
    const screeningRowsForDraft = screeningRows
      .map((row) => ({
        questionKey: toPayloadQuestionKey(row.normalizedKey || row.questionLabel),
        questionLabel: String(row.questionLabel || "").trim(),
        answer: compactAnswer(row.answer),
      }))
      .filter((row) => Boolean(row.questionKey && row.questionLabel && row.answer))
      .slice(0, 250);

    return {
      name: profile.fullName,
      phone: profile.phone,
      currentCity: combineCityState(profile.city, profile.state),
      addressLine: profile.addressLine,
      linkedinUrl: profile.linkedinUrl,
      portfolioUrl: profile.portfolioUrl,
      currentStep: wizardStep,
      profileQuestionIndex: 0,
      preferences: {
        searchTerms: stringifyTags(preferences.searchTerms),
        searchLocation: stringifyTags(preferences.searchLocations),
        yearsOfExperienceAnswer: preferences.yearsOfExperience,
        requireVisa: profile.visaSponsorship,
        usCitizenship: profile.workAuthorizationUS,
        desiredSalary: preferences.salaryMax,
        confidenceLevel: preferences.confidenceLevel,
      },
      screeningRows: screeningRowsForDraft,
    };
  };

  const saveDraft = async () => {
    const res = await fetch("/api/user/onboarding", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDraftPayload()),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Failed to save onboarding draft");
    }
  };

  useEffect(() => {
    if (!loadedRef.current || loading || saving) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    setDraftStatus("saving");
    autosaveTimerRef.current = window.setTimeout(() => {
      void saveDraft()
        .then(() => {
          setDraftStatus("saved");
          setDraftSavedAt(new Date().toISOString());
        })
        .catch((draftError) => {
          setDraftStatus("error");
          setError((prev) => prev || (draftError instanceof Error ? draftError.message : "Draft autosave failed"));
        });
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [profile, preferences, screeningRows, wizardStep, loading, saving]);

  useEffect(() => {
    if (!profile.fullName.trim()) return;
    setProfile((prev) => {
      const parsed = splitName(prev.fullName);
      if (prev.firstName === parsed.firstName && prev.lastName === parsed.lastName) return prev;
      return {
        ...prev,
        firstName: prev.firstName || parsed.firstName,
        lastName: prev.lastName || parsed.lastName,
      };
    });
  }, [profile.fullName]);

  useEffect(() => {
    if (profile.preferredJobTitles.length && !preferences.searchTerms.length) {
      setPreferences((prev) => ({ ...prev, searchTerms: [...profile.preferredJobTitles] }));
    }
    if (profile.preferredLocations.length && !preferences.searchLocations.length) {
      setPreferences((prev) => ({ ...prev, searchLocations: [...profile.preferredLocations] }));
    }
  }, [profile.preferredJobTitles, profile.preferredLocations, preferences.searchTerms.length, preferences.searchLocations.length]);

  const completionChecks = useMemo(
    () => [
      { label: "Full name", done: profile.fullName.trim().length >= 2 },
      { label: "Phone", done: extractPhoneNumber(profile.phone).length >= 6 },
      { label: "City", done: profile.city.trim().length >= 2 },
      { label: "Country", done: profile.country.trim().length >= 2 },
      { label: "LinkedIn URL", done: isValidUrl(profile.linkedinUrl) },
      { label: "Portfolio URL", done: isValidUrl(profile.portfolioUrl) },
      { label: "Work authorization", done: profile.workAuthorizationUS.trim().length > 0 },
      { label: "Visa sponsorship", done: profile.visaSponsorship.trim().length > 0 },
      { label: "Experience", done: profile.yearsOfExperience.trim().length > 0 },
      { label: "Education", done: profile.educationLevel.trim().length > 0 },
      { label: "Search terms", done: preferences.searchTerms.length > 0 },
      { label: "Search locations", done: preferences.searchLocations.length > 0 },
      { label: "Work mode", done: preferences.workMode.trim().length > 0 },
    ],
    [profile, preferences],
  );

  const completionPercent = useMemo(() => {
    const doneCount = completionChecks.filter((item) => item.done).length;
    return Math.round((doneCount / completionChecks.length) * 100);
  }, [completionChecks]);

  const remoteWorkModeSelected = isRemoteWorkModeSelected(preferences.workMode);

  const missingItems = useMemo(
    () => completionChecks.filter((item) => !item.done).map((item) => item.label),
    [completionChecks],
  );

  const stepComplete = useMemo(() => {
    const hasBasic =
      profile.fullName.trim().length >= 2 &&
      profile.email.trim().length > 0 &&
      extractPhoneNumber(profile.phone).length >= 6 &&
      profile.city.trim().length >= 2;

    const hasEligibility =
      profile.workAuthorizationUS.trim().length > 0 &&
      profile.visaSponsorship.trim().length > 0;

    const hasExperience =
      profile.yearsOfExperience.trim().length > 0 &&
      profile.educationLevel.trim().length > 0 &&
      profile.englishProficiency.trim().length > 0;

    const hasPreferences =
      preferences.searchTerms.length > 0 &&
      preferences.searchLocations.length > 0 &&
      preferences.workMode.trim().length > 0;

    const hasSavedAnswers = screeningRows.length > 0 || pendingQuestions.length === 0;

    const hasResumeLinkedin =
      isValidUrl(profile.linkedinUrl) &&
      (Boolean(user?.resumeFileName) || Boolean(profile.resumeUrl.trim()));

    return [hasBasic, hasEligibility, hasExperience, hasPreferences, hasSavedAnswers, hasResumeLinkedin];
  }, [profile, preferences, screeningRows.length, pendingQuestions.length, user?.resumeFileName]);

  const summaryStatus = useMemo(() => {
    return {
      resumeUploaded: Boolean(user?.resumeFileName) || Boolean(profile.resumeUrl.trim()),
      linkedinConnected: isValidUrl(profile.linkedinUrl),
      extensionConnected: extensionStatus.installed,
      pendingCount: pendingQuestions.length,
    };
  }, [user?.resumeFileName, profile.resumeUrl, profile.linkedinUrl, extensionStatus.installed, pendingQuestions.length]);

  const validateBeforeSave = () => {
    if (profile.fullName.trim().length < 2) return "Full name is required.";
    if (extractPhoneNumber(profile.phone).length < 6) return "Enter a valid phone number.";
    if (profile.city.trim().length < 2) return "City is required.";
    if (profile.addressLine.trim().length < 5) return "Address is required.";
    if (!isValidUrl(profile.linkedinUrl)) return "Enter a valid LinkedIn URL.";
    if (!isValidUrl(profile.portfolioUrl)) return "Enter a valid Portfolio URL.";
    if (!preferences.searchTerms.length) return "Add at least one search term.";
    if (!preferences.searchLocations.length) return "Add at least one search location.";
    if (!profile.workAuthorizationUS.trim()) return "U.S. work authorization is required.";
    if (!profile.visaSponsorship.trim()) return "Visa sponsorship preference is required.";
    return "";
  };

  const buildAllScreeningPayloads = () => {
    const payloads: ScreeningPayload[] = [];

    const push = (
      questionKey: string,
      questionLabel: string,
      answer: string,
      answerType: ScreeningAnswerType = "text",
      source: ScreeningSource = "system",
      lastUsed?: string,
    ) => {
      const key = toPayloadQuestionKey(questionKey || questionLabel);
      const value = compactAnswer(answer);
      if (!key || !value) return;
      payloads.push({
        questionKey: key,
        questionLabel: String(questionLabel || "").trim() || friendlyLabel(key, ""),
        answer: value,
        answerType,
        source,
        ...(lastUsed ? { lastUsed } : {}),
      });
    };

    for (const field of PROFILE_KEY_LABELS) {
      const raw = profile[field.key];
      if (Array.isArray(raw)) {
        push(field.label, field.label, stringifyTags(raw), field.answerType || "multiselect");
      } else {
        push(field.label, field.label, String(raw || ""), field.answerType || inferAnswerType(String(raw || "")));
      }
    }

    push("preferred_job_titles", "Preferred Job Titles", stringifyTags(profile.preferredJobTitles), "multiselect");
    push("preferred_locations", "Preferred Locations", stringifyTags(profile.preferredLocations), "multiselect");

    for (const pref of PREFERENCE_KEY_LABELS) {
      if (remoteWorkModeSelected && pref.key === "preferredCountries") continue;
      const value = preferences[pref.key];
      if (Array.isArray(value)) {
        push(pref.questionKey, pref.label, stringifyTags(value), pref.answerType || "multiselect");
      } else {
        push(pref.questionKey, pref.label, String(value || ""), pref.answerType || inferAnswerType(String(value || "")));
      }
    }

    push(LEGACY_PREFERENCE_KEYS.searchTerms, "AutoApply CV Preference: Search terms", stringifyTags(preferences.searchTerms), "multiselect");
    push(
      LEGACY_PREFERENCE_KEYS.searchLocation,
      "AutoApply CV Preference: Search location",
      preferences.searchLocations[0] || "",
      "text",
    );
    push(
      LEGACY_PREFERENCE_KEYS.yearsOfExperience,
      "AutoApply CV Preference: Years of experience",
      preferences.yearsOfExperience || profile.yearsOfExperience,
      "number",
    );
    push(
      LEGACY_PREFERENCE_KEYS.requireVisa,
      "AutoApply CV Preference: Need visa sponsorship",
      profile.visaSponsorship,
      "boolean",
    );
    push(
      LEGACY_PREFERENCE_KEYS.usCitizenship,
      "AutoApply CV Preference: US work authorization",
      profile.workAuthorizationUS,
      "choice",
    );
    push(
      LEGACY_PREFERENCE_KEYS.desiredSalary,
      "AutoApply CV Preference: Desired salary",
      preferences.salaryMax,
      "number",
    );
    push(
      LEGACY_PREFERENCE_KEYS.confidenceLevel,
      "AutoApply CV Preference: Confidence level",
      preferences.confidenceLevel,
      "number",
    );

    for (const row of screeningRows) {
      push(
        row.normalizedKey || row.questionLabel,
        row.questionLabel,
        row.answer,
        row.answerType || inferAnswerType(row.answer),
        row.source || "manual",
        row.lastUsed || undefined,
      );
    }

    const deduped = new Map<string, ScreeningPayload>();
    for (const item of payloads) {
      if (!deduped.has(item.questionKey)) {
        deduped.set(item.questionKey, item);
      }
    }

    return Array.from(deduped.values());
  };

  const buildExtensionSettingsPayload = (screeningAnswers: Record<string, string>) => {
    const filterLocations = sanitizeLocationFilterValues(
      remoteWorkModeSelected ? preferences.searchLocations : [...preferences.searchLocations, ...preferences.preferredCountries],
    );
    const resolvedSearchLocation =
      preferences.searchLocations[0] ||
      (!remoteWorkModeSelected ? preferences.preferredCountries[0] || combineCityState(profile.city, profile.state) : "");

    return {
      currentCity: combineCityState(profile.city, profile.state),
      searchLocation: resolvedSearchLocation,
      searchTerms: preferences.searchTerms,
      filterLocations,
      contactEmail: profile.email,
      phoneNumber: extractPhoneNumber(profile.phone),
      phoneCountryCode: extractPhoneCountryCode(profile.phone),
      marketingConsent: "No",
      requireVisa: profile.visaSponsorship || "No",
      usCitizenship: profile.workAuthorizationUS || "",
      yearsOfExperienceAnswer: preferences.yearsOfExperience || profile.yearsOfExperience,
      desiredSalary: preferences.salaryMax || "",
      noticePeriodDays: "",
      confidenceLevel: preferences.confidenceLevel,
      linkedinUrl: profile.linkedinUrl,
      websiteUrl: profile.portfolioUrl,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: profile.fullName,
      streetAddress: profile.addressLine,
      stateRegion: profile.state,
      country: profile.country,
      coverLetter: "",
      easyApplyOnly: true,
      debugMode: false,
      dryRun: false,
      autoSubmit: true,
      autoResumeOnAnswer: true,
      maxApplicationsPerRun: 200,
      maxSkipsPerRun: 50,
      screeningAnswers,
    };
  };

  const syncExtensionSettings = async (settings: Record<string, unknown>) => {
    if (typeof window === "undefined") return { ok: false, skipped: true as const };
    if (!extensionStatus.installed) return { ok: false, skipped: true as const };

    return new Promise<{ ok: boolean; skipped?: false; error?: string }>((resolve) => {
      const requestId = `onboarding-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      window.postMessage(
        {
          type: "CP_WEB_SYNC_SETTINGS",
          requestId,
          settings,
        },
        window.location.origin,
      );
    });
  };

  const persistAll = async () => {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const validationError = validateBeforeSave();
      if (validationError) throw new Error(validationError);

      const onboardingPayload = {
        name: profile.fullName,
        phone: profile.phone,
        currentCity: combineCityState(profile.city, profile.state),
        addressLine: profile.addressLine,
        linkedinUrl: profile.linkedinUrl,
        portfolioUrl: profile.portfolioUrl,
      };

      const onboardingRes = await fetch("/api/user/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboardingPayload),
      });
      const onboardingJson = await onboardingRes.json().catch(() => null);
      if (!onboardingRes.ok || !onboardingJson?.success) {
        throw new Error(onboardingJson?.message || "Failed to save profile");
      }

      const screeningPayloads = buildAllScreeningPayloads();
      for (const payload of screeningPayloads) {
        const res = await fetch("/api/user/screening/answers", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.message || `Failed to save answer: ${payload.questionLabel}`);
        }
      }

      await saveDraft();

      const screeningAnswerMap: Record<string, string> = {};
      for (const item of screeningPayloads) {
        screeningAnswerMap[item.questionKey] = item.answer;
      }

      const syncResult = await syncExtensionSettings(buildExtensionSettingsPayload(screeningAnswerMap));
      const syncSkipped = "skipped" in syncResult && Boolean(syncResult.skipped);
      if (!syncResult.ok && !syncSkipped) {
        throw new Error(("error" in syncResult && syncResult.error) || "Failed to sync extension settings");
      }

      await refreshUser();
      setMessage(
        syncSkipped
          ? "Profile saved. Install/check extension to sync auto-fill settings."
          : "Profile, preferences, and screening answer library saved.",
      );
      setLastSyncAt(new Date().toISOString());
      navigate("/dashboard");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save onboarding");
    } finally {
      setSaving(false);
    }
  };

  const saveAnswer = async (
    questionKey: string,
    questionLabel: string,
    answer: string,
    answerType: ScreeningAnswerType = inferAnswerType(answer),
    source: ScreeningSource = "manual",
  ) => {
    const normalizedKey = toPayloadQuestionKey(questionKey || questionLabel);
    const cleanAnswer = compactAnswer(answer);
    const cleanLabel = String(questionLabel || "").trim() || friendlyLabel(normalizedKey, "");
    if (!normalizedKey || !cleanAnswer || !cleanLabel) return;

    setSavingAnswerKey(normalizedKey);
    setError("");

    try {
      const payload: ScreeningPayload = {
        questionKey: normalizedKey,
        questionLabel: cleanLabel,
        answer: cleanAnswer,
        answerType,
        source,
        lastUsed: new Date().toISOString(),
      };

      const res = await fetch("/api/user/screening/answers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to save answer");
      }

      setScreeningRows((prev) => {
        const existingIdx = prev.findIndex((item) => toPayloadQuestionKey(item.normalizedKey) === normalizedKey);
        if (existingIdx === -1) {
          return [
            ...prev,
            {
              id: makeId(),
              questionLabel: cleanLabel,
              normalizedKey,
              answer: cleanAnswer,
              answerType,
              source,
              lastUsed: new Date().toISOString(),
            },
          ].sort((a, b) => a.questionLabel.localeCompare(b.questionLabel));
        }

        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          questionLabel: cleanLabel,
          normalizedKey,
          answer: cleanAnswer,
          answerType,
          source,
          lastUsed: new Date().toISOString(),
        };
        return next;
      });

      setPendingQuestions((prev) => prev.filter((item) => item.questionKey !== normalizedKey));
      setAnswerDrafts((prev) => ({ ...prev, [normalizedKey]: cleanAnswer }));
      setMessage(`Saved answer for: ${cleanLabel}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save answer");
    } finally {
      setSavingAnswerKey("");
    }
  };

  const onboardingHeaderDescription = "Ask once, save forever, auto-fill everywhere.";

  if (loading) {
    return (
      <div className="min-h-[420px] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading onboarding profile...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Onboarding Setup</h1>
          <p className="text-gray-600 mt-1">{onboardingHeaderDescription}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openInstallGuide}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 inline-flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Install Guide
          </button>
          <button
            ref={checkExtensionButtonRef}
            type="button"
            onClick={() => void checkExtensionStatus()}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            {checkingExtension ? "Checking Extension..." : "Check Extension"}
          </button>
          <a
            ref={openLinkedInJobsButtonRef}
            href="https://www.linkedin.com/jobs/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            LinkedIn Jobs
          </a>
          <a
            href="/dashboard/resume"
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <UploadCloud className="h-4 w-4" />
            Resume
          </a>
          <button
            ref={saveAndFinishButtonRef}
            type="button"
            onClick={() => void persistAll()}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save & Finish"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5" />
          <span>{message}</span>
        </div>
      ) : null}

      <ExtensionInstallGuide
        open={installGuideOpen}
        steps={installGuideSteps}
        currentStepIndex={installGuideStepIndex}
        completedStepIds={installGuideCompletedIds}
        onClose={closeInstallGuide}
        onNext={nextInstallGuideStep}
        onPrevious={previousInstallGuideStep}
        onStepDone={markInstallGuideStepDone}
        onJumpToStep={jumpToInstallGuideStep}
        onStepAction={runInstallGuideStepAction}
      />

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Profile Completion</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{completionPercent}%</p>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-sm text-indigo-700 font-semibold">
              {missingItems.length ? `${missingItems.length} missing` : "All key fields filled"}
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${completionPercent}%` }} />
          </div>

          {missingItems.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">Missing items</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingItems.map((item) => (
                  <span key={item} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-amber-200 text-amber-800">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Summary</p>
          <div className="mt-3 space-y-2 text-sm">
            <SummaryLine label="Profile" value={`${completionPercent}% complete`} ok={completionPercent >= 80} />
            <SummaryLine
              label="Resume"
              value={summaryStatus.resumeUploaded ? "Uploaded" : "Not uploaded"}
              ok={summaryStatus.resumeUploaded}
            />
            <SummaryLine
              label="LinkedIn"
              value={summaryStatus.linkedinConnected ? "Connected" : "Missing profile URL"}
              ok={summaryStatus.linkedinConnected}
            />
            <SummaryLine
              label="Extension"
              value={summaryStatus.extensionConnected ? "Connected" : "Not detected"}
              ok={summaryStatus.extensionConnected}
            />
            <SummaryLine
              label="Pending Questions"
              value={`${summaryStatus.pendingCount}`}
              ok={summaryStatus.pendingCount === 0}
            />
            <SummaryLine
              label="Last Sync"
              value={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Not synced yet"}
              ok={Boolean(lastSyncAt)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Complete My Profile</p>
            <h2 className="text-lg font-semibold text-gray-900">6-step setup wizard</h2>
          </div>
          <div className="text-sm text-gray-600">
            Step {wizardStep + 1} of {WIZARD_STEPS.length}
          </div>
        </div>

        <div className="grid md:grid-cols-6 gap-2">
          {WIZARD_STEPS.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => {
                setWizardStep(index);
                setActiveTab(step.tab);
              }}
              className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                index === wizardStep
                  ? "border-indigo-300 bg-indigo-50"
                  : stepComplete[index]
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="text-xs font-semibold text-gray-600">{index + 1}</div>
              <div className="text-sm font-semibold text-gray-900 mt-1">{step.title}</div>
              <div className="text-xs text-gray-600 mt-1 line-clamp-2">{step.description}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{WIZARD_STEPS[wizardStep].title}</p>
            <p className="text-xs text-gray-600 mt-0.5">{WIZARD_STEPS[wizardStep].description}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWizardStep((prev) => Math.max(0, prev - 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white"
              disabled={wizardStep === 0}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                const next = Math.min(WIZARD_STEPS.length - 1, wizardStep + 1);
                setWizardStep(next);
                setActiveTab(WIZARD_STEPS[next].tab);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 inline-flex items-center gap-1"
              disabled={wizardStep === WIZARD_STEPS.length - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {pendingQuestions.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <Sparkles className="h-4 w-4" />
            Action Needed
          </div>
          <p className="text-sm text-amber-800">
            These questions were detected on LinkedIn and still need answers. Answer once and the system will reuse them everywhere.
          </p>

          <div className="space-y-3">
            {pendingQuestions.slice(0, 6).map((item) => {
              const draftKey = item.questionKey;
              const draftValue = answerDrafts[draftKey] ?? "";
              const hasValidationMessage = Boolean(item.validationMessage);
              return (
                <div
                  key={`${item.questionKey}-${item.questionLabel}`}
                  className={`rounded-xl border p-3 ${hasValidationMessage ? "border-red-200 bg-red-50" : "border-amber-200 bg-white"}`}
                >
                  <div className="text-sm font-semibold text-gray-900">{item.questionLabel}</div>
                  {item.validationMessage ? (
                    <div className="mt-1 text-xs font-medium text-red-700">{item.validationMessage}</div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      value={draftValue}
                      onChange={(e) =>
                        setAnswerDrafts((prev) => ({
                          ...prev,
                          [draftKey]: e.target.value,
                        }))
                      }
                      placeholder="Answer once and save"
                      className="min-w-[260px] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void saveAnswer(item.questionKey, item.questionLabel, answerDrafts[draftKey] || "", inferAnswerType(answerDrafts[draftKey] || ""), "manual")
                      }
                      disabled={savingAnswerKey === item.questionKey || !String(answerDrafts[draftKey] || "").trim()}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {savingAnswerKey === item.questionKey ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-2">
        <div className="grid md:grid-cols-3 gap-2">
          <TabButton
            label="Profile"
            description="Personal + professional details"
            active={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
          />
          <TabButton
            label="Preferences"
            description="Auto Apply / CareerPilot / LinkedIn"
            active={activeTab === "preferences"}
            onClick={() => setActiveTab("preferences")}
          />
          <TabButton
            label="Screening Answers"
            description="Question bank + reusable answers"
            active={activeTab === "screening"}
            onClick={() => setActiveTab("screening")}
          />
        </div>
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-4">
          <SectionCard title="Personal Info" subtitle="Name, email, phone, city/state/country">
            <div className="grid md:grid-cols-2 gap-3">
              <InputField
                label="Full Name"
                value={profile.fullName}
                onChange={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
                placeholder="e.g. Alex Johnson"
              />
              <InputField
                label="Email"
                value={profile.email}
                onChange={() => {}}
                placeholder="you@example.com"
                disabled
              />
              <InputField
                label="Phone"
                value={profile.phone}
                onChange={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
                placeholder="+1 5551234567"
              />
              <InputField
                label="Address"
                value={profile.addressLine}
                onChange={(value) => setProfile((prev) => ({ ...prev, addressLine: value }))}
                placeholder="Street and area"
              />
              <InputField
                label="City"
                value={profile.city}
                onChange={(value) => setProfile((prev) => ({ ...prev, city: value }))}
                placeholder="Austin"
              />
              <InputField
                label="State / Region"
                value={profile.state}
                onChange={(value) => setProfile((prev) => ({ ...prev, state: value }))}
                placeholder="Texas"
              />
              <InputField
                label="Country"
                value={profile.country}
                onChange={(value) => setProfile((prev) => ({ ...prev, country: value }))}
                placeholder="United States"
              />
            </div>
          </SectionCard>

          <SectionCard title="Professional Links" subtitle="LinkedIn, portfolio, and resume URL">
            <div className="grid md:grid-cols-2 gap-3">
              <InputField
                label="LinkedIn URL"
                value={profile.linkedinUrl}
                onChange={(value) => setProfile((prev) => ({ ...prev, linkedinUrl: value }))}
                placeholder="https://www.linkedin.com/in/your-profile"
              />
              <InputField
                label="Portfolio URL"
                value={profile.portfolioUrl}
                onChange={(value) => setProfile((prev) => ({ ...prev, portfolioUrl: value }))}
                placeholder="https://github.com/yourname"
              />
              <InputField
                label="Resume URL (optional)"
                value={profile.resumeUrl}
                onChange={(value) => setProfile((prev) => ({ ...prev, resumeUrl: value }))}
                placeholder="https://..."
              />
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                <div className="font-semibold text-gray-900">Resume Upload Status</div>
                <div className="mt-1">{user?.resumeFileName ? `Uploaded: ${user.resumeFileName}` : "No uploaded resume yet"}</div>
                <a href="/dashboard/resume" className="mt-2 inline-flex text-indigo-600 hover:text-indigo-700 font-medium">
                  Open Resume Section
                </a>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Work Eligibility" subtitle="Visa sponsorship and work authorization">
            <div className="grid md:grid-cols-2 gap-3">
              <SelectField
                label="U.S. Work Authorization"
                value={profile.workAuthorizationUS}
                onChange={(value) => setProfile((prev) => ({ ...prev, workAuthorizationUS: value }))}
                options={[
                  "U.S. Citizen/Permanent Resident",
                  "Authorized to work in the U.S.",
                  "Require sponsorship",
                  "Not authorized",
                ]}
              />
              <SelectField
                label="Need Visa Sponsorship"
                value={profile.visaSponsorship}
                onChange={(value) => setProfile((prev) => ({ ...prev, visaSponsorship: value }))}
                options={["No", "Yes"]}
              />
              <SelectField
                label="Remote / Onsite / Hybrid"
                value={profile.workModePreference}
                onChange={(value) => {
                  setProfile((prev) => ({ ...prev, workModePreference: value }));
                  setPreferences((prev) => ({ ...prev, workMode: value }));
                }}
                options={WORK_MODE_OPTIONS}
              />
            </div>
          </SectionCard>

          <SectionCard title="Experience & Education" subtitle="Years, degree, and communication level">
            <div className="grid md:grid-cols-2 gap-3">
              <InputField
                label="Years of Experience"
                value={profile.yearsOfExperience}
                onChange={(value) => {
                  setProfile((prev) => ({ ...prev, yearsOfExperience: value }));
                  setPreferences((prev) => ({ ...prev, yearsOfExperience: value }));
                }}
                placeholder="e.g. 5"
              />
              <SelectField
                label="Education Level"
                value={profile.educationLevel}
                onChange={(value) => setProfile((prev) => ({ ...prev, educationLevel: value }))}
                options={EDUCATION_LEVEL_OPTIONS}
              />
              <SelectField
                label="English Proficiency"
                value={profile.englishProficiency}
                onChange={(value) => setProfile((prev) => ({ ...prev, englishProficiency: value }))}
                options={ENGLISH_PROFICIENCY_OPTIONS}
              />
            </div>
          </SectionCard>

          <SectionCard title="Preferred Roles & Locations" subtitle="Used to prefill job preferences and screening answers">
            <div className="grid md:grid-cols-2 gap-4">
              <TagInput
                label="Preferred Job Titles"
                values={profile.preferredJobTitles}
                onChange={(values) => {
                  setProfile((prev) => ({ ...prev, preferredJobTitles: values }));
                  setPreferences((prev) => ({ ...prev, searchTerms: values }));
                }}
                placeholder="Add role and press Enter"
              />
              <TagInput
                label="Preferred Locations"
                values={profile.preferredLocations}
                onChange={(values) => {
                  setProfile((prev) => ({ ...prev, preferredLocations: values }));
                  setPreferences((prev) => ({ ...prev, searchLocations: values }));
                }}
                placeholder="Add location and press Enter"
              />
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "preferences" ? (
        <div className="space-y-4">
          <SectionCard
            title="Auto Apply Preferences"
            subtitle="Search terms, locations, confidence, and fit criteria"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <TagInput
                label="Search Terms"
                values={preferences.searchTerms}
                onChange={(values) => setPreferences((prev) => ({ ...prev, searchTerms: values }))}
                placeholder="PHP Developer"
              />
              <TagInput
                label="Search Locations"
                values={preferences.searchLocations}
                onChange={(values) => setPreferences((prev) => ({ ...prev, searchLocations: values }))}
                placeholder="New York"
              />
              <SelectField
                label="Remote / Onsite / Hybrid"
                value={preferences.workMode}
                onChange={(value) => setPreferences((prev) => ({ ...prev, workMode: value }))}
                options={WORK_MODE_OPTIONS}
              />
              <InputField
                label="Confidence Level (1-10)"
                value={preferences.confidenceLevel}
                onChange={(value) => setPreferences((prev) => ({ ...prev, confidenceLevel: value }))}
                placeholder="8"
              />
              <InputField
                label="Years of Experience"
                value={preferences.yearsOfExperience}
                onChange={(value) => setPreferences((prev) => ({ ...prev, yearsOfExperience: value }))}
                placeholder="5"
              />
              <TagInput
                label="Job Types"
                values={preferences.jobTypes}
                onChange={(values) => setPreferences((prev) => ({ ...prev, jobTypes: values }))}
                placeholder="Full-time"
                presets={JOB_TYPE_OPTIONS}
              />
              <InputField
                label="Salary Min"
                value={preferences.salaryMin}
                onChange={(value) => setPreferences((prev) => ({ ...prev, salaryMin: value }))}
                placeholder="80000"
              />
              <InputField
                label="Salary Max"
                value={preferences.salaryMax}
                onChange={(value) => setPreferences((prev) => ({ ...prev, salaryMax: value }))}
                placeholder="120000"
              />
              {!remoteWorkModeSelected ? (
                <TagInput
                  label="Preferred Countries"
                  values={preferences.preferredCountries}
                  onChange={(values) => setPreferences((prev) => ({ ...prev, preferredCountries: values }))}
                  placeholder="United States"
                />
              ) : null}
              <TagInput
                label="Excluded Companies"
                values={preferences.excludedCompanies}
                onChange={(values) => setPreferences((prev) => ({ ...prev, excludedCompanies: values }))}
                placeholder="Company name"
              />
              <TagInput
                label="Excluded Keywords"
                values={preferences.excludedKeywords}
                onChange={(values) => setPreferences((prev) => ({ ...prev, excludedKeywords: values }))}
                placeholder="Staffing"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="CareerPilot Preferences"
            subtitle="Uses the same structure and values as Auto Apply Preferences"
          >
            <PreferenceMirror preferences={preferences} />
          </SectionCard>

          <SectionCard
            title="LinkedIn Preferences"
            subtitle="Same preference data synced for LinkedIn extension autofill"
          >
            <PreferenceMirror preferences={preferences} />
            {canDownloadExtensionZip ? (
              <div className="mt-3">
                <p ref={currentPackageLabelRef} className="mb-2 text-xs text-gray-500">Current package on site: {currentPackageBaseName}</p>
                {installedPackageName ? (
                  <p className="mb-2 text-xs font-medium text-green-700">Installed in browser: {installedPackageName}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    ref={downloadOpenButtonRef}
                    type="button"
                    onClick={() => void onInstallOrReloadExtension()}
                    className="inline-flex px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download + Open Extensions
                  </button>
                  <a
                    ref={downloadZipButtonRef}
                    href={extensionZipUrl}
                    download={currentPackageFileName}
                    className="inline-flex px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Current ZIP
                  </a>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "screening" ? (
        <div className="space-y-4">
          <SectionCard
            title="Saved Answers / Question Bank"
            subtitle="question label, normalized key, answer, answer type, source, and last used"
            action={
              <button
                type="button"
                onClick={() =>
                  setScreeningRows((prev) => [
                    ...prev,
                    {
                      id: makeId(),
                      questionLabel: "",
                      normalizedKey: "",
                      answer: "",
                      answerType: "text",
                      source: "manual",
                      lastUsed: "",
                    },
                  ])
                }
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Answer
              </button>
            }
          >
            {!screeningRows.length ? (
              <p className="text-sm text-gray-500">No saved screening answers yet.</p>
            ) : (
              <div className="space-y-3">
                {screeningRows.map((row) => {
                  const key = toPayloadQuestionKey(row.normalizedKey || row.questionLabel);
                  const isSavingRow = Boolean(savingAnswerKey) && savingAnswerKey === key;
                  return (
                    <div key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="grid md:grid-cols-3 gap-2">
                        <InputField
                          label="Question"
                          value={row.questionLabel}
                          onChange={(value) =>
                            setScreeningRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      questionLabel: value,
                                      normalizedKey: toPayloadQuestionKey(value),
                                    }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Are you authorized to work in the U.S.?"
                        />
                        <InputField
                          label="Answer"
                          value={row.answer}
                          onChange={(value) =>
                            setScreeningRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      answer: value,
                                      answerType: inferAnswerType(value),
                                    }
                                  : item,
                              ),
                            )
                          }
                          placeholder="No"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <SelectField
                            label="Type"
                            value={row.answerType}
                            onChange={(value) =>
                              setScreeningRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        answerType: value as ScreeningAnswerType,
                                      }
                                    : item,
                                ),
                              )
                            }
                            options={["text", "boolean", "number", "choice", "multiselect"]}
                          />
                          <SelectField
                            label="Source"
                            value={row.source}
                            onChange={(value) =>
                              setScreeningRows((prev) =>
                                prev.map((item) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        source: value as ScreeningSource,
                                      }
                                    : item,
                                ),
                              )
                            }
                            options={["manual", "linkedin_import", "resume_parse", "extension_capture", "system"]}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                        <span>Mapped key is generated automatically from the question text.</span>
                        <span>
                          Last used: {row.lastUsed ? new Date(row.lastUsed).toLocaleString() : "Not used yet"}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void saveAnswer(
                              row.normalizedKey || row.questionLabel,
                              row.questionLabel,
                              row.answer,
                              row.answerType,
                              row.source,
                            )
                          }
                          disabled={isSavingRow || !row.questionLabel.trim() || !row.answer.trim()}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {isSavingRow ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScreeningRows((prev) => prev.filter((item) => item.id !== row.id))}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Pending Answers"
            subtitle="Detected by LinkedIn forms and waiting for your input"
          >
            {!pendingQuestions.length ? (
              <p className="text-sm text-emerald-700">No pending screening questions right now.</p>
            ) : (
              <div className="space-y-3">
                {pendingQuestions.map((item) => {
                  const key = item.questionKey;
                  const draft = answerDrafts[key] || "";
                  const hasValidationMessage = Boolean(item.validationMessage);
                  return (
                    <div
                      key={`${item.questionKey}-${item.questionLabel}`}
                      className={`rounded-xl border p-3 ${
                        hasValidationMessage ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-900">{item.questionLabel}</div>
                      {item.validationMessage ? (
                        <div className="mt-1 text-xs font-medium text-red-700">{item.validationMessage}</div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          value={draft}
                          onChange={(e) =>
                            setAnswerDrafts((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          placeholder="Type your answer"
                          className="min-w-[260px] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void saveAnswer(
                              item.questionKey,
                              item.questionLabel,
                              answerDrafts[key] || "",
                              inferAnswerType(answerDrafts[key] || ""),
                              "manual",
                            )
                          }
                          disabled={savingAnswerKey === key || !String(answerDrafts[key] || "").trim()}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                        >
                          {savingAnswerKey === key ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <div className="text-xs text-gray-500">
          {draftStatus === "saving" ? "Saving draft..." : null}
          {draftStatus === "saved"
            ? `Draft saved${draftSavedAt ? ` at ${new Date(draftSavedAt).toLocaleTimeString()}` : ""}`
            : null}
          {draftStatus === "error" ? "Draft autosave failed. Keep tab open and retry." : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setError("");
              setMessage("");
              void loadData();
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => void persistAll()}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save & Finish Onboarding"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${ok ? "text-emerald-700" : "text-gray-900"}`}>{value}</span>
    </div>
  );
}

function TabButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:bg-gray-100"
      }`}
    >
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-xs text-gray-600 mt-1">{description}</div>
    </button>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:bg-gray-100 disabled:text-gray-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
  presets = [],
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  presets?: string[];
}) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const value = String(raw || "").trim();
    if (!value) return;
    const exists = values.some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) return;
    onChange([...values, value]);
  };

  const removeTag = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  return (
    <div>
      <span className="text-xs font-semibold text-gray-700">{label}</span>

      <div className="mt-1 rounded-lg border border-gray-300 bg-white p-2">
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700"
            >
              {item}
              <button
                type="button"
                onClick={() => removeTag(item)}
                className="text-indigo-700 hover:text-indigo-900"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(draft);
                setDraft("");
              }
              if (e.key === "Backspace" && !draft && values.length) {
                removeTag(values[values.length - 1]);
              }
            }}
            onBlur={() => {
              if (draft.trim()) {
                addTag(draft);
                setDraft("");
              }
            }}
            placeholder={placeholder}
            className="min-w-[180px] flex-1 px-1 py-1 text-sm outline-none"
          />
        </div>
      </div>

      {presets.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => addTag(preset)}
              className="px-2 py-1 rounded-full border border-gray-300 text-xs text-gray-700 hover:bg-gray-50"
            >
              + {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PreferenceMirror({ preferences }: { preferences: JobPreferences }) {
  return (
    <div className="grid md:grid-cols-2 gap-2 text-sm">
      <MirrorLine label="Search Terms" value={preferences.searchTerms.join(", ") || "-"} />
      <MirrorLine label="Search Locations" value={preferences.searchLocations.join(", ") || "-"} />
      <MirrorLine label="Work Mode" value={preferences.workMode || "-"} />
      <MirrorLine label="Job Types" value={preferences.jobTypes.join(", ") || "-"} />
      <MirrorLine label="Years of Experience" value={preferences.yearsOfExperience || "-"} />
      <MirrorLine label="Confidence" value={preferences.confidenceLevel || "-"} />
      <MirrorLine
        label="Salary"
        value={
          preferences.salaryMin || preferences.salaryMax
            ? `${preferences.salaryMin || "0"} - ${preferences.salaryMax || "0"}`
            : "-"
        }
      />
      {normalizeLabel(preferences.workMode) !== "remote" ? (
        <MirrorLine label="Preferred Countries" value={preferences.preferredCountries.join(", ") || "-"} />
      ) : null}
      <MirrorLine label="Excluded Companies" value={preferences.excludedCompanies.join(", ") || "-"} />
      <MirrorLine label="Excluded Keywords" value={preferences.excludedKeywords.join(", ") || "-"} />
    </div>
  );
}

function MirrorLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-800 font-medium mt-0.5">{value}</div>
    </div>
  );
}
