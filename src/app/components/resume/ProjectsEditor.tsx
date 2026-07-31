import { FolderGit2, Plus, Trash2 } from "lucide-react";

type Project = {
  name: string;
  description?: string;
  technologies?: string[];
  link?: string;
};

type Props = {
  items: Project[];
  onChange: (items: Project[]) => void;
};

function empty(): Project {
  return { name: "", description: "", technologies: [""], link: "" };
}

export default function ProjectsEditor({ items, onChange }: Props) {
  const update = (index: number, field: keyof Project, value: unknown) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const updateTech = (projIdx: number, techIdx: number, value: string) => {
    const techs = [...(items[projIdx].technologies || [])];
    techs[techIdx] = value;
    update(projIdx, "technologies", techs);
  };

  const addTech = (projIdx: number) => {
    const techs = [...(items[projIdx].technologies || []), ""];
    update(projIdx, "technologies", techs);
  };

  const removeTech = (projIdx: number, techIdx: number) => {
    const techs = (items[projIdx].technologies || []).filter((_, i) => i !== techIdx);
    update(projIdx, "technologies", techs.length ? techs : [""]);
  };

  const addItem = () => onChange([...items, empty()]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FolderGit2 className="w-4 h-4" />
          Projects
        </h3>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="p-4 border-2 border-gray-100 rounded-xl bg-white/50 space-y-3 relative">
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={item.name ?? ""}
            onChange={(e) => update(idx, "name", e.target.value)}
            placeholder="Project Name"
            className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <textarea
            value={item.description || ""}
            onChange={(e) => update(idx, "description", e.target.value)}
            placeholder="Brief description..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm resize-none"
          />
          <input
            type="url"
            value={item.link || ""}
            onChange={(e) => update(idx, "link", e.target.value)}
            placeholder="Project URL (optional)"
            className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Technologies</label>
            {(item.technologies || [""]).map((tech, tIdx) => (
              <div key={tIdx} className="flex gap-2">
                <input
                  type="text"
                  value={tech ?? ""}
                  onChange={(e) => updateTech(idx, tIdx, e.target.value)}
                  placeholder="Technology"
                  className="flex-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeTech(idx, tIdx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addTech(idx)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add technology
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
