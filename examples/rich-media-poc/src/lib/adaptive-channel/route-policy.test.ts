import { describe, expect, it } from "vitest";
import { decideMediaRoute } from "./route-policy";
import type { PlannedChannelScene } from "./types";

const baseScene: PlannedChannelScene = {
  id: "signal-arrives",
  headline: "A signal crosses the dark.",
  description: "A lone radio operator notices an impossible transmission.",
  factuality: "fictional",
  motion: "optional",
  novelty: "high",
  manualRoute: "auto",
  stockQuery: "radio operator night",
  durationSec: 5,
  shot: {
    framing: "medium close-up",
    camera: "slow push in",
    action: "The operator turns toward a pulsing receiver.",
    lighting: "cold moonlight and warm instrument glow",
  },
};

describe("adaptive media route policy", () => {
  it("gives an explicit scene override priority over automatic policy", () => {
    expect(decideMediaRoute({ ...baseScene, manualRoute: "video" }, { bufferSeconds: 0 })).toEqual({
      route: "generate-video",
      reason: "Manual video override.",
    });
  });

  it("retrieves factual visuals instead of fabricating them", () => {
    expect(decideMediaRoute({ ...baseScene, factuality: "factual" }, { bufferSeconds: 30 })).toEqual({
      route: "stock",
      reason: "Factual scenes prefer retrievable footage.",
    });
  });

  it("uses video when motion matters and enough playback is buffered", () => {
    expect(decideMediaRoute(
      { ...baseScene, motion: "essential" },
      { bufferSeconds: 14, videoP95LatencySec: 10 },
    ).route)
      .toBe("generate-video");
  });

  it("falls back to an image when the channel cannot wait for video", () => {
    expect(decideMediaRoute(
      { ...baseScene, motion: "essential" },
      { bufferSeconds: 11, videoP95LatencySec: 10 },
    )).toEqual({
      route: "generate-image",
      reason: "Low buffer converts the beat to a generated still.",
    });
  });
});
