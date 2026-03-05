import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

type MeUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "coach";
  createdAt: string;
};

export default function AdminSettings() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [mailHealth, setMailHealth] = useState<{ success: boolean; message: string } | null>(null);
  const [allowedOriginsText, setAllowedOriginsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingOrigins, setSavingOrigins] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const parseOrigins = (raw: string) =>
    raw
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean);

  const originCount = useMemo(() => parseOrigins(allowedOriginsText).length, [allowedOriginsText]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      const [meRes, mailRes, extRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/auth/mail-health", { credentials: "include" }),
        fetch("/api/admin/settings/extension", { credentials: "include" }),
      ]);
      const [meData, mailData, extData] = await Promise.all([meRes.json(), mailRes.json(), extRes.json()]);
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
              One origin per line. Example: `http://localhost:3000` or `https://app.autoapplycv.in`.
            </p>
          </div>
          <div className="text-xs text-gray-500">{originCount} origin(s)</div>
        </div>

        <textarea
          value={allowedOriginsText}
          onChange={(e) => setAllowedOriginsText(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-mono"
          placeholder={"http://localhost:3000\nhttp://127.0.0.1:3000\nhttps://autoapplycv.in"}
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
    </div>
  );
}
