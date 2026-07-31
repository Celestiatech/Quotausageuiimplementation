import { useState, KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";

type SkillsInputProps = {
  label: string;
  skills: string[];
  onChange: (skills: string[]) => void;
};

export default function SkillsInput({ label, skills, onChange }: SkillsInputProps) {
  const [input, setInput] = useState("");

  const addSkill = () => {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill();
    }
  };

  const removeSkill = (skill: string) => {
    onChange(skills.filter((s) => s !== skill));
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-200"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="hover:text-indigo-900 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type and press Enter..."
          className="flex-1 px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
        />
        <button
          type="button"
          onClick={addSkill}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
