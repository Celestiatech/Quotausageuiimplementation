import { Briefcase, Plus, Trash2 } from "lucide-react";

type Experience = {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  description?: string[];
};

type Props = {
  items: Experience[];
  onChange: (items: Experience[]) => void;
};

function empty(): Experience {
  return { title: "", company: "", location: "", startDate: "", endDate: "", description: [""] };
}

export default function ExperienceEditor({ items, onChange }: Props) {
  const update = (index: number, field: keyof Experience, value: unknown) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const updateBullet = (expIdx: number, bulletIdx: number, value: string) => {
    const desc = [...(items[expIdx].description || [])];
    desc[bulletIdx] = value;
    update(expIdx, "description", desc);
  };

  const addBullet = (expIdx: number) => {
    const desc = [...(items[expIdx].description || []), ""];
    update(expIdx, "description", desc);
  };

  const removeBullet = (expIdx: number, bulletIdx: number) => {
    const desc = (items[expIdx].description || []).filter((_, i) => i !== bulletIdx);
    update(expIdx, "description", desc.length ? desc : [""]);
  };

  const addItem = () => onChange([...items, empty()]);
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-purple-600" />
            Work Experience
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Add your professional roles, responsibilities, and achievements.</p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Role
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
          <p className="text-xs text-gray-500 mb-2">No work experience added yet.</p>
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition-colors"
          >
            + Add First Experience
          </button>
        </div>
      ) : null}

      {items.map((item, idx) => (
        <div key={idx} className="p-3.5 border border-gray-200/80 rounded-xl bg-gray-50/40 space-y-2.5 relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Experience #{idx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
              title="Remove this role"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Job Title</label>
              <input
                type="text"
                value={item.title ?? ""}
                onChange={(e) => update(idx, "title", e.target.value)}
                placeholder="e.g. Full Stack Developer"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Company</label>
              <input
                type="text"
                value={item.company ?? ""}
                onChange={(e) => update(idx, "company", e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Location</label>
              <input
                type="text"
                value={item.location || ""}
                onChange={(e) => update(idx, "location", e.target.value)}
                placeholder="e.g. Mohali, India or Remote"
                className="w-full px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Start Date</label>
                <input
                  type="text"
                  value={item.startDate ?? ""}
                  onChange={(e) => update(idx, "startDate", e.target.value)}
                  placeholder="e.g. 10/2023"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">End Date</label>
                <input
                  type="text"
                  value={item.endDate || ""}
                  onChange={(e) => update(idx, "endDate", e.target.value)}
                  placeholder="e.g. Present"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-semibold text-gray-700">Bullet Points / Key Responsibilities</label>
            {(item.description || [""]).map((bullet, bIdx) => (
              <div key={bIdx} className="flex gap-2">
                <input
                  type="text"
                  value={bullet ?? ""}
                  onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                  placeholder="Describe key achievement or responsibility..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => removeBullet(idx, bIdx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                  title="Remove bullet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addBullet(idx)}
              className="text-xs text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center gap-1 mt-0.5"
            >
              <Plus className="w-3 h-3" />
              <span>Add bullet point</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
