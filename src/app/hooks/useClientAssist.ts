import { useCallback, useEffect, useRef, useState } from "react";
import { useInterviewAssist, type AssistTone } from "./useInterviewAssist";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor =
    (w.SpeechRecognition as new () => SpeechRecognitionLike | undefined) ||
    (w.webkitSpeechRecognition as new () => SpeechRecognitionLike | undefined);
  return Ctor ? new Ctor() : null;
}

export function useClientAssist(tone: AssistTone) {
  const { loading, error, data, run, clear } = useInterviewAssist();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [finalized, setFinalized] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartRef = useRef(false);

  useEffect(() => {
    const rec = getSpeechRecognition();
    if (rec) {
      recognitionRef.current = rec;
      setSupported(true);
    }
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    restartRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const startListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    restartRef.current = true;
    setInterim("");
    setFinalized("");

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = result[0]?.transcript || "";
        if (result.isFinal) finalText += chunk;
        else interimText += chunk;
      }
      if (finalText) setFinalized((prev) => (prev ? prev + " " : "") + finalText.trim());
      setInterim(interimText);
    };

    rec.onerror = (event: any) => {
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        restartRef.current = false;
        setListening(false);
      }
    };

    rec.onend = () => {
      if (restartRef.current) {
        try {
          rec.start();
        } catch {
          restartRef.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterim("");
    setFinalized("");
    clear();
  }, [clear]);

  useEffect(() => {
    setTranscript(finalized ? finalized + (interim ? " " + interim : "") : interim);
  }, [finalized, interim]);

  const generateAnswer = useCallback(
    async (questionOverride?: string, toneOverride?: AssistTone) => {
      const question = (questionOverride ?? (finalized ? finalized + (interim ? " " + interim : "") : interim)).trim();
      if (!question) return null;
      const result = await run({ question, mode: "assist", tone: toneOverride ?? tone });
      return result;
    },
    [finalized, interim, run, tone],
  );

  const setExternalQuestion = useCallback(
    (text: string) => {
      const clean = String(text || "").trim();
      setFinalized(clean);
      setInterim("");
      clear();
    },
    [clear],
  );

  return {
    supported,
    listening,
    transcript,
    interim,
    finalized,
    loading,
    error,
    data,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setExternalQuestion,
    generateAnswer,
    clear,
  };
}
