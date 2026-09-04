import type { NarrationVoice } from "@vanillaskyai/video/react";

export interface SpokenLine {
  /** How long the audio actually runs, in seconds. */
  seconds: number;
}

/**
 * A real voice, and the exact length of every line it will say.
 *
 * The point of generating speech ahead of time is not only that it sounds
 * better than the browser's synthesiser. It is that the audio exists before the
 * scene does, so the scene can be held for exactly as long as the line takes -
 * measured, not estimated from a words-per-second constant that is wrong for
 * every particular sentence.
 *
 * Lines are fetched once and kept, so replaying a response costs nothing - but
 * not kept forever. Each one holds an object URL over its audio, and a session
 * that runs to twenty prompts is a hundred of them: the browser cannot
 * release the bytes while the URL exists, and nothing here was releasing the
 * URL. The cache is bounded instead, oldest first, and an evicted line simply
 * costs its fetch again the next time it is played.
 */
const MAX_CACHED_LINES = 60;
let sharedContext: AudioContext | undefined;

/**
 * How long the audio runs, in seconds.
 *
 * Decoding is exact, but an AudioContext is not always available - a browser
 * that has seen no user gesture yet may refuse one - and the MP3 header's own
 * duration is an estimate that runs short. Falling back to the file's length at
 * its bitrate is arithmetic rather than a guess, and being a little long is
 * harmless where being short cuts the sentence off.
 */
const FALLBACK_BITS_PER_SECOND = 128_000;

type PreparedLine =
  | { source: "generated"; src: string; seconds: number }
  | { source: "browser"; seconds: number };

function estimatedBrowserSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, words / 2.5);
}

async function measureSeconds(bytes: ArrayBuffer): Promise<number> {
  try {
    sharedContext ??= new AudioContext();
    // decodeAudioData consumes the buffer, so it gets a copy of its own.
    const decoded = await sharedContext.decodeAudioData(bytes.slice(0));
    if (decoded.duration > 0) return decoded.duration;
  } catch {
    // Fall through to the arithmetic.
  }
  return (bytes.byteLength * 8) / FALLBACK_BITS_PER_SECOND;
}

export function createSpokenVoice(): NarrationVoice & {
  prepare: (text: string) => Promise<SpokenLine | undefined>;
  /** Hold the sentence being said, and let it go on from where it stopped. */
  pause: () => void;
  resume: () => void;
  setMuted: (muted: boolean) => void;
} {
  const lines = new Map<string, Promise<PreparedLine>>();
  // The line currently being said. Pausing it rather than aborting it is what
  // makes continue mean continue: an interrupted line is spoken again from its
  // first word next time, which is not where the listener left off.
  let sounding: HTMLAudioElement | undefined;
  let browserFinish: (() => void) | undefined;
  let held = false;
  let silent = false;

  const forgetOldest = () => {
    while (lines.size > MAX_CACHED_LINES) {
      const oldest = lines.keys().next();
      if (oldest.done) return;
      const evicted = lines.get(oldest.value);
      lines.delete(oldest.value);
      // Resolved by now - it was cached before the sixty lines after it - and
      // revoked rather than dropped, because dropping the reference is what
      // leaves the audio in memory.
      void evicted?.then((line) => {
        if (line.source === "generated") URL.revokeObjectURL(line.src);
      }).catch(() => undefined);
    }
  };

  const load = (text: string) => {
    const existing = lines.get(text);
    if (existing) {
      // Re-inserted so the least recently played line is the one that goes.
      lines.delete(text);
      lines.set(text, existing);
      return existing;
    }

    const pending = fetch("/api/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (!response.ok) return { source: "browser", seconds: estimatedBrowserSeconds(text) } as const;
        const bytes = await response.arrayBuffer();
        const src = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        // Decoded rather than read from the file's metadata. An MP3 header
        // carries an estimate, and an estimate a few hundred milliseconds short
        // means the next scene starts over the end of the sentence.
        const seconds = await measureSeconds(bytes);
        return { source: "generated", src, seconds } as const;
      })
      // Generated speech is an upgrade. A provider or network failure returns
      // to the browser voice instead of turning the response silent.
      .catch(() => ({ source: "browser", seconds: estimatedBrowserSeconds(text) } as const));

    lines.set(text, pending);
    forgetOldest();
    return pending;
  };

  return {
    async prepare(text) {
      const line = await load(text);
      return { seconds: line.seconds };
    },
    pause() {
      held = true;
      sounding?.pause();
      globalThis.speechSynthesis?.pause();
    },
    resume() {
      held = false;
      if (sounding && !silent) void sounding.play().catch(Boolean);
      if (!silent) globalThis.speechSynthesis?.resume();
    },
    setMuted(muted) {
      silent = muted;
      if (sounding) sounding.muted = muted;
      if (muted && browserFinish) {
        globalThis.speechSynthesis?.cancel();
        browserFinish();
      }
    },
    async speak(text, { signal }) {
      const line = await load(text);
      if (signal.aborted || silent) return;
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
        const finish = () => {
          if (sounding === element) sounding = undefined;
          resolve();
        };
        element.onended = finish;
        element.onerror = finish;
        // Talking over the next scene is worse than being cut off.
        signal.addEventListener("abort", () => {
          element.pause();
          finish();
        }, { once: true });
        // A line that lands while playback is held waits with the picture. It
        // is prepared and pointed at, and let go by resume - starting it here
        // would be a voice over a still frame.
        if (!held) void element.play().catch(finish);
      });
    },
  };
}
