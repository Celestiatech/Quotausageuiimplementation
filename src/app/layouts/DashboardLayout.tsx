import { useEffect, useRef, useState } from 'react';
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
  Zap,
  PlayCircle,
  Mail,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasCompletedRequiredOnboarding } from 'src/lib/onboarding';
import { useExtensionPipelineStats } from '../hooks/useExtensionPipelineStats';
import {
  DASHBOARD_TOUR_JOBS_EXTENSION,
  DASHBOARD_TOUR_ONBOARDING_EXTENSION,
  queueDashboardTourRequest,
} from 'src/lib/dashboard-tour';

export default function DashboardLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const primaryTourId = onboardingComplete ? DASHBOARD_TOUR_JOBS_EXTENSION : DASHBOARD_TOUR_ONBOARDING_EXTENSION;
  const primaryTourRoute = onboardingComplete ? '/dashboard/jobs' : '/dashboard/onboarding';

  useEffect(() => {
    const handler = () => {
      refreshUser().catch(() => {});
    };
    window.addEventListener('cp:extensionImported', handler);
    return () => window.removeEventListener('cp:extensionImported', handler);
  }, [refreshUser]);

  // Close dropdowns on outside click or route change
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Top navigation menu items
  const navigation = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Auto Apply', href: '/dashboard/jobs/linkedin', icon: Target, matchPrefix: '/dashboard/jobs' },
    { name: 'Apply Email', href: '/dashboard/cold-emails', icon: Mail, matchPrefix: '/dashboard/cold-emails' },
    {
      name: 'Recruitment Agency',
      href: 'https://recruitment.autoapplycv.in/index.html',
      icon: Users,
      isExternal: true,
    },
    { name: 'Applications', href: '/dashboard/applications', icon: Briefcase },
    { name: 'Resume', href: '/dashboard/resume', icon: FileText },
    { name: 'Interview', href: '/dashboard/interview', icon: MessageSquare },
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

  const handleStartTour = () => {
    queueDashboardTourRequest(primaryTourId);
    if (location.pathname !== primaryTourRoute) {
      navigate(primaryTourRoute);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] relative overflow-hidden flex flex-col">
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80rem_60rem_at_20%_10%,rgba(99,102,241,0.18)_0,transparent_55%),radial-gradient(70rem_50rem_at_80%_0%,rgba(139,92,246,0.18)_0,transparent_55%),radial-gradient(60rem_50rem_at_50%_100%,rgba(6,182,212,0.12)_0,transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.15)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      {/* Dashboard Top Navigation & Layout — Fully Responsive on Desktop & Mobile */}
      <div className="flex flex-col min-h-screen relative z-10 w-full">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-xs">
          {/* Main Top Row */}
          <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
              {/* Brand Logo */}
              <div className="flex items-center gap-4 sm:gap-6">
                <Link to="/" className="flex items-center gap-2 group">
                  <img
                    src="/logos/android-chrome-192x192.png"
                    alt="AutoApply CV"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl shadow-xs transition-transform group-hover:scale-105 shrink-0"
                    loading="eager"
                    decoding="async"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm sm:text-base text-gradient leading-none">AutoApply CV</span>
                    <span className="text-[9px] sm:text-[10px] text-gray-400 font-semibold tracking-wider uppercase mt-0.5 hidden xs:block">Dashboard</span>
                  </div>
                </Link>
              </div>

              {/* Search Bar */}
              <div className="flex-1 max-w-md mx-auto hidden lg:block">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search jobs, applications, skills..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/70 focus:bg-white focus:border-purple-300 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Right Action Group */}
              <div className="flex items-center gap-1.5 sm:gap-3">
                {/* Tour Button */}
                <button
                  type="button"
                  onClick={handleStartTour}
                  className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2 sm:px-3 py-1.5 text-xs font-semibold text-sky-700 transition-all hover:border-sky-300 hover:bg-sky-100 hover:shadow-xs"
                  title="Start Interactive Tour"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden sm:inline">Tour</span>
                </button>

                {/* Hires Badge */}
                <Link
                  to="/dashboard/billing"
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl hover:shadow-xs hover:border-purple-300 transition-all shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span className="text-xs font-bold text-purple-700">
                    {user?.plan === 'pro' ? 'Unlimited' : `${hireBalance} Hires`}
                  </span>
                  <span className="text-[11px] text-purple-600 hidden xl:inline">
                    {user?.plan === 'pro' ? '$3/mo' : `(${mergedDailyUsed}/${dailyCap} free today)`}
                  </span>
                  {needsHires ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
                      Buy
                    </span>
                  ) : null}
                </Link>

                {/* Notifications */}
                <button
                  type="button"
                  aria-label="Notifications"
                  className="relative p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>

                {/* User Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2.5 p-1 pl-2 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all"
                  >
                    <img
                      src={user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'}
                      alt={user?.name || 'User'}
                      className="w-7 h-7 rounded-lg object-cover border border-purple-200 shadow-2xs"
                    />
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-semibold text-gray-800 leading-tight max-w-[100px] truncate">
                        {user?.name || 'My Account'}
                      </div>
                      <div className="text-[10px] text-purple-600 font-medium capitalize leading-tight">
                        {user?.plan || 'free'} plan
                      </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Profile Menu Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-900 truncate">{user?.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <Link
                        to="/dashboard/profile"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        to="/dashboard/billing"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span>Billing</span>
                      </Link>
                      <Link
                        to="/dashboard/settings"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        <span>Settings</span>
                      </Link>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Mobile Toggle Button for tablet view */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Top Horizontal Menu Bar (One-Word Items & Smooth Mobile Horizontal Scroll) */}
          <div className="border-t border-gray-200/60 bg-white/50 backdrop-blur-md relative z-30">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
              <nav className="flex items-center gap-1.5 py-2 overflow-x-auto scrollbar-none flex-nowrap" ref={dropdownRef}>
                {navigation.map((item) => {
                  const hasChildren = Array.isArray((item as any).children) && (item as any).children.length > 0;
                  const isMatchPrefix = (item as any).matchPrefix && location.pathname.startsWith((item as any).matchPrefix);
                  const isChildrenMatch = (item as any).children?.some((child: { href: string }) => location.pathname === child.href);
                  const isDirectMatch = location.pathname === item.href;
                  const isGroupActive = isDirectMatch || isMatchPrefix || isChildrenMatch;
                  const isDropdownOpen = openDropdown === item.name;

                  if (!hasChildren) {
                    if ((item as any).isExternal) {
                      return (
                        <a
                          key={item.name}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-900 border border-purple-200 shadow-2xs transition-all duration-200"
                        >
                          <item.icon className="w-3.5 h-3.5 text-purple-600" />
                          <span>{item.name}</span>
                          <ExternalLink className="w-3 h-3 text-purple-500 opacity-80" />
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                          isDirectMatch
                            ? 'gradient-primary text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-purple-50/70'
                        }`}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  }

                  const children = (item as any).children as Array<{ name: string; href: string }>;

                  return (
                    <div
                      key={item.name}
                      className="relative"
                      onMouseEnter={() => setOpenDropdown(item.name)}
                      onMouseLeave={() => setOpenDropdown(null)}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(isDropdownOpen ? null : item.name)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                          isGroupActive
                            ? 'bg-purple-100 text-purple-800 font-bold border border-purple-200 shadow-2xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-purple-50/70'
                        }`}
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        <span>{item.name}</span>
                        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 z-50 ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-150">
                          {children.map((child) => {
                            const childActive = location.pathname === child.href;
                            return (
                              <Link
                                key={child.name}
                                to={child.href}
                                onClick={() => setOpenDropdown(null)}
                                className={`flex items-center justify-between px-3.5 py-2 text-xs font-semibold transition-colors ${
                                  childActive
                                    ? 'bg-purple-50 text-purple-700 font-bold'
                                    : 'text-gray-700 hover:bg-purple-50/60 hover:text-purple-700'
                                }`}
                              >
                                <span>{child.name}</span>
                                {childActive && <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Tablet/Mobile Slide-down Navigation Panel */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-200 bg-white/95 backdrop-blur-xl px-4 py-4 space-y-2">
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {navigation.map((item) => {
                  const hasChildren = Array.isArray((item as any).children) && (item as any).children.length > 0;
                  const isActive = location.pathname === item.href;

                  if (!hasChildren) {
                    if ((item as any).isExternal) {
                      return (
                        <a
                          key={item.name}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="w-4 h-4 text-purple-600" />
                            <span>{item.name}</span>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
                        </a>
                      );
                    }

                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
                          isActive ? 'gradient-primary text-white' : 'text-gray-700 hover:bg-purple-50'
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  }

                  const children = (item as any).children as Array<{ name: string; href: string }>;
                  return (
                    <div key={item.name} className="col-span-2 space-y-1 bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                      <div className="text-[11px] font-bold text-gray-500 uppercase px-2">{item.name}</div>
                      <div className="flex flex-wrap gap-1">
                        {children.map((child) => (
                          <Link
                            key={child.name}
                            to={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                              location.pathname === child.href
                                ? 'bg-purple-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-purple-50'
                            }`}
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </header>

        {/* Page Content Container (Full Width, Responsive Padding) */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
