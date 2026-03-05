import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

type PlanKey = "free" | "pro" | "coach";
type StatusKey = "trialing" | "active" | "past_due" | "cancelled" | "expired";

type RevenueData = {
  statusCounts: Record<StatusKey, number>;
  planCounts: Record<PlanKey, number>;
  activePlanCounts: Record<PlanKey, number>;
  planRevenueMonthly: Record<PlanKey, number>;
  mrr: number;
  arr: number;
  totalUsers: number;
  paidUsers: number;
  paidConversionPct: number;
  hiresRevenueInr: number;
  currency: string;
  activeSubscriptions: Array<{
    id: string;
    userId: string;
    plan: PlanKey;
    currentPeriodEnd?: string | null;
    updatedAt: string;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
    } | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const PAGE_LIMIT = 20;

const PLAN_META: Record<PlanKey, { label: string; chip: string; bar: string }> = {
  free: {
    label: "Free",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    bar: "bg-slate-400",
  },
  pro: {
    label: "Pro",
    chip: "bg-indigo-100 text-indigo-800 border-indigo-200",
    bar: "bg-indigo-500",
  },
  coach: {
    label: "Coach",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    bar: "bg-amber-500",
  },
};

const STATUS_META: Record<StatusKey, { label: string; color: string }> = {
  trialing: { label: "Trialing", color: "bg-blue-500" },
  active: { label: "Active", color: "bg-green-500" },
  past_due: { label: "Past Due", color: "bg-amber-500" },
  cancelled: { label: "Cancelled", color: "bg-rose-500" },
  expired: { label: "Expired", color: "bg-slate-500" },
};

function formatCurrency(value: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.max(0, Number(value || 0)));
  } catch {
    return `${Math.max(0, Number(value || 0)).toLocaleString()} ${currency}`;
  }
}

export default function Revenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (nextPage = page) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(PAGE_LIMIT),
      });
      const res = await fetch(`/api/admin/revenue?${params.toString()}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok || !body?.success) throw new Error(body?.message || "Failed to fetch revenue");
      setData(body.data as RevenueData);
      setPage(Number(body?.data?.pagination?.page || nextPage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch revenue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusTotal = useMemo(() => {
    const counts = (data?.statusCounts || {}) as Record<string, number>;
    return Object.values(counts).reduce((sum: number, value: number) => sum + Number(value || 0), 0);
  }, [data]);

  const maxPlanCount = useMemo(() => {
    const counts = data?.activePlanCounts || { free: 0, pro: 0, coach: 0 };
    return Math.max(1, counts.free || 0, counts.pro || 0, counts.coach || 0);
  }, [data]);

  const totalPages = Math.max(1, Number(data?.pagination?.totalPages || 1));
  const canPrev = page > 1 && !loading;
  const canNext = page < totalPages && !loading;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-cyan-900 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
              <TrendingUp className="h-3.5 w-3.5" />
              REVENUE ANALYTICS
            </div>
            <h1 className="mt-3 text-3xl font-bold">Revenue Dashboard</h1>
            <p className="mt-1 text-cyan-100">Track subscription performance, plan mix, and wallet top-up revenue.</p>
          </div>
          <button
            onClick={() => void load(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-100">MRR</div>
            <div className="mt-1 text-2xl font-bold">{formatCurrency(data?.mrr || 0, data?.currency || "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-100">ARR</div>
            <div className="mt-1 text-2xl font-bold">{formatCurrency(data?.arr || 0, data?.currency || "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-100">Hires Revenue</div>
            <div className="mt-1 text-2xl font-bold">{formatCurrency(data?.hiresRevenueInr || 0, data?.currency || "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-100">Paid Users</div>
            <div className="mt-1 text-2xl font-bold">{data?.paidUsers || 0}</div>
            <div className="text-xs text-cyan-100">{(data?.paidConversionPct || 0).toFixed(2)}% conversion</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-cyan-100">Past Due</div>
            <div className="mt-1 text-2xl font-bold">{data?.statusCounts?.past_due || 0}</div>
            <div className="text-xs text-cyan-100">Active: {data?.statusCounts?.active || 0}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {loading ? <div className="text-sm text-gray-500">Loading revenue...</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <CreditCard className="h-5 w-5 text-indigo-500" />
            Active Plan Mix
          </h2>
          <div className="space-y-4">
            {(Object.keys(PLAN_META) as PlanKey[]).map((plan) => {
              const count = Number(data?.activePlanCounts?.[plan] || 0);
              const revenue = Number(data?.planRevenueMonthly?.[plan] || 0);
              const pct = Math.round((count / maxPlanCount) * 100);
              return (
                <div key={plan}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-900">{PLAN_META[plan].label}</span>
                    <span className="text-gray-600">
                      {count} active | {formatCurrency(revenue, data?.currency || "INR")}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${PLAN_META[plan].bar}`}
                      style={{ width: `${Math.max(4, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Subscription Health
          </h2>
          <div className="space-y-3">
            {(Object.keys(STATUS_META) as StatusKey[]).map((status) => {
              const count = Number(data?.statusCounts?.[status] || 0);
              const pct = statusTotal > 0 ? Math.round((count / statusTotal) * 10000) / 100 : 0;
              return (
                <div key={status} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-gray-800">
                      <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[status].color}`} />
                      {STATUS_META[status].label}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {count} ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-gray-500">Total tracked subscriptions: {statusTotal}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Active Subscriptions</h2>
            <p className="text-sm text-gray-600">Latest active subscriptions with renewal timeline</p>
          </div>
          <div className="text-sm text-gray-600">
            Showing {(data?.activeSubscriptions || []).length} of {data?.pagination?.total || 0}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-white">
              <tr className="text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Period End</th>
                <th className="px-4 py-3 text-left font-semibold">Updated</th>
                <th className="px-4 py-3 text-left font-semibold">User ID</th>
              </tr>
            </thead>
            <tbody>
              {(data?.activeSubscriptions || []).map((sub) => (
                <tr key={sub.id} className="border-t border-gray-100 transition hover:bg-cyan-50/30">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-200 to-indigo-200 font-semibold text-indigo-900">
                        {String(sub.user?.name || sub.user?.email || "U").trim().charAt(0).toUpperCase() || "U"}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{sub.user?.name || "Unknown user"}</div>
                        <div className="text-xs text-gray-500">{sub.user?.email || "-"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${PLAN_META[sub.plan].chip}`}>
                      {PLAN_META[sub.plan].label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleString() : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-4">{new Date(sub.updatedAt).toLocaleString()}</td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-600">{sub.userId}</td>
                </tr>
              ))}
              {!loading && (data?.activeSubscriptions || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    No active subscriptions found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!canPrev) return;
                void load(page - 1);
              }}
              disabled={!canPrev}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => {
                if (!canNext) return;
                void load(page + 1);
              }}
              disabled={!canNext}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users className="h-4 w-4 text-indigo-500" />
            User Base
          </div>
          <div className="text-2xl font-bold text-gray-900">{data?.totalUsers || 0}</div>
          <div className="text-sm text-gray-600">Total users across free + paid plans</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Wallet className="h-4 w-4 text-emerald-500" />
            Revenue Notes
          </div>
          <div className="text-sm text-gray-700">
            MRR/ARR are estimated from currently active subscriptions. Hires revenue is calculated from posted wallet top-up credits.
          </div>
        </div>
      </div>
    </div>
  );
}
