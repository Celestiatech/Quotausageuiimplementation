import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Application = {
  id: string;
  title?: string | null;
  company?: string | null;
  status: "submitted" | "skipped" | "failed";
  submittedAt: string;
  user: { id: string; name: string; email: string; plan: string };
};

export default function AdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [counts, setCounts] = useState({ submitted: 0, skipped: 0, failed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/applications", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch applications");
      setApplications(data?.data?.applications || []);
      setCounts(data?.data?.counts || { submitted: 0, skipped: 0, failed: 0, total: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Application Management</h1>
          <p className="text-gray-600">Submitted applications across all users</p>
        </div>
        <button
          onClick={() => void loadData()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200"><div className="text-xs text-gray-500">Total</div><div className="text-2xl font-bold">{counts.total}</div></div>
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200"><div className="text-xs text-gray-500">Submitted</div><div className="text-2xl font-bold text-green-700">{counts.submitted}</div></div>
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200"><div className="text-xs text-gray-500">Skipped</div><div className="text-2xl font-bold text-amber-700">{counts.skipped}</div></div>
        <div className="bg-white rounded-xl p-4 border-2 border-gray-200"><div className="text-xs text-gray-500">Failed</div><div className="text-2xl font-bold text-red-700">{counts.failed}</div></div>
      </div>

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div className="text-gray-500 text-sm">Loading applications...</div> : null}

      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Application</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{app.title || "Untitled role"}</div>
                    <div className="text-gray-500">{app.company || "Unknown company"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{app.user?.name}</div>
                    <div className="text-gray-500">{app.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 uppercase">{app.status}</td>
                  <td className="px-4 py-3">{new Date(app.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && applications.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No applications found</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
