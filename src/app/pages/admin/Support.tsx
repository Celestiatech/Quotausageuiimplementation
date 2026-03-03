import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type SupportData = {
  incidents: {
    failedEmails: Array<{ id: string; toEmail: string; errorMessage?: string | null; createdAt: string }>;
    failedJobs: Array<{ id: string; errorMessage?: string | null; updatedAt: string; user?: { email: string; name: string } }>;
  };
  auditLogs: Array<{ id: string; action: string; createdAt: string }>;
};

type ScreeningIssuesData = {
  pending: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    questionKey: string;
    questionLabel: string;
    validationMessage: string;
    updatedAt: string;
  }>;
  resolved: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    questionKey: string;
    questionLabel: string;
    validationMessage: string;
    updatedAt: string;
  }>;
  counts: {
    pending: number;
    resolved: number;
  };
};

export default function Support() {
  const [data, setData] = useState<SupportData | null>(null);
  const [screening, setScreening] = useState<ScreeningIssuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/support", { credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to fetch support data");
      setData(body.data);
      const issueRes = await fetch("/api/admin/screening/issues", { credentials: "include" });
      const issueBody = await issueRes.json();
      if (issueRes.ok && issueBody?.success) {
        setScreening(issueBody.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch support data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Support Incidents</h1>
          <p className="text-gray-600">Failed jobs, email failures, and audit feed</p>
        </div>
        <button
          onClick={() => void load()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div className="text-gray-500 text-sm">Loading support data...</div> : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Failed Jobs</h2>
          <div className="space-y-3 max-h-96 overflow-auto">
            {(data?.incidents?.failedJobs || []).map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-gray-200">
                <div className="text-sm font-semibold text-gray-900">{item.user?.email || "Unknown user"}</div>
                <div className="text-xs text-red-700 mt-1">{item.errorMessage || "No error message"}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(item.updatedAt).toLocaleString()}</div>
              </div>
            ))}
            {!loading && (data?.incidents?.failedJobs || []).length === 0 ? <div className="text-sm text-gray-500">No failed jobs</div> : null}
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Failed Emails</h2>
          <div className="space-y-3 max-h-96 overflow-auto">
            {(data?.incidents?.failedEmails || []).map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-gray-200">
                <div className="text-sm font-semibold text-gray-900">{item.toEmail}</div>
                <div className="text-xs text-red-700 mt-1">{item.errorMessage || "Unknown error"}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {!loading && (data?.incidents?.failedEmails || []).length === 0 ? <div className="text-sm text-gray-500">No failed emails</div> : null}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
        <h2 className="font-bold text-gray-900 mb-2">Fields Needing Improvement</h2>
        <p className="text-sm text-gray-600 mb-4">
          Questions where users got stuck in application forms and still need saved answers.
        </p>
        <div className="text-sm mb-3">
          Pending: <span className="font-semibold text-amber-700">{screening?.counts?.pending ?? 0}</span>
          {" · "}
          Resolved: <span className="font-semibold text-green-700">{screening?.counts?.resolved ?? 0}</span>
        </div>
        <div className="space-y-2 max-h-80 overflow-auto">
          {(screening?.pending || []).map((issue) => (
            <div key={`${issue.userId}:${issue.questionKey}`} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <div className="text-sm font-semibold text-gray-900">{issue.questionLabel}</div>
              <div className="text-xs text-gray-700">{issue.userEmail}</div>
              {issue.validationMessage ? <div className="text-xs text-amber-700 mt-1">{issue.validationMessage}</div> : null}
              <div className="text-xs text-gray-500 mt-1">{new Date(issue.updatedAt).toLocaleString()}</div>
            </div>
          ))}
          {!loading && (screening?.pending || []).length === 0 ? (
            <div className="text-sm text-gray-500">No pending field issues.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
