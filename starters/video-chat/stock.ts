/**
 * Stock footage for the modes that do not generate any.
 *
 * A rendered card on a brand gradient is the least a template can look like,
 * and templates-only mode was every scene that way. A stock search costs a few
 * hundred milliseconds and nothing per request, so unlike a generated clip it
 * never lands on the critical path - the difference between cards on gradients
 * and cards over real footage is close to free.
 *
 * Ported from the site's playground, trimmed to what a video chat needs. Every URL
 * that comes back is checked against the host it must come from: the planner
 * asks for a subject, and what a search returns is not something to trust into
 * a page unexamined.
 */
import type { VideoOrientation } from "@vanillaskyai/video";

const VIDEO_SEARCH = "https://api.pexels.com/videos/search";
const PHOTO_SEARCH = "https://api.pexels.com/v1/search";
const MAX_KEYWORD_LENGTH = 80;
// Shorter than the shot deadline by two orders of magnitude, deliberately: a
// scene with no footage is a scene on a gradient, and that is a better outcome
// than a response that waits.
const LOOKUP_TIMEOUT_MS = 4_000;

interface StockMedia {
  url: string;
  type: "video" | "image";
  posterUrl?: string;
}

/** One hour, keyed by query. The same response asked twice searches once. */
const cache = new Map<string, { payload: unknown; expiresAt: number }>();

function normalizeKeyword(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_KEYWORD_LENGTH);
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function entries(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function trustedUrl(value: unknown, host: string): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function pickVideoFile(files: unknown, orientation: VideoOrientation): string | undefined {
  const usable = entries(files).flatMap((value) => {
    const file = record(value);
    const link = trustedUrl(file.link, "videos.pexels.com");
    const { width, height } = file;
    if (!link || typeof width !== "number" || typeof height !== "number"
      || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
    return [{ link, width, height }];
  });
  // Prefer the stage's shape without discarding other safe renditions.
  return (usable.find((file) => orientation === "portrait"
    ? file.height >= file.width
    : file.width >= file.height) ?? usable[0])?.link;
}

async function search(url: string, apiKey: string, signal: AbortSignal): Promise<unknown> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  if (signal.aborted) return null;
  try {
    const response = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.any([signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)]),
    });
    if (!response.ok || signal.aborted) return null;
    const payload: unknown = await response.json();
    if (signal.aborted) return null;
    cache.set(url, { payload, expiresAt: Date.now() + 60 * 60 * 1_000 });
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return payload;
  } catch {
    // A failed video search must still allow the independent photo fallback.
    if (!signal.aborted) console.warn("[video-chat] Stock lookup unavailable; trying a fallback.");
    return null;
  }
}

/**
 * Find footage for one beat. Video first, a photograph if there is none.
 *
 * Returns null rather than throwing when there is nothing to show: the scene
 * falls back to the brand gradient, which is what it looked like before.
 */
export async function findStockFootage(subject: string, orientation: VideoOrientation, signal: AbortSignal): Promise<StockMedia | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  const keyword = normalizeKeyword(subject);
  if (!apiKey || !keyword || signal.aborted) return null;

  const params = new URLSearchParams({ query: keyword, orientation, per_page: "3", page: "1" });
  const videos = record(await search(`${VIDEO_SEARCH}?${params}`, apiKey, signal));
  if (signal.aborted) return null;
  for (const value of entries(videos.videos)) {
    const video = record(value);
    const url = pickVideoFile(video.video_files, orientation);
    if (!url) continue;
    const posterUrl = trustedUrl(video.image, "images.pexels.com");
    return { url, type: "video", ...(posterUrl ? { posterUrl } : {}) };
  }

  const photos = record(await search(`${PHOTO_SEARCH}?${params}`, apiKey, signal));
  if (signal.aborted) return null;
  for (const value of entries(photos.photos)) {
    const source = record(record(value).src);
    for (const candidate of [source.large2x, source.large]) {
      const url = trustedUrl(candidate, "images.pexels.com");
      if (url) return { url, type: "image" };
    }
  }
  return null;
}
