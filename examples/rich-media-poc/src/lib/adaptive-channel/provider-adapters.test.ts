import { describe, expect, it, vi } from "vitest";
import {
  createAiSdkImageAdapter,
  createAiSdkVideoAdapter,
  createFixtureAdapters,
  createPexelsAdapter,
} from "./provider-adapters";
import type { MediaResolveRequest, PlannedChannelScene } from "./types";

const scene: PlannedChannelScene = {
  id: "signal",
  headline: "Tomorrow is calling.",
  description: "Mara hears a voice in the static.",
  factuality: "fictional",
  motion: "essential",
  novelty: "high",
  continuityRole: "character",
  manualRoute: "auto",
  stockQuery: "radio operator night",
  durationSec: 5,
  shot: {
    framing: "close-up",
    camera: "slow push in",
    action: "Mara reaches for the dial.",
    lighting: "amber and blue",
  },
};

const request: MediaResolveRequest = {
  world: {
    premise: "A strange radio predicts tomorrow.",
    visualStyle: "retro-futurist cinema",
    setting: "a coastal observatory",
    characterBible: "Mara wears a mustard jacket",
    continuityRules: ["Keep Mara consistent"],
  },
  scene,
  prompt: "A complete provider prompt",
  orientation: "portrait",
};

describe("AI SDK media adapters", () => {
  it("maps generated image bytes through application-owned storage", async () => {
    const image = {
      uint8Array: new Uint8Array([1, 2, 3]),
      mediaType: "image/jpeg",
    };
    const generate = vi.fn().mockResolvedValue({ image });
    const store = vi.fn().mockResolvedValue({ url: "/api/channel-media/image-1.jpg" });
    const controller = new AbortController();

    const media = await createAiSdkImageAdapter({
      generate,
      model: "fal-image-model",
      referenceModel: "fal-reference-image-model",
      providerLabel: "fal",
      store,
    }).resolve({ ...request, signal: controller.signal });

    expect(generate).toHaveBeenCalledWith({
      model: "fal-image-model",
      prompt: request.prompt,
      aspectRatio: "9:16",
      n: 1,
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: {
        fal: {
          enableSafetyChecker: true,
          outputFormat: "jpeg",
        },
      },
    });
    expect(store).toHaveBeenCalledWith({
      data: image.uint8Array,
      mediaType: image.mediaType,
      kind: "image",
      idempotencyKey: scene.id,
    });
    expect(media).toMatchObject({
      type: "image",
      url: "/api/channel-media/image-1.jpg",
      provider: "fal · fal-image-model",
      keyframeImageUrl: "/api/channel-media/image-1.jpg",
    });
  });

  it("uses an AI SDK image prompt when a continuity reference exists", async () => {
    const generate = vi.fn().mockResolvedValue({
      image: { uint8Array: new Uint8Array([4]), mediaType: "image/png" },
    });
    const store = vi.fn().mockResolvedValue({ url: "https://cdn.example/generated.png" });

    await createAiSdkImageAdapter({
      generate,
      model: "fal-image-model",
      referenceModel: "fal-reference-image-model",
      providerLabel: "fal",
      store,
    }).resolve({
      ...request,
      characterReferenceImageUrl: "https://cdn.example/mara.webp",
    });

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: "fal-reference-image-model",
      prompt: {
        text: request.prompt,
        images: ["https://cdn.example/mara.webp"],
      },
    }));
  });

  it("maps text-to-video through AI SDK with native audio and no automatic paid retry", async () => {
    const video = {
      uint8Array: new Uint8Array([5, 6, 7]),
      mediaType: "video/mp4",
    };
    const generate = vi.fn().mockResolvedValue({ video });
    const store = vi.fn().mockResolvedValue({ url: "/api/channel-media/video-1.mp4" });
    const controller = new AbortController();

    const media = await createAiSdkVideoAdapter({
      generate,
      model: "fal-video-model",
      referenceModel: "fal-reference-video-model",
      providerLabel: "fal",
      store,
    }).resolve({ ...request, signal: controller.signal });

    expect(generate).toHaveBeenCalledWith({
      model: "fal-video-model",
      prompt: request.prompt,
      aspectRatio: "9:16",
      duration: 5,
      generateAudio: true,
      maxRetries: 0,
      abortSignal: controller.signal,
      providerOptions: {
        fal: {
          enable_safety_checker: true,
          prompt_expansion_mode: "balanced",
          resolution: "768P",
        },
      },
    });
    expect(store).toHaveBeenCalledWith({
      data: video.uint8Array,
      mediaType: video.mediaType,
      kind: "video",
      idempotencyKey: scene.id,
    });
    expect(media).toMatchObject({
      type: "video",
      url: "/api/channel-media/video-1.mp4",
      provider: "fal · fal-video-model",
    });
  });

  it("uses an AI SDK image-to-video prompt for a custom continuity frame", async () => {
    const generate = vi.fn().mockResolvedValue({
      video: { uint8Array: new Uint8Array([8]), mediaType: "video/mp4" },
    });
    const store = vi.fn().mockResolvedValue({ url: "https://cdn.example/animated.mp4" });

    await createAiSdkVideoAdapter({
      generate,
      model: "fal-video-model",
      referenceModel: "fal-reference-video-model",
      providerLabel: "fal",
      store,
    }).resolve({
      ...request,
      previousKeyframeImageUrl: "https://cdn.example/previous.webp",
      scene: { ...scene, continuityRole: "scene" },
    });

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: "fal-reference-video-model",
      prompt: {
        image: "https://cdn.example/previous.webp",
        text: request.prompt,
      },
      aspectRatio: "adaptive",
    }));
  });
});

describe("adaptive channel provider adapters", () => {
  it("uses the current Pexels video endpoint and preserves attribution", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      videos: [{
        url: "https://www.pexels.com/video/storm-42/",
        user: { name: "Avery Quinn", url: "https://www.pexels.com/@avery" },
        image: "https://images.pexels.com/videos/42/free-video-42.jpg",
        video_files: [
          { link: "https://videos.pexels.com/video-files/42/42-hd.mp4", file_type: "video/mp4", width: 1080, height: 1920 },
        ],
      }],
    }), { status: 200 }));

    const media = await createPexelsAdapter({ apiKey: "test-key", fetcher }).resolve(request);
    const calledUrl = new URL(String(fetcher.mock.calls[0]?.[0]));

    expect(calledUrl.pathname).toBe("/v1/videos/search");
    expect(calledUrl.searchParams.get("query")).toBe(scene.stockQuery);
    expect(media.credit).toEqual({
      label: "Video by Avery Quinn on Pexels",
      url: "https://www.pexels.com/video/storm-42/",
    });
  });

  it("has a no-key fixture path for local development", async () => {
    const adapters = createFixtureAdapters();
    const video = adapters.find(({ route }) => route === "generate-video");

    expect(await video?.resolve(request)).toMatchObject({
      type: "video",
      provider: "fixture-video",
    });
  });
});
