import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";

type ScreeningAnswerApiItem = {
  questionKey: string;
  questionLabel: string;
  answer: string;
};

type ScreeningFieldRow = {
  id: string;
  questionKey: string;
  questionLabel: string;
  answer: string;
};

type ExtensionStatus = {
  installed: boolean;
  runtimeId?: string;
  bridge?: {
    version?: string;
    pageUrl?: string;
    origin?: string;
    ts?: string;
  };
  linkedIn?: {
    hasLinkedInTab: boolean;
    hasJobsTab: boolean;
  };
};

type ExtensionDebugState = {
  lastCheckAt: string;
  lastRequestId: string;
  postedOrigin: string;
  domBridgeReady: string;
  domBridgeVersion: string;
  domBridgeRuntimeId: string;
  timedOut: boolean;
  bridgeReadySeenAt: string;
  bridgeRuntimeId: string;
  pongReceived: boolean;
  lastError: string;
  lastResponseJson: string;
  events: string[];
};

type ProfileQuestionKey =
  | "name"
  | "phoneCountryCode"
  | "phone"
  | "currentCity"
  | "addressLine"
  | "linkedinUrl"
  | "portfolioUrl";

type ProfileQuestion = {
  key: ProfileQuestionKey;
  label: string;
  description: string;
  type: "input" | "select";
  inputType?: "text" | "tel" | "url";
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
};

type ExtensionPreferenceKey =
  | "searchTerms"
  | "searchLocation"
  | "yearsOfExperienceAnswer"
  | "requireVisa"
  | "usCitizenship"
  | "desiredSalary"
  | "noticePeriodDays"
  | "recentEmployer"
  | "confidenceLevel"
  | "coverLetter";

type ExtensionPreferences = Record<ExtensionPreferenceKey, string>;

type PreferenceField = {
  key: ExtensionPreferenceKey;
  questionKey: string;
  questionLabel: string;
};

const WIZARD_STEPS = [
  "Resume",
  "Profile Q&A",
  "Extension",
  "Auto-fill Fields",
  "Review",
] as const;

const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    key: "name",
    label: "What is your full name?",
    description: "This is used across your profile and applications.",
    type: "input",
    inputType: "text",
    placeholder: "e.g., Vishal Sadyal",
  },
  {
    key: "phoneCountryCode",
    label: "Select your phone country code",
    description: "Used to format your number for forms.",
    type: "select",
    options: [
      { label: "+91 (India)", value: "+91" },
      { label: "+1 (US/Canada)", value: "+1" },
      { label: "+44 (UK)", value: "+44" },
      { label: "+61 (Australia)", value: "+61" },
      { label: "+971 (UAE)", value: "+971" },
    ],
  },
  {
    key: "phone",
    label: "What is your phone number?",
    description: "Enter number only, without country code.",
    type: "input",
    inputType: "tel",
    placeholder: "e.g., 9876543210",
  },
  {
    key: "currentCity",
    label: "Which city are you currently in?",
    description: "This is used as your default job search location.",
    type: "input",
    inputType: "text",
    placeholder: "e.g., Austin, TX",
  },
  {
    key: "addressLine",
    label: "What is your address?",
    description: "Required by some Easy Apply forms.",
    type: "input",
    inputType: "text",
    placeholder: "Street, area, city",
  },
  {
    key: "linkedinUrl",
    label: "What is your LinkedIn profile URL?",
    description: "Must be a valid URL.",
    type: "input",
    inputType: "url",
    placeholder: "https://www.linkedin.com/in/your-profile",
  },
  {
    key: "portfolioUrl",
    label: "What is your portfolio URL?",
    description: "GitHub, portfolio site, or personal website.",
    type: "input",
    inputType: "url",
    placeholder: "https://github.com/yourname",
  },
];

const DEFAULT_SEARCH_TERMS = "Software Engineer, Full Stack Developer";

const PREFERENCE_FIELDS: PreferenceField[] = [
  {
    key: "searchTerms",
    questionKey: "cp_pref_search_terms",
    questionLabel: "CareerPilot Preference: Search terms",
  },
  {
    key: "searchLocation",
    questionKey: "cp_pref_search_location",
    questionLabel: "CareerPilot Preference: Search location",
  },
  {
    key: "yearsOfExperienceAnswer",
    questionKey: "cp_pref_years_of_experience",
    questionLabel: "CareerPilot Preference: Years of experience",
  },
  {
    key: "requireVisa",
    questionKey: "cp_pref_require_visa",
    questionLabel: "CareerPilot Preference: Need visa sponsorship",
  },
  {
    key: "usCitizenship",
    questionKey: "cp_pref_us_citizenship",
    questionLabel: "CareerPilot Preference: US work authorization",
  },
  {
    key: "desiredSalary",
    questionKey: "cp_pref_desired_salary",
    questionLabel: "CareerPilot Preference: Desired salary",
  },
  {
    key: "noticePeriodDays",
    questionKey: "cp_pref_notice_period_days",
    questionLabel: "CareerPilot Preference: Notice period (days)",
  },
  {
    key: "recentEmployer",
    questionKey: "cp_pref_recent_employer",
    questionLabel: "CareerPilot Preference: Recent employer",
  },
  {
    key: "confidenceLevel",
    questionKey: "cp_pref_confidence_level",
    questionLabel: "CareerPilot Preference: Confidence level",
  },
  {
    key: "coverLetter",
    questionKey: "cp_pref_cover_letter",
    questionLabel: "CareerPilot Preference: Default long-form answer",
  },
];

function normalizeLabel(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function toQuestionKey(value: string) {
  const normalized = normalizeLabel(value);
  if (!normalized) return "";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 160);
}

function makeRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function splitPhone(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return { countryCode: "+91", number: "" };
  const plusMatch = raw.match(/^\+\d{1,3}/);
  if (!plusMatch) {
    return {
      countryCode: "+91",
      number: raw.replace(/[^\d]/g, ""),
    };
  }
  const countryCode = plusMatch[0];
  const number = raw.slice(countryCode.length).replace(/[^\d]/g, "");
  return { countryCode, number };
}

function composePhone(number: string, countryCode: string) {
  const raw = String(number || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const normalizedCode = String(countryCode || "+91").trim();
  const safeCode = normalizedCode.startsWith("+") ? normalizedCode : `+${normalizedCode}`;
  const digits = raw.replace(/[^\d]/g, "");
  return `${safeCode}${digits}`;
}

function parseListInput(value: string) {
  return String(value || "")
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitName(value: string) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = parts[0] || "";
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  const lastName = parts.length > 1 ? parts.slice(middleName ? -1 : 1).join(" ") : "";
  return { firstName, middleName, lastName };
}

function compactAnswer(value: string, limit = 1000) {
  return String(value || "").trim().slice(0, limit);
}

function isPreferenceQuestionKey(questionKey: string) {
  return PREFERENCE_FIELDS.some((field) => field.questionKey === questionKey);
}

function buildDefaultScreeningRows(form: {
  name: string;
  phone: string;
  currentCity: string;
  linkedinUrl: string;
  portfolioUrl: string;
}, email?: string): ScreeningFieldRow[] {
  const fullName = String(form.name || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ");

  const templates = [
    { questionLabel: "Full legal name", answer: fullName },
    { questionLabel: "First name", answer: firstName },
    { questionLabel: "Last name", answer: lastName },
    { questionLabel: "Email address", answer: String(email || "").trim() },
    { questionLabel: "Phone", answer: String(form.phone || "").trim() },
    { questionLabel: "Mobile phone number", answer: String(form.phone || "").trim() },
    { questionLabel: "Your location (City, State)", answer: String(form.currentCity || "").trim() },
    { questionLabel: "LinkedIn profile", answer: String(form.linkedinUrl || "").trim() },
    { questionLabel: "Portfolio URL", answer: String(form.portfolioUrl || "").trim() },
  ];

  return templates
    .map((item) => {
      const questionLabel = String(item.questionLabel || "").trim();
      const answer = String(item.answer || "").trim();
      const questionKey = toQuestionKey(questionLabel);
      if (!questionLabel || !answer || !questionKey) return null;
      return { id: makeRowId(), questionKey, questionLabel, answer };
    })
    .filter((item): item is ScreeningFieldRow => Boolean(item));
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const parsedUserPhone = splitPhone(user?.phone || "");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({ installed: false });
  const [extensionDebug, setExtensionDebug] = useState<ExtensionDebugState>({
    lastCheckAt: "",
    lastRequestId: "",
    postedOrigin: "",
    domBridgeReady: "",
    domBridgeVersion: "",
    domBridgeRuntimeId: "",
    timedOut: false,
    bridgeReadySeenAt: "",
    bridgeRuntimeId: "",
    pongReceived: false,
    lastError: "",
    lastResponseJson: "",
    events: [],
  });
  const [screeningRows, setScreeningRows] = useState<ScreeningFieldRow[]>([]);
  const [loadingScreening, setLoadingScreening] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [profileQuestionIndex, setProfileQuestionIndex] = useState(0);
  const [phoneCountryCode, setPhoneCountryCode] = useState(parsedUserPhone.countryCode || "+91");
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: parsedUserPhone.number || "",
    currentCity: user?.currentCity || "",
    addressLine: user?.addressLine || "",
    linkedinUrl: user?.linkedinUrl || "",
    portfolioUrl: user?.portfolioUrl || "",
  });
  const [preferences, setPreferences] = useState<ExtensionPreferences>({
    searchTerms: DEFAULT_SEARCH_TERMS,
    searchLocation: user?.currentCity || "United States",
    yearsOfExperienceAnswer: "",
    requireVisa: "No",
    usCitizenship: "U.S. Citizen/Permanent Resident",
    desiredSalary: "",
    noticePeriodDays: "",
    recentEmployer: "",
    confidenceLevel: "8",
    coverLetter: "",
  });
  const latestExtensionCheckRef = useRef(0);
  const activeExtensionChecksRef = useRef(0);

  const extensionZipUrl = "/downloads/CareerPilotLinkedInExtension.zip";
  const extensionStoreUrl = String(process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || "").trim();
  const canDownloadExtensionZip = process.env.NODE_ENV !== "production";
  const showExtensionDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  const appendDebugEvent = (value: string) => {
    const entry = `${new Date().toISOString()} ${value}`;
    setExtensionDebug((prev) => ({
      ...prev,
      events: [entry, ...prev.events].slice(0, 25),
    }));
  };

  const getQuestionValue = (key: ProfileQuestionKey) => {
    if (key === "phoneCountryCode") return phoneCountryCode;
    return form[key] || "";
  };

  const setQuestionValue = (key: ProfileQuestionKey, value: string) => {
    if (key === "phoneCountryCode") {
      setPhoneCountryCode(value);
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateProfileQuestion = (key: ProfileQuestionKey) => {
    const value = String(getQuestionValue(key) || "").trim();
    if (key === "name") return value.length >= 2 ? "" : "Enter at least 2 characters for full name.";
    if (key === "phoneCountryCode") return value.startsWith("+") ? "" : "Select a country code.";
    if (key === "phone") return value.replace(/[^\d]/g, "").length >= 6 ? "" : "Enter a valid phone number.";
    if (key === "currentCity") return value.length >= 2 ? "" : "Enter your current city.";
    if (key === "addressLine") return value.length >= 5 ? "" : "Enter a complete address line.";
    if (key === "linkedinUrl") return isValidUrl(value) ? "" : "Enter a valid LinkedIn URL.";
    if (key === "portfolioUrl") return isValidUrl(value) ? "" : "Enter a valid portfolio URL.";
    return "";
  };

  const firstInvalidProfileIndex = PROFILE_QUESTIONS.findIndex((question) => Boolean(validateProfileQuestion(question.key)));
  const profileComplete = firstInvalidProfileIndex === -1;

  const validatePreferences = () => {
    const searchTerms = parseListInput(preferences.searchTerms);
    if (!searchTerms.length) return "Add at least one search term.";

    const searchLocation = String(preferences.searchLocation || "").trim();
    if (searchLocation.length < 2) return "Enter a valid search location.";

    const years = String(preferences.yearsOfExperienceAnswer || "").trim();
    if (years && !/^\d{1,2}$/.test(years)) return "Years of experience must be a whole number.";

    const noticeDays = String(preferences.noticePeriodDays || "").trim();
    if (noticeDays && !/^\d{1,3}$/.test(noticeDays)) return "Notice period must be in days (numbers only).";

    const confidence = String(preferences.confidenceLevel || "").trim();
    if (confidence && !/^(10|[1-9])$/.test(confidence)) return "Confidence level must be between 1 and 10.";

    if (!String(preferences.requireVisa || "").trim()) return "Select visa requirement preference.";
    if (!String(preferences.usCitizenship || "").trim()) return "Select work authorization preference.";
    return "";
  };

  const preferenceError = validatePreferences();
  const preferencesComplete = !preferenceError;

  const checkExtensionStatus = async (opts?: { silent?: boolean }) => {
    if (typeof window === "undefined") return;
    const silent = Boolean(opts?.silent);
    const checkSeq = ++latestExtensionCheckRef.current;
    activeExtensionChecksRef.current += 1;
    const requestId = `cp_onboarding_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const domBridgeReady = document.documentElement.getAttribute("data-cp-bridge-ready") || "";
    const domBridgeVersion = document.documentElement.getAttribute("data-cp-bridge-version") || "";
    const domBridgeRuntimeId = document.documentElement.getAttribute("data-cp-bridge-runtime-id") || "";
    setCheckingExtension(true);
    setExtensionDebug((prev) => ({
      ...prev,
      lastCheckAt: new Date().toISOString(),
      lastRequestId: requestId,
      postedOrigin: window.location.origin,
      domBridgeReady,
      domBridgeVersion,
      domBridgeRuntimeId,
      timedOut: false,
      pongReceived: false,
      lastError: "",
      lastResponseJson: "",
    }));
    if (!silent) {
      appendDebugEvent(
        `Posting CP_WEB_PING requestId=${requestId} domBridgeReady=${domBridgeReady || "0"} domBridgeVersion=${
          domBridgeVersion || "-"
        }`
      );
    }

    try {
      const result = await new Promise<ExtensionStatus>((resolve) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener("message", onMessage);
          if (checkSeq === latestExtensionCheckRef.current) {
            if (!silent) appendDebugEvent(`Timeout waiting for CP_WEB_PONG requestId=${requestId}`);
            setExtensionDebug((prev) => ({
              ...prev,
              timedOut: true,
              lastError: "Timed out waiting for extension response",
            }));
          }
          resolve({ installed: false });
        }, 1600);

        const onMessage = (event: MessageEvent) => {
          const data = event.data as any;
          if (data?.type === "CP_WEB_PONG" && data.requestId !== requestId && !silent) {
            appendDebugEvent(`Ignored CP_WEB_PONG for requestId=${String(data.requestId || "")}`);
          }
          if (!data || data.type !== "CP_WEB_PONG" || data.requestId !== requestId) return;
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (checkSeq === latestExtensionCheckRef.current) {
            const responseJson = JSON.stringify(data, null, 2);
            setExtensionDebug((prev) => ({
              ...prev,
              pongReceived: true,
              timedOut: false,
              bridgeRuntimeId: String(data.runtimeId || prev.bridgeRuntimeId || ""),
              lastError: String(data.error || "").trim(),
              lastResponseJson: responseJson.slice(0, 6000),
            }));
          }
          const bridgeError = String(data.error || "").trim();
          const runtimeBootstrapOk =
            Boolean(data.state) &&
            typeof data.state === "object" &&
            !Array.isArray(data.state);
          const installed = Boolean(data.installed) && !bridgeError && runtimeBootstrapOk;
          if (!silent) {
            appendDebugEvent(
              `Received CP_WEB_PONG installed=${installed} runtimeOk=${runtimeBootstrapOk} runtimeId=${String(data.runtimeId || "")}${
                bridgeError ? ` error=${bridgeError}` : ""
              }`
            );
          }
          resolve({
            installed,
            runtimeId: data.runtimeId || undefined,
            bridge: data.bridge || undefined,
            linkedIn: data.linkedIn || undefined,
          });
        };

        window.addEventListener("message", onMessage);
        window.postMessage({ type: "CP_WEB_PING", requestId }, window.location.origin);
      });

      if (checkSeq !== latestExtensionCheckRef.current) return;
      setExtensionStatus(result);
      if (!result.installed && !silent) {
        if (!domBridgeReady) {
          appendDebugEvent(
            "Result installed=false and DOM bridge marker missing. Content script is not injected on this page."
          );
        } else {
          appendDebugEvent(
            "Result installed=false but DOM marker exists. Bridge is injected, response path failed."
          );
        }
      }
  } catch (checkError) {
      if (checkSeq !== latestExtensionCheckRef.current) return;
      const msg = String(checkError instanceof Error ? checkError.message : checkError || "Unknown extension check error");
      setExtensionDebug((prev) => ({
        ...prev,
        lastError: msg,
      }));
      if (!silent) appendDebugEvent(`Check failed: ${msg}`);
    } finally {
      activeExtensionChecksRef.current = Math.max(0, activeExtensionChecksRef.current - 1);
      setCheckingExtension(activeExtensionChecksRef.current > 0);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadScreeningAnswers = async () => {
      setLoadingScreening(true);
      try {
        const res = await fetch("/api/user/screening/answers", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;

        const apiAnswers = Array.isArray(data?.data?.answers)
          ? (data.data.answers as ScreeningAnswerApiItem[])
          : [];
        const byKey = new Map<string, ScreeningFieldRow>();
        const prefByKey = new Map<string, string>();

        for (const item of apiAnswers) {
          const questionLabel = String(item?.questionLabel || "").trim();
          const sourceKey = String(item?.questionKey || "").trim();
          const questionKey = toQuestionKey(sourceKey || questionLabel);
          const answer = String(item?.answer || "").trim();
          if (!questionKey || !questionLabel || !answer) continue;
          if (isPreferenceQuestionKey(questionKey)) {
            prefByKey.set(questionKey, answer);
            continue;
          }
          if (byKey.has(questionKey)) continue;
          byKey.set(questionKey, {
            id: makeRowId(),
            questionKey,
            questionLabel,
            answer,
          });
        }

        if (prefByKey.size) {
          setPreferences((prev) => {
            const next = { ...prev };
            for (const field of PREFERENCE_FIELDS) {
              const saved = prefByKey.get(field.questionKey);
              if (saved) next[field.key] = saved;
            }
            return next;
          });
        }

        const fullPhone = composePhone(form.phone, phoneCountryCode);
        for (const defaultRow of buildDefaultScreeningRows({ ...form, phone: fullPhone }, user?.email)) {
          if (!byKey.has(defaultRow.questionKey)) byKey.set(defaultRow.questionKey, defaultRow);
        }

        setScreeningRows(Array.from(byKey.values()));
      } catch {
        if (!cancelled) {
          const fullPhone = composePhone(form.phone, phoneCountryCode);
          setScreeningRows(buildDefaultScreeningRows({ ...form, phone: fullPhone }, user?.email));
        }
      } finally {
        if (!cancelled) setLoadingScreening(false);
      }
    };

    loadScreeningAnswers();
    return () => {
      cancelled = true;
    };
    // Keep one-time initial load based on current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void checkExtensionStatus({ silent: true });
    const id = window.setInterval(() => {
      void checkExtensionStatus({ silent: true });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBridgeReady = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as any;
      if (!data || data.type !== "CP_WEB_BRIDGE_READY") return;
      const runtimeId = String(data.runtimeId || "");
      setExtensionDebug((prev) => ({
        ...prev,
        bridgeReadySeenAt: new Date().toISOString(),
        bridgeRuntimeId: runtimeId || prev.bridgeRuntimeId,
      }));
      appendDebugEvent(`Bridge ready detected runtimeId=${runtimeId}`);
    };
    window.addEventListener("message", onBridgeReady);
    return () => window.removeEventListener("message", onBridgeReady);
  }, []);

  const buildPreferenceRows = () =>
    PREFERENCE_FIELDS.map((field) => ({
      id: makeRowId(),
      questionKey: field.questionKey,
      questionLabel: field.questionLabel,
      answer: compactAnswer(preferences[field.key]),
    })).filter((row) => Boolean(row.answer));

  const buildScreeningPayloads = () => {
    const seen = new Set<string>();
    const fullPhone = composePhone(form.phone, phoneCountryCode);
    const defaultRows = buildDefaultScreeningRows({ ...form, phone: fullPhone }, user?.email);
    const rows = [...defaultRows, ...screeningRows, ...buildPreferenceRows()];
    return rows
      .map((row) => {
        const questionLabel = String(row.questionLabel || "").trim();
        const answer = compactAnswer(row.answer);
        const questionKey = toQuestionKey(row.questionKey || questionLabel);
        if (!questionLabel || !answer || !questionKey) return null;
        if (seen.has(questionKey)) return null;
        seen.add(questionKey);
        return { questionKey, questionLabel, answer };
      })
      .filter((item): item is { questionKey: string; questionLabel: string; answer: string } => Boolean(item));
  };

  const buildExtensionSettingsPayload = (screeningAnswers: Record<string, string>) => {
    const fullName = String(form.name || "").trim();
    const nameParts = splitName(fullName);
    return {
      currentCity: String(form.currentCity || "").trim(),
      searchLocation: String(preferences.searchLocation || form.currentCity || "").trim(),
      searchTerms: parseListInput(preferences.searchTerms),
      contactEmail: String(user?.email || "").trim(),
      phoneNumber: String(form.phone || "").replace(/[^\d]/g, ""),
      phoneCountryCode: String(phoneCountryCode || "").trim(),
      marketingConsent: "No",
      requireVisa: String(preferences.requireVisa || "No").trim(),
      usCitizenship: String(preferences.usCitizenship || "").trim(),
      yearsOfExperienceAnswer: String(preferences.yearsOfExperienceAnswer || "").trim(),
      desiredSalary: String(preferences.desiredSalary || "").trim(),
      currentCtc: "",
      noticePeriodDays: String(preferences.noticePeriodDays || "").trim(),
      recentEmployer: String(preferences.recentEmployer || "").trim(),
      confidenceLevel: String(preferences.confidenceLevel || "").trim(),
      linkedinUrl: String(form.linkedinUrl || "").trim(),
      websiteUrl: String(form.portfolioUrl || "").trim(),
      firstName: nameParts.firstName,
      middleName: nameParts.middleName,
      lastName: nameParts.lastName,
      fullName,
      streetAddress: String(form.addressLine || "").trim(),
      stateRegion: "",
      postalCode: "",
      country: "",
      gender: "No preference",
      ethnicity: "No preference",
      veteranStatus: "No",
      disabilityStatus: "No",
      coverLetter: compactAnswer(preferences.coverLetter, 1500),
      easyApplyOnly: true,
      debugMode: false,
      dryRun: false,
      autoSubmit: true,
      liveModeAcknowledged: true,
      autoResumeOnAnswer: true,
      maxApplicationsPerRun: 3,
      maxSkipsPerRun: 50,
      switchNumber: 30,
      blacklistedCompanies: [],
      badWords: [],
      screeningAnswers,
    };
  };

  const syncExtensionSettings = async (settings: Record<string, unknown>) => {
    if (typeof window === "undefined") return { ok: false, skipped: true as const, error: "No browser window" };
    if (!extensionStatus.installed) {
      return { ok: false, skipped: true as const, error: "Extension not detected. Install and check extension first." };
    }
    return new Promise<{ ok: boolean; skipped?: false; error?: string }>((resolve) => {
      const requestId = `onboarding-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        window.removeEventListener("message", onMessage);
        resolve({ ok: false, error: "Extension did not acknowledge settings sync. Reload extension and retry." });
      }, 2600);

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

  const saveScreeningAnswers = async () => {
    const payloads = buildScreeningPayloads();

    for (const payload of payloads) {
      const res = await fetch("/api/user/screening/answers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || `Failed to save field: ${payload.questionLabel}`);
      }
    }

    const screeningAnswers: Record<string, string> = {};
    for (const payload of payloads) screeningAnswers[payload.questionKey] = payload.answer;
    const settingsPayload = buildExtensionSettingsPayload(screeningAnswers);
    const sync = await syncExtensionSettings(settingsPayload);
    if (!sync.ok && !sync.skipped) {
      throw new Error(sync.error || "Failed to sync extension settings");
    }
    if (!sync.ok && sync.skipped) {
      return "Onboarding saved. Install/check extension to sync auto-fill settings.";
    }
    return "";
  };

  const onInstallExtension = () => {
    if (typeof window === "undefined") return;
    if (extensionStoreUrl) {
      window.open(extensionStoreUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!canDownloadExtensionZip) {
      setError("Extension install link is managed by admin. Please contact support.");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = extensionZipUrl;
    anchor.download = "CareerPilotLinkedInExtension.zip";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.open("chrome://extensions/", "_blank");
  };

  const copyExtensionDebug = async () => {
    if (typeof window === "undefined" || !window.navigator?.clipboard) {
      setError("Clipboard is not available in this browser.");
      return;
    }
    try {
      const payload = { pageUrl: window.location.href, extensionStatus, extensionDebug };
      await window.navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setMessage("Extension debug copied to clipboard.");
      appendDebugEvent("Copied extension debug payload to clipboard.");
    } catch (copyError) {
      const msg = String(copyError instanceof Error ? copyError.message : copyError || "Failed to copy debug");
      setError(msg);
      appendDebugEvent(`Failed to copy debug: ${msg}`);
    }
  };

  const onSave = async () => {
    setError("");
    setMessage("");

    if (!profileComplete) {
      setCurrentStep(1);
      setProfileQuestionIndex(firstInvalidProfileIndex >= 0 ? firstInvalidProfileIndex : 0);
      setError("Please answer all profile questions correctly before saving.");
      return;
    }

    if (!preferencesComplete) {
      setCurrentStep(3);
      setError(preferenceError || "Please complete required auto-fill preferences.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...form,
        phone: composePhone(form.phone, phoneCountryCode),
      };

      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to save onboarding");

      const syncNote = await saveScreeningAnswers();
      await refreshUser();
      setMessage(syncNote || "Onboarding and extension fields saved");
      navigate("/dashboard");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save onboarding");
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    setError("");
    setMessage("");
    if (currentStep === 1 && profileQuestionIndex > 0) {
      setProfileQuestionIndex((prev) => prev - 1);
      return;
    }
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const goNext = () => {
    setError("");
    setMessage("");

    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }

    if (currentStep === 1) {
      const active = PROFILE_QUESTIONS[profileQuestionIndex];
      const issue = validateProfileQuestion(active.key);
      if (issue) {
        setError(issue);
        return;
      }
      if (profileQuestionIndex < PROFILE_QUESTIONS.length - 1) {
        setProfileQuestionIndex((prev) => prev + 1);
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (!preferencesComplete) {
        setError(preferenceError || "Please complete required auto-fill preferences.");
        return;
      }
      setCurrentStep(4);
    }
  };

  const canGoBack = currentStep > 0 || profileQuestionIndex > 0;

  const activeProfileQuestion = PROFILE_QUESTIONS[profileQuestionIndex];
  const activeProfileError = validateProfileQuestion(activeProfileQuestion.key);

  const profileProgress = Math.round(((profileQuestionIndex + 1) / PROFILE_QUESTIONS.length) * 100);
  const stepProgress = Math.round(((currentStep + 1) / WIZARD_STEPS.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Complete Your Onboarding</h1>
        <p className="text-gray-600 mt-1">Step-by-step setup with one question at a time.</p>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Step {currentStep + 1} of {WIZARD_STEPS.length}</span>
          <span>{WIZARD_STEPS[currentStep]}</span>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600" style={{ width: `${stepProgress}%` }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          {WIZARD_STEPS.map((label, idx) => (
            <div
              key={label}
              className={`rounded-lg border px-2 py-1 text-center ${
                idx === currentStep
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : idx < currentStep
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500"
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {message && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</div>}

      {currentStep === 0 ? (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Resume Setup</h2>
          <p className="text-sm text-gray-700">
            Please upload your CV directly in LinkedIn Easy Apply profile. CareerPilot copilot will automatically use
            the latest resume attached on LinkedIn while applying.
          </p>
          <a
            href="https://www.linkedin.com/jobs/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50"
          >
            Open LinkedIn Jobs
          </a>
          <p className="text-xs text-gray-500">
            After uploading resume on LinkedIn, continue to next step.
          </p>
        </div>
      ) : null}

      {currentStep === 1 ? (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Question {profileQuestionIndex + 1} of {PROFILE_QUESTIONS.length}</span>
            <span>{profileProgress}%</span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600" style={{ width: `${profileProgress}%` }} />
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">{activeProfileQuestion.label}</h3>
            <p className="text-sm text-gray-600">{activeProfileQuestion.description}</p>

            {activeProfileQuestion.type === "select" ? (
              <select
                value={String(getQuestionValue(activeProfileQuestion.key))}
                onChange={(e) => setQuestionValue(activeProfileQuestion.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              >
                {(activeProfileQuestion.options || []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={activeProfileQuestion.inputType || "text"}
                value={String(getQuestionValue(activeProfileQuestion.key))}
                onChange={(e) => setQuestionValue(activeProfileQuestion.key, e.target.value)}
                placeholder={activeProfileQuestion.placeholder || ""}
                className="w-full px-3 py-2 rounded-lg border border-gray-300"
              />
            )}

            {activeProfileError ? <p className="text-xs text-red-600">{activeProfileError}</p> : null}
          </div>
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Install CareerPilot Chrome Extension</h2>
          <p className="text-sm text-gray-600">Download, load, and check detection.</p>

          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              extensionStatus.installed
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {extensionStatus.installed
              ? "Extension detected on dashboard."
              : "Extension not detected. Install/reload it, then click Check Extension."}
          </div>
          <p className="text-xs text-gray-500">
            If you just installed or removed the extension, refresh this page once before checking again.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkExtensionStatus()}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50"
            >
              {checkingExtension ? "Checking..." : "Check Extension"}
            </button>
            {showExtensionDebug ? (
              <button
                type="button"
                onClick={() => void copyExtensionDebug()}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50"
              >
                Copy Debug
              </button>
            ) : null}
            <button
              type="button"
              onClick={onInstallExtension}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              Add Extension to Chrome
            </button>
            {canDownloadExtensionZip ? (
              <a
                href={extensionZipUrl}
                download
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50"
              >
                Download ZIP Only
              </a>
            ) : null}
          </div>

          <ol className="text-sm text-gray-700 list-decimal pl-5 space-y-1">
            {canDownloadExtensionZip ? (
              <li>Download and unzip `CareerPilotLinkedInExtension.zip`.</li>
            ) : (
              <li>Open the Chrome Web Store listing and install CareerPilot extension.</li>
            )}
            <li>Open `chrome://extensions/` and ensure the extension is enabled.</li>
            {canDownloadExtensionZip ? (
              <li>Click Load unpacked and select the unzipped extension folder.</li>
            ) : null}
            <li>Refresh this onboarding page and click Check Extension.</li>
          </ol>

          {showExtensionDebug ? (
            <details className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800">Detection Debug Details</summary>
              <div className="mt-2 text-xs text-gray-700 space-y-1">
                <div>Last check: {extensionDebug.lastCheckAt || "N/A"}</div>
                <div>Last request id: {extensionDebug.lastRequestId || "N/A"}</div>
                <div>Posted origin: {extensionDebug.postedOrigin || "N/A"}</div>
                <div>DOM bridge marker: {extensionDebug.domBridgeReady || "No"}</div>
                <div>DOM bridge version: {extensionDebug.domBridgeVersion || "N/A"}</div>
                <div>DOM bridge runtime id: {extensionDebug.domBridgeRuntimeId || "N/A"}</div>
                <div>Bridge ready seen: {extensionDebug.bridgeReadySeenAt || "No"}</div>
                <div>Bridge runtime id: {extensionDebug.bridgeRuntimeId || "N/A"}</div>
                <div>PONG received: {extensionDebug.pongReceived ? "Yes" : "No"}</div>
                <div>Timed out: {extensionDebug.timedOut ? "Yes" : "No"}</div>
                <div>Last error: {extensionDebug.lastError || "None"}</div>
              </div>
              {extensionDebug.lastResponseJson ? (
                <pre className="mt-2 max-h-52 overflow-auto rounded bg-white border border-gray-200 p-2 text-[11px] text-gray-700 whitespace-pre-wrap">
                  {extensionDebug.lastResponseJson}
                </pre>
              ) : null}
              {extensionDebug.events.length ? (
                <div className="mt-2 max-h-48 overflow-auto rounded bg-white border border-gray-200 p-2 text-[11px] text-gray-700 space-y-1">
                  {extensionDebug.events.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Extension Auto-fill Setup</h2>
            <p className="text-sm text-gray-600">
              We only ask essential fields here. Remaining extension settings are auto-configured.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-700">Search terms</label>
              <textarea
                value={preferences.searchTerms}
                onChange={(e) => setPreferences((prev) => ({ ...prev, searchTerms: e.target.value }))}
                rows={2}
                placeholder="Software Engineer, Full Stack Developer"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Search location</label>
              <input
                value={preferences.searchLocation}
                onChange={(e) => setPreferences((prev) => ({ ...prev, searchLocation: e.target.value }))}
                placeholder="United States"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Years of experience</label>
              <input
                value={preferences.yearsOfExperienceAnswer}
                onChange={(e) => setPreferences((prev) => ({ ...prev, yearsOfExperienceAnswer: e.target.value }))}
                placeholder="5"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Need visa sponsorship?</label>
              <select
                value={preferences.requireVisa}
                onChange={(e) => setPreferences((prev) => ({ ...prev, requireVisa: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Work authorization status</label>
              <select
                value={preferences.usCitizenship}
                onChange={(e) => setPreferences((prev) => ({ ...prev, usCitizenship: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              >
                <option value="U.S. Citizen/Permanent Resident">U.S. Citizen/Permanent Resident</option>
                <option value="Authorized to work in the U.S.">Authorized to work in the U.S.</option>
                <option value="Require sponsorship">Require sponsorship</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Desired salary (annual)</label>
              <input
                value={preferences.desiredSalary}
                onChange={(e) => setPreferences((prev) => ({ ...prev, desiredSalary: e.target.value }))}
                placeholder="120000"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Notice period (days)</label>
              <input
                value={preferences.noticePeriodDays}
                onChange={(e) => setPreferences((prev) => ({ ...prev, noticePeriodDays: e.target.value }))}
                placeholder="15"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Recent employer</label>
              <input
                value={preferences.recentEmployer}
                onChange={(e) => setPreferences((prev) => ({ ...prev, recentEmployer: e.target.value }))}
                placeholder="Acme Corp"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Confidence level (1-10)</label>
              <input
                value={preferences.confidenceLevel}
                onChange={(e) => setPreferences((prev) => ({ ...prev, confidenceLevel: e.target.value }))}
                placeholder="8"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-gray-700">Default long-form answer (for custom required textareas)</label>
              <textarea
                value={preferences.coverLetter}
                onChange={(e) => setPreferences((prev) => ({ ...prev, coverLetter: e.target.value }))}
                rows={4}
                placeholder="Write a reusable answer for questions like: What exceptional work have you done?"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>
          </div>

          {preferenceError ? <div className="text-xs text-red-600">{preferenceError}</div> : null}

          <div className="border-t border-gray-200 pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Custom required fields</h3>
                <p className="text-xs text-gray-600">
                  If a job asks a custom question, add exact question text and answer here. This prevents submit loops.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setScreeningRows((prev) => [
                    ...prev,
                    { id: makeRowId(), questionKey: "", questionLabel: "", answer: "" },
                  ])
                }
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                + Add Field
              </button>
            </div>

            {loadingScreening ? <p className="text-xs text-gray-500">Loading saved fields...</p> : null}
            {!loadingScreening && screeningRows.length === 0 ? (
              <p className="text-xs text-gray-500">No custom fields yet.</p>
            ) : null}

            {screeningRows.map((row) => (
              <div key={row.id} className="grid md:grid-cols-3 gap-2">
                <input
                  value={row.questionLabel}
                  onChange={(e) =>
                    setScreeningRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? {
                              ...item,
                              questionLabel: e.target.value,
                              questionKey: toQuestionKey(e.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                  placeholder="Question label"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
                <input
                  value={row.answer}
                  onChange={(e) =>
                    setScreeningRows((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, answer: e.target.value } : item)),
                    )
                  }
                  placeholder="Answer"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setScreeningRows((prev) => prev.filter((item) => item.id !== row.id))}
                  className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Review & Save</h2>
          <p className="text-sm text-gray-600">Confirm details before finishing onboarding.</p>

          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold text-gray-900">Resume</div>
              <div className="text-gray-700 mt-1">
                Managed on LinkedIn Easy Apply profile (latest attached resume will be used).
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="font-semibold text-gray-900">Extension</div>
              <div className="text-gray-700 mt-1">{extensionStatus.installed ? "Detected" : "Not detected"}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:col-span-2">
              <div className="font-semibold text-gray-900">Profile</div>
              <div className="text-gray-700 mt-1">{form.name || "-"}</div>
              <div className="text-gray-700">{composePhone(form.phone, phoneCountryCode) || "-"}</div>
              <div className="text-gray-700">{form.currentCity || "-"}</div>
              <div className="text-gray-700">{form.linkedinUrl || "-"}</div>
              <div className="text-gray-700">{form.portfolioUrl || "-"}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 md:col-span-2">
              <div className="font-semibold text-gray-900">Auto-fill Preferences</div>
              <div className="text-gray-700 mt-1">Search terms: {parseListInput(preferences.searchTerms).join(", ") || "-"}</div>
              <div className="text-gray-700">Search location: {preferences.searchLocation || "-"}</div>
              <div className="text-gray-700">Visa requirement: {preferences.requireVisa || "-"}</div>
              <div className="text-gray-700">Authorization: {preferences.usCitizenship || "-"}</div>
              <div className="text-gray-700">Custom fields: {screeningRows.length}</div>
            </div>
          </div>

          {!profileComplete || !preferencesComplete ? (
            <div className="text-xs text-red-600">
              Some profile or preference answers are invalid. Go back and fix them before saving.
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving || !profileComplete || !preferencesComplete}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack || isSaving}
          className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          Back
        </button>
        {currentStep < WIZARD_STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {currentStep === 1
              ? profileQuestionIndex < PROFILE_QUESTIONS.length - 1
                ? "Next Question"
                : "Continue"
              : "Next"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
