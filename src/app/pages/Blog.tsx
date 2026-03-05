import { useNavigate } from 'react-router';
import { ArrowRight, BookOpen, Search, Target } from 'lucide-react';

const posts = [
  {
    title: 'LazyApply Alternative: Better LinkedIn Auto Apply Bot for Engineers',
    description:
      'Compare features, control, and ATS resume support when choosing a LazyApply alternative.',
    slug: '/blog/lazyapply-alternative',
    keyword: 'lazyapply alternative'
  },
  {
    title: 'Best AI Job Search Tools in 2026: What Actually Helps You Get Interviews',
    description:
      'A practical guide to the best AI job search tools for software engineers and technical roles.',
    slug: '/blog/best-ai-job-search-tools',
    keyword: 'best ai job search tools'
  },
  {
    title: 'LinkedIn Easy Apply: Does It Work and How to Improve Results',
    description:
      'Learn when LinkedIn Easy Apply works, why applications fail, and how to improve callback rates.',
    slug: '/blog/linkedin-easy-apply-does-it-work',
    keyword: 'linkedin easy apply does it work'
  }
];

export default function Blog() {
  const navigate = useNavigate();

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <BookOpen className="w-4 h-4" />
            SEO Guides
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Job Search Automation{' '}
            <span className="bg-gradient-to-r from-[#6366F1] to-[#A855F7] bg-clip-text text-transparent">
              Blog
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn how to use LinkedIn auto apply workflows, AI resume builder tactics, and job application tracking to get more interviews.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 p-8 hover:border-purple-300 hover:shadow-xl transition-all duration-200"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-4">
                  <Search className="w-3 h-3" />
                  {post.keyword}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{post.title}</h2>
                <p className="text-gray-600 leading-relaxed mb-6">{post.description}</p>
                <button
                  onClick={() => navigate(post.slug)}
                  className="inline-flex items-center gap-2 text-purple-700 font-semibold hover:text-purple-800"
                >
                  Read guide
                  <ArrowRight className="w-4 h-4" />
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-semibold mb-6">
            <Target className="w-4 h-4" />
            Next Step
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-5">Put these tactics into action</h2>
          <p className="text-xl text-gray-600 mb-10">
            Use AutoApply CV to apply to LinkedIn jobs automatically, optimize your resume for ATS, and track outcomes in one dashboard.
          </p>
          <button
            onClick={() => navigate('/pricing')}
            className="px-10 py-4 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-xl font-bold text-lg hover:shadow-xl"
          >
            Start Free
          </button>
        </div>
      </section>
    </div>
  );
}
