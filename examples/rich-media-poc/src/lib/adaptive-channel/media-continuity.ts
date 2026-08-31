import type { ResolvedMedia } from "./types";

export interface MediaContinuity {
  characterReferenceImageUrl?: string;
  previousKeyframeImageUrl?: string;
}

export function adjacentSceneReference(media: ResolvedMedia): string | undefined {
  if (media.keyframeImageUrl) return media.keyframeImageUrl;
  if (media.type === "image") return media.url || undefined;
  if (media.type === "video") return media.posterUrl;
  return undefined;
}

export function advanceMediaContinuity(
  current: MediaContinuity,
  media: ResolvedMedia,
): MediaContinuity {
  return {
    characterReferenceImageUrl: media.characterReferenceImageUrl || current.characterReferenceImageUrl,
    previousKeyframeImageUrl: adjacentSceneReference(media),
  };
}
