import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [meRes, mailRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/auth/mail-health", { credentials: "include" }),
      ]);
      const [meData, mailData] = await Promise.all([meRes.json(), mailRes.json()]);
      if (meRes.ok && meData?.success) setUser(meData?.data?.user || meData?.user);
      setMailHealth({
        success: Boolean(mailData?.success),
        message: mailData?.message || "Unknown mail health result",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Admin Settings</h1>
          <p className="text-gray-600">Environment checks and admin session details</p>
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
    </div>
  );
}
