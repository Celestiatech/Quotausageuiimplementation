import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mic,
  MicOff,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useClientAssist } from "../../hooks/useClientAssist";
import type { AssistTone } from "../../hooks/useInterviewAssist";

const TONES: Array<{ id: AssistTone; label: string; hint: string }> = [
  { id: "concise", label: "Concise", hint: "Short, punchy" },
  { id: "detailed", label: "Detailed", hint: "Full, thorough" },
  { id: "star", label: "STAR", hint: "Structured story" },
];

const EXT_SOURCE = "CP_ASSIST_EXT";
const PAGE_SOURCE = "CP_ASSIST_PAGE";

export default function ClientAssistant() {
  const [tone, setTone] = useState<AssistTone>("concise");
  const [copied, setCopied] = useState(false);
  const [extState, setExtState] = useState<"checking" | "installed" | "missing">("checking");
  const [extVersion, setExtVersion] = useState("");
  const { supported, listening, transcript, loading, error, data, toggleListening, resetTranscript, setExternalQuestion, generateAnswer, clear } =
    useClientAssist(tone);
  const runRef = useRef(generateAnswer);
  runRef.current = generateAnswer;

  const onPong = useCallback((event: MessageEvent) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.source !== EXT_SOURCE || msg.type !== "CP_ASSIST_PONG") return;
    setExtVersion(String(msg.version || ""));
    setExtState("installed");
  }, []);

  // Keep pinging until the extension answers. A content script only injects on
  // page load, so we retry for ~8s on mount and keep listening afterwards so an
  // install (or reload) is picked up without the user having to click anything.
  const detectExtension = useCallback(() => {
    const ping = () => window.postMessage({ source: PAGE_SOURCE, type: "CP_ASSIST_PING" }, "*");
    let attempts = 0;
    const maxAttempts = 8;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.clearInterval(interval);
        setExtState((prev) => (prev === "checking" ? "missing" : prev));
      } else {
        ping();
      }
    }, 1000);
    ping();
    setExtState("checking");
  }, []);

  useEffect(() => {
    window.addEventListener("message", onPong);
    void detectExtension();
    return () => window.removeEventListener("message", onPong);
  }, [onPong, detectExtension]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.source !== EXT_SOURCE || msg.type !== "CP_ASSIST_QUESTION") return;

      const requestId = String(msg.requestId || "");
      const question = String(msg.question || "").trim();
      if (!question) return;

      const requestedTone: AssistTone = msg.tone === "concise" || msg.tone === "detailed" || msg.tone === "star" ? msg.tone : "concise";
      setTone(requestedTone);
      setExternalQuestion(question);

      void runRef.current(question, requestedTone).then((result) => {
        window.postMessage(
          {
            source: PAGE_SOURCE,
            type: "CP_ASSIST_ANSWER",
            requestId,
            draft: result?.draft ?? null,
            provider: result?.provider ?? null,
            model: result?.model ?? null,
          },
          "*",
        );
      });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setExternalQuestion]);

  const copyDraft = async () => {
    if (!data?.draft) return;
    try {
      await navigator.clipboard.writeText(data.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xs font-bold text-gray-900 mb-2">Client Assistant</h1>
        <p className="text-gray-600">
          Live listening while your client talks — the question is captured on screen and a polished,
          resume-personalized answer is printed below so you can respond with confidence.
        </p>
      </div>

      {/* Extension status */}
      {extState === "checking" ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm text-gray-500 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          Checking for the Live Answer Assistant extension…
        </div>
      ) : extState === "missing" ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
              <Puzzle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-xs">Install the Live Answer Assistant extension</h3>
              <p className="text-sm text-gray-600 mt-1">
                The extension lets you send a client's question straight to this page from any tab and
                prints the polished answer here on screen. It's a 2-minute load-unpacked install.
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <a
                  href="/downloads/LiveAnswerAssistantExtensionVersion1.0.0.zip"
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md"
                >
                  <ExternalLink className="w-4 h-4" />
                  Download extension
                </a>
                <button
                  onClick={() => void detectExtension()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-700 text-sm font-semibold rounded-xl hover:bg-amber-50 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  I've installed it — check again
                </button>
                <span className="text-xs text-gray-400">
                  Then load it unpacked at chrome://extensions and reload this page.
                </span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: "1", title: "Download & unzip", desc: "Save the extension ZIP and extract it to a folder" },
              { step: "2", title: "Load unpacked", desc: "Open chrome://extensions → Developer mode → Load unpacked" },
              { step: "3", title: "Check again", desc: "Return here and click 'I've installed it — check again'" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3 bg-white/60 rounded-xl p-3 border border-amber-100">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          Live Answer Assistant extension connected{extVersion ? ` · v${extVersion}` : ""}. Use the popup to send
          questions here from any tab.
        </div>
      )}

      {!supported ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 text-sm">
          Live voice listening isn't supported in this browser. Open the dashboard in Chrome or Edge to hear
          your client's question, or send the question from the Live Answer Assistant extension popup.
        </div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Live capture */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-purple-600" />
              Live question capture
            </h2>
            {listening ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-xs font-bold text-red-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Listening…
              </span>
            ) : null}
          </div>

          <div
            className={`min-h-40 rounded-xl border-2 p-4 text-sm leading-relaxed transition-colors ${
              listening
                ? "border-purple-300 bg-purple-50/50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            {transcript ? (
              <>
                <span className="text-gray-800">{transcript}</span>
                {listening ? <span className="inline-block w-0.5 h-4 bg-purple-500 animate-pulse align-middle ml-0.5" /> : null}
              </>
            ) : (
              <span className="text-gray-400">
                {listening
                  ? "Waiting for your client to speak…"
                  : "Start listening, then speak with your client. Their question will appear here in real time."}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleListening}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                listening
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "gradient-primary text-white hover:shadow-lg"
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {listening ? "Stop listening" : "Start listening"}
            </button>
            {transcript ? (
              <button
                onClick={resetTranscript}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
            ) : null}
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-900 mb-2">Answer style</div>
            <div className="flex gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    tone === t.id
                      ? "bg-purple-50 border-purple-300 text-purple-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                  <span className="block text-[10px] font-medium text-gray-400">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void generateAnswer()}
            disabled={loading || !transcript.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl gradient-primary text-white font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Drafting answer…" : "Generate answer to print"}
          </button>
        </div>

        {/* Printed answer */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Answer on screen
            </h2>
            {data?.draft ? (
              <button
                onClick={() => void copyDraft()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 flex items-center gap-2 py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Drafting your answer…
            </div>
          ) : error ? (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-4">{error}</div>
          ) : data?.draft ? (
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-5">
                {data.draft}
              </pre>
              <div className="text-xs text-gray-400">
                {data.provider ? `via ${data.provider}${data.model ? ` · ${data.model}` : ""}` : ""}
              </div>
              <button
                onClick={clear}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Clear answer
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              Start listening to your client, press "Generate answer to print", or send a question from the Live
              Answer Assistant extension popup. The polished answer appears here in large type — just read it to
              your client.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
