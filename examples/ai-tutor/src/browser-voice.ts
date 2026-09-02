import type { NarrationVoice } from "@vanillaskyai/video/react";

/**
 * The browser's own speech synthesiser, as a narration voice.
 *
 * Chosen here because it needs no key and costs nothing, which keeps this
 * example runnable by anyone. It is also the smallest possible demonstration of
 * the contract: anything that can say a line and stop when told is a voice.
 *
 * A production tutor would pass a speech model instead - the lesson is composed
 * before it plays, so every line is known in advance and can be generated ahead
 * of being needed. Nothing else about the page changes.
 */
export function createBrowserVoice(): NarrationVoice {
  return {
    speak(text, { signal }) {
      const synthesis = globalThis.speechSynthesis;
      if (!synthesis) return;
      return new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        const finish = () => resolve();
        utterance.onend = finish;
        utterance.onerror = finish;
        // Talking over the next scene is worse than being cut off.
        signal.addEventListener("abort", () => {
          synthesis.cancel();
          finish();
        }, { once: true });
        synthesis.speak(utterance);
      });
    },
  };
}
