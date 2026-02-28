import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import Features from "./pages/Features";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import FAQ from "./pages/FAQ";
import ThankYou from "./pages/ThankYou";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Root from "./Root";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Dashboard Pages
import DashboardOverview from "./pages/dashboard/Overview";
import Jobs from "./pages/dashboard/Jobs";
import Applications from "./pages/dashboard/Applications";

// Admin Pages
import AdminOverview from "./pages/admin/Overview";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "features", Component: Features },
      { path: "how-it-works", Component: HowItWorks },
      { path: "pricing", Component: Pricing },
      { path: "about", Component: About },
      { path: "faq", Component: FAQ },
      { path: "thank-you", Component: ThankYou },
    ],
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: DashboardOverview },
      { path: "jobs", Component: Jobs },
      { path: "applications", Component: Applications },
      { path: "resume", Component: () => <div className="text-2xl font-bold">Resume Builder (Coming Soon)</div> },
      { path: "interview", Component: () => <div className="text-2xl font-bold">Interview Prep (Coming Soon)</div> },
      { path: "analytics", Component: () => <div className="text-2xl font-bold">Analytics (Coming Soon)</div> },
      { path: "settings", Component: () => <div className="text-2xl font-bold">Settings (Coming Soon)</div> },
    ],
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute adminOnly>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, Component: AdminOverview },
      { path: "users", Component: () => <div className="text-2xl font-bold">Users Management (Coming Soon)</div> },
      { path: "analytics", Component: () => <div className="text-2xl font-bold">Analytics (Coming Soon)</div> },
      { path: "jobs", Component: () => <div className="text-2xl font-bold">Jobs (Coming Soon)</div> },
      { path: "applications", Component: () => <div className="text-2xl font-bold">Applications (Coming Soon)</div> },
      { path: "revenue", Component: () => <div className="text-2xl font-bold">Revenue (Coming Soon)</div> },
      { path: "support", Component: () => <div className="text-2xl font-bold">Support (Coming Soon)</div> },
      { path: "health", Component: () => <div className="text-2xl font-bold">System Health (Coming Soon)</div> },
      { path: "settings", Component: () => <div className="text-2xl font-bold">Settings (Coming Soon)</div> },
    ],
  },
]);