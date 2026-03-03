import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Metrics = {
  users: number;
  activeSubscriptions: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: number;
  successRatePercent: number;
  otpSendFailures: number;
};

export default function AdminAnalytics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/metrics", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch metrics");
      setMetrics(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const cards = [
    { title: "Users", value: metrics?.users ?? 0 },
    { title: "Active Subscriptions", value: metrics?.activeSubscriptions ?? 0 },
    { title: "Jobs Total", value: metrics?.jobsTotal ?? 0 },
    { title: "Jobs Succeeded", value: metrics?.jobsSucceeded ?? 0 },
    { title: "Jobs Failed", value: metrics?.jobsFailed ?? 0 },
    { title: "Success Rate", value: `${metrics?.successRatePercent ?? 0}%` },
    { title: "OTP Send Failures", value: metrics?.otpSendFailures ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Analytics</h1>
          <p className="text-gray-600">Platform-wide backend metrics</p>
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
      {loading ? <div className="text-gray-500 text-sm">Loading analytics...</div> : null}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="text-sm text-gray-500">{card.title}</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
