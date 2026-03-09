import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";

type MeUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "coach";
  createdAt: string;
};

type AdminDiscountCode = {
  id: string;
  code: string;
  description?: string | null;
  type: "percent" | "flat_rupees";
  target: "all" | "wallet_topup" | "plan_pro" | "plan_coach";
  percentOff?: number | null;
  flatAmountRupees?: number | null;
  maxDiscountRupees?: number | null;
  minOrderRupees?: number | null;
  usageLimitTotal?: number | null;
  usageLimitPerUser?: number | null;
  usedCount: number;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DiscountForm = {
  code: string;
  description: string;
  type: "percent" | "flat_rupees";
  target: "all" | "wallet_topup" | "plan_pro" | "plan_coach";
  percentOff: string;
  flatAmountRupees: string;
  maxDiscountRupees: string;
  minOrderRupees: string;
  usageLimitTotal: string;
  usageLimitPerUser: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const EMPTY_DISCOUNT_FORM: DiscountForm = {
  code: "",
  description: "",
  type: "percent",
  target: "wallet_topup",
  percentOff: "10",
  flatAmountRupees: "",
  maxDiscountRupees: "",
  minOrderRupees: "50",
  usageLimitTotal: "",
  usageLimitPerUser: "1",
  startsAt: "",
  endsAt: "",
  active: true,
};

export default function AdminSettings() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [mailHealth, setMailHealth] = useState<{ success: boolean; message: string } | null>(null);
  const [allowedOriginsText, setAllowedOriginsText] = useState("");
  const [discountCodes, setDiscountCodes] = useState<AdminDiscountCode[]>([]);
  const [discountForm, setDiscountForm] = useState<DiscountForm>(EMPTY_DISCOUNT_FORM);
  const [loading, setLoading] = useState(true);
  const [savingOrigins, setSavingOrigins] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [updatingDiscountId, setUpdatingDiscountId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const parseOrigins = (raw: string) =>
    raw
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

  const parseNumber = (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return undefined;
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) return undefined;
    return Math.floor(asNumber);
  };

  const originCount = useMemo(() => parseOrigins(allowedOriginsText).length, [allowedOriginsText]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const [meRes, mailRes, extRes, discountRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/auth/mail-health", { credentials: "include" }),
        fetch("/api/admin/settings/extension", { credentials: "include" }),
        fetch("/api/admin/discount-codes?limit=200", { credentials: "include" }),
      ]);
      const [meData, mailData, extData, discountData] = await Promise.all([
        meRes.json(),
        mailRes.json(),
        extRes.json(),
        discountRes.json(),
      ]);
      if (meRes.ok && meData?.success) setUser(meData?.data?.user || meData?.user);
      setMailHealth({
        success: Boolean(mailData?.success),
        message: mailData?.message || "Unknown mail health result",
      });
      if (extRes.ok && extData?.success) {
        const origins = Array.isArray(extData?.data?.allowedDashboardOrigins)
          ? extData.data.allowedDashboardOrigins.map((v: unknown) => String(v || ""))
          : [];
        setAllowedOriginsText(origins.join("\n"));
      }
      if (discountRes.ok && discountData?.success) {
        const codes = Array.isArray(discountData?.data?.codes)
          ? (discountData.data.codes as AdminDiscountCode[])
          : [];
        setDiscountCodes(codes);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveAllowedOrigins = async () => {
    try {
      setSavingOrigins(true);
      setError("");
      setSuccess("");
      const payload = { allowedDashboardOrigins: parseOrigins(allowedOriginsText) };
      const res = await fetch("/api/admin/settings/extension", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to save extension origins");

      const origins = Array.isArray(data?.data?.allowedDashboardOrigins)
        ? data.data.allowedDashboardOrigins.map((v: unknown) => String(v || ""))
        : [];
      setAllowedOriginsText(origins.join("\n"));
      setSuccess("Extension allowed origins saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save extension origins");
    } finally {
      setSavingOrigins(false);
    }
  };

  const createDiscountCode = async () => {
    try {
      setSavingDiscount(true);
      setError("");
      setSuccess("");

      const payload: Record<string, unknown> = {
        code: discountForm.code.trim(),
        description: discountForm.description.trim(),
        type: discountForm.type,
        target: discountForm.target,
        active: discountForm.active,
        startsAt: discountForm.startsAt || "",
        endsAt: discountForm.endsAt || "",
      };

      if (discountForm.type === "percent") {
        payload.percentOff = parseNumber(discountForm.percentOff);
      } else {
        payload.flatAmountRupees = parseNumber(discountForm.flatAmountRupees);
      }

      const maxDiscount = parseNumber(discountForm.maxDiscountRupees);
      const minOrder = parseNumber(discountForm.minOrderRupees);
      const usageLimitTotal = parseNumber(discountForm.usageLimitTotal);
      const usageLimitPerUser = parseNumber(discountForm.usageLimitPerUser);

      if (maxDiscount !== undefined) payload.maxDiscountRupees = maxDiscount;
      if (minOrder !== undefined) payload.minOrderRupees = minOrder;
      if (usageLimitTotal !== undefined) payload.usageLimitTotal = usageLimitTotal;
      if (usageLimitPerUser !== undefined) payload.usageLimitPerUser = usageLimitPerUser;

      const res = await fetch("/api/admin/discount-codes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to create discount code");

      setDiscountForm(EMPTY_DISCOUNT_FORM);
      setSuccess("Discount code created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create discount code");
    } finally {
      setSavingDiscount(false);
    }
  };

  const toggleDiscountCode = async (codeId: string, active: boolean) => {
    try {
      setUpdatingDiscountId(codeId);
      setError("");
      setSuccess("");
      const res = await fetch(`/api/admin/discount-codes/${codeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to update discount code");
      setSuccess(`Discount code ${active ? "enabled" : "disabled"}.`);
      setDiscountCodes((prev) => prev.map((item) => (item.id === codeId ? { ...item, active } : item)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update discount code");
    } finally {
      setUpdatingDiscountId("");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Admin Settings</h1>
          <p className="text-gray-600">Environment checks and extension dashboard URL controls</p>
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
      {success ? <div className="text-green-700 text-sm">{success}</div> : null}
      {loading ? <div className="text-gray-500 text-sm">Loading settings...</div> : null}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Session</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Name:</span> {user?.name || "-"}</div>
            <div><span className="text-gray-500">Email:</span> {user?.email || "-"}</div>
            <div><span className="text-gray-500">Role:</span> {user?.role || "-"}</div>
            <div><span className="text-gray-500">Plan:</span> {user?.plan || "-"}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h2 className="font-bold text-gray-900 mb-4">Mail Provider</h2>
          <div className={`text-sm font-semibold ${mailHealth?.success ? "text-green-700" : "text-amber-700"}`}>
            {mailHealth?.success ? "Healthy" : "Needs Attention"}
          </div>
          <div className="text-xs text-gray-500 mt-2">{mailHealth?.message || "-"}</div>
          <p className="text-xs text-gray-400 mt-4">
            SMTP credentials can be rotated from `.env` without app code changes.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Extension Dashboard Origins</h2>
            <p className="text-xs text-gray-500 mt-1">
              One origin per line. Example: `https://autoapplycv.in` or `http://localhost:3000`.
            </p>
          </div>
          <div className="text-xs text-gray-500">{originCount} origin(s)</div>
        </div>

        <textarea
          value={allowedOriginsText}
          onChange={(e) => setAllowedOriginsText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-mono"
          placeholder={"https://autoapplycv.in\nhttp://localhost:3000\nhttp://127.0.0.1:3000\nhttps://autoapplycv.vercel.app"}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => void saveAllowedOrigins()}
            disabled={savingOrigins}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {savingOrigins ? "Saving..." : "Save Origins"}
          </button>
          <span className="text-xs text-gray-500">Extension picks this up on next page refresh/check.</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Discount Codes</h2>
            <p className="text-xs text-gray-500 mt-1">
              Create wallet/plan discount codes and enable or disable them instantly.
            </p>
          </div>
          <div className="text-xs text-gray-500">{discountCodes.length} code(s)</div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Code</label>
            <input
              value={discountForm.code}
              onChange={(e) =>
                setDiscountForm((prev) => ({ ...prev, code: String(e.target.value || "").toUpperCase() }))
              }
              placeholder="WELCOME10"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold tracking-wide"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <input
              value={discountForm.description}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="First purchase offer"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
            <select
              value={discountForm.type}
              onChange={(e) =>
                setDiscountForm((prev) => ({ ...prev, type: e.target.value as DiscountForm["type"] }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="percent">Percent (%)</option>
              <option value="flat_rupees">Flat (INR)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Target</label>
            <select
              value={discountForm.target}
              onChange={(e) =>
                setDiscountForm((prev) => ({ ...prev, target: e.target.value as DiscountForm["target"] }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="wallet_topup">Wallet Top-up</option>
              <option value="all">All</option>
              <option value="plan_pro">Plan Pro</option>
              <option value="plan_coach">Plan Coach</option>
            </select>
          </div>
          {discountForm.type === "percent" ? (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Percent Off</label>
              <input
                type="number"
                min={1}
                max={95}
                value={discountForm.percentOff}
                onChange={(e) => setDiscountForm((prev) => ({ ...prev, percentOff: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Flat Amount (INR)</label>
              <input
                type="number"
                min={1}
                value={discountForm.flatAmountRupees}
                onChange={(e) => setDiscountForm((prev) => ({ ...prev, flatAmountRupees: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Max Discount (INR, optional)</label>
            <input
              type="number"
              min={1}
              value={discountForm.maxDiscountRupees}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, maxDiscountRupees: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Min Order (INR, optional)</label>
            <input
              type="number"
              min={1}
              value={discountForm.minOrderRupees}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, minOrderRupees: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Total Usage Limit (optional)</label>
            <input
              type="number"
              min={1}
              value={discountForm.usageLimitTotal}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, usageLimitTotal: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Per-user Limit (optional)</label>
            <input
              type="number"
              min={1}
              value={discountForm.usageLimitPerUser}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, usageLimitPerUser: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Starts At (optional)</label>
            <input
              type="datetime-local"
              value={discountForm.startsAt}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, startsAt: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ends At (optional)</label>
            <input
              type="datetime-local"
              value={discountForm.endsAt}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, endsAt: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={discountForm.active}
              onChange={(e) => setDiscountForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            Active on create
          </label>
          <button
            onClick={() => void createDiscountCode()}
            disabled={savingDiscount}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {savingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Discount
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Code</th>
                <th className="text-left px-3 py-2">Value</th>
                <th className="text-left px-3 py-2">Target</th>
                <th className="text-left px-3 py-2">Usage</th>
                <th className="text-left px-3 py-2">Validity</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {discountCodes.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-semibold text-gray-900">
                    {item.code}
                    {item.description ? <div className="text-xs text-gray-500 font-normal mt-0.5">{item.description}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {item.type === "percent" ? `${item.percentOff || 0}%` : `INR ${item.flatAmountRupees || 0}`}
                    {item.maxDiscountRupees ? <div className="text-xs text-gray-500">max INR {item.maxDiscountRupees}</div> : null}
                    {item.minOrderRupees ? <div className="text-xs text-gray-500">min INR {item.minOrderRupees}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{item.target}</td>
                  <td className="px-3 py-2 text-gray-700">
                    used {item.usedCount}
                    <div className="text-xs text-gray-500">
                      total {item.usageLimitTotal ?? "unlimited"} / user {item.usageLimitPerUser ?? "unlimited"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    <div className="text-xs">
                      {item.startsAt ? `From ${new Date(item.startsAt).toLocaleString()}` : "Starts immediately"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.endsAt ? `Until ${new Date(item.endsAt).toLocaleString()}` : "No expiry"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold border ${
                        item.active
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      {item.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => void toggleDiscountCode(item.id, !item.active)}
                      disabled={updatingDiscountId === item.id}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-semibold disabled:opacity-60"
                    >
                      {updatingDiscountId === item.id
                        ? "Saving..."
                        : item.active
                        ? "Disable"
                        : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
              {discountCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                    No discount codes yet.
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
