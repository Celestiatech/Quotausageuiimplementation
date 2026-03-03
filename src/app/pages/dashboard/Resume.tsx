import { useState } from "react";
import { useNavigate } from "react-router";
import { FileUp, FileText, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Resume() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const onUpload = async (file: File) => {
    try {
      setIsUploading(true);
      setMessage("");
      setError("");
      const fd = new FormData();
      fd.append("resume", file);
      const res = await fetch("/api/user/resume/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.message || "Resume upload failed");
      await refreshUser();
      setMessage(`Uploaded ${data?.data?.fileName || file.name} successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Builder</h1>
          <p className="text-gray-600">Manage your resume file used for auto-apply runs.</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/onboarding")}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
        >
          Open Onboarding
        </button>
      </div>

      {message ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border-2 border-gray-200 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Upload Resume</h2>
          <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors cursor-pointer">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <FileUp className="w-8 h-8 text-purple-600" />
              <div className="font-semibold text-gray-900">{isUploading ? "Uploading..." : "Click to upload resume"}</div>
              <div className="text-sm text-gray-500">PDF, DOCX, TXT up to configured size</div>
            </div>
          </label>
          <div className="text-sm text-gray-600">
            Resume parsing auto-fills onboarding fields like name, phone, city, and profile links when detected.
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3">Current Resume</h3>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FileText className="w-4 h-4" />
              <span>{user?.resumeFileName || "No resume uploaded yet"}</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              AI Resume Status
            </h3>
            <p className="text-sm text-gray-600">
              {user?.resumeFileName
                ? "Resume file is available for auto-apply and profile extraction."
                : "Upload a resume to enable better form autofill and matching."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
