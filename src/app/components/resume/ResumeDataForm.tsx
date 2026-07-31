import { Save, Loader2 } from "lucide-react";
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

export default function ResumeDataForm({ data, onChange, onSave, isSaving }: Props) {
  const update = <K extends keyof ResumeFormData>(field: K, value: ResumeFormData[K]) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Edit Resume Data</h2>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-gradient-to-r from-[#6366F1] to-[#A855F7] text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-2xl p-5 border-2 border-gray-200 space-y-4">
        <h3 className="font-bold text-gray-900">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Full Name"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <input
            type="text"
            value={data.headline}
            onChange={(e) => update("headline", e.target.value)}
            placeholder="Headline (e.g. Full Stack Developer)"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <input
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="Email"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="Phone"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <input
            type="text"
            value={data.currentCity}
            onChange={(e) => update("currentCity", e.target.value)}
            placeholder="City / Location"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <input
            type="url"
            value={data.linkedinUrl}
            onChange={(e) => update("linkedinUrl", e.target.value)}
            placeholder="LinkedIn URL"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <input
            type="url"
            value={data.portfolioUrl}
            onChange={(e) => update("portfolioUrl", e.target.value)}
            placeholder="Portfolio URL"
            className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-2xl p-5 border-2 border-gray-200 space-y-3">
        <h3 className="font-bold text-gray-900">Professional Summary</h3>
        <textarea
          value={data.summary}
          onChange={(e) => update("summary", e.target.value)}
          placeholder="Write 2-4 sentences about your professional background..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm resize-none"
        />
      </div>

      {/* Skills */}
      <div className="bg-white rounded-2xl p-5 border-2 border-gray-200 space-y-4">
        <h3 className="font-bold text-gray-900">Skills</h3>
        <SkillsInput
          label="Frontend"
          skills={data.skills.frontend}
          onChange={(skills) => update("skills", { ...data.skills, frontend: skills })}
        />
        <SkillsInput
          label="Backend"
          skills={data.skills.backend}
          onChange={(skills) => update("skills", { ...data.skills, backend: skills })}
        />
        <SkillsInput
          label="Other (Tools, DevOps, etc.)"
          skills={data.skills.other}
          onChange={(skills) => update("skills", { ...data.skills, other: skills })}
        />
      </div>

      {/* Experience */}
      <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
        <ExperienceEditor
          items={data.experience}
          onChange={(items) => update("experience", items)}
        />
      </div>

      {/* Projects */}
      <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
        <ProjectsEditor
          items={data.projects}
          onChange={(items) => update("projects", items)}
        />
      </div>

      {/* Education */}
      <div className="bg-white rounded-2xl p-5 border-2 border-gray-200">
        <EducationEditor
          items={data.education}
          onChange={(items) => update("education", items)}
        />
      </div>
    </div>
  );
}
