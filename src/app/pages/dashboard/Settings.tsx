import { useState } from "react";
import { useNavigate } from "react-router";
import { Bell, Shield, User, CreditCard, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    product: true,
    jobAlerts: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage your account and dashboard preferences.</p>
        </div>
        <button
          onClick={() => void refreshUser()}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh User
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Account Snapshot
            </h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Name</div>
                <div className="font-semibold text-gray-900">{user?.name || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Email</div>
                <div className="font-semibold text-gray-900">{user?.email || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Plan</div>
                <div className="font-semibold text-gray-900 capitalize">{user?.plan || "-"}</div>
              </div>
              <div>
                <div className="text-gray-500">Onboarding</div>
                <div className="font-semibold text-gray-900">{user?.onboardingCompleted ? "Completed" : "Pending"}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              Notification Preferences (Local)
            </h2>
            <div className="space-y-3">
              {[
                { key: "email", label: "Email notifications" },
                { key: "product", label: "Product updates" },
                { key: "jobAlerts", label: "Job alerts" },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[item.key as keyof typeof notifications]}
                    onChange={(e) => setNotifications((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">These toggles are currently local UI preferences.</p>
          </div>

          <div className="bg-white rounded-2xl border-2 border-red-200 p-6">
            <h2 className="font-bold text-red-700 mb-3">Session</h2>
            <button
              onClick={() => logout()}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => navigate("/dashboard/profile")}
            className="w-full bg-white rounded-2xl border-2 border-gray-200 p-4 text-left hover:border-purple-300 transition-colors"
          >
            <div className="font-semibold text-gray-900">Edit Profile</div>
            <div className="text-sm text-gray-600">Update name, phone, city and links</div>
          </button>
          <button
            onClick={() => navigate("/dashboard/onboarding")}
            className="w-full bg-white rounded-2xl border-2 border-gray-200 p-4 text-left hover:border-purple-300 transition-colors"
          >
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              Onboarding
            </div>
            <div className="text-sm text-gray-600">Complete required fields and resume</div>
          </button>
          <button
            onClick={() => navigate("/dashboard/billing")}
            className="w-full bg-white rounded-2xl border-2 border-gray-200 p-4 text-left hover:border-purple-300 transition-colors"
          >
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-600" />
              Billing
            </div>
            <div className="text-sm text-gray-600">Manage billing and Hires wallet</div>
          </button>
        </div>
      </div>
    </div>
  );
}
