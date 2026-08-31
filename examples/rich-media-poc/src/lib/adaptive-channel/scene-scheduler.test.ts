import { describe, expect, it, vi } from "vitest";
import { planChannelSegment } from "./channel-plan";
import { resolveSceneBatch } from "./scene-scheduler";
import type {
  PlannedChannelScene,
  ResolvedChannelScene,
  ResolvedMedia,
} from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function resolved(scene: PlannedChannelScene, media: ResolvedMedia): ResolvedChannelScene {
  return {
    plan: scene,
    decision: { route: media.type === "gradient" ? "gradient" : "generate-image", reason: "test" },
    resolvedRoute: media.type === "gradient" ? "gradient" : "generate-image",
    media,
    fallbacks: [],
  };
}

describe("progressive scene scheduler", () => {
  it("starts independent work in parallel, waits only for declared dependencies, and emits in story order", async () => {
    const plan = planChannelSegment({
      premise: "A radio signal predicts tomorrow.",
      sceneCount: 4,
      sequence: 0,
    });
    const jobs = new Map(plan.scenes.map((scene) => [scene.id, deferred<ResolvedChannelScene>()]));
    const started: string[] = [];
    const emitted: string[] = [];
    const onSceneReady = vi.fn((entry: { result: ResolvedChannelScene }) => {
      emitted.push(entry.result.plan.id);
    });

    const batch = resolveSceneBatch({
      plan,
      incomingContinuity: {},
      resolve: ({ scene }) => {
        started.push(scene.id);
        return jobs.get(scene.id)!.promise;
      },
      onSceneReady,
    });

    await Promise.resolve();
    expect(started).toEqual([plan.scenes[0]!.id, plan.scenes[1]!.id, plan.scenes[3]!.id]);
    expect(started).not.toContain(plan.scenes[2]!.id);

    jobs.get(plan.scenes[3]!.id)!.resolve(resolved(plan.scenes[3]!, {
      type: "image",
      url: "https://media.example/exterior.webp",
      provider: "test",
    }));
    await Promise.resolve();
    expect(emitted).toEqual([]);

    jobs.get(plan.scenes[0]!.id)!.resolve(resolved(plan.scenes[0]!, {
      type: "gradient",
      url: "",
      provider: "test",
    }));
    await vi.waitFor(() => expect(emitted).toEqual([plan.scenes[0]!.id]));

    jobs.get(plan.scenes[1]!.id)!.resolve(resolved(plan.scenes[1]!, {
      type: "image",
      url: "https://media.example/mara.webp",
      characterReferenceImageUrl: "https://media.example/mara.webp",
      keyframeImageUrl: "https://media.example/mara.webp",
      provider: "test",
    }));
    await vi.waitFor(() => expect(started).toContain(plan.scenes[2]!.id));

    jobs.get(plan.scenes[2]!.id)!.resolve(resolved(plan.scenes[2]!, {
      type: "video",
      url: "https://media.example/mara.mp4",
      posterUrl: "https://media.example/mara.webp",
      provider: "test",
    }));
    const result = await batch;

    expect(emitted).toEqual(plan.scenes.map(({ id }) => id));
    expect(result.peakConcurrency).toBe(3);
    expect(result.outgoingContinuity.characterReferenceImageUrl).toBe("https://media.example/mara.webp");
  });

  it("makes scene-continuation work wait for the immediately preceding result", async () => {
    const plan = planChannelSegment({
      premise: "A radio signal predicts tomorrow.",
      sceneCount: 3,
      sequence: 1,
    });
    plan.scenes[1] = { ...plan.scenes[1]!, continuityRole: "scene" };
    const first = deferred<ResolvedChannelScene>();
    const started: Array<{ id: string; previous?: string }> = [];

    const batch = resolveSceneBatch({
      plan,
      incomingContinuity: { previousKeyframeImageUrl: "https://media.example/incoming.webp" },
      resolve: ({ scene, previousKeyframeImageUrl }) => {
        started.push({ id: scene.id, previous: previousKeyframeImageUrl });
        if (scene === plan.scenes[0]) return first.promise;
        return Promise.resolve(resolved(scene, {
          type: "image",
          url: `https://media.example/${scene.id}.webp`,
          keyframeImageUrl: `https://media.example/${scene.id}.webp`,
          provider: "test",
        }));
      },
    });

    await Promise.resolve();
    expect(started.map(({ id }) => id)).not.toContain(plan.scenes[1]!.id);

    first.resolve(resolved(plan.scenes[0]!, {
      type: "image",
      url: "https://media.example/first.webp",
      keyframeImageUrl: "https://media.example/first.webp",
      provider: "test",
    }));
    await batch;

    expect(started.find(({ id }) => id === plan.scenes[1]!.id)?.previous)
      .toBe("https://media.example/first.webp");
  });
});
