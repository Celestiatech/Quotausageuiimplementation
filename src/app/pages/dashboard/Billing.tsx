import { useState } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard,
  Calendar,
  DollarSign,
  Download,
  Check,
  Crown,
  Zap,
  ArrowUpRight,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Billing() {
  const { user } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const invoices = [
    { id: 'INV-001', date: 'Feb 1, 2026', amount: 29.00, status: 'paid', plan: 'Pro' },
    { id: 'INV-002', date: 'Jan 1, 2026', amount: 29.00, status: 'paid', plan: 'Pro' },
    { id: 'INV-003', date: 'Dec 1, 2025', amount: 29.00, status: 'paid', plan: 'Pro' }
  ];

  const paymentMethods = [
    {
      type: 'Visa',
      last4: '4242',
      expiry: '12/2027',
      isDefault: true
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
        <p className="text-gray-600 mt-1">Manage your subscription and payment methods</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Current Plan */}
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Card */}
          <div className={`rounded-2xl p-8 border-2 ${
            user?.plan === 'free'
              ? 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
              : 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-300 text-white'
          }`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {user?.plan === 'free' ? (
                    <Zap className="w-8 h-8 text-gray-600" />
                  ) : (
                    <Crown className="w-8 h-8 text-white" />
                  )}
                  <h2 className="text-3xl font-bold capitalize">{user?.plan} Plan</h2>
                </div>
                <p className={user?.plan === 'free' ? 'text-gray-600' : 'text-purple-100'}>
                  {user?.plan === 'free'
                    ? 'Start your job search with essential features'
                    : 'Unlock unlimited Auto-Apply and advanced features'}
                </p>
              </div>
              {user?.plan === 'free' && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-6 py-3 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                >
                  Upgrade
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-4 rounded-xl ${
                user?.plan === 'free' ? 'bg-white border border-gray-200' : 'bg-white/10 backdrop-blur-sm border border-white/20'
              }`}>
                <div className={`text-2xl font-bold mb-1 ${user?.plan === 'free' ? 'text-gray-900' : 'text-white'}`}>
                  {user?.plan === 'free' ? '3/day' : 'Unlimited'}
                </div>
                <div className={`text-sm ${user?.plan === 'free' ? 'text-gray-600' : 'text-purple-100'}`}>
                  Auto-Apply
                </div>
              </div>

              <div className={`p-4 rounded-xl ${
                user?.plan === 'free' ? 'bg-white border border-gray-200' : 'bg-white/10 backdrop-blur-sm border border-white/20'
              }`}>
                <div className={`text-2xl font-bold mb-1 ${user?.plan === 'free' ? 'text-gray-900' : 'text-white'}`}>
                  ${user?.plan === 'free' ? '0' : '29'}
                </div>
                <div className={`text-sm ${user?.plan === 'free' ? 'text-gray-600' : 'text-purple-100'}`}>
                  per month
                </div>
              </div>

              <div className={`p-4 rounded-xl ${
                user?.plan === 'free' ? 'bg-white border border-gray-200' : 'bg-white/10 backdrop-blur-sm border border-white/20'
              }`}>
                <div className={`text-2xl font-bold mb-1 ${user?.plan === 'free' ? 'text-gray-900' : 'text-white'}`}>
                  {user?.plan === 'free' ? 'Basic' : 'Advanced'}
                </div>
                <div className={`text-sm ${user?.plan === 'free' ? 'text-gray-600' : 'text-purple-100'}`}>
                  Features
                </div>
              </div>

              <div className={`p-4 rounded-xl ${
                user?.plan === 'free' ? 'bg-white border border-gray-200' : 'bg-white/10 backdrop-blur-sm border border-white/20'
              }`}>
                <div className={`text-2xl font-bold mb-1 ${user?.plan === 'free' ? 'text-gray-900' : 'text-white'}`}>
                  Active
                </div>
                <div className={`text-sm ${user?.plan === 'free' ? 'text-gray-600' : 'text-purple-100'}`}>
                  Status
                </div>
              </div>
            </div>

            {user?.plan !== 'free' && (
              <div className="mt-6 pt-6 border-t border-white/20 flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm mb-1">Next billing date</p>
                  <p className="font-semibold">March 1, 2026</p>
                </div>
                <button className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-semibold hover:bg-white/20 transition-colors">
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Methods
              </h3>
              <button className="px-4 py-2 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-lg font-semibold hover:shadow-lg transition-all">
                Add New
              </button>
            </div>

            <div className="space-y-4">
              {paymentMethods.map((method, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#A855F7] flex items-center justify-center text-white font-bold shadow-lg">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {method.type} •••• {method.last4}
                      </div>
                      <div className="text-sm text-gray-600">Expires {method.expiry}</div>
                    </div>
                  </div>
                  {method.isDefault && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      Default
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Billing History */}
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Billing History
            </h3>

            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 hover:bg-purple-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{invoice.id}</div>
                      <div className="text-sm text-gray-600">
                        {invoice.date} • {invoice.plan} Plan
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ${invoice.amount.toFixed(2)}
                      </div>
                      <div className="text-sm text-green-600 capitalize">{invoice.status}</div>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Download className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upgrade Benefits */}
          {user?.plan === 'free' && (
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
              <Crown className="w-10 h-10 mb-4" />
              <h3 className="text-xl font-bold mb-2">Upgrade to Pro</h3>
              <p className="text-purple-100 text-sm mb-6">
                Unlock unlimited Auto-Apply and advanced features to accelerate your job search
              </p>

              <ul className="space-y-3 mb-6">
                {[
                  'Unlimited Auto-Apply',
                  'Advanced AI matching',
                  'Resume optimization',
                  'Interview prep tools',
                  'Priority support'
                ].map((benefit, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>

              <button className="w-full px-4 py-3 bg-white text-purple-700 rounded-xl font-semibold hover:bg-purple-50 transition-colors">
                Upgrade Now
              </button>
            </div>
          )}

          {/* Security Badge */}
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Secure Payments</h3>
              <p className="text-sm text-gray-600">
                All transactions are encrypted and secured with industry-standard SSL
              </p>
            </div>
          </div>

          {/* Help Card */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-purple-100">
            <h3 className="font-bold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Contact our support team for billing questions
            </p>
            <button className="w-full px-4 py-2 bg-white text-purple-700 rounded-lg font-semibold hover:bg-purple-50 transition-colors border border-purple-200">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
