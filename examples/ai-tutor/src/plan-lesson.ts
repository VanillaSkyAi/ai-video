import type { Video, VideoScene } from "@vanillaskyai/video";
import type { Theme } from "./themes";
import type { VisualMode } from "./modes";
import { definitions } from "../vanillasky";

const templateIds = definitions.map((template) => template.id);

/**
 * Stream a lesson, narrating each scene as it arrives.
 *
 * Composing the whole answer first is what keeps the words matched to the
 * pictures, but it costs the entire plan before a single frame - thirty to
 * ninety seconds of nothing. The scenes arrive one at a time, so the narration
 * can too: each line is written as its scene lands, and the first scene plays
 * within a few seconds with its own line spoken over it.
 *
 * The narrator is given the lines already written, so the script still joins up
 * into one explanation rather than four unrelated remarks. What it cannot do is
 * set up a payoff it has not seen yet - the price of not waiting.
 */
/**
 * The brief, which depends on how much of the answer is filmed.
 *
 * A planner told only that a media template exists will not reach for it: the
 * cheaper templates always look like a reasonable choice. If the application is
 * willing to pay for footage, it has to ask for footage.
 */
function plannerInstructions(filmedScenes: number): string {
  return [
    "The input is a question from a learner. Answer it as a short explainer video.",
    "The material is the answer, not the question: a one-line question still deserves a full explanation.",
    "Use four or five scenes. Open on what the question is really asking, spend two or three scenes on the mechanism, and close on the point that makes it stick.",
    "Choose the template that fits each beat honestly - a figure belongs in a number scene, an ordered process in steps, a comparison in a chart - rather than repeating one shape.",
    filmedScenes > 0
      ? `Use the media template for ${filmedScenes === 1 ? "the single beat" : `the ${filmedScenes} beats`} most worth watching happen, and give each one a mediaKeyword: a concrete, filmable subject, a real object doing a real thing, never a diagram or an abstraction.`
      : "Do not use the media template: there is no footage available, and it would leave an empty frame.",
    "Never invent statistics. Never mention the video, the scenes, or yourself.",
  ].join("\n");
}

export interface StreamedLesson {
  /** Resolves when the last scene has been planned and narrated. */
  done: Promise<{ video: Video; followups: string[] }>;
}

async function narrateScene(
  question: string,
  scene: VideoScene,
  earlier: string[],
  signal?: AbortSignal,
): Promise<string> {
  const result = await fetch("/api/narration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ question, scene, earlier }),
  });
  if (!result.ok) return "";
  const payload = await result.json() as { line?: string };
  return typeof payload.line === "string" ? payload.line : "";
}

export async function streamLesson(options: {
  question: string;
  theme: Theme;
  mode: VisualMode;
  signal?: AbortSignal;
  /** Called with each scene once its line has been written. */
  onScene: (scene: VideoScene) => void | Promise<void>;
  onStyle: (style: Video["style"]) => void;
}): Promise<{ video: Video; followups: string[] }> {
  const response = await fetch(`/api/lesson?filmed=${options.mode.filmedScenes}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      protocolVersion: "0.5",
      requestId: `tutor-${Date.now()}`,
      // Belt and braces. The handler's registry shapes the planner's prompt but
      // does not reject a scene for a template it does not know - unknown ones
      // are passed through sanitized - so a scene can still arrive that this
      // page has no component for. Naming the templates here closes that.
      capabilities: { templates: templateIds },
      input: {
        input: options.question,
        instructions: plannerInstructions(options.mode.filmedScenes),
        // The opening scene is composed by the runtime, not the model, so it
        // reaches the page in about a second. Without it nothing is on screen
        // until the planner finishes - which is what made this feel broken.
        opening: options.question,
        orientation: "landscape",
        maxDurationSec: 40,
        brand: options.theme.brand,
        style: {
          density: "airy",
          motion: "calm",
          textArchetype: "cinematic",
          generatedLook: options.theme.generatedLook,
        },
      },
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error((await response.text()).slice(0, 300) || `Planning failed (${response.status})`);
  }

  const scenes: VideoScene[] = [];
  const lines: string[] = [];
  let style: Video["style"] | undefined;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const rows = buffer.split("\n");
    buffer = rows.pop() ?? "";
    for (const row of rows) {
      if (!row.startsWith("data: ") || row === "data: [DONE]") continue;
      const event = JSON.parse(row.slice(6)) as { type?: string; data?: Record<string, unknown> };
      if (event.type === "response.start") {
        style = event.data?.style as Video["style"];
        options.onStyle(style);
      }
      if (event.type !== "scene.add" || !event.data?.scene) continue;

      const planned = event.data.scene as VideoScene;
      // Narrating here, rather than after the whole plan, is what makes the
      // first scene playable in seconds instead of a minute.
      const line = await narrateScene(options.question, planned, lines, options.signal);
      if (line) lines.push(line);
      const scene = line ? { ...planned, narration: line } : planned;
      scenes.push(scene);
      await options.onScene(scene);
    }
    if (done) break;
  }
  if (scenes.length === 0) throw new Error("The planner returned no scenes");

  const followups = await fetch("/api/followups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({ question: options.question, lines }),
  })
    .then(async (result) => (result.ok ? (await result.json()).followups ?? [] : []))
    .catch(() => []);

  return {
    video: { schemaVersion: "0.1", orientation: "landscape", scenes, style: style! },
    followups: followups as string[],
  };
}
