import { useCallback, useEffect, useRef, useState } from "react";

type ResultLike = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ResultLike>;
};
type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission was denied",
  "service-not-allowed": "Microphone permission was denied",
  "no-speech": "No speech detected",
  "audio-capture": "No microphone found",
  network: "Speech service unreachable (check your connection)",
};

export function useSpeechRecognition(
  onFinal: (text: string) => void,
  lang: string = navigator.language,
) {
  const recRef = useRef<RecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supported = getCtor() !== null;

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) onFinalRef.current(finalText);
      setInterim(interimText);
    };
    rec.onerror = (e) => setError(ERRORS[e.error] ?? `Voice error: ${e.error}`);
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recRef.current = rec;
    setError(null);
    rec.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, error, toggle, stop };
}
