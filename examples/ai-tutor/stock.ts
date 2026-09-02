/**
 * Stock footage for the modes that do not generate any.
 *
 * A rendered card on a brand gradient is the least a template can look like,
 * and templates-only mode was every scene that way. A stock search costs a few
 * hundred milliseconds and nothing per request, so unlike a generated clip it
 * never lands on the critical path - the difference between cards on gradients
 * and cards over real footage is close to free.
 *
 * Ported from the site's playground, trimmed to what a tutor needs. Every URL
 * that comes back is checked against the host it must come from: the planner
 * asks for a subject, and what a search returns is not something to trust into
 * a page unexamined.
 */
const VIDEO_SEARCH = "https://api.pexels.com/videos/search";
const PHOTO_SEARCH = "https://api.pexels.com/v1/search";
const MAX_KEYWORD_LENGTH = 80;
// Shorter than the shot deadline by two orders of magnitude, deliberately: a
// scene with no footage is a scene on a gradient, and that is a better outcome
// than a lesson that waits.
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

/** One hour, keyed by query. The same lesson asked twice searches once. */
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

function pickVideoFile(files: VideoFile[]): VideoFile & { link: string } | null {
  const usable = files
    .filter((file): file is VideoFile & { link: string } => typeof file.link === "string")
    .map((file) => ({ ...file, link: trustedUrl(file.link, "videos.pexels.com") }))
    .filter((file) => file.width && file.height);
  // Landscape only: the tutor's stage is 16:9, and a portrait clip cropped to
  // it loses whatever the search was actually for.
  return usable.find((file) => (file.width ?? 0) >= (file.height ?? 0)) ?? usable[0] ?? null;
}

async function search(url: string, apiKey: string, signal: AbortSignal): Promise<unknown> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.payload;

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.any([signal, AbortSignal.timeout(LOOKUP_TIMEOUT_MS)]),
  });
  const payload = response.ok ? await response.json() : null;
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
export async function findStockFootage(subject: string, signal: AbortSignal): Promise<StockMedia | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  const keyword = normalizeKeyword(subject);
  if (!apiKey || !keyword) return null;

  const params = new URLSearchParams({ query: keyword, orientation: "landscape", per_page: "3", page: "1" });
  const started = Date.now();
  try {
    const videos = await search(`${VIDEO_SEARCH}?${params}`, apiKey, signal) as
      { videos?: Array<{ image?: unknown; video_files?: VideoFile[] }> } | null;
    for (const video of videos?.videos ?? []) {
      const file = pickVideoFile(video.video_files ?? []);
      if (!file) continue;
      console.log(`[ai-tutor] stock video in ${Date.now() - started}ms: ${keyword}`);
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
    console.log(`[ai-tutor] stock photo in ${Date.now() - started}ms: ${keyword}`);
    return { url: trustedUrl(photo, "images.pexels.com"), type: "image" };
  } catch (cause) {
    // A timeout, an abort, or a search that returned something unexpected. The
    // beat keeps its copy on the brand gradient.
    if (!signal.aborted) {
      console.warn(`[ai-tutor] stock search failed after ${Date.now() - started}ms:`, cause instanceof Error ? cause.message : cause);
    }
    return null;
  }
}
