import type { Video } from "@vanillaskyai/video";
import type { Theme } from "./themes";
import type { VisualMode } from "./modes";

/**
 * Compose a whole lesson before any of it is shown.
 *
 * The planner sees the entire question at once, so it can choose the template
 * that fits each beat rather than repeating one shape. The narration is written
 * afterwards from the scenes it chose - never from the question - so the words
 * describe what is actually on screen. Both exist before playback starts, which
 * is what lets the voice and the picture begin together.
 */
export interface Lesson {
  video: Video;
  followups: string[];
}

/**
 * A question is short input, and the planner reads short input as sparse
 * material - so without being told, it answers a whole question in one or two
 * scenes. The material here is the answer, not the question, and the shape of a
 * good answer is worth stating outright.
 */
const PLANNER_INSTRUCTIONS = [
  "The input is a question from a learner. Answer it as a short explainer video.",
  "The material is the answer, not the question: a one-line question still deserves a full explanation.",
  "Use four or five scenes. Open on what the question is really asking, spend two or three scenes on the mechanism, and close on the point that makes it stick.",
  "Choose the template that fits each beat honestly - a figure belongs in a number scene, an ordered process in steps, something physical worth watching in a filmed beat - rather than repeating one shape.",
  "Never invent statistics. Never mention the video, the scenes, or yourself.",
].join("\n");

async function readPlan(response: Response, onScene?: (count: number) => void): Promise<Video> {
  const scenes: Video["scenes"] = [];
  let style: Video["style"] | undefined;
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
      const event = JSON.parse(line.slice(6)) as { type?: string; data?: Record<string, unknown> };
      if (event.type === "response.start") style = event.data?.style as Video["style"];
      if (event.type === "scene.add" && event.data?.scene) {
        scenes.push(event.data.scene as Video["scenes"][number]);
        // Scenes arrive one at a time over a slow minute. Saying how many have
        // landed is the difference between waiting and wondering.
        onScene?.(scenes.length);
      }
    }
    if (done) break;
  }
  if (scenes.length === 0) throw new Error("The planner returned no scenes");
  return { schemaVersion: "0.1", orientation: "landscape", scenes, style: style! };
}

export async function planLesson(
  question: string,
  theme: Theme,
  mode: VisualMode,
  options: { signal?: AbortSignal; onScene?: (count: number) => void } = {},
): Promise<Lesson> {
  const response = await fetch(`/api/lesson?filmed=${mode.filmedScenes}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      protocolVersion: "0.5",
      requestId: `tutor-${Date.now()}`,
      // The templates this page can actually render. Without it the planner
      // reaches for names it knows from elsewhere, and a scene arrives that
      // there is no component for.
      capabilities: { templates: ["point", "steps", "figure", "media"] },
      input: {
        input: question,
        instructions: PLANNER_INSTRUCTIONS,
        opening: false,
        orientation: "landscape",
        maxDurationSec: 40,
        brand: theme.brand,
        style: {
          density: "airy",
          motion: "calm",
          textArchetype: "cinematic",
          // The look the footage is filmed in travels with the brand the
          // captions are drawn with, so the two cannot disagree.
          generatedLook: theme.generatedLook,
        },
      },
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error((await response.text()).slice(0, 300) || `Planning failed (${response.status})`);
  }

  const video = await readPlan(response, options.onScene);
  const narrated = await fetch("/api/narration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({ question, scenes: video.scenes }),
  })
    .then(async (result) => (result.ok ? result.json() : { lines: [], followups: [] }))
    // A lesson with no narration is still a lesson; one that never plays
    // because its narration failed is not.
    .catch(() => ({ lines: [], followups: [] }));

  const lines = (narrated.lines ?? []) as string[];
  return {
    video: {
      ...video,
      // The line said over a scene belongs to that scene, so it travels with it
      // from here on: through pacing, playback, storage and replay.
      scenes: video.scenes.map((scene, index) => (lines[index] ? { ...scene, narration: lines[index] } : scene)),
    },
    followups: (narrated.followups ?? []) as string[],
  };
}
