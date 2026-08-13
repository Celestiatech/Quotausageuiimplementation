import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Briefcase,
  RefreshCw,
  AlertCircle,
  Play,
  FileText,
  CheckCircle2,
  Download,
  ExternalLink,
  ChevronDown,
  Link2,
  Bot,
  Send,
  ListChecks,
  Save,
  Loader2,
  Clock,
  User,
  Sliders,
  List,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ExtensionInstallGuide, type ExtensionInstallGuideStep } from "../../components/ExtensionInstallGuide";
import { getExtensionProviderConfig } from "src/lib/extension-providers";
import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";
import { syncProfileToExtension as syncProfileToExtensionBase } from "src/lib/sync-profile";
import { toQuestionKey as mapQuestionKey } from "src/lib/screening-question-map";
import {
  DASHBOARD_TOUR_EVENT_NAME,
  DASHBOARD_TOUR_JOBS_EXTENSION,
  consumeDashboardTourRequest,
} from "src/lib/dashboard-tour";

type ScreeningAnswerType = "text" | "boolean" | "number" | "choice" | "multiselect";
type ScreeningAnswerSource = "manual" | "linkedin_import" | "resume_parse" | "extension_capture" | "system";

type ExtensionStatus = {
  installed: boolean;
  runtimeId?: string;
  version?: string;
  providers?: Partial<Record<"linkedin" | "indeed", { installed: boolean; version?: string }>>;
  linkedIn?: {
    hasLinkedInTab: boolean;
    hasJobsTab: boolean;
  };
  indeed?: {
    hasIndeedTab: boolean;
    hasJobsTab: boolean;
  };
  state?: {
    running?: boolean;
    paused?: boolean;
    applied?: number;
    skipped?: number;
    failed?: number;
  } | null;
  error?: string | null;
  pendingQuestions?: Array<{
    questionKey: string;
    questionLabel: string;
    validationMessage?: string;
    createdAt?: string;
  }>;
  screeningAnswers?: Record<string, string>;
};

type JobBoard = {
  id: string;
  name: string;
  url: string;
  provider: "linkedin" | "indeed" | "other";
};

const JOB_BOARDS: JobBoard[] = [
  { id: "linkedin", name: "LinkedIn", url: "https://www.linkedin.com/jobs/", provider: "linkedin" },
  { id: "indeed", name: "Indeed", url: "https://www.indeed.com/jobs", provider: "indeed" },
  { id: "lever", name: "Lever", url: "https://jobs.lever.co/", provider: "other" },
  { id: "greenhouse", name: "Greenhouse", url: "https://job-boards.greenhouse.io/", provider: "other" },
  { id: "workday", name: "Workday", url: "https://www.myworkdayjobs.com/", provider: "other" },
  { id: "glassdoor", name: "Glassdoor", url: "https://www.glassdoor.com/Job/jobs.htm", provider: "other" },
  { id: "monster", name: "Monster", url: "https://www.monster.com/jobs/search", provider: "other" },
  { id: "workable", name: "Workable", url: "https://www.workable.com/", provider: "other" },
  { id: "recruitee", name: "Recruitee", url: "https://www.recruitee.com/", provider: "other" },
  { id: "ashby", name: "Ashby", url: "https://jobs.ashbyhq.com/", provider: "other" },
  { id: "breezy", name: "Breezy", url: "https://breezy.hr/", provider: "other" },
  { id: "wellfound", name: "Wellfound", url: "https://wellfound.com/jobs", provider: "other" },
  { id: "smartrecruiters", name: "SmartRecruiters", url: "https://jobs.smartrecruiters.com/", provider: "other" },
];

type ScreeningAnswerApiItem = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType?: ScreeningAnswerType;
  source?: ScreeningAnswerSource;
  updatedAt?: string;
};

type ExtensionReleaseMeta = {
  version: string;
  displayName: string;
  downloadFileName: string;
  downloadBaseName: string;
};

type ScreeningFieldCategory = "profile" | "preferences" | "screening";

type ScreeningCatalogField = {
  key: string;
  label: string;
  category: ScreeningFieldCategory;
  order: number;
  answerType?: ScreeningAnswerType;
  options?: string[];
  presets?: string[];
  aliases?: string[];
};

type ScreeningFieldView = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType: ScreeningAnswerType;
  category: ScreeningFieldCategory;
  order: number;
  options?: string[];
  presets?: string[];
  source: "site" | "extension" | "pending" | "merged";
};

const EXT_BRIDGE_PING_TIMEOUT_MS = 4500;
const EXT_BRIDGE_ACK_TIMEOUT_MS = 5000;
const EXTENSION_PACKAGE_PREFIX = "AutoApplyCVExtensionVersion";
const PREFERENCE_LOCATION_KEYS = new Set(["cp_pref_search_locations", "cp_pref_search_location", "preferred_locations"]);
const YES_NO_OPTIONS = ["No", "Yes"];
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
const WORK_AUTHORIZATION_OPTIONS = [
  "U.S. Citizen/Permanent Resident",
  "Authorized to work in the U.S.",
  "Require sponsorship",
  "Not authorized",
];

function formatExtensionPackageName(version: string) {
  const normalized = String(version || "").trim();
  return normalized ? `${EXTENSION_PACKAGE_PREFIX}${normalized}` : EXTENSION_PACKAGE_PREFIX;
}

function formatExtensionPackageFileName(version: string) {
  return `${formatExtensionPackageName(version)}.zip`;
}

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toQuestionKey(value: string) {
  return mapQuestionKey(value);
}

function labelFromQuestionKey(questionKey: string) {
  const key = String(questionKey || "").trim();
  if (!key) return "Screening field";
  const prettyByKnownKey: Record<string, string> = {
    full_name: "Full Name",
    first_name: "First Name",
    last_name: "Last Name",
    email_address: "Email Address",
    phone_number: "Phone Number",
    current_city: "Current City",
    state_region: "State / Region",
    country: "Country",
    address_line: "Address Line",
    linkedin_url: "LinkedIn URL",
    portfolio_url: "Portfolio URL",
    work_authorization_us: "U.S. Work Authorization",
    visa_sponsorship_required: "Need Visa Sponsorship",
    comfortable_working_onsite: "Comfortable Working Onsite",
    comfortable_commuting: "Comfortable Commuting",
    comfortable_relocation: "Comfortable Relocation",
    expected_salary: "Expected Salary",
    years_of_experience: "Years of Experience",
    bachelors_degree_completed: "Bachelor's Degree Completed",
    english_proficiency: "English Proficiency",
    education_level: "Education Level",
    preferred_job_titles: "Preferred Job Titles / Search Terms",
    preferred_locations: "Preferred Locations",
    cp_pref_search_terms: "Preferred Job Titles / Search Terms",
    cp_pref_search_location: "Preferred Locations",
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
  if (prettyByKnownKey[key]) return prettyByKnownKey[key];
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickFirstNonEmpty(answers: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const direct = String(answers[key] || "").trim();
    if (direct) return direct;

    // Back-compat: some saved keys end up in a label-like form.
    const normalized = normalizeLabel(key);
    const viaNormalized = String((answers as any)[normalized] || "").trim();
    if (viaNormalized) return viaNormalized;
  }
  return "";
}

function splitFullName(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function parseSearchTermsInput(value: string) {
  return String(value || "")
    .split(/[,\n;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 25);
}

function parsePreferenceListInput(value: string) {
  return String(value || "")
    .split(/[,\n;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 25);
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
  return parsePreferenceListInput(value).some((item) => normalizeLabel(item) === "remote");
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

function stringifyPreferenceList(values: string[]) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function compactAnswer(value: string, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

const syncedExtensionAnswersModule = new Map<string, string>();
let authSyncBlockedModule = false;

function inferAnswerType(answer: string): ScreeningAnswerType {
  const value = String(answer || "").trim();
  if (!value) return "text";
  const lower = value.toLowerCase();
  if (lower === "yes" || lower === "no") return "boolean";
  if (/^\d+(\.\d+)?$/.test(value)) return "number";
  if (value.includes(",")) return "multiselect";
  return "text";
}

const SCREENING_SECTION_META: Record<ScreeningFieldCategory, { title: string; subtitle: string }> = {
  profile: {
    title: "Profile Answers",
    subtitle: "Core details from onboarding used across Easy Apply forms.",
  },
  preferences: {
    title: "Job Preferences",
    subtitle: "Search targets and AutoApply preferences synced to the extension.",
  },
  screening: {
    title: "Custom Screening Answers",
    subtitle: "Extra question/answer pairs captured from LinkedIn applications.",
  },
};

const CATEGORY_ICON: Record<ScreeningFieldCategory, { icon: LucideIcon; bg: string }> = {
  profile: { icon: User, bg: "bg-gradient-to-br from-indigo-500 to-violet-600" },
  preferences: { icon: Sliders, bg: "bg-gradient-to-br from-blue-500 to-cyan-500" },
  screening: { icon: List, bg: "bg-gradient-to-br from-purple-500 to-pink-500" },
};

const SCREENING_FIELD_CATALOG: ScreeningCatalogField[] = [
  { key: "full_name", label: "Full Name", category: "profile", order: 10, aliases: ["full legal name", "legal name"] },
  { key: "first_name", label: "First Name", category: "profile", order: 20, aliases: ["given name"] },
  { key: "last_name", label: "Last Name", category: "profile", order: 30, aliases: ["family name", "surname"] },
  { key: "email_address", label: "Email Address", category: "profile", order: 40, aliases: ["email"] },
  { key: "phone_number", label: "Phone Number", category: "profile", order: 50, aliases: ["phone", "mobile phone", "mobile phone number", "contact number"] },
  { key: "address_line", label: "Address Line", category: "profile", order: 60 },
  { key: "current_city", label: "Current City", category: "profile", order: 70, aliases: ["city", "your location city state", "location city state"] },
  { key: "state_region", label: "State / Region", category: "profile", order: 80, aliases: ["state", "region"] },
  { key: "country", label: "Country", category: "profile", order: 90 },
  { key: "linkedin_url", label: "LinkedIn URL", category: "profile", order: 100, aliases: ["linkedin profile", "linkedin profile url"] },
  { key: "portfolio_url", label: "Portfolio URL", category: "profile", order: 110, aliases: ["portfolio", "portfolio website", "portfolio site"] },
  {
    key: "work_authorization_us",
    label: "U.S. Work Authorization",
    category: "profile",
    order: 120,
    answerType: "choice",
    options: WORK_AUTHORIZATION_OPTIONS,
    aliases: ["cp_pref_us_citizenship", "careerpilot_preference_us_work_authorization", "autoapply cv preference us work authorization", "autoapply cv preference: us work authorization"],
  },
  {
    key: "visa_sponsorship_required",
    label: "Need Visa Sponsorship",
    category: "profile",
    order: 130,
    answerType: "boolean",
    options: YES_NO_OPTIONS,
    aliases: ["cp_pref_require_visa", "careerpilot_preference_need_visa_sponsorship", "careerpilot_preference_require_visa", "autoapply cv preference need visa sponsorship", "autoapply cv preference: need visa sponsorship"],
  },
  {
    key: "years_of_experience",
    label: "Years of Experience",
    category: "profile",
    order: 140,
    answerType: "number",
    aliases: ["cp_pref_years_of_experience", "autoapply cv preference years of experience", "autoapply cv preference: years of experience"],
  },
  {
    key: "english_proficiency",
    label: "English Proficiency",
    category: "profile",
    order: 150,
    answerType: "choice",
    options: ENGLISH_PROFICIENCY_OPTIONS,
  },
  {
    key: "education_level",
    label: "Education Level",
    category: "profile",
    order: 160,
    answerType: "choice",
    options: EDUCATION_LEVEL_OPTIONS,
  },
  {
    key: "cp_pref_search_terms",
    label: "Preferred Job Titles / Search Terms",
    category: "preferences",
    order: 200,
    answerType: "multiselect",
    aliases: [
      "preferred_job_titles",
      "preferred job titles",
      "preferred_job_titles_search_terms",
      "preferred job titles search terms",
      "careerpilot_preference_search_terms",
      "autoapply cv preference search terms",
      "autoapply cv preference: search terms",
    ],
  },
  {
    key: "cp_pref_search_locations",
    label: "Preferred Locations",
    category: "preferences",
    order: 210,
    answerType: "multiselect",
    aliases: ["preferred_locations", "preferred locations", "cp_pref_search_location", "primary search location", "careerpilot_preference_search_location", "autoapply cv preference search location", "autoapply cv preference: search location"],
  },
  {
    key: "cp_pref_work_mode",
    label: "Remote / Onsite / Hybrid",
    category: "preferences",
    order: 220,
    answerType: "choice",
    options: WORK_MODE_OPTIONS,
    aliases: ["remote_onsite_hybrid", "work_mode_preference"],
  },
  {
    key: "cp_pref_job_types",
    label: "Job Types",
    category: "preferences",
    order: 230,
    answerType: "multiselect",
    presets: JOB_TYPE_OPTIONS,
    aliases: ["job_types"],
  },
  {
    key: "cp_pref_preferred_countries",
    label: "Preferred Countries",
    category: "preferences",
    order: 240,
    answerType: "multiselect",
    aliases: ["preferred_countries"],
  },
  {
    key: "cp_pref_confidence_level",
    label: "Confidence Level",
    category: "preferences",
    order: 250,
    answerType: "number",
    aliases: [
      "autoapply cv preference confidence level",
      "autoapply cv preference: confidence level",
      "careerpilot preference confidence level",
      "careerpilot preference: confidence level",
    ],
  },
  { key: "cp_pref_salary_min", label: "Salary Range Min", category: "preferences", order: 260, answerType: "number" },
  { key: "cp_pref_salary_max", label: "Salary Range Max", category: "preferences", order: 270, answerType: "number" },
  { key: "cp_pref_desired_salary", label: "Desired Salary", category: "preferences", order: 280 },
  { key: "cp_pref_excluded_companies", label: "Excluded Companies", category: "preferences", order: 290, answerType: "multiselect" },
  { key: "cp_pref_excluded_keywords", label: "Excluded Keywords", category: "preferences", order: 300, answerType: "multiselect" },
  { key: "comfortable_working_onsite", label: "Comfortable Working Onsite", category: "screening", order: 500, answerType: "boolean", options: YES_NO_OPTIONS },
  { key: "comfortable_commuting", label: "Comfortable Commuting", category: "screening", order: 510, answerType: "boolean", options: YES_NO_OPTIONS },
  { key: "comfortable_relocation", label: "Comfortable Relocation", category: "screening", order: 520, answerType: "boolean", options: YES_NO_OPTIONS },
  { key: "bachelors_degree_completed", label: "Bachelor's Degree Completed", category: "screening", order: 530, answerType: "boolean", options: YES_NO_OPTIONS },
];

const SCREENING_FIELD_LOOKUP = (() => {
  const map = new Map<string, ScreeningCatalogField>();
  for (const field of SCREENING_FIELD_CATALOG) {
    for (const rawValue of [field.key, field.label, ...(field.aliases || [])]) {
      const candidates = [
        String(rawValue || "").trim(),
        normalizeLabel(rawValue),
        toQuestionKey(String(rawValue || "").trim()),
      ].filter(Boolean);
      for (const candidate of candidates) {
        if (!map.has(candidate)) {
          map.set(candidate, field);
        }
      }
    }
  }
  return map;
})();

function lookupCatalogField(...values: Array<string | undefined>) {
  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const candidates = [raw, normalizeLabel(raw), toQuestionKey(raw)].filter(Boolean);
    for (const candidate of candidates) {
      const match = SCREENING_FIELD_LOOKUP.get(candidate);
      if (match) return match;
    }
  }
  return null;
}

export default function Jobs() {
  const { user } = useAuth();
  const extensionZipUrl = String(process.env.NEXT_PUBLIC_EXTENSION_ZIP_URL || "/api/public/extension-download").trim();
  const linkedInExtensionZipUrl = `${extensionZipUrl}?provider=linkedin`;
  const indeedExtensionZipUrl = `${extensionZipUrl}?provider=indeed`;
  const extensionStoreUrl = String(
    process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || getExtensionProviderConfig("linkedin").storeUrl || "",
  ).trim();
  const [extensionRelease, setExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "1.1.3",
    displayName: "AutoApply CV Copilot",
    downloadFileName: formatExtensionPackageFileName("1.1.3"),
    downloadBaseName: formatExtensionPackageName("1.1.3"),
  });
  const [indeedExtensionRelease, setIndeedExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "0.1.0",
    displayName: "AutoApply CV Indeed Copilot Beta",
    downloadFileName: "AutoApplyCVIndeedExtensionVersion0.1.0.zip",
    downloadBaseName: "AutoApplyCVIndeedExtensionVersion0.1.0",
  });
  const [error, setError] = useState("");
  const [installMessage, setInstallMessage] = useState("");
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({
    installed: false,
  });
  const currentPackageBaseName =
    extensionRelease.downloadBaseName || formatExtensionPackageName(extensionRelease.version || "1.1.3");
  const currentPackageFileName =
    extensionRelease.downloadFileName || formatExtensionPackageFileName(extensionRelease.version || "1.1.3");
  const versionBadgeRef = useRef<HTMLSpanElement | null>(null);
  const checkExtensionButtonRef = useRef<HTMLButtonElement | null>(null);
  const openLinkedInJobsButtonRef = useRef<HTMLAnchorElement | null>(null);
  const storeLinkButtonRef = useRef<HTMLAnchorElement | null>(null);
  const syncProfileButtonRef = useRef<HTMLButtonElement | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [jobBoardsOpen, setJobBoardsOpen] = useState(false);
  const [selectedBoardOpen, setSelectedBoardOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("linkedin");
  const activeBoard = useMemo(
    () => JOB_BOARDS.find((board) => board.id === selectedBoardId) || JOB_BOARDS[0],
    [selectedBoardId],
  );
  const [installGuideStepIndex, setInstallGuideStepIndex] = useState(0);
  const [installGuideCompletedIds, setInstallGuideCompletedIds] = useState<string[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [siteScreeningAnswers, setSiteScreeningAnswers] = useState<Record<string, string>>({});
  const [siteQuestionLabels, setSiteQuestionLabels] = useState<Record<string, string>>({});
  const [siteAnswerTypes, setSiteAnswerTypes] = useState<Record<string, ScreeningAnswerType>>({});
  const [savingAnswerKey, setSavingAnswerKey] = useState<string | null>(null);
  const [syncingSettings, setSyncingSettings] = useState(false);
  const syncedAnswerRef = useRef<Record<string, string>>({});
  const reportedIssueRef = useRef<Record<string, string>>({});
  const autoSavedPendingKeysRef = useRef<Set<string>>(new Set());
  const pendingAnswersRefreshRef = useRef<string>("");
  const linkedInProviderStatus = extensionStatus.providers?.linkedin;
  const indeedProviderStatus = extensionStatus.providers?.indeed;
  const linkedInInstalled = Boolean(
    linkedInProviderStatus?.installed ||
      (extensionStatus.installed && !indeedProviderStatus),
  );
  const indeedInstalled = Boolean(indeedProviderStatus?.installed);
  const linkedInReady = Boolean(
    linkedInInstalled &&
      extensionStatus.linkedIn?.hasLinkedInTab &&
      extensionStatus.linkedIn?.hasJobsTab,
  );
  const linkedInInstalledVersion =
    linkedInProviderStatus?.version || extensionStatus.version || extensionRelease.version;
  const indeedInstalledVersion =
    indeedProviderStatus?.version || indeedExtensionRelease.version;
  const installedPackageName = linkedInInstalled
    ? formatExtensionPackageName(linkedInInstalledVersion || "")
    : "";

  const resolveKnownAnswer = (
    questionKey: string,
    questionLabel: string,
    extensionAnswers: Record<string, string> = {},
  ) => {
    const normalizedLabel = normalizeLabel(questionLabel);
    const direct =
      String(answerDrafts[questionKey] || "").trim() ||
      String(siteScreeningAnswers[questionKey] || "").trim() ||
      String(siteScreeningAnswers[normalizedLabel] || "").trim() ||
      String(extensionAnswers[questionKey] || "").trim() ||
      String(extensionAnswers[normalizedLabel] || "").trim();
    if (direct) return direct;
    for (const source of [siteScreeningAnswers, extensionAnswers]) {
      for (const [rawKey, rawValue] of Object.entries(source)) {
        const value = String(rawValue || "").trim();
        if (!value) continue;
        if (toQuestionKey(rawKey) === questionKey) return value;
        if (normalizeLabel(rawKey) === normalizedLabel) return value;
      }
    }
    return resolveProfileAnswer(questionKey, questionLabel);
  };

  const resolveProfileAnswer = (questionKey: string, questionLabel: string): string => {
    const canonical = toQuestionKey(questionKey || questionLabel);
    const label = normalizeLabel(questionLabel || "");
    const nameParts = String(user?.name || "").trim().split(/\s+/).filter(Boolean);
    const profile: Record<string, string> = {
      full_name: String(user?.name || "").trim(),
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      email_address: String(user?.email || "").trim(),
      phone_number: String(user?.phone || "").trim(),
      current_city: String(user?.currentCity || "").trim(),
      address_line: String(user?.addressLine || "").trim(),
      linkedin_url: String(user?.linkedinUrl || "").trim(),
      portfolio_url: String(user?.portfolioUrl || "").trim(),
    };
    if (profile[canonical]) return profile[canonical];
    if (canonical.includes("linkedin") && profile.linkedin_url) return profile.linkedin_url;
    if ((canonical.includes("city") || canonical.includes("location")) && profile.current_city) return profile.current_city;
    if ((canonical.includes("email") || canonical.includes("mail")) && profile.email_address) return profile.email_address;
    if (label.includes("linkedin") && profile.linkedin_url) return profile.linkedin_url;
    if ((label.includes("city") || label.includes("location") || label.includes("address")) && profile.current_city) return profile.current_city;
    if (label.includes("portfolio") && profile.portfolio_url) return profile.portfolio_url;

    const mergedAnswers: Record<string, string> = {
      ...(extensionStatus.screeningAnswers || {}),
      ...(answerDrafts || {}),
      ...siteScreeningAnswers,
    };
    const preferenceAliases: Record<string, string[]> = {
      years_of_experience: ["cp_pref_years_of_experience", "careerpilot_preference_years_of_experience", "years_of_experience"],
      work_authorization_us: ["cp_pref_us_citizenship", "careerpilot_preference_us_work_authorization", "us_work_authorization"],
      visa_sponsorship_required: ["cp_pref_require_visa", "careerpilot_preference_require_visa", "careerpilot_preference_need_visa_sponsorship"],
      comfortable_working_onsite: ["cp_pref_work_mode", "remote_onsite_hybrid", "work_mode_preference"],
      comfortable_commuting: ["cp_pref_work_mode", "remote_onsite_hybrid", "work_mode_preference"],
      comfortable_relocation: ["cp_pref_work_mode", "remote_onsite_hybrid", "work_mode_preference"],
      expected_salary: ["cp_pref_desired_salary", "cp_pref_salary_min", "desired_salary"],
      cp_pref_confidence_level: ["cp_pref_confidence_level", "careerpilot_preference_confidence_level", "confidence_level"],
      current_city: ["current_city", "your_location_city_state", "location_city"],
      state_region: ["state_region", "state", "your_location_state"],
      country: ["country", "preferred_countries"],
      linkedin_url: ["linkedin_url", "linkedin_profile"],
      portfolio_url: ["portfolio_url", "website_url"],
      address_line: ["address_line", "street_address"],
    };
    const aliasKeys = preferenceAliases[canonical];
    if (aliasKeys) {
      const aliasValue = pickFirstNonEmpty(mergedAnswers, aliasKeys);
      if (aliasValue) return aliasValue;
    }
    const relatedByPrefix = Object.entries(preferenceAliases).find(
      ([key]) => canonical.includes(key) || key.includes(canonical)
    );
    if (relatedByPrefix) {
      const relatedValue = pickFirstNonEmpty(mergedAnswers, relatedByPrefix[1]);
      if (relatedValue) return relatedValue;
    }
    if (canonical.startsWith("what_is_your_experience_with_")) {
      const totalYears = pickFirstNonEmpty(mergedAnswers, ["cp_pref_years_of_experience", "careerpilot_preference_years_of_experience", "years_of_experience"]);
      if (totalYears) return totalYears;
    }
    return "";
  };

  const remoteWorkModeSelected = useMemo(() => {
    const mergedAnswers: Record<string, string> = {
      ...(extensionStatus.screeningAnswers || {}),
      ...siteScreeningAnswers,
    };
    for (const [rawKey, rawValue] of Object.entries(answerDrafts)) {
      const answer = String(rawValue || "").trim();
      if (!answer) continue;
      mergedAnswers[rawKey] = answer;
    }
    const workModeAnswer = pickFirstNonEmpty(mergedAnswers, [
      "cp_pref_work_mode",
      "remote_onsite_hybrid",
      "work_mode_preference",
    ]);
    return isRemoteWorkModeSelected(workModeAnswer);
  }, [answerDrafts, extensionStatus.screeningAnswers, siteScreeningAnswers]);

  const installGuideSteps = useMemo<ExtensionInstallGuideStep[]>(
    () => [
      {
        id: "install-store",
        title: "Install from Chrome Web Store",
        body: "Open the AutoApply CV Copilot page on the Chrome Web Store and click Add to Chrome.",
        note: extensionStoreUrl
          ? "The extension installs automatically after you confirm the permission prompt."
          : "You can also search for 'AutoApply CV Copilot' on the Chrome Web Store.",
        actionLabel: "Open Chrome Web Store",
        targetRef: storeLinkButtonRef,
      },
      {
        id: "pin-extension",
        title: "Pin extension",
        body: "Click the puzzle piece icon in Chrome's toolbar, find AutoApply CV Copilot, and pin it for easy access.",
        image: "/Install guide/Pin extension.png",
        imageAlt: "Chrome toolbar showing the extensions menu with pin option",
        targetRef: checkExtensionButtonRef,
      },
      {
        id: "verify-install",
        title: "Check extension",
        body: "After the extension is installed, click the extension icon, make sure you are signed in to LinkedIn, then come back here and click Check Extension.",
        note: installedPackageName
          ? `Detected right now: ${installedPackageName}. If this is the new version, click Step done.`
          : "If detection still fails, refresh this page and click Check Extension again, then click Step done.",
        actionLabel: checkingExtension ? "Checking..." : "Check extension",
        actionDisabled: checkingExtension,
        targetRef: checkExtensionButtonRef,
      },
    ],
    [checkingExtension, extensionStoreUrl, installedPackageName],
  );

  const applySavedAnswersLocally = (payloads: Array<{
    questionKey: string;
    questionLabel: string;
    answer: string;
    answerType: ScreeningAnswerType;
  }>) => {
    for (const p of payloads) {
      syncedAnswerRef.current[p.questionKey] = p.answer;
      syncedExtensionAnswersModule.set(p.questionKey, p.answer);
      setSiteScreeningAnswers((prev) => ({
        ...prev,
        [p.questionKey]: p.answer,
        [normalizeLabel(p.questionLabel)]: p.answer,
      }));
      setSiteQuestionLabels((prev) => ({
        ...prev,
        [p.questionKey]: p.questionLabel,
      }));
      setSiteAnswerTypes((prev) => ({
        ...prev,
        [p.questionKey]: p.answerType,
      }));
    }
  };

  const saveAnswersToSiteBulk = async (
    items: Array<{
      questionKey: string;
      questionLabel: string;
      answer: string;
      answerType: ScreeningAnswerType;
      source: ScreeningAnswerSource;
    }>,
  ) => {
    const payloads = items
      .map((it) => ({
        questionKey: String(it.questionKey || "").trim(),
        questionLabel: String(it.questionLabel || "").trim() || labelFromQuestionKey(it.questionKey),
        answer: compactAnswer(it.answer),
        answerType: it.answerType || inferAnswerType(it.answer),
        source: it.source || "manual",
        lastUsed: new Date().toISOString(),
      }))
      .filter((p) => p.questionKey && p.answer);
    if (!payloads.length) return;

    const res = await fetch("/api/user/screening/answers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloads.length === 1 ? payloads[0] : payloads),
    });
    if (res.status === 401) {
      authSyncBlockedModule = true;
      const err = new Error("Unauthorized");
      err.name = "AuthError";
      throw err;
    }
    if (!res.ok) {
      let message = "Failed to save answers on site";
      try {
        const data = await res.json();
        if (data?.message) message = String(data.message);
      } catch {
        // Keep default error.
      }
      throw new Error(message);
    }

    applySavedAnswersLocally(payloads);
  };

  const saveAnswerToSite = async (
    questionKey: string,
    questionLabel: string,
    answer: string,
    answerType: ScreeningAnswerType = inferAnswerType(answer),
    source: ScreeningAnswerSource = "manual",
  ) => {
    const payload = {
      questionKey: String(questionKey || "").trim(),
      questionLabel: String(questionLabel || "").trim() || labelFromQuestionKey(questionKey),
      answer: compactAnswer(answer),
      answerType,
      source,
      lastUsed: new Date().toISOString(),
    };
    if (!payload.questionKey || !payload.answer) return;

    await saveAnswersToSiteBulk([payload]);
  };

  const loadSiteScreeningAnswers = async () => {
    try {
      const res = await fetch("/api/user/screening/answers", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      const answers = Array.isArray(data?.data?.answers) ? (data.data.answers as ScreeningAnswerApiItem[]) : [];
      const answerMap: Record<string, string> = {};
      const labelMap: Record<string, string> = {};
      const typeMap: Record<string, ScreeningAnswerType> = {};
      for (const item of answers) {
        const questionKey = String(item?.questionKey || "").trim();
        const questionLabel = String(item?.questionLabel || "").trim();
        const answer = String(item?.answer || "").trim();
        if (!questionKey || !answer) continue;
        answerMap[questionKey] = answer;
        typeMap[questionKey] = item?.answerType || inferAnswerType(answer);
        if (questionLabel) {
          answerMap[normalizeLabel(questionLabel)] = answer;
          labelMap[questionKey] = questionLabel;
        }
        syncedAnswerRef.current[questionKey] = answer;
        syncedExtensionAnswersModule.set(questionKey, compactAnswer(answer));
      }
      setSiteScreeningAnswers(answerMap);
      setSiteQuestionLabels(labelMap);
      setSiteAnswerTypes(typeMap);
      setAnswerDrafts((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [key, value] of Object.entries(answerMap)) {
          if (!value) continue;
          if (!next[key]) {
            next[key] = value;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch {
      // Best effort.
    }
  };

  const syncExtensionAnswersToSite = async (status: ExtensionStatus) => {
    if (authSyncBlockedModule) return;
    const extensionAnswers = status.screeningAnswers || {};
    const entries = Object.entries(extensionAnswers);
    if (!entries.length) return;

    const pendingLabelMap = new Map<string, string>();
    for (const pending of status.pendingQuestions || []) {
      const key = toQuestionKey(pending.questionKey || pending.questionLabel || "");
      if (!key) continue;
      pendingLabelMap.set(key, String(pending.questionLabel || "").trim() || labelFromQuestionKey(key));
    }

    const knownSite = new Map<string, string>();
    for (const [k, v] of Object.entries(siteScreeningAnswers)) {
      const answer = compactAnswer(String(v || "").trim());
      if (!answer) continue;
      const key = toQuestionKey(k);
      if (!key) continue;
      knownSite.set(key, answer);
    }

    const toSync: Array<{
      questionKey: string;
      questionLabel: string;
      answer: string;
      answerType: ScreeningAnswerType;
      source: ScreeningAnswerSource;
    }> = [];
    for (const [rawKey, rawValue] of entries) {
      const answer = compactAnswer(String(rawValue || "").trim());
      if (!answer) continue;
      const canonicalKey = toQuestionKey(rawKey);
      if (!canonicalKey) continue;
      // Never push captured preference-location values (e.g. a bot-captured "Mohali")
      // back to the site as extension_capture; those would clobber the user's manually
      // saved preferred locations. Mirror the extension's own preference-location guard
      // in content.js and the read-side guard in the screening answers API.
      if (PREFERENCE_LOCATION_KEYS.has(canonicalKey)) continue;
      if (syncedExtensionAnswersModule.get(canonicalKey) === answer) continue;
      if (knownSite.get(canonicalKey) === answer) continue;
      const questionLabel =
        pendingLabelMap.get(canonicalKey) ||
        siteQuestionLabels[canonicalKey] ||
        labelFromQuestionKey(canonicalKey);
      const catalogField = lookupCatalogField(canonicalKey, rawKey, questionLabel);
      const answerType = catalogField?.answerType || siteAnswerTypes[canonicalKey] || inferAnswerType(answer);
      toSync.push({ questionKey: canonicalKey, questionLabel, answer, answerType, source: "extension_capture" });
    }

    if (toSync.length) {
      try {
        await saveAnswersToSiteBulk(toSync);
      } catch {
        // Keep running if the batch sync fails; it will retry on the next poll.
      }
    }
  };

  const checkExtensionStatus = async () => {
    if (typeof window === "undefined") return;
    setCheckingExtension(true);
    try {
      let snapshot = await collectExtensionBridgeSnapshot({
        timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
        settleMs: 500,
        requestIdPrefix: "cp_jobs",
      });
      if (!snapshot.installed) {
        snapshot = await collectExtensionBridgeSnapshot({
          timeoutMs: EXT_BRIDGE_PING_TIMEOUT_MS,
          settleMs: 500,
          requestIdPrefix: "cp_jobs_retry",
        });
      }
      const result: ExtensionStatus = {
        installed: snapshot.installed,
        runtimeId: snapshot.runtimeId,
        version: snapshot.version,
        providers: {
          linkedin: snapshot.providers.linkedin
            ? {
                installed: Boolean(snapshot.providers.linkedin.installed),
                version: snapshot.providers.linkedin.version,
              }
            : undefined,
          indeed: snapshot.providers.indeed
            ? {
                installed: Boolean(snapshot.providers.indeed.installed),
                version: snapshot.providers.indeed.version,
              }
            : undefined,
        },
        linkedIn: snapshot.linkedIn || undefined,
        indeed: snapshot.indeed || undefined,
        state: snapshot.state || null,
        pendingQuestions: Array.isArray(snapshot.pendingQuestions) ? (snapshot.pendingQuestions as any) : [],
        screeningAnswers: snapshot.screeningAnswers || {},
        error: snapshot.error || null,
      };
      setExtensionStatus(result);
      await syncExtensionAnswersToSite(result);

      if (result.pendingQuestions?.length) {
        const pendingSig = JSON.stringify(
          (result.pendingQuestions as any[])
            .map((q: any) => String(q.questionKey || q.questionLabel || "").trim())
            .sort(),
        );
        if (pendingAnswersRefreshRef.current !== pendingSig) {
          pendingAnswersRefreshRef.current = pendingSig;
          void loadSiteScreeningAnswers();
        }
        const presetDrafts: Record<string, string> = {};
        const autoSaveQueue: Array<{ q: any; answer: string }> = [];
        for (const q of result.pendingQuestions) {
          const normalizedKey = toQuestionKey(q.questionKey || q.questionLabel || "");
          if (!normalizedKey) continue;
          let preset = resolveKnownAnswer(normalizedKey, q.questionLabel, result.screeningAnswers || {});
          if (!preset) {
            const profileAnswer = resolveProfileAnswer(q.questionKey, q.questionLabel);
            if (profileAnswer) preset = profileAnswer;
          }
          if (preset) presetDrafts[normalizedKey] = preset;

          if (preset && !autoSavedPendingKeysRef.current.has(normalizedKey)) {
            autoSavedPendingKeysRef.current.add(normalizedKey);
            autoSaveQueue.push({ q, answer: preset });
          }

          if (q.questionKey && q.questionLabel) {
            const issueSignature = `${q.questionKey}::${String(q.validationMessage || "").trim()}`;
            if (reportedIssueRef.current[q.questionKey] !== issueSignature) {
              reportedIssueRef.current[q.questionKey] = issueSignature;
              fetch("/api/user/screening/issues", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  questionKey: q.questionKey,
                  questionLabel: q.questionLabel,
                  validationMessage: q.validationMessage || "",
                }),
              }).catch(() => {});
            }
          }
        }
        if (Object.keys(presetDrafts).length) {
          setAnswerDrafts((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const [key, value] of Object.entries(presetDrafts)) {
              if (!next[key]) {
                next[key] = value;
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
        if (autoSaveQueue.length) {
          for (const { q, answer } of autoSaveQueue) {
            const pendingCatalog = lookupCatalogField(q.questionKey || q.questionLabel, q.questionLabel);
            const pendingKey = toQuestionKey(q.questionKey || q.questionLabel);
            const pendingAnswerType =
              pendingCatalog?.answerType || siteAnswerTypes[pendingKey] || inferAnswerType(answer);
            void saveAnswerForQuestion(q.questionKey, q.questionLabel, pendingAnswerType, answer).catch(() => {});
          }
        }
      }
    } finally {
      setCheckingExtension(false);
    }
  };

  const derivePhoneCountryCode = (phone?: string) => {
    const raw = String(phone || "").trim();
    if (!raw) return "+91";
    if (raw.startsWith("+")) {
      const m = raw.match(/^\+\d{1,3}/);
      return m ? m[0] : "+91";
    }
    return "+91";
  };

  const derivePhoneNumber = (phone?: string) => {
    const raw = String(phone || "").trim();
    if (!raw) return "";
    return raw.replace(/[^\d]/g, "");
  };

  const syncProfileToExtension = async () => {
    if (typeof window === "undefined") return;
    if (!extensionStatus.installed) {
      setError("Extension not detected. Install/reload extension first.");
      return;
    }
    try {
      setSyncingSettings(true);
      setError("");

      const mergedAnswers: Record<string, string> = {
        ...(extensionStatus.screeningAnswers || {}),
        ...siteScreeningAnswers,
      };
      for (const [rawKey, rawValue] of Object.entries(answerDrafts)) {
        const answer = String(rawValue || "").trim();
        if (!answer) continue;
        mergedAnswers[rawKey] = answer;
      }

      // These preferences are stored as screening answers on the site, but the extension expects them as settings.
      const preferredSearchLocation = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_search_locations",
        "preferred_locations",
        "cp_pref_search_location",
        "careerpilot_preference_search_location",
      ]);
      const preferredSearchTermsRaw = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_search_terms",
        "preferred_job_titles",
        "careerpilot_preference_search_terms",
      ]);
      const preferredSearchTerms = parseSearchTermsInput(preferredSearchTermsRaw);
      const preferredLocations = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, [
          "preferred_locations",
          "cp_pref_search_locations",
          "cp_pref_search_location",
        ]),
      );
      const preferredJobTypes = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, ["cp_pref_job_types", "job_types"]),
      );
      const preferredCountries = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, ["cp_pref_preferred_countries", "preferred_countries"]),
      );
      const preferredWorkMode = parsePreferenceListInput(
        pickFirstNonEmpty(mergedAnswers, ["cp_pref_work_mode", "remote_onsite_hybrid", "work_mode_preference"]),
      );
      const remoteModeSelected = preferredWorkMode.some((value) => normalizeLabel(value) === "remote");
      const preferredYearsOfExperience = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_years_of_experience",
        "careerpilot_preference_years_of_experience",
        "years_of_experience",
      ]);
      const preferredConfidenceLevel = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_confidence_level",
        "careerpilot_preference_confidence_level",
      ]);
      const preferredRequireVisa = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_require_visa",
        "careerpilot_preference_need_visa_sponsorship",
        "careerpilot_preference_require_visa",
      ]);
      const preferredUsCitizenship = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_us_citizenship",
        "careerpilot_preference_us_work_authorization",
      ]);
      const preferredSalaryMin = pickFirstNonEmpty(mergedAnswers, ["cp_pref_salary_min", "desired_salary"]);
      const preferredSalaryMax = pickFirstNonEmpty(mergedAnswers, [
        "cp_pref_salary_max",
        "cp_pref_desired_salary",
        "desired_salary",
      ]);

      const screeningAnswersForSync: Record<string, string> = {};
      const addSyncAnswer = (rawKey: string, rawValue: string, override = false) => {
        const answer = String(rawValue || "").trim();
        if (!answer) return;
        const canonicalKey = toQuestionKey(rawKey);
        if (!canonicalKey) return;
        const catalogField = lookupCatalogField(rawKey, "");
        const displayedKey = catalogField?.key || canonicalKey;
        if (!override && screeningAnswersForSync[displayedKey]) return;
        screeningAnswersForSync[displayedKey] = answer;
      };
      for (const [rawKey, rawValue] of Object.entries(extensionStatus.screeningAnswers || {})) {
        addSyncAnswer(rawKey, rawValue);
      }
      for (const [rawKey, rawValue] of Object.entries(siteScreeningAnswers)) {
        addSyncAnswer(rawKey, rawValue);
      }
      for (const [rawKey, rawValue] of Object.entries(answerDrafts)) {
        addSyncAnswer(rawKey, rawValue, true);
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
        preferredSearchLocation ||
        preferredLocations[0] ||
        (!remoteModeSelected ? currentCity || preferredCountries[0] : "");
      const filterLocations = sanitizeLocationFilterValues(
        remoteModeSelected ? preferredLocations : [...preferredLocations, ...preferredCountries],
      );

      console.log("[CP-LOC] dashboard sync source", {
        resolvedSearchLocation,
        preferredSearchLocation,
        preferredLocations,
        preferredCountries,
        remoteModeSelected,
        currentCity,
        filterLocations,
        raw: {
          cp_pref_search_location: pickFirstNonEmpty(mergedAnswers, ["cp_pref_search_location", "careerpilot_preference_search_location"]),
          preferred_locations: pickFirstNonEmpty(mergedAnswers, ["preferred_locations"]),
          cp_pref_search_locations: pickFirstNonEmpty(mergedAnswers, ["cp_pref_search_locations"]),
          cp_pref_preferred_countries: pickFirstNonEmpty(mergedAnswers, ["cp_pref_preferred_countries"]),
          current_city: pickFirstNonEmpty(mergedAnswers, ["current_city", "your_location_city_state"]),
        },
      });

      const settingsPayload = {
        currentCity,
        searchLocation: resolvedSearchLocation,
        searchTerms: preferredSearchTerms,
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
        salaryMin: preferredSalaryMin || "",
        salaryMax: preferredSalaryMax || "",
        easyApplyOnly: true,
        debugMode: false,
        dryRun: false,
        autoSubmit: true,
        autoResumeOnAnswer: true,
        submitRateMinSec: 40,
        submitRateMaxSec: 70,
        maxApplicationsPerRun: 200,
        maxSkipsPerRun: 50,
        blacklistedCompanies: [],
        badWords: [],
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
        window.postMessage(
          {
            type: "CP_WEB_SYNC_SETTINGS",
            requestId,
            settings: settingsPayload,
          },
          window.location.origin,
        );
      });

      if (!ack.ok) {
        throw new Error(ack.error || "Failed to sync settings");
      }

      await checkExtensionStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sync extension settings");
    } finally {
      setSyncingSettings(false);
    }
  };

  const saveAnswerForQuestion = async (
    questionKey: string,
    questionLabel: string,
    answerType?: ScreeningAnswerType,
    explicitAnswer?: string,
  ) => {
    const canonicalKey = toQuestionKey(questionKey || questionLabel);
    const label = String(questionLabel || "").trim() || labelFromQuestionKey(canonicalKey);
    const answer = compactAnswer(explicitAnswer || answerDrafts[canonicalKey] || answerDrafts[questionKey] || "");
    const resolvedAnswerType =
      answerType ||
      lookupCatalogField(canonicalKey, questionLabel)?.answerType ||
      siteAnswerTypes[canonicalKey] ||
      inferAnswerType(answer);
    if (!answer) {
      setError("Answer cannot be empty.");
      return;
    }
    if (!canonicalKey) {
      setError("Question key is invalid.");
      return;
    }
    try {
      setSavingAnswerKey(canonicalKey);
      setError("");

      await saveAnswerToSite(canonicalKey, label, answer, resolvedAnswerType, "manual");

      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const requestId = `cp_save_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let done = false;
        const timer = window.setTimeout(() => {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          resolve({ ok: false, error: "Extension did not acknowledge answer save. Reload extension and retry." });
        }, EXT_BRIDGE_ACK_TIMEOUT_MS);
        const onMessage = (event: MessageEvent) => {
          const data = event.data as any;
          if (!data || data.type !== "CP_WEB_SAVE_ANSWER_ACK" || data.requestId !== requestId) return;
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          window.removeEventListener("message", onMessage);
          resolve({ ok: Boolean(data.ok), error: data.error || undefined });
        };
        window.addEventListener("message", onMessage);
        window.postMessage(
          {
            type: "CP_WEB_SAVE_ANSWER",
            requestId,
            questionKey: canonicalKey,
            questionLabel: label,
            answer,
          },
          window.location.origin,
        );
      });

      if (!ack.ok) {
        throw new Error(ack.error || "Failed to save answer in extension");
      }
      setAnswerDrafts((prev) => ({
        ...prev,
        [canonicalKey]: answer,
      }));
      await checkExtensionStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save answer");
    } finally {
      setSavingAnswerKey(null);
    }
  };

  type ChatMessage = {
    id: string;
    role: "assistant" | "user";
    text: string;
    questionKey?: string;
    questionLabel?: string;
    answered?: boolean;
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatAnswerTargetRef = useRef<{ questionKey: string; questionLabel: string } | null>(null);
  const chatGreetedRef = useRef(false);
  const chatAskedKeysRef = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const firstName = String(user?.name || "").trim().split(/\s+/)[0] || "there";

  const friendlyFieldPhrase = (questionLabel: string) => {
    const lower = String(questionLabel || "").trim().toLowerCase();
    if (lower.includes("linkedin")) return "your LinkedIn ID or profile URL";
    if (lower.includes("location") || lower.includes("city")) return "your current city";
    if (lower.includes("email")) return "your email address";
    if (lower.includes("phone") || lower.includes("mobile") || lower.includes("contact number")) return "your phone number";
    if (lower.includes("portfolio") || lower.includes("website") || lower.includes("github")) return "your portfolio or website URL";
    if (lower.includes("name")) return "your name";
    if (lower.includes("experience")) return "your years of experience";
    if (lower.includes("salary") || lower.includes("compensation")) return "your expected salary";
    if (lower.includes("visa") || lower.includes("sponsorship")) return "whether you need visa sponsorship";
    if (lower.includes("authorization") || lower.includes("authorized")) return "your work authorization status";
    return `the following: "${String(questionLabel || "").trim()}"`;
  };

  const appendChatMessage = (message: Omit<ChatMessage, "id">) => {
    const id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setChatMessages((prev) => [...prev, { id, ...message }]);
    return id;
  };

  const askNextPendingQuestion = () => {
    const pending = extensionStatus.pendingQuestions || [];
    if (chatAnswerTargetRef.current) {
      const targetKey = toQuestionKey(
        chatAnswerTargetRef.current.questionKey || chatAnswerTargetRef.current.questionLabel || "",
      );
      const stillPending = targetKey && pending.some((q) => {
        const key = toQuestionKey(q.questionKey || q.questionLabel || "");
        return key === targetKey;
      });
      if (stillPending) return;
      chatAnswerTargetRef.current = null;
    }
    const resumeRequired = pending.find(
      (q) => q.questionKey === "resume_upload_required" || /resume/i.test(String(q.validationMessage || "")),
    );
    if (resumeRequired && !chatAskedKeysRef.current.has("resume_upload_required")) {
      chatAskedKeysRef.current.add("resume_upload_required");
      appendChatMessage({
        role: "assistant",
        text: "One more thing — please upload your resume in the LinkedIn Easy Apply profile. Copilot will auto-select the newest attached resume and continue.",
      });
      return;
    }
    const next = pending.find((q) => {
      const key = toQuestionKey(q.questionKey || q.questionLabel || "");
      if (!key) return false;
      if (chatAskedKeysRef.current.has(key)) return false;
      if (autoSavedPendingKeysRef.current.has(key)) return false;
      const mergedAnswers = {
        ...(extensionStatus.screeningAnswers || {}),
        ...siteScreeningAnswers,
      };
      if (resolveKnownAnswer(key, q.questionLabel || "", mergedAnswers)) return false;
      return true;
    });
    if (!next) return;
    const key = toQuestionKey(next.questionKey || next.questionLabel || "");
    chatAskedKeysRef.current.add(key);
    chatAnswerTargetRef.current = { questionKey: next.questionKey, questionLabel: next.questionLabel };
    const validationNote = next.validationMessage ? ` (Note: ${next.validationMessage})` : "";
    appendChatMessage({
      role: "assistant",
      text: `Please send me ${friendlyFieldPhrase(next.questionLabel)}${validationNote}.`,
      questionKey: next.questionKey,
      questionLabel: next.questionLabel,
    });
  };

  useEffect(() => {
    const pending = extensionStatus.pendingQuestions || [];
    if (!pending.length) {
      if (chatGreetedRef.current && chatMessages.length) {
        appendChatMessage({ role: "assistant", text: "All required fields are answered. You're good to continue!" });
      }
      chatGreetedRef.current = false;
      return;
    }
    if (!chatGreetedRef.current) {
      chatGreetedRef.current = true;
      const mergedAnswers = {
        ...(extensionStatus.screeningAnswers || {}),
        ...siteScreeningAnswers,
      };
      const remaining = pending.filter((q) => {
        const key = toQuestionKey(q.questionKey || q.questionLabel || "");
        if (key === "resume_upload_required" || /resume/i.test(String(q.validationMessage || ""))) return false;
        if (!key || chatAskedKeysRef.current.has(key) || autoSavedPendingKeysRef.current.has(key)) return false;
        if (resolveKnownAnswer(key, q.questionLabel || "", mergedAnswers)) return false;
        return true;
      }).length;
      appendChatMessage({
        role: "assistant",
        text:
          `Hey ${firstName}! I need a few more details from you to finish this application. ` +
          (remaining > 1 ? `There are ${remaining} fields left to answer. ` : "") +
          "Just reply right here and I'll save it automatically.",
      });
      askNextPendingQuestion();
      return;
    }
    askNextPendingQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensionStatus.pendingQuestions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages]);

  const sendChatAnswer = async () => {
    const answer = chatInput.trim();
    if (!answer || chatBusy) return;
    const target = chatAnswerTargetRef.current;
    if (!target) return;
    setChatInput("");
    setChatBusy(true);
    appendChatMessage({ role: "user", text: answer });
    try {
      const pendingCatalog = lookupCatalogField(target.questionKey || target.questionLabel, target.questionLabel);
      const pendingKey = toQuestionKey(target.questionKey || target.questionLabel);
      const pendingAnswerType =
        pendingCatalog?.answerType || siteAnswerTypes[pendingKey] || inferAnswerType(answer);
      await saveAnswerForQuestion(target.questionKey, target.questionLabel, pendingAnswerType, answer);
      appendChatMessage({
        role: "assistant",
        text: `Got it — saved "${answer}". Thank you!`,
        answered: true,
      });
      chatAnswerTargetRef.current = null;
      window.setTimeout(() => askNextPendingQuestion(), 250);
    } catch {
      appendChatMessage({
        role: "assistant",
        text: "Sorry, I couldn't save that. Could you try sending it again?",
      });
    } finally {
      setChatBusy(false);
    }
  };

  const answerablePendingQuestions = useMemo(() => {
    const mergedAnswers: Record<string, string> = {
      ...(extensionStatus.screeningAnswers || {}),
      ...siteScreeningAnswers,
    };
    const result = (extensionStatus.pendingQuestions || []).filter((q) => {
      const key = toQuestionKey(q.questionKey || q.questionLabel || "");
      if (!key) return false;
      if (key === "resume_upload_required" || /resume/i.test(String(q.validationMessage || ""))) return false;
      if (chatAskedKeysRef.current.has(key)) return false;
      if (autoSavedPendingKeysRef.current.has(key)) return false;
      const known = resolveKnownAnswer(key, q.questionLabel || "", mergedAnswers);
      if (known) return false;
      return true;
    });
    return result;
  }, [extensionStatus.pendingQuestions, siteScreeningAnswers]);

  useEffect(() => {
    let active = true;
    const loadExtensionMeta = async () => {
      try {
        const [linkedInRes, indeedRes] = await Promise.all([
          fetch("/api/public/extension-meta?provider=linkedin", { cache: "no-store" }),
          fetch("/api/public/extension-meta?provider=indeed", { cache: "no-store" }),
        ]);
        const [linkedInData, indeedData] = await Promise.all([
          linkedInRes.json().catch(() => null),
          indeedRes.json().catch(() => null),
        ]);
        if (linkedInRes.ok && linkedInData?.success && active) {
          setExtensionRelease((prev) => ({
            ...prev,
            ...(linkedInData.data || {}),
          }));
        }
        if (indeedRes.ok && indeedData?.success && active) {
          setIndeedExtensionRelease((prev) => ({
            ...prev,
            ...(indeedData.data || {}),
          }));
        }
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
    void loadSiteScreeningAnswers();
    void checkExtensionStatus();
    const extensionIntervalId = setInterval(() => {
      void checkExtensionStatus();
    }, 20000);
    return () => {
      clearInterval(extensionIntervalId);
    };
  }, []);

  useEffect(() => {
    if (!extensionStatus.installed) return;
    if (!user) return;
    if (!user.email) return;
    if (!user.currentCity && !user.phone) return;
    // Best-effort auto-sync once extension is detected.
    void syncProfileToExtension();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extensionStatus.installed, user?.id, Object.keys(siteScreeningAnswers).length, Object.keys(extensionStatus.screeningAnswers || {}).length]);

  const screeningSections = useMemo(() => {
    const merged = new Map<string, ScreeningFieldView>();
    let customOrder = 0;

    const sourceRank = (source: ScreeningFieldView["source"]) => {
      if (source === "pending") return 4;
      if (source === "site") return 3;
      if (source === "extension") return 2;
      return 1;
    };

    const upsert = (
      rawKey: string,
      questionLabel: string,
      answer: string,
      source: ScreeningFieldView["source"],
      explicitAnswerType?: ScreeningAnswerType,
    ) => {
      const catalogField = lookupCatalogField(rawKey, questionLabel);
      const questionKey = catalogField?.key || toQuestionKey(rawKey || questionLabel);
      if (!questionKey) return;

      const cleanAnswer = String(answer || "").trim();
      const resolvedAnswerType = catalogField?.answerType || explicitAnswerType || inferAnswerType(cleanAnswer);
      const cleanLabel =
        catalogField?.label ||
        String(questionLabel || "").trim() ||
        siteQuestionLabels[questionKey] ||
        labelFromQuestionKey(questionKey);
      const category = catalogField?.category || "screening";
      const order = catalogField?.order ?? 1000 + customOrder++;
      const existing = merged.get(questionKey);

      if (!existing) {
        merged.set(questionKey, {
          questionKey,
          questionLabel: cleanLabel,
          answer: cleanAnswer,
          answerType: resolvedAnswerType,
          category,
          order,
          options: catalogField?.options,
          presets: catalogField?.presets,
          source,
        });
        return;
      }

      const shouldReplaceAnswer =
        (!existing.answer && cleanAnswer) ||
        (cleanAnswer && sourceRank(source) > sourceRank(existing.source));

      merged.set(questionKey, {
        ...existing,
        questionLabel: existing.questionLabel || cleanLabel,
        answer: shouldReplaceAnswer ? cleanAnswer : existing.answer,
        answerType: catalogField?.answerType || existing.answerType || resolvedAnswerType,
        category,
        order: Math.min(existing.order, order),
        options: catalogField?.options || existing.options,
        presets: catalogField?.presets || existing.presets,
        source:
          existing.source === source
            ? existing.source
            : sourceRank(source) === sourceRank(existing.source)
              ? "merged"
              : sourceRank(source) > sourceRank(existing.source)
                ? source
                : existing.source,
      });
    };

    for (const [rawKey, rawAnswer] of Object.entries(siteScreeningAnswers)) {
      const questionKey = toQuestionKey(rawKey);
      upsert(
        rawKey,
        siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey),
        String(rawAnswer || ""),
        "site",
        siteAnswerTypes[questionKey],
      );
    }

    for (const [rawKey, rawAnswer] of Object.entries(extensionStatus.screeningAnswers || {})) {
      const questionKey = toQuestionKey(rawKey);
      upsert(
        rawKey,
        siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey),
        String(rawAnswer || ""),
        "extension",
        lookupCatalogField(questionKey, rawKey)?.answerType,
      );
    }

    for (const pending of extensionStatus.pendingQuestions || []) {
      upsert(
        pending.questionKey || pending.questionLabel,
        pending.questionLabel,
        resolveKnownAnswer(
          pending.questionKey,
          pending.questionLabel,
          extensionStatus.screeningAnswers || {},
        ),
        "pending",
        lookupCatalogField(pending.questionKey || pending.questionLabel, pending.questionLabel)?.answerType,
      );
    }

    const grouped = {
      profile: [] as ScreeningFieldView[],
      preferences: [] as ScreeningFieldView[],
      screening: [] as ScreeningFieldView[],
    };

    for (const field of merged.values()) {
      grouped[field.category].push(field);
    }

    return (Object.keys(SCREENING_SECTION_META) as ScreeningFieldCategory[])
      .map((category) => ({
        category,
        title: SCREENING_SECTION_META[category].title,
        subtitle: SCREENING_SECTION_META[category].subtitle,
        fields: grouped[category]
          .filter((field) => !(remoteWorkModeSelected && field.questionKey === "cp_pref_preferred_countries"))
          .sort((a, b) => {
            if (a.order !== b.order) return a.order - b.order;
            return a.questionLabel.localeCompare(b.questionLabel);
          }),
      }))
      .filter((section) => section.fields.length > 0);
  }, [remoteWorkModeSelected, siteScreeningAnswers, siteQuestionLabels, siteAnswerTypes, extensionStatus.pendingQuestions, extensionStatus.screeningAnswers]);

  const openExtensionStore = () => {
    if (typeof window === "undefined") return;
    setError("");
    setInstallMessage("");
    if (!extensionStoreUrl) {
      setError("Chrome Web Store URL is not configured yet.");
      return;
    }
    const opened = window.open(extensionStoreUrl, "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
    setInstallMessage("Opening the Chrome Web Store. Click Add to Chrome to install the extension.");
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
    setInstallMessage("");
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
      setInstallMessage("Guided install completed. If the extension does not appear yet, refresh this page and check again.");
      return;
    }

    setInstallGuideStepIndex((prev) => Math.min(installGuideSteps.length - 1, prev + 1));
  };

  const runInstallGuideStepAction = (step: ExtensionInstallGuideStep) => {
    if (step.id === "install-store") {
      openExtensionStore();
      return;
    }
    if (step.id === "verify-install") {
      void checkExtensionStatus();
      return;
    }
    if (step.id === "sync-profile") {
      void syncProfileToExtension();
      return;
    }
    if (step.id === "open-linkedin-jobs") {
      openLinkedInJobsTab();
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const maybeOpenQueuedTour = () => {
      if (!consumeDashboardTourRequest(DASHBOARD_TOUR_JOBS_EXTENSION)) return;
      openInstallGuide();
    };

    const onDashboardTourRequest = (event: Event) => {
      const tourId = (event as CustomEvent<{ tourId?: string }>).detail?.tourId || "";
      if (tourId !== DASHBOARD_TOUR_JOBS_EXTENSION) return;
      maybeOpenQueuedTour();
    };

    maybeOpenQueuedTour();
    window.addEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    return () => {
      window.removeEventListener(DASHBOARD_TOUR_EVENT_NAME, onDashboardTourRequest);
    };
  }, [openInstallGuide]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-xs font-bold text-gray-900 mb-2">
            AutoApply CV Copilot
          </h1>
          <p className="text-gray-600">Configure your extension, sync answers, and auto-apply across all job boards.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSelectedBoardOpen((prev) => !prev)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all inline-flex items-center gap-2 shadow-sm"
            >
              <ExternalLink className="w-4 h-4 text-sky-600" />
              {activeBoard.name}
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {selectedBoardOpen ? (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-30 py-2">
                {JOB_BOARDS.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => {
                      setSelectedBoardId(board.id);
                      setSelectedBoardOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${board.id === selectedBoardId ? "font-semibold text-sky-700 bg-sky-50" : "text-gray-700"}`}
                  >
                    {board.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 px-6 py-5 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center shadow-sm">
                <Play className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-gray-900">Extension Workspace</h2>
                <p className="text-sm text-gray-500">
                  Install, verify, and sync your AutoApply CV Copilot across LinkedIn, Indeed, and 10+ job boards.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                ref={checkExtensionButtonRef}
                onClick={() => void checkExtensionStatus()}
                disabled={checkingExtension}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 inline-flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${checkingExtension ? "animate-spin" : ""}`} />
                {checkingExtension ? "Checking..." : "Check Status"}
              </button>
              <button
                type="button"
                onClick={openInstallGuide}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2 shadow-sm ${
                  linkedInInstalled
                    ? "bg-sky-600 text-white hover:bg-sky-700"
                    : "bg-sky-600 text-white hover:bg-sky-700 ring-2 ring-sky-300 ring-offset-1"
                }`}
              >
                <Play className="w-4 h-4" />
                Install Guide
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Extension Info + Status */}
          <div className="space-y-4">
            {/* Status Cards */}
            {activeBoard.provider === "linkedin" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border p-4 transition-all ${linkedInReady ? "border-emerald-200 bg-emerald-50" : linkedInInstalled ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {linkedInReady ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : linkedInInstalled ? (
                    <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center"><Download className="w-3.5 h-3.5 text-sky-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">{activeBoard.name} Extension</span>
                </div>
                <p className="text-xs text-gray-600">
                  {linkedInReady ? "Ready" : linkedInInstalled ? "Installed" : "Not installed yet"}
                </p>
              </div>
              <div className={`rounded-xl border p-4 transition-all ${extensionStatus.linkedIn?.hasLinkedInTab ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {extensionStatus.linkedIn?.hasLinkedInTab ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">{activeBoard.name}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {extensionStatus.linkedIn?.hasLinkedInTab ? "Signed in and open" : "Open linkedin.com first"}
                </p>
              </div>
              <div className={`rounded-xl border p-4 transition-all ${extensionStatus.linkedIn?.hasJobsTab ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {extensionStatus.linkedIn?.hasJobsTab ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">Jobs Tab</span>
                </div>
                <p className="text-xs text-gray-600">
                  {extensionStatus.linkedIn?.hasJobsTab ? "LinkedIn Jobs page open" : "Open LinkedIn Jobs page"}
                </p>
              </div>
            </div>
            ) : activeBoard.provider === "indeed" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border p-4 transition-all ${indeedInstalled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {indeedInstalled ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">{activeBoard.name} Extension</span>
                </div>
                <p className="text-xs text-gray-600">
                  {indeedInstalled ? `Detected v${indeedInstalledVersion}` : "Load the Indeed ZIP"}
                </p>
              </div>
              <div className={`rounded-xl border p-4 transition-all ${extensionStatus.indeed?.hasIndeedTab ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {extensionStatus.indeed?.hasIndeedTab ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">{activeBoard.name}</span>
                </div>
                <p className="text-xs text-gray-600">
                  {extensionStatus.indeed?.hasIndeedTab ? "Indeed tab open" : "Open indeed.com first"}
                </p>
              </div>
              <div className={`rounded-xl border p-4 transition-all ${extensionStatus.indeed?.hasJobsTab ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {extensionStatus.indeed?.hasJobsTab ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">Jobs Tab</span>
                </div>
                <p className="text-xs text-gray-600">
                  {extensionStatus.indeed?.hasJobsTab ? "Indeed Jobs open" : "Open Indeed Jobs page"}
                </p>
              </div>
            </div>
            ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border p-4 transition-all ${extensionStatus.installed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {extensionStatus.installed ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><AlertCircle className="w-3.5 h-3.5 text-amber-600" /></div>
                  )}
                  <span className="text-sm font-semibold text-gray-900">AutoApply CV Copilot</span>
                </div>
                <p className="text-xs text-gray-600">
                  {extensionStatus.installed ? "Installed and connected" : "Not installed yet"}
                </p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center"><ExternalLink className="w-3.5 h-3.5 text-sky-600" /></div>
                  <span className="text-sm font-semibold text-gray-900">{activeBoard.name}</span>
                </div>
                <p className="text-xs text-gray-600">Open {activeBoard.name} to apply from this board</p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 transition-all">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center"><Play className="w-3.5 h-3.5 text-sky-600" /></div>
                  <span className="text-sm font-semibold text-gray-900">Auto-apply ready</span>
                </div>
                <p className="text-xs text-gray-600">Supported by the AutoApply CV Copilot extension</p>
              </div>
            </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setJobBoardsOpen((prev) => !prev)}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Job Boards
                </button>
                {jobBoardsOpen ? (
                  <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-20 py-2">
                    {JOB_BOARDS.map((board) => (
                      <a
                        key={board.name}
                        href={board.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setJobBoardsOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {board.name}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              {!linkedInInstalled ? (
                <a
                  ref={storeLinkButtonRef}
                  href={extensionStoreUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all inline-flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Install from Chrome Web Store
                </a>
              ) : null}
              <a
                ref={openLinkedInJobsButtonRef}
                href={activeBoard.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all inline-flex items-center gap-2 shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Open {activeBoard.name} Jobs
              </a>
              {activeBoard.provider === "indeed" ? (
              <a
                href={indeedExtensionZipUrl}
                download={indeedExtensionRelease.downloadFileName || undefined}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all inline-flex items-center gap-2 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download Indeed ZIP
              </a>
              ) : null}
              <button
                ref={syncProfileButtonRef}
                onClick={() => void syncProfileToExtension()}
                disabled={syncingSettings}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-60"
              >
                <Link2 className="w-4 h-4" />
                {syncingSettings ? "Syncing..." : "Sync Profile"}
              </button>
              <button
                type="button"
                onClick={() => void checkExtensionStatus()}
                disabled={checkingExtension}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${checkingExtension ? "animate-spin" : ""}`} />
                Refresh Status
              </button>
            </div>
          </div>

          {installMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {installMessage}
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

        {(extensionStatus.pendingQuestions || []).length > 0 ? (
          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-purple-600 px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Copilot Assistant</h3>
                  <p className="text-xs text-purple-100">A few more details are needed to continue</p>
                </div>
                <span className="ml-auto text-xs font-medium text-purple-100 bg-white/20 px-2.5 py-1 rounded-full">
                  {chatMessages.length > 0
                    ? `${answerablePendingQuestions.length} required`
                    : "Required fields"}
                </span>
              </div>

              <div className="h-80 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                {chatMessages.length === 0 ? (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-700 max-w-[85%]">
                      Gathering the required fields…
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex items-start gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role === "assistant" ? (
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-purple-600" />
                        </div>
                      ) : null}
                      <div
                        className={`px-3 py-2 text-sm max-w-[80%] break-words ${
                          msg.role === "assistant"
                            ? "bg-white border border-gray-200 rounded-2xl rounded-tl-sm text-gray-700"
                            : "bg-purple-600 rounded-2xl rounded-tr-sm text-white"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                {chatBusy ? (
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Saving your answer…
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-gray-200 px-4 py-3 bg-white">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void sendChatAnswer();
                    }}
                    placeholder="Type your answer here and press Enter…"
                    disabled={chatBusy || !chatAnswerTargetRef.current}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                  <button
                    onClick={() => void sendChatAnswer()}
                    disabled={chatBusy || !chatInput.trim()}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {chatBusy ? "Saving…" : "Send"}
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Type your answer (e.g. your LinkedIn URL) and press Enter — Copilot saves it and continues automatically.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {screeningSections.length > 0 ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shrink-0">
                  <ListChecks className="w-4 h-4 text-white" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Saved Screening Answers</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Synced from onboarding and extension — used in Easy Apply forms
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-purple-700 bg-white border border-purple-100 px-2.5 py-1 rounded-full shadow-sm">
                {screeningSections.reduce((count, section) => count + section.fields.length, 0)} fields
              </span>
            </div>

            <div className="space-y-3">
              {screeningSections.map((section) => {
                const cat = CATEGORY_ICON[section.category] || CATEGORY_ICON.screening;
                const CatIcon = cat.icon;
                return (
                  <div key={section.category} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/80 border-b border-gray-100">
                      <span className={`w-7 h-7 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                        <CatIcon className="w-3.5 h-3.5 text-white" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900">{section.title}</h4>
                        <p className="text-[11px] text-gray-500 truncate">{section.subtitle}</p>
                      </div>
                      <span className="ml-auto text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                        {section.fields.length} {section.fields.length === 1 ? "field" : "fields"}
                      </span>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {section.fields.map((field) => {
                        const draftValue = answerDrafts[field.questionKey] ?? field.answer;
                        const isPending = field.source === "pending";
                        const hasValue = Boolean(String(draftValue || "").trim());

                        return (
                          <div
                            key={field.questionKey}
                            className={`flex flex-wrap items-center gap-2 px-3 py-2 transition-colors ${isPending ? "bg-amber-50/60" : "bg-white"}`}
                          >
                            <div className="flex items-center gap-2 w-40 shrink-0 min-w-0">
                              {isPending ? (
                                <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                </span>
                              ) : hasValue ? (
                                <span className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                </span>
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                </span>
                              )}
                              <span className="text-xs font-medium text-gray-900 truncate" title={field.questionLabel}>
                                {field.questionLabel}
                              </span>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <AnswerValueEditor
                                answerType={field.answerType}
                                value={draftValue}
                                onChange={(value) =>
                                  setAnswerDrafts((prev) => ({
                                    ...prev,
                                    [field.questionKey]: value,
                                  }))
                                }
                                options={withCurrentSelectOption(field.options || (field.answerType === "boolean" ? YES_NO_OPTIONS : []), draftValue)}
                                presets={field.presets || []}
                                placeholder="Type answer and click Save"
                                variant={isPending ? "amber" : "default"}
                                compact
                              />
                            </div>
                            <button
                              onClick={() => void saveAnswerForQuestion(field.questionKey, field.questionLabel, field.answerType)}
                              disabled={savingAnswerKey === field.questionKey || !String(draftValue || "").trim()}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white text-xs font-semibold hover:opacity-90 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                            >
                              {savingAnswerKey === field.questionKey ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-3 h-3" />
                                  Save
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        </div>
      </motion.div>
    </div>
  );
}

function withCurrentSelectOption(options: string[], currentValue: string) {
  const normalizedCurrent = String(currentValue || "").trim();
  if (!normalizedCurrent) return options;
  if (options.some((option) => option.toLowerCase() === normalizedCurrent.toLowerCase())) return options;
  return [normalizedCurrent, ...options];
}

function AnswerValueEditor({
  answerType,
  value,
  onChange,
  options = [],
  presets = [],
  placeholder,
  variant = "default",
  compact = false,
}: {
  answerType: ScreeningAnswerType;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  presets?: string[];
  placeholder: string;
  variant?: "default" | "amber";
  compact?: boolean;
}) {
  if (answerType === "multiselect") {
    return (
      <AnswerTagInput
        values={parsePreferenceListInput(value)}
        onChange={(values) => onChange(stringifyPreferenceList(values))}
        placeholder={placeholder}
        presets={presets}
        variant={variant}
        compact={compact}
      />
    );
  }
  if (answerType === "boolean" || answerType === "choice") {
    return (
      <AnswerSelectInput
        value={value}
        onChange={onChange}
        options={options}
        variant={variant}
        compact={compact}
      />
    );
  }
  return (
    <AnswerTextInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      inputMode={answerType === "number" ? "numeric" : undefined}
      variant={variant}
      compact={compact}
    />
  );
}

function AnswerTextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  variant = "default",
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search" | "none";
  variant?: "default" | "amber";
  compact?: boolean;
}) {
  const borderClass = variant === "amber" ? "border-amber-300 focus:border-amber-400" : "border-gray-300 focus:border-purple-400";
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`w-full rounded-lg border bg-white outline-none ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"} ${borderClass}`}
    />
  );
}

function AnswerSelectInput({
  value,
  onChange,
  options,
  variant = "default",
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  variant?: "default" | "amber";
  compact?: boolean;
}) {
  const borderClass = variant === "amber" ? "border-amber-300 focus:border-amber-400" : "border-gray-300 focus:border-purple-400";
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border bg-white outline-none ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"} ${borderClass}`}
    >
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function AnswerTagInput({
  values,
  onChange,
  placeholder,
  presets = [],
  variant = "default",
  compact = false,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  presets?: string[];
  variant?: "default" | "amber";
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const borderClass = variant === "amber" ? "border-amber-300" : "border-gray-300";

  const addTag = (raw: string) => {
    const value = String(raw || "").trim();
    if (!value) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  };

  const removeTag = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  return (
    <div>
      <div className={`rounded-lg border bg-white p-2 ${borderClass}`}>
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
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
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                addTag(draft);
                setDraft("");
              }
              if (event.key === "Backspace" && !draft && values.length) {
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
            className={`flex-1 px-1 outline-none ${compact ? "min-w-[120px] py-0.5 text-xs" : "min-w-[180px] py-1 text-sm"}`}
          />
        </div>
      </div>

      {presets.length ? (
        <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-1" : "mt-2"}`}>
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => addTag(preset)}
              className={`rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 ${compact ? "px-2 py-0.5 text-[11px]" : "px-2 py-1 text-xs"}`}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
