import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

type AdminJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
  createdAt: string;
  updatedAt: string;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
  criteriaJson: Record<string, unknown>;
  user: { id: string; email: string; name: string; plan: string };
};

export default function AdminJobs() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/jobs", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch jobs");
      setJobs(data?.data?.jobs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobs();
  }, []);

  const summary = useMemo(() => {
    const s = { queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0, dead_letter: 0 };
    for (const job of jobs) s[job.status] += 1;
    return s;
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Job Management</h1>
          <p className="text-gray-600">Backend auto-apply jobs and execution status</p>
        </div>
        <button
          onClick={() => void loadJobs()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(summary).map(([status, count]) => (
          <div key={status} className="bg-white rounded-xl p-4 border-2 border-gray-200">
            <div className="text-xs uppercase text-gray-500">{status}</div>
            <div className="text-2xl font-bold text-gray-900">{count}</div>
          </div>
        ))}
      </div>

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div className="text-gray-500 text-sm">Loading jobs...</div> : null}

      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Job</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Attempts</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{String(job.criteriaJson?.title || job.criteriaJson?.keywords || "Auto-Apply Job")}</div>
                    <div className="text-xs text-gray-500 break-all">{job.id}</div>
                    {job.errorMessage ? <div className="text-xs text-red-600 mt-1">{job.errorMessage}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{job.user?.name}</div>
                    <div className="text-gray-500">{job.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 uppercase">{job.status}</td>
                  <td className="px-4 py-3">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="px-4 py-3">{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No jobs yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
