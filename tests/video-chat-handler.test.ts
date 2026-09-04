import { describe, expect, it } from "vitest";
import { decodeVideoSse } from "../src/protocol/sse";

type CreateVideoChatHandler = (options: Record<string, unknown>) =>
  (request: Request) => Promise<Response>;

async function loadCreateVideoChatHandler(): Promise<CreateVideoChatHandler> {
  const server = await import("../src/server") as unknown as {
    createVideoChatHandler?: CreateVideoChatHandler;
  };
  expect(server.createVideoChatHandler).toBeTypeOf("function");
  return server.createVideoChatHandler!;
}

function plannedResponse() {
  return async function* () {
    yield '{"type":"scene.add","scene":{"id":"body","templateId":"notification","variables":{"appName":"VanillaSky","message":"A useful answer"},"timing":{"fixedDuration":4}}}\n';
    yield '{"type":"scene.add","placement":"closer","scene":{"id":"ending","templateId":"media","variables":{"texts":"A memorable ending","mediaType":"gradient"},"timing":{"fixedDuration":4}}}\n';
    yield '{"type":"plan.complete"}\n';
  };
}

describe("createVideoChatHandler", () => {
  it("preserves non-enumerable provider lifecycle fields while intercepting the opening", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const warningCodes: string[] = [];
    let completed: Record<string, unknown> | undefined;
    const source = {
      textStream: (async function* () {
        yield '{"type":"video-chat.opening","spokenHook":"One stream keeps every provider signal intact.","mediaKeyword":"video stream"}\n';
        yield* plannedResponse()();
      })(),
    };
    Object.defineProperties(source, {
      finishReason: { get: () => Promise.resolve("stop") },
      warnings: { get: () => Promise.resolve([{ type: "other", message: "test warning" }]) },
      usage: { get: () => Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }) },
      requestedModelId: { get: () => Promise.resolve("requested-model") },
      resolvedModelId: { get: () => Promise.resolve("resolved-model") },
    });
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: () => source as never,
      generateText: async () => "unused",
      onWarning: (warning: { code: string }) => warningCodes.push(warning.code),
      onComplete: (summary: Record<string, unknown>) => { completed = summary; },
    });

    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Test the lifecycle", mode: "templates", orientation: "landscape" }),
    }));
    await response.text();

    expect(warningCodes).toContain("provider_warning");
    expect(completed).toMatchObject({
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      requestedModelId: "requested-model",
      resolvedModelId: "resolved-model",
    });
  });

  it("streams the short opening and template plan from one model call", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const generatedTasks: string[] = [];
    let streamCalls = 0;
    let systemPrompt = "";
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: ({ systemPrompt: prompt }: { systemPrompt: string }) => {
        streamCalls += 1;
        systemPrompt = prompt;
        return (async function* () {
          yield '{"type":"video-chat.opening","spokenHook":"The Moon turns, perfectly matching its orbit.","mediaKeyword":"moon orbit earth"}\n';
          yield* plannedResponse()();
        })();
      },
      generateText: async ({ task }: { task: string }) => {
        generatedTasks.push(task);
        return "unused";
      },
    });

    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Why does the Moon always show one face?",
        mode: "templates",
        orientation: "landscape",
      }),
    }));
    const events = [];
    for await (const event of decodeVideoSse(response.body!)) events.push(event);

    expect(events.map(({ type }) => type)).toEqual([
      "response.start",
      "data.video-chat-opening",
      "scene.add",
      "scene.add",
      "response.complete",
    ]);
    expect(events[0]).toMatchObject({
      data: { capabilities: { extensions: ["data.video-chat-opening"] } },
    });
    expect(events[1]).toMatchObject({
      data: {
        line: "The Moon turns, perfectly matching its orbit.",
        keyword: "moon orbit earth",
      },
    });
    expect(streamCalls).toBe(1);
    expect(generatedTasks).toEqual([]);
    expect(systemPrompt).toContain("6-9 words");
    expect(systemPrompt).toContain('"type":"video-chat.opening"');
  });

  it("requires an explicit authorization policy", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    expect(() => createVideoChatHandler({
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
    })).toThrow('createVideoChatHandler requires authorize or authorize: "none"');
  });

  it("exposes one provider-neutral endpoint with capability fallbacks", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
    });

    const response = await handler(new Request("https://app.example/api/video-chat?action=capabilities"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      templates: true,
      generatedSpeech: false,
      generatedVideo: false,
      stockMedia: false,
      transcription: false,
      modes: ["templates"],
    });

    const speech = await handler(new Request("https://app.example/api/video-chat?action=speech", {
      method: "POST",
      body: JSON.stringify({ text: "Use the browser voice" }),
    }));
    expect(speech.status).toBe(204);
    expect(await speech.text()).toBe("");
  });

  it("turns a prompt into the existing video stream with SDK-owned general guidance", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    let systemPrompt = "";
    let userPrompt = "";
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: (context: { systemPrompt: string; userPrompt: string }) => {
        systemPrompt = context.systemPrompt;
        userPrompt = context.userPrompt;
        return plannedResponse()();
      },
      generateText: async () => "unused",
    });
    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Invent a playful bedtime story about a moonlit bakery",
        opening: "Tonight, one impossible loaf is about to change this tiny bakery.",
        mode: "templates",
        orientation: "landscape",
        conversation: [{ prompt: "Make it whimsical", response: "We chose a tiny fox hero." }],
      }),
    }));
    const events = [];
    for await (const event of decodeVideoSse(response.body!)) events.push(event);

    expect(response.status).toBe(200);
    expect(events.at(-1)?.type).toBe("response.complete");
    expect(systemPrompt).toContain("A story should feel like a story");
    expect(systemPrompt).toContain("creative request");
    expect(systemPrompt).toContain("Every scene.add carries a narration");
    expect(systemPrompt).not.toContain('"id":"reaction"');
    expect(systemPrompt).not.toContain('"id":"ctaMedia"');
    expect(userPrompt).toContain("Invent a playful bedtime story");
    expect(userPrompt).toContain("Make it whimsical");
    expect(userPrompt).toContain("tiny fox hero");
    expect(userPrompt).toContain("OPENING ALREADY SPOKEN");
    expect(userPrompt).toContain("one impossible loaf");
  });

  it("resolves a streamed opening keyword into stock footage separately", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const mediaCalls: Array<{ query: string; purpose: string }> = [];
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
      searchMedia: async (query: string, { purpose }: { purpose: string }) => {
        mediaCalls.push({ query, purpose });
        return { url: "https://media.example/moon.mp4", type: "video" };
      },
    });

    const media = await handler(new Request("https://app.example/api/video-chat?action=opening-media", {
      method: "POST",
      body: JSON.stringify({ keyword: "moon orbit earth", orientation: "landscape" }),
    }));
    expect(await media.json()).toEqual({
      media: { url: "https://media.example/moon.mp4", type: "video" },
    });
    expect(mediaCalls).toEqual([{ query: "moon orbit earth", purpose: "response" }]);
  });

  it("keeps generated-video spend limits on the server and rejects the removed mixed mode", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    let generated = 0;
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: async function* () {
        yield '{"type":"scene.add","scene":{"id":"film-one","templateId":"media","variables":{"texts":"First","mediaType":"video","mediaKeyword":"fox baking bread"},"timing":{"fixedDuration":4}}}\n';
        yield '{"type":"scene.add","placement":"closer","scene":{"id":"film-two","templateId":"media","variables":{"texts":"Second","mediaType":"video","mediaKeyword":"moon over bakery"},"timing":{"fixedDuration":4}}}\n';
        yield '{"type":"plan.complete"}\n';
      },
      generateText: async () => "unused",
      generateVideo: async () => {
        generated += 1;
        return { url: "https://media.example/generated.mp4", type: "video" };
      },
    });
    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Tell a story",
        mode: "full",
        orientation: "portrait",
        maxGeneratedVideos: 99,
      }),
    }));

    expect(response.status).toBe(400);
    expect(generated).toBe(0);

    const removed = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Tell a story", mode: "some", orientation: "portrait" }),
    }));
    expect(removed.status).toBe(400);
    expect(generated).toBe(0);

    const allowed = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Tell a story", mode: "full", orientation: "portrait" }),
    }));
    await allowed.text();
    expect(allowed.status).toBe(200);
    expect(generated).toBe(2);
  });

  it("pre-generates the opening director's first full-video shot while planning scenes two through five", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const firstShot = {
      text: "The impossible loaf rises",
      narration: "Inside the sleeping bakery, one impossible loaf begins quietly rewriting every rule.",
      mediaKeyword: "glowing bread rising oven",
    };
    const generatedQueries: string[] = [];
    let releaseFirstShot!: () => void;
    const firstShotReady = new Promise<void>((resolve) => { releaseFirstShot = resolve; });
    let plannerStarted!: () => void;
    const plannerDidStart = new Promise<void>((resolve) => { plannerStarted = resolve; });
    let plannerSystemPrompt = "";
    let plannerUserPrompt = "";
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      generateText: async () => "unused",
      streamText: ({ systemPrompt, userPrompt }: { systemPrompt: string; userPrompt: string }) => {
        plannerSystemPrompt = systemPrompt;
        plannerUserPrompt = userPrompt;
        return {
          textStream: (async function* () {
            yield `${JSON.stringify({
              type: "video-chat.opening",
              spokenHook: "Tonight, one impossible loaf changes this tiny bakery.",
              mediaKeyword: "moonlit bakery window",
              firstShot,
            })}\n`;
            plannerStarted();
            yield '{"type":"scene.add","placement":"closer","scene":{"id":"ending","templateId":"media","variables":{"texts":"Morning tastes different","mediaType":"video","mediaKeyword":"sunrise bakery customers"},"timing":{"fixedDuration":5},"narration":"By sunrise, every customer carries a little piece of impossible courage home."}}\n';
            yield '{"type":"scene.add","scene":{"id":"body-2","templateId":"media","variables":{"texts":"Flour starts floating","mediaType":"video","mediaKeyword":"floating flour bakery"},"timing":{"fixedDuration":5},"narration":"Flour lifts from the counter as the baker watches gravity loosen its grip."}}\n';
            yield '{"type":"scene.add","scene":{"id":"body-3","templateId":"media","variables":{"texts":"The town wakes","mediaType":"video","mediaKeyword":"town bakery dawn"},"timing":{"fixedDuration":5},"narration":"The warm scent rolls through town, drawing dreamers toward the glowing doorway."}}\n';
            yield '{"type":"scene.add","scene":{"id":"body-4","templateId":"media","variables":{"texts":"One brave bite","mediaType":"video","mediaKeyword":"child tasting bread"},"timing":{"fixedDuration":5},"narration":"One brave child takes a bite, and suddenly everyone remembers their boldest dream."}}\n';
            yield '{"type":"plan.complete"}\n';
          })(),
          finishReason: Promise.resolve("stop"),
        };
      },
      generateVideo: async (query: string) => {
        const index = generatedQueries.push(query);
        if (index === 1) await firstShotReady;
        return {
          url: `https://media.example/${index}.mp4`,
          type: "video" as const,
        };
      },
    });

    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Tell a moonlit bakery story",
        mode: "full",
        orientation: "landscape",
      }),
    }));
    const consuming = (async () => {
      const events = [];
      for await (const event of decodeVideoSse(response.body!)) events.push(event);
      return events;
    })();

    await plannerDidStart;
    expect(generatedQueries[0]).toBe(firstShot.mediaKeyword);
    releaseFirstShot();
    const events = await consuming;
    const scenes = events.flatMap((event) => event.type === "scene.add" ? [event.data.scene] : []);

    expect(scenes).toHaveLength(5);
    expect(scenes[0]).toMatchObject({
      templateId: "media",
      narration: firstShot.narration,
      variables: {
        texts: firstShot.text,
        mediaUrl: "https://media.example/1.mp4",
        mediaType: "video",
      },
    });
    expect(generatedQueries).toHaveLength(5);
    expect(plannerSystemPrompt).toContain("emit exactly four additional scenes");
    expect(plannerSystemPrompt).toContain('"type":"video-chat.opening"');
    expect(plannerUserPrompt).toContain("Tell a moonlit bakery story");
  });

  it("bounds provider first-shot direction instead of dropping the full-video fast path", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const queries: string[] = [];
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: async function* () {
        yield `${JSON.stringify({
          type: "video-chat.opening",
          spokenHook: "One patient robot is about to make Mars bloom.",
          mediaKeyword: "robot garden Mars",
          firstShot: {
            text: "The first seed",
            narration: "Its careful hands press one fragile seed into the red soil.",
            mediaKeyword: "robot metal hand gently pressing one tiny green seed",
            camera: "close-up",
          },
        })}\n`;
        yield* plannedResponse()();
      },
      generateText: async () => "unused",
      generateVideo: async (query: string) => {
        queries.push(query);
        return { url: "https://media.example/generated.mp4", type: "video" };
      },
    });

    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Tell a story about a robot garden on Mars", mode: "full" }),
    }));
    const events = [];
    for await (const event of decodeVideoSse(response.body!)) events.push(event);
    const opening = events.find(({ type }) => type === "data.video-chat-opening");
    const first = events.find(({ type }) => type === "scene.add");

    expect(opening?.data).toEqual({
      line: "One patient robot is about to make Mars bloom.",
      keyword: "robot garden Mars",
    });
    expect(first?.type === "scene.add" && first.data.scene).toMatchObject({
      narration: "Its careful hands press one fragile seed into the red soil.",
      variables: { texts: "The first seed" },
    });
    expect(queries[0]).toBe("robot metal hand gently pressing one tiny green");
  });

  it("does not start a paid first shot before the composed video input is validated", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    let generated = 0;
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
      generateVideo: async () => {
        generated += 1;
        return { url: "https://media.example/generated.mp4", type: "video" as const };
      },
    });
    const response = await handler(new Request("https://app.example/api/video-chat?action=response", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Tell a story",
        mode: "full",
        style: "not-a-style-object",
      }),
    }));
    await response.text();

    expect(response.status).toBe(400);
    expect(generated).toBe(0);
  });

  it("runs optional providers through bounded neutral adapters", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const tasks: string[] = [];
    const mediaPurposes: string[] = [];
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async ({ task }: { task: string }) => {
        tasks.push(task);
        return task === "suggestions"
          ? '{"suggestions":[{"prompt":"Continue the story","keyword":"moon bakery"}]}'
          : "A clean line";
      },
      generateSpeech: async () => ({ audio: new Uint8Array([1, 2, 3]), mediaType: "audio/test" }),
      transcribe: async ({ audio }: { audio: Uint8Array }) => `heard ${audio.byteLength} bytes`,
      searchMedia: async (_query: string, { purpose }: { purpose: string }) => {
        mediaPurposes.push(purpose);
        return {
          url: "https://media.example/stock.mp4",
          type: "video",
          providerSecret: "must stay on the server",
        };
      },
      generateVideo: async () => ({ url: "https://media.example/generated.mp4", type: "video" }),
    });

    const capabilities = await handler(new Request("https://app.example/api/video-chat?action=capabilities"));
    expect(await capabilities.json()).toMatchObject({
      generatedSpeech: true,
      generatedVideo: true,
      stockMedia: true,
      transcription: true,
      modes: ["templates", "full"],
    });

    const suggestions = await handler(new Request("https://app.example/api/video-chat?action=suggestions", {
      method: "POST",
      body: JSON.stringify({ prompt: "Tell me something", lines: ["One line"] }),
    }));
    expect(await suggestions.json()).toEqual({
      suggestions: [{
        prompt: "Continue the story",
        media: { url: "https://media.example/stock.mp4", type: "video" },
      }],
    });

    const speech = await handler(new Request("https://app.example/api/video-chat?action=speech", {
      method: "POST",
      body: JSON.stringify({ text: "Hello" }),
    }));
    expect(speech.headers.get("content-type")).toBe("audio/test");
    expect([...new Uint8Array(await speech.arrayBuffer())]).toEqual([1, 2, 3]);

    const transcription = await handler(new Request("https://app.example/api/video-chat?action=transcription", {
      method: "POST",
      headers: { "content-type": "audio/webm" },
      body: new Uint8Array([4, 5]),
    }));
    expect(await transcription.json()).toEqual({ text: "heard 2 bytes" });

    const welcome = await handler(new Request("https://app.example/api/video-chat?action=welcome"));
    const welcomeBody = await welcome.json() as { hero: unknown; cards: Array<{ opening?: string }> };
    expect(welcomeBody.cards).toHaveLength(4);
    expect(welcomeBody.cards.every(({ opening }) => Boolean(opening))).toBe(true);
    expect(JSON.stringify(welcomeBody)).not.toContain("providerSecret");
    expect(tasks).toEqual(["suggestions"]);
    expect(mediaPurposes).toEqual(["suggestion", "welcome", "welcome", "welcome", "welcome", "welcome"]);
  });

  it("cancels welcome media work with the request", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    let providerSignal: AbortSignal | undefined;
    let providerStarted!: () => void;
    const started = new Promise<void>((resolve) => { providerStarted = resolve; });
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
      welcome: { heroQuery: "ocean", prompts: [] },
      searchMedia: async (_query: string, { signal }: { signal: AbortSignal }) => {
        providerSignal = signal;
        providerStarted();
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        return null;
      },
    });
    const controller = new AbortController();
    const pending = handler(new Request("https://app.example/api/video-chat?action=welcome", {
      signal: controller.signal,
    }));

    await started;
    controller.abort("prompt replaced");
    await pending;

    expect(providerSignal?.aborted).toBe(true);
  });

  it("does not cache a failed welcome lookup", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    let calls = 0;
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
      welcome: { heroQuery: "ocean", prompts: [] },
      searchMedia: () => {
        calls += 1;
        if (calls === 1) throw new Error("temporary provider failure");
        return {
          url: "https://media.example/recovered.jpg",
          type: "image",
          providerSecret: "must stay on the server",
        };
      },
    });

    const failed = await handler(new Request("https://app.example/api/video-chat?action=welcome"));
    expect(await failed.json()).toEqual({ hero: null, cards: [] });
    const recovered = await handler(new Request("https://app.example/api/video-chat?action=welcome"));
    expect(await recovered.json()).toEqual({
      hero: { url: "https://media.example/recovered.jpg", type: "image" },
      cards: [],
    });
    await handler(new Request("https://app.example/api/video-chat?action=welcome"));
    expect(calls).toBe(2);
  });

  it("returns a provider failure instead of blaming valid speech input", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const errors: string[] = [];
    const handler = createVideoChatHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
      generateSpeech: async () => { throw new Error("private provider detail"); },
      onError: (error: Error) => { errors.push(error.message); },
    });
    const response = await handler(new Request("https://app.example/api/video-chat?action=speech", {
      method: "POST",
      body: JSON.stringify({ text: "Hello" }),
    }));

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private provider detail");
    expect(errors).toEqual(["private provider detail"]);
  });

  it("keeps CORS headers on the streamed response", async () => {
    const createVideoChatHandler = await loadCreateVideoChatHandler();
    const handler = createVideoChatHandler({
      authorize: "none",
      allowedOrigins: ["https://client.example"],
      heartbeatMs: false,
      streamText: plannedResponse(),
      generateText: async () => "unused",
    });
    const response = await handler(new Request("https://api.example/video-chat?action=response", {
      method: "POST",
      headers: {
        origin: "https://client.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ prompt: "A clear answer", mode: "templates" }),
    }));

    expect(response.headers.get("access-control-allow-origin")).toBe("https://client.example");
  });
});
