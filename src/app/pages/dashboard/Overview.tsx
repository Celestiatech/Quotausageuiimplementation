import { motion } from "motion/react";
import {
  TrendingUp,
  Briefcase,
  Target,
  Clock,
  ArrowRight,
  Star,
  Calendar,
  Zap,
  Users,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { QuotaUsage } from "../../components/quota-usage";
import { UpgradeModal } from "../../components/upgrade-modal";
import { useExtensionPipelineStats } from "../../hooks/useExtensionPipelineStats";

type AutoApplyJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  createdAt: string;
  criteriaJson?: Record<string, unknown>;
};

type RecentItem = {
  id: string;
  company: string;
  position: string;
  status: "Submitted" | "Running" | "Queued" | "Failed" | "Cancelled";
  date: string;
  match: number | null;
  linkedInUrl: string;
  externalJobId: string;
};

function parseLinkedInJobId(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/\/jobs\/view\/(\d+)/i);
  if (m?.[1]) return String(m[1]);
  return raw.match(/^\d+$/) ? raw : "";
}

function linkedInUrlFromCriteria(criteria: Record<string, unknown> | undefined) {
  const c = criteria || {};
  const direct = String(c.jobUrl || c.pageUrl || "").trim();
  const id = parseLinkedInJobId(c.jobId) || parseLinkedInJobId(direct);
  if (direct && direct.includes("linkedin.com/jobs/")) return direct;
  if (id) return `https://www.linkedin.com/jobs/view/${id}/`;
  return "";
}

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [jobs, setJobs] = useState<AutoApplyJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [copiedJobId, setCopiedJobId] = useState("");
  const extensionStats = useExtensionPipelineStats();

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/auto-apply/jobs");
        const data = await res.json();
        if (!res.ok || !data?.success || !active) return;
        setJobs((data?.data?.jobs || []) as AutoApplyJob[]);
      } finally {
        if (active) setLoadingJobs(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const computed = useMemo(() => {
    const active = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
    const backendSucceeded = jobs.filter((j) => j.status === "succeeded").length;
    const backendFailed = jobs.filter((j) => j.status === "failed" || j.status === "dead_letter").length;
    const succeeded = Math.max(backendSucceeded, extensionStats.applied);
    const failed = Math.max(backendFailed, extensionStats.failed);
    const totalTracked = Math.max(jobs.length, succeeded + failed + extensionStats.skipped);
    const resolved = succeeded + failed;
    const responseRate = resolved > 0 ? Math.round((succeeded / resolved) * 100) : 0;
    const interviews = 0;

    const recent: RecentItem[] = jobs
      .slice()
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5)
      .map((j) => {
        const status: RecentItem["status"] =
          j.status === "succeeded"
            ? "Submitted"
            : j.status === "running"
            ? "Running"
            : j.status === "queued"
            ? "Queued"
            : j.status === "cancelled"
            ? "Cancelled"
            : "Failed";
        const company = String(j.criteriaJson?.company || "LinkedIn");
        const position = String(j.criteriaJson?.title || j.criteriaJson?.keywords || "Auto-Apply Job");
        const parsedMatch = Number(j.criteriaJson?.matchScore || 0);
        const linkedInUrl = linkedInUrlFromCriteria(j.criteriaJson);
        const externalJobId = parseLinkedInJobId(j.criteriaJson?.jobId) || parseLinkedInJobId(linkedInUrl);
        return {
          id: j.id,
          company,
          position,
          status,
          date: new Date(j.createdAt).toLocaleDateString(),
          match: Number.isFinite(parsedMatch) && parsedMatch > 0 ? parsedMatch : null,
          linkedInUrl,
          externalJobId,
        };
      });

    return { active, succeeded, failed, totalTracked, responseRate, interviews, recent };
  }, [jobs, extensionStats]);

  const stats = [
    {
      name: "Active Applications",
      value: String(computed.active > 0 ? computed.active : computed.succeeded),
      change: `${computed.succeeded} submitted`,
      icon: Briefcase,
      color: "from-blue-500 to-cyan-500",
    },
    {
      name: "Total Jobs",
      value: String(computed.totalTracked),
      change: `${computed.failed} failed`,
      icon: Target,
      color: "from-purple-500 to-pink-500",
    },
    {
      name: "Interviews Scheduled",
      value: String(computed.interviews),
      change: "Synced from pipeline",
      icon: Calendar,
      color: "from-green-500 to-emerald-500",
    },
    {
      name: "Response Rate",
      value: `${computed.responseRate}%`,
      change: "Submitted vs failed",
      icon: TrendingUp,
      color: "from-orange-500 to-red-500",
    },
  ];

  const quickActions = [
    { icon: Target, label: "Find Jobs", color: "from-blue-500 to-cyan-500", href: "/dashboard/jobs" },
    { icon: Briefcase, label: "Apply Now", color: "from-purple-500 to-pink-500", href: "/dashboard/jobs" },
    { icon: Zap, label: "Resume Check", color: "from-green-500 to-emerald-500", href: "/dashboard/resume" },
    { icon: Users, label: "Interview Prep", color: "from-orange-500 to-red-500", href: "/dashboard/interview" },
  ];

  const quotaResetTime = user?.dailyHireResetTime
    ? new Date(user.dailyHireResetTime)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user?.name || "User"}!</h1>
        <p className="text-gray-600">Here is what is happening with your job search today.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-green-600 font-semibold">{stat.change}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.name}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Applications</h2>
              <button
                onClick={() => navigate("/dashboard/applications")}
                className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {loadingJobs ? <div className="text-sm text-gray-500">Loading recent activity...</div> : null}
              {!loadingJobs && computed.recent.length === 0 ? (
                <div className="text-sm text-gray-500">No applications yet. Start your first auto-apply run.</div>
              ) : null}
              {!loadingJobs &&
                computed.recent.map((app) => (
                  <div key={app.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-purple-700">
                        {app.company.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{app.position}</div>
                        <div className="text-sm text-gray-600">{app.company}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!app.linkedInUrl}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!app.linkedInUrl) return;
                              window.open(app.linkedInUrl, "_blank", "noopener,noreferrer");
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              app.linkedInUrl
                                ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                            title={app.linkedInUrl ? "Open on LinkedIn" : "LinkedIn link not available for this item"}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            LinkedIn
                          </button>
                          <button
                            type="button"
                            disabled={!app.externalJobId}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!app.externalJobId) return;
                              try {
                                await navigator.clipboard.writeText(app.externalJobId);
                                setCopiedJobId(app.externalJobId);
                                window.setTimeout(() => setCopiedJobId(""), 1200);
                              } catch {
                                // ignore
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              app.externalJobId
                                ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                            title={app.externalJobId ? "Copy LinkedIn Job ID" : "Job ID not available for this item"}
                          >
                            {copiedJobId === app.externalJobId ? (
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            {copiedJobId === app.externalJobId ? "Copied" : "Copy ID"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-gray-900">{app.match ?? "-"}</div>
                        <div className="text-xs text-gray-500">Match</div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-sm font-semibold px-3 py-1 rounded-full ${
                            app.status === "Submitted"
                              ? "bg-green-100 text-green-700"
                              : app.status === "Queued" || app.status === "Running"
                              ? "bg-blue-100 text-blue-700"
                              : app.status === "Cancelled"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {app.status}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{app.date}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.href)}
                className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 text-center"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                  <action.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-sm font-semibold text-gray-900">{action.label}</div>
              </button>
            ))}
          </motion.div>
        </div>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" />
              <h3 className="font-bold">Upcoming Interviews</h3>
            </div>
            <div className="space-y-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="font-semibold mb-1">No interview events yet</div>
                <div className="text-sm text-purple-100 mb-2">Interview calendar integration pending</div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>Keep applying to unlock interviews</span>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 px-4 py-3 bg-white text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors">
              View Calendar
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900">Pro Tip</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Complete onboarding and keep resume/profile updated for fewer application errors and better success rate.
            </p>
            <button className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1">
              Learn More
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200"
          >
            <QuotaUsage quotaResetTime={quotaResetTime} onUpgradeClick={() => setShowUpgradeModal(true)} />
          </motion.div>
        </div>
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}
