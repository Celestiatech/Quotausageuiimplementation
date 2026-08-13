import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, X, Zap, Crown, Users, ArrowRight, Sparkles, Shield, Clock, Briefcase } from 'lucide-react';
import { MediaSlot } from '../components/marketing/MediaSlot';

type Plan = {
  name: string;
  icon: typeof Zap;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
  gradient: string;
  badge?: string;
  customPriceLabel?: string;
};

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const navigate = useNavigate();
  const mediaAssets = {
    billingEvidenceImageSrc: '/marketing/billing-evidence.png',
    billingEvidenceVideoSrc: '',
  };

  const plans: Plan[] = [
    {
      name: 'Free',
      icon: Zap,
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: 'Starter access with daily apply limit',
      features: [
        '3 Auto-Apply actions per day',
        '300 Hires coins signup bonus',
        'Basic job matching',
        'Application tracker',
        'Resume builder',
        'Community support',
        'Email notifications'
      ],
      cta: 'Start Free',
      popular: false,
      gradient: 'from-gray-500 to-gray-600'
    },
    {
      name: 'Pro',
      icon: Crown,
      monthlyPrice: 99,
      yearlyPrice: 999,
      description: 'Unlimited applications with premium automation',
      features: [
        'Unlimited Auto-Apply',
        'Advanced AI job matching',
        'AI resume builder & optimization',
        'Interview preparation AI tools',
        'Weekly analytics dashboard',
        'Priority support (24hr)',
        'Cover letter generator',
        'LinkedIn profile optimizer',
        'Salary negotiation guide'
      ],
      cta: 'Start Pro',
      popular: true,
      gradient: 'from-[#6366F1] via-[#8B5CF6] to-[#A855F7]',
      badge: 'MOST POPULAR'
    },
    {
      name: 'Coach',
      icon: Briefcase,
      monthlyPrice: 299,
      yearlyPrice: 2999,
      description: 'For career coaches & multi-client management',
      features: [
        'Everything in Pro',
        '200 Auto-Apply per day',
        'Multi-client dashboard',
        'Shared templates & workflows',
        'Progress tracking per client',
        'Team collaboration tools',
        'White-label options',
        'Dedicated account manager'
      ],
      cta: 'Start Coach',
      popular: false,
      gradient: 'from-orange-500 to-pink-500',
      badge: 'FOR COACHES'
    },
    {
      name: 'Pay-As-You-Go',
      icon: Users,
      monthlyPrice: 0,
      yearlyPrice: 0,
      customPriceLabel: '₹50 min top-up',
      description: 'Buy hires, no monthly commitment',
      features: [
        'Buy only what you need',
        '1 Hire = 1 Apply',
        'Minimum top-up ₹50',
        'Works with daily cap controls',
        'No monthly subscription',
        'Great for occasional use'
      ],
      cta: 'Go to Hires Wallet',
      popular: false,
      gradient: 'from-emerald-500 to-teal-500'
    }
  ];

  const billingRules = [
    { event: 'Application submitted successfully', charged: true, note: 'Counts as 1 apply action or 1 Hire credit.' },
    { event: 'Skipped: External Apply only', charged: false, note: 'Not counted when easy-apply-only is enabled.' },
    { event: 'Skipped: Already applied / cache hit', charged: false, note: 'Duplicate prevention avoids repeat charging.' },
    { event: 'Skipped: Validation error (form blocked)', charged: false, note: 'Run pauses and asks for corrected answer.' },
    { event: 'Paused/stopped by operator before submit', charged: false, note: 'No submit means no charge event.' },
  ];

  const handleSelectPlan = (planName: string) => {
    if (planName === 'Pay-As-You-Go') {
      navigate('/dashboard/billing');
      return;
    }
    navigate(`/signup?plan=${planName.toLowerCase().replace(/\s+/g, '-')}`);
  };

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative text-center">
          <div className="inline-block px-4 py-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4 inline mr-2" />
            Simple Pricing
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Start free, upgrade <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">when ready</span>
          </h1>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Free plan with 3 applies/day. Pro at ₹99/mo unlimited. Coach at ₹299/mo for teams. Or pay-as-you-go.
          </p>

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
              <span className="absolute -top-2 -right-4 text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded-full">SAVE</span>
            </button>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-3xl p-6 transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white shadow-2xl scale-105 border-4 border-purple-300'
                    : 'bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl'
                }`}
              >
                {plan.badge && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg whitespace-nowrap ${
                    plan.popular
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900'
                      : plan.name === 'Coach'
                      ? 'bg-gradient-to-r from-orange-400 to-pink-400 text-white'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                  <plan.icon className="w-7 h-7 text-white" />
                </div>

                <h3 className={`text-xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <p className={`mb-5 text-sm ${plan.popular ? 'text-purple-100' : 'text-gray-600'}`}>{plan.description}</p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    {plan.customPriceLabel ? (
                      <span className={`text-2xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>{plan.customPriceLabel}</span>
                    ) : plan.monthlyPrice === 0 ? (
                      <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>₹0</span>
                    ) : (
                      <>
                        <span className={`text-4xl font-bold ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                          ₹{billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice}
                        </span>
                        <span className={plan.popular ? 'text-purple-100' : 'text-gray-600'}>
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-2.5">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        plan.popular ? 'bg-white/20' : 'bg-green-100'
                      }`}>
                        <Check className={`w-2.5 h-2.5 ${plan.popular ? 'text-white' : 'text-green-600'}`} />
                      </div>
                      <span className={`text-sm ${plan.popular ? 'text-purple-50' : 'text-gray-700'}`}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-white text-purple-700 hover:bg-gray-100 shadow-lg'
                      : 'bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-br from-slate-50 to-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-2 bg-green-100 rounded-full text-green-700 text-sm font-semibold mb-4">
              Billing Transparency
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Exactly what is charged and what is not</h2>
            <p className="text-lg text-gray-600">
              We only charge when an application is successfully submitted. Skipped or failed runs are never billed.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
            {billingRules.map((rule, index) => (
              <div
                key={rule.event}
                className={`grid md:grid-cols-[1.2fr_0.45fr_1.35fr] gap-3 px-5 py-4 ${index === billingRules.length - 1 ? '' : 'border-b border-gray-100'}`}
              >
                <div className="font-semibold text-gray-900">{rule.event}</div>
                <div>
                  {rule.charged ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      Charged
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                      <X className="w-3.5 h-3.5" />
                      Not Charged
                    </span>
                  )}
                </div>
                <div className="text-gray-600">{rule.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl overflow-hidden border border-gray-200 bg-white">
            <MediaSlot
              imageSrc={mediaAssets.billingEvidenceImageSrc}
              videoSrc={mediaAssets.billingEvidenceVideoSrc}
              className="w-full h-[260px] object-cover"
              placeholderTitle="Billing evidence media"
              placeholderHint="Add log screenshot or 15-20s clip showing charged vs skipped outcomes in real runs."
              videoControls
            />
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4" />
            Start in minutes
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold mb-6">Start your journey today</h2>

          <p className="text-xl text-purple-100 mb-12">Free plan with 3 applies/day. Upgrade to Pro at ₹99/mo for unlimited.</p>

          <button
            onClick={() => handleSelectPlan('Free')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
          >
            Start Free
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap justify-center items-center gap-8 mt-12 pt-12 border-t border-white/20">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">Secure Payments via Razorpay</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm">Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5" />
              <span className="text-sm">No Hidden Fees</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
