import { GraduationCap, Plus, Trash2 } from "lucide-react";

type Education = {
  degree: string;
  field?: string;
  institution: string;
  location?: string;
  startDate?: string;
  endDate?: string;
};

type Props = {
  items: Education[];
  onChange: (items: Education[]) => void;
};

function empty(): Education {
  return { degree: "", field: "", institution: "", location: "", startDate: "", endDate: "" };
}

export default function EducationEditor({ items, onChange }: Props) {
  const update = (index: number, field: keyof Education, value: string) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const addItem = () => onChange([...items, empty()]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
            Education & Degrees
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Add your academic background, degrees, and certifications.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Education
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-2">No education entries added yet.</p>
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition-colors"
          >
            + Add First Education
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="p-3.5 border border-gray-200/80 rounded-xl bg-gray-50/40 space-y-2.5 relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Education #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                title="Remove education"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Degree / Certificate</label>
                <input
                  type="text"
                  value={item.degree ?? ""}
                  onChange={(e) => update(idx, "degree", e.target.value)}
                  placeholder="e.g. B.Tech / Bachelor of Science"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Field of Study</label>
                <input
                  type="text"
                  value={item.field || ""}
                  onChange={(e) => update(idx, "field", e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Institution / University</label>
                <input
                  type="text"
                  value={item.institution ?? ""}
                  onChange={(e) => update(idx, "institution", e.target.value)}
                  placeholder="e.g. Stanford University"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Location</label>
                <input
                  type="text"
                  value={item.location || ""}
                  onChange={(e) => update(idx, "location", e.target.value)}
                  placeholder="e.g. California, USA"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Start Date</label>
                <input
                  type="text"
                  value={item.startDate || ""}
                  onChange={(e) => update(idx, "startDate", e.target.value)}
                  placeholder="e.g. 2018"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">End Date / Graduation</label>
                <input
                  type="text"
                  value={item.endDate || ""}
                  onChange={(e) => update(idx, "endDate", e.target.value)}
                  placeholder="e.g. 2022"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
