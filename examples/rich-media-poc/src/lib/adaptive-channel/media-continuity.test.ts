import { describe, expect, it } from "vitest";
import { advanceMediaContinuity } from "./media-continuity";

describe("adaptive channel media continuity", () => {
  it("never carries a non-adjacent keyframe across intervening media", () => {
    const afterCharacter = advanceMediaContinuity({}, {
      type: "image",
      url: "https://media.example/mara.webp",
      provider: "image",
      characterReferenceImageUrl: "https://media.example/mara.webp",
      keyframeImageUrl: "https://media.example/mara.webp",
    });
    const afterUnframedVideo = advanceMediaContinuity(afterCharacter, {
      type: "video",
      url: "https://media.example/coast.mp4",
      provider: "stock",
    });

    expect(afterUnframedVideo.characterReferenceImageUrl).toBe("https://media.example/mara.webp");
    expect(afterUnframedVideo.previousKeyframeImageUrl).toBeUndefined();
  });

  it("uses only the immediately preceding image or video poster for scene continuity", () => {
    expect(advanceMediaContinuity({}, {
      type: "image",
      url: "https://media.example/map.webp",
      provider: "stock",
    }).previousKeyframeImageUrl).toBe("https://media.example/map.webp");

    expect(advanceMediaContinuity({}, {
      type: "video",
      url: "https://media.example/door.mp4",
      posterUrl: "https://media.example/door-poster.webp",
      provider: "stock",
    }).previousKeyframeImageUrl).toBe("https://media.example/door-poster.webp");
  });
});
