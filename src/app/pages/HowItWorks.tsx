import { useNavigate } from 'react-router';
import { Upload, Target, Rocket, Check, ArrowRight, Play } from 'lucide-react';

export default function HowItWorks() {
  const navigate = useNavigate();

  const steps = [
    {
      number: '01',
      icon: Upload,
      title: 'Upload Your Resume',
      description: 'Import from LinkedIn or upload your existing resume. Our AI analyzes your skills, experience, and achievements in seconds.',
      details: [
        'LinkedIn quick import',
        'PDF/DOCX support',
        'AI skill extraction',
        'Profile completeness check'
      ],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      number: '02',
      icon: Target,
      title: 'Match & Customize',
      description: 'Get personalized job matches with compatibility scores. Auto-tailor your resume for each application with one click.',
      details: [
        'AI job matching',
        'Compatibility scoring',
        'One-click customization',
        'ATS optimization'
      ],
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      number: '03',
      icon: Rocket,
      title: 'Auto Apply & Track',
      description: 'Apply to LinkedIn jobs automatically, then manage your full pipeline with a built-in job application tracker and analytics.',
      details: [
        'LinkedIn easy apply automation',
        'Pipeline management',
        'Interview prep tools',
        'Progress analytics'
      ],
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            How It Works
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            From AI resume builder to{' '}
            <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
              LinkedIn auto apply
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Get started in minutes with job search automation, ATS resume optimization, and application tracking. No technical knowledge required.
          </p>

          <button className="px-8 py-4 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 inline-flex items-center gap-2">
            <Play className="w-5 h-5" />
            Watch 2-min Demo Video
          </button>
        </div>
      </section>

      {/* Steps */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-32">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                  {/* Content */}
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <div className="text-8xl font-bold text-gray-100 mb-4">{step.number}</div>
                    <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-6 shadow-xl`}>
                      <step.icon className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 mb-4">{step.title}</h2>
                    <p className="text-xl text-gray-600 mb-8 leading-relaxed">{step.description}</p>
                    
                    <ul className="space-y-4">
                      {step.details.map((detail, dIndex) => (
                        <li key={dIndex} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-gray-700 text-lg">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual */}
                  <div className={index % 2 === 1 ? 'lg:order-1' : ''}>
                    <div className={`rounded-3xl bg-gradient-to-br ${step.gradient} p-1 shadow-2xl`}>
                      <div className="rounded-3xl bg-white p-12 h-96 flex items-center justify-center">
                        <step.icon className="w-32 h-32 text-gray-200" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute left-1/2 bottom-0 w-1 h-32 bg-gradient-to-b from-purple-300 to-transparent -mb-32"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-24 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Typical journey timeline
            </h2>
            <p className="text-xl text-gray-600">
              See how fast you can get results
            </p>
          </div>

          <div className="space-y-8">
            {[
              { time: 'Day 1', action: 'Sign up and upload resume', result: 'Profile ready in 5 minutes' },
              { time: 'Day 2-3', action: 'Get job matches', result: 'Receive 20-50 compatible jobs' },
              { time: 'Week 1', action: 'Apply to positions', result: 'Send 10-30 tailored applications' },
              { time: 'Week 2-3', action: 'Interview invitations', result: '3-5 interview callbacks' },
              { time: 'Week 4-6', action: 'Interview process', result: 'Multiple offer letters' }
            ].map((milestone, index) => (
              <div key={index} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-32">
                  <div className="text-xl font-bold bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                    {milestone.time}
                  </div>
                </div>
                <div className="flex-1 bg-white rounded-xl p-6 shadow-md border border-purple-100">
                  <h3 className="font-bold text-gray-900 mb-1">{milestone.action}</h3>
                  <p className="text-gray-600">{milestone.result}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Start your success story today
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            Join thousands of engineers who've transformed their careers
          </p>

          <button 
            onClick={() => navigate('/pricing')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:scale-105 transition-all duration-200 inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
