import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CircleCheckBig, AlertTriangle, MessagesSquare, RefreshCw } from "lucide-react";

type Job = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  createdAt: string;
  criteriaJson?: Record<string, unknown>;
};

export default function Interview() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auto-apply/jobs");
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      setJobs((data?.data?.jobs || []) as Job[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const submitted = jobs.filter((j) => j.status === "succeeded").length;
    const failed = jobs.filter((j) => j.status === "failed" || j.status === "dead_letter").length;
    const inProgress = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
    const interviewReadiness = submitted > 0 ? Math.min(100, 40 + submitted * 10) : 20;
    return { submitted, failed, inProgress, interviewReadiness };
  }, [jobs]);

  const prepChecklist = [
    {
      title: "Review top applied roles",
      done: summary.submitted > 0,
      help: "Focus on roles where your applications were submitted successfully.",
    },
    {
      title: "Fix recurring application failures",
      done: summary.failed === 0,
      help: "Resolve blockers like invalid phone/city/required fields to increase interview chances.",
    },
    {
      title: "Prepare role-specific intro",
      done: summary.submitted >= 2,
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
          onClick={() => void load()}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? <div className="text-sm text-gray-500">Loading interview readiness...</div> : null}

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Submitted Jobs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.submitted}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">In Progress</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.inProgress}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Failed Jobs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.failed}</div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-5">
          <div className="text-sm text-gray-600">Readiness Score</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{summary.interviewReadiness}%</div>
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
            <div className="border border-gray-200 rounded-xl p-4">Tell me about yourself for a {summary.submitted > 0 ? "role you've applied to" : "software role"}.</div>
            <div className="border border-gray-200 rounded-xl p-4">Describe a challenging bug you fixed and how you debugged it.</div>
            <div className="border border-gray-200 rounded-xl p-4">How do you prioritize tasks when deadlines are tight?</div>
            <div className="border border-gray-200 rounded-xl p-4">Walk me through one project from architecture to delivery.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
