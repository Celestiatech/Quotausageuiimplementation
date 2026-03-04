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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

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

type ExtensionStatus = {
  installed: boolean;
  runtimeId?: string;
  linkedIn?: {
    hasLinkedInTab: boolean;
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
  updatedAt?: string;
};

function statusBadge(status: JobStatus) {
  if (status === "succeeded") return "bg-green-100 text-green-700";
  if (status === "running") return "bg-blue-100 text-blue-700";
  if (status === "queued") return "bg-purple-100 text-purple-700";
  if (status === "cancelled") return "bg-gray-100 text-gray-700";
  return "bg-red-100 text-red-700";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

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

function labelFromQuestionKey(questionKey: string) {
  const key = String(questionKey || "").trim();
  if (!key) return "Screening field";
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

function parseSearchTermsInput(value: string) {
  return String(value || "")
    .split(/[,\n;|]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 25);
}

export default function Jobs() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<AutoApplyJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>({
    installed: false,
  });
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [siteScreeningAnswers, setSiteScreeningAnswers] = useState<Record<string, string>>({});
  const [siteQuestionLabels, setSiteQuestionLabels] = useState<Record<string, string>>({});
  const [savingAnswerKey, setSavingAnswerKey] = useState<string | null>(null);
  const [syncingSettings, setSyncingSettings] = useState(false);
  const syncedAnswerRef = useRef<Record<string, string>>({});
  const reportedIssueRef = useRef<Record<string, string>>({});
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

  const saveAnswerToSite = async (questionKey: string, questionLabel: string, answer: string) => {
    const payload = {
      questionKey: String(questionKey || "").trim(),
      questionLabel: String(questionLabel || "").trim() || labelFromQuestionKey(questionKey),
      answer: String(answer || "").trim(),
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
      for (const item of answers) {
        const questionKey = String(item?.questionKey || "").trim();
        const questionLabel = String(item?.questionLabel || "").trim();
        const answer = String(item?.answer || "").trim();
        if (!questionKey || !answer) continue;
        answerMap[questionKey] = answer;
        if (questionLabel) {
          answerMap[normalizeLabel(questionLabel)] = answer;
          labelMap[questionKey] = questionLabel;
        }
        syncedAnswerRef.current[questionKey] = answer;
      }
      setSiteScreeningAnswers(answerMap);
      setSiteQuestionLabels(labelMap);
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
      try {
        await saveAnswerToSite(canonicalKey, questionLabel, answer);
      } catch {
        // Keep running if one answer fails to sync.
      }
    }
  };

  const checkExtensionStatus = async () => {
    if (typeof window === "undefined") return;
    setCheckingExtension(true);
    try {
      const result = await new Promise<ExtensionStatus>((resolve) => {
        const requestId = `cp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener("message", onMessage);
          resolve({ installed: false });
        }, 1600);

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
            linkedIn: data.linkedIn || undefined,
            state: data.state || null,
            pendingQuestions: Array.isArray(data.pendingQuestions) ? data.pendingQuestions : [],
            screeningAnswers: data.screeningAnswers || {},
            error: bridgeError || null,
          });
        };

        window.addEventListener("message", onMessage);
        window.postMessage({ type: "CP_WEB_PING", requestId }, window.location.origin);
      });
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

      // These preferences are stored as screening answers on the site, but the extension expects them as settings.
      const preferredSearchLocation = pickFirstNonEmpty(siteScreeningAnswers, [
        "cp_pref_search_location",
        "careerpilot_preference_search_location",
      ]);
      const preferredSearchTermsRaw = pickFirstNonEmpty(siteScreeningAnswers, [
        "cp_pref_search_terms",
        "careerpilot_preference_search_terms",
      ]);
      const preferredSearchTerms = parseSearchTermsInput(preferredSearchTermsRaw);
      const preferredYearsOfExperience = pickFirstNonEmpty(siteScreeningAnswers, [
        "cp_pref_years_of_experience",
        "careerpilot_preference_years_of_experience",
      ]);
      const preferredRequireVisa = pickFirstNonEmpty(siteScreeningAnswers, [
        "cp_pref_require_visa",
        "careerpilot_preference_need_visa_sponsorship",
        "careerpilot_preference_require_visa",
      ]);
      const preferredUsCitizenship = pickFirstNonEmpty(siteScreeningAnswers, [
        "cp_pref_us_citizenship",
        "careerpilot_preference_us_work_authorization",
      ]);

      const screeningAnswersForSync: Record<string, string> = {};
      for (const [rawKey, rawValue] of Object.entries(siteScreeningAnswers)) {
        const answer = String(rawValue || "").trim();
        if (!answer) continue;
        const canonicalKey = toQuestionKey(rawKey);
        if (!canonicalKey) continue;
        screeningAnswersForSync[canonicalKey] = answer;
      }
      const settingsPayload = {
        currentCity: user?.currentCity || "",
        searchLocation: preferredSearchLocation || user?.currentCity || "",
        searchTerms: preferredSearchTerms,
        contactEmail: user?.email || "",
        phoneNumber: derivePhoneNumber(user?.phone),
        phoneCountryCode: derivePhoneCountryCode(user?.phone),
        marketingConsent: "No",
        requireVisa: preferredRequireVisa || "No",
        usCitizenship: preferredUsCitizenship || "",
        yearsOfExperienceAnswer: preferredYearsOfExperience || "",
        easyApplyOnly: true,
        debugMode: false,
        dryRun: false,
        autoSubmit: true,
        autoResumeOnAnswer: true,
        maxApplicationsPerRun: 200,
        maxSkipsPerRun: 50,
        blacklistedCompanies: [],
        badWords: [],
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
        }, 2500);
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

  const saveAnswerForQuestion = async (questionKey: string, questionLabel: string) => {
    const canonicalKey = toQuestionKey(questionKey || questionLabel);
    const label = String(questionLabel || "").trim() || labelFromQuestionKey(canonicalKey);
    const answer = (answerDrafts[canonicalKey] || answerDrafts[questionKey] || "").trim();
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

      await saveAnswerToSite(canonicalKey, label, answer);

      const ack = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const requestId = `cp_save_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        let done = false;
        const timer = window.setTimeout(() => {
          if (done) return;
          done = true;
          window.removeEventListener("message", onMessage);
          resolve({ ok: false, error: "Extension did not acknowledge answer save. Reload extension and retry." });
        }, 2000);
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
  }, [extensionStatus.installed, user?.id, Object.keys(siteScreeningAnswers).length]);

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

  const allScreeningFields = useMemo(() => {
    const merged = new Map<string, { questionKey: string; questionLabel: string; answer: string }>();
    const upsert = (rawKey: string, questionLabel: string, answer: string) => {
      const questionKey = toQuestionKey(rawKey || questionLabel);
      if (!questionKey) return;
      const cleanAnswer = String(answer || "").trim();
      const cleanLabel = String(questionLabel || "").trim() || siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey);
      const existing = merged.get(questionKey);
      merged.set(questionKey, {
        questionKey,
        questionLabel: existing?.questionLabel || cleanLabel,
        answer: cleanAnswer || existing?.answer || "",
      });
    };

    for (const [rawKey, rawAnswer] of Object.entries(siteScreeningAnswers)) {
      const questionKey = toQuestionKey(rawKey);
      if (!questionKey) continue;
      upsert(questionKey, siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey), String(rawAnswer || ""));
    }
    for (const [rawKey, rawAnswer] of Object.entries(extensionStatus.screeningAnswers || {})) {
      const questionKey = toQuestionKey(rawKey);
      if (!questionKey) continue;
      upsert(questionKey, siteQuestionLabels[questionKey] || labelFromQuestionKey(questionKey), String(rawAnswer || ""));
    }
    for (const pending of extensionStatus.pendingQuestions || []) {
      upsert(pending.questionKey || pending.questionLabel, pending.questionLabel, resolveKnownAnswer(pending.questionKey, pending.questionLabel, extensionStatus.screeningAnswers || {}));
    }

    return Array.from(merged.values()).sort((a, b) => a.questionLabel.localeCompare(b.questionLabel));
  }, [siteScreeningAnswers, siteQuestionLabels, extensionStatus.pendingQuestions, extensionStatus.screeningAnswers, answerDrafts]);

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

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Auto-Apply Jobs</h1>
          <p className="text-gray-600">Showing {jobs.length} real jobs from your backend queue</p>
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
            <h2 className="text-xl font-bold text-gray-900">LinkedIn Extension Setup</h2>
            <p className="text-sm text-gray-600">Login LinkedIn, install extension, then click Start inside extension panel.</p>
          </div>
          <button
            onClick={() => void checkExtensionStatus()}
            disabled={checkingExtension}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold disabled:opacity-60"
          >
            {checkingExtension ? "Checking..." : "Check Extension"}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className={`rounded-xl border p-4 ${extensionStatus.installed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              {extensionStatus.installed ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
              Extension Installed
            </div>
            <p className="text-sm text-gray-700">
              {extensionStatus.installed ? "Detected on dashboard." : "Not detected. Install/reload CareerPilot extension."}
            </p>
          </div>
          <div className={`rounded-xl border p-4 ${extensionStatus.linkedIn?.hasLinkedInTab ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              {extensionStatus.linkedIn?.hasLinkedInTab ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
              LinkedIn Open
            </div>
            <p className="text-sm text-gray-700">
              {extensionStatus.linkedIn?.hasLinkedInTab ? "LinkedIn tab found." : "Open linkedin.com and login first."}
            </p>
          </div>
          <div className={`rounded-xl border p-4 ${extensionStatus.linkedIn?.hasJobsTab ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              {extensionStatus.linkedIn?.hasJobsTab ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
              Jobs Page Ready
            </div>
            <p className="text-sm text-gray-700">
              {extensionStatus.linkedIn?.hasJobsTab ? "LinkedIn Jobs tab found." : "Open LinkedIn Jobs page to run automation."}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="https://www.linkedin.com/jobs/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open LinkedIn Jobs
          </a>
          <a
            href="chrome://extensions/"
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Install / Reload Extension
          </a>
          <button
            onClick={() => void syncProfileToExtension()}
            disabled={syncingSettings}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-semibold inline-flex items-center gap-2 disabled:opacity-60"
          >
            <Link2 className="w-4 h-4" />
            {syncingSettings ? "Syncing..." : "Sync Profile to Extension"}
          </button>
        </div>

        <ol className="mt-4 text-sm text-gray-700 list-decimal pl-5 space-y-1">
          <li>Login to LinkedIn in your browser.</li>
          <li>Install CareerPilot extension from `e:\Autoapply\CareerPilotLinkedInExtension` (Load unpacked).</li>
          <li>Open LinkedIn Jobs page.</li>
          <li>Click extension icon, choose CareerPilot extension, then click Start.</li>
        </ol>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-semibold text-blue-900">Resume Requirement Handling</div>
          <div className="text-sm text-blue-800 mt-1">
            If a job says resume is required, upload your resume in LinkedIn Easy Apply profile first.
            The copilot automatically picks the latest attached resume option in the modal.
          </div>
        </div>

        {(extensionStatus.pendingQuestions || []).length > 0 ? (
          <div className="mt-6 border-t border-gray-200 pt-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Action Needed: Answer Required Fields</h3>
            {(extensionStatus.pendingQuestions || []).map((q) => (
              <div key={q.questionKey} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-gray-900">{q.questionLabel}</div>
                {q.validationMessage ? <div className="text-xs text-amber-700 mt-1">{q.validationMessage}</div> : null}
                {(q.questionKey === "resume_upload_required" || /resume/i.test(String(q.validationMessage || ""))) ? (
                  <div className="text-xs text-blue-700 mt-2">
                    Upload resume in LinkedIn Easy Apply profile. Copilot will auto-select the newest attached resume.
                  </div>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <input
                    value={answerDrafts[toQuestionKey(q.questionKey || q.questionLabel)] || ""}
                    onChange={(e) =>
                      setAnswerDrafts((prev) => ({
                        ...prev,
                        [toQuestionKey(q.questionKey || q.questionLabel)]: e.target.value,
                      }))
                    }
                    placeholder="Enter answer to reuse in next applications"
                    className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm outline-none focus:border-purple-400"
                  />
                  <button
                    onClick={() => void saveAnswerForQuestion(q.questionKey, q.questionLabel)}
                    disabled={savingAnswerKey === toQuestionKey(q.questionKey || q.questionLabel)}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {savingAnswerKey === toQuestionKey(q.questionKey || q.questionLabel) ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {allScreeningFields.length > 0 ? (
          <div className="mt-6 border-t border-gray-200 pt-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Saved Screening Fields (Synced)</h3>
            {allScreeningFields.map((field) => (
              <div key={field.questionKey} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-900">{field.questionLabel}</div>
                <div className="text-[11px] text-gray-500 mt-1">{field.questionKey}</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={answerDrafts[field.questionKey] ?? field.answer}
                    onChange={(e) =>
                      setAnswerDrafts((prev) => ({
                        ...prev,
                        [field.questionKey]: e.target.value,
                      }))
                    }
                    placeholder="Type answer and click Save"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:border-purple-400"
                  />
                  <button
                    onClick={() => void saveAnswerForQuestion(field.questionKey, field.questionLabel)}
                    disabled={savingAnswerKey === field.questionKey}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {savingAnswerKey === field.questionKey ? "Saving..." : "Save"}
                  </button>
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
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge(job.status)}`}>{job.status}</div>
                </div>
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
                <div className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge(selectedJob.status)}`}>{selectedJob.status}</div>
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
