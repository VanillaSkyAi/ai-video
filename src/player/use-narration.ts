import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoScene } from "../protocol/types.js";

/**
 * Say a video's narration as it plays.
 *
 * A narrated video is not a video with audio bolted on. The line belongs to the
 * scene, so it has to begin when that scene does and stop when the viewer moves
 * on - and every one of those was a bug in the application this was extracted
 * from: the voice starting before the first frame, a follow-up question
 * silently cutting the tutor off mid-sentence, a line still playing over the
 * scene after it.
 *
 * The provider is not the SDK's business. An application supplies something
 * that can speak - a realtime session, a speech model, the browser's own
 * synthesiser - and this decides what is said, when it starts, and when it
 * stops. That keeps the package free of provider dependencies and leaves the
 * choice of voice where the choice of model already is.
 */
export interface NarrationVoice {
  /**
   * Say this line, and resolve when it has been said.
   *
   * The signal aborts when the scene changes, when the viewer interrupts, or
   * when the player goes away. Stop speaking promptly: talking over the next
   * scene is worse than being cut off.
   */
  speak(text: string, options: { signal: AbortSignal }): void | Promise<void>;
}

export interface NarrationOptions {
  voice: NarrationVoice;
  /** Say nothing at all while false. Defaults to true. */
  enabled?: boolean;
}

export interface Narration {
  /**
   * Hand this to the player's `onSceneChange`.
   *
   * The player already reports which scene is showing, which is the only cue a
   * narrator needs, so nothing here has to run its own clock.
   */
  onSceneChange: (scene: VideoScene, index: number) => void;
  /** Stop the current line. Nothing is said again until the next scene. */
  interrupt: () => void;
  /** Whether a line is being spoken right now. */
  speaking: boolean;
}

export function useNarration(options: NarrationOptions): Narration {
  const [speaking, setSpeaking] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const currentRef = useRef<AbortController | undefined>(undefined);
  // The index a line was started for, so a scene reported twice - which the
  // player does on a re-render - is not said twice, while a loop back to it is.
  const spokenIndexRef = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    currentRef.current?.abort();
    currentRef.current = undefined;
    setSpeaking(false);
  }, []);

  const interrupt = useCallback(() => {
    spokenIndexRef.current = undefined;
    stop();
  }, [stop]);

  // A player that goes away should not keep talking.
  useEffect(() => () => currentRef.current?.abort(), []);

  const onSceneChange = useCallback((scene: VideoScene, index: number) => {
    const { voice, enabled = true } = optionsRef.current;
    if (!enabled) return;
    if (spokenIndexRef.current === index) return;

    stop();
    spokenIndexRef.current = index;
    const line = scene.narration?.trim();
    if (!line) return;

    const controller = new AbortController();
    currentRef.current = controller;
    setSpeaking(true);
    void (async () => {
      try {
        await voice.speak(line, { signal: controller.signal });
      } catch {
        // A voice that fails is a video without narration, not a broken video.
        // The application hears about it through its own provider.
      } finally {
        if (currentRef.current === controller) {
          currentRef.current = undefined;
          setSpeaking(false);
        }
      }
    })();
  }, [stop]);

  return { onSceneChange, interrupt, speaking };
}
