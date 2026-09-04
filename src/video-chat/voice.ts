import type { NarrationVoice } from "../player/use-narration.js";

const DEFAULT_MAX_CACHED_LINES = 60;
const FALLBACK_BITS_PER_SECOND = 128_000;

let sharedContext: AudioContext | undefined;

type PreparedLine =
  | { source: "generated"; src: string; seconds: number }
  | { source: "browser"; seconds: number };

export interface VideoChatPreparedSpeech {
  /** Measured or conservatively estimated spoken duration, in seconds. */
  seconds: number;
}

export interface VideoChatVoice extends NarrationVoice {
  prepare(text: string, options?: { signal?: AbortSignal }): Promise<VideoChatPreparedSpeech>;
  pause(): void;
  resume(): void;
  setMuted(muted: boolean): void;
  dispose?(): void;
}

export interface CreateVideoChatVoiceOptions {
  endpoint?: string | URL;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  fetcher?: typeof fetch;
  maxCachedLines?: number;
}

function actionEndpoint(endpoint: string | URL, action: string): string {
  const value = String(endpoint);
  return `${value}${value.includes("?") ? "&" : "?"}action=${encodeURIComponent(action)}`;
}

function estimatedBrowserSeconds(text: string): number {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return Math.max(1, words / 2.5);
}

async function measureSeconds(bytes: ArrayBuffer): Promise<number> {
  try {
    sharedContext ??= new AudioContext();
    const decoded = await sharedContext.decodeAudioData(bytes.slice(0));
    if (decoded.duration > 0) return decoded.duration;
  } catch {
    // Browsers may keep audio decoding locked until the first user gesture.
  }
  return (bytes.byteLength * 8) / FALLBACK_BITS_PER_SECOND;
}

/**
 * Create the SDK's generated-speech client with a browser-voice fallback.
 *
 * The endpoint is provider-neutral. A no-content response (or a compatible
 * endpoint's 404) selects browser speech for the rest of the session.
 */
export function createVideoChatVoice(options: CreateVideoChatVoiceOptions = {}): VideoChatVoice {
  const endpoint = options.endpoint ?? "/api/video-chat";
  const fetcher = options.fetcher ?? fetch;
  const maximum = options.maxCachedLines ?? DEFAULT_MAX_CACHED_LINES;
  if (!Number.isInteger(maximum) || maximum <= 0) throw new Error("maxCachedLines must be a positive integer");

  const lines = new Map<string, PreparedLine>();
  const pendingLoads = new Set<AbortController>();
  let sounding: HTMLAudioElement | undefined;
  let browserFinish: (() => void) | undefined;
  let held = false;
  let silent = false;
  let disposed = false;
  let generatedSpeechUnavailable = false;

  const forgetOldest = () => {
    while (lines.size > maximum) {
      const oldest = lines.keys().next();
      if (oldest.done) return;
      const line = lines.get(oldest.value);
      lines.delete(oldest.value);
      if (line?.source === "generated") URL.revokeObjectURL(line.src);
    }
  };

  const load = async (text: string, signal?: AbortSignal): Promise<PreparedLine> => {
    if (disposed) throw new DOMException("Video chat voice was disposed", "AbortError");
    const normalized = text.trim();
    const cached = lines.get(normalized);
    if (cached) {
      lines.delete(normalized);
      lines.set(normalized, cached);
      return cached;
    }

    const headers = new Headers(options.headers);
    headers.set("content-type", "application/json");
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener("abort", forwardAbort, { once: true });
    pendingLoads.add(controller);
    let prepared: PreparedLine;
    let createdSrc: string | undefined;
    try {
      try {
        if (generatedSpeechUnavailable) {
          prepared = { source: "browser", seconds: estimatedBrowserSeconds(normalized) };
        } else {
          const response = await fetcher(actionEndpoint(endpoint, "speech"), {
            method: "POST",
            headers,
            credentials: options.credentials,
            signal: controller.signal,
            body: JSON.stringify({ text: normalized }),
          });
          if (controller.signal.aborted) {
            throw controller.signal.reason ?? new DOMException("Speech preparation cancelled", "AbortError");
          }
          if (response.status === 204 || response.status === 404) {
            generatedSpeechUnavailable = true;
            prepared = { source: "browser", seconds: estimatedBrowserSeconds(normalized) };
          } else if (!response.ok) {
            prepared = { source: "browser", seconds: estimatedBrowserSeconds(normalized) };
          } else {
            const bytes = await response.arrayBuffer();
            if (controller.signal.aborted) {
              throw controller.signal.reason ?? new DOMException("Speech preparation cancelled", "AbortError");
            }
            createdSrc = URL.createObjectURL(new Blob([bytes], {
              type: response.headers.get("content-type") || "audio/mpeg",
            }));
            prepared = { source: "generated", src: createdSrc, seconds: await measureSeconds(bytes) };
            if (controller.signal.aborted) {
              throw controller.signal.reason ?? new DOMException("Speech preparation cancelled", "AbortError");
            }
          }
        }
      } catch (cause) {
        if (createdSrc) URL.revokeObjectURL(createdSrc);
        if (controller.signal.aborted) throw controller.signal.reason ?? cause;
        prepared = { source: "browser", seconds: estimatedBrowserSeconds(normalized) };
      }

      if (disposed || controller.signal.aborted) {
        if (prepared.source === "generated") URL.revokeObjectURL(prepared.src);
        throw controller.signal.reason ?? new DOMException("Video chat voice was disposed", "AbortError");
      }
      const existing = lines.get(normalized);
      if (existing) {
        if (prepared.source === "generated") URL.revokeObjectURL(prepared.src);
        lines.delete(normalized);
        lines.set(normalized, existing);
        return existing;
      }
      lines.set(normalized, prepared);
      forgetOldest();
      return prepared;
    } finally {
      pendingLoads.delete(controller);
      signal?.removeEventListener("abort", forwardAbort);
    }
  };

  const stopBrowser = () => {
    globalThis.speechSynthesis?.cancel();
    browserFinish?.();
  };

  return {
    async prepare(text, preparation = {}) {
      const line = await load(text, preparation.signal);
      return { seconds: line.seconds };
    },
    pause() {
      held = true;
      sounding?.pause();
      globalThis.speechSynthesis?.pause();
    },
    resume() {
      held = false;
      if (sounding && !silent) void sounding.play().catch(() => undefined);
      if (!silent) globalThis.speechSynthesis?.resume();
    },
    setMuted(muted) {
      silent = muted;
      if (sounding) sounding.muted = muted;
      if (muted) stopBrowser();
    },
    async speak(text, { signal }) {
      const line = await load(text, signal);
      if (disposed || signal.aborted || silent) return;
      if (line.source === "browser") {
        const synthesis = globalThis.speechSynthesis;
        if (!synthesis || typeof SpeechSynthesisUtterance === "undefined") return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        await new Promise<void>((resolve) => {
          let finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            if (browserFinish === finish) browserFinish = undefined;
            resolve();
          };
          browserFinish = finish;
          utterance.onend = finish;
          utterance.onerror = finish;
          signal.addEventListener("abort", () => {
            synthesis.cancel();
            finish();
          }, { once: true });
          synthesis.speak(utterance);
          if (held) synthesis.pause();
        });
        return;
      }

      const element = new Audio(line.src);
      element.muted = silent;
      sounding = element;
      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          if (sounding === element) sounding = undefined;
          resolve();
        };
        element.onended = finish;
        element.onerror = finish;
        signal.addEventListener("abort", () => {
          element.pause();
          finish();
        }, { once: true });
        if (!held) void element.play().catch(finish);
      });
    },
    dispose() {
      disposed = true;
      for (const controller of pendingLoads) {
        controller.abort(new DOMException("Video chat voice was disposed", "AbortError"));
      }
      pendingLoads.clear();
      sounding?.pause();
      sounding = undefined;
      stopBrowser();
      for (const line of lines.values()) {
        if (line.source === "generated") URL.revokeObjectURL(line.src);
      }
      lines.clear();
    },
  };
}
