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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">Real job funnel analytics from your backend pipeline.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading analytics...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <div className="grid md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="text-sm text-gray-600">Total Jobs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.jobs.total}</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="text-sm text-gray-600">Submitted</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.applications.submitted}</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="text-sm text-gray-600">Failed</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.applications.failed}</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="text-sm text-gray-600">Success Rate</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.metrics.responseRate}%</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5">
          <div className="text-sm text-gray-600">Completion</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.metrics.completionRate}%</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Jobs Created (Last 7 Days)
          </h2>
          <div className="space-y-3">
            {summary.activityByDay.length === 0 ? (
              <div className="text-sm text-gray-500">No activity yet.</div>
            ) : (
              summary.activityByDay.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{row.label}</span>
                    <span className="font-semibold text-gray-900">{row.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${(row.value / maxDay) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Status Breakdown</h2>
          <div className="space-y-3">
            {byStatus.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${row.color}`} />
                  <span className="text-sm text-gray-700">{row.label}</span>
                </div>
                <span className="font-semibold text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Improve success by fixing failed-field patterns
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Track cancellations to refine targeting
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
