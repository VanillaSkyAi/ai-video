import { parseVideo, resolveVideoBrand, type VideoScene, type VideoStyle } from "@vanillaskyai/video";
import { advanceMediaContinuity } from "./media-continuity";
import type {
  ChannelSegment,
  PlannedSegment,
  ResolvedChannelScene,
} from "./types";

function clipHeadline(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 84 ? trimmed : `${trimmed.slice(0, 81).trimEnd()}…`;
}

export function createChannelVideoStyle(): VideoStyle {
  return {
    brand: resolveVideoBrand({
      name: "VanillaSky Adaptive Channel",
      font: "Inter",
      scriptFont: "Caveat",
      background: "twilight",
      colors: {
        primary: "#9d92ff",
        secondary: "#ff6f91",
        foreground: "#ffffff",
        surface: "#080711",
        surfaceElevated: "#17142b",
        muted: "#aaa4bc",
      },
    }),
  };
}

export function buildChannelVideoScene({ plan, media }: ResolvedChannelScene): VideoScene {
  return {
    id: plan.id,
    templateId: "media",
    variables: {
      texts: clipHeadline(plan.headline),
      mediaUrl: media.url,
      mediaType: media.type === "gradient" ? "gradient" : media.type === "image" ? "photo" : "video",
      mediaPoster: media.posterUrl || "",
      mediaPosition: "center",
      mediaTreatment: media.type === "gradient" ? "subtle" : "cinematic",
    },
    timing: { fixedDuration: plan.durationSec },
  };
}

export function buildChannelSegment(
  planned: PlannedSegment,
  scenes: readonly ResolvedChannelScene[],
  incomingContinuity: {
    characterReferenceImageUrl?: string;
    previousKeyframeImageUrl?: string;
  } = {},
): ChannelSegment {
  const id = `adaptive-channel-${planned.sequence}`;
  const outgoingContinuity = scenes.reduce(
    (continuity, scene) => advanceMediaContinuity(continuity, scene.media),
    incomingContinuity,
  );
  const video = parseVideo({
    schemaVersion: "0.1",
    orientation: "portrait",
    scenes: scenes.map(buildChannelVideoScene),
    style: createChannelVideoStyle(),
    meta: {
      name: `Adaptive channel · chapter ${planned.sequence + 1}`,
      source: "examples/rich-media-poc/channel",
    },
  });

  return {
    id,
    sequence: planned.sequence,
    video,
    scenes: [...scenes],
    continuation: {
      sequence: planned.sequence + 1,
      world: planned.world,
      previousSummary: planned.summary,
      recentBeatIds: planned.recentBeatIds,
      openThreads: planned.openThreads,
      characterReferenceImageUrl: outgoingContinuity.characterReferenceImageUrl,
      previousKeyframeImageUrl: outgoingContinuity.previousKeyframeImageUrl,
    },
  };
}
