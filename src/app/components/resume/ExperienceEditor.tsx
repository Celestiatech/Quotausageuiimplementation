import { Briefcase, Plus, Trash2, GripVertical } from "lucide-react";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          Experience
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
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={item.title ?? ""}
              onChange={(e) => update(idx, "title", e.target.value)}
              placeholder="Job Title"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.company ?? ""}
              onChange={(e) => update(idx, "company", e.target.value)}
              placeholder="Company"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.location || ""}
              onChange={(e) => update(idx, "location", e.target.value)}
              placeholder="Location"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={item.startDate ?? ""}
                onChange={(e) => update(idx, "startDate", e.target.value)}
                placeholder="Start (e.g. Jan 2020)"
                className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
              />
              <input
                type="text"
                value={item.endDate || ""}
                onChange={(e) => update(idx, "endDate", e.target.value)}
                placeholder="End or Present"
                className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500">Bullet Points</label>
            {(item.description || [""]).map((bullet, bIdx) => (
              <div key={bIdx} className="flex gap-2">
                <input
                  type="text"
                  value={bullet ?? ""}
                  onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                  placeholder="Describe your contribution..."
                  className="flex-1 px-3 py-1.5 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeBullet(idx, bIdx)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addBullet(idx)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add bullet point
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
