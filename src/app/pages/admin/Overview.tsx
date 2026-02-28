import { motion } from 'motion/react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  Briefcase,
  FileText,
  CheckCircle
} from 'lucide-react';

export default function AdminOverview() {
  const stats = [
    {
      name: 'Total Users',
      value: '52,431',
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      name: 'Active Subscriptions',
      value: '12,845',
      change: '+8.2%',
      trend: 'up',
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500'
    },
    {
      name: 'Monthly Revenue',
      value: '$387,420',
      change: '+18.7%',
      trend: 'up',
      icon: DollarSign,
      color: 'from-purple-500 to-pink-500'
    },
    {
      name: 'System Uptime',
      value: '99.9%',
      change: '+0.1%',
      trend: 'up',
      icon: Activity,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const recentUsers = [
    {
      name: 'John Doe',
      email: 'john@example.com',
      plan: 'Pro',
      joined: '2 hours ago',
      status: 'active'
    },
    {
      name: 'Jane Smith',
      email: 'jane@example.com',
      plan: 'Free',
      joined: '5 hours ago',
      status: 'active'
    },
    {
      name: 'Mike Johnson',
      email: 'mike@example.com',
      plan: 'Coach',
      joined: '1 day ago',
      status: 'active'
    }
  ];

  const quickStats = [
    { label: 'Total Applications', value: '245,678' },
    { label: 'Active Jobs', value: '8,432' },
    { label: 'Success Rate', value: '68%' },
    { label: 'Avg Response Time', value: '2.4h' }
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening today.</p>
      </motion.div>

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
              <div className={`flex items-center gap-1 text-sm font-semibold ${
                stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
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
                key={index}
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
                    user.plan === 'Pro'
                      ? 'bg-purple-100 text-purple-700'
                      : user.plan === 'Coach'
                      ? 'bg-pink-100 text-pink-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {user.plan}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{user.joined}</div>
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
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">AI Service</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  Operational
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
