import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Trash2, Users as UsersIcon } from "lucide-react";

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

const roleBadgeClass: Record<AdminUser["role"], string> = {
  admin: "bg-indigo-100 text-indigo-800 border-indigo-200",
  user: "bg-slate-100 text-slate-700 border-slate-200",
};

const planBadgeClass: Record<AdminUser["plan"], string> = {
  free: "bg-gray-100 text-gray-700 border-gray-200",
  pro: "bg-violet-100 text-violet-800 border-violet-200",
  coach: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

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

  const deleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(`Delete user ${user.email}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeletingUserId(user.id);
      setError("");
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to delete user");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

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

  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);
  const proOrCoachCount = useMemo(
    () => users.filter((u) => u.plan === "pro" || u.plan === "coach").length,
    [users],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
              <UsersIcon className="h-3.5 w-3.5" />
              ADMIN USERS
            </div>
            <h1 className="mt-3 text-3xl font-bold">User Management</h1>
            <p className="mt-1 text-indigo-100">Manage accounts, plans, and user access from one place.</p>
          </div>
          <button
            onClick={() => void loadUsers()}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Total Users</div>
            <div className="mt-1 text-2xl font-bold">{users.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Admins</div>
            <div className="mt-1 text-2xl font-bold">{adminCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-indigo-100">Paid Plans</div>
            <div className="mt-1 text-2xl font-bold">{proOrCoachCount}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, plan, role"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {loading ? <div className="text-sm text-gray-500">Loading users...</div> : null}

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
              <tr className="text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Daily Usage</th>
                <th className="px-4 py-3 text-left font-semibold">Hires</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const dailyPercent = Math.min(
                  100,
                  Math.round((u.dailyHireUsed / Math.max(1, u.dailyHireCap)) * 100),
                );

                return (
                  <tr key={u.id} className="border-t border-gray-100 transition hover:bg-indigo-50/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-200 to-cyan-200 font-semibold text-indigo-900">
                          {u.name?.trim()?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{u.name}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${roleBadgeClass[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${planBadgeClass[u.plan]}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>Used</span>
                        <span className="font-semibold text-gray-700">
                          {u.dailyHireUsed}/{u.dailyHireCap}
                        </span>
                      </div>
                      <div className="h-2 w-36 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                          style={{ width: `${dailyPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900">{u.hireBalance} available</div>
                      <div className="text-xs text-gray-500">spent {u.hireSpent} | purchased {u.hirePurchased}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-800">{new Date(u.createdAt).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{new Date(u.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => void deleteUser(u)}
                        disabled={deletingUserId === u.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingUserId === u.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
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
