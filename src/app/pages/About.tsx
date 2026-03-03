import { useNavigate } from 'react-router';
import { Heart, Target, Users, TrendingUp, ArrowRight } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export default function About() {
  const navigate = useNavigate();

  const values = [
    {
      icon: Heart,
      title: 'Engineer-First',
      description: 'Built by engineers, for engineers. We understand your journey.',
      gradient: 'from-red-500 to-pink-500'
    },
    {
      icon: Target,
      title: 'Results-Driven',
      description: 'Focused on outcomes that matter: more interviews, better offers.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Users,
      title: 'Community-Powered',
      description: 'Learn from thousands of successful job seekers in our community.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: TrendingUp,
      title: 'Continuous Innovation',
      description: 'Always improving with the latest AI and automation technology.',
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  const team = [
    {
      name: 'Alex Chen',
      role: 'CEO & Founder',
      image: 'https://images.unsplash.com/photo-1723537742563-15c3d351dbf2?w=400',
      bio: 'Ex-Google SWE, built CareerPilot after landing 15 offers'
    },
    {
      name: 'Sarah Martinez',
      role: 'Head of Product',
      image: 'https://images.unsplash.com/photo-1689600944138-da3b150d9cb8?w=400',
      bio: 'Former Meta PM, 10+ years in career tech'
    },
    {
      name: 'James Wilson',
      role: 'Head of Engineering',
      image: 'https://images.unsplash.com/photo-1576558656222-ba66febe3dec?w=400',
      bio: 'AI/ML expert from Amazon, Stanford CS PhD'
    }
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
                Our Story
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                We're on a mission to help{' '}
                <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
                  every engineer
                </span>{' '}
                land their dream job
              </h1>
              
              <p className="text-xl text-gray-600 leading-relaxed mb-8">
                CareerPilot was born from frustration with the traditional job search process. After helping thousands of engineers land roles at top tech companies, we built the platform we wish we had.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/pricing')}
                  className="px-8 py-4 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-xl font-semibold hover:shadow-xl hover:scale-105 transition-all duration-200 inline-flex items-center justify-center gap-2"
                >
                  Join Our Mission
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1739298061766-e2751d92e9db?w=800"
                alt="Team"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { number: '50K+', label: 'Active Users' },
              { number: '500K+', label: 'Applications Sent' },
              { number: '15K+', label: 'Offers Received' },
              { number: '95%', label: 'Satisfaction Rate' }
            ].map((stat, index) => (
              <div key={index} className="text-center p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-4xl font-bold bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our core values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${value.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Meet our leadership team
            </h2>
            <p className="text-xl text-gray-600">
              Experienced engineers and product leaders from top tech companies
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {team.map((member, index) => (
              <div key={index} className="text-center">
                <div className="relative mb-6 group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1] to-[#A855F7] rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
                  <ImageWithFallback
                    src={member.image}
                    alt={member.name}
                    className="relative w-48 h-48 rounded-3xl object-cover mx-auto border-4 border-white shadow-xl"
                  />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{member.name}</h3>
                <p className="text-purple-600 font-semibold mb-3">{member.role}</p>
                <p className="text-gray-600">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] text-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6">
            Join our growing community
          </h2>
          
          <p className="text-xl text-purple-100 mb-12">
            Be part of 50,000+ engineers transforming their careers
          </p>

          <button 
            onClick={() => navigate('/pricing')}
            className="px-10 py-5 bg-white text-purple-700 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-2xl hover:scale-105 transition-all duration-200"
          >
            Get Started Today
          </button>
        </div>
      </section>
    </div>
  );
}
