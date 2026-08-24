import { BarChart3, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { useDashboardSummary } from "../../hooks/useDashboardSummary";

export default function Analytics() {
  const { summary, loading, error, refresh } = useDashboardSummary();
  const maxDay = Math.max(1, ...summary.activityByDay.map((row) => row.value));
  const byStatus = [
    { label: "Submitted", value: summary.applications.submitted, color: "bg-green-500" },
    { label: "Failed", value: summary.applications.failed, color: "bg-red-500" },
    { label: "Skipped", value: summary.applications.skipped, color: "bg-amber-500" },
    { label: "Cancelled", value: summary.jobs.cancelled, color: "bg-gray-500" },
    { label: "In Progress", value: summary.jobs.active, color: "bg-blue-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real job funnel analytics from your backend pipeline.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? <div className="text-xs text-gray-400 py-2">Loading analytics...</div> : null}
      {error ? <div className="text-xs text-rose-600 py-2">{error}</div> : null}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Total Jobs</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.jobs.total}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Submitted</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.applications.submitted}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Failed</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.applications.failed}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Success Rate</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.metrics.responseRate}%</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3.5">
          <div className="text-[11px] text-gray-500 font-medium">Completion</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{summary.metrics.completionRate}%</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-4">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            Jobs Created (Last 7 Days)
          </h2>
          <div className="space-y-2.5">
            {summary.activityByDay.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center">No activity yet.</div>
            ) : (
              summary.activityByDay.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-semibold text-gray-900">{row.value}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${(row.value / maxDay) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-4">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Status Breakdown</h2>
          <div className="space-y-2">
            {byStatus.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${row.color}`} />
                  <span className="text-xs text-gray-700">{row.label}</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] text-emerald-700 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Improve success with refined targeting</span>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-700 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span>Review blockers to reduce failed runs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
