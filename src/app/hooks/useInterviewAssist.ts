import { useRef, useState } from "react";

export type AssistTone = "concise" | "detailed" | "star";

export type ScoreCard = {
  score: number;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
};

export type AssistResponse = {
  draft?: string;
  scorecard?: ScoreCard;
  provider?: string;
  model?: string;
};

export function useInterviewAssist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AssistResponse | null>(null);
  const mountedRef = useRef(true);

  const run = async (payload: {
    question: string;
    mode: "assist" | "score";
    tone?: AssistTone;
    userAnswer?: string;
  }): Promise<AssistResponse | null> => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/interview/assist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Assistant request failed");
      }
      const result = (json?.data || null) as AssistResponse | null;
      if (mountedRef.current) setData(result);
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Assistant request failed");
      }
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const clear = () => {
    setData(null);
    setError("");
  };

  return { loading, error, data, run, clear };
}
