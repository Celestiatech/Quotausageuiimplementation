import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  MapPin,
  DollarSign,
  Briefcase,
  Clock,
  Star,
  Bookmark,
  X,
  SlidersHorizontal,
  TrendingUp,
  Building
} from 'lucide-react';

export default function Jobs() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState<number | null>(0);

  const jobs = [
    {
      id: 1,
      title: 'Senior Software Engineer',
      company: 'Google',
      location: 'Mountain View, CA',
      type: 'Full-time',
      salary: '$150K - $200K',
      match: 95,
      posted: '2 days ago',
      description: 'We are looking for a Senior Software Engineer to join our team...',
      requirements: ['5+ years experience', 'React, Node.js', 'System Design'],
      benefits: ['Health Insurance', '401(k)', 'Remote Work', 'Stock Options']
    },
    {
      id: 2,
      title: 'Full Stack Developer',
      company: 'Meta',
      location: 'Menlo Park, CA',
      type: 'Full-time',
      salary: '$140K - $180K',
      match: 92,
      posted: '3 days ago',
      description: 'Join Meta to build the future of social technology...',
      requirements: ['3+ years experience', 'React, GraphQL', 'Agile'],
      benefits: ['Health Insurance', 'Unlimited PTO', 'Gym Membership']
    },
    {
      id: 3,
      title: 'Frontend Engineer',
      company: 'Amazon',
      location: 'Seattle, WA',
      type: 'Full-time',
      salary: '$130K - $170K',
      match: 88,
      posted: '5 days ago',
      description: 'Amazon Web Services is seeking a talented Frontend Engineer...',
      requirements: ['4+ years experience', 'React, TypeScript', 'AWS'],
      benefits: ['Health Insurance', 'RSUs', 'Relocation']
    },
    {
      id: 4,
      title: 'Software Development Engineer',
      company: 'Microsoft',
      location: 'Redmond, WA',
      type: 'Full-time',
      salary: '$145K - $190K',
      match: 90,
      posted: '1 week ago',
      description: 'Microsoft Azure team is hiring SDEs...',
      requirements: ['3+ years experience', 'C#, .NET', 'Cloud'],
      benefits: ['Health Insurance', 'Stock Purchase Plan', 'Remote Option']
    },
    {
      id: 5,
      title: 'Backend Engineer',
      company: 'Apple',
      location: 'Cupertino, CA',
      type: 'Full-time',
      salary: '$155K - $195K',
      match: 87,
      posted: '1 week ago',
      description: 'Apple is looking for a Backend Engineer for iCloud services...',
      requirements: ['5+ years experience', 'Python, Go', 'Distributed Systems'],
      benefits: ['Health Insurance', 'Product Discounts', 'Onsite Gym']
    }
  ];

  const filters = [
    { label: 'Remote', count: 23 },
    { label: 'On-site', count: 45 },
    { label: 'Hybrid', count: 18 },
    { label: '$150K+', count: 34 },
    { label: 'Senior Level', count: 29 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Matches</h1>
          <p className="text-gray-600">Found {jobs.length} opportunities matching your profile</p>
        </div>
        <button className="px-6 py-3 gradient-primary text-white rounded-xl font-semibold shadow-premium hover:shadow-premium-lg transition-all">
          Auto-Apply to Top 10
        </button>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl p-6 border-2 border-gray-200"
      >
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, company, or skills..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Quick Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200"
          >
            {filters.map((filter) => (
              <button
                key={filter.label}
                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-medium transition-colors text-sm"
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Jobs Grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Job List */}
        <div className="lg:col-span-2 space-y-4 max-h-[800px] overflow-y-auto">
          {jobs.map((job, index) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedJob(index)}
              className={`bg-white rounded-2xl p-6 border-2 cursor-pointer transition-all duration-300 ${
                selectedJob === index
                  ? 'border-purple-400 shadow-xl'
                  : 'border-gray-200 hover:border-purple-300 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-purple-700">
                    {job.company.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{job.title}</h3>
                    <p className="text-sm text-gray-600">{job.company}</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  job.match >= 90
                    ? 'bg-green-100 text-green-700'
                    : job.match >= 85
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {job.match}% Match
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  {job.salary}
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  {job.posted}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 px-4 py-2 gradient-primary text-white rounded-lg font-semibold hover:shadow-lg transition-all">
                  Apply Now
                </button>
                <button className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors">
                  <Bookmark className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Job Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 bg-white rounded-2xl p-8 border-2 border-gray-200 max-h-[800px] overflow-y-auto sticky top-0"
        >
          {selectedJob !== null && jobs[selectedJob] && (
            <>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center font-bold text-2xl text-purple-700">
                    {jobs[selectedJob].company.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{jobs[selectedJob].title}</h2>
                    <p className="text-gray-600 flex items-center gap-2 mt-1">
                      <Building className="w-4 h-4" />
                      {jobs[selectedJob].company}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gradient mb-1">
                    {jobs[selectedJob].match}%
                  </div>
                  <div className="text-sm text-gray-600">Match Score</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-purple-700 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-semibold">Location</span>
                  </div>
                  <p className="text-gray-900 font-medium">{jobs[selectedJob].location}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-semibold">Salary</span>
                  </div>
                  <p className="text-gray-900 font-medium">{jobs[selectedJob].salary}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-700 mb-1">
                    <Briefcase className="w-4 h-4" />
                    <span className="text-sm font-semibold">Type</span>
                  </div>
                  <p className="text-gray-900 font-medium">{jobs[selectedJob].type}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Job Description</h3>
                  <p className="text-gray-600 leading-relaxed">{jobs[selectedJob].description}</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Requirements</h3>
                  <ul className="space-y-2">
                    {jobs[selectedJob].requirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-700">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Star className="w-3 h-3 text-green-600" />
                        </div>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Benefits</h3>
                  <div className="flex flex-wrap gap-2">
                    {jobs[selectedJob].benefits.map((benefit, i) => (
                      <span
                        key={i}
                        className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg font-medium text-sm"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button className="flex-1 btn-premium gradient-primary text-white py-4 rounded-xl font-bold shadow-premium hover:shadow-premium-lg transition-all">
                  Apply with AI Resume
                </button>
                <button className="px-6 py-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-semibold transition-colors">
                  <Bookmark className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
