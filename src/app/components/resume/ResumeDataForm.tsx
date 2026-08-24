import { useState } from "react";
import {
  Save,
  Loader2,
  User,
  FileText,
  Sparkles,
  Briefcase,
  FolderGit2,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import SkillsInput from "./SkillsInput";
import ExperienceEditor from "./ExperienceEditor";
import ProjectsEditor from "./ProjectsEditor";
import EducationEditor from "./EducationEditor";

export type ResumeFormData = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  currentCity: string;
  linkedinUrl: string;
  portfolioUrl: string;
  summary: string;
  skills: { frontend: string[]; backend: string[]; other: string[] };
  experience: Array<{
    title: string;
    company: string;
    location?: string;
    startDate: string;
    endDate?: string;
    description?: string[];
  }>;
  projects: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    link?: string;
  }>;
  education: Array<{
    degree: string;
    field?: string;
    institution: string;
    location?: string;
    startDate?: string;
    endDate?: string;
  }>;
};

type Props = {
  data: ResumeFormData;
  onChange: (data: ResumeFormData) => void;
  onSave: () => void;
  isSaving: boolean;
};

type TabKey = "personal" | "summary" | "skills" | "experience" | "projects" | "education";

export default function ResumeDataForm({ data, onChange, onSave, isSaving }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("personal");

  const update = <K extends keyof ResumeFormData>(field: K, value: ResumeFormData[K]) => {
    onChange({ ...data, [field]: value });
  };

  const totalSkills =
    (data.skills?.frontend?.length || 0) +
    (data.skills?.backend?.length || 0) +
    (data.skills?.other?.length || 0);

  const tabs: Array<{
    id: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    isComplete?: boolean;
  }> = [
    {
      id: "personal",
      label: "Personal",
      icon: User,
      isComplete: Boolean(data.name && data.email),
    },
    {
      id: "summary",
      label: "Summary",
      icon: FileText,
      isComplete: Boolean(data.summary?.trim()),
    },
    {
      id: "skills",
      label: "Skills",
      icon: Sparkles,
      count: totalSkills,
      isComplete: totalSkills > 0,
    },
    {
      id: "experience",
      label: "Experience",
      icon: Briefcase,
      count: data.experience?.length || 0,
      isComplete: (data.experience?.length || 0) > 0,
    },
    {
      id: "projects",
      label: "Projects",
      icon: FolderGit2,
      count: data.projects?.length || 0,
      isComplete: (data.projects?.length || 0) > 0,
    },
    {
      id: "education",
      label: "Education",
      icon: GraduationCap,
      count: data.education?.length || 0,
      isComplete: (data.education?.length || 0) > 0,
    },
  ];

  const currentTabIndex = tabs.findIndex((t) => t.id === activeTab);
  const prevTab = currentTabIndex > 0 ? tabs[currentTabIndex - 1] : null;
  const nextTab = currentTabIndex < tabs.length - 1 ? tabs[currentTabIndex + 1] : null;

  return (
    <div className="space-y-4">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-gray-100">
        <div>
          <h2 className="text-base font-bold text-gray-900 leading-tight">Edit Resume Data</h2>
          <p className="text-xs text-gray-500 mt-0.5">Edit each section using the tabs below</p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-semibold hover:shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{isSaving ? "Saving..." : "Save"}</span>
        </button>
      </div>

      {/* Tabs Toggle Bar */}
      <div className="bg-gray-100/80 p-1 rounded-xl flex flex-wrap gap-1 border border-gray-200/60">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? "gradient-primary text-white shadow-2xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/70"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.isComplete && !isActive && typeof tab.count !== "number" && (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200/80 shadow-xs min-h-[360px]">
        {/* Tab 1: Personal Information */}
        {activeTab === "personal" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-600" />
                Personal Information
              </h3>
              <p className="text-xs text-gray-500">Your core contact information and professional headline.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Headline
                </label>
                <input
                  type="text"
                  value={data.headline}
                  onChange={(e) => update("headline", e.target.value)}
                  placeholder="Headline (e.g. Full Stack Developer)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="Email"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="Phone Number"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Location / City
                </label>
                <input
                  type="text"
                  value={data.currentCity}
                  onChange={(e) => update("currentCity", e.target.value)}
                  placeholder="City, State / Country (e.g. Mohali, Punjab)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={data.linkedinUrl}
                  onChange={(e) => update("linkedinUrl", e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Portfolio / Website URL
                </label>
                <input
                  type="url"
                  value={data.portfolioUrl}
                  onChange={(e) => update("portfolioUrl", e.target.value)}
                  placeholder="https://yourportfolio.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Professional Summary */}
        {activeTab === "summary" && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                Professional Summary
              </h3>
              <p className="text-xs text-gray-500">
                A brief 2–4 sentence summary highlighting your experience, strengths, and goals.
              </p>
            </div>

            <div className="pt-2">
              <textarea
                value={data.summary}
                onChange={(e) => update("summary", e.target.value)}
                placeholder="Write 2-4 sentences about your professional background, core expertise, and key accomplishments..."
                rows={6}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs leading-relaxed resize-none"
              />
              <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1">
                <span>Recommended: 50–100 words</span>
                <span>{data.summary?.length || 0} characters</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Skills */}
        {activeTab === "skills" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Skills & Technologies
              </h3>
              <p className="text-xs text-gray-500">Add key technical and soft skills organized by category.</p>
            </div>

            <div className="space-y-3.5 pt-1">
              <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                <SkillsInput
                  label="Frontend"
                  skills={data.skills?.frontend || []}
                  onChange={(skills) => update("skills", { ...data.skills, frontend: skills })}
                />
              </div>

              <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                <SkillsInput
                  label="Backend"
                  skills={data.skills?.backend || []}
                  onChange={(skills) => update("skills", { ...data.skills, backend: skills })}
                />
              </div>

              <div className="p-3 bg-gray-50/50 rounded-lg border border-gray-100">
                <SkillsInput
                  label="Other (Tools, DevOps, Cloud, etc.)"
                  skills={data.skills?.other || []}
                  onChange={(skills) => update("skills", { ...data.skills, other: skills })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Experience */}
        {activeTab === "experience" && (
          <div className="animate-in fade-in duration-150">
            <ExperienceEditor
              items={data.experience || []}
              onChange={(items) => update("experience", items)}
            />
          </div>
        )}

        {/* Tab 5: Projects */}
        {activeTab === "projects" && (
          <div className="animate-in fade-in duration-150">
            <ProjectsEditor
              items={data.projects || []}
              onChange={(items) => update("projects", items)}
            />
          </div>
        )}

        {/* Tab 6: Education */}
        {activeTab === "education" && (
          <div className="animate-in fade-in duration-150">
            <EducationEditor
              items={data.education || []}
              onChange={(items) => update("education", items)}
            />
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="flex items-center justify-between pt-2">
        {prevTab ? (
          <button
            type="button"
            onClick={() => setActiveTab(prevTab.id)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous: {prevTab.label}</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {nextTab && (
            <button
              type="button"
              onClick={() => setActiveTab(nextTab.id)}
              className="px-3.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 transition-colors flex items-center gap-1"
            >
              <span>Next: {nextTab.label}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-semibold hover:shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
