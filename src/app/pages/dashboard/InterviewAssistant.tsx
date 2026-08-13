import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  Loader2,
  Mic,
  MessagesSquare,
  PlayCircle,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trophy,
  Timer,
} from "lucide-react";
import { useInterviewAssist, type AssistTone } from "../../hooks/useInterviewAssist";

type Tab = "live" | "practice";

const TONES: Array<{ id: AssistTone; label: string }> = [
  { id: "concise", label: "Concise" },
  { id: "detailed", label: "Detailed" },
  { id: "star", label: "STAR" },
];

const SAMPLE_QUESTIONS = [
  "Tell me about yourself.",
  "Why do you want to work here?",
  "Walk me through a project you're proud of.",
  "How do you prioritize when deadlines are tight?",
  "Describe a time you resolved a disagreement.",
];

const PRACTICE_QUESTIONS = [
  "Tell me about yourself and why you're a fit for this role.",
  "Describe a challenging bug or problem you solved. What was your approach?",
  "Tell me about a time you disagreed with a teammate or stakeholder.",
  "How do you decide what to work on first when everything is urgent?",
  "Walk me through one project end to end — from idea to delivery.",
  "Tell me about a time you made a mistake. What did you learn?",
  "Describe a situation where you had to learn something quickly.",
];

const PRACTICE_SECONDS = 90;

function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(10, score)) * 10;
  return (
    <div className="flex items-center gap-4">
      <div
        className="w-20 h-20 rounded-full grid place-items-center font-bold text-sm text-gray-900"
        style={{
          background: `conic-gradient(#8b5cf6 ${pct}%, #e5e7eb ${pct}% 100%)`,
        }}
      >
        <div className="w-16 h-16 rounded-full bg-white grid place-items-center">{score}</div>
      </div>
      <div className="text-sm text-gray-600">
        <div className="font-semibold text-gray-900 mb-1">Answer score</div>
        <div className="text-xs">out of 10 · based on structure, specificity and clarity</div>
      </div>
    </div>
  );
}

export default function InterviewAssistant() {
  const [tab, setTab] = useState<Tab>("live");
  const { loading, error, data, run, clear } = useInterviewAssist();

  // Live Q&A state
  const [question, setQuestion] = useState("");
  const [tone, setTone] = useState<AssistTone>("detailed");
  const [copied, setCopied] = useState(false);

  // Practice state
  const [practiceIndex, setPracticeIndex] = useState<number | null>(null);
  const [practicePhase, setPracticePhase] = useState<"idle" | "speaking" | "review">("idle");
  const [secondsLeft, setSecondsLeft] = useState(PRACTICE_SECONDS);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [scores, setScores] = useState<number[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const startPractice = () => {
    const next = Math.floor(Math.random() * PRACTICE_QUESTIONS.length);
    setPracticeIndex(next);
    setPracticePhase("speaking");
    setPracticeAnswer("");
    clear();
    setSecondsLeft(PRACTICE_SECONDS);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          setPracticePhase("review");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishSpeaking = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    setPracticePhase("review");
  };

  const scorePractice = async () => {
    if (practiceIndex === null) return;
    const result = await run({
      question: PRACTICE_QUESTIONS[practiceIndex],
      mode: "score",
      tone: "detailed",
      userAnswer: practiceAnswer,
    });
    if (result?.scorecard) {
      setScores((prev) => [...prev, result.scorecard!.score]);
    }
  };

  const nextQuestion = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    setPracticePhase("idle");
    setPracticeIndex(null);
    setPracticeAnswer("");
    clear();
  };

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

  const averageScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

  const currentQuestion = practiceIndex !== null ? PRACTICE_QUESTIONS[practiceIndex] : null;
  const minutes = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xs font-bold text-gray-900 mb-2">Live Answer Assistant</h1>
        <p className="text-gray-600">
          Draft polished, resume-personalized answers to client and interview questions in real time.
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 gap-1">
        <button
          onClick={() => setTab("live")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === "live" ? "gradient-primary text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <MessagesSquare className="w-4 h-4" />
          Live Q&A
        </button>
        <button
          onClick={() => setTab("practice")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === "practice" ? "gradient-primary text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Mic className="w-4 h-4" />
          Practice Mode
        </button>
      </div>

      {tab === "live" ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Client / interview question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                placeholder="Paste or type the question you need to answer…"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-300 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
              />
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
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => void run({ question, mode: "assist", tone })}
              disabled={loading || !question.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl gradient-primary text-white font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Drafting answer…" : "Generate answer"}
            </button>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Try a sample</div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuestion(q)}
                    className="px-3 py-1.5 rounded-full border border-purple-100 bg-purple-50 text-xs text-purple-700 font-medium hover:bg-purple-100 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                Draft answer
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
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4">
                  {data.draft}
                </pre>
                <div className="text-xs text-gray-400">
                  {data.provider ? `via ${data.provider}${data.model ? ` · ${data.model}` : ""}` : ""}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                Your answer draft will appear here. It's personalized from your resume and skills.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-purple-600" />
                Timed Practice
              </h2>
              {practicePhase !== "idle" ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-bold text-purple-700">
                  <Timer className="w-4 h-4" />
                  {practicePhase === "speaking" ? `${minutes}:${secs}` : "Time's up"}
                </div>
              ) : null}
            </div>

            {practicePhase === "idle" ? (
              <div className="text-center py-10 space-y-4">
                <Mic className="w-12 h-12 text-purple-300 mx-auto" />
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  Get a random interview question, a {PRACTICE_SECONDS}s timer, and AI feedback on the answer you give.
                </p>
                <button
                  onClick={startPractice}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-semibold hover:shadow-lg transition-all"
                >
                  <PlayCircle className="w-4 h-4" />
                  Start practice
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-gray-900 font-medium">
                  {currentQuestion}
                </div>

                {practicePhase === "speaking" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={finishSpeaking}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      I'm done — score me
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={practiceAnswer}
                      onChange={(e) => setPracticeAnswer(e.target.value)}
                      rows={5}
                      placeholder="Type or paste the answer you actually gave…"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-purple-300 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void scorePractice()}
                        disabled={loading || !practiceAnswer.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-sm font-semibold disabled:opacity-60 transition-all"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Get feedback
                      </button>
                      <button
                        onClick={nextQuestion}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <SkipForward className="w-4 h-4" />
                        Next question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {scores.length > 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <Trophy className="w-4 h-4" />
                  Practice so far
                </div>
                <div className="text-sm text-emerald-800">
                  {scores.length} answered · avg <span className="font-bold">{averageScore}</span>/10
                </div>
              </div>
            ) : null}
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-600" />
              AI Feedback
            </h2>

            {loading ? (
              <div className="text-sm text-gray-500 flex items-center gap-2 py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Scoring your answer…
              </div>
            ) : error ? (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-4">{error}</div>
            ) : data?.scorecard ? (
              <div className="space-y-5">
                <ScoreRing score={data.scorecard.score} />
                {data.scorecard.strengths.length ? (
                  <div>
                    <div className="text-sm font-semibold text-emerald-700 mb-2">What went well</div>
                    <ul className="space-y-1.5 text-sm text-gray-700">
                      {data.scorecard.strengths.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data.scorecard.improvements.length ? (
                  <div>
                    <div className="text-sm font-semibold text-amber-700 mb-2">Ways to improve</div>
                    <ul className="space-y-1.5 text-sm text-gray-700">
                      {data.scorecard.improvements.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-500 shrink-0 mt-0.5">–</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data.scorecard.modelAnswer ? (
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">A stronger version</div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4">
                      {data.scorecard.modelAnswer}
                    </pre>
                  </div>
                ) : null}
                <div className="text-xs text-gray-400">
                  {data.provider ? `via ${data.provider}${data.model ? ` · ${data.model}` : ""}` : ""}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                Finish a practice question and score your answer to see AI feedback here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reset for live tab */}
      {tab === "live" && data ? (
        <button
          onClick={clear}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Clear result
        </button>
      ) : null}
    </div>
  );
}
