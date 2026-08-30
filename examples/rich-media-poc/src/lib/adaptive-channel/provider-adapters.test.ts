import { describe, expect, it, vi } from "vitest";
import {
  createFalImageAdapter,
  createFalVideoAdapter,
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

describe("adaptive channel provider adapters", () => {
  it("maps a generated image into provider-neutral media", async () => {
    const subscribe = vi.fn().mockResolvedValue({
      data: { images: [{ url: "https://fal.media/mara.webp" }] },
    });
    const media = await createFalImageAdapter({ subscribe }).resolve(request);

    expect(subscribe).toHaveBeenCalledWith("fal-ai/flux/dev", expect.objectContaining({
      input: expect.objectContaining({
        prompt: request.prompt,
        image_size: "portrait_16_9",
      }),
    }));
    expect(media).toEqual({
      type: "image",
      url: "https://fal.media/mara.webp",
      provider: "fal · fal-ai/flux/dev",
      characterReferenceImageUrl: "https://fal.media/mara.webp",
      keyframeImageUrl: "https://fal.media/mara.webp",
    });
  });

  it("uses the Flux reference-only endpoint without an img2img-only field", async () => {
    const subscribe = vi.fn().mockResolvedValue({
      data: { images: [{ url: "https://fal.media/mara-next.webp" }] },
    });
    await createFalImageAdapter({ subscribe }).resolve({
      ...request,
      characterReferenceImageUrl: "https://cdn.example/mara.webp",
    });

    expect(subscribe).toHaveBeenCalledWith("fal-ai/flux-general", expect.objectContaining({
      input: expect.objectContaining({
        reference_image_url: "https://cdn.example/mara.webp",
      }),
    }));
    expect(subscribe.mock.calls[0]?.[1].input).not.toHaveProperty("image_url");
  });

  it.each([
    ["character", "https://cdn.example/mara.webp"],
    ["scene", "https://cdn.example/observatory.webp"],
    ["none", undefined],
  ] as const)("conditions generated images on the %s continuity reference", async (continuityRole, expectedReference) => {
    const subscribe = vi.fn().mockResolvedValue({
      data: { images: [{ url: "https://fal.media/next.webp" }] },
    });
    await createFalImageAdapter({ subscribe }).resolve({
      ...request,
      scene: { ...request.scene, continuityRole },
      characterReferenceImageUrl: "https://cdn.example/mara.webp",
      previousKeyframeImageUrl: "https://cdn.example/observatory.webp",
    });

    const input = subscribe.mock.calls[0]?.[1].input;
    expect(input.reference_image_url).toBe(expectedReference);
  });

  it("uses H3 image-to-video when a continuity frame exists", async () => {
    const subscribe = vi.fn().mockResolvedValue({
      data: { video: { url: "https://fal.media/mara.mp4" } },
    });
    const adapter = createFalVideoAdapter({ subscribe });
    const media = await adapter.resolve({
      ...request,
      characterReferenceImageUrl: "https://cdn.example/mara-character.webp",
      previousKeyframeImageUrl: "https://cdn.example/mara.webp",
    });

    expect(subscribe).toHaveBeenCalledWith("minimax/h3-max/image-to-video", expect.objectContaining({
      input: expect.objectContaining({
        prompt: request.prompt,
        image_url: "https://cdn.example/mara-character.webp",
        duration: 5,
        resolution: "768P",
      }),
    }));
    expect(media.type).toBe("video");
  });

  it.each([
    ["character", "https://cdn.example/mara-character.webp"],
    ["scene", "https://cdn.example/previous-scene.webp"],
    ["none", undefined],
  ] as const)("conditions generated video on the %s continuity reference", async (continuityRole, expectedReference) => {
    const subscribe = vi.fn().mockResolvedValue({
      data: { video: { url: "https://fal.media/next.mp4" } },
    });
    await createFalVideoAdapter({ subscribe }).resolve({
      ...request,
      scene: { ...request.scene, continuityRole },
      characterReferenceImageUrl: "https://cdn.example/mara-character.webp",
      previousKeyframeImageUrl: "https://cdn.example/previous-scene.webp",
    });

    const [model, options] = subscribe.mock.calls[0] || [];
    expect(model).toBe(expectedReference ? "minimax/h3-max/image-to-video" : "minimax/h3-max/text-to-video");
    expect(options.input.image_url).toBe(expectedReference);
  });

  it("passes cancellation through the fal client's abortSignal option", async () => {
    const controller = new AbortController();
    const subscribe = vi.fn().mockResolvedValue({
      data: { video: { url: "https://fal.media/next.mp4" } },
    });
    await createFalVideoAdapter({ subscribe }).resolve({
      ...request,
      signal: controller.signal,
    });

    expect(subscribe).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      abortSignal: controller.signal,
    }));
  });

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
