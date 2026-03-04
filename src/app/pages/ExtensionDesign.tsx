import { motion } from "motion/react";
import {
  Chrome,
  CheckCircle2,
  Activity,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  Sparkles,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";

const sampleLogs = [
  { level: "info", text: "Run started in live mode", time: "11:38:19" },
  { level: "info", text: "Found 7 job cards", time: "11:38:25" },
  { level: "info", text: "Application submitted", time: "11:38:34" },
  { level: "warn", text: "No Apply button on current job view", time: "11:38:54" },
  { level: "warn", text: "Daily cap reached (3/day). Stopping run.", time: "11:40:06" },
];

const pills = [
  { label: "Live Mode", tone: "bg-emerald-100 text-emerald-700" },
  { label: "Easy Apply Only", tone: "bg-sky-100 text-sky-700" },
  { label: "Daily Limit: 3", tone: "bg-amber-100 text-amber-700" },
];

export default function ExtensionDesign() {
  return (
    <div className="bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_50%,#f1f5f9_100%)]">
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-14 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 text-sm font-semibold mb-4 border border-indigo-200">
            <Sparkles className="w-4 h-4" />
            Extension Design Preview
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900">
            CareerPilot Chrome Extension UI
          </h1>
          <p className="text-slate-600 mt-4 text-lg">
            This page shows the visual design system for the extension panel: status, controls, run logs, and safety states.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 mt-12 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="rounded-lg border-2 border-slate-900 bg-white shadow-[0_20px_50px_rgba(2,6,23,0.20)] overflow-hidden"
          >
            <div className="px-5 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2 font-semibold">
                <Chrome className="w-4 h-4" />
                CareerPilot Copilot
              </div>
              <div className="text-xs px-2 py-1 rounded-md border border-emerald-400/40 bg-emerald-500/20 text-emerald-300">Connected</div>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-md bg-slate-50 border-2 border-slate-200 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Run State</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-2xl font-black text-slate-900">Running</div>
                  <div className="inline-flex items-center gap-1 text-emerald-700 text-sm font-semibold">
                    <Activity className="w-4 h-4" />
                    Live
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="rounded-md bg-white border-2 border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Applied</div>
                    <div className="text-xl font-extrabold text-emerald-700">3</div>
                  </div>
                  <div className="rounded-md bg-white border-2 border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Skipped</div>
                    <div className="text-xl font-extrabold text-amber-700">4</div>
                  </div>
                  <div className="rounded-md bg-white border-2 border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Failed</div>
                    <div className="text-xl font-extrabold text-rose-700">0</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {pills.map((pill) => (
                  <span key={pill.label} className={`text-xs px-2.5 py-1 rounded-md border font-semibold ${pill.tone}`}>
                    {pill.label}
                  </span>
                ))}
              </div>

              <div className="rounded-md border-2 border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-700 tracking-wide">
                  Live Logs
                </div>
                <div className="max-h-64 overflow-auto">
                  {sampleLogs.map((log, i) => (
                    <div key={`${log.text}-${i}`} className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {log.level === "warn" ? (
                          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm text-slate-700 truncate">{log.text}</span>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{log.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors border border-emerald-700">
                  <PlayCircle className="w-4 h-4" />
                  Start
                </button>
                <button className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors border border-amber-600">
                  <PauseCircle className="w-4 h-4" />
                  Pause
                </button>
                <button className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition-colors border border-slate-300">
                  Stop
                </button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="space-y-5"
          >
            <div className="rounded-md bg-white border-2 border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900">Design Goals</h2>
              <ul className="mt-3 space-y-2 text-slate-600 text-sm">
                <li>Fast status readability with large metric cards.</li>
                <li>Safe controls for Start, Pause, Stop with clear visual priority.</li>
                <li>High-signal logs for debugging and trust.</li>
                <li>Compact panel that still works on smaller laptop screens.</li>
              </ul>
            </div>

            <div className="rounded-md bg-white border-2 border-slate-200 p-5">
              <h2 className="text-xl font-bold text-slate-900">State UX</h2>
              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border-2 border-slate-200 p-3">
                  <div className="font-semibold text-slate-800">Running</div>
                  <div className="text-slate-600 mt-1">Live counters, auto log streaming, active controls.</div>
                </div>
                <div className="rounded-md border-2 border-slate-200 p-3">
                  <div className="font-semibold text-slate-800">Paused</div>
                  <div className="text-slate-600 mt-1">Freeze automation but keep panel context and logs.</div>
                </div>
                <div className="rounded-md border-2 border-slate-200 p-3">
                  <div className="font-semibold text-slate-800">Daily Cap Reached</div>
                  <div className="text-slate-600 mt-1">Clear warning state with auto stop and resume hint.</div>
                </div>
                <div className="rounded-md border-2 border-slate-200 p-3">
                  <div className="font-semibold text-slate-800">Extension Missing</div>
                  <div className="text-slate-600 mt-1">Actionable install/reload instructions shown first.</div>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-slate-950 text-slate-100 p-5 border-2 border-slate-800">
              <div className="flex items-center gap-2 font-semibold">
                <MonitorSmartphone className="w-4 h-4" />
                Responsive Behavior
              </div>
              <p className="text-sm text-slate-300 mt-2">
                The preview is designed for desktop and compact laptop widths. Cards stack cleanly and log area remains usable.
              </p>
              <div className="flex items-center gap-2 mt-4 text-emerald-300 text-sm">
                <ShieldCheck className="w-4 h-4" />
                Safety-first interactions and visible run state.
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
