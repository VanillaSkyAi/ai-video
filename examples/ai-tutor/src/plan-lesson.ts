import { resolveVideoBrand, type Video } from "@vanillaskyai/video";
import { storedLessons, storedQuestions } from "./lesson";
import type { Theme } from "./themes";

/**
 * Compose a whole lesson before any of it is shown.
 *
 * The planner sees the entire answer at once, so it can choose from every
 * template and fill each one with real content. The narration is written
 * afterwards from the scenes it chose - never from the question - so the words
 * describe what is actually on screen. Both exist before playback starts, which
 * is what lets the voice and the picture begin together.
 */
export interface Lesson {
  video: Video;
  followups: string[];
  /** True when no route answered and the checked-in lesson is being shown. */
  stored?: boolean;
}

const PLANNER_INSTRUCTIONS = [
  "The input is a question from a learner. Answer it as a short explainer video.",
  "Develop the answer in clear visual beats: open on what the question is really asking, build through the mechanism, and close on the point that makes it stick.",
  "Choose the template that fits each beat honestly - a figure belongs in a number scene, an ordered process in steps - rather than repeating one shape.",
  "Never invent statistics. Never mention the video, the scenes, or yourself.",
].join("\n");

/**
 * The lesson checked in for this question, wearing the chosen look.
 *
 * Only the starter questions have one. Anything else returns nothing, and the
 * page says it cannot plan without a key rather than answering a question it
 * was not asked - which is what a single stored lesson for every question
 * amounts to.
 *
 * The theme has to reach the stored lesson, or the one control on the landing
 * page does nothing until a key is set.
 */
function stored(question: string, theme: Theme): Lesson | undefined {
  const video = storedLessons[question];
  if (!video) return undefined;
  return {
    stored: true,
    followups: storedQuestions.filter((other) => other !== question).slice(0, 3),
    // The brand a video carries is the resolved shape, not the input one, and
    // the SDK resolves it for exactly this reason.
    video: { ...video, style: { ...video.style, brand: resolveVideoBrand(theme.brand) } },
  };
}

/** Raised when there is no key and no stored lesson for the question asked. */
export class NoPlannerError extends Error {
  constructor() {
    super("Set ANTHROPIC_API_KEY and restart to plan a lesson for a question of your own.");
    this.name = "NoPlannerError";
  }
}

async function readPlan(response: Response): Promise<Video> {
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
      if (event.type === "scene.add" && event.data?.scene) scenes.push(event.data.scene as Video["scenes"][number]);
    }
    if (done) break;
  }
  if (scenes.length === 0) throw new Error("The planner returned no scenes");
  return { schemaVersion: "0.1", orientation: "landscape", scenes, style: style! };
}

/**
 * Ask for a lesson, or fall back to the one checked in.
 *
 * With no route configured this example still runs: the stored lesson is
 * exactly what a planner returns, so everything downstream of planning - the
 * pacing, the narration, the voice - behaves identically.
 */
export async function planLesson(question: string, theme: Theme, signal?: AbortSignal): Promise<Lesson> {
  let response: Response;
  try {
    response = await fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        protocolVersion: "0.5",
        requestId: `tutor-${Date.now()}`,
        input: {
          input: question,
          instructions: PLANNER_INSTRUCTIONS,
          opening: false,
          orientation: "landscape",
          maxDurationSec: 40,
          brand: theme.brand,
          style: { density: "airy", motion: "calm", textArchetype: "cinematic", generatedLook: theme.generatedLook },
        },
      }),
    });
  } catch {
    return stored(question, theme) ?? Promise.reject(new NoPlannerError());
  }
  if (!response.ok || !response.body) {
    if (response.status === 404) {
      const fallback = stored(question, theme);
      if (!fallback) throw new NoPlannerError();
      return fallback;
    }
    throw new Error((await response.text()).slice(0, 200) || `Planning failed (${response.status})`);
  }

  const video = await readPlan(response);
  const narrated = await fetch("/api/narration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
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
