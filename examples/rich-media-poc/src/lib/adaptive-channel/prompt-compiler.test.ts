import { describe, expect, it } from "vitest";
import { compileImagePrompt, compileVideoPrompt } from "./prompt-compiler";
import type { ChannelWorld, PlannedChannelScene } from "./types";

const world: ChannelWorld = {
  premise: "A late-night radio operator receives tomorrow's weather report from space.",
  visualStyle: "cinematic retro-futurism, practical sets, fine film grain",
  setting: "an isolated observatory above a stormy coast",
  characterBible: "Mara, 34, short black hair, mustard field jacket, silver headphones",
  continuityRules: ["Mara's jacket and headphones never change", "No logos or readable text"],
};

const scene: PlannedChannelScene = {
  id: "receiver",
  headline: "Tomorrow is calling.",
  description: "Mara hears a voice inside the static.",
  factuality: "fictional",
  motion: "essential",
  novelty: "high",
  continuityRole: "character",
  manualRoute: "auto",
  stockQuery: "radio static night",
  durationSec: 5,
  shot: {
    framing: "tight close-up",
    camera: "slow handheld push toward the receiver",
    action: "Mara freezes, then reaches for the tuning dial.",
    lighting: "amber instrument lights against blue storm light",
    beats: [
      { fromSec: 0, toSec: 2, action: "Static pulses with the lightning." },
      { fromSec: 2, toSec: 5, action: "Mara slowly reaches for the dial." },
    ],
    sound: "distant thunder, analog static, one clear electronic tone",
  },
};

describe("provider-neutral prompt compilation", () => {
  it("writes an image prompt around identity, composition, and continuity", () => {
    const prompt = compileImagePrompt(world, scene);

    expect(prompt).toContain(world.characterBible);
    expect(prompt).toContain("tight close-up");
    expect(prompt).toContain("No logos or readable text");
    expect(prompt).not.toContain("0-2s");
  });

  it("writes H3-style temporal direction as one prompt", () => {
    const prompt = compileVideoPrompt(world, scene);

    expect(prompt).toContain("0-2s: Static pulses with the lightning.");
    expect(prompt).toContain("2-5s: Mara slowly reaches for the dial.");
    expect(prompt).toContain("Camera: slow handheld push toward the receiver");
    expect(prompt).not.toContain("Sound:");
  });

  it.each(["scene", "none"] as const)("does not inject the character bible into a %s-continuity shot", (continuityRole) => {
    const roleScene = { ...scene, continuityRole };

    expect(compileImagePrompt(world, roleScene)).not.toContain(world.characterBible);
    expect(compileVideoPrompt(world, roleScene)).not.toContain(world.characterBible);
  });
});
