import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Search, Calendar, FileText, RefreshCw } from "lucide-react";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";

type Job = {
  id: string;
  status: JobStatus;
  createdAt: string;
  criteriaJson?: Record<string, unknown>;
};

type View = "kanban" | "list";

const columns: Array<{ id: JobStatus; title: string; badge: string; card: string }> = [
  { id: "queued", title: "Queued", badge: "text-purple-700 bg-purple-100", card: "border-purple-200" },
  { id: "running", title: "Running", badge: "text-blue-700 bg-blue-100", card: "border-blue-200" },
  { id: "succeeded", title: "Submitted", badge: "text-green-700 bg-green-100", card: "border-green-200" },
  { id: "failed", title: "Failed", badge: "text-red-700 bg-red-100", card: "border-red-200" },
  { id: "cancelled", title: "Cancelled", badge: "text-gray-700 bg-gray-100", card: "border-gray-200" },
  { id: "dead_letter", title: "Dead Letter", badge: "text-red-700 bg-red-100", card: "border-red-200" },
];

export default function Applications() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/auto-apply/jobs");
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch applications");
      setJobs((data?.data?.jobs || []) as Job[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => {
      const title = String(j.criteriaJson?.title || j.criteriaJson?.keywords || "").toLowerCase();
      const company = String(j.criteriaJson?.company || "").toLowerCase();
      return (
        j.id.toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q) ||
        title.includes(q) ||
        company.includes(q)
      );
    });
  }, [jobs, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<JobStatus, Job[]> = {
      queued: [],
      running: [],
      succeeded: [],
      failed: [],
      cancelled: [],
      dead_letter: [],
    };
    filtered.forEach((job) => {
      map[job.status].push(job);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Applications</h1>
          <p className="text-gray-600">Real application pipeline from your auto-apply jobs</p>
        </div>
        <button
          onClick={() => void load()}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-6 border-2 border-gray-200"
      >
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, job id, status..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("kanban")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                view === "kanban" ? "gradient-primary text-white shadow-md" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                view === "list" ? "gradient-primary text-white shadow-md" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              List
            </button>
          </div>
        </div>
      </motion.div>

      {error ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-500">Loading applications...</div> : null}

      {!loading && view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {columns.map((column) => (
            <div key={column.id} className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">{column.title}</h3>
                <span className={`px-2 py-1 text-xs rounded-full font-semibold ${column.badge}`}>{grouped[column.id].length}</span>
              </div>
              <div className="space-y-3">
                {grouped[column.id].map((job) => {
                  const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "Auto-Apply Job");
                  const company = String(job.criteriaJson?.company || "LinkedIn");
                  return (
                    <div key={job.id} className={`bg-white rounded-xl p-4 border ${column.card}`}>
                      <div className="font-semibold text-gray-900 text-sm">{title}</div>
                      <div className="text-xs text-gray-600 mt-1">{company}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
                        <Calendar className="w-3 h-3" />
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <FileText className="w-3 h-3" />
                        {job.id.slice(0, 10)}
                      </div>
                    </div>
                  );
                })}
                {grouped[column.id].length === 0 ? <div className="text-xs text-gray-400">No jobs</div> : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && view === "list" ? (
        <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
            <div className="col-span-4">Job</div>
            <div className="col-span-2">Company</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Created</div>
            <div className="col-span-2">Job ID</div>
          </div>
          {filtered.map((job) => {
            const title = String(job.criteriaJson?.title || job.criteriaJson?.keywords || "Auto-Apply Job");
            const company = String(job.criteriaJson?.company || "LinkedIn");
            const col = columns.find((c) => c.id === job.status);
            return (
              <div key={job.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-gray-100 text-sm">
                <div className="col-span-4 font-medium text-gray-900">{title}</div>
                <div className="col-span-2 text-gray-700">{company}</div>
                <div className="col-span-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold ${col?.badge || "bg-gray-100 text-gray-700"}`}>{job.status}</span>
                </div>
                <div className="col-span-2 text-gray-600">{new Date(job.createdAt).toLocaleDateString()}</div>
                <div className="col-span-2 text-gray-600">{job.id.slice(0, 10)}</div>
              </div>
            );
          })}
          {filtered.length === 0 ? <div className="px-4 py-6 text-sm text-gray-500">No applications found.</div> : null}
        </div>
      ) : null}
    </div>
  );
}
