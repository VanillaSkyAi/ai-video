// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useVoiceInput } from "../src/video-chat/use-voice-input";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function installMediaRecorder(getUserMedia: () => Promise<MediaStream>) {
  const construct = vi.fn();
  class Recorder {
    state: RecordingState = "recording";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor() { construct(); }
    start() { this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) }); }
    stop() { this.state = "inactive"; this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  Object.defineProperty(window.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(getUserMedia) },
  });
  return construct;
}

describe("video chat voice cancellation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["stop", "unmount"] as const)("never starts a recorder when %s wins the permission race", async (ending) => {
    const permission = deferred<MediaStream>();
    const track = { stop: vi.fn() };
    const construct = installMediaRecorder(() => permission.promise);
    const { result, unmount } = renderHook(() => useVoiceInput(vi.fn(), true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.listening).toBe(true));
    if (ending === "stop") act(() => result.current.stop());
    else unmount();
    permission.resolve({ getTracks: () => [track] } as unknown as MediaStream);
    await act(async () => { await Promise.resolve(); });

    expect(construct).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("discards a transcription that resolves after the current operation is cancelled", async () => {
    const track = { stop: vi.fn() };
    installMediaRecorder(async () => ({ getTracks: () => [track] }) as unknown as MediaStream);
    const transcription = deferred<Response>();
    const fetcher: typeof fetch = vi.fn(async () => transcription.promise);
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript, true, { fetcher }));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.listening).toBe(true));
    act(() => result.current.toggle());
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    act(() => result.current.stop());
    transcription.resolve(Response.json({ text: "stale words" }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(onTranscript).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
