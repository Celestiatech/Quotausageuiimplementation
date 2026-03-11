import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';
import { hasCompletedRequiredOnboarding } from 'src/lib/onboarding';
import { SeoManager } from './components/SeoManager';

// Layouts
import Root from './Root';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';

// Marketing Pages
import Home from './pages/Home';
import Product from './pages/Product';
import Features from './pages/Features';
import HowItWorks from './pages/HowItWorks';
import Pricing from './pages/Pricing';
import About from './pages/About';
import FAQ from './pages/FAQ';
import Roadmap from './pages/Roadmap';
import Careers from './pages/Careers';
import Contact from './pages/Contact';
import PressKit from './pages/PressKit';
import HelpCenter from './pages/HelpCenter';
import Community from './pages/Community';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import CookiePolicy from './pages/CookiePolicy';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import ExtensionDesign from './pages/ExtensionDesign';
import ThankYou from './pages/ThankYou';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import AdminLogin from './pages/AdminLogin';

// Dashboard Pages
import DashboardOverview from './pages/dashboard/Overview';
import Jobs from './pages/dashboard/Jobs';
import Applications from './pages/dashboard/Applications';
import Resume from './pages/dashboard/Resume';
import Interview from './pages/dashboard/Interview';
import DashboardAnalytics from './pages/dashboard/Analytics';
import Settings from './pages/dashboard/Settings';
import Profile from './pages/dashboard/Profile';
import Billing from './pages/dashboard/Billing';
import Onboarding from './pages/dashboard/Onboarding';

// Admin Pages
import AdminOverview from './pages/admin/Overview';
import Users from './pages/admin/Users';
import AdminAnalytics from './pages/admin/Analytics';
import AdminJobs from './pages/admin/Jobs';
import AdminApplications from './pages/admin/AdminApplications';
import Revenue from './pages/admin/Revenue';
import Support from './pages/admin/Support';
import Health from './pages/admin/Health';
import AdminSettings from './pages/admin/AdminSettings';
import AdminBlogs from './pages/admin/Blogs';
import AdminBlogEditor from './pages/admin/BlogEditor';

// Protected Route Components
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  const location = useLocation();
  if (isBootstrapping) return null;
  if (isAuthenticated && user?.role === 'admin' && location.pathname.startsWith('/dashboard')) {
    return <Navigate to="/login" replace />;
  }
  const onboardingComplete = hasCompletedRequiredOnboarding(user) && Boolean(user?.onboardingCompleted);
  if (isAuthenticated && user?.role === 'user' && !onboardingComplete && location.pathname !== '/dashboard/onboarding') {
    return <Navigate to="/dashboard/onboarding" replace />;
  }
  if (isAuthenticated && user?.role === 'user' && onboardingComplete && location.pathname === '/dashboard/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isBootstrapping } = useAuth();
  if (isBootstrapping) return null;
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SeoManager />
        <Routes>
          {/* Marketing Pages */}
          <Route path="/" element={<Root />}>
            <Route index element={<Home />} />
            <Route path="product" element={<Product />} />
            <Route path="features" element={<Features />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="about" element={<About />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="roadmap" element={<Roadmap />} />
            <Route path="careers" element={<Careers />} />
            <Route path="contact" element={<Contact />} />
            <Route path="press-kit" element={<PressKit />} />
            <Route path="help-center" element={<HelpCenter />} />
            <Route path="community" element={<Community />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms-of-service" element={<TermsOfService />} />
            <Route path="cookie-policy" element={<CookiePolicy />} />
            <Route path="extension-design" element={<ExtensionDesign />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="thank-you" element={<ThankYou />} />
          </Route>

          {/* Auth Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/signup" element={<Signup />} />

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardOverview />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="applications" element={<Applications />} />
            <Route path="resume" element={<Resume />} />
            <Route path="interview" element={<Interview />} />
            <Route path="analytics" element={<DashboardAnalytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="billing" element={<Billing />} />
            <Route path="onboarding" element={<Onboarding />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<Users />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="support" element={<Support />} />
            <Route path="health" element={<Health />} />
            <Route path="blogs" element={<AdminBlogs />} />
            <Route path="blogs/new" element={<AdminBlogEditor />} />
            <Route path="blogs/:id/edit" element={<AdminBlogEditor />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
