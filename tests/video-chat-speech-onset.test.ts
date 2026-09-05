import { afterEach, describe, expect, it, vi } from "vitest";
import { createVideoChatVoice } from "../src/video-chat/voice";

interface Playback {
  onstart?: (() => void) | null;
  onplaying?: (() => void) | null;
  onend?: (() => void) | null;
  onended?: (() => void) | null;
  onerror?: (() => void) | null;
}

describe("video chat speech onset", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function fixture(source: "browser" | "generated") {
    vi.useFakeTimers();
    let playback: Playback;
    vi.stubGlobal("speechSynthesis", { speak: (value: Playback) => { playback = value; }, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class {});
    vi.stubGlobal("Audio", function () {
      const element = { onplaying: null, play: () => Promise.resolve(), pause: () => undefined };
      playback = element;
      return element;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:speech");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const voice = createVideoChatVoice({ fetcher: vi.fn(async () => source === "browser"
      ? new Response(null, { status: 204 }) : new Response(new Uint8Array([1, 2, 3]))) });
    return { voice, playback: () => playback, start: () => source === "browser" ? playback.onstart?.() : playback.onplaying?.(),
      end: () => source === "browser" ? playback.onend?.() : playback.onended?.(),
      captureStart: () => source === "browser" ? playback.onstart : playback.onplaying };
  }

  it.each(["browser", "generated"] as const)("reports %s only on actual playback, once per call", async (source) => {
    const { voice, start, end, captureStart } = fixture(source);
    const onStart = vi.fn();
    const speaking = voice.speak("A useful answer.", { signal: new AbortController().signal, onStart });
    await vi.advanceTimersByTimeAsync(0);
    expect(onStart).not.toHaveBeenCalled();
    voice.pause();
    start();
    expect(onStart).not.toHaveBeenCalled();
    voice.resume();
    start();
    start();
    expect(onStart).toHaveBeenCalledExactlyOnceWith(source);
    const lateStart = captureStart();
    end();
    await speaking;
    lateStart?.();
    expect(onStart).toHaveBeenCalledOnce();
    voice.dispose?.();
  });

  it.each(["browser", "generated"] as const)("suppresses stale %s onset after mute, cancellation, or disposal", async (source) => {
    for (const action of ["mute", "cancel", "dispose"] as const) {
      const { voice, start, end, captureStart } = fixture(source);
      const onStart = vi.fn();
      const controller = new AbortController();
      const speaking = voice.speak("A useful answer.", { signal: controller.signal, onStart });
      await vi.advanceTimersByTimeAsync(0);
      const lateStart = captureStart();
      if (action === "mute") voice.setMuted(true);
      else if (action === "cancel") controller.abort();
      else voice.dispose?.();
      start();
      lateStart?.();
      expect(onStart).not.toHaveBeenCalled();
      end();
      await speaking;
      voice.dispose?.();
    }
  });

  it.each([false, true])("reports only one onset when generated playback falls back (already started: %s)", async (alreadyStarted) => {
    const { voice, playback, start } = fixture("generated");
    const onStart = vi.fn();
    const speaking = voice.speak("A useful answer.", { signal: new AbortController().signal, onStart });
    await vi.advanceTimersByTimeAsync(0);
    if (alreadyStarted) start();
    playback().onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    playback().onstart?.();
    playback().onend?.();
    await speaking;
    expect(onStart).toHaveBeenCalledExactlyOnceWith(alreadyStarted ? "generated" : "browser");
    voice.dispose?.();
  });

  it.each(["throw", "reject"])("isolates observers that %s", async (failure) => {
    const { voice, start, end } = fixture("browser");
    const onStart = vi.fn(() => {
      if (failure === "throw") throw new Error("observer failed");
      return Promise.reject(new Error("observer failed"));
    });
    const speaking = voice.speak("A useful answer.", { signal: new AbortController().signal, onStart });
    await vi.advanceTimersByTimeAsync(0);
    expect(() => start()).not.toThrow();
    end();
    await speaking;
    expect(onStart).toHaveBeenCalledOnce();
    voice.dispose?.();
  });
});
