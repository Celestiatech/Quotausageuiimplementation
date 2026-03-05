import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Target,
  BarChart3,
  MessageSquare,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  User,
  CreditCard,
  ChevronDown,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasCompletedRequiredOnboarding } from 'src/lib/onboarding';
import { useExtensionPipelineStats } from '../hooks/useExtensionPipelineStats';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const extensionStats = useExtensionPipelineStats();
  const onboardingComplete = hasCompletedRequiredOnboarding(user) && Boolean(user?.onboardingCompleted);
  const dailyCap = Math.max(1, user?.dailyHireCap ?? 3);
  const mergedDailyUsed = Math.min(
    dailyCap,
    Math.max(user?.dailyHireUsed ?? 0, extensionStats.loaded ? extensionStats.appliedToday : 0)
  );
  const hireBalance = user?.hireBalance ?? 0;
  const freeLeft = user?.plan === 'free' ? Math.max(0, 3 - mergedDailyUsed) : 0;
  const spendableNow = user?.plan === 'pro' ? Number.MAX_SAFE_INTEGER : Math.max(0, hireBalance + freeLeft);
  const needsHires = spendableNow <= 0;

  useEffect(() => {
    const handler = () => {
      refreshUser().catch(() => {});
    };
    window.addEventListener('cp:extensionImported', handler);
    return () => window.removeEventListener('cp:extensionImported', handler);
  }, [refreshUser]);

  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Job Matches', href: '/dashboard/jobs', icon: Target },
    { name: 'Applications', href: '/dashboard/applications', icon: Briefcase },
    { name: 'Resume Builder', href: '/dashboard/resume', icon: FileText },
    { name: 'Interview Prep', href: '/dashboard/interview', icon: MessageSquare },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    onboardingComplete
      ? { name: 'Billing', href: '/dashboard/billing', icon: CreditCard }
      : { name: 'Onboarding', href: '/dashboard/onboarding', icon: FileText },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] relative overflow-hidden">
      {/* Ambient background (shared across all dashboard pages) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80rem_60rem_at_20%_10%,rgba(99,102,241,0.18)_0,transparent_55%),radial-gradient(70rem_50rem_at_80%_0%,rgba(139,92,246,0.18)_0,transparent_55%),radial-gradient(60rem_50rem_at_50%_100%,rgba(6,182,212,0.12)_0,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.15)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white/70 backdrop-blur-xl border-r border-white/50 shadow-[0_16px_40px_rgba(15,23,42,0.10)] z-50 transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/logos/android-chrome-192x192.png"
                alt="AutoApply CV"
                className="w-8 h-8 rounded-lg shadow-sm"
                loading="eager"
                decoding="async"
              />
              <span className="font-bold text-gradient">AutoApply CV</span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive
                      ? 'gradient-primary text-white shadow-md'
                      : 'text-gray-700 hover:bg-purple-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Card */}
          <div className="p-4 border-t border-gray-200">
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/60 transition-colors"
              >
                <img
                  src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'}
                  alt={user?.name}
                  className="w-10 h-10 rounded-full border border-white/60 shadow-sm"
                />
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-gray-900">{user?.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{user?.plan} Plan</div>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl shadow-[0_20px_40px_rgba(15,23,42,0.12)] overflow-hidden">
                  <Link
                    to="/dashboard/profile"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setProfileOpen(false)}
                  >
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Profile</span>
                  </Link>
                  <Link
                    to="/dashboard/billing"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    onClick={() => setProfileOpen(false)}
                  >
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Billing</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors border-t border-gray-200"
                  >
                    <LogOut className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium text-red-600">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64 relative z-10">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/60 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 max-w-2xl mx-auto px-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs, companies, or skills..."
                  className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-white/60 bg-white/70 backdrop-blur focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 transition-all outline-none shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link
                to="/dashboard/billing"
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg hover:shadow-md transition-all"
              >
                <Zap className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-semibold text-purple-700">
                  {user?.plan === 'pro' ? 'Unlimited' : `${hireBalance} Hires`}
                </span>
                <span className="text-xs text-purple-600">
                  {user?.plan === 'pro' ? '$3/mo' : `${mergedDailyUsed}/${dailyCap} free today`}
                </span>
                {needsHires ? (
                  <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                    Buy Hires
                  </span>
                ) : null}
              </Link>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
