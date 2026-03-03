import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";

type Extracted = {
  name?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  currentCity?: string;
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    currentCity: user?.currentCity || "",
    addressLine: user?.addressLine || "",
    linkedinUrl: user?.linkedinUrl || "",
    portfolioUrl: user?.portfolioUrl || "",
  });
  const hasResume = Boolean(user?.resumeFileName);

  const applyExtracted = (extracted: Extracted) => {
    setForm((prev) => ({
      ...prev,
      name: extracted.name || prev.name,
      phone: extracted.phone || prev.phone,
      currentCity: extracted.currentCity || prev.currentCity,
      linkedinUrl: extracted.linkedinUrl || prev.linkedinUrl,
      portfolioUrl: extracted.portfolioUrl || prev.portfolioUrl,
    }));
  };

  const onUploadResume = async (file: File) => {
    setIsUploading(true);
    setError("");
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/user/resume/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Resume upload failed");
      applyExtracted(data?.data?.extracted || {});
      setMessage("Resume uploaded and details auto-filled");
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasResume) {
      setError("Resume is required. Please upload your CV before continuing.");
      return;
    }
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Failed to save onboarding");
      await refreshUser();
      setMessage("Onboarding saved");
      navigate("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save onboarding");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Complete Your Onboarding</h1>
        <p className="text-gray-600 mt-1">Add contact details and upload your CV to auto-fill profile fields.</p>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
        <label className="block text-sm font-semibold text-gray-700">Upload CV (PDF/DOCX/TXT)</label>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUploadResume(f);
          }}
          className="block w-full text-sm text-gray-700"
        />
        {isUploading && <p className="text-sm text-blue-600">Uploading and extracting details...</p>}
        {user?.resumeFileName ? (
          <p className="text-sm text-emerald-700">Uploaded: {user.resumeFileName}</p>
        ) : (
          <p className="text-sm text-amber-700">Resume is required to complete onboarding.</p>
        )}
      </div>

      <form onSubmit={onSave} className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        {message && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</div>}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300" required />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Current City</label>
            <input value={form.currentCity} onChange={(e) => setForm({ ...form, currentCity: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
          <input value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300" required />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">LinkedIn URL</label>
            <input type="url" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Portfolio URL</label>
            <input type="url" value={form.portfolioUrl} onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300" required />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || !hasResume}
          className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save & Continue"}
        </button>
      </form>
    </div>
  );
}
