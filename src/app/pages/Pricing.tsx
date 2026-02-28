import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Zap, Crown, Users, ArrowRight, Sparkles, Shield, Clock } from 'lucide-react';

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const navigate = useNavigate();

  const plans = [
    {
      name: 'Free',
      icon: Zap,
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: 'Perfect for getting started',
      features: [
        '3 Auto-Apply actions per day',
        'Basic job matching',
        'Application tracker',
        'Resume builder',
        'Community support',
        'Email notifications'
      ],
      cta: 'Start Free',
      popular: false,
      gradient: 'from-gray-600 to-gray-700'
    },
    {
      name: 'Pro',
      icon: Crown,
      monthlyPrice: 29,
      yearlyPrice: 290,
      description: 'For serious job seekers',
      features: [
        'Unlimited Auto-Apply',
        'Advanced AI job matching',
        'AI resume optimization',
        'Interview preparation tools',
        'Weekly analytics dashboard',
        'Priority support',
        'Cover letter generator',
        'LinkedIn profile optimizer',
        'Salary negotiation guide'
      ],
      cta: 'Start Pro Trial',
      popular: true,
      gradient: 'from-[#6366F1] via-[#8B5CF6] to-[#A855F7]',
      badge: '50% OFF - Limited Time!'
    },
    {
      name: 'Coach',
      icon: Users,
      monthlyPrice: 149,
      yearlyPrice: 1490,
      description: 'For career coaches & agencies',
      features: [
        'Everything in Pro',
        'Manage up to 20 clients',
        'Team collaboration tools',
        'White-label options',
        'Advanced analytics',
        'API access',
        'Dedicated account manager',
        'Custom integrations',
        'Priority onboarding'
      ],
      cta: 'Contact Sales',
      popular: false,
      gradient: 'from-purple-600 to-pink-600'
    }
  ];

  const handleSelectPlan = (planName: string) => {
    if (planName === 'Coach') {
      // Navigate to contact or show modal
      window.location.href = 'mailto:sales@careerpilot.com';
      return;
    }
    // Navigate to signup page with plan parameter
    navigate(`/signup?plan=${planName.toLowerCase()}`);
  };

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSIjOEI1Q0Y2IiBzdHJva2Utd2lkdGg9IjAuNSIgb3BhY2l0eT0iMC4xIi8+PC9nPjwvc3ZnPg==')] opacity-40"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative text-center">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4 inline mr-2" />
            Simple, Transparent Pricing
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Find the perfect plan{' '}
            <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
              for your needs
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Start free, upgrade when you need more. All plans include our core features to help you land your dream job.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 bg-white rounded-full p-2 shadow-lg border border-gray-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2.5 rounded-full font-semibold transition-all duration-200 relative ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-3xl p-8 transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white shadow-2xl scale-105 border-4 border-purple-300'
                    : 'bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 px-6 py-2 rounded-full text-sm font-bold shadow-lg">
                    {plan.badge}
                  </div>
                )}

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <plan.icon className="w-8 h-8 text-white" />
                </div>

                {/* Plan Name */}
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`mb-6 ${plan.popular ? 'text-purple-100' : 'text-gray-600'}`}>
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-5xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                      ${billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                    </span>
                    <span className={plan.popular ? 'text-purple-100' : 'text-gray-600'}>
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && plan.yearlyPrice > 0 && (
                    <p className={`text-sm mt-2 ${plan.popular ? 'text-purple-100' : 'text-gray-500'}`}>
                      Billed ${plan.yearlyPrice} annually
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'bg-white/20' : 'bg-green-100'
                      }`}>
                        <Check className={`w-3 h-3 ${plan.popular ? 'text-white' : 'text-green-600'}`} />
                      </div>
                      <span className={plan.popular ? 'text-purple-50' : 'text-gray-700'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full py-4 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-white text-purple-700 hover:bg-gray-100 shadow-lg'
                      : 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Compare all features
            </h2>
            <p className="text-xl text-gray-600">
              Choose the plan that fits your career goals
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-50 to-blue-50">
                  <tr>
                    <th className="px-6 py-5 text-left text-gray-900 font-bold">Feature</th>
                    <th className="px-6 py-5 text-center text-gray-900 font-bold">Free</th>
                    <th className="px-6 py-5 text-center bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white font-bold">
                      Pro
                    </th>
                    <th className="px-6 py-5 text-center text-gray-900 font-bold">Coach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[
                    { feature: 'Auto-Apply Actions', free: '3/day', pro: 'Unlimited', coach: 'Unlimited' },
                    { feature: 'AI Resume Optimization', free: 'Basic', pro: 'Advanced', coach: 'Advanced' },
                    { feature: 'Job Match Score', free: '✓', pro: '✓', coach: '✓' },
                    { feature: 'Application Tracker', free: '✓', pro: '✓', coach: '✓' },
                    { feature: 'Interview Prep', free: '—', pro: '✓', coach: '✓' },
                    { feature: 'Analytics Dashboard', free: '—', pro: '✓', coach: 'Advanced' },
                    { feature: 'Priority Support', free: '—', pro: '✓', coach: '✓' },
                    { feature: 'Client Management', free: '—', pro: '—', coach: 'Up to 20' },
                    { feature: 'API Access', free: '—', pro: '—', coach: '✓' }
                  ].map((row, index) => (
                    <tr key={index} className="hover:bg-purple-50/30 transition-colors">
                      <td className="px-6 py-4 text-gray-900 font-medium">{row.feature}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{row.free}</td>
                      <td className="px-6 py-4 text-center bg-purple-50 font-semibold text-purple-700">
                        {row.pro}
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">{row.coach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently asked questions
            </h2>
            <p className="text-xl text-gray-600">
              Have more questions? Visit our{' '}
              <button 
                onClick={() => navigate('/faq')}
                className="text-purple-600 hover:text-purple-700 font-semibold underline"
              >
                FAQ page
              </button>
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                q: 'Can I switch plans later?',
                a: 'Yes! You can upgrade, downgrade, or cancel your plan at any time. Changes take effect immediately.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and bank transfers for annual plans.'
              },
              {
                q: 'Is there a refund policy?',
                a: 'Yes, we offer a 14-day money-back guarantee on all paid plans. No questions asked.'
              }
            ].map((faq, index) => (
              <div key={index} className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-6 border border-purple-100">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            Join 50,000+ Engineers
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Start your journey today
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            No credit card required for free plan. Upgrade anytime.
          </p>

          <button 
            onClick={() => handleSelectPlan('Free')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-12 pt-12 border-t border-white/20">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Secure Payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm">14-Day Money Back</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">Cancel Anytime</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}