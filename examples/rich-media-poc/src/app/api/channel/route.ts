import { planChannelSegment } from "../../../lib/adaptive-channel/channel-plan";
import type { MediaContinuity } from "../../../lib/adaptive-channel/media-continuity";
import { resolvePlannedScene } from "../../../lib/adaptive-channel/media-router";
import { localGeneratedMediaStore } from "../../../lib/adaptive-channel/local-media-store";
import {
  createFalProviderAdapters,
  createFixtureAdapters,
  createPexelsAdapter,
} from "../../../lib/adaptive-channel/provider-adapters";
import { resolveSceneBatch } from "../../../lib/adaptive-channel/scene-scheduler";
import {
  createFalStoryPlanner,
  createFixtureStoryPlanner,
  type StoryPlanner,
} from "../../../lib/adaptive-channel/story-planner";
import {
  buildChannelVideoScene,
  createChannelVideoStyle,
} from "../../../lib/adaptive-channel/segment-builder";
import type {
  MediaAdapter,
  PlannedSegment,
} from "../../../lib/adaptive-channel/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const TARGET_BUFFER_SECONDS = 15;

function createChannelScoreDataUrl(): string {
  const sampleRate = 8_000;
  const durationSeconds = 2;
  const sampleCount = sampleRate * durationSeconds;
  const wav = Buffer.alloc(44 + sampleCount * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(sampleCount * 2, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const pulse = 0.72 + 0.28 * Math.sin(Math.PI * time - Math.PI / 2);
    const drone = Math.sin(2 * Math.PI * 55 * time) * 0.5
      + Math.sin(2 * Math.PI * 82.5 * time) * 0.3
      + Math.sin(2 * Math.PI * 110 * time) * 0.2;
    wav.writeInt16LE(Math.round(drone * pulse * 6_500), 44 + index * 2);
  }
  return `data:audio/wav;base64,${wav.toString("base64")}`;
}

const CHANNEL_SCORE = {
  trackId: "channel-score",
  audioUrl: createChannelScoreDataUrl(),
  sourceDuration: 2,
  duration: 25,
  beatDetection: { sensitivity: 0.5 },
  beatMarkers: [],
  volume: 0.16,
  fadeOutMs: 0,
};

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return process.env.VANILLASKY_LOCAL_DEMO === "1"
    && (hostname === "localhost" || hostname === "127.0.0.1");
}

function adaptersFromEnvironment(): {
  adapters: MediaAdapter[];
  mode: "fixture" | "live" | "live-with-fixture-fallback";
  planStory: StoryPlanner;
} {
  const fixtures = createFixtureAdapters();
  const fixturePlanner = createFixtureStoryPlanner();
  if (process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA !== "1") {
    return { adapters: fixtures, mode: "fixture", planStory: fixturePlanner };
  }
  const adapters: MediaAdapter[] = [];
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  if (pexelsKey) adapters.push(createPexelsAdapter({ apiKey: pexelsKey }));
  const falKey = process.env.FAL_KEY?.trim();
  const planStory = falKey
    ? createFalStoryPlanner({
        apiKey: falKey,
        model: process.env.FAL_STORY_PLANNER_MODEL?.trim(),
      })
    : fixturePlanner;
  if (falKey) adapters.push(...createFalProviderAdapters({
    apiKey: falKey,
    imageModel: process.env.FAL_IMAGE_MODEL?.trim(),
    imageReferenceModel: process.env.FAL_IMAGE_REFERENCE_MODEL?.trim(),
    videoModel: process.env.FAL_VIDEO_MODEL?.trim(),
    videoReferenceModel: process.env.FAL_VIDEO_REFERENCE_MODEL?.trim(),
    store: localGeneratedMediaStore.write,
  }));
  if (process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK === "1") {
    return { adapters: [...adapters, ...fixtures], mode: "live-with-fixture-fallback", planStory };
  }
  return { adapters, mode: "live", planStory };
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!isLocalRequest(request)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    prompt?: unknown;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "Send a JSON channel brief." }, { status: 400 });
  }

  const premise = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (premise.length < 8 || premise.length > 800) {
    return Response.json({ error: "Prompt must be between 8 and 800 characters." }, { status: 400 });
  }
  const sceneCount = 5;
  const provider = adaptersFromEnvironment();
  if (provider.adapters.length === 0) {
    return Response.json({ error: "Live media mode requires FAL_KEY and/or PEXELS_API_KEY." }, { status: 503 });
  }

  const generationController = new AbortController();
  const forwardAbort = () => generationController.abort(request.signal.reason);
  if (request.signal.aborted) forwardAbort();
  else request.signal.addEventListener("abort", forwardAbort, { once: true });
  const maxChapters = 1;
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    start(output) {
      const write = (message: unknown) => {
        if (!cancelled && !generationController.signal.aborted) {
          output.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
        }
      };
      void (async () => {
        const runId = `adaptive-channel-${crypto.randomUUID()}`;
        let eventSequence = 0;
        let scenePosition = 0;
        let emittedDurationSec = 0;
        let playbackStartedAt: number | undefined;
        let chapterCount = 0;
        let nextSequence = 0;
        let nextWorld;
        let previousSummary;
        let recentBeatIds;
        let openThreads;
        let mediaContinuity: MediaContinuity = {};
        const videoEvent = (type: string, data: unknown) => ({
          protocolVersion: "0.5",
          runId,
          sequence: eventSequence++,
          eventId: `${runId}:${eventSequence - 1}`,
          type,
          data,
        });
        const estimatedBufferSeconds = () => playbackStartedAt == null
          ? 0
          : Math.max(0, emittedDurationSec - (Date.now() - playbackStartedAt) / 1_000);
        const configuredP95 = Number(process.env.FAL_VIDEO_P95_SECONDS);
        const videoP95LatencySec = Number.isFinite(configuredP95) && configuredP95 > 0 ? configuredP95 : 10;

        write({ kind: "mode", mode: provider.mode, targetBufferSeconds: TARGET_BUFFER_SECONDS });
        write({
          kind: "video",
          event: videoEvent("response.start", {
            requestId: runId,
            format: { orientation: "portrait" },
            style: createChannelVideoStyle(),
            meta: { name: "VanillaSky adaptive channel", source: "examples/rich-media-poc/channel" },
          }),
        });
        write({
          kind: "video",
          event: videoEvent("audio.set", { audio: CHANNEL_SCORE }),
        });

        while (!generationController.signal.aborted && (maxChapters == null || chapterCount < maxChapters)) {
          while (chapterCount > 0 && estimatedBufferSeconds() > TARGET_BUFFER_SECONDS) {
            write({ kind: "buffer", bufferSeconds: estimatedBufferSeconds(), waiting: true });
            await pause(250, generationController.signal);
          }

          const outline = await provider.planStory({
            premise,
            sceneCount,
            signal: generationController.signal,
          });
          const plan: PlannedSegment = planChannelSegment({
            premise,
            sceneCount,
            sequence: nextSequence,
            world: nextWorld,
            previousSummary,
            recentBeatIds,
            openThreads,
            outline,
          });
          write({ kind: "chapter-start", sequence: plan.sequence, sceneCount: plan.scenes.length });
          const batch = await resolveSceneBatch({
            plan,
            incomingContinuity: mediaContinuity,
            resolve: ({ scene, characterReferenceImageUrl, previousKeyframeImageUrl }) => resolvePlannedScene({
              world: plan.world,
              scene,
              // Bootstrap the first chapter with its intended five video routes;
              // subsequent chapters are governed by the real rolling buffer.
              bufferSeconds: plan.sequence === 0 ? Number.POSITIVE_INFINITY : estimatedBufferSeconds(),
              videoP95LatencySec,
              adapters: provider.adapters,
              orientation: "portrait",
              characterReferenceImageUrl,
              previousKeyframeImageUrl,
              signal: generationController.signal,
            }),
            onSceneReady: (entry) => {
              if (playbackStartedAt == null) playbackStartedAt = Date.now();
              emittedDurationSec += entry.result.plan.durationSec;
              write({
                kind: "scene",
                chapterSequence: plan.sequence,
                entry,
                resolved: entry.result,
                scheduling: {
                  queuedMs: entry.queuedMs,
                  generationMs: entry.generationMs,
                },
                bufferSeconds: estimatedBufferSeconds(),
              });
              write({
                kind: "video",
                event: videoEvent("scene.add", {
                  scene: buildChannelVideoScene(entry.result),
                  position: scenePosition++,
                }),
              });
            },
          });
          mediaContinuity = batch.outgoingContinuity;
          nextSequence = plan.sequence + 1;
          nextWorld = plan.world;
          previousSummary = plan.summary;
          recentBeatIds = plan.recentBeatIds;
          openThreads = plan.openThreads;
          chapterCount += 1;
          write({
            kind: "chapter",
            sequence: plan.sequence,
            peakConcurrency: batch.peakConcurrency,
            bufferSeconds: estimatedBufferSeconds(),
          });
        }

        if (!generationController.signal.aborted && maxChapters != null) {
          write({ kind: "complete", reason: "chapter-limit", chapters: chapterCount });
          write({
            kind: "video",
            event: videoEvent("response.abort", { reason: "Prototype chapter limit reached." }),
          });
        }
      })().catch((error) => {
        if (generationController.signal.aborted) return;
        const message = error instanceof Error ? error.message : "The channel stream failed.";
        write({ kind: "error", error: message });
      }).finally(() => {
        request.signal.removeEventListener("abort", forwardAbort);
        if (!cancelled) output.close();
      });
    },
    cancel(reason) {
      cancelled = true;
      generationController.abort(reason);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
