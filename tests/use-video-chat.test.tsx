// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Video, VideoScene } from "../src/index";
import { checksumVideo } from "../src/protocol/checksum";
import { createRenderTemplateRegistry, defineTemplate } from "../src/visual-system/catalog/internal";
import { TEST_VIDEO_STYLE } from "./semantic-brand-fixture";

const kit = createRenderTemplateRegistry({ templates: [defineTemplate({
  id: "metric",
  schema: {
    type: "object",
    properties: { value: { type: "string", default: "" } },
    required: ["value"],
    additionalProperties: false,
  },
  component: () => null,
})] });

function scene(id: string, value: string, narration?: string): VideoScene {
  return {
    id,
    templateId: "metric",
    variables: { value },
    timing: { fixedDuration: 4 },
    ...(narration ? { narration } : {}),
  };
}

function responseStream(requestId: string, scenes: VideoScene[]): Response {
  const snapshot: Video = {
    schemaVersion: "0.1",
    orientation: "landscape",
    scenes,
    style: TEST_VIDEO_STYLE,
  };
  const events = [
    { protocolVersion: "0.5", type: "response.start", eventId: `${requestId}:0`, runId: requestId, sequence: 0, data: { requestId, format: { orientation: "landscape" }, style: TEST_VIDEO_STYLE, capabilities: { templates: ["metric"] } } },
    ...scenes.map((entry, position) => ({ protocolVersion: "0.5", type: "scene.add", eventId: `${requestId}:${position + 1}`, runId: requestId, sequence: position + 1, data: { scene: entry, position } })),
    { protocolVersion: "0.5", type: "response.complete", eventId: `${requestId}:${scenes.length + 1}`, runId: requestId, sequence: scenes.length + 1, data: { finishReason: "stop", snapshot, checksum: checksumVideo(snapshot) } },
  ];
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream", "x-vanillasky-video-stream": "0.5" },
  });
}

function fakeVoice() {
  return {
    prepare: vi.fn(async () => ({ seconds: 1.2 })),
    speak: vi.fn(async () => undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    setMuted: vi.fn(),
    dispose: vi.fn(),
  };
}

function videoChatFetcher(options: { requests?: Array<{ action: string | null; body?: unknown }> } = {}): typeof fetch {
  let responseCount = 0;
  return vi.fn(async (input, init) => {
    const url = new URL(String(input), "https://app.example");
    const action = url.searchParams.get("action");
    const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    options.requests?.push({ action, body });
    if (action === "capabilities") {
      return Response.json({ templates: true, generatedSpeech: false, generatedVideo: true, stockMedia: true, transcription: false, modes: ["templates", "some", "full"] });
    }
    if (action === "welcome") {
      return Response.json({ hero: null, cards: [{ prompt: "Tell me a tiny story", media: null }] });
    }
    if (action === "opening") return Response.json({
      line: "Let us begin somewhere unexpected.",
      keyword: "unexpected story opening",
    });
    if (action === "opening-media") {
      return Response.json({ media: { url: "https://media.example/opening.mp4", type: "video" } });
    }
    if (action === "narration") return Response.json({ line: `Spoken ${String((body as { scene?: { id?: string } })?.scene?.id)}` });
    if (action === "suggestions") {
      return Response.json({ suggestions: [{ prompt: "Take it somewhere stranger", media: null }] });
    }
    if (action === "response") {
      responseCount += 1;
      return responseStream(`run-${responseCount}`, [
        scene(`one-${responseCount}`, "First"),
        scene(`two-${responseCount}`, "Second", "The planned second line."),
      ]);
    }
    return new Response("missing", { status: 404 });
  });
}

describe("useVideoChat", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads capabilities and welcome content from the one default endpoint", async () => {
    const { useVideoChat } = await import("../src/react");
    const requests: Array<{ action: string | null; body?: unknown }> = [];
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher: videoChatFetcher({ requests }), voice: fakeVoice() }));

    expectTypeOf(useVideoChat).toBeFunction();
    await waitFor(() => expect(result.current.capabilities?.modes).toEqual(["templates", "some", "full"]));
    await waitFor(() => expect(result.current.welcome?.cards[0]?.prompt).toBe("Tell me a tiny story"));
    expect(requests.filter(({ action }) => action === "capabilities")).toHaveLength(1);
    expect(requests.filter(({ action }) => action === "welcome")).toHaveLength(1);
    expect(result.current.availableModes).toEqual(["templates", "some", "full"]);
  });

  it("owns response streaming, narration, measured pacing, suggestions, and real playback completion", async () => {
    const { useVideoChat } = await import("../src/react");
    const voice = fakeVoice();
    const { result } = renderHook(() => useVideoChat({
      templates: kit,
      fetcher: videoChatFetcher(),
      voice,
      mode: "some",
      orientation: "landscape",
      brand: { colors: { primary: "#ff3366" } },
      style: { generatedLook: "paper collage" },
    }));

    let completed: Video | undefined;
    await act(async () => { completed = await result.current.ask("Invent a playful mystery"); });

    expect(completed?.scenes.map((entry) => entry.narration)).toEqual([
      "Spoken one-1",
      "The planned second line.",
    ]);
    expect(completed?.scenes.map((entry) => entry.timing?.fixedDuration)).toEqual([2, 2]);
    expect(voice.prepare).toHaveBeenCalledWith("Spoken one-1", expect.any(Object));
    expect(result.current.status).toBe("playing");
    expect(result.current.playbackEnded).toBe(false);
    expect(result.current.suggestions).toEqual([{ prompt: "Take it somewhere stranger", media: null }]);
    expect(result.current.playerProps).toMatchObject({ autoPlay: true, paused: false, controls: false });
    expect(result.current.playerProps).toHaveProperty("stream");
    const events = [];
    for await (const event of result.current.playerProps!.stream!) events.push(event);
    expect(events.map(({ type }) => type)).toEqual([
      "response.start",
      "scene.add",
      "scene.add",
      "response.complete",
    ]);

    act(() => result.current.playerProps?.onComplete?.(completed!));
    expect(result.current.status).toBe("playing");
    act(() => result.current.playerProps?.onPlaybackEnd?.(completed!));
    expect(result.current.status).toBe("ended");
    expect(result.current.playbackEnded).toBe(true);
  });

  it("sends completed turns as bounded conversation context on follow-ups", async () => {
    const { useVideoChat } = await import("../src/react");
    const requests: Array<{ action: string | null; body?: unknown }> = [];
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher: videoChatFetcher({ requests }), voice: fakeVoice() }));

    await act(async () => { await result.current.ask("Create a fox hero"); });
    await act(async () => { await result.current.ask("Now make it mysterious"); });

    const responses = requests.filter(({ action }) => action === "response");
    expect(responses[0]?.body).toMatchObject({ prompt: "Create a fox hero", conversation: [] });
    expect(responses[1]?.body).toMatchObject({
      prompt: "Now make it mysterious",
      conversation: [{
        prompt: "Create a fox hero",
        response: expect.stringContaining("Spoken one-1"),
      }],
    });
  });

  it("reuses suggestion footage for an elastic opening and hands its hook to the planner", async () => {
    const { useVideoChat } = await import("../src/react");
    const requests: Array<{ action: string | null; body?: unknown }> = [];
    let finishOpening!: () => void;
    const openingFinished = new Promise<void>((resolve) => { finishOpening = resolve; });
    const voice = {
      ...fakeVoice(),
      speak: vi.fn(() => openingFinished),
    };
    const { result } = renderHook(() => useVideoChat({
      templates: kit,
      fetcher: videoChatFetcher({ requests }),
      voice,
    }));
    const suggestion = {
      prompt: "Explain the Moon's locked face",
      media: { url: "https://media.example/suggested-moon.mp4", type: "video" as const },
    };

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask(suggestion.prompt, { openingMedia: suggestion.media }); });

    await waitFor(() => expect(result.current.currentTurn?.openingMedia).toEqual(suggestion.media));
    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(
      "Let us begin somewhere unexpected.",
      expect.any(Object),
    ));
    await waitFor(() => expect(requests.find(({ action }) => action === "response")?.body).toMatchObject({
      prompt: suggestion.prompt,
      spokenHook: "Let us begin somewhere unexpected.",
    }));
    expect(requests.some(({ action }) => action === "opening-media")).toBe(false);
    expect(result.current.playerProps).toBeUndefined();

    finishOpening();
    await act(async () => { await openingFinished; await pending; });
    await waitFor(() => expect(result.current.playerProps?.stream).toBeDefined());
  });

  it("resolves a typed prompt's hook keyword into its elastic opening footage", async () => {
    const { useVideoChat } = await import("../src/react");
    const requests: Array<{ action: string | null; body?: unknown }> = [];
    let finishOpening!: () => void;
    const openingFinished = new Promise<void>((resolve) => { finishOpening = resolve; });
    const voice = {
      ...fakeVoice(),
      speak: vi.fn(() => openingFinished),
    };
    const { result } = renderHook(() => useVideoChat({
      templates: kit,
      fetcher: videoChatFetcher({ requests }),
      voice,
    }));

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask("Take me somewhere unexpected"); });

    await waitFor(() => expect(result.current.currentTurn?.openingMedia).toEqual({
      url: "https://media.example/opening.mp4",
      type: "video",
    }));
    expect(requests).toContainEqual({
      action: "opening-media",
      body: { keyword: "unexpected story opening", orientation: "landscape" },
    });
    expect(result.current.playerProps).toBeUndefined();

    finishOpening();
    await act(async () => { await openingFinished; await pending; });
    await waitFor(() => expect(result.current.playerProps?.stream).toBeDefined());
  });

  it("does not send an interrupted partial response as conversation context", async () => {
    const { useVideoChat } = await import("../src/react");
    const requests: Array<{ action: string | null; body?: unknown }> = [];
    let responseCount = 0;
    const base = videoChatFetcher({ requests });
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action !== "response") return base(input, init);
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ action, body });
      responseCount += 1;
      if (responseCount > 1) return responseStream("replacement", [scene("replacement", "Replacement", "Complete")]);

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const events = [
            { protocolVersion: "0.5", type: "response.start", eventId: "partial:0", runId: "partial", sequence: 0, data: { requestId: "partial", format: { orientation: "landscape" }, style: TEST_VIDEO_STYLE, capabilities: { templates: ["metric"] } } },
            { protocolVersion: "0.5", type: "scene.add", eventId: "partial:1", runId: "partial", sequence: 1, data: { scene: scene("partial", "Partial", "Abandoned"), position: 0 } },
          ];
          controller.enqueue(encoder.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")));
          init?.signal?.addEventListener("abort", () => controller.close(), { once: true });
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let first!: Promise<Video | undefined>;
    act(() => { first = result.current.ask("Abandon this response"); });
    await waitFor(() => expect(result.current.currentTurn?.video?.scenes).toHaveLength(1));
    await act(async () => { await result.current.ask("Start over cleanly"); });
    await act(async () => { await first; });

    const responses = requests.filter(({ action }) => action === "response");
    expect(responses[1]?.body).toMatchObject({
      prompt: "Start over cleanly",
      conversation: [],
    });
  });

  it("preserves the requested mode while capabilities are still loading", async () => {
    const { useVideoChat } = await import("../src/react");
    let releaseCapabilities!: (response: Response) => void;
    const capabilities = new Promise<Response>((resolve) => { releaseCapabilities = resolve; });
    let responseBody: { mode?: string } | undefined;
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "capabilities") return capabilities;
      if (action === "response") {
        responseBody = JSON.parse(String(init?.body)) as { mode?: string };
        return responseStream("immediate-mode", [scene("mode", "Mode", "Mode")]);
      }
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice(), mode: "full" }));

    await act(async () => { await result.current.ask("Use generated video immediately"); });
    expect(responseBody?.mode).toBe("full");
    releaseCapabilities(Response.json({ templates: true, generatedSpeech: false, generatedVideo: true, stockMedia: false, transcription: false, modes: ["templates", "some", "full"] }));
  });

  it("keeps pause, voice, replay, and history selection synchronized with the player", async () => {
    const { useVideoChat } = await import("../src/react");
    const voice = fakeVoice();
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher: videoChatFetcher(), voice }));

    await act(async () => { await result.current.ask("First response"); });
    const firstId = result.current.currentTurn!.id;
    await act(async () => { await result.current.ask("Second response"); });

    act(() => result.current.pause());
    expect(result.current.status).toBe("paused");
    expect(result.current.playerProps?.paused).toBe(true);
    expect(voice.pause).toHaveBeenCalledOnce();
    act(() => result.current.resume());
    expect(voice.resume).toHaveBeenCalled();

    act(() => result.current.setMuted(true));
    expect(result.current.muted).toBe(true);
    expect(voice.setMuted).toHaveBeenLastCalledWith(true);

    const keyBefore = result.current.playerKey;
    act(() => result.current.selectTurn(firstId));
    expect(result.current.shownTurn?.id).toBe(firstId);
    expect(result.current.playerKey).toBeGreaterThan(keyBefore);
    expect(result.current.playerProps).toHaveProperty("video", result.current.shownTurn?.video);
    act(() => result.current.playerProps?.onPlaybackEnd?.(result.current.shownTurn!.video!));
    expect(result.current.playbackEnded).toBe(true);
    act(() => result.current.replay());
    expect(result.current.playbackEnded).toBe(false);
    expect(result.current.playerKey).toBeGreaterThan(keyBefore + 1);
  });

  it("does not abort composition when replay has no completed video yet", async () => {
    const { useVideoChat } = await import("../src/react");
    let responseSignal: AbortSignal | undefined;
    let releaseResponse!: (response: Response) => void;
    const responseReady = new Promise<Response>((resolve) => { releaseResponse = resolve; });
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "response") {
        responseSignal = init?.signal ?? undefined;
        return responseReady;
      }
      if (action === "opening") return Response.json({ line: "" });
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask("Still composing"); });
    await waitFor(() => expect(responseSignal).toBeDefined());
    act(() => result.current.replay());
    expect(responseSignal?.aborted).toBe(false);

    releaseResponse(responseStream("replay-guard", [scene("guard", "Finished", "Finished")]));
    await act(async () => { await pending; });
    expect(result.current.currentTurn?.completed).toBe(true);
  });

  it("does not abort composition for an invalid history selection", async () => {
    const { useVideoChat } = await import("../src/react");
    let responseSignal: AbortSignal | undefined;
    let releaseResponse!: (response: Response) => void;
    const responseReady = new Promise<Response>((resolve) => { releaseResponse = resolve; });
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "response") {
        responseSignal = init?.signal ?? undefined;
        return responseReady;
      }
      if (action === "opening") return Response.json({ line: "" });
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask("Still composing"); });
    await waitFor(() => expect(responseSignal).toBeDefined());
    act(() => result.current.selectTurn("missing-turn"));
    expect(responseSignal?.aborted).toBe(false);

    releaseResponse(responseStream("select-guard", [scene("guard", "Finished", "Finished")]));
    await act(async () => { await pending; });
    expect(result.current.currentTurn?.completed).toBe(true);
  });

  it("cancels replaced prompts and discards their late results", async () => {
    const { useVideoChat } = await import("../src/react");
    let firstSignal: AbortSignal | undefined;
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let responseCount = 0;
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "response") {
        responseCount += 1;
        if (responseCount === 1) {
          firstSignal = init?.signal ?? undefined;
          await firstReleased;
          return responseStream("late", [scene("late", "Late", "Late answer")]);
        }
      }
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let first: Promise<Video | undefined>;
    act(() => { first = result.current.ask("Old prompt"); });
    await waitFor(() => expect(firstSignal).toBeDefined());
    await act(async () => { await result.current.ask("New prompt"); });
    releaseFirst();
    await act(async () => { await first; });

    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.currentTurn?.prompt).toBe("New prompt");
    expect(result.current.currentTurn?.video?.scenes[0]?.id).not.toBe("late");
  });

  it("waits for the opening hook before starting the response planner", async () => {
    const { useVideoChat } = await import("../src/react");
    let releaseOpening!: () => void;
    const openingReady = new Promise<void>((resolve) => { releaseOpening = resolve; });
    const voice = fakeVoice();
    const base = videoChatFetcher();
    let responseCalls = 0;
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "opening") {
        await openingReady;
        return Response.json({ line: "This line leads into the answer." });
      }
      if (action === "response") {
        responseCalls += 1;
        return Response.json({ error: { code: "provider_failed", message: "Planning failed" } }, { status: 502 });
      }
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice }));

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask("Wait for the hook"); });
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(responseCalls).toBe(0);
    expect(result.current.status).toBe("composing");
    releaseOpening();
    await act(async () => { await pending; });

    expect(result.current.status).toBe("error");
    expect(responseCalls).toBe(2);
  });

  it("aborts a pending opening hook when a new prompt starts", async () => {
    const { useVideoChat } = await import("../src/react");
    let firstOpeningSignal: AbortSignal | undefined;
    let openingCount = 0;
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "opening") {
        openingCount += 1;
        if (openingCount === 1) {
          firstOpeningSignal = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
          });
        }
        return Response.json({ line: "" });
      }
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let first!: Promise<Video | undefined>;
    act(() => { first = result.current.ask("Slow first hook"); });
    await waitFor(() => expect(firstOpeningSignal).toBeDefined());
    await act(async () => { await result.current.ask("Replace it"); });
    await act(async () => { await first; });

    expect(firstOpeningSignal?.aborted).toBe(true);
    expect(result.current.currentTurn?.prompt).toBe("Replace it");
  });

  it("retries once before playback starts", async () => {
    const { useVideoChat } = await import("../src/react");
    const base = videoChatFetcher();
    let responses = 0;
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "response" && responses++ === 0) {
        return Response.json({ error: { code: "provider_failed", message: "Planning failed" } }, { status: 502 });
      }
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    await act(async () => { await result.current.ask("Recover this response"); });

    expect(responses).toBe(2);
    expect(result.current.currentTurn?.video?.scenes).toHaveLength(2);
    expect(result.current.error).toBeUndefined();
  });

  it("reports timeouts and explicit cancellation without accepting late work", async () => {
    const { useVideoChat } = await import("../src/react");
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action !== "response") return base(input, init);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      });
    });
    const { result, rerender } = renderHook(
      ({ timeoutMs }) => useVideoChat({ templates: kit, fetcher, voice: fakeVoice(), timeoutMs }),
      { initialProps: { timeoutMs: 5 } },
    );

    await act(async () => { await result.current.ask("Time out"); });
    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toContain("timed out");

    rerender({ timeoutMs: 10_000 });
    let cancelled: Promise<Video | undefined>;
    act(() => { cancelled = result.current.ask("Cancel this"); });
    await waitFor(() => expect(result.current.status).toMatch(/composing|playing/));
    act(() => result.current.cancel());
    await act(async () => { await cancelled; });
    expect(result.current.status).toBe("cancelled");
  });

  it("stops and closes an active player stream when cancelled after the first scene", async () => {
    const { useVideoChat } = await import("../src/react");
    const encoder = new TextEncoder();
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action !== "response") return base(input, init);
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          const events = [
            { protocolVersion: "0.5", type: "response.start", eventId: "cancel:0", runId: "cancel", sequence: 0, data: { requestId: "cancel", format: { orientation: "landscape" }, style: TEST_VIDEO_STYLE, capabilities: { templates: ["metric"] } } },
            { protocolVersion: "0.5", type: "scene.add", eventId: "cancel:1", runId: "cancel", sequence: 1, data: { scene: scene("cancelled", "Partial", "First line"), position: 0 } },
          ];
          controller.enqueue(encoder.encode(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")));
          init?.signal?.addEventListener("abort", () => controller.close(), { once: true });
        },
      }), { headers: { "content-type": "text/event-stream" } });
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask("Cancel after playback starts"); });
    await waitFor(() => expect(result.current.playerProps?.stream).toBeDefined());
    const playerStream = result.current.playerProps!.stream!;
    act(() => result.current.cancel());
    await act(async () => { await pending; });

    expect(result.current.status).toBe("cancelled");
    expect(result.current.playerProps).toBeUndefined();
    const events = [];
    for await (const event of playerStream) events.push(event);
    expect(events.at(-1)?.type).toBe("response.complete");
  });

  it("settles and removes the player stream after a terminal failure", async () => {
    const { useVideoChat } = await import("../src/react");
    let fail!: () => void;
    const failureReady = new Promise<void>((resolve) => { fail = resolve; });
    const encoder = new TextEncoder();
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action !== "response") return base(input, init);
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          const first = [
            { protocolVersion: "0.5", type: "response.start", eventId: "terminal:0", runId: "terminal", sequence: 0, data: { requestId: "terminal", format: { orientation: "landscape" }, style: TEST_VIDEO_STYLE, capabilities: { templates: ["metric"] } } },
            { protocolVersion: "0.5", type: "scene.add", eventId: "terminal:1", runId: "terminal", sequence: 1, data: { scene: scene("terminal", "Partial", "First line"), position: 0 } },
          ];
          controller.enqueue(encoder.encode(first.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")));
          void failureReady.then(() => {
            const event = { protocolVersion: "0.5", type: "response.error", eventId: "terminal:2", runId: "terminal", sequence: 2, data: { error: { code: "provider_failed", message: "Planning stopped", recoverable: false }, terminal: true } };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`));
            controller.close();
          });
        },
      }), { headers: { "content-type": "text/event-stream" } });
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let pending!: Promise<Video | undefined>;
    act(() => { pending = result.current.ask("Fail after playback starts"); });
    await waitFor(() => expect(result.current.playerProps?.stream).toBeDefined());
    const playerStream = result.current.playerProps!.stream!;
    fail();
    await act(async () => { await pending; });

    expect(result.current.status).toBe("error");
    expect(result.current.playerProps).toBeUndefined();
    const events = [];
    for await (const event of playerStream) events.push(event);
    expect(events.at(-1)?.type).toBe("response.complete");
  });

  it("keeps a playable video when follow-up suggestions fail", async () => {
    const { useVideoChat } = await import("../src/react");
    const base = videoChatFetcher();
    const fetcher: typeof fetch = vi.fn(async (input, init) => {
      const action = new URL(String(input), "https://app.example").searchParams.get("action");
      if (action === "suggestions") throw new Error("Suggestion provider unavailable");
      return base(input, init);
    });
    const { result } = renderHook(() => useVideoChat({ templates: kit, fetcher, voice: fakeVoice() }));

    let completed: Video | undefined;
    await act(async () => { completed = await result.current.ask("Keep the useful answer"); });

    expect(completed?.scenes).toHaveLength(2);
    expect(result.current.status).toBe("playing");
    expect(result.current.error).toBeUndefined();
    expect(result.current.suggestions).toEqual([]);
  });

  it("resets the full session and aborts work on unmount", async () => {
    const { useVideoChat } = await import("../src/react");
    const voice = fakeVoice();
    const { result, unmount } = renderHook(() => useVideoChat({ templates: kit, fetcher: videoChatFetcher(), voice }));
    await act(async () => { await result.current.ask("A response"); });

    act(() => result.current.reset());
    expect(result.current.turns).toEqual([]);
    expect(result.current.status).toBe("idle");
    unmount();
    expect(voice.dispose).not.toHaveBeenCalled();
  });
});

describe("createVideoChatVoice", () => {
  it("remembers the server's browser-voice fallback without repeating requests", async () => {
    const { createVideoChatVoice } = await import("../src/react");
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    const voice = createVideoChatVoice({ fetcher });

    await voice.prepare("The first browser-spoken line.");
    await voice.prepare("The second browser-spoken line.");

    expect(fetcher).toHaveBeenCalledOnce();
    voice.dispose?.();
  });

  it("falls back to browser speech when generated speech is unavailable", async () => {
    const { createVideoChatVoice } = await import("../src/react");
    const speak = vi.fn((utterance: { onend?: () => void }) => utterance.onend?.());
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      rate = 1;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    });
    const voice = createVideoChatVoice({ fetcher: vi.fn(async () => new Response("missing", { status: 404 })) });

    expect((await voice.prepare("A short spoken response.")).seconds).toBeGreaterThan(0);
    await voice.speak("A short spoken response.", { signal: new AbortController().signal });

    expect(speak).toHaveBeenCalledOnce();
    voice.dispose?.();
  });

  it("cancels generated speech preparation with its prompt", async () => {
    const { createVideoChatVoice } = await import("../src/react");
    let requestSignal: AbortSignal | undefined;
    const voice = createVideoChatVoice({
      fetcher: vi.fn((_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), { once: true });
        });
      }),
    });
    const controller = new AbortController();
    const preparing = voice.prepare("A line that gets replaced.", { signal: controller.signal });

    controller.abort(new DOMException("Prompt replaced", "AbortError"));

    await expect(preparing).rejects.toMatchObject({ name: "AbortError" });
    expect(requestSignal?.aborted).toBe(true);
    voice.dispose?.();
  });

  it("does not couple concurrent same-text preparations to the first caller's abort signal", async () => {
    const { createVideoChatVoice } = await import("../src/react");
    const pending: Array<{ resolve(response: Response): void; reject(cause: unknown): void }> = [];
    const voice = createVideoChatVoice({
      fetcher: vi.fn((_input, init) => new Promise<Response>((resolve, reject) => {
        pending.push({ resolve, reject });
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      })),
    });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = voice.prepare("The same line.", { signal: firstController.signal });
    const second = voice.prepare("The same line.", { signal: secondController.signal });

    expect(pending).toHaveLength(2);
    firstController.abort(new DOMException("First caller replaced", "AbortError"));
    pending[1]!.resolve(new Response("missing", { status: 404 }));

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    await expect(second).resolves.toMatchObject({ seconds: expect.any(Number) });
    voice.dispose?.();
  });

  it("does not let a later same-text caller cancel the first preparation", async () => {
    const { createVideoChatVoice } = await import("../src/react");
    const pending: Array<{ resolve(response: Response): void; reject(cause: unknown): void }> = [];
    const voice = createVideoChatVoice({
      fetcher: vi.fn((_input, init) => new Promise<Response>((resolve, reject) => {
        pending.push({ resolve, reject });
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      })),
    });
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = voice.prepare("Another repeated line.", { signal: firstController.signal });
    const second = voice.prepare("Another repeated line.", { signal: secondController.signal });

    expect(pending).toHaveLength(2);
    secondController.abort(new DOMException("Second caller replaced", "AbortError"));
    pending[0]!.resolve(new Response("missing", { status: 404 }));

    await expect(first).resolves.toMatchObject({ seconds: expect.any(Number) });
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    voice.dispose?.();
  });

  it("cannot start speech after the voice is disposed during a pending load", async () => {
    const { createVideoChatVoice } = await import("../src/react");
    let release!: (response: Response) => void;
    let requestSignal: AbortSignal | undefined;
    const synthesisSpeak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      speak: synthesisSpeak,
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      rate = 1;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    });
    const voice = createVideoChatVoice({
      fetcher: vi.fn((_input, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise<Response>((resolve) => { release = resolve; });
      }),
    });
    const speaking = voice.speak("Never say this.", { signal: new AbortController().signal });

    voice.dispose?.();
    expect(requestSignal?.aborted).toBe(true);
    release(new Response("missing", { status: 404 }));

    await expect(speaking).rejects.toMatchObject({ name: "AbortError" });
    expect(synthesisSpeak).not.toHaveBeenCalled();
  });
});
