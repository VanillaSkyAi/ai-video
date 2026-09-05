import type { VideoOrientation } from "@vanillaskyai/video";

const VIDEO_SEARCH = "https://api.pexels.com/v1/videos/search";
const PHOTO_SEARCH = "https://api.pexels.com/v1/search";
const MAX_KEYWORD_LENGTH = 80;
// One budget covers specific/broader video searches and photo recovery.
const LOOKUP_TIMEOUT_MS = 3_000;

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
    if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password || url.port) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function pickVideoFile(files: unknown, orientation: VideoOrientation): string | undefined {
  const usable = entries(files).flatMap((value) => {
    const file = record(value);
    const direct = trustedUrl(file.link, "videos.pexels.com");
    const external = trustedUrl(file.link, "player.vimeo.com");
    const link = direct ?? (external && /^\/external\/[a-zA-Z0-9._-]+\.mp4$/.test(new URL(external).pathname) ? external : undefined);
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
      signal,
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

/** Metadata is a weak mismatch filter, never visual verification. Numeric URLs
 * and missing descriptions are unknown and retain the provider's search ranking. */
function matchesMetadata(item: Record<string, unknown>, keyword: string): boolean {
  let description = typeof item.alt === "string" ? item.alt : "";
  if (!description) {
    const page = trustedUrl(item.url, "www.pexels.com");
    if (page) description = new URL(page).pathname.replace(/^\/(?:video|photo)\//, "");
  }
  const words = (value: string) => normalizeKeyword(value).toLowerCase().split(/[\s-]+/)
    .filter(word => /\p{L}/u.test(word) && !["a", "an", "the", "of", "in", "on", "with", "and", "video", "photo", "free", "footage"].includes(word));
  const labels = words(description);
  const requested = words(keyword);
  return labels.length === 0 || requested.length === 0 || requested.some(word => labels.includes(word));
}

/** Video queries precede photos. All work shares one deadline, including body
 * parsing, even if a custom fetch implementation ignores its abort signal. */
export async function findStockFootage(subject: string, orientation: VideoOrientation, signal: AbortSignal, fallbackSubject?: string): Promise<StockMedia | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  const keyword = normalizeKeyword(subject);
  if (!apiKey || !keyword || signal.aborted) return null;
  const keywords = [keyword];
  const fallback = normalizeKeyword(fallbackSubject ?? "");
  if (fallback && fallback.toLowerCase() !== keyword.toLowerCase()) keywords.push(fallback);
  const controller = new AbortController();
  let finish!: (value: null) => void;
  const stopped = new Promise<null>(resolve => { finish = resolve; });
  const abort = () => { controller.abort(); finish(null); };
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, LOOKUP_TIMEOUT_MS);
  const active = controller.signal;
  const lookup = async (): Promise<StockMedia | null> => {
    for (const query of keywords) {
      const params = new URLSearchParams({ query, orientation, per_page: "3", page: "1" });
      const videos = record(await search(`${VIDEO_SEARCH}?${params}`, apiKey, active));
      if (active.aborted) return null;
      for (const value of entries(videos.videos)) {
        const video = record(value);
        if (!matchesMetadata(video, query)) continue;
        const url = pickVideoFile(video.video_files, orientation);
        if (!url) continue;
        const posterUrl = trustedUrl(video.image, "images.pexels.com");
        return { url, type: "video", ...(posterUrl ? { posterUrl } : {}) };
      }
    }
    for (const query of keywords) {
      const params = new URLSearchParams({ query, orientation, per_page: "3", page: "1" });
      const photos = record(await search(`${PHOTO_SEARCH}?${params}`, apiKey, active));
      if (active.aborted) return null;
      for (const value of entries(photos.photos)) {
        const photo = record(value);
        if (!matchesMetadata(photo, query)) continue;
        const source = record(photo.src);
        for (const candidate of [source.large2x, source.large]) {
          const url = trustedUrl(candidate, "images.pexels.com");
          if (url) return { url, type: "image" };
        }
      }
    }
    return null;
  };
  try {
    return await Promise.race([lookup(), stopped]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
