import type { ChannelWorld, PlannedChannelScene } from "./types";

function continuityDirection(world: ChannelWorld, scene: PlannedChannelScene): string | undefined {
  if (scene.continuityRole === "character") {
    const bible = [world.characterBible, ...world.continuityRules].filter(Boolean).join(". ");
    return `Character continuity: ${bible}. Maintain identity and wardrobe from the supplied reference.`;
  }
  if (scene.continuityRole === "scene") {
    return "Scene continuity: preserve environment, geography, palette, lighting, and screen direction from the supplied previous frame.";
  }
  return undefined;
}

export function compileImagePrompt(world: ChannelWorld, scene: PlannedChannelScene): string {
  return [
    `Create one ${scene.shot.framing} cinematic still for this story: ${world.premise}`,
    `World: ${world.setting}. Visual identity: ${world.visualStyle}.`,
    continuityDirection(world, scene),
    `Moment: ${scene.description} ${scene.shot.action}`,
    `Composition: ${scene.shot.framing}; ${scene.shot.lighting}; preserve useful negative space for an editorial headline.`,
    "Constraints: no subtitles, logos, watermarks, UI, borders, split screens, or readable text.",
  ].filter(Boolean).join("\n");
}

export function compileVideoPrompt(world: ChannelWorld, scene: PlannedChannelScene): string {
  const beats = scene.shot.beats?.length
    ? scene.shot.beats.map((beat) => `${beat.fromSec}-${beat.toSec}s: ${beat.action}`).join(" ")
    : `0-${scene.durationSec}s: ${scene.shot.action}`;
  return [
    continuityDirection(world, scene),
    `Story: ${world.premise}`,
    beats,
    `Setting: ${world.setting}. Shot: ${scene.shot.framing}. Camera: ${scene.shot.camera}. Lighting: ${scene.shot.lighting}.`,
    scene.shot.sound ? `Sound: ${scene.shot.sound}.` : undefined,
    `Style: ${world.visualStyle}. Keep the shot visually coherent throughout.`,
    "No subtitles, logos, watermarks, UI, borders, split screens, or readable text.",
  ].filter(Boolean).join("\n");
}
