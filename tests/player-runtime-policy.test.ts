import { describe, expect, it } from "vitest";
import { resolvePlaybackPolicy } from "../src/player/playback-policy.js";

describe("player playback policy", () => {
  it("keeps manual playback stopped", () => {
    expect(resolvePlaybackPolicy({
      playbackMode: "manual",
      autoPlay: true,
      startMuted: true,
      audioUnlocked: false,
      reducedMotion: false,
      hasStream: true,
    })).toEqual({
      resolvedStartMuted: false,
      shouldAutoPlay: false,
      autoStartGeneration: false,
    });
  });

  it("starts muted autoplay streams behind the generation intro", () => {
    expect(resolvePlaybackPolicy({
      playbackMode: "muted-autoplay",
      autoPlay: false,
      startMuted: false,
      audioUnlocked: false,
      reducedMotion: false,
      hasStream: true,
    })).toEqual({
      resolvedStartMuted: true,
      shouldAutoPlay: true,
      autoStartGeneration: true,
    });
  });

  it("waits for interaction before autoplaying with sound", () => {
    const policy = {
      playbackMode: "autoplay-after-interaction" as const,
      autoPlay: true,
      startMuted: true,
      reducedMotion: false,
      hasStream: true,
    };

    expect(resolvePlaybackPolicy({ ...policy, audioUnlocked: false }).shouldAutoPlay).toBe(false);
    expect(resolvePlaybackPolicy({ ...policy, audioUnlocked: true }).shouldAutoPlay).toBe(true);
  });

  it("lets reduced-motion preferences block automatic generation playback", () => {
    expect(resolvePlaybackPolicy({
      playbackMode: "autoplay-with-sound",
      autoPlay: true,
      startMuted: false,
      audioUnlocked: true,
      reducedMotion: true,
      hasStream: true,
    }).autoStartGeneration).toBe(false);
  });
});
