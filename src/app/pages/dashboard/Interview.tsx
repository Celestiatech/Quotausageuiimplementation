import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarCheck2,
  CircleCheckBig,
  AlertTriangle,
  MessagesSquare,
  RefreshCw,
  Coins,
  Gauge,
  Wallet,
  Sparkles,
  Clock,
  AlertCircle,
  SkipForward,
  Target,
  ArrowRight,
  Check,
  Puzzle,
  CheckCircle2,
  Video,
} from "lucide-react";
import { useDashboardSummary } from "../../hooks/useDashboardSummary";

type InterviewUsage = {
  plan: "free" | "pro" | "coach";
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  freeRemaining: number;
  dailyUsed: number;
  dailyCap: number;
  spendable: number;
  answersToday: number;
  answersTotal: number;
  dailyResetTime: string;
};

const PLAN_LABELS: Record<InterviewUsage["plan"], string> = {
  free: "Free",
  pro: "Pro",
  coach: "Coach",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

const USAGE_CARDS = [
  {
    label: "Answers used today",
    key: "today" as const,
    icon: Sparkles,
    chip: "from-purple-500 to-violet-500",
    sub: "1 Hire per answer",
    bg: "from-violet-50 via-purple-50/70 to-white",
    border: "border-purple-100",
  },
  {
    label: "Answers used total",
    key: "total" as const,
    icon: Gauge,
    chip: "from-indigo-500 to-blue-500",
    sub: "all-time",
    bg: "from-indigo-50 via-blue-50/70 to-white",
    border: "border-indigo-100",
  },
  {
    label: "Free Hires left today",
    key: "free" as const,
    icon: Coins,
    chip: "from-emerald-500 to-teal-500",
    sub: "resets daily",
    bg: "from-emerald-50 via-teal-50/70 to-white",
    border: "border-emerald-100",
  },
  {
    label: "Paid Hires balance",
    key: "paid" as const,
    icon: Wallet,
    chip: "from-amber-500 to-orange-500",
    sub: "from wallet",
    bg: "from-amber-50 via-orange-50/70 to-white",
    border: "border-amber-100",
  },
];

function InterviewCopilotUsage() {
  const [data, setData] = useState<InterviewUsage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/interview-usage", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load usage");
        const json = (await res.json()) as { data?: InterviewUsage };
        if (!cancelled) setData(json.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load Interview Copilot usage.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlimited = data?.plan === "pro";
  const freeTotal = data ? Math.max(data.dailyCap, 1) : 1;
  const freeUsedToday = data ? Math.min(data.dailyUsed, freeTotal) : 0;
  const freePct = Math.round((freeUsedToday / freeTotal) * 100);

  const statValue = (key: (typeof USAGE_CARDS)[number]["key"]) => {
    if (!data) return "…";
    switch (key) {
      case "today":
        return data.answersToday;
      case "total":
        return data.answersTotal;
      case "free":
        return unlimited ? "∞" : data.freeRemaining;
      case "paid":
        return unlimited ? "∞" : data.hireBalance;
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/60 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </span>
            Interview Copilot Usage
          </h2>
          <p className="text-sm text-gray-600 mt-1.5">
            Each AI answer uses 1 Hire. Free daily Hires are used first, then paid Hires from your wallet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-100 rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#6366F1] to-[#A855F7]" />
            <span className="text-sm font-semibold text-purple-700 capitalize">
              {data ? PLAN_LABELS[data.plan] : "…"} Plan
            </span>
          </div>
          {data ? (
            <button
              onClick={() => {
                window.location.href = "/dashboard/billing";
              }}
              className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1"
            >
              <Coins className="w-4 h-4" />
              Get more Hires
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4">{error}</div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {USAGE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className={`bg-gradient-to-br ${card.bg} rounded-2xl p-5 border ${card.border} hover:border-purple-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
            >
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.chip} flex items-center justify-center shadow-md mb-3`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="text-base font-bold text-gray-900 mb-0.5">{statValue(card.key)}</div>
              <div className="text-[13px] text-gray-600">{card.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>

              {card.key === "free" && data && !unlimited ? (
                <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500" style={{ width: `${freePct}%` }} />
                </div>
              ) : null}
              {card.key === "free" && data && !unlimited ? (
                <div className="text-xs text-gray-400 mt-1">resets {formatDate(data.dailyResetTime)} local</div>
              ) : null}
              {card.key === "paid" && data ? (
                <div className="text-xs text-gray-400 mt-1">{data.hirePurchased} purchased</div>
              ) : null}
            </div>
          );
        })}
      </div>

      {data && data.spendable <= 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-4 py-3">
          <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            You're out of Hires — the Copilot is paused until you top up or upgrade.
          </div>
          <button
            onClick={() => {
              window.location.href = "/dashboard/billing";
            }}
            className="inline-flex items-center gap-1.5 rounded-lg gradient-primary text-white px-4 py-2 text-sm font-bold hover:shadow-md transition-shadow"
          >
            <Coins className="w-4 h-4" />
            Add Hires
          </button>
        </div>
      ) : null}
    </motion.section>
  );
}

const STAT_CARDS = [
  {
    label: "Submitted Jobs",
    value: (s: ReturnType<typeof useDashboardSummary>["summary"]) => s.applications.submitted,
    icon: CircleCheckBig,
    chip: "from-emerald-500 to-teal-500",
  },
  {
    label: "In Progress",
    value: (s: ReturnType<typeof useDashboardSummary>["summary"]) => s.jobs.active,
    icon: Clock,
    chip: "from-blue-500 to-cyan-500",
  },
  {
    label: "Failed Jobs",
    value: (s: ReturnType<typeof useDashboardSummary>["summary"]) => s.applications.failed,
    icon: AlertCircle,
    chip: "from-rose-500 to-red-500",
  },
  {
    label: "Skipped Jobs",
    value: (s: ReturnType<typeof useDashboardSummary>["summary"]) => s.applications.skipped,
    icon: SkipForward,
    chip: "from-orange-500 to-amber-500",
  },
  {
    label: "Readiness Score",
    value: (s: ReturnType<typeof useDashboardSummary>["summary"]) => `${s.metrics.interviewReadiness}%`,
    icon: Target,
    chip: "from-purple-500 to-pink-500",
  },
];

export default function Interview() {
  const { summary, loading, error } = useDashboardSummary();
  const mostRecentRole = summary.recent[0]?.position || "software role";
  const mostRecentCompany = summary.recent[0]?.company || "this company";

  const [extState, setExtState] = useState<"checking" | "installed" | "missing">("checking");
  const [extVersion, setExtVersion] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const pongRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onMessageRef = useRef<((event: MessageEvent) => void) | null>(null);

  const detectExtension = useCallback(() => {
    setExtState("checking");
    setRefreshing(true);
    pongRef.current = false;

    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.source !== "CP_MEET_EXT" || msg.type !== "CP_MEET_PONG") return;
      pongRef.current = true;
      setExtVersion(String(msg.version || ""));
      setExtState("installed");
      setRefreshing(false);
    };

    // Keep the listener attached so a late PONG (e.g. extension reloaded or
    // page installed after this page opened) is still picked up.
    if (onMessageRef.current) {
      window.removeEventListener("message", onMessageRef.current);
    }
    onMessageRef.current = onMessage;
    window.addEventListener("message", onMessage);

    window.postMessage({ source: "CP_MEET_PAGE", type: "CP_MEET_PING" }, "*");

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setRefreshing(false);
      if (!pongRef.current) setExtState("missing");
    }, 2000);
  }, []);

  useEffect(() => {
    detectExtension();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (onMessageRef.current) window.removeEventListener("message", onMessageRef.current);
    };
  }, [detectExtension]);

  const prepChecklist = [
    {
      title: "Review top applied roles",
      done: summary.applications.submitted > 0,
      help: "Focus on roles where your applications were submitted successfully.",
    },
    {
      title: "Fix recurring application failures",
      done: summary.applications.failed === 0,
      help: "Resolve blockers like invalid phone/city/required fields to increase interview chances.",
    },
    {
      title: "Prepare role-specific intro",
      done: summary.applications.submitted >= 2,
      help: "Create a 60-second summary tailored to your target role.",
    },
  ];

  const promptColors = [
    { bg: "bg-purple-50", chip: "from-purple-500 to-violet-500" },
    { bg: "bg-sky-50", chip: "from-sky-500 to-blue-500" },
    { bg: "bg-emerald-50", chip: "from-emerald-500 to-teal-500" },
    { bg: "bg-amber-50", chip: "from-amber-500 to-orange-500" },
    { bg: "bg-rose-50", chip: "from-rose-500 to-pink-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">Interview Prep</h1>
            <p className="text-sm text-gray-500">Use real application outcomes to prepare smarter.</p>
          </div>
          {/* Extension status badge */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
            extState === "installed"
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : extState === "checking"
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Puzzle className="w-4 h-4" />
            {extState === "installed" ? 'Copilot Connected' : extState === "checking" ? 'Checking...' : 'Copilot Not Found'}
            {extState === "missing" && (
              <button
                onClick={() => void detectExtension()}
                disabled={refreshing}
                className="ml-1 p-1 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                title="Refresh extension detection"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {loading ? <div className="text-sm text-gray-500">Loading interview readiness...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      {/* ── Extension Not Installed Banner ── */}
      {extState !== "installed" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
              <Puzzle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-xs">Install the AutoApplyCV Meet Copilot Live Extension</h3>
              <p className="text-sm text-gray-600 mt-1">
                The copilot listens to your live interviews on Google Meet, Zoom & MS Teams and drafts
                polished, resume-personalized answers — right on your screen.
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <button
                  onClick={() => void detectExtension()}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Detecting...' : 'Refresh & Detect'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-50 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload Page
                </button>
                <span className="text-xs text-gray-400">
                  Load the extension first, then reload this page so it can connect.
                </span>
              </div>
            </div>
          </div>
          {/* Steps */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: "1", title: "Load Unpacked", desc: "Open chrome://extensions → Developer mode → Load unpacked" },
              { step: "2", title: "Select Folder", desc: "Pick the AutoApplyCvMeetCopilotLiveExtension folder" },
              { step: "3", title: "Reload & Check", desc: "Reload this page, then click 'Refresh & Detect'" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3 bg-white/60 rounded-xl p-3 border border-amber-100">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Extension Installed Banner ── */}
      {extState === "installed" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          AutoApplyCV Meet Copilot Live extension connected{extVersion ? ` · v${extVersion}` : ""}. Use the popup to start a live copilot session.
        </motion.div>
      )}

      <InterviewCopilotUsage />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/60 hover:border-purple-300 hover:shadow-lg transition-all duration-300"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.chip} flex items-center justify-center shadow-md mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-base font-bold text-gray-900 mb-0.5">{loading ? "…" : card.value(summary)}</div>
              <div className="text-[13px] text-gray-600">{card.label}</div>
            </div>
          );
        })}
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/60 shadow-sm"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <CalendarCheck2 className="w-5 h-5 text-white" />
            </span>
            Interview Checklist
          </h2>
          <div className="space-y-3">
            {prepChecklist.map((item) => (
              <div
                key={item.title}
                className={`flex items-start gap-3 rounded-xl border border-white/60 p-4 ${
                  item.done ? "bg-emerald-50/70" : "bg-amber-50/70"
                } hover:shadow-md transition-all`}
              >
                <span
                  className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                    item.done ? "bg-emerald-500" : "bg-amber-500"
                  } text-white`}
                >
                  {item.done ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900">{item.title}</div>
                  <div className="text-sm text-gray-600 mt-0.5">{item.help}</div>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    item.done ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.done ? "Done" : "To do"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/60 shadow-sm"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
              <MessagesSquare className="w-5 h-5 text-white" />
            </span>
            Suggested Practice Prompts
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            {[
              `Tell me about yourself for a ${mostRecentRole} role.`,
              `Why do you want to work at ${mostRecentCompany}?`,
              "Describe a challenging bug you fixed and how you debugged it.",
              "How do you prioritize tasks when deadlines are tight?",
              "Walk me through one project from architecture to delivery.",
            ].map((prompt, i) => {
              const color = promptColors[i % promptColors.length];
              return (
                <div
                  key={prompt}
                  className={`group flex items-center justify-between gap-3 rounded-xl border border-white/60 p-4 ${color.bg} hover:shadow-md hover:-translate-y-0.5 transition-all`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${color.chip} text-white shrink-0`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-medium">{prompt}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
