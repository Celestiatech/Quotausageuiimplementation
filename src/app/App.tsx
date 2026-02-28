import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import Root from './Root';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';

// Marketing Pages
import Home from './pages/Home';
import Features from './pages/Features';
import HowItWorks from './pages/HowItWorks';
import Pricing from './pages/Pricing';
import About from './pages/About';
import FAQ from './pages/FAQ';
import ThankYou from './pages/ThankYou';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Dashboard Pages
import DashboardOverview from './pages/dashboard/Overview';
import Jobs from './pages/dashboard/Jobs';
import Applications from './pages/dashboard/Applications';
import Resume from './pages/dashboard/Resume';
import Interview from './pages/dashboard/Interview';
import DashboardAnalytics from './pages/dashboard/Analytics';
import Settings from './pages/dashboard/Settings';

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

// Protected Route Components
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Marketing Pages */}
          <Route path="/" element={<Root />}>
            <Route index element={<Home />} />
            <Route path="features" element={<Features />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="about" element={<About />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="thank-you" element={<ThankYou />} />
          </Route>

          {/* Auth Pages */}
          <Route path="/login" element={<Login />} />
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
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
