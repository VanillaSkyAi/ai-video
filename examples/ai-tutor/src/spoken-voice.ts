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
export function createSpokenVoice(): NarrationVoice & {
  prepare: (text: string) => Promise<SpokenLine | undefined>;
} {
  const lines = new Map<string, Promise<{ src: string; seconds: number } | undefined>>();

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
        const src = URL.createObjectURL(await response.blob());
        // Metadata is enough; there is no need to decode the whole file to
        // learn how long it is.
        const seconds = await new Promise<number>((resolve) => {
          const probe = new Audio();
          probe.preload = "metadata";
          probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
          probe.onerror = () => resolve(0);
          probe.src = src;
        });
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
    async speak(text, { signal }) {
      const line = await load(text);
      if (!line || signal.aborted) return;
      const element = new Audio(line.src);
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
      });
    },
  };
}
