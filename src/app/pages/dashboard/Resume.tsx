import { useNavigate } from "react-router";
import { ExternalLink, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Resume() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume Setup</h1>
          <p className="text-gray-600">CareerPilot uses the latest resume attached in LinkedIn Easy Apply.</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/onboarding")}
          className="px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors"
        >
          Open Onboarding
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border-2 border-gray-200 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Upload Resume On LinkedIn</h2>
          <p className="text-sm text-gray-700">
            Open LinkedIn Jobs and ensure your newest resume is attached in Easy Apply. Copilot auto-picks the latest
            attached resume option from LinkedIn.
          </p>
          <a
            href="https://www.linkedin.com/jobs/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-800 font-semibold hover:bg-gray-50"
          >
            Open LinkedIn Jobs
            <ExternalLink className="w-4 h-4" />
          </a>
          <div className="text-sm text-gray-600">
            If LinkedIn asks for a resume during apply, upload there once. Future applies reuse the latest attached
            resume automatically.
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3">Resume Source</h3>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FileText className="w-4 h-4" />
              <span>LinkedIn Easy Apply (latest attached resume)</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Copilot Status
            </h3>
            <p className="text-sm text-gray-600">
              {user?.onboardingCompleted
                ? "Onboarding is complete. Copilot can fill forms using your saved profile answers."
                : "Complete onboarding to sync your profile answers to the extension."}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            For safety, resume files are managed on LinkedIn and are not publicly hosted by this app.
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Legacy Resume Name</h3>
            <p className="text-sm text-gray-600">
              {user?.resumeFileName ? user.resumeFileName : "No legacy uploaded file metadata found."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
