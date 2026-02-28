import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Filter, Calendar, MessageSquare, FileText, MoreVertical } from 'lucide-react';

export default function Applications() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const columns = [
    { id: 'saved', title: 'Saved', color: 'gray', count: 8 },
    { id: 'applied', title: 'Applied', color: 'blue', count: 12 },
    { id: 'screening', title: 'Screening', color: 'purple', count: 5 },
    { id: 'interview', title: 'Interview', color: 'orange', count: 3 },
    { id: 'offer', title: 'Offer', color: 'green', count: 1 },
    { id: 'rejected', title: 'Rejected', color: 'red', count: 4 }
  ];

  const applications = {
    saved: [
      { id: 1, company: 'Stripe', position: 'Senior Engineer', date: '2024-02-28', notes: 2 },
      { id: 2, company: 'Coinbase', position: 'Full Stack', date: '2024-02-27', notes: 0 }
    ],
    applied: [
      { id: 3, company: 'Google', position: 'Senior SWE', date: '2024-02-26', notes: 3 },
      { id: 4, company: 'Meta', position: 'Frontend Engineer', date: '2024-02-25', notes: 1 }
    ],
    screening: [
      { id: 5, company: 'Amazon', position: 'SDE II', date: '2024-02-24', notes: 4 }
    ],
    interview: [
      { id: 6, company: 'Microsoft', position: 'Software Engineer', date: '2024-02-23', notes: 5 },
      { id: 7, company: 'Apple', position: 'iOS Developer', date: '2024-02-22', notes: 2 }
    ],
    offer: [
      { id: 8, company: 'Netflix', position: 'Senior Engineer', date: '2024-02-21', notes: 6 }
    ],
    rejected: []
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Applications</h1>
          <p className="text-gray-600">Track and manage your job applications</p>
        </div>
        <button className="px-6 py-3 gradient-primary text-white rounded-xl font-semibold shadow-premium hover:shadow-premium-lg transition-all flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Application
        </button>
      </motion.div>

      {/* Filters */}
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
              placeholder="Search applications..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('kanban')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                view === 'kanban'
                  ? 'gradient-primary text-white shadow-md'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                view === 'list'
                  ? 'gradient-primary text-white shadow-md'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </motion.div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {columns.map((column, colIndex) => (
          <motion.div
            key={column.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: colIndex * 0.1 }}
            className="bg-gray-50 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-${column.color}-500`}></div>
                <h3 className="font-bold text-gray-900">{column.title}</h3>
              </div>
              <span className="text-sm font-semibold text-gray-500">{column.count}</span>
            </div>

            <div className="space-y-3">
              {applications[column.id as keyof typeof applications]?.map((app) => (
                <motion.div
                  key={app.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all cursor-pointer"
                >
                  <h4 className="font-semibold text-gray-900 mb-1">{app.company}</h4>
                  <p className="text-sm text-gray-600 mb-3">{app.position}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(app.date).toLocaleDateString()}
                    </div>
                    {app.notes > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {app.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button className="flex-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition-colors">
                      View
                    </button>
                    <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </motion.div>
              ))}

              <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 hover:border-purple-400 rounded-xl text-gray-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-semibold">Add Card</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
