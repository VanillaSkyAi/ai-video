import { parseVideo } from "@vanillaskyai/video";
import { describe, expect, it } from "vitest";
import { planChannelSegment } from "./channel-plan";
import { buildChannelSegment } from "./segment-builder";
import type { ResolvedChannelScene } from "./types";

describe("channel segment builder", () => {
  it("turns resolved media into a replayable finite VanillaSky video", () => {
    const planned = planChannelSegment({ premise: "Tomorrow calls from space.", sceneCount: 3, sequence: 0 });
    const scenes: ResolvedChannelScene[] = planned.scenes.map((plan, index) => ({
      plan,
      decision: {
        route: index === 0 ? "gradient" : index === 1 ? "generate-image" : "generate-video",
        reason: "Test decision",
      },
      media: index === 0
        ? { type: "gradient", url: "", provider: "brand" }
        : index === 1
          ? {
              type: "image",
              url: "https://media.example/mara.webp",
              provider: "image",
              characterReferenceImageUrl: "https://media.example/mara.webp",
              keyframeImageUrl: "https://media.example/mara.webp",
            }
          : { type: "video", url: "https://media.example/mara.mp4", posterUrl: "https://media.example/mara.webp", provider: "video" },
      fallbacks: [],
      resolvedRoute: index === 0 ? "gradient" : index === 1 ? "generate-image" : "generate-video",
    }));

    const segment = buildChannelSegment(planned, scenes, {
      characterReferenceImageUrl: "https://media.example/original-character.webp",
    });

    expect(() => parseVideo(segment.video)).not.toThrow();
    expect(segment.video.scenes[1]?.variables).toMatchObject({
      mediaUrl: "https://media.example/mara.webp",
      mediaType: "photo",
    });
    expect(segment.video.scenes[2]?.variables).toMatchObject({
      mediaUrl: "https://media.example/mara.mp4",
      mediaType: "video",
      mediaPoster: "https://media.example/mara.webp",
    });
    expect(segment.continuation.characterReferenceImageUrl).toBe("https://media.example/mara.webp");
    expect(segment.continuation.previousKeyframeImageUrl).toBe("https://media.example/mara.webp");
  });

  it("clears stale scene continuity when the final shot has no usable frame", () => {
    const planned = planChannelSegment({ premise: "Tomorrow calls from space.", sceneCount: 2, sequence: 1 });
    const scenes: ResolvedChannelScene[] = planned.scenes.map((plan, index) => ({
      plan,
      decision: { route: index === 0 ? "generate-image" : "stock", reason: "Test decision" },
      resolvedRoute: index === 0 ? "generate-image" : "stock",
      media: index === 0
        ? {
            type: "image",
            url: "https://media.example/old-frame.webp",
            keyframeImageUrl: "https://media.example/old-frame.webp",
            provider: "image",
          }
        : { type: "video", url: "https://media.example/coast.mp4", provider: "stock" },
      fallbacks: [],
    }));

    const segment = buildChannelSegment(planned, scenes, {
      previousKeyframeImageUrl: "https://media.example/old-frame.webp",
    });

    expect(segment.continuation.previousKeyframeImageUrl).toBeUndefined();
  });
});
