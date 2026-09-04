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

interface VideoFile {
  link?: unknown;
  width?: number;
  height?: number;
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

function trustedUrl(value: unknown, host: string): string {
  const url = new URL(String(value));
  if (url.protocol !== "https:" || url.hostname !== host) {
    throw new Error(`Stock search returned a URL outside ${host}`);
  }
  return url.toString();
}

function pickVideoFile(files: VideoFile[], orientation: VideoOrientation): VideoFile & { link: string } | null {
  const usable = files
    .filter((file): file is VideoFile & { link: string } => typeof file.link === "string")
    // One file on an unexpected host is one file to skip, not a reason to give
    // up the search: throwing here lost every other rendition of the same clip.
    .flatMap((file) => {
      try {
        return [{ ...file, link: trustedUrl(file.link, "videos.pexels.com") }];
      } catch {
        return [];
      }
    })
    .filter((file) => file.width && file.height);
  // Matched to the stage, because a clip cropped to the other shape loses
  // whatever the search was actually for - a landscape river in a portrait
  // frame is a column of water with both banks cut off.
  const wanted = orientation === "portrait"
    ? (file: VideoFile) => (file.height ?? 0) >= (file.width ?? 0)
    : (file: VideoFile) => (file.width ?? 0) >= (file.height ?? 0);
  return usable.find(wanted) ?? usable[0] ?? null;
}

async function search(url: string, apiKey: string, signal: AbortSignal): Promise<unknown> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.any([signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)]),
  });
  // Only a real response is worth keeping. Caching the failure would let one
  // rate-limited minute leave every response about the Moon on a gradient for
  // the hour that followed.
  if (!response.ok) return null;
  const payload = await response.json();
  cache.set(url, { payload, expiresAt: Date.now() + 60 * 60 * 1_000 });
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return payload;
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
  if (!apiKey || !keyword) return null;

  const params = new URLSearchParams({ query: keyword, orientation, per_page: "3", page: "1" });
  const started = Date.now();
  try {
    const videos = await search(`${VIDEO_SEARCH}?${params}`, apiKey, signal) as
      { videos?: Array<{ image?: unknown; video_files?: VideoFile[] }> } | null;
    for (const video of videos?.videos ?? []) {
      const file = pickVideoFile(video.video_files ?? [], orientation);
      if (!file) continue;
      console.log(`[video-chat] stock video in ${Date.now() - started}ms: ${keyword}`);
      return {
        url: file.link,
        type: "video",
        // The still shown while the video decodes its first frame, which is
        // otherwise a flash of gradient where the footage should be.
        ...(video.image ? { posterUrl: trustedUrl(video.image, "images.pexels.com") } : {}),
      };
    }

    const photos = await search(`${PHOTO_SEARCH}?${params}`, apiKey, signal) as
      { photos?: Array<{ src?: { large2x?: unknown; large?: unknown } }> } | null;
    const photo = photos?.photos?.[0]?.src?.large2x ?? photos?.photos?.[0]?.src?.large;
    if (!photo) return null;
    console.log(`[video-chat] stock photo in ${Date.now() - started}ms: ${keyword}`);
    return { url: trustedUrl(photo, "images.pexels.com"), type: "image" };
  } catch (cause) {
    // A timeout, an abort, or a search that returned something unexpected. The
    // beat keeps its copy on the brand gradient.
    if (!signal.aborted) {
      console.warn(`[video-chat] stock search failed after ${Date.now() - started}ms:`, cause instanceof Error ? cause.message : cause);
    }
    return null;
  }
}
