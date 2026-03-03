import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type RevenueData = {
  statusCounts: Record<string, number>;
  planCounts: Record<string, number>;
  mrr: number;
  arr: number;
  hiresRevenueInr: number;
  currency: string;
  activeSubscriptions: Array<{
    id: string;
    userId: string;
    plan: "free" | "pro" | "coach";
    currentPeriodEnd?: string | null;
    updatedAt: string;
  }>;
};

export default function Revenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/revenue", { credentials: "include" });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to fetch revenue");
      setData(body.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch revenue");
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Revenue Dashboard</h1>
          <p className="text-gray-600">Subscription and plan analytics</p>
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
      {loading ? <div className="text-gray-500 text-sm">Loading revenue...</div> : null}

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-sm text-gray-500">MRR</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {(data?.mrr ?? 0).toLocaleString()} {data?.currency || "INR"}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-sm text-gray-500">ARR</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {(data?.arr ?? 0).toLocaleString()} {data?.currency || "INR"}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-sm text-gray-500">Active Subs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{data?.statusCounts?.active ?? 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
          <div className="text-sm text-gray-500">Past Due</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{data?.statusCounts?.past_due ?? 0}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
        <div className="text-sm text-gray-500">Hires Revenue (all-time)</div>
        <div className="text-3xl font-bold text-gray-900 mt-1">
          {(data?.hiresRevenueInr ?? 0).toLocaleString()} {data?.currency || "INR"}
        </div>
        <div className="text-sm text-gray-500 mt-1">Calculated from posted wallet top-ups</div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Users by Plan</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Free</span><span>{data?.planCounts?.free ?? 0}</span></div>
            <div className="flex justify-between"><span>Pro</span><span>{data?.planCounts?.pro ?? 0}</span></div>
            <div className="flex justify-between"><span>Coach</span><span>{data?.planCounts?.coach ?? 0}</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Subscription Status</h2>
          <div className="space-y-2 text-sm">
            {Object.entries(data?.statusCounts || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="uppercase">{k}</span><span>{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
