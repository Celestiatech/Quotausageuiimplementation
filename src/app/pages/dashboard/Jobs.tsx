import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
  Play,
  XCircle,
  FileText,
  CheckCircle2,
  Download,
  ExternalLink,
  Link2,
  Copy,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ExtensionInstallGuide, type ExtensionInstallGuideStep } from "../../components/ExtensionInstallGuide";
import { collectExtensionBridgeSnapshot } from "src/lib/extension-bridge-client";
import {
  DASHBOARD_TOUR_EVENT_NAME,
  DASHBOARD_TOUR_JOBS_EXTENSION,
  consumeDashboardTourRequest,
} from "src/lib/dashboard-tour";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";

type JobLog = {
  id: string;
  step: string;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
};

type AutoApplyJob = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
  criteriaJson: Record<string, unknown>;
  logs?: JobLog[];
};

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

function statusBadge(status: JobStatus) {
  if (status === "succeeded") return "bg-green-100 text-green-700";
  if (status === "running") return "bg-blue-100 text-blue-700";
  if (status === "queued") return "bg-purple-100 text-purple-700";
  if (status === "cancelled") return "bg-gray-100 text-gray-700";
  return "bg-red-100 text-red-700";
}

const JOB_REASON_CODE_LABELS: Record<string, string> = {
  NO_APPLY_BUTTON: "No Easy Apply button",
  APPLIED_CACHE_HIT: "Already applied earlier",
  RECENTLY_RETRIED: "Skipped: recently retried",
  EASY_APPLY_MODAL_MISSING: "Easy Apply modal not found",
  MAX_SKIPS_REACHED: "Skipped: max skip limit reached",
};
const EXT_BRIDGE_PING_TIMEOUT_MS = 4500;
const EXT_BRIDGE_ACK_TIMEOUT_MS = 5000;
const EXTENSION_PACKAGE_PREFIX = "AutoApplyCVExtensionVersion";
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

function formatReasonCode(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (JOB_REASON_CODE_LABELS[upper]) return JOB_REASON_CODE_LABELS[upper];
  return raw
    .toLowerCase()
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getJobReason(job: AutoApplyJob | null) {
  if (!job) return "";
  const reasonCode = String(job.criteriaJson?.reasonCode || "").trim();
  if (reasonCode) return formatReasonCode(reasonCode);
  return String(job.criteriaJson?.reason || "").trim();
}

function displayJobStatus(job: AutoApplyJob | null) {
  if (!job) return "";
  if (job.status === "cancelled" && getJobReason(job)) return "skipped";
  return job.status;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

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
  if (normalized === "full name" || normalized === "full legal name" || normalized === "legal name") {
    return "full_name";
  }
  if (normalized === "first name" || normalized === "given name") return "first_name";
  if (normalized === "last name" || normalized === "family name" || normalized === "surname") {
    return "last_name";
  }
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
  if (normalized.includes("linkedin") && (normalized.includes("profile") || normalized.includes("url"))) {
    return "linkedin_url";
  }
  if (
    normalized.includes("portfolio") &&
    (normalized.includes("url") || normalized.includes("website") || normalized.includes("site") || normalized === "portfolio")
  ) {
    return "portfolio_url";
  }
  if (
    normalized === "current city" ||
    normalized === "city" ||
    normalized.includes("location city") ||
    normalized.includes("city state")
  ) {
    return "current_city";
  }
  if (normalized === "state" || normalized === "state region" || normalized === "region") {
    return "state_region";
  }
  if (normalized === "country") return "country";
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
  const extensionStoreUrl = String(process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || "").trim();
  const [extensionRelease, setExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "1.1.3",
    displayName: "AutoApply CV LinkedIn Copilot",
    downloadFileName: formatExtensionPackageFileName("1.1.3"),
    downloadBaseName: formatExtensionPackageName("1.1.3"),
  });
  const [indeedExtensionRelease, setIndeedExtensionRelease] = useState<ExtensionReleaseMeta>({
    version: "0.1.0",
    displayName: "AutoApply CV Indeed Copilot Beta",
    downloadFileName: "AutoApplyCVIndeedExtensionVersion0.1.0.zip",
    downloadBaseName: "AutoApplyCVIndeedExtensionVersion0.1.0",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<AutoApplyJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installMessage, setInstallMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
  const downloadOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const downloadZipButtonRef = useRef<HTMLAnchorElement | null>(null);
  const syncProfileButtonRef = useRef<HTMLButtonElement | null>(null);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
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
  const linkedInProviderStatus = extensionStatus.providers?.linkedin;
  const indeedProviderStatus = extensionStatus.providers?.indeed;
  const linkedInInstalled = Boolean(
    linkedInProviderStatus?.installed ||
      (extensionStatus.installed && !indeedProviderStatus),
  );
  const indeedInstalled = Boolean(indeedProviderStatus?.installed);
  const linkedInInstalledVersion =
    linkedInProviderStatus?.version || extensionStatus.version || extensionRelease.version;
  const indeedInstalledVersion =
    indeedProviderStatus?.version || indeedExtensionRelease.version;
  const installedPackageName = linkedInInstalled
    ? formatExtensionPackageName(linkedInInstalledVersion || "")
    : "";
  const [criteria, setCriteria] = useState({
    keywords: "",
    location: "",
    company: "",
    easyApplyOnly: true,
  });

  const resolveKnownAnswer = (
    questionKey: string,
    questionLabel: string,
    extensionAnswers: Record<string, string> = {},
  ) => {
    const normalizedLabel = normalizeLabel(questionLabel);
    return (
      String(answerDrafts[questionKey] || "").trim() ||
      String(siteScreeningAnswers[questionKey] || "").trim() ||
      String(siteScreeningAnswers[normalizedLabel] || "").trim() ||
      String(extensionAnswers[questionKey] || "").trim() ||
      String(extensionAnswers[normalizedLabel] || "").trim() ||
      ""
    );
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
        targetRef: versionBadgeRef,
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

    const res = await fetch("/api/user/screening/answers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let message = "Failed to save answer on site";
      try {
        const data = await res.json();
        if (data?.message) message = String(data.message);
      } catch {
        // Keep default error.
      }
      throw new Error(message);
    }

    setSiteScreeningAnswers((prev) => ({
      ...prev,
      [payload.questionKey]: payload.answer,
      [normalizeLabel(payload.questionLabel)]: payload.answer,
    }));
    setSiteQuestionLabels((prev) => ({
      ...prev,
      [payload.questionKey]: payload.questionLabel,
    }));
    setSiteAnswerTypes((prev) => ({
      ...prev,
      [payload.questionKey]: payload.answerType,
    }));
    syncedAnswerRef.current[payload.questionKey] = payload.answer;
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
    const extensionAnswers = status.screeningAnswers || {};
    const entries = Object.entries(extensionAnswers);
    if (!entries.length) return;

    const pendingLabelMap = new Map<string, string>();
    for (const pending of status.pendingQuestions || []) {
      const key = toQuestionKey(pending.questionKey || pending.questionLabel || "");
      if (!key) continue;
      pendingLabelMap.set(key, String(pending.questionLabel || "").trim() || labelFromQuestionKey(key));
    }

    for (const [rawKey, rawValue] of entries) {
      const answer = String(rawValue || "").trim();
      if (!answer) continue;
      const canonicalKey = toQuestionKey(rawKey);
      if (!canonicalKey) continue;
      if (syncedAnswerRef.current[canonicalKey] === answer) continue;
      const questionLabel =
        pendingLabelMap.get(canonicalKey) ||
        siteQuestionLabels[canonicalKey] ||
        labelFromQuestionKey(canonicalKey);
      const catalogField = lookupCatalogField(canonicalKey, rawKey, questionLabel);
      const answerType = catalogField?.answerType || siteAnswerTypes[canonicalKey] || inferAnswerType(answer);
      try {
        await saveAnswerToSite(canonicalKey, questionLabel, answer, answerType, "extension_capture");
      } catch {
        // Keep running if one answer fails to sync.
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
        const presetDrafts: Record<string, string> = {};
        for (const q of result.pendingQuestions) {
          const normalizedKey = toQuestionKey(q.questionKey || q.questionLabel || "");
          if (!normalizedKey) continue;
          const preset = resolveKnownAnswer(normalizedKey, q.questionLabel, result.screeningAnswers || {});
          if (preset) presetDrafts[normalizedKey] = preset;

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
          "cp_pref_search_locations",
          "cp_pref_search_location",
          "preferred_locations",
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

      const screeningAnswersForSync: Record<string, string> = {};
      for (const [rawKey, rawValue] of Object.entries(mergedAnswers)) {
        const answer = String(rawValue || "").trim();
        if (!answer) continue;
        const canonicalKey = toQuestionKey(rawKey);
        if (!canonicalKey) continue;
        screeningAnswersForSync[canonicalKey] = answer;
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
        (!remoteModeSelected ? preferredCountries[0] || currentCity : "");
      const filterLocations = sanitizeLocationFilterValues(
        remoteModeSelected ? preferredLocations : [...preferredLocations, ...preferredCountries],
      );

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
        marketingConsent: "No",
        requireVisa: preferredRequireVisa || "No",
        usCitizenship: preferredUsCitizenship || "",
        yearsOfExperienceAnswer: preferredYearsOfExperience || "",
        confidenceLevel: preferredConfidenceLevel || "",
        easyApplyOnly: true,
        debugMode: false,
        dryRun: false,
        autoSubmit: true,
        autoResumeOnAnswer: true,
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
  ) => {
    const canonicalKey = toQuestionKey(questionKey || questionLabel);
    const label = String(questionLabel || "").trim() || labelFromQuestionKey(canonicalKey);
    const answer = compactAnswer(answerDrafts[canonicalKey] || answerDrafts[questionKey] || "");
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

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/auto-apply/jobs", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch jobs");
      const nextJobs = (data?.data?.jobs || []) as AutoApplyJob[];
      setJobs(nextJobs);
      if (!selectedJobId && nextJobs.length > 0) {
        setSelectedJobId(nextJobs[0].id);
      } else if (selectedJobId && !nextJobs.find((j) => j.id === selectedJobId)) {
        setSelectedJobId(nextJobs[0]?.id || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

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
    void loadJobs();
    void loadSiteScreeningAnswers();
    void checkExtensionStatus();
    const jobsIntervalId = setInterval(() => {
      void loadJobs();
    }, 10000);
    const siteAnswersIntervalId = setInterval(() => {
      void loadSiteScreeningAnswers();
    }, 12000);
    const extensionIntervalId = setInterval(() => {
      void checkExtensionStatus();
    }, 4000);
    return () => {
      clearInterval(jobsIntervalId);
      clearInterval(siteAnswersIntervalId);
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

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => {
      const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "").toLowerCase();
      const company = String(job.criteriaJson?.company || "").toLowerCase();
      const location = String(job.criteriaJson?.location || job.criteriaJson?.currentCity || "").toLowerCase();
      return (
        job.id.toLowerCase().includes(q) ||
        title.includes(q) ||
        company.includes(q) ||
        location.includes(q) ||
        job.status.toLowerCase().includes(q)
      );
    });
  }, [jobs, searchQuery]);

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

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || null;

  const submitAutoApply = async () => {
    try {
      setSubmitting(true);
      setError("");
      const consentRes = await fetch("/api/user/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentType: "auto_apply_terms",
          version: "v1",
        }),
      });
      const consentData = await consentRes.json();
      if (!consentRes.ok || !consentData?.success) {
        throw new Error(consentData?.message || "Consent recording failed");
      }

      const body = {
        criteria: {
          keywords: criteria.keywords.trim(),
          title: criteria.keywords.trim(),
          location: criteria.location.trim(),
          currentCity: criteria.location.trim(),
          company: criteria.company.trim(),
          easyApplyOnly: criteria.easyApplyOnly,
        },
      };
      const res = await fetch("/api/auto-apply/jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to queue auto-apply job");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to queue auto-apply job");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelSelected = async () => {
    if (!selectedJob) return;
    try {
      setCancelling(true);
      setError("");
      const res = await fetch(`/api/auto-apply/jobs/${selectedJob.id}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled from dashboard" }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to cancel job");
      await loadJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel job");
    } finally {
      setCancelling(false);
    }
  };

  const onInstallOrReloadExtension = async () => {
    if (typeof window === "undefined") return;
    setError("");
    setInstallMessage("");
    const downloadFileName = currentPackageFileName;
    try {
      const res = await fetch(`${linkedInExtensionZipUrl}&ts=${Date.now()}`, {
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
      anchor.href = `${linkedInExtensionZipUrl}&ts=${Date.now()}`;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
    setInstallMessage(
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
      const res = await fetch(`${linkedInExtensionZipUrl}&ts=${Date.now()}`, {
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
      anchor.href = `${linkedInExtensionZipUrl}&ts=${Date.now()}`;
      anchor.download = downloadFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
    setInstallMessage(`ZIP downloaded: ${downloadFileName}. Unzip it before the next step.`);
  };

  const openLinkedInJobsTab = () => {
    if (typeof window === "undefined") return;
    const opened = window.open("https://www.linkedin.com/jobs/", "_blank", "noopener,noreferrer");
    if (opened) {
      opened.opener = null;
    }
  };

  const copyLoadUnpackedSteps = async () => {
    if (typeof window === "undefined" || !window.navigator?.clipboard) {
      setError("Clipboard is not available in this browser.");
      return;
    }
    const downloadFileName = currentPackageFileName;
    try {
      await window.navigator.clipboard.writeText(
        [
          "AutoApply CV Extension Setup (Load Unpacked)",
          `1) Download ${downloadFileName}.`,
          `2) Extract it. The folder should look like ${currentPackageBaseName} and contain manifest.json.`,
          "3) In Chrome click three dots > Extensions > Manage Extensions. Turn ON Developer mode on the top-right, then click Load unpacked on the top-left.",
          `4) Select the extracted folder, make sure LinkedIn is signed in, then return here and click Check Extension.`,
        ].join("\n"),
      );
      setInstallMessage("Install steps copied. Share them with users directly.");
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Failed to copy install steps");
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
      setInstallMessage("Guided install completed. If the version still looks old, reload the unpacked extension once in chrome://extensions.");
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Auto-Apply Jobs</h1>
          <p className="text-gray-600">Showing {jobs.length} real jobs from your backend queue</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span ref={versionBadgeRef} className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
              LinkedIn ZIP: {currentPackageFileName || "loading..."}
            </span>
            <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
              Indeed ZIP: {indeedExtensionRelease.downloadFileName || "loading..."}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
              LinkedIn installed: {linkedInInstalled ? formatExtensionPackageName(linkedInInstalledVersion || "") : "not detected"}
            </span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
              Indeed installed: {indeedInstalled ? indeedInstalledVersion || "detected" : "not detected"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void loadJobs()}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => void submitAutoApply()}
            disabled={submitting}
            className="px-6 py-3 gradient-primary text-white rounded-xl font-semibold shadow-premium hover:shadow-premium-lg transition-all disabled:opacity-60"
          >
            {submitting ? "Queuing..." : "Create Auto-Apply Job"}
          </button>
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
        className="bg-white rounded-2xl p-6 border-2 border-gray-200"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Extension Workspace</h2>
            <p className="text-sm text-gray-600">
              LinkedIn and Indeed now run as separate Chrome extensions, both syncing back to the same AutoApply CV account.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openInstallGuide}
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold shadow-sm transition-colors hover:bg-sky-700 inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              LinkedIn Install Guide
            </button>
            <button
              ref={checkExtensionButtonRef}
              onClick={() => void checkExtensionStatus()}
              disabled={checkingExtension}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold disabled:opacity-60"
            >
              {checkingExtension ? "Checking..." : "Check Extensions"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                  LinkedIn
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-950">LinkedIn Jobs Extension</h3>
                <p className="mt-1 text-sm text-slate-700">
                  Mature Easy Apply flow with install guide, screening sync, and resume handling.
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Package on site: <span className="font-semibold">{currentPackageBaseName}</span>
                </p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-right text-xs text-slate-600">
                <div className="font-semibold text-slate-900">Detected version</div>
                <div>{linkedInInstalled ? linkedInInstalledVersion : "Not detected"}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className={`rounded-xl border p-4 ${linkedInInstalled ? "border-green-200 bg-green-50" : "border-amber-200 bg-white"}`}>
                <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {linkedInInstalled ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  Extension Installed
                </div>
                <p className="text-sm text-gray-700">
                  {linkedInInstalled ? "LinkedIn extension detected on the dashboard." : "Install or reload the LinkedIn extension package."}
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${extensionStatus.linkedIn?.hasLinkedInTab ? "border-green-200 bg-green-50" : "border-amber-200 bg-white"}`}>
                <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {extensionStatus.linkedIn?.hasLinkedInTab ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  LinkedIn Open
                </div>
                <p className="text-sm text-gray-700">
                  {extensionStatus.linkedIn?.hasLinkedInTab ? "LinkedIn tab found." : "Open linkedin.com and sign in first."}
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${extensionStatus.linkedIn?.hasJobsTab ? "border-green-200 bg-green-50" : "border-amber-200 bg-white"}`}>
                <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {extensionStatus.linkedIn?.hasJobsTab ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  Jobs Page Ready
                </div>
                <p className="text-sm text-gray-700">
                  {extensionStatus.linkedIn?.hasJobsTab ? "LinkedIn Jobs tab found." : "Open LinkedIn Jobs before starting a run."}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                ref={openLinkedInJobsButtonRef}
                href="https://www.linkedin.com/jobs/"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-100 font-semibold inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open LinkedIn Jobs
              </a>
              <button
                ref={downloadOpenButtonRef}
                type="button"
                onClick={onInstallOrReloadExtension}
                className="px-4 py-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-100 font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download + Open Extensions
              </button>
              <a
                ref={downloadZipButtonRef}
                href={linkedInExtensionZipUrl}
                download={currentPackageFileName || undefined}
                className="px-4 py-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-100 font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download LinkedIn ZIP
              </a>
              {extensionStoreUrl ? (
                <a
                  href={extensionStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-100 font-semibold inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Chrome Web Store
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void copyLoadUnpackedSteps()}
                className="px-4 py-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-100 font-semibold inline-flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy LinkedIn Setup Steps
              </button>
              <button
                ref={syncProfileButtonRef}
                onClick={() => void syncProfileToExtension()}
                disabled={syncingSettings}
                className="px-4 py-2 rounded-lg border border-sky-200 bg-white hover:bg-sky-100 font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                <Link2 className="w-4 h-4" />
                {syncingSettings ? "Syncing..." : "Sync Profile to Extensions"}
              </button>
            </div>

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Download <code>{currentPackageFileName}</code> and extract it.</li>
              <li>Open <code>chrome://extensions</code>, enable Developer mode, then click <code>Load unpacked</code>.</li>
              <li>Select the extracted LinkedIn folder, open LinkedIn Jobs, then click <code>Check Extensions</code>.</li>
            </ol>

            <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
              <div className="text-sm font-semibold text-blue-900">Resume Requirement Handling</div>
              <div className="text-sm text-blue-800 mt-1">
                If a job says resume is required, upload your resume in LinkedIn Easy Apply profile first.
                The copilot automatically picks the latest attached resume option.
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-orange-200 bg-orange-50/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  Indeed Beta
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-950">Indeed Jobs Extension Beta</h3>
                <p className="mt-1 text-sm text-slate-700">
                  Separate Indeed-specific automation beta with its own filters, job-page selectors, and dashboard sync.
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Package on site: <span className="font-semibold">{indeedExtensionRelease.downloadBaseName}</span>
                </p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-right text-xs text-slate-600">
                <div className="font-semibold text-slate-900">Detected version</div>
                <div>{indeedInstalled ? indeedInstalledVersion : "Not detected"}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className={`rounded-xl border p-4 ${indeedInstalled ? "border-green-200 bg-green-50" : "border-amber-200 bg-white"}`}>
                <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {indeedInstalled ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  Extension Installed
                </div>
                <p className="text-sm text-gray-700">
                  {indeedInstalled ? `Detected version ${indeedInstalledVersion}.` : "Load the Indeed ZIP as a separate unpacked extension."}
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${extensionStatus.indeed?.hasIndeedTab ? "border-green-200 bg-green-50" : "border-amber-200 bg-white"}`}>
                <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {extensionStatus.indeed?.hasIndeedTab ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  Indeed Open
                </div>
                <p className="text-sm text-gray-700">
                  {extensionStatus.indeed?.hasIndeedTab ? "Indeed tab found." : "Open indeed.com and keep the jobs tab available."}
                </p>
              </div>
              <div className={`rounded-xl border p-4 ${extensionStatus.indeed?.hasJobsTab ? "border-green-200 bg-green-50" : "border-amber-200 bg-white"}`}>
                <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  {extensionStatus.indeed?.hasJobsTab ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
                  Jobs Page Ready
                </div>
                <p className="text-sm text-gray-700">
                  {extensionStatus.indeed?.hasJobsTab ? "Indeed Jobs tab found." : "Open Indeed Jobs before starting an Indeed run."}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://www.indeed.com/jobs"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg border border-orange-300 bg-white hover:bg-orange-100 font-semibold inline-flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Indeed Jobs
              </a>
              <a
                href={indeedExtensionZipUrl}
                download={indeedExtensionRelease.downloadFileName || undefined}
                className="px-4 py-2 rounded-lg border border-orange-300 bg-white hover:bg-orange-100 font-semibold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Indeed ZIP
              </a>
              <button
                type="button"
                onClick={() => void checkExtensionStatus()}
                disabled={checkingExtension}
                className="px-4 py-2 rounded-lg border border-orange-300 bg-white hover:bg-orange-100 font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                {checkingExtension ? "Checking..." : "Refresh Indeed Status"}
              </button>
            </div>

            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              <li>Download <code>{indeedExtensionRelease.downloadFileName}</code> and extract it as a second extension folder.</li>
              <li>Use <code>Load unpacked</code> again and select the extracted Indeed folder.</li>
              <li>Open <code>indeed.com/jobs</code>, then click <code>Check Extensions</code> to confirm detection.</li>
            </ol>

            <div className="mt-4 rounded-xl border border-orange-200 bg-white p-4">
              <div className="text-sm font-semibold text-orange-900">Indeed Filter Coverage</div>
              <div className="text-sm text-orange-800 mt-1">
                Search term, location, date posted, sort order, job type, company, title, salary, work mode, benefits,
                commitments, and keyword filters now apply inside the Indeed extension before it submits.
              </div>
            </div>
          </section>
        </div>

        {installMessage ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {installMessage}
          </div>
        ) : null}

        <ol className="mt-4 text-sm text-gray-700 list-decimal pl-5 space-y-1">
          <li>Download <code>{currentPackageFileName}</code>.</li>
          <li>Extract it. The folder should look like <code>{currentPackageBaseName}</code> and contain <code>manifest.json</code>.</li>
          <li>In Chrome click three dots, then <code>Extensions</code>, then <code>Manage Extensions</code>. Turn on Developer mode on the top-right and click <code>Load unpacked</code>.</li>
          <li>Select the extracted folder. When the extension appears, click the extension icon, make sure LinkedIn is signed in, then return here and click Check Extension.</li>
        </ol>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-semibold text-blue-900">Resume Requirement Handling</div>
          <div className="text-sm text-blue-800 mt-1">
            If a job says resume is required, upload your resume in LinkedIn Easy Apply profile first.
            The copilot automatically picks the latest attached resume option in the modal.
          </div>
        </div>

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
          <div className="mt-6 border-t border-gray-200 pt-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Action Needed: Answer Required Fields</h3>
            {(extensionStatus.pendingQuestions || []).map((q) => {
              const pendingKey = toQuestionKey(q.questionKey || q.questionLabel);
              const pendingCatalog = lookupCatalogField(q.questionKey || q.questionLabel, q.questionLabel);
              const pendingDraftValue = answerDrafts[pendingKey] || "";
              const pendingAnswerType = pendingCatalog?.answerType || siteAnswerTypes[pendingKey] || inferAnswerType(pendingDraftValue);
              const hasValidationMessage = Boolean(q.validationMessage);
              return (
                <div
                  key={q.questionKey}
                  className={`rounded-xl border p-4 ${
                    hasValidationMessage ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900">{q.questionLabel}</div>
                  {q.validationMessage ? (
                    <div className="mt-1 text-xs font-medium text-red-700">{q.validationMessage}</div>
                  ) : null}
                  {(q.questionKey === "resume_upload_required" || /resume/i.test(String(q.validationMessage || ""))) ? (
                    <div className="text-xs text-blue-700 mt-2">
                      Upload resume in LinkedIn Easy Apply profile. Copilot will auto-select the newest attached resume.
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <div className="flex-1">
                      <AnswerValueEditor
                        answerType={pendingAnswerType}
                        value={pendingDraftValue}
                        onChange={(value) =>
                          setAnswerDrafts((prev) => ({
                            ...prev,
                            [pendingKey]: value,
                          }))
                        }
                        options={withCurrentSelectOption(pendingCatalog?.options || (pendingAnswerType === "boolean" ? YES_NO_OPTIONS : []), pendingDraftValue)}
                        presets={pendingCatalog?.presets || []}
                        placeholder="Enter answer to reuse in next applications"
                        variant="amber"
                      />
                    </div>
                    <button
                      onClick={() => void saveAnswerForQuestion(q.questionKey, q.questionLabel, pendingAnswerType)}
                      disabled={savingAnswerKey === pendingKey}
                      className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      {savingAnswerKey === pendingKey ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {screeningSections.length > 0 ? (
          <div className="mt-6 border-t border-gray-200 pt-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">Saved Screening Answers</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Deduped to match your onboarding fields and synced extension answers.
                </p>
              </div>
              <div className="text-xs font-medium text-gray-500">
                {screeningSections.reduce((count, section) => count + section.fields.length, 0)} unique field(s)
              </div>
            </div>

            {screeningSections.map((section) => (
              <div key={section.category} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{section.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">{section.subtitle}</p>
                  </div>
                  <div className="text-xs font-medium text-gray-500">{section.fields.length} field(s)</div>
                </div>

                <div className="grid xl:grid-cols-2 gap-3">
                  {section.fields.map((field) => {
                    const draftValue = answerDrafts[field.questionKey] ?? field.answer;
                    const isPending = field.source === "pending";
                    const sourceBadge =
                      field.source === "site"
                        ? "Saved on site"
                        : field.source === "extension"
                          ? "From extension"
                          : field.source === "pending"
                            ? "Needs answer"
                            : "Merged";

                    return (
                      <div
                        key={field.questionKey}
                        className={`rounded-xl border p-4 ${
                          isPending ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{field.questionLabel}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5">{sourceBadge}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <div className="flex-1">
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
                            />
                          </div>
                          <button
                            onClick={() => void saveAnswerForQuestion(field.questionKey, field.questionLabel, field.answerType)}
                            disabled={savingAnswerKey === field.questionKey || !String(draftValue || "").trim()}
                            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-60"
                          >
                            {savingAnswerKey === field.questionKey ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-6 border-2 border-gray-200 space-y-4"
      >
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queued jobs by id, title, company, status..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Criteria
          </button>
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid md:grid-cols-2 gap-4">
            <input
              value={criteria.keywords}
              onChange={(e) => setCriteria((p) => ({ ...p, keywords: e.target.value }))}
              placeholder="Keywords / title"
              className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-400 outline-none"
            />
            <input
              value={criteria.company}
              onChange={(e) => setCriteria((p) => ({ ...p, company: e.target.value }))}
              placeholder="Company"
              className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-400 outline-none"
            />
            <input
              value={criteria.location}
              onChange={(e) => setCriteria((p) => ({ ...p, location: e.target.value }))}
              placeholder="Location / city"
              className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-purple-400 outline-none"
            />
            <label className="flex items-center gap-2 px-3">
              <input
                type="checkbox"
                checked={criteria.easyApplyOnly}
                onChange={(e) => setCriteria((p) => ({ ...p, easyApplyOnly: e.target.checked }))}
              />
              <span className="text-sm font-medium text-gray-700">Easy Apply only</span>
            </label>
          </motion.div>
        )}
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4 max-h-[800px] overflow-y-auto">
          {loading ? <div className="text-sm text-gray-500">Loading jobs...</div> : null}
          {!loading && filteredJobs.length === 0 ? <div className="text-sm text-gray-500">No jobs found.</div> : null}
          {filteredJobs.map((job, index) => {
            const company = String(job.criteriaJson?.company || "LinkedIn");
            const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "Auto-Apply Job");
            const location = String(job.criteriaJson?.location || job.criteriaJson?.currentCity || "N/A");
            const reason = getJobReason(job);
            const displayStatus = displayJobStatus(job);
            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => setSelectedJobId(job.id)}
                className={`bg-white rounded-2xl p-6 border-2 cursor-pointer transition-all duration-300 ${
                  selectedJobId === job.id ? "border-purple-400 shadow-xl" : "border-gray-200 hover:border-purple-300 hover:shadow-lg"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-purple-700">
                      {company.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{title}</h3>
                      <p className="text-sm text-gray-600">{company}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge(job.status)}`}>{displayStatus}</div>
                </div>
                {reason ? (
                  <div className="mb-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                    Reason: {reason}
                  </div>
                ) : null}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {location}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    {formatDate(job.createdAt)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Briefcase className="w-4 h-4" />
                    Attempts {job.attempts}/{job.maxAttempts}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 bg-white rounded-2xl p-8 border-2 border-gray-200 max-h-[800px] overflow-y-auto sticky top-0"
        >
          {!selectedJob ? (
            <div className="text-sm text-gray-500">Select a job to view details.</div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{String(selectedJob.criteriaJson?.title || selectedJob.criteriaJson?.keywords || "Auto-Apply Job")}</h2>
                  <p className="text-sm text-gray-600 mt-2">Job ID: {selectedJob.id}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge(selectedJob.status)}`}>{displayJobStatus(selectedJob)}</div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-xs uppercase text-purple-700 font-semibold mb-1">Created</div>
                  <div className="text-sm text-gray-900">{formatDate(selectedJob.createdAt)}</div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs uppercase text-blue-700 font-semibold mb-1">Attempts</div>
                  <div className="text-sm text-gray-900">
                    {selectedJob.attempts} / {selectedJob.maxAttempts}
                  </div>
                </div>
              </div>

              {getJobReason(selectedJob) ? (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
                  Skipped reason: {getJobReason(selectedJob)}
                </div>
              ) : null}

              {selectedJob.errorMessage ? (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{selectedJob.errorMessage}</div>
              ) : null}

              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Criteria
                </h3>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto">
{JSON.stringify(selectedJob.criteriaJson || {}, null, 2)}
                </pre>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-3">Recent Logs</h3>
                <div className="space-y-2">
                  {(selectedJob.logs || []).length === 0 ? (
                    <div className="text-sm text-gray-500">No logs available.</div>
                  ) : (
                    (selectedJob.logs || []).map((log) => (
                      <div key={log.id} className="border border-gray-200 rounded-lg px-3 py-2">
                        <div className="text-xs text-gray-500">{formatDate(log.createdAt)} | {log.step} | {log.level}</div>
                        <div className="text-sm text-gray-800">{log.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => void submitAutoApply()}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 gradient-primary text-white rounded-xl font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {submitting ? "Queuing..." : "Queue New Job"}
                </button>
                <button
                  onClick={() => void cancelSelected()}
                  disabled={
                    cancelling ||
                    selectedJob.status === "running" ||
                    selectedJob.status === "succeeded" ||
                    selectedJob.status === "failed" ||
                    selectedJob.status === "dead_letter" ||
                    selectedJob.status === "cancelled"
                  }
                  className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {cancelling ? "Cancelling..." : "Cancel Job"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
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
}: {
  answerType: ScreeningAnswerType;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  presets?: string[];
  placeholder: string;
  variant?: "default" | "amber";
}) {
  if (answerType === "multiselect") {
    return (
      <AnswerTagInput
        values={parsePreferenceListInput(value)}
        onChange={(values) => onChange(stringifyPreferenceList(values))}
        placeholder={placeholder}
        presets={presets}
        variant={variant}
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
    />
  );
}

function AnswerTextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  variant = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel" | "url" | "search" | "none";
  variant?: "default" | "amber";
}) {
  const borderClass = variant === "amber" ? "border-amber-300 focus:border-amber-400" : "border-gray-300 focus:border-purple-400";
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ${borderClass}`}
    />
  );
}

function AnswerSelectInput({
  value,
  onChange,
  options,
  variant = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  variant?: "default" | "amber";
}) {
  const borderClass = variant === "amber" ? "border-amber-300 focus:border-amber-400" : "border-gray-300 focus:border-purple-400";
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none ${borderClass}`}
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
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  presets?: string[];
  variant?: "default" | "amber";
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
              className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
