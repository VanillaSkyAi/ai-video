import {
  adjacentSceneReference,
  advanceMediaContinuity,
  type MediaContinuity,
} from "./media-continuity";
import type {
  PlannedChannelScene,
  PlannedSegment,
  ResolvedChannelScene,
  ScheduledChannelScene,
} from "./types";

interface SceneResolveInput {
  scene: PlannedChannelScene;
  index: number;
  characterReferenceImageUrl?: string;
  previousKeyframeImageUrl?: string;
}

export async function resolveSceneBatch(options: {
  plan: PlannedSegment;
  incomingContinuity: MediaContinuity;
  resolve(input: SceneResolveInput): Promise<ResolvedChannelScene>;
  onSceneReady?(entry: ScheduledChannelScene): void | Promise<void>;
  now?: () => number;
}): Promise<{
  scenes: ResolvedChannelScene[];
  outgoingContinuity: MediaContinuity;
  peakConcurrency: number;
}> {
  const now = options.now || (() => performance.now());
  const queuedAt = now();
  const completed = new Map<number, ScheduledChannelScene>();
  const orderedResults: ResolvedChannelScene[] = [];
  const jobs: Array<Promise<ResolvedChannelScene>> = [];
  let characterReference: Promise<string | undefined> | undefined = options.incomingContinuity.characterReferenceImageUrl
    ? Promise.resolve(options.incomingContinuity.characterReferenceImageUrl)
    : undefined;
  let nextReadyIndex = 0;
  let inFlight = 0;
  let peakConcurrency = 0;
  let emission = Promise.resolve();

  const drainReadyScenes = () => {
    emission = emission.then(async () => {
      while (completed.has(nextReadyIndex)) {
        const entry = completed.get(nextReadyIndex)!;
        completed.delete(nextReadyIndex);
        orderedResults[nextReadyIndex] = entry.result;
        nextReadyIndex += 1;
        await options.onSceneReady?.(entry);
      }
    });
  };

  const start = (
    scene: PlannedChannelScene,
    index: number,
    references: {
      characterReferenceImageUrl?: string;
      previousKeyframeImageUrl?: string;
    },
  ) => {
    const startedAt = now();
    inFlight += 1;
    peakConcurrency = Math.max(peakConcurrency, inFlight);
    return options.resolve({ scene, index, ...references })
      .then((result) => {
        const resolvedAt = now();
        completed.set(index, {
          index,
          result,
          queuedMs: Math.max(0, startedAt - queuedAt),
          generationMs: Math.max(0, resolvedAt - startedAt),
        });
        drainReadyScenes();
        return result;
      })
      .finally(() => {
        inFlight -= 1;
      });
  };

  for (let index = 0; index < options.plan.scenes.length; index += 1) {
    const scene = options.plan.scenes[index]!;
    let job: Promise<ResolvedChannelScene>;
    if (scene.continuityRole === "character") {
      if (characterReference) {
        job = characterReference.then((characterReferenceImageUrl) => start(scene, index, {
          characterReferenceImageUrl,
          previousKeyframeImageUrl: options.incomingContinuity.previousKeyframeImageUrl,
        }));
      } else {
        job = start(scene, index, {
          previousKeyframeImageUrl: options.incomingContinuity.previousKeyframeImageUrl,
        });
        characterReference = job.then(({ media }) => media.characterReferenceImageUrl);
      }
    } else if (scene.continuityRole === "scene") {
      const previousReference = index === 0
        ? Promise.resolve(options.incomingContinuity.previousKeyframeImageUrl)
        : jobs[index - 1]!.then(({ media }) => adjacentSceneReference(media));
      job = previousReference.then((previousKeyframeImageUrl) => start(scene, index, {
        characterReferenceImageUrl: options.incomingContinuity.characterReferenceImageUrl,
        previousKeyframeImageUrl,
      }));
    } else {
      job = start(scene, index, {
        characterReferenceImageUrl: options.incomingContinuity.characterReferenceImageUrl,
        previousKeyframeImageUrl: options.incomingContinuity.previousKeyframeImageUrl,
      });
    }
    jobs.push(job);
  }

  await Promise.all(jobs);
  await emission;
  const outgoingContinuity = orderedResults.reduce(
    (continuity, scene) => advanceMediaContinuity(continuity, scene.media),
    options.incomingContinuity,
  );
  return { scenes: orderedResults, outgoingContinuity, peakConcurrency };
}
