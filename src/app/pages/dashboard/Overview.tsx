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
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { QuotaUsage } from "../../components/quota-usage";
import { UpgradeModal } from "../../components/upgrade-modal";
import { useDashboardSummary } from "../../hooks/useDashboardSummary";

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState("");
  const { summary, loading, error } = useDashboardSummary();

  const stats = [
    {
      name: "Active Applications",
      value: String(summary.jobs.active > 0 ? summary.jobs.active : summary.applications.submitted),
      change: `${summary.applications.submitted} submitted`,
      icon: Briefcase,
      color: "from-blue-500 to-cyan-500",
    },
    {
      name: "Total Jobs",
      value: String(summary.jobs.total),
      change: `${summary.jobs.failed} failed`,
      icon: Target,
      color: "from-purple-500 to-pink-500",
    },
    {
      name: "Interviews Scheduled",
      value: String(summary.interview.upcomingCount),
      change: `${summary.metrics.interviewReadiness}% readiness`,
      icon: Calendar,
      color: "from-green-500 to-emerald-500",
    },
    {
      name: "Response Rate",
      value: `${summary.metrics.responseRate}%`,
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
              {loading ? <div className="text-sm text-gray-500">Loading recent activity...</div> : null}
              {error ? <div className="text-sm text-rose-600">{error}</div> : null}
              {!loading && summary.recent.length === 0 ? (
                <div className="text-sm text-gray-500">No applications yet. Start your first auto-apply run.</div>
              ) : null}
              {!loading &&
                summary.recent.map((app) => (
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
                            disabled={!app.sourceUrl}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!app.sourceUrl) return;
                              window.open(app.sourceUrl, "_blank", "noopener,noreferrer");
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                              app.sourceUrl
                                ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                                : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                            title={app.sourceUrl ? `Open on ${app.sourceLabel}` : `${app.sourceLabel} link not available for this item`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {app.sourceLabel}
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
                            title={app.externalJobId ? `Copy ${app.sourceLabel} Job ID` : "Job ID not available for this item"}
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
                <div className="font-semibold mb-1">{summary.interview.title}</div>
                <div className="text-sm text-purple-100 mb-2">{summary.interview.body}</div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{summary.metrics.interviewReadiness}% interview readiness</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(summary.interview.ctaHref)}
              className="w-full mt-4 px-4 py-3 bg-white text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors"
            >
              {summary.interview.ctaLabel}
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
              <h3 className="font-bold text-gray-900">{summary.proTip.title}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">{summary.proTip.body}</p>
            <button
              onClick={() => navigate(summary.proTip.ctaHref)}
              className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1"
            >
              {summary.proTip.ctaLabel}
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
