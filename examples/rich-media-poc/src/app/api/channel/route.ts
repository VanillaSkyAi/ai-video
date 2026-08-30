import { planChannelSegment } from "../../../lib/adaptive-channel/channel-plan";
import { createDeadlineBudget } from "../../../lib/adaptive-channel/deadline-budget";
import {
  advanceMediaContinuity,
  type MediaContinuity,
} from "../../../lib/adaptive-channel/media-continuity";
import { resolvePlannedScene } from "../../../lib/adaptive-channel/media-router";
import {
  createFalProviderAdapters,
  createFixtureAdapters,
  createPexelsAdapter,
} from "../../../lib/adaptive-channel/provider-adapters";
import { buildChannelSegment } from "../../../lib/adaptive-channel/segment-builder";
import type {
  ChannelContinuation,
  ChannelWorld,
  ManualMediaRoute,
  MediaAdapter,
} from "../../../lib/adaptive-channel/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const OVERRIDES = new Set<ManualMediaRoute>(["auto", "gradient", "stock", "image", "video"]);

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return process.env.VANILLASKY_LOCAL_DEMO === "1"
    && (hostname === "localhost" || hostname === "127.0.0.1");
}

function worldFrom(value: unknown): ChannelWorld | undefined {
  if (!value || typeof value !== "object") return undefined;
  const world = value as Partial<ChannelWorld>;
  if (
    typeof world.premise !== "string"
    || typeof world.visualStyle !== "string"
    || typeof world.setting !== "string"
    || typeof world.characterBible !== "string"
    || !Array.isArray(world.continuityRules)
    || world.continuityRules.some((rule) => typeof rule !== "string")
  ) return undefined;
  return {
    premise: world.premise.slice(0, 800),
    visualStyle: world.visualStyle.slice(0, 500),
    setting: world.setting.slice(0, 500),
    characterBible: world.characterBible.slice(0, 500),
    continuityRules: world.continuityRules.slice(0, 12).map((rule) => rule.slice(0, 240)),
  };
}

function stringList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, limit).map((item) => item.slice(0, 240))
    : [];
}

function safeMediaUrl(value: unknown, allowFixture = false): string | undefined {
  if (typeof value !== "string") return undefined;
  if (allowFixture && value === "/ai-scene.webp") return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString().slice(0, 2_000) : undefined;
  } catch {
    return undefined;
  }
}

function continuationFrom(value: unknown): ChannelContinuation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const continuation = value as Partial<ChannelContinuation>;
  const world = worldFrom(continuation.world);
  if (!world || typeof continuation.sequence !== "number" || typeof continuation.previousSummary !== "string") {
    return undefined;
  }
  return {
    sequence: Math.max(0, Math.min(10_000, Math.round(continuation.sequence))),
    world,
    previousSummary: continuation.previousSummary.slice(0, 1_200),
    recentBeatIds: stringList(continuation.recentBeatIds, 8),
    openThreads: stringList(continuation.openThreads, 4),
    characterReferenceImageUrl: safeMediaUrl(continuation.characterReferenceImageUrl, true),
    previousKeyframeImageUrl: safeMediaUrl(continuation.previousKeyframeImageUrl, true),
  };
}

function adaptersFromEnvironment(): {
  adapters: MediaAdapter[];
  mode: "fixture" | "live" | "live-with-fixture-fallback";
} {
  const fixtures = createFixtureAdapters();
  if (process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA !== "1") return { adapters: fixtures, mode: "fixture" };
  const adapters: MediaAdapter[] = [];
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  if (pexelsKey) adapters.push(createPexelsAdapter({ apiKey: pexelsKey }));
  const falKey = process.env.FAL_KEY?.trim();
  if (falKey) adapters.push(...createFalProviderAdapters({
    apiKey: falKey,
    imageModel: process.env.FAL_IMAGE_MODEL?.trim(),
    imageReferenceModel: process.env.FAL_IMAGE_REFERENCE_MODEL?.trim(),
    videoModel: process.env.FAL_VIDEO_MODEL?.trim(),
    videoReferenceModel: process.env.FAL_VIDEO_REFERENCE_MODEL?.trim(),
  }));
  if (process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK === "1") {
    return { adapters: [...adapters, ...fixtures], mode: "live-with-fixture-fallback" };
  }
  return { adapters, mode: "live" };
}

export async function POST(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    premise?: unknown;
    sceneCount?: unknown;
    continuation?: unknown;
    overrides?: unknown;
    characterReferenceImageUrl?: unknown;
    bufferSeconds?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "Send a JSON channel brief." }, { status: 400 });
  }

  const continuation = continuationFrom(body.continuation);
  const premise = continuation?.world.premise || (typeof body.premise === "string" ? body.premise.trim() : "");
  if (premise.length < 8 || premise.length > 800) {
    return Response.json({ error: "Premise must be between 8 and 800 characters." }, { status: 400 });
  }
  const rawOverrides = body.overrides && typeof body.overrides === "object"
    ? body.overrides as Record<string, unknown>
    : {};
  const overrides = Object.fromEntries(Object.entries(rawOverrides)
    .filter(([, value]) => typeof value === "string" && OVERRIDES.has(value as ManualMediaRoute))
    .map(([index, value]) => [Number(index), value as ManualMediaRoute]));
  const sceneCount = typeof body.sceneCount === "number" ? body.sceneCount : 3;
  const plan = planChannelSegment({
    premise,
    sceneCount,
    sequence: continuation?.sequence || 0,
    world: continuation?.world,
    previousSummary: continuation?.previousSummary,
    recentBeatIds: continuation?.recentBeatIds,
    openThreads: continuation?.openThreads,
    overrides,
  });

  const provider = adaptersFromEnvironment();
  if (provider.adapters.length === 0) {
    return Response.json({ error: "Live media mode requires FAL_KEY and/or PEXELS_API_KEY." }, { status: 503 });
  }
  const resolved = [];
  const initialContinuity: MediaContinuity = {
    characterReferenceImageUrl: continuation?.characterReferenceImageUrl
      || safeMediaUrl(body.characterReferenceImageUrl),
    previousKeyframeImageUrl: continuation?.previousKeyframeImageUrl,
  };
  let continuity = initialContinuity;
  const initialBufferSeconds = continuation
    ? (typeof body.bufferSeconds === "number" && Number.isFinite(body.bufferSeconds)
        ? Math.max(0, Math.min(300, body.bufferSeconds))
        : 0)
    : Number.POSITIVE_INFINITY;
  const remainingBufferSeconds = createDeadlineBudget(initialBufferSeconds);
  const configuredP95 = Number(process.env.FAL_VIDEO_P95_SECONDS);
  const videoP95LatencySec = Number.isFinite(configuredP95) && configuredP95 > 0 ? configuredP95 : 10;
  for (const scene of plan.scenes) {
    const result = await resolvePlannedScene({
      world: plan.world,
      scene,
      bufferSeconds: remainingBufferSeconds(),
      videoP95LatencySec,
      adapters: provider.adapters,
      orientation: "portrait",
      characterReferenceImageUrl: continuity.characterReferenceImageUrl,
      previousKeyframeImageUrl: continuity.previousKeyframeImageUrl,
      signal: request.signal,
    });
    resolved.push(result);
    continuity = advanceMediaContinuity(continuity, result.media);
  }

  return Response.json({
    segment: buildChannelSegment(plan, resolved, initialContinuity),
    mode: provider.mode,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
