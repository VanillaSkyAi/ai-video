import { createFalClient } from "@fal-ai/client";
import type {
  MediaAdapter,
  ResolvedMedia,
} from "./types";

export type FalSubscribe = (
  model: string,
  options: { input: Record<string, unknown>; abortSignal?: AbortSignal },
) => Promise<{ data: unknown }>;

interface FalAdapterOptions {
  subscribe: FalSubscribe;
  model?: string;
  referenceModel?: string;
}

function imageUrlFromResult(result: unknown): string {
  const images = (result as { images?: Array<{ url?: unknown }> } | undefined)?.images;
  const url = images?.[0]?.url;
  if (typeof url !== "string" || !url) throw new Error("Image provider returned no image URL.");
  return url;
}

function videoUrlFromResult(result: unknown): string {
  const url = (result as { video?: { url?: unknown } } | undefined)?.video?.url;
  if (typeof url !== "string" || !url) throw new Error("Video provider returned no video URL.");
  return url;
}

function continuityReference(request: Parameters<MediaAdapter["resolve"]>[0]): string | undefined {
  if (request.scene.continuityRole === "character") return request.characterReferenceImageUrl;
  if (request.scene.continuityRole === "scene") return request.previousKeyframeImageUrl;
  return undefined;
}

export function createFalImageAdapter(options: FalAdapterOptions): MediaAdapter {
  return {
    route: "generate-image",
    async resolve(request) {
      const referenceImageUrl = continuityReference(request);
      const model = referenceImageUrl
        ? options.referenceModel || "fal-ai/flux-general"
        : options.model || "fal-ai/flux/dev";
      const input: Record<string, unknown> = {
        prompt: request.prompt,
        image_size: request.orientation === "portrait" ? "portrait_16_9" : "landscape_16_9",
        output_format: "jpeg",
      };
      if (referenceImageUrl) {
        input.reference_image_url = referenceImageUrl;
        input.reference_strength = 0.68;
      } else {
        input.num_images = 1;
        input.enable_safety_checker = true;
      }
      const result = await options.subscribe(model, { input, abortSignal: request.signal });
      const url = imageUrlFromResult(result.data);
      return {
        type: "image",
        url,
        provider: `fal · ${model}`,
        keyframeImageUrl: url,
        ...(request.scene.continuityRole === "character" ? { characterReferenceImageUrl: url } : {}),
      };
    },
  };
}

export function createFalVideoAdapter(options: FalAdapterOptions): MediaAdapter {
  return {
    route: "generate-video",
    async resolve(request) {
      const startFrameImageUrl = continuityReference(request);
      const hasReference = Boolean(startFrameImageUrl);
      const model = hasReference
        ? options.referenceModel || "minimax/h3-max/image-to-video"
        : options.model || "minimax/h3-max/text-to-video";
      const input: Record<string, unknown> = {
        prompt: request.prompt,
        duration: Math.max(1, Math.min(10, Math.round(request.scene.durationSec))),
        resolution: "768P",
        prompt_expansion_mode: "balanced",
        enable_safety_checker: true,
      };
      if (startFrameImageUrl) input.image_url = startFrameImageUrl;
      else input.aspect_ratio = request.orientation === "portrait" ? "9:16" : "16:9";
      const result = await options.subscribe(model, { input, abortSignal: request.signal });
      return {
        type: "video",
        url: videoUrlFromResult(result.data),
        posterUrl: startFrameImageUrl,
        provider: `fal · ${model}`,
      };
    },
  };
}

interface PexelsVideoFile {
  link?: string;
  file_type?: string;
  width?: number;
  height?: number;
}

function chooseVideoFile(files: readonly PexelsVideoFile[], orientation: "portrait" | "landscape"): PexelsVideoFile | undefined {
  const candidates = files.filter((file) => file.file_type === "video/mp4" && typeof file.link === "string");
  const oriented = candidates.filter((file) => orientation === "portrait"
    ? (file.height || 0) >= (file.width || 0)
    : (file.width || 0) >= (file.height || 0));
  return (oriented.length ? oriented : candidates)
    .sort((a, b) => Math.abs((a.width || 0) * (a.height || 0) - 1_500_000)
      - Math.abs((b.width || 0) * (b.height || 0) - 1_500_000))[0];
}

export function createPexelsAdapter(options: {
  apiKey: string;
  fetcher?: typeof fetch;
}): MediaAdapter {
  return {
    route: "stock",
    async resolve(request) {
      if (!options.apiKey.trim()) throw new Error("PEXELS_API_KEY is not configured.");
      const fetcher = options.fetcher || fetch;
      const wantsVideo = request.scene.motion !== "none";
      const endpoint = wantsVideo
        ? "https://api.pexels.com/v1/videos/search"
        : "https://api.pexels.com/v1/search";
      const url = new URL(endpoint);
      url.searchParams.set("query", request.scene.stockQuery);
      url.searchParams.set("orientation", request.orientation);
      url.searchParams.set("per_page", "4");
      const response = await fetcher(url, {
        headers: { Authorization: options.apiKey },
        signal: request.signal,
      });
      if (!response.ok) throw new Error(`Pexels returned ${response.status}.`);
      const data = await response.json() as {
        videos?: Array<{
          url?: string;
          image?: string;
          user?: { name?: string; url?: string };
          video_files?: PexelsVideoFile[];
        }>;
        photos?: Array<{
          url?: string;
          photographer?: string;
          photographer_url?: string;
          src?: { portrait?: string; landscape?: string; large2x?: string };
        }>;
      };

      if (wantsVideo) {
        const item = data.videos?.[0];
        const file = chooseVideoFile(item?.video_files || [], request.orientation);
        if (!item?.url || !file?.link) throw new Error("Pexels found no usable video.");
        return {
          type: "video",
          url: file.link,
          posterUrl: item.image,
          provider: "pexels",
          credit: {
            label: `Video by ${item.user?.name || "a Pexels creator"} on Pexels`,
            url: item.url,
          },
        } satisfies ResolvedMedia;
      }

      const item = data.photos?.[0];
      const imageUrl = request.orientation === "portrait" ? item?.src?.portrait : item?.src?.landscape;
      if (!item?.url || !imageUrl) throw new Error("Pexels found no usable image.");
      return {
        type: "image",
        url: imageUrl || item.src?.large2x || "",
        provider: "pexels",
        credit: {
          label: `Photo by ${item.photographer || "a Pexels creator"} on Pexels`,
          url: item.url,
        },
      } satisfies ResolvedMedia;
    },
  };
}

export function createFixtureAdapters(): MediaAdapter[] {
  return [
    {
      route: "stock",
      resolve: async (request) => request.scene.motion === "none"
        ? { type: "image", url: "/ai-scene.webp", provider: "fixture-stock" }
        : {
            type: "video",
            url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            posterUrl: "/ai-scene.webp",
            provider: "fixture-stock",
          },
    },
    {
      route: "generate-image",
      resolve: async (request) => ({
        type: "image",
        url: "/ai-scene.webp",
        provider: "fixture-image",
        keyframeImageUrl: "/ai-scene.webp",
        ...(request.scene.continuityRole === "character"
          ? { characterReferenceImageUrl: "/ai-scene.webp" }
          : {}),
      }),
    },
    {
      route: "generate-video",
      resolve: async (request) => ({
        type: "video",
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        posterUrl: continuityReference(request) || "/ai-scene.webp",
        provider: "fixture-video",
      }),
    },
  ];
}

export function createFalProviderAdapters(options: {
  apiKey: string;
  imageModel?: string;
  imageReferenceModel?: string;
  videoModel?: string;
  videoReferenceModel?: string;
}): MediaAdapter[] {
  const client = createFalClient({ credentials: options.apiKey });
  const subscribe: FalSubscribe = (model, request) => client.subscribe(
    model as Parameters<typeof client.subscribe>[0],
    request as Parameters<typeof client.subscribe>[1],
  ) as Promise<{ data: unknown }>;
  return [
    createFalImageAdapter({
      subscribe,
      model: options.imageModel,
      referenceModel: options.imageReferenceModel,
    }),
    createFalVideoAdapter({
      subscribe,
      model: options.videoModel,
      referenceModel: options.videoReferenceModel,
    }),
  ];
}
