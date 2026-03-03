import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type HealthData = {
  db: { healthy: boolean; message: string };
  mail: { healthy: boolean; message: string };
  queue: { enabled: boolean; healthy: boolean; message: string };
  timestamp: string;
};

export default function Health() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/system/health", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch system health");
      setHealth(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch system health");
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">System Health</h1>
          <p className="text-gray-600">Database, SMTP, and queue health checks</p>
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
      {loading ? <div className="text-gray-500 text-sm">Loading health data...</div> : null}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <div className="text-sm text-gray-500 mb-2">Database</div>
          <div className={`text-xl font-bold ${health?.db.healthy ? "text-green-700" : "text-red-700"}`}>
            {health?.db.healthy ? "Operational" : "Degraded"}
          </div>
          <div className="text-xs text-gray-500 mt-2">{health?.db.message}</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <div className="text-sm text-gray-500 mb-2">Mail</div>
          <div className={`text-xl font-bold ${health?.mail.healthy ? "text-green-700" : "text-amber-700"}`}>
            {health?.mail.healthy ? "Operational" : "Needs Attention"}
          </div>
          <div className="text-xs text-gray-500 mt-2">{health?.mail.message}</div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <div className="text-sm text-gray-500 mb-2">Queue</div>
          <div className={`text-xl font-bold ${health?.queue.healthy ? "text-green-700" : "text-amber-700"}`}>
            {health?.queue.healthy ? "Operational" : "Fallback Mode"}
          </div>
          <div className="text-xs text-gray-500 mt-2">{health?.queue.message}</div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : "-"}
      </div>
    </div>
  );
}
