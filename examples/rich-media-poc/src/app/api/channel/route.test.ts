import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const falSubscribe = vi.hoisted(() => vi.fn());
const aiGenerateImage = vi.hoisted(() => vi.fn());
const aiGenerateVideo = vi.hoisted(() => vi.fn());

vi.mock("@fal-ai/client", () => ({
  createFalClient: () => ({ subscribe: falSubscribe }),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateImage: aiGenerateImage,
    experimental_generateVideo: aiGenerateVideo,
  };
});

const previousLocalDemo = process.env.VANILLASKY_LOCAL_DEMO;
const previousLiveMedia = process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA;
const previousFalKey = process.env.FAL_KEY;
const previousPexelsKey = process.env.PEXELS_API_KEY;
const previousFixtureFallback = process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK;
const previousStoryPlannerModel = process.env.FAL_STORY_PLANNER_MODEL;

afterEach(() => {
  if (previousLocalDemo === undefined) delete process.env.VANILLASKY_LOCAL_DEMO;
  else process.env.VANILLASKY_LOCAL_DEMO = previousLocalDemo;
  if (previousLiveMedia === undefined) delete process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA;
  else process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA = previousLiveMedia;
  if (previousFalKey === undefined) delete process.env.FAL_KEY;
  else process.env.FAL_KEY = previousFalKey;
  if (previousPexelsKey === undefined) delete process.env.PEXELS_API_KEY;
  else process.env.PEXELS_API_KEY = previousPexelsKey;
  if (previousFixtureFallback === undefined) delete process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK;
  else process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK = previousFixtureFallback;
  if (previousStoryPlannerModel === undefined) delete process.env.FAL_STORY_PLANNER_MODEL;
  else process.env.FAL_STORY_PLANNER_MODEL = previousStoryPlannerModel;
  falSubscribe.mockReset();
  aiGenerateImage.mockReset();
  aiGenerateVideo.mockReset();
});

describe("POST /api/channel", () => {
  it("fails closed outside explicit local demo mode", async () => {
    delete process.env.VANILLASKY_LOCAL_DEMO;
    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ premise: "A strange signal arrives.", sceneCount: 3 }),
    }));

    expect(response.status).toBe(403);
  });

  it("plans a coherent how-to and streams its five text-to-video scenes concurrently with fixtures", async () => {
    process.env.VANILLASKY_LOCAL_DEMO = "1";
    delete process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA;
    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ prompt: "How to bake fluffy American pancakes" }),
    }));
    const messages = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    const videoEvents = messages.filter(({ kind }) => kind === "video").map(({ event }) => event);
    const scenes = messages.filter(({ kind }) => kind === "scene");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    expect(videoEvents[0]?.type).toBe("response.start");
    expect(videoEvents.filter(({ type }: { type: string }) => type === "audio.set")).toEqual([
      expect.objectContaining({
        data: {
          audio: expect.objectContaining({ trackId: "channel-score", volume: 0.16 }),
        },
      }),
    ]);
    expect(videoEvents.filter(({ type }: { type: string }) => type === "scene.add")).toHaveLength(5);
    expect(scenes.map(({ resolved }: { resolved: { decision: { route: string } } }) => resolved.decision.route))
      .toEqual(["generate-video", "generate-video", "generate-video", "generate-video", "generate-video"]);
    expect(scenes.map(({ resolved }: { resolved: { plan: { headline: string } } }) => resolved.plan.headline))
      .toEqual([
        "Fluff starts with the dry mix.",
        "Whisk the wet ingredients.",
        "Fold gently. Leave a few lumps.",
        "Flip when bubbles reach the surface.",
        "Stack, top, and serve warm.",
      ]);
    expect(messages.some(({ kind, peakConcurrency }) => kind === "chapter" && peakConcurrency === 5)).toBe(true);
    expect(messages.some(({ kind, chapters }) => kind === "complete" && chapters === 1)).toBe(true);
  });

  it("does not mask a broken live configuration with fixtures", async () => {
    process.env.VANILLASKY_LOCAL_DEMO = "1";
    process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA = "1";
    delete process.env.FAL_KEY;
    delete process.env.PEXELS_API_KEY;
    delete process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK;

    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ prompt: "A strange signal predicts tomorrow." }),
    }));

    expect(response.status).toBe(503);
  });

  it("uses a Fal language model to create the live story outline before starting five video jobs", async () => {
    process.env.VANILLASKY_LOCAL_DEMO = "1";
    process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA = "1";
    process.env.FAL_KEY = "test-fal-key";
    delete process.env.PEXELS_API_KEY;
    process.env.FAL_STORY_PLANNER_MODEL = "test/story-model";
    const headlines = [
      "Choose a bright, sheltered spot.",
      "Fill the pot with loose soil.",
      "Scatter seeds across the surface.",
      "Keep the topsoil gently moist.",
      "Pinch the first fragrant leaves.",
    ];
    falSubscribe.mockResolvedValue({
      data: {
        output: JSON.stringify({
          contentType: "how-to",
          visualStyle: "bright natural garden cinematography with tactile macro detail",
          setting: "the same sunny kitchen windowsill with one terracotta pot",
          characterBible: "the same gardener's hands, terracotta pot, and tools",
          continuityRules: ["Keep the pot, setting, tools, and daylight consistent"],
          scenes: headlines.map((headline, index) => ({
            headline,
            description: `Specific basil-growing step ${index + 1}.`,
            framing: "tactile gardening close-up",
            camera: "one slow controlled push",
            action: `Complete basil-growing step ${index + 1}.`,
            lighting: "soft consistent window light",
            sound: "quiet room tone and one specific action sound",
          })),
        }),
      },
    });
    aiGenerateVideo.mockImplementation(async () => ({
      video: {
        uint8Array: new Uint8Array([0, 1, 2, 3]),
        mediaType: "video/mp4",
      },
    }));

    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ prompt: "How to grow basil on a kitchen windowsill" }),
    }));
    const messages = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
    const scenes = messages.filter(({ kind }) => kind === "scene");

    expect(scenes.map(({ resolved }: { resolved: { plan: { headline: string } } }) => resolved.plan.headline))
      .toEqual(headlines);
    expect(falSubscribe).toHaveBeenCalledWith("openrouter/router", expect.objectContaining({
      input: expect.objectContaining({
        model: "test/story-model",
        prompt: expect.stringContaining("How to grow basil on a kitchen windowsill"),
        system_prompt: expect.stringContaining("coherent five-scene"),
      }),
    }));
    expect(aiGenerateVideo).toHaveBeenCalledTimes(5);
    expect(aiGenerateVideo.mock.calls.every(([options]) => options.model.modelId === "minimax/h3-max/text-to-video"))
      .toBe(true);
    expect(scenes.every(({ resolved }: { resolved: { media: { url: string } } }) => (
      resolved.media.url.startsWith("/api/channel-media/")
    ))).toBe(true);
    expect(falSubscribe.mock.calls.filter(([model]) => model === "minimax/h3-max/text-to-video"))
      .toHaveLength(0);
  });
});
