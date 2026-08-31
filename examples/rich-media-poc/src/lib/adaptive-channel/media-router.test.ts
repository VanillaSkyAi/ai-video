import { describe, expect, it, vi } from "vitest";
import { resolvePlannedScene } from "./media-router";
import type { ChannelWorld, MediaAdapter, PlannedChannelScene } from "./types";

const world: ChannelWorld = {
  premise: "A mysterious transmission predicts the next sunrise.",
  visualStyle: "cinematic retro-futurism",
  setting: "a radio observatory",
  characterBible: "Mara in a mustard field jacket and silver headphones",
  continuityRules: ["Keep Mara visually consistent"],
};

const scene: PlannedChannelScene = {
  id: "turn",
  headline: "The voice knows her name.",
  description: "Mara turns toward the receiver.",
  factuality: "fictional",
  motion: "essential",
  novelty: "high",
  manualRoute: "auto",
  stockQuery: "radio operator night",
  durationSec: 5,
  shot: {
    framing: "medium close-up",
    camera: "slow push in",
    action: "Mara turns toward the receiver.",
    lighting: "blue moonlight",
  },
};

describe("adaptive media resolver", () => {
  it("falls back from video to image without losing the original decision", async () => {
    const video: MediaAdapter = {
      route: "generate-video",
      resolve: vi.fn().mockRejectedValue(new Error("video provider busy")),
    };
    const image: MediaAdapter = {
      route: "generate-image",
      resolve: vi.fn().mockResolvedValue({
        type: "image",
        url: "/ai-scene.webp",
        provider: "fixture-image",
      }),
    };

    const resolved = await resolvePlannedScene({
      world,
      scene,
      bufferSeconds: 20,
      adapters: [video, image],
    });

    expect(video.resolve).toHaveBeenCalledOnce();
    expect(image.resolve).toHaveBeenCalledOnce();
    expect(resolved.decision.route).toBe("generate-video");
    expect(resolved.resolvedRoute).toBe("generate-image");
    expect(resolved.media.provider).toBe("fixture-image");
    expect(resolved.fallbacks).toEqual(["generate-video"]);
  });

  it("passes explicit character and previous-keyframe continuity into generation requests", async () => {
    const video: MediaAdapter = {
      route: "generate-video",
      resolve: vi.fn().mockResolvedValue({
        type: "video",
        url: "https://media.example/clip.mp4",
        provider: "fixture-video",
      }),
    };

    await resolvePlannedScene({
      world,
      scene,
      bufferSeconds: 20,
      characterReferenceImageUrl: "https://media.example/mara-character.webp",
      previousKeyframeImageUrl: "https://media.example/mara-previous.webp",
      adapters: [video],
    });

    expect(video.resolve).toHaveBeenCalledWith(expect.objectContaining({
      characterReferenceImageUrl: "https://media.example/mara-character.webp",
      previousKeyframeImageUrl: "https://media.example/mara-previous.webp",
    }));
  });

  it("reuses an existing continuity frame instead of generating a blocking low-buffer fallback", async () => {
    const image: MediaAdapter = {
      route: "generate-image",
      resolve: vi.fn(),
    };

    const resolved = await resolvePlannedScene({
      world,
      scene: { ...scene, continuityRole: "character" },
      bufferSeconds: 0,
      characterReferenceImageUrl: "https://media.example/mara-character.webp",
      adapters: [image],
    });

    expect(image.resolve).not.toHaveBeenCalled();
    expect(resolved.decision.route).toBe("generate-image");
    expect(resolved.media).toMatchObject({
      type: "image",
      url: "https://media.example/mara-character.webp",
      provider: "continuity-cache",
      characterReferenceImageUrl: "https://media.example/mara-character.webp",
      generationTiming: { requestMs: 0 },
    });
  });

  it("never fabricates a fallback when factual stock media is unavailable", async () => {
    const stock: MediaAdapter = {
      route: "stock",
      resolve: vi.fn().mockRejectedValue(new Error("no factual footage")),
    };
    const image: MediaAdapter = {
      route: "generate-image",
      resolve: vi.fn().mockResolvedValue({ type: "image", url: "/invented.webp", provider: "image" }),
    };

    const resolved = await resolvePlannedScene({
      world,
      scene: { ...scene, factuality: "factual" },
      bufferSeconds: 20,
      adapters: [stock, image],
    });

    expect(resolved.resolvedRoute).toBe("gradient");
    expect(image.resolve).not.toHaveBeenCalled();
  });

  it("propagates cancellation without trying a paid fallback", async () => {
    const controller = new AbortController();
    const video: MediaAdapter = {
      route: "generate-video",
      resolve: vi.fn().mockImplementation(async () => {
        controller.abort();
        throw new DOMException("Cancelled", "AbortError");
      }),
    };
    const image: MediaAdapter = {
      route: "generate-image",
      resolve: vi.fn(),
    };

    await expect(resolvePlannedScene({
      world,
      scene,
      bufferSeconds: 20,
      adapters: [video, image],
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(image.resolve).not.toHaveBeenCalled();
  });
});
