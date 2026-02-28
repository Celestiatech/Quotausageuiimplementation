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

export default function Home() {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: 'AI Resume Tailor',
      description: 'Automatically customize resumes for each job with AI optimization',
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
      title: 'Application Tracker',
      description: 'Manage your entire pipeline with our Kanban-style CRM',
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
      image: 'https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?w=400',
      content: 'Increased my interview callbacks by 3x in just 2 weeks!'
    },
    {
      name: 'Michael Rodriguez',
      role: 'Full Stack Dev',
      company: 'Meta',
      image: 'https://images.unsplash.com/photo-1723537742563-15c3d351dbf2?w=400',
      content: 'The AI resume tailoring saved me hours. Worth every penny!'
    },
    {
      name: 'Emily Watson',
      role: 'Software Engineer',
      company: 'Amazon',
      image: 'https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=400',
      content: 'Got 4 FAANG offers using CareerPilot. Simply amazing!'
    }
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
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div 
                className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-purple-700 text-sm font-semibold shadow-premium"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Sparkles className="w-4 h-4" />
                Trusted by 50,000+ Engineers
              </motion.div>
              
              <motion.h1 
                className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Land Your Dream{' '}
                <span className="text-gradient-animated">
                  Tech Job
                </span>{' '}
                Faster
              </motion.h1>
              
              <motion.p 
                className="text-xl text-gray-600 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                AI-powered job search platform built for software engineers. Increase your interview callbacks by 3x and land offers 60% faster.
              </motion.p>

              <motion.div 
                className="flex flex-col sm:flex-row gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <button 
                  onClick={() => navigate('/pricing')}
                  className="group btn-premium px-8 py-4 gradient-primary text-white rounded-xl font-semibold text-lg shadow-premium hover:shadow-premium-lg hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => navigate('/how-it-works')}
                  className="px-8 py-4 glass hover:bg-white border-2 border-purple-200 text-gray-700 rounded-xl font-semibold text-lg hover:border-purple-400 hover:shadow-premium transition-all duration-300"
                >
                  Watch Demo
                </button>
              </motion.div>

              {/* Stats */}
              <motion.div 
                className="flex items-center gap-8 pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                {[
                  { value: '50K+', label: 'Active Users' },
                  { value: '3x', label: 'More Interviews' },
                  { value: '60%', label: 'Faster Results' }
                ].map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                  >
                    <div className="text-3xl font-bold text-gradient">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right Column */}
            <motion.div 
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <div className="relative rounded-3xl overflow-hidden shadow-premium-lg border-8 border-white hover-lift">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1580894896813-652ff5aa8146?w=1080"
                  alt="CareerPilot Dashboard"
                  className="w-full h-auto"
                />
                {/* Floating Card */}
                <motion.div 
                  className="absolute bottom-6 left-6 right-6 glass backdrop-blur-md rounded-2xl shadow-premium-lg p-5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1 }}
                >
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
                </motion.div>
              </div>
              {/* Decorative blurs */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 animate-pulse-slow"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-20 animate-float"></div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Logos */}
      <section className="py-12 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 mb-8 font-semibold">
            ENGINEERS FROM TOP COMPANIES TRUST US
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
            {['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix'].map((company) => (
              <div key={company} className="text-2xl font-bold text-gray-400">
                {company}
              </div>
            ))}
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
                We've helped over 50,000 engineers land their dream roles at top tech companies. Our AI-powered platform automates the tedious parts of job searching so you can focus on what matters.
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
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1739298061766-e2751d92e9db?w=800"
                  alt="Team collaboration"
                  className="w-full h-auto"
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
              Everything you need to succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Powerful tools designed specifically for software engineers
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
              Real results from real people using CareerPilot
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
                  <ImageWithFallback
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                  />
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
            Ready to land your dream job?
          </h2>
          
          <p className="text-xl text-gray-600 mb-12">
            Join 50,000+ engineers who've transformed their career with CareerPilot. Start your free trial today!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => navigate('/pricing')}
              className="px-10 py-5 bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Start Free Trial
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