export interface VideoChatFirstShot {
  text: string;
  narration: string;
  mediaKeyword: string;
}

function boundedText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && [...trimmed].length <= maximum ? trimmed : undefined;
}

/** Keep the browser-carried first-shot direction small and provider-neutral. */
export function sanitizeVideoChatFirstShot(value: unknown): VideoChatFirstShot | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const shot = value as Record<string, unknown>;
  if (Object.keys(shot).some((key) => !["text", "narration", "mediaKeyword"].includes(key))) {
    return undefined;
  }
  const text = boundedText(shot.text, 120);
  const narration = boundedText(shot.narration, 300);
  const mediaKeyword = boundedText(shot.mediaKeyword, 80);
  const mediaWords = mediaKeyword?.match(/\S+/gu)?.length ?? 0;
  if (!text || !narration || !mediaKeyword || mediaWords > 8) return undefined;
  return { text, narration, mediaKeyword };
}
