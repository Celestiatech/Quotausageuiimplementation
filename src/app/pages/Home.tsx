import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  Zap, 
  FileText, 
  Target, 
  BarChart3, 
  MessageSquare,
  Star,
  Check,
  TrendingUp,
  Users,
  Clock,
  Shield,
  Sparkles
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { MediaSlot } from '../components/marketing/MediaSlot';

export default function Home() {
  const navigate = useNavigate();
  const mediaAssets = {
    heroVideoSrc: '',
    heroImageSrc: '',
    valueImageSrc: '',
    reliabilityEvidenceImageSrc: '',
  };

  const features = [
    {
      icon: FileText,
      title: 'AI Resume Builder & Tailor',
      description: 'Build and customize ATS-friendly resumes for each role with AI optimization',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Target,
      title: 'Smart Job Matching',
      description: 'Get compatibility scores based on your skills and experience',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: BarChart3,
      title: 'Job Application Tracker',
      description: 'Track every application stage with our Kanban-style job tracker',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: MessageSquare,
      title: 'Interview Prep',
      description: 'Practice with AI-generated questions and feedback',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Insights',
      description: 'Track callback rates, velocity, and career progress',
      gradient: 'from-indigo-500 to-blue-500'
    },
    {
      icon: Users,
      title: 'Coach Workspace',
      description: 'Collaborate with coaches or manage multiple clients',
      gradient: 'from-pink-500 to-rose-500'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Senior SDE',
      company: 'Google',
      image: '',
      content: 'Increased my interview callbacks by 3x in just 2 weeks!'
    },
    {
      name: 'Michael Rodriguez',
      role: 'Full Stack Dev',
      company: 'Meta',
      image: '',
      content: 'The AI resume tailoring saved me hours. Worth every penny!'
    },
    {
      name: 'Emily Watson',
      role: 'Software Engineer',
      company: 'Amazon',
      image: '',
      content: 'Got 4 FAANG offers using AutoApply CV. Simply amazing!'
    }
  ];

  const switchReasons = [
    {
      icon: Clock,
      title: 'Page-ready submission guard',
      description: 'AutoApply CV waits for LinkedIn Easy Apply modal readiness before answering and submitting.',
    },
    {
      icon: Shield,
      title: 'Duplicate prevention by job ID + URL',
      description: 'Recently attempted and already-submitted jobs are skipped automatically to avoid repeated loops.',
    },
    {
      icon: MessageSquare,
      title: 'Actionable validation feedback',
      description: 'If a field fails (for example decimal/number format), run pauses and sends exact fix prompts to dashboard.',
    },
  ];

  const comparisonRows = [
    {
      area: 'Page stability',
      legacy: 'Attempts while job card/modal is still loading',
      modern: 'Waits for stable form state before next action',
    },
    {
      area: 'Repeat protection',
      legacy: 'May revisit same jobs after refresh',
      modern: 'Dedupes by applied cache, job ID, and retry cooldown',
    },
    {
      area: 'Skip visibility',
      legacy: 'Generic skipped status',
      modern: 'Exact reason codes: external apply, cache hit, required input, validation',
    },
    {
      area: 'Human control',
      legacy: 'Limited recovery when forms fail',
      modern: 'Auto-pause and resume after user answer sync from dashboard',
    },
  ];

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-mesh pt-20 pb-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>
        <div className="absolute inset-0 bg-dot-pattern opacity-20"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-purple-700 text-sm font-semibold shadow-premium">
                <Sparkles className="w-4 h-4" />
                Trusted by 50,000+ Engineers
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">
                LinkedIn Auto Apply Bot
                <br />
                for Your{' '}
                <span className="text-gradient-animated">
                  Tech Job
                </span>{' '}
                Faster
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed">
                Use AI-powered job search automation to apply to LinkedIn jobs automatically, optimize your ATS resume, and manage everything in one job application tracker.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/pricing')}
                  className="group btn-premium px-8 py-4 gradient-primary text-white rounded-xl font-semibold text-lg shadow-premium hover:shadow-premium-lg hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  Start Free (Start Free Trial)
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => navigate('/how-it-works')}
                  className="px-8 py-4 glass hover:bg-white border-2 border-purple-200 text-gray-700 rounded-xl font-semibold text-lg hover:border-purple-400 hover:shadow-premium transition-all duration-300"
                >
                  See Auto Apply Demo
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-8 pt-4">
                {[
                  { value: '50K+', label: 'Active Users' },
                  { value: '3x', label: 'More Interviews' },
                  { value: '60%', label: 'Faster Results' }
                ].map((stat, index) => (
                  <div key={index}>
                    <div className="text-3xl font-bold text-gradient">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-premium-lg border-8 border-white hover-lift">
                <MediaSlot
                  videoSrc={mediaAssets.heroVideoSrc}
                  imageSrc={mediaAssets.heroImageSrc}
                  className="w-full h-[460px] object-cover"
                  placeholderTitle="Hero demo media"
                  placeholderHint="Add a 8-12s product clip (recommended) or dashboard hero screenshot."
                  autoPlay
                  loop
                  muted
                  videoControls={false}
                />
                {/* Floating Card */}
                <div className="absolute bottom-6 left-6 right-6 glass backdrop-blur-md rounded-2xl shadow-premium-lg p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Match Score</div>
                      <div className="text-3xl font-bold text-gradient">
                        92%
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-xl gradient-primary flex items-center justify-center shadow-premium animate-pulse-slow">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative blurs */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 animate-pulse-slow"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 animate-float"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Logos */}
      <section className="py-12 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600 mb-8 font-semibold">
            ENGINEERS FROM TOP COMPANIES TRUST US
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12">
            {['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix'].map((company) => (
              <div key={company} className="text-2xl font-bold text-gray-600">
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reliability Positioning */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-indigo-100 rounded-full text-indigo-700 font-semibold text-sm mb-4">
              Why Users Switch
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Built for reliable runs, not blind mass apply
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              If you are comparing LiftmyCV, LazyApply, and other auto apply tools, focus on control quality:
              page waits, duplicate protection, and clear error routing.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {switchReasons.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#A855F7] flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="md:hidden grid gap-4">
            {comparisonRows.map((row) => (
              <div key={row.area} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900 mb-2">{row.area}</p>
                <p className="text-sm text-gray-500 mb-1">Typical Mass-Apply</p>
                <p className="text-sm text-gray-700 mb-3">{row.legacy}</p>
                <p className="text-sm text-indigo-600 mb-1 font-medium">AutoApply CV</p>
                <p className="text-sm text-gray-800">{row.modern}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
              <div className="px-5 py-3">Decision Area</div>
              <div className="px-5 py-3 border-l border-gray-200">Typical Mass-Apply</div>
              <div className="px-5 py-3 border-l border-gray-200">AutoApply CV</div>
            </div>
            {comparisonRows.map((row) => (
              <div key={row.area} className="grid grid-cols-3 text-sm">
                <div className="px-5 py-3 font-semibold text-gray-900 border-b border-gray-100">{row.area}</div>
                <div className="px-5 py-3 text-gray-600 border-l border-b border-gray-100">{row.legacy}</div>
                <div className="px-5 py-3 text-gray-700 border-l border-b border-gray-100">{row.modern}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl overflow-hidden border border-gray-200 bg-white">
            <MediaSlot
              imageSrc={mediaAssets.reliabilityEvidenceImageSrc}
              className="w-full h-[260px] object-cover"
              placeholderTitle="Reliability evidence image"
              placeholderHint="Add annotated screenshot: duplicate skip, cooldown, and validation pause/resume flow."
            />
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 font-semibold text-sm mb-6">
                Why Choose Us
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Great companies are built by{' '}
                <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                  great people
                </span>
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed mb-8">
                We help software engineers run smarter job search automation with a LinkedIn easy apply workflow, AI resume builder, and interview prep tools.
              </p>
              <div className="space-y-4">
                {[
                  'Save 15+ hours per week on applications',
                  '3x more interview callbacks on average',
                  'Track everything in one organized dashboard',
                  'AI-powered resume optimization for each job'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => navigate('/features')}
                className="mt-8 px-8 py-4 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
              >
                Explore All Features
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-2xl">
                <MediaSlot
                  imageSrc={mediaAssets.valueImageSrc}
                  className="w-full h-[420px] object-cover"
                  placeholderTitle="Value proposition image"
                  placeholderHint="Add a real dashboard screenshot showing queue, applied/skipped counts, and reason codes."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-blue-100 rounded-full text-blue-700 font-semibold text-sm mb-6">
              Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Job search automation tools that convert
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From LinkedIn auto apply to resume optimization and application tracking, built specifically for software engineers
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 border-2 border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content Hub */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 font-semibold text-sm mb-5">
              Popular Guides
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Learn what users search before choosing an auto apply tool
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Read practical guides on LinkedIn Easy Apply, AI job search tools, and finding a better LazyApply alternative.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'LazyApply Alternative', to: '/blog/lazyapply-alternative' },
              { title: 'Best AI Job Search Tools', to: '/blog/best-ai-job-search-tools' },
              { title: 'LinkedIn Easy Apply: Does It Work?', to: '/blog/linkedin-easy-apply-does-it-work' }
            ].map((guide) => (
              <Link
                key={guide.to}
                to={guide.to}
                className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-3">{guide.title}</h3>
                <p className="text-purple-700 font-semibold inline-flex items-center gap-2">
                  Read now
                  <ArrowRight className="w-4 h-4" />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white font-semibold text-sm mb-6">
              Success Stories
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Join thousands of successful engineers
            </h2>
            <p className="text-xl text-purple-100">
              Real results from real people using AutoApply CV
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300"
              >
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-300 text-yellow-300" />
                  ))}
                </div>
                <p className="text-lg text-white mb-6 leading-relaxed">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center gap-4">
                  {testimonial.image ? (
                    <ImageWithFallback
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full border-2 border-white/30 bg-white/15 flex items-center justify-center text-sm font-bold text-white">
                      {testimonial.name
                        .split(' ')
                        .map((part) => part[0] || '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">{testimonial.name}</div>
                    <div className="text-sm text-purple-100">{testimonial.role}</div>
                    <div className="text-sm text-purple-200">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-8">
            <Zap className="w-4 h-4" />
            Limited Time Offer
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Ready to automate your job search?
          </h2>
          
          <p className="text-xl text-gray-600 mb-12">
            Join 50,000+ engineers using AutoApply CV as their AI job search tool to auto apply, tailor resumes, and land interviews faster.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/pricing')}
              className="px-10 py-5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Start Free (Start Free Trial)
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => navigate('/features')}
              className="px-10 py-5 bg-white border-2 border-purple-200 text-gray-700 rounded-xl font-bold text-lg hover:border-purple-400 hover:shadow-lg transition-all duration-200"
            >
              Learn More
            </button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-8 mt-12 pt-12 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600 font-medium">Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600 font-medium">24/7 Support</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600 font-medium">No Credit Card Required</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
