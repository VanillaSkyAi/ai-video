// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { VideoScene } from "../src/protocol/types";

/**
 * The voice and the picture, kept together.
 *
 * A narrated video is not a video with audio bolted on: the line belongs to the
 * scene, so it has to start when that scene does and stop when the viewer moves
 * on. Every one of those was a bug while building video chat - the voice
 * starting before the first frame, a follow-up silently cutting the response off,
 * a line still playing over the next scene.
 *
 * The provider is not the SDK's business. An application supplies something
 * that can speak; this decides what is said and when.
 */
function scene(id: string, narration?: string): VideoScene {
  return {
    id,
    templateId: "media",
    variables: { texts: id },
    timing: { fixedDuration: 4 },
    ...(narration ? { narration } : {}),
  };
}

function fakeVoice() {
  const spoken: string[] = [];
  const cancelled: string[] = [];
  return {
    spoken,
    cancelled,
    speak: vi.fn(async (text: string, options: { signal: AbortSignal }) => {
      spoken.push(text);
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        options.signal.addEventListener("abort", () => { cancelled.push(text); done(); }, { once: true });
        setTimeout(done, 20);
      });
    }),
  };
}

describe("useNarration", () => {
  it("speaks a scene's line when that scene begins", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("first", "The Moon is tidally locked."), 0); });
    expect(voice.spoken).toEqual(["The Moon is tidally locked."]);
  });

  it("says nothing for a scene with no line", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("silent"), 0); });
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it("stops the previous line when the picture moves on", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("first", "A long first line."), 0); });
    await act(async () => { result.current.onSceneChange(scene("second", "The second line."), 1); });
    // Talking over the next scene is worse than being cut off.
    expect(voice.cancelled).toEqual(["A long first line."]);
    expect(voice.spoken).toEqual(["A long first line.", "The second line."]);
  });

  it("does not repeat a line when the same scene is reported again", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("first", "Said once."), 0); });
    await act(async () => { result.current.onSceneChange(scene("first", "Said once."), 0); });
    expect(voice.spoken).toEqual(["Said once."]);
  });

  it("speaks it again when the video loops back to it", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("first", "Opening."), 0); });
    await act(async () => { result.current.onSceneChange(scene("second", "Middle."), 1); });
    await act(async () => { result.current.onSceneChange(scene("first", "Opening."), 0); });
    expect(voice.spoken).toEqual(["Opening.", "Middle.", "Opening."]);
  });

  it("reports whether it is speaking, so a page can wait before asking again", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    expect(result.current.speaking).toBe(false);
    await act(async () => {
      result.current.onSceneChange(scene("first", "Talking now."), 0);
      await Promise.resolve();
    });
    expect(result.current.speaking).toBe(true);
  });

  it("goes quiet when interrupted, and stays quiet until the next scene", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("first", "Being cut off."), 0); });
    await act(async () => { result.current.interrupt(); });
    expect(voice.cancelled).toEqual(["Being cut off."]);
    expect(result.current.speaking).toBe(false);
  });

  it("says nothing at all while disabled", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result } = renderHook(() => useNarration({ voice, enabled: false }));

    await act(async () => { result.current.onSceneChange(scene("first", "Muted."), 0); });
    expect(voice.speak).not.toHaveBeenCalled();
  });

  it("stops speaking when the player goes away", async () => {
    const { useNarration } = await import("../src/player/use-narration");
    const voice = fakeVoice();
    const { result, unmount } = renderHook(() => useNarration({ voice }));

    await act(async () => { result.current.onSceneChange(scene("first", "Half said."), 0); });
    unmount();
    expect(voice.cancelled).toEqual(["Half said."]);
    cleanup();
  });
});
