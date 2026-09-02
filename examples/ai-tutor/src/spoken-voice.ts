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
 * Lines are fetched once and kept, so replaying an answer costs nothing.
 */
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
  pause: () => void;
  resume: () => void;
} {
  const lines = new Map<string, Promise<{ src: string; seconds: number } | undefined>>();
  // The line being said right now, so pausing the video can pause it too.
  let playing: HTMLAudioElement | undefined;

  const load = (text: string) => {
    const existing = lines.get(text);
    if (existing) return existing;

    const pending = fetch("/api/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (!response.ok) return undefined;
        const bytes = await response.arrayBuffer();
        const src = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        // Decoded rather than read from the file's metadata. An MP3 header
        // carries an estimate, and an estimate a few hundred milliseconds short
        // means the next scene starts over the end of the sentence.
        const seconds = await measureSeconds(bytes);
        return { src, seconds };
      })
      // No voice is a quiet lesson, not a broken one.
      .catch(() => undefined);

    lines.set(text, pending);
    return pending;
  };

  return {
    async prepare(text) {
      const line = await load(text);
      return line ? { seconds: line.seconds } : undefined;
    },
    pause() {
      playing?.pause();
    },
    resume() {
      void playing?.play().catch(() => undefined);
    },
    async speak(text, { signal }) {
      const line = await load(text);
      if (!line || signal.aborted) return;
      const element = new Audio(line.src);
      playing = element;
      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        element.onended = finish;
        element.onerror = finish;
        // Talking over the next scene is worse than being cut off.
        signal.addEventListener("abort", () => {
          element.pause();
          finish();
        }, { once: true });
        void element.play().catch(finish);
      }).finally(() => {
        if (playing === element) playing = undefined;
      });
    },
  };
}
