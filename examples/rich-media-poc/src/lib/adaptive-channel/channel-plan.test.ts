import { describe, expect, it } from "vitest";
import { appendBoundedSegment, planChannelSegment } from "./channel-plan";
import type { ChannelSegment } from "./types";

describe("rolling channel plan", () => {
  it("adds the trailer only to the first finite segment", () => {
    const first = planChannelSegment({
      premise: "A radio operator receives tomorrow's weather from space.",
      sceneCount: 3,
      sequence: 0,
    });
    const next = planChannelSegment({
      premise: first.world.premise,
      sceneCount: 3,
      sequence: 1,
      world: first.world,
      previousSummary: first.summary,
      recentBeatIds: first.recentBeatIds,
      openThreads: first.openThreads,
    });

    expect(first.scenes[0]?.manualRoute).toBe("gradient");
    expect(first.scenes).toHaveLength(3);
    expect(next.scenes).toHaveLength(3);
    expect(next.scenes.every((scene) => scene.manualRoute !== "gradient")).toBe(true);
    expect(next.summary).not.toBe(first.summary);
    const firstStoryBeats = first.scenes.flatMap((scene) => scene.beatId ? [scene.beatId] : []);
    const nextStoryBeats = next.scenes.flatMap((scene) => scene.beatId ? [scene.beatId] : []);
    expect(nextStoryBeats.filter((beat) => firstStoryBeats.includes(beat))).toEqual([]);
    expect(next.openThreads.length).toBeGreaterThan(0);
  });

  it("keeps only the current and prefetched segment in memory", () => {
    const segment = (sequence: number) => ({ id: `segment-${sequence}`, sequence }) as ChannelSegment;
    const queue = [0, 1, 2].reduce(
      (current, sequence) => appendBoundedSegment(current, segment(sequence)),
      [] as ChannelSegment[],
    );

    expect(queue.map(({ sequence }) => sequence)).toEqual([1, 2]);
  });
});
