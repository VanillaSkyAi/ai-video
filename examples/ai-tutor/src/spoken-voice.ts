import type { NarrationVoice } from "@vanillaskyai/video/react";

/**
 * A real voice, generated a line at a time.
 *
 * The browser's own synthesiser needs no key and sounds like it. A lesson is
 * composed before it plays, so every line is known before it is needed and can
 * be generated while the scene before it is still on screen - which is why a
 * speech model beats a realtime session here on both quality and cost.
 * Realtime exists to start talking before you know what you will say; this
 * already knows.
 *
 * Lines are fetched once and kept, so replaying an answer costs nothing.
 */
export function createSpokenVoice(): NarrationVoice & { prefetch: (text: string) => void } {
  const audio = new Map<string, Promise<string | undefined>>();

  const fetchLine = (text: string) => {
    const existing = audio.get(text);
    if (existing) return existing;
    const pending = fetch("/api/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (!response.ok) return undefined;
        return URL.createObjectURL(await response.blob());
      })
      // No voice is a quiet lesson, not a broken one.
      .catch(() => undefined);
    audio.set(text, pending);
    return pending;
  };

  return {
    prefetch(text) {
      void fetchLine(text);
    },
    async speak(text, { signal }) {
      const src = await fetchLine(text);
      if (!src || signal.aborted) return;
      const element = new Audio(src);
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
