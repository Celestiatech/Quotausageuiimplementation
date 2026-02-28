import { motion } from 'motion/react';
import {
  TrendingUp,
  Briefcase,
  Target,
  Clock,
  CheckCircle,
  ArrowRight,
  Star,
  Calendar,
  Zap,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Overview() {
  const { user } = useAuth();

  const stats = [
    {
      name: 'Active Applications',
      value: '12',
      change: '+2 this week',
      icon: Briefcase,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      name: 'Job Matches',
      value: '47',
      change: '+15 new',
      icon: Target,
      color: 'from-purple-500 to-pink-500'
    },
    {
      name: 'Interviews Scheduled',
      value: '3',
      change: 'Next: Tomorrow',
      icon: Calendar,
      color: 'from-green-500 to-emerald-500'
    },
    {
      name: 'Response Rate',
      value: '68%',
      change: '+12% vs last month',
      icon: TrendingUp,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const recentApplications = [
    {
      company: 'Google',
      position: 'Senior Software Engineer',
      status: 'Interview',
      date: '2 days ago',
      match: 95
    },
    {
      company: 'Meta',
      position: 'Full Stack Developer',
      status: 'Applied',
      date: '4 days ago',
      match: 88
    },
    {
      company: 'Amazon',
      position: 'Frontend Engineer',
      status: 'Reviewing',
      date: '1 week ago',
      match: 92
    }
  ];

  const upcomingInterviews = [
    {
      company: 'Microsoft',
      position: 'Software Engineer II',
      type: 'Technical Interview',
      time: 'Tomorrow at 2:00 PM',
      duration: '1 hour'
    },
    {
      company: 'Apple',
      position: 'iOS Developer',
      type: 'HR Round',
      time: 'Friday at 10:00 AM',
      duration: '30 mins'
    }
  ];

  const quickActions = [
    { icon: Target, label: 'Find Jobs', color: 'from-blue-500 to-cyan-500', href: '/dashboard/jobs' },
    { icon: Briefcase, label: 'Apply Now', color: 'from-purple-500 to-pink-500', href: '/dashboard/jobs' },
    { icon: Zap, label: 'Resume Check', color: 'from-green-500 to-emerald-500', href: '/dashboard/resume' },
    { icon: Users, label: 'Interview Prep', color: 'from-orange-500 to-red-500', href: '/dashboard/interview' }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-gray-600">Here's what's happening with your job search today.</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-green-600 font-semibold">{stat.change}</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.name}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Applications */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Applications</h2>
              <button className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1">
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {recentApplications.map((app, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-purple-700">
                      {app.company.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{app.position}</div>
                      <div className="text-sm text-gray-600">{app.company}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">{app.match}%</div>
                      <div className="text-xs text-gray-500">Match</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        app.status === 'Interview'
                          ? 'bg-green-100 text-green-700'
                          : app.status === 'Applied'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {app.status}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{app.date}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300 text-center"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                  <action.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-sm font-semibold text-gray-900">{action.label}</div>
              </button>
            ))}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Interviews */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" />
              <h3 className="font-bold">Upcoming Interviews</h3>
            </div>

            <div className="space-y-4">
              {upcomingInterviews.map((interview, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                  <div className="font-semibold mb-1">{interview.company}</div>
                  <div className="text-sm text-purple-100 mb-2">{interview.position}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{interview.time}</span>
                  </div>
                  <div className="text-xs text-purple-100 mt-2">{interview.type} • {interview.duration}</div>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 px-4 py-3 bg-white text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors">
              View Calendar
            </button>
          </motion.div>

          {/* Tips Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center">
                <Star className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900">Pro Tip</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Customize your resume for each application to increase your match score and callback rate by up to 3x!
            </p>
            <button className="text-purple-600 hover:text-purple-700 font-semibold text-sm flex items-center gap-1">
              Learn More
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
