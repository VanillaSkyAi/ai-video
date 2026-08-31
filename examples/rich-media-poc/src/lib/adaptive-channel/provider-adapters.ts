import { createFal } from "@ai-sdk/fal";
import {
  createDownload,
  experimental_generateVideo,
  generateImage,
} from "ai";
import type {
  MediaAdapter,
  ResolvedMedia,
} from "./types";

interface AiSdkGeneratedFile {
  readonly uint8Array: Uint8Array;
  readonly mediaType: string;
}

interface AiSdkImageGenerateOptions {
  model: unknown;
  prompt: string | { text: string; images: string[] };
  aspectRatio: `${number}:${number}`;
  n: number;
  maxRetries: number;
  abortSignal?: AbortSignal;
  providerOptions: Record<string, Record<string, unknown>>;
}

interface AiSdkVideoGenerateOptions {
  model: unknown;
  prompt: string | { text: string; image: string };
  aspectRatio: `${number}:${number}` | "adaptive";
  duration: number;
  generateAudio: boolean;
  maxRetries: number;
  abortSignal?: AbortSignal;
  providerOptions: Record<string, Record<string, unknown>>;
}

export type StoreGeneratedMedia = (input: {
  data: Uint8Array;
  mediaType: string;
  kind: "image" | "video";
  idempotencyKey: string;
}) => Promise<{ url: string }>;

interface AiSdkImageAdapterOptions {
  generate(options: AiSdkImageGenerateOptions): Promise<{ image: AiSdkGeneratedFile }>;
  model: unknown;
  referenceModel?: unknown;
  providerLabel: string;
  store: StoreGeneratedMedia;
}

interface AiSdkVideoAdapterOptions {
  generate(options: AiSdkVideoGenerateOptions): Promise<{ video: AiSdkGeneratedFile }>;
  model: unknown;
  referenceModel?: unknown;
  providerLabel: string;
  store: StoreGeneratedMedia;
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function continuityReference(request: Parameters<MediaAdapter["resolve"]>[0]): string | undefined {
  if (request.scene.continuityRole === "character") return request.characterReferenceImageUrl;
  if (request.scene.continuityRole === "scene") return request.previousKeyframeImageUrl;
  return undefined;
}

function modelLabel(model: unknown): string {
  if (typeof model === "string") return model;
  const modelId = (model as { modelId?: unknown } | null)?.modelId;
  return typeof modelId === "string" && modelId ? modelId : "configured-model";
}

export function createAiSdkImageAdapter(options: AiSdkImageAdapterOptions): MediaAdapter {
  return {
    route: "generate-image",
    async resolve(request) {
      const startedAt = now();
      const referenceImageUrl = continuityReference(request);
      const model = referenceImageUrl && options.referenceModel
        ? options.referenceModel
        : options.model;
      const result = await options.generate({
        model,
        prompt: referenceImageUrl
          ? { text: request.prompt, images: [referenceImageUrl] }
          : request.prompt,
        aspectRatio: request.orientation === "portrait" ? "9:16" : "16:9",
        n: 1,
        // Paid media calls are never retried invisibly. The orchestration layer
        // owns an explicit retry decision and its associated budget.
        maxRetries: 0,
        abortSignal: request.signal,
        providerOptions: {
          fal: {
            enableSafetyChecker: true,
            outputFormat: "jpeg",
          },
        },
      });
      const stored = await options.store({
        data: result.image.uint8Array,
        mediaType: result.image.mediaType,
        kind: "image",
        idempotencyKey: request.scene.id,
      });
      return {
        type: "image",
        url: stored.url,
        provider: `${options.providerLabel} · ${modelLabel(model)}`,
        generationTiming: { requestMs: Math.max(0, now() - startedAt) },
        keyframeImageUrl: stored.url,
        ...(request.scene.continuityRole === "character"
          ? { characterReferenceImageUrl: stored.url }
          : {}),
      };
    },
  };
}

export function createAiSdkVideoAdapter(options: AiSdkVideoAdapterOptions): MediaAdapter {
  return {
    route: "generate-video",
    async resolve(request) {
      const startedAt = now();
      const startFrameImageUrl = continuityReference(request);
      const model = startFrameImageUrl && options.referenceModel
        ? options.referenceModel
        : options.model;
      const result = await options.generate({
        model,
        prompt: startFrameImageUrl
          ? { text: request.prompt, image: startFrameImageUrl }
          : request.prompt,
        aspectRatio: startFrameImageUrl
          ? "adaptive"
          : request.orientation === "portrait" ? "9:16" : "16:9",
        duration: Math.max(1, Math.min(10, Math.round(request.scene.durationSec))),
        generateAudio: true,
        // A retry can create a second billable video. Keep it an explicit,
        // budget-aware orchestration decision instead of an SDK default.
        maxRetries: 0,
        abortSignal: request.signal,
        providerOptions: {
          fal: {
            enable_safety_checker: true,
            prompt_expansion_mode: "balanced",
            resolution: "768P",
          },
        },
      });
      const stored = await options.store({
        data: result.video.uint8Array,
        mediaType: result.video.mediaType,
        kind: "video",
        idempotencyKey: request.scene.id,
      });
      return {
        type: "video",
        url: stored.url,
        posterUrl: startFrameImageUrl,
        provider: `${options.providerLabel} · ${modelLabel(model)}`,
        generationTiming: { requestMs: Math.max(0, now() - startedAt) },
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
      const startedAt = now();
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
          generationTiming: { requestMs: Math.max(0, now() - startedAt) },
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
        generationTiming: { requestMs: Math.max(0, now() - startedAt) },
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
        ? { type: "image", url: "/ai-scene.webp", provider: "fixture-stock", generationTiming: { requestMs: 0 } }
        : {
            type: "video",
            url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            posterUrl: "/ai-scene.webp",
            provider: "fixture-stock",
            generationTiming: { requestMs: 0 },
          },
    },
    {
      route: "generate-image",
      resolve: async (request) => ({
        type: "image",
        url: "/ai-scene.webp",
        provider: "fixture-image",
        generationTiming: { requestMs: 0 },
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
        generationTiming: { requestMs: 0 },
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
  store: StoreGeneratedMedia;
}): MediaAdapter[] {
  const fal = createFal({ apiKey: options.apiKey });
  const imageModel = fal.image(options.imageModel || "fal-ai/flux/schnell");
  const imageReferenceModel = fal.image(options.imageReferenceModel || "fal-ai/flux-kontext/dev");
  const videoModel = fal.video(options.videoModel || "minimax/h3-max/text-to-video");
  const videoReferenceModel = fal.video(options.videoReferenceModel || "minimax/h3-max/image-to-video");
  const downloadVideo = createDownload({ maxBytes: 100 * 1024 * 1024 });
  return [
    createAiSdkImageAdapter({
      generate: (request) => generateImage(
        request as Parameters<typeof generateImage>[0],
      ),
      model: imageModel,
      referenceModel: imageReferenceModel,
      providerLabel: "fal",
      store: options.store,
    }),
    createAiSdkVideoAdapter({
      generate: (request) => experimental_generateVideo({
        ...request as Parameters<typeof experimental_generateVideo>[0],
        download: downloadVideo,
      }),
      model: videoModel,
      referenceModel: videoReferenceModel,
      providerLabel: "fal",
      store: options.store,
    }),
  ];
}
