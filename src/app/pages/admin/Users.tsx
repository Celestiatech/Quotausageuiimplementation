import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw } from "lucide-react";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "coach";
  quotaUsed: number;
  quotaTotal: number;
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  dailyHireUsed: number;
  dailyHireCap: number;
  createdAt: string;
  updatedAt: string;
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to fetch users");
      setUsers(data?.data?.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.plan.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">User Management</h1>
          <p className="text-gray-600">Total users: {users.length}</p>
        </div>
        <button
          onClick={() => void loadUsers()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border-2 border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, plan, role"
            className="w-full pl-10 pr-4 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 outline-none"
          />
        </div>
      </div>

      {error ? <div className="text-red-600 text-sm">{error}</div> : null}
      {loading ? <div className="text-gray-500 text-sm">Loading users...</div> : null}

      <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Plan</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Daily</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Hires</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{u.name}</div>
                    <div className="text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3 uppercase">{u.plan}</td>
                  <td className="px-4 py-3">
                    {u.dailyHireUsed}/{u.dailyHireCap}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{u.hireBalance}</div>
                    <div className="text-xs text-gray-500">spent {u.hireSpent} · purchased {u.hirePurchased}</div>
                  </td>
                  <td className="px-4 py-3">{new Date(u.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No users found
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
