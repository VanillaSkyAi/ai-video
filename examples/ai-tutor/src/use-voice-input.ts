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
  onerror: ((event: { error?: string }) => void) | null;
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
  /** Recording is over and the words are being worked out. */
  thinking: boolean;
  /**
   * Why it stopped, when it stopped badly.
   *
   * A recogniser fails for reasons the person can act on - the microphone was
   * refused, there is no connection to the service that transcribes - and it
   * fails by simply ending. Swallowing that leaves a button that does nothing
   * when pressed and says nothing about why, which is the exact failure this
   * whole control was rebuilt to avoid.
   */
  error?: string;
  toggle: () => void;
  stop: () => void;
}

const WHY: Record<string, string> = {
  "not-allowed": "The microphone is blocked for this site. Allow it in your browser's settings, then try again.",
  "service-not-allowed": "The microphone is blocked for this site. Allow it in your browser's settings, then try again.",
  "no-speech": "I did not catch that.",
  "audio-capture": "No microphone was found.",
};

/**
 * The way back when the browser's own recogniser cannot reach its service.
 *
 * Chrome's implementation ships audio to a Google server, and when that is
 * unreachable it fails with `network` - which no amount of retrying on this
 * side fixes. So the recording is made here instead and transcribed by the
 * tutor's own route. Slower, because nothing appears until the sentence is
 * finished, and it costs a fraction of a cent - which is why it is what
 * happens after the free path fails rather than instead of it.
 */
async function recordAndTranscribe(signal: AbortSignal, stop: (halt: () => void) => void): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const finished = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  // A timeslice, so data lands as it is captured rather than only on stop -
  // a recorder that emits nothing until the end has nothing to emit if the
  // stop and the flush race.
  recorder.start(250);
  stop(() => { if (recorder.state !== "inactive") recorder.stop(); });
  signal.addEventListener("abort", () => { if (recorder.state !== "inactive") recorder.stop(); }, { once: true });
  await finished;
  // The tracks stay live until they are stopped, and a microphone left open is
  // a recording light that never goes out.
  for (const track of stream.getTracks()) track.stop();
  if (signal.aborted || chunks.length === 0) return "";

  const clip = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "content-type": clip.type },
    body: clip,
    signal,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(detail.error ?? "The recording could not be transcribed.");
  }
  return String(((await response.json()) as { text?: string }).text ?? "").trim();
}

export function useVoiceInput(onTranscript: (text: string) => void): VoiceInput {
  const [supported] = useState(() =>
    recognitionConstructor() !== undefined
    || (typeof window !== "undefined" && typeof window.MediaRecorder === "function"
        && Boolean(navigator.mediaDevices?.getUserMedia)));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string>();
  const [thinking, setThinking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike>(undefined);
  // Set once the browser's recogniser has proved it cannot reach its service.
  // It does not recover within a session, so every later press goes straight
  // to the route rather than failing again first.
  const useRecorderRef = useRef(false);
  const abortRef = useRef<AbortController>(undefined);
  const haltRef = useRef<() => void>(undefined);
  // Read inside the recogniser's own callbacks, which outlive the render that
  // created them.
  const handlerRef = useRef(onTranscript);
  handlerRef.current = onTranscript;

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    haltRef.current?.();
    haltRef.current = undefined;
    setListening(false);
  }, []);

  /** The fallback path: record here, transcribe on the server. */
  const record = useCallback(async () => {
    const inFlight = new AbortController();
    abortRef.current = inFlight;
    setError(undefined);
    setListening(true);
    try {
      const heard = await recordAndTranscribe(inFlight.signal, (halt) => { haltRef.current = halt; });
      setListening(false);
      if (!heard) return;
      setThinking(true);
      handlerRef.current(heard);
    } catch (cause) {
      setListening(false);
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(/denied|not allowed/i.test(message)
        ? "The microphone is blocked for this site. Allow it in your browser's settings, then try again."
        : message);
    } finally {
      setThinking(false);
      haltRef.current = undefined;
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
      return;
    }
    const Recognition = recognitionConstructor();
    if (!Recognition || useRecorderRef.current) {
      void record();
      return;
    }
    setError(undefined);
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
    recognition.onerror = (event) => {
      setListening(false);
      // A service the browser cannot reach is not something to report as a
      // failure - it is the moment to take the other road, silently, and to
      // keep taking it for the rest of the session.
      if (event.error === "network" || event.error === "service-not-allowed") {
        useRecorderRef.current = true;
        void record();
        return;
      }
      setError(WHY[event.error ?? ""] ?? "The microphone stopped unexpectedly.");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("The microphone could not be started.");
    }
  }, [listening, stop, record]);

  return { supported, listening, thinking, error, toggle, stop };
}
