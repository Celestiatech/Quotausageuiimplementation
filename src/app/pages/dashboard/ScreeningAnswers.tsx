'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requireAuth } from 'src/lib/guards';
import { ok, handleApiError } from 'src/lib/api';
import { toQuestionKey as mapQuestionKey } from "src/lib/screening-question-map";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../app/components/ui/card';
import { Button } from '../../../app/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../app/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../app/components/ui/table';
import {
  Input,
} from '../../../app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../app/components/ui/select';
import {
  Checkbox,
} from '../../../app/components/ui/checkbox';
import {
  Textarea,
} from '../../../app/components/ui/textarea';
import {
  Badge,
} from '../../../app/components/ui/badge';
import {
  Separator,
} from '../../../app/components/ui/separator';
import {
  Skeleton,
} from '../../../app/components/ui/skeleton';
import {
  Loader2,
  Edit,
  CheckCircle,
  User,
  Sliders,
  List,
  Trash2,
} from 'lucide-react';
import { motion } from 'framer-motion';

// Types
type ScreeningAnswerType = 'text' | 'boolean' | 'number' | 'choice' | 'multiselect';
type ScreeningAnswerSource = 'manual' | 'linkedin_import' | 'resume_parse' | 'extension_capture' | 'system';

type ScreeningAnswerApiItem = {
  questionKey: string;
  questionLabel: string;
  answer: string;
  answerType?: ScreeningAnswerType;
  source?: ScreeningAnswerSource;
  updatedAt?: string;
  createdAt?: string;
};

// Form schemas
const textAnswerSchema = z.object({
  answer: z.string().min(1, 'Answer is required'),
});

const booleanAnswerSchema = z.object({
  answer: z.enum(['true', 'false'], {
    errorMap: () => ({ message: 'Please select an option' })
  }),
});

const numberAnswerSchema = z.object({
  answer: z.string().refine(val => !isNaN(Number(val)) && Number(val) >= 0, {
    message: 'Please enter a valid number',
  }),
});

const choiceAnswerSchema = z.object({
  answer: z.string().min(1, 'Please select an option'),
});

const multiselectAnswerSchema = z.object({
  answer: z.string().min(1, 'Please select at least one option'),
});

// Screening field categories (shared with Jobs.tsx)
const ScreeningFieldCategory = {
  profile: 'profile',
  preferences: 'preferences',
  screening: 'screening',
} as const;

type ScreeningFieldCategory = typeof ScreeningFieldCategory[keyof typeof ScreeningFieldCategory];

const SCREENING_SECTION_META: Record<ScreeningFieldCategory, { title: string; subtitle: string; icon: string }> = {
  [ScreeningFieldCategory.profile]: {
    title: 'Profile Answers',
    subtitle: 'Core details from onboarding used across Easy Apply forms.',
    icon: 'User'
  },
  [ScreeningFieldCategory.preferences]: {
    title: 'Job Preferences',
    subtitle: 'Search targets and AutoApply preferences synced to the extension.',
    icon: 'Sliders'
  },
  [ScreeningFieldCategory.screening]: {
    title: 'Custom Screening Answers',
    subtitle: 'Extra question/answer pairs captured from LinkedIn applications.',
    icon: 'List'
  },
};

// Lookup function from Jobs.tsx (simplified for this page)
const normalizeLabel = (value: string) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const toQuestionKey = (value: string) => {
  return mapQuestionKey(value);
};

// Catalog fields (shared with Jobs.tsx)
const YES_NO_OPTIONS = ['No', 'Yes'];
const WORK_MODE_OPTIONS = ['Remote', 'Hybrid', 'Onsite', 'Flexible'];
const JOB_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'];
const ENGLISH_PROFICIENCY_OPTIONS = ['Native or bilingual', 'Professional', 'Limited', 'Basic'];
const EDUCATION_LEVEL_OPTIONS = [
  'High School',
  'Associate Degree',
  'Bachelor\'s Degree',
  'Master\'s Degree',
  'Doctorate',
  'Diploma / Certificate',
];

const WORK_AUTHORIZATION_OPTIONS = [
  'U.S. Citizen/Permanent Resident',
  'Authorized to work in the U.S.',
  'Require sponsorship',
  'Not authorized',
];

const SCREENING_FIELD_CATALOG = [
  { key: 'full_name', label: 'Full Name', category: ScreeningFieldCategory.profile, order: 10 },
  { key: 'first_name', label: 'First Name', category: ScreeningFieldCategory.profile, order: 20 },
  { key: 'last_name', label: 'Last Name', category: ScreeningFieldCategory.profile, order: 30 },
  { key: 'email_address', label: 'Email Address', category: ScreeningFieldCategory.profile, order: 40 },
  { key: 'phone_number', label: 'Phone Number', category: ScreeningFieldCategory.profile, order: 50 },
  { key: 'address_line', label: 'Address Line', category: ScreeningFieldCategory.profile, order: 60 },
  { key: 'current_city', label: 'Current City', category: ScreeningFieldCategory.profile, order: 70 },
  { key: 'state_region', label: 'State / Region', category: ScreeningFieldCategory.profile, order: 80 },
  { key: 'country', label: 'Country', category: ScreeningFieldCategory.profile, order: 90 },
  { key: 'linkedin_url', label: 'LinkedIn URL', category: ScreeningFieldCategory.profile, order: 100 },
  { key: 'portfolio_url', label: 'Portfolio URL', category: ScreeningFieldCategory.profile, order: 110 },
  {
    key: 'work_authorization_us',
    label: 'U.S. Work Authorization',
    category: ScreeningFieldCategory.profile,
    order: 120,
    answerType: 'choice' as ScreeningAnswerType,
    options: WORK_AUTHORIZATION_OPTIONS,
  },
  {
    key: 'visa_sponsorship_required',
    label: 'Need Visa Sponsorship',
    category: ScreeningFieldCategory.profile,
    order: 130,
    answerType: 'boolean' as ScreeningAnswerType,
    options: YES_NO_OPTIONS,
  },
  {
    key: 'years_of_experience',
    label: 'Years of Experience',
    category: ScreeningFieldCategory.profile,
    order: 140,
    answerType: 'number' as ScreeningAnswerType,
  },
  {
    key: 'english_proficiency',
    label: 'English Proficiency',
    category: ScreeningFieldCategory.profile,
    order: 150,
    answerType: 'choice' as ScreeningAnswerType,
    options: ENGLISH_PROFICIENCY_OPTIONS,
  },
  {
    key: 'education_level',
    label: 'Education Level',
    category: ScreeningFieldCategory.profile,
    order: 160,
    answerType: 'choice' as ScreeningAnswerType,
    options: EDUCATION_LEVEL_OPTIONS,
  },
  {
    key: 'cp_pref_search_terms',
    label: 'Preferred Job Titles / Search Terms',
    category: ScreeningFieldCategory.preferences,
    order: 200,
    answerType: 'multiselect' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_search_locations',
    label: 'Preferred Locations',
    category: ScreeningFieldCategory.preferences,
    order: 210,
    answerType: 'multiselect' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_work_mode',
    label: 'Remote / Onsite / Hybrid',
    category: ScreeningFieldCategory.preferences,
    order: 220,
    answerType: 'choice' as ScreeningAnswerType,
    options: WORK_MODE_OPTIONS,
  },
  {
    key: 'cp_pref_job_types',
    label: 'Job Types',
    category: ScreeningFieldCategory.preferences,
    order: 230,
    answerType: 'multiselect' as ScreeningAnswerType,
    presets: JOB_TYPE_OPTIONS,
  },
  {
    key: 'cp_pref_preferred_countries',
    label: 'Preferred Countries',
    category: ScreeningFieldCategory.preferences,
    order: 240,
    answerType: 'multiselect' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_confidence_level',
    label: 'Confidence Level',
    category: ScreeningFieldCategory.preferences,
    order: 250,
    answerType: 'number' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_salary_min',
    label: 'Salary Range Min',
    category: ScreeningFieldCategory.preferences,
    order: 260,
    answerType: 'number' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_salary_max',
    label: 'Salary Range Max',
    category: ScreeningFieldCategory.preferences,
    order: 270,
    answerType: 'number' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_desired_salary',
    label: 'Desired Salary',
    category: ScreeningFieldCategory.preferences,
    order: 280,
    answerType: 'text' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_excluded_companies',
    label: 'Excluded Companies',
    category: ScreeningFieldCategory.preferences,
    order: 290,
    answerType: 'multiselect' as ScreeningAnswerType,
  },
  {
    key: 'cp_pref_excluded_keywords',
    label: 'Excluded Keywords',
    category: ScreeningFieldCategory.preferences,
    order: 300,
    answerType: 'multiselect' as ScreeningAnswerType,
  },
  {
    key: 'comfortable_working_onsite',
    label: 'Comfortable Working Onsite',
    category: ScreeningFieldCategory.screening,
    order: 500,
    answerType: 'boolean' as ScreeningAnswerType,
    options: YES_NO_OPTIONS,
  },
  {
    key: 'comfortable_commuting',
    label: 'Comfortable Commuting',
    category: ScreeningFieldCategory.screening,
    order: 510,
    answerType: 'boolean' as ScreeningAnswerType,
    options: YES_NO_OPTIONS,
  },
  {
    key: 'comfortable_relocation',
    label: 'Comfortable Relocation',
    category: ScreeningFieldCategory.screening,
    order: 520,
    answerType: 'boolean' as ScreeningAnswerType,
    options: YES_NO_OPTIONS,
  },
  {
    key: 'bachelors_degree_completed',
    label: 'Bachelor\'s Degree Completed',
    category: ScreeningFieldCategory.screening,
    order: 530,
    answerType: 'boolean' as ScreeningAnswerType,
    options: YES_NO_OPTIONS,
  }
] as const;

const SCREENING_FIELD_LOOKUP = (() => {
  const map = new Map<string, typeof SCREENING_FIELD_CATALOG[number]>();
  for (const field of SCREENING_FIELD_CATALOG) {
    for (const rawValue of [field.key, field.label]) {
      const candidates = [
        String(rawValue || '').trim(),
        normalizeLabel(rawValue),
        toQuestionKey(String(rawValue || '').trim()),
      ].filter(Boolean);
      for (const candidate of candidates) {
        if (!map.has(candidate)) {
          map.set(candidate, field);
        }
      }
    }
  }
  return map;
})();

function lookupCatalogField(rawKey: string, questionLabel?: string) {
  const raw = String(rawKey || '').trim();
  if (!raw) return null;
  const candidates = [raw, normalizeLabel(raw), toQuestionKey(raw)].filter(Boolean);
  for (const candidate of candidates) {
    const match = SCREENING_FIELD_LOOKUP.get(candidate);
    if (match) return match;
  }
  return null;
}

function inferAnswerType(answer: string): ScreeningAnswerType {
  const value = String(answer || '').trim();
  if (!value) return 'text';
  const lower = value.toLowerCase();
  if (lower === 'yes' || lower === 'no') return 'boolean';
  if (/^\d+(\.\d+)?$/.test(value)) return 'number';
  if (value.includes(',')) return 'multiselect';
  return 'text';
}

const ScreeningAnswersPage: React.FC = () => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<ScreeningAnswerApiItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingAnswer, setEditingAnswer] = useState<string | null>(null);
  const answerForm = useForm({
    resolver: zodResolver(textAnswerSchema), // Will be updated dynamically
    defaultValues: { answer: '' },
  });

  // Load screening answers
  const loadAnswers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/screening/answers', {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error('Failed to fetch screening answers');
      }
      const fetchedAnswers = Array.isArray(data?.data?.answers)
        ? (data.data.answers as ScreeningAnswerApiItem[])
        : [];
      setAnswers(fetchedAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Failed to load screening answers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save answer
  const saveAnswer = async (questionKey: string, questionLabel: string, answer: string) => {
    try {
      const res = await fetch('/api/user/screening/answers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionKey,
          questionLabel,
          answer,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to save answer');
      }
      await loadAnswers(); // Refresh list
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save answer');
      return false;
    }
  };

  // Delete answer
  const deleteAnswer = async (questionKey: string) => {
    // Note: Delete API would need to be implemented
    // For now, we'll just show a message
    alert('Delete functionality would be implemented here');
  };

  useEffect(() => {
    loadAnswers();
  }, [loadAnswers]);

  // Group answers by category
  const groupedAnswers = useMemo(() => {
    const grouped: Record<ScreeningFieldCategory, ScreeningAnswerApiItem[]> = {
      [ScreeningFieldCategory.profile]: [],
      [ScreeningFieldCategory.preferences]: [],
      [ScreeningFieldCategory.screening]: [],
    };

    answers.forEach(answer => {
      const field = lookupCatalogField(answer.questionKey, answer.questionLabel);
      const category = field?.category || ScreeningFieldCategory.screening;
      if (grouped[category]) {
        grouped[category].push(answer);
      }
    });

    // Sort within each category by order
    Object.keys(grouped).forEach(category => {
      (grouped[category as ScreeningFieldCategory] as ScreeningAnswerApiItem[]).sort((a, b) => {
        const fieldA = lookupCatalogField(a.questionKey, a.questionLabel);
        const fieldB = lookupCatalogField(b.questionKey, b.questionLabel);
        const orderA = fieldA?.order ?? 999;
        const orderB = fieldB?.order ?? 999;
        return orderA - orderB;
      });
    });

    return grouped;
  }, [answers]);

  // Statistics
  const stats = useMemo(() => {
    const total = answers.length;
    const byCategory = {
      [ScreeningFieldCategory.profile]: groupedAnswers[ScreeningFieldCategory.profile].length,
      [ScreeningFieldCategory.preferences]: groupedAnswers[ScreeningFieldCategory.preferences].length,
      [ScreeningFieldCategory.screening]: groupedAnswers[ScreeningFieldCategory.screening].length,
    };
    const sources = answers.reduce((acc, answer) => {
      const source = answer.source || 'manual';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, byCategory, sources };
  }, [answers, groupedAnswers]);

  if (loading) {
    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Screening Answers
            </h2>
            <div className="grid gap-4">
              {[ScreeningFieldCategory.profile, ScreeningFieldCategory.preferences, ScreeningFieldCategory.screening].map(category => (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: parseInt(category) * 0.05 }}
                  className="bg-gray-50 p-4 rounded-lg"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {SCREENING_SECTION_META[category].title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Loading...
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Error Loading Screening Answers
        </h3>
        <p className="text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={loadAnswers}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Screening Answers
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage your auto-apply screening question answers
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAnswers}
              >
                <Loader2 className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement add answer modal
                  alert('Add answer functionality would be implemented here');
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Add Answer
              </Button>
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <motion.div
                key="total"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Answers</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="p-2 rounded-full bg-blue-50">
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Profile Answers</p>
                    <p className="text-xl font-bold text-gray-900">{stats.byCategory[ScreeningFieldCategory.profile]}</p>
                  </div>
                  <div className="p-2 rounded-full bg-green-50">
                    <User className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                key="preferences"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Job Preferences</p>
                    <p className="text-xl font-bold text-gray-900">{stats.byCategory[ScreeningFieldCategory.preferences]}</p>
                  </div>
                  <div className="p-2 rounded-full bg-purple-50">
                    <Sliders className="h-5 w-5 text-purple-500" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                key="screening"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Custom Screening</p>
                    <p className="text-xl font-bold text-gray-900">{stats.byCategory[ScreeningFieldCategory.screening]}</p>
                  </div>
                  <div className="p-2 rounded-full bg-indigo-50">
                    <List className="h-5 w-5 text-indigo-500" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                key="sources"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Answer Sources</p>
                  <div className="text-xs flex flex-wrap gap-2">
                    {Object.entries(stats.sources).map(([source, count]) => (
                      <motion.div
                        key={`source-${source}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.random() * 0.2 }}
                        className="px-2 py-1 rounded-full text-xs bg-gray-200"
                      >
                        {source}: {count}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Tabs for different views */}
            <div className="space-y-4">
              <Tabs defaultValue="categories">
                <TabsList className="grid w-full grid-cols-3 border-b">
                  <TabsTrigger value="categories">
                    By Category
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    Table View
                  </TabsTrigger>
                  <TabsTrigger value="stats">
                    Statistics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="categories">
                  {/* Category-based view */}
                  {[ScreeningFieldCategory.profile, ScreeningFieldCategory.preferences, ScreeningFieldCategory.screening].map(category => (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: parseInt(category) * 0.05 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {SCREENING_SECTION_META[category].title}
                        </h2>
                        <p className="text-sm text-gray-500">
                          {groupedAnswers[category].length} answers
                        </p>
                      </div>
                      <Separator />

                      {groupedAnswers[category].length === 0 ? (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-center py-8"
                        >
                          <p className="text-sm text-gray-500">
                            No {SCREENING_SECTION_META[category].title.toLowerCase()} found
                          </p>
                        </motion.div>
                      ) : (
                        <div className="space-y-3">
                          {groupedAnswers[category].map(answer => {
                            const field = lookupCatalogField(answer.questionKey, answer.questionLabel);
                            const isEditing = editingAnswer === answer.questionKey;

                            return (
                              <motion.div
                                key={answer.questionKey}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.random() * 0.1 }}
                                className={`border rounded-lg p-3 ${
                                  isEditing ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-shrink-0">
                                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
                                      {(() => {
                                        switch (field?.answerType) {
                                          case 'boolean': return <CheckCircle className="h-4 w-4 text-gray-500" />;
                                          case 'number': return <Badge className="h-4 w-4 text-gray-500">#</Badge>;
                                          case 'choice': return <Select className="h-4 w-4 text-gray-500" />;
                                          case 'multiselect': return <Badge className="h-4 w-4 text-gray-500">+</Badge>;
                                          default: return <Edit className="h-4 w-4 text-gray-500" />;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="space-y-1">
                                      <div className="font-medium text-gray-900">
                                        {answer.questionLabel || field?.label || 'Unknown Field'}
                                      </div>
                                      <p className="text-sm text-gray-500 truncate">
                                        {answer.answer || '(no answer)'}
                                      </p>
                                      {field?.answerType && (
                                        <span className="text-xs text-gray-400">
                                          {field.answerType} ·
                                          {answer.source ? (
                                            <Badge variant="secondary" size="xs">
                                              {answer.source.replace('_', ' ').toUpperCase()}
                                            </Badge>
                                          ) : (
                                            <Badge variant="secondary" size="xs">MANUAL</Badge>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 space-x-2">
                                    {!isEditing && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setEditingAnswer(answer.questionKey)}
                                        className="p-1 hover:bg-gray-100 rounded-lg"
                                      >
                                        <Edit className="h-4 w-4 text-gray-500" />
                                      </Button>
                                    )}
                                    {isEditing && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={async () => {
                                            const formData = answerForm.getValues();
                                            const success = await saveAnswer(
                                              answer.questionKey,
                                              answer.questionLabel || field?.label || '',
                                              formData.answer
                                            );
                                            if (success) {
                                              setEditingAnswer(null);
                                              answerForm.reset({ answer: '' });
                                            }
                                          }}
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setEditingAnswer(null);
                                            answerForm.reset({ answer: answer.answer || '' });
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {isEditing && (
                                  <div className="mt-3 pt-2 border-t border-gray-200">
                                    <form onSubmit={(e) => {
                                      e.preventDefault();
                                      const formData = answerForm.getValues();
                                      saveAnswer(
                                        answer.questionKey,
                                        answer.questionLabel || field?.label || '',
                                        formData.answer
                                      ).then(() => {
                                        setEditingAnswer(null);
                                        answerForm.reset({ answer: '' });
                                      });
                                    }}>
                                      <div className="space-y-2">
                                        {/* Dynamic form fields based on answer type */}
                                        {(() => {
                                          const fieldType = field?.answerType || inferAnswerType(answer.answer || '');

                                          // Update form resolver based on type
                                          answerForm.resolver = zodResolver(
                                            fieldType === 'text' ? textAnswerSchema :
                                            fieldType === 'boolean' ? booleanAnswerSchema :
                                            fieldType === 'number' ? numberAnswerSchema :
                                            fieldType === 'choice' ? choiceAnswerSchema :
                                            fieldType === 'multiselect' ? multiselectAnswerSchema :
                                            textAnswerSchema
                                          );

                                          switch (fieldType) {
                                            case 'text':
                                              return (
                                                <input
                                                  {...answerForm.getFieldProps('answer')}
                                                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  placeholder="Enter answer..."
                                                  defaultValue={answer.answer || ''}
                                                />
                                              );
                                            case 'boolean':
                                              return (
                                                <Select
                                                  {...answerForm.getFieldProps('answer')}
                                                  className="w-full"
                                                >
                                                  <SelectValue placeholder="Select an option" />
                                                  <SelectContent>
                                                    <SelectItem value="true">Yes</SelectItem>
                                                    <SelectItem value="false">No</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              );
                                            case 'number':
                                              return (
                                                <input
                                                  {...answerForm.getFieldProps('answer')}
                                                  type="number"
                                                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  placeholder="Enter a number..."
                                                  defaultValue={answer.answer || ''}
                                                />
                                              );
                                            case 'choice':
                                              const options = field?.options || [];
                                              return (
                                                <Select
                                                  {...answerForm.getFieldProps('answer')}
                                                  className="w-full"
                                                >
                                                  <SelectValue placeholder="Select an option" />
                                                  <SelectContent>
                                                    {options.map(option => (
                                                      <SelectItem key={option} value={option}>
                                                        {option}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              );
                                            case 'multiselect':
                                              return (
                                                <textarea
                                                  {...answerForm.getFieldProps('answer')}
                                                  className="w-full min-h-[80px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  placeholder="Enter answers separated by commas..."
                                                  defaultValue={answer.answer || ''}
                                                />
                                              );
                                            default:
                                              return (
                                                <input
                                                  {...answerForm.getFieldProps('answer')}
                                                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                  placeholder="Enter answer..."
                                                  defaultValue={answer.answer || ''}
                                                />
                                              );
                                          }
                                        })()}
                                      </div>
                                    </form>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </TabsContent>

                <TabsContent value="table">
                  {/* Table view */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Question</TableHead>
                          <TableHead className="w-[150px]">Answer</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="w-[80px]">Source</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {answers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan="5" className="text-center py-4">
                              <p className="text-sm text-gray-500">
                                No screening answers found
                              </p>
                            </TableCell>
                          </TableRow>
                        ) : (
                          answers.map(answer => {
                            const field = lookupCatalogField(answer.questionKey, answer.questionLabel);
                            const sourceBadge = answer.source ? (
                              <Badge variant="secondary" size="xs">
                                {answer.source.replace('_', ' ').toUpperCase()}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" size="xs">MANUAL</Badge>
                            );

                            return (
                              <TableRow key={answer.questionKey} className="hover:bg-gray-50">
                                <TableCell className="font-medium text-gray-900 w-[200px]">
                                  {answer.questionLabel || field?.label || 'Unknown Field'}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate text-sm">
                                  {answer.answer || '(no answer)'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span className="text-gray-500">{field?.answerType || 'text'}</span>
                                </TableCell>
                                <TableCell className="text-center w-[80px]">
                                  {sourceBadge}
                                </TableCell>
                                <TableCell className="text-center w-[100px] space-x-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingAnswer(answer.questionKey)}
                                    className="p-1 hover:bg-gray-100 rounded-lg"
                                  >
                                    <Edit className="h-4 w-4 text-gray-500" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    ghost
                                    size="icon"
                                    onClick={() => deleteAnswer(answer.questionKey)}
                                    className="p-1 hover:bg-red-50 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="stats">
                  {/* Detailed statistics */}
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Answer Type Distribution
                      </h2>
                      <div className="space-y-3">
                        {['text', 'boolean', 'number', 'choice', 'multiselect'].map(type => {
                          const count = answers.reduce((sum, ans) => {
                            const field = lookupCatalogField(ans.questionKey, ans.questionLabel);
                            const ansType = field?.answerType || inferAnswerType(ans.answer || '');
                            return sum + (ansType === type ? 1 : 0);
                          }, 0);
                          const percentage = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0;

                          return (
                            <motion.div
                              key={`type-${type}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.random() * 0.2 }}
                              className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50">
                                  {[type].map(t => {
                                    switch (t) {
                                      case 'text': return <Edit className="h-4 w-4 text-blue-500" />;
                                      case 'boolean': return <CheckCircle className="h-4 w-4 text-blue-500" />;
                                      case 'number': return <Badge className="h-4 w-4 text-blue-500">#</Badge>;
                                      case 'choice': return <Select className="h-4 w-4 text-blue-500" />;
                                      case 'multiselect': return <Badge className="h-4 w-4 text-blue-500">+</Badge>;
                                      default: return <Edit className="h-4 w-4 text-blue-500" />;
                                    }
                                  }) || <Edit className="h-4 w-4 text-blue-500" />}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{type}</p>
                                  <p className="text-sm text-gray-500">{count} answers</p>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className="bg-blue-500 h-2.5 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="text-right text-sm font-medium text-gray-900">
                                {percentage}%
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Category Distribution
                      </h2>
                      <div className="space-y-3">
                        {[ScreeningFieldCategory.profile, ScreeningFieldCategory.preferences, ScreeningFieldCategory.screening].map(category => {
                          const count = groupedAnswers[category].length;
                          const percentage = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0;

                          return (
                            <motion.div
                              key={`category-${category}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.random() * 0.2 }}
                              className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50">
                                  {[
                                    SCREENING_SECTION_META[category].icon
                                  ].map(icon => {
                                    switch (icon) {
                                      case 'User': return <User className="h-4 w-4 text-blue-500" />;
                                      case 'Sliders': return <Sliders className="h-4 w-4 text-blue-500" />;
                                      case 'List': return <List className="h-4 w-4 text-blue-500" />;
                                      default: return <Edit className="h-4 w-4 text-blue-500" />;
                                    }
                                  }) || <Edit className="h-4 w-4 text-blue-500" />}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{SCREENING_SECTION_META[category].title}</p>
                                  <p className="text-sm text-gray-500">{count} answers</p>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className="bg-blue-500 h-2.5 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="text-right text-sm font-medium text-gray-900">
                                {percentage}%
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Source Distribution
                      </h2>
                      <div className="space-y-3">
                        {Object.entries(stats.sources).map(([source, count]) => {
                          const percentage = answers.length > 0 ? Math.round((count / answers.length) * 100) : 0;

                          return (
                            <motion.div
                              key={`source-${source}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.random() * 0.2 }}
                              className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-50">
                                  <Edit className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{source.replace('_', ' ').toUpperCase()}</p>
                                  <p className="text-sm text-gray-500">{count} answers</p>
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className="bg-blue-500 h-2.5 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="text-right text-sm font-medium text-gray-900">
                                {percentage}%
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreeningAnswersPage;