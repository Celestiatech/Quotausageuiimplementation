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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <GraduationCap className="w-4 h-4" />
          Education
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
              value={item.degree ?? ""}
              onChange={(e) => update(idx, "degree", e.target.value)}
              placeholder="Degree (e.g. B.Tech)"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.field ?? ""}
              onChange={(e) => update(idx, "field", e.target.value)}
              placeholder="Field of study"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.institution ?? ""}
              onChange={(e) => update(idx, "institution", e.target.value)}
              placeholder="Institution"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.location || ""}
              onChange={(e) => update(idx, "location", e.target.value)}
              placeholder="Location"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.startDate || ""}
              onChange={(e) => update(idx, "startDate", e.target.value)}
              placeholder="Start year"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
            <input
              type="text"
              value={item.endDate || ""}
              onChange={(e) => update(idx, "endDate", e.target.value)}
              placeholder="End year"
              className="px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all outline-none text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
