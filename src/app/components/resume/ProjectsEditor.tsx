import { FolderGit2, Plus, Trash2, Link as LinkIcon, X } from "lucide-react";

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
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-purple-600" />
            Projects & Portfolio
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Showcase your notable projects, client builds, and applications.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Project
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-2">No projects added yet.</p>
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition-colors"
          >
            + Add First Project
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="p-3.5 border border-gray-200/80 rounded-xl bg-gray-50/40 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Project #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                title="Remove project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Project Name</label>
                <input
                  type="text"
                  value={item.name ?? ""}
                  onChange={(e) => update(idx, "name", e.target.value)}
                  placeholder="e.g. Social Media Clones"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Project / Demo URL</label>
                <input
                  type="url"
                  value={item.link ?? ""}
                  onChange={(e) => update(idx, "link", e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Description</label>
                <input
                  type="text"
                  value={item.description ?? ""}
                  onChange={(e) => update(idx, "description", e.target.value)}
                  placeholder="Brief summary of what the project does..."
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-gray-700">Technologies Used</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {(item.technologies || [""]).map((tech, tIdx) => (
                  <div key={tIdx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tech ?? ""}
                      onChange={(e) => updateTech(idx, tIdx, e.target.value)}
                      placeholder="e.g. React"
                      className="w-28 px-2.5 py-1 rounded-md border border-gray-200 focus:border-purple-400 focus:ring-1 focus:ring-purple-100 outline-none text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeTech(idx, tIdx)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Remove tech"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addTech(idx)}
                  className="px-2.5 py-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add tech</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
