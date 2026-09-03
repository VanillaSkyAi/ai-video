import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Asking out loud, where the browser can hear.
 *
 * The mic used to be rendered disabled - an affordance that looked like a
 * feature and did nothing, which is worse than no mic at all: it is a control
 * that fails silently every time it is pressed. `SpeechRecognition` is real in
 * Chrome and Safari and absent in Firefox, so this reports whether it exists
 * and the chrome renders the button only when it does. A button that is not
 * there explains itself; a dead one does not.
 *
 * Interim results are surfaced as they arrive, so the words appear in the
 * composer while the sentence is still being said and can be corrected by
 * hand. Nothing is submitted automatically - what was heard is a draft, and
 * a mis-heard question costs a lesson.
 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const holder = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return holder.SpeechRecognition ?? holder.webkitSpeechRecognition;
}

export interface VoiceInput {
  /** False in browsers with no speech recognition, where no button is drawn. */
  supported: boolean;
  listening: boolean;
  toggle: () => void;
  stop: () => void;
}

export function useVoiceInput(onTranscript: (text: string) => void): VoiceInput {
  const [supported] = useState(() => recognitionConstructor() !== undefined);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike>(undefined);
  // Read inside the recogniser's own callbacks, which outlive the render that
  // created them.
  const handlerRef = useRef(onTranscript);
  handlerRef.current = onTranscript;

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let heard = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        heard += event.results[index]?.[0]?.transcript ?? "";
      }
      if (heard.trim()) handlerRef.current(heard.trim());
    };
    // Both endings are the same ending as far as the button is concerned: a
    // permission refusal, a timeout and a finished sentence all mean it is no
    // longer listening, and a mic that stays lit after that is a lie.
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, stop]);

  return { supported, listening, toggle, stop };
}
