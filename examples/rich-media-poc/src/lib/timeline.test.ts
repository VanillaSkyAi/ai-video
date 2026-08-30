import { describe, expect, it } from "vitest";
import { lottieFrameAtProgress, selectGifFrame } from "./timeline";

describe("selectGifFrame", () => {
  const frames = [{ delayMs: 100 }, { delayMs: 200 }, { delayMs: 100 }];

  it.each([
    [0, 0],
    [0.249, 0],
    [0.25, 1],
    [0.749, 1],
    [0.75, 2],
    [1, 2],
  ])("maps progress %s to delay-aware frame %s", (progress, frame) => {
    expect(selectGifFrame(frames, progress)).toBe(frame);
  });

  it("clamps progress and handles an empty animation", () => {
    expect(selectGifFrame(frames, -1)).toBe(0);
    expect(selectGifFrame(frames, 2)).toBe(2);
    expect(selectGifFrame([], 0.5)).toBe(0);
  });
});

describe("lottieFrameAtProgress", () => {
  it.each([
    [0, 0],
    [0.5, 59.5],
    [1, 119],
    [-1, 0],
    [2, 119],
  ])("maps progress %s to frame %s", (progress, frame) => {
    expect(lottieFrameAtProgress(progress, 120)).toBe(frame);
  });

  it("handles an animation that has not loaded", () => {
    expect(lottieFrameAtProgress(0.5, 0)).toBe(0);
  });
});
