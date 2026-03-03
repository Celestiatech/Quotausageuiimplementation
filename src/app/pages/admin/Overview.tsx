import { motion } from 'motion/react';
import {
  Users,
  DollarSign,
  Activity,
  Briefcase,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useEffect, useState } from 'react';

type Metrics = {
  users: number;
  activeSubscriptions: number;
  jobsTotal: number;
  jobsSucceeded: number;
  jobsFailed: number;
  successRatePercent: number;
};

type Health = {
  db: { healthy: boolean; message: string };
  mail: { healthy: boolean; message: string };
  queue: { enabled: boolean; healthy: boolean; message: string };
  timestamp: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'coach';
  createdAt: string;
};

export default function AdminOverview() {
  const [metrics, setMetrics] = useState<Metrics>({
    users: 0,
    activeSubscriptions: 0,
    jobsTotal: 0,
    jobsSucceeded: 0,
    jobsFailed: 0,
    successRatePercent: 0,
  });
  const [health, setHealth] = useState<Health | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, hRes, uRes] = await Promise.all([
        fetch('/api/admin/metrics', { credentials: 'include' }),
        fetch('/api/admin/system/health', { credentials: 'include' }),
        fetch('/api/admin/users', { credentials: 'include' }),
      ]);
      const [mData, hData, uData] = await Promise.all([mRes.json(), hRes.json(), uRes.json()]);
      if (mRes.ok && mData?.success) setMetrics(mData.data);
      if (hRes.ok && hData?.success) setHealth(hData.data);
      if (uRes.ok && uData?.success) setRecentUsers((uData.data.users || []).slice(0, 5));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = [
    {
      name: 'Total Users',
      value: String(metrics.users),
      change: 'live',
      icon: Users,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      name: 'Active Subscriptions',
      value: String(metrics.activeSubscriptions),
      change: 'live',
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500'
    },
    {
      name: 'Success Rate',
      value: `${metrics.successRatePercent}%`,
      change: 'live',
      icon: DollarSign,
      color: 'from-purple-500 to-pink-500'
    },
    {
      name: 'System Health',
      value: health?.db.healthy && health?.mail.healthy ? 'Healthy' : 'Warning',
      change: loading ? 'loading' : 'live',
      icon: Activity,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const quickStats = [
    { label: 'Total Jobs', value: String(metrics.jobsTotal) },
    { label: 'Succeeded Jobs', value: String(metrics.jobsSucceeded) },
    { label: 'Failed Jobs', value: String(metrics.jobsFailed) },
    { label: 'Success Rate', value: `${metrics.successRatePercent}%` }
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Live platform metrics and system status.</p>
      </motion.div>
      <button
        onClick={() => void load()}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold inline-flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Refresh
      </button>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:shadow-xl transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase">
                {stat.change}
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.name}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white rounded-2xl p-6 border-2 border-gray-200"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Sign-ups</h2>
          <div className="space-y-4">
            {recentUsers.map((user, index) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-purple-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-purple-700">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    user.plan === 'pro'
                      ? 'bg-purple-100 text-purple-700'
                      : user.plan === 'coach'
                      ? 'bg-pink-100 text-pink-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.plan.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(user.createdAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
            <h3 className="font-bold mb-6">Platform Stats</h3>
            <div className="space-y-4">
              {quickStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-purple-100">{stat.label}</span>
                  <span className="font-bold text-xl">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">API</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  health?.db.healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {health?.db.healthy ? 'Operational' : 'Degraded'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  health?.db.healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {health?.db.healthy ? 'Operational' : 'Degraded'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Mail</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  health?.mail.healthy ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {health?.mail.healthy ? 'Operational' : 'Needs Attention'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
