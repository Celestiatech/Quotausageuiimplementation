import { CalendarCheck2, CircleCheckBig, AlertTriangle, MessagesSquare, RefreshCw } from "lucide-react";
import { useDashboardSummary } from "../../hooks/useDashboardSummary";

export default function Interview() {
  const { summary, loading, error, refresh } = useDashboardSummary();
  const mostRecentRole = summary.recent[0]?.position || "software role";
  const mostRecentCompany = summary.recent[0]?.company || "this company";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Prep</h1>
          <p className="text-gray-600">Use real application outcomes to prepare smarter.</p>
        </div>
        <button
          onClick={() => void refresh()}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading interview readiness...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <div className="grid md:grid-cols-5 gap-4">
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Submitted Jobs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.applications.submitted}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">In Progress</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.jobs.active}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Failed Jobs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.applications.failed}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Skipped Jobs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.applications.skipped}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Readiness Score</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.metrics.interviewReadiness}%</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarCheck2 className="w-5 h-5 text-purple-600" />
            Interview Checklist
          </h2>
          <div className="space-y-3">
            {prepChecklist.map((item) => (
              <div key={item.title} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  {item.done ? <CircleCheckBig className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                  {item.title}
                </div>
                <div className="text-sm text-gray-600 mt-1">{item.help}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessagesSquare className="w-5 h-5 text-purple-600" />
            Suggested Practice Prompts
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="border border-gray-200 rounded-xl p-4">Tell me about yourself for a {mostRecentRole} role.</div>
            <div className="border border-gray-200 rounded-xl p-4">Why do you want to work at {mostRecentCompany}?</div>
            <div className="border border-gray-200 rounded-xl p-4">Describe a challenging bug you fixed and how you debugged it.</div>
            <div className="border border-gray-200 rounded-xl p-4">How do you prioritize tasks when deadlines are tight?</div>
            <div className="border border-gray-200 rounded-xl p-4">Walk me through one project from architecture to delivery.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
