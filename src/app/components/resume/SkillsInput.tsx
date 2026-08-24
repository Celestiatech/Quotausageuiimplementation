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
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">{label}</label>
        <span className="text-[10px] text-gray-400 font-medium">{skills.length} skills</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-xs font-semibold border border-purple-100 shadow-2xs"
          >
            {skill}
            <button
              type="button"
              onClick={() => removeSkill(skill)}
              className="text-purple-400 hover:text-purple-700 transition-colors"
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
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs"
        />
        <button
          type="button"
          onClick={addSkill}
          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>
    </div>
  );
}
