import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  Calendar,
  FileText,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  LayoutGrid,
  List,
} from "lucide-react";
import { useExtensionPipelineStats } from "../../hooks/useExtensionPipelineStats";
import { buildJobSourceUrl, cleanJobText, inferJobProvider, jobProviderLabel, parseExternalJobId } from "src/lib/job-source";

type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "dead_letter";
type DisplayStatus = JobStatus | "skipped";
type View = "kanban" | "list";

type Job = {
  id: string;
  status: JobStatus;
  createdAt: string;
  errorMessage?: string | null;
  criteriaJson?: Record<string, unknown>;
};

type PreparedJob = Job & {
  title: string;
  company: string;
  reason: string;
  provider: "linkedin" | "indeed";
  sourceLabel: string;
  sourceUrl: string;
  externalJobId: string;
  displayStatus: DisplayStatus;
  createdLabel: string;
};

type ColumnDef = {
  id: JobStatus;
  title: string;
  badgeClass: string;
  borderClass: string;
  panelClass: string;
};

const columns: ColumnDef[] = [
  {
    id: "queued",
    title: "Queued",
    badgeClass: "text-violet-700 bg-violet-100 border-violet-200",
    borderClass: "border-violet-200",
    panelClass: "bg-violet-50/60",
  },
  {
    id: "running",
    title: "Running",
    badgeClass: "text-sky-700 bg-sky-100 border-sky-200",
    borderClass: "border-sky-200",
    panelClass: "bg-sky-50/60",
  },
  {
    id: "succeeded",
    title: "Submitted",
    badgeClass: "text-emerald-700 bg-emerald-100 border-emerald-200",
    borderClass: "border-emerald-200",
    panelClass: "bg-emerald-50/60",
  },
  {
    id: "cancelled",
    title: "Skipped",
    badgeClass: "text-amber-700 bg-amber-100 border-amber-200",
    borderClass: "border-amber-200",
    panelClass: "bg-amber-50/60",
  },
  {
    id: "failed",
    title: "Failed",
    badgeClass: "text-rose-700 bg-rose-100 border-rose-200",
    borderClass: "border-rose-200",
    panelClass: "bg-rose-50/60",
  },
  {
    id: "dead_letter",
    title: "Dead Letter",
    badgeClass: "text-red-700 bg-red-100 border-red-200",
    borderClass: "border-red-200",
    panelClass: "bg-red-50/60",
  },
];

const STATUS_BADGES: Record<DisplayStatus, string> = {
  queued: "text-violet-700 bg-violet-100 border-violet-200",
  running: "text-sky-700 bg-sky-100 border-sky-200",
  succeeded: "text-emerald-700 bg-emerald-100 border-emerald-200",
  failed: "text-rose-700 bg-rose-100 border-rose-200",
  cancelled: "text-amber-700 bg-amber-100 border-amber-200",
  skipped: "text-amber-700 bg-amber-100 border-amber-200",
  dead_letter: "text-red-700 bg-red-100 border-red-200",
};

const REASON_CODE_LABELS: Record<string, string> = {
  NO_APPLY_BUTTON: "No Easy Apply button",
  APPLIED_CACHE_HIT: "Already applied earlier",
  RECENTLY_RETRIED: "Skipped: recently retried",
  EASY_APPLY_MODAL_MISSING: "Easy Apply form not opened",
  MAX_SKIPS_REACHED: "Skipped: max skips reached",
  REQUIRED_CUSTOM_FIELDS: "Pending user input",
  PENDING_USER_INPUT: "Pending user input",
};

function formatReasonCode(value: unknown) {
  const raw = cleanJobText(value);
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (REASON_CODE_LABELS[upper]) return REASON_CODE_LABELS[upper];
  return raw
    .toLowerCase()
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeJobTitle(value: unknown) {
  let text = cleanJobText(value);
  if (!text) return "Auto-Apply Job";
  text = text.replace(/\s+with verification$/i, "");
  const doubledNoSpace = text.match(/^(.{4,}?)\1$/i);
  if (doubledNoSpace?.[1]) text = cleanJobText(doubledNoSpace[1]);
  const doubledWithSpace = text.match(/^(.{4,}?)\s+\1$/i);
  if (doubledWithSpace?.[1]) text = cleanJobText(doubledWithSpace[1]);
  return text || "Auto-Apply Job";
}

function getJobReason(job: Job) {
  const code = cleanJobText(job.criteriaJson?.reasonCode);
  const explicit = cleanJobText(job.criteriaJson?.reason || job.errorMessage);
  if (code) return formatReasonCode(code);
  if (explicit) return explicit;
  return "";
}

function getDisplayStatus(job: Job): DisplayStatus {
  if (job.status === "cancelled") return "skipped";
  return job.status;
}

function statusLabel(value: DisplayStatus) {
  if (value === "succeeded") return "submitted";
  if (value === "dead_letter") return "dead letter";
  return value;
}

function JobActions({
  sourceUrl,
  sourceLabel,
  externalJobId,
  copiedJobId,
  onCopy,
  compact = false,
}: {
  sourceUrl: string;
  sourceLabel: string;
  externalJobId: string;
  copiedJobId: string;
  onCopy: (jobId: string) => Promise<void>;
  compact?: boolean;
}) {
  const isCopied = copiedJobId === externalJobId;
  const sizeClass = compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-xs";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={!sourceUrl}
        onClick={() => {
          if (!sourceUrl) return;
          window.open(sourceUrl, "_blank", "noopener,noreferrer");
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors ${sizeClass} ${
          sourceUrl
            ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        title={sourceUrl ? `Open on ${sourceLabel}` : `${sourceLabel} link not available`}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {sourceLabel}
      </button>

      <button
        type="button"
        disabled={!externalJobId}
        onClick={() => void onCopy(externalJobId)}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors ${sizeClass} ${
          externalJobId
            ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            : "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
        }`}
        title={externalJobId ? `Copy ${sourceLabel} Job ID` : "Job ID not available"}
      >
        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        {isCopied ? "Copied" : "Copy ID"}
      </button>
    </div>
  );
}

export default function Applications() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<View>("kanban");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedJobId, setCopiedJobId] = useState("");
  const extensionStats = useExtensionPipelineStats();

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

  useEffect(() => {
    const onImported = () => void load();
    window.addEventListener("cp:extensionImported", onImported);
    return () => window.removeEventListener("cp:extensionImported", onImported);
  }, []);

  const prepared = useMemo<PreparedJob[]>(() => {
    return jobs.map((job) => {
      const provider = inferJobProvider(job.criteriaJson);
      const sourceUrl = buildJobSourceUrl(job.criteriaJson, provider);
      return {
        ...job,
        title: normalizeJobTitle(job.criteriaJson?.title || job.criteriaJson?.keywords),
        company: cleanJobText(job.criteriaJson?.company) || jobProviderLabel(provider),
        reason: getJobReason(job),
        provider,
        sourceLabel: jobProviderLabel(provider),
        sourceUrl,
        externalJobId:
          parseExternalJobId(job.criteriaJson?.jobId, provider) ||
          parseExternalJobId(job.criteriaJson?.externalJobId, provider) ||
          parseExternalJobId(sourceUrl, provider),
        displayStatus: getDisplayStatus(job),
        createdLabel: new Date(job.createdAt).toLocaleDateString(),
      };
    });
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return prepared;
    return prepared.filter((job) => {
      return (
        job.id.toLowerCase().includes(q) ||
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.reason.toLowerCase().includes(q) ||
        statusLabel(job.displayStatus).toLowerCase().includes(q) ||
        job.externalJobId.toLowerCase().includes(q)
      );
    });
  }, [prepared, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<JobStatus, PreparedJob[]> = {
      queued: [],
      running: [],
      succeeded: [],
      failed: [],
      cancelled: [],
      dead_letter: [],
    };
    for (const job of filtered) map[job.status].push(job);
    return map;
  }, [filtered]);

  const summary = useMemo(() => {
    return {
      total: prepared.length,
      submitted: prepared.filter((job) => job.status === "succeeded").length,
      failed: prepared.filter((job) => job.status === "failed" || job.status === "dead_letter").length,
      skipped: prepared.filter((job) => job.status === "cancelled").length,
    };
  }, [prepared]);

  const copyJobId = async (externalJobId: string) => {
    if (!externalJobId) return;
    try {
      await navigator.clipboard.writeText(externalJobId);
      setCopiedJobId(externalJobId);
      window.setTimeout(() => setCopiedJobId(""), 1400);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-600 mt-1">Real application pipeline from your auto-apply jobs.</p>
          {extensionStats.loaded ? (
            <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
              <span className="font-semibold text-gray-700">Extension live:</span>
              <span>Applied {extensionStats.applied}</span>
              <span>Skipped {extensionStats.skipped}</span>
              <span>Failed {extensionStats.failed}</span>
            </div>
          ) : null}
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="rounded-2xl border border-gray-200 bg-white p-4"
      >
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, status, reason, or job id..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none"
            />
          </div>
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              onClick={() => setView("kanban")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                view === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors ${
                view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>
        </div>
      </motion.div>

      {error ? <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div> : null}
      {loading ? <div className="text-sm text-gray-500">Loading applications...</div> : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total Tracked</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs uppercase tracking-wide text-emerald-700">Submitted</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{summary.submitted}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs uppercase tracking-wide text-rose-700">Failed</div>
          <div className="text-2xl font-bold text-rose-800 mt-1">{summary.failed}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-700">Skipped</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{summary.skipped}</div>
        </div>
      </div>

      {!loading && view === "kanban" ? (
        <div className="overflow-x-auto pb-1">
          <div className="grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-4 min-w-max">
            {columns.map((column) => (
              <section key={column.id} className={`rounded-2xl border ${column.borderClass} ${column.panelClass} p-3`}>
                <header className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full border font-semibold ${column.badgeClass}`}>
                    {grouped[column.id].length}
                  </span>
                </header>

                <div className="space-y-3">
                  {grouped[column.id].map((job) => (
                    <article key={job.id} className={`rounded-xl border ${column.borderClass} bg-white p-3 shadow-sm`}>
                      <h4 className="font-semibold text-gray-900 leading-snug">{job.title}</h4>
                      <div className="text-sm text-gray-600 mt-1">{job.company}</div>
                      {job.reason ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                          <span className="font-semibold">Reason:</span> {job.reason}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {job.createdLabel}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${
                            STATUS_BADGES[job.displayStatus]
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {statusLabel(job.displayStatus)}
                        </span>
                      </div>
                      <div className="mt-3">
                        <JobActions
                          sourceUrl={job.sourceUrl}
                          sourceLabel={job.sourceLabel}
                          externalJobId={job.externalJobId}
                          copiedJobId={copiedJobId}
                          onCopy={copyJobId}
                          compact
                        />
                      </div>
                    </article>
                  ))}
                  {grouped[column.id].length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white/70 px-3 py-4 text-sm text-gray-500">
                      No jobs in this stage.
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && view === "list" ? (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="md:hidden divide-y divide-gray-100">
            {filtered.map((job) => (
              <article key={job.id} className="p-4 space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-900 leading-snug">{job.title}</h4>
                  <div className="text-sm text-gray-600 mt-1">{job.company}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGES[job.displayStatus]}`}>
                    {statusLabel(job.displayStatus)}
                  </span>
                  <span className="text-xs text-gray-500">{job.createdLabel}</span>
                  {job.externalJobId ? <span className="text-xs text-gray-500">ID: {job.externalJobId}</span> : null}
                </div>

                {job.reason ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    <span className="font-semibold">Reason:</span> {job.reason}
                  </div>
                ) : null}

                <JobActions
                  sourceUrl={job.sourceUrl}
                  sourceLabel={job.sourceLabel}
                  externalJobId={job.externalJobId}
                  copiedJobId={copiedJobId}
                  onCopy={copyJobId}
                />
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Job</th>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Reason</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Job ID</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => (
                  <tr key={job.id} className="border-b border-gray-100 text-sm">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[320px] whitespace-normal break-words">{job.title}</td>
                    <td className="px-4 py-3 text-gray-700">{job.company}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_BADGES[job.displayStatus]}`}>
                        {statusLabel(job.displayStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-amber-700 max-w-[280px] whitespace-normal break-words">{job.reason || "-"}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.createdLabel}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{job.externalJobId || "-"}</td>
                    <td className="px-4 py-3">
                      <JobActions
                        sourceUrl={job.sourceUrl}
                        sourceLabel={job.sourceLabel}
                        externalJobId={job.externalJobId}
                        copiedJobId={copiedJobId}
                        onCopy={copyJobId}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">No applications found for the current search.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
