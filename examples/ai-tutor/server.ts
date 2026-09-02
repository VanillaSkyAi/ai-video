import { anthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { createVideoHandler } from "@vanillaskyai/video/server";
import type { VideoScene } from "@vanillaskyai/video";

/**
 * The two routes a tutor needs.
 *
 * `/api/lesson` plans the scenes. `/api/narration` writes what is said over
 * them - given the scenes, never the question, because a script written from
 * the question drifts from the composition that was actually chosen.
 *
 * Mounted by the Vite dev server in `vite.config.ts` so this example runs from
 * one command. In production these are ordinary routes on your own server; the
 * only thing that must not move is the key.
 */
const PLANNER_MODEL = process.env.ANTHROPIC_PLANNER_MODEL ?? "claude-sonnet-5";
const NARRATION_MODEL = process.env.ANTHROPIC_NARRATION_MODEL ?? "claude-haiku-4-5";

export const planLesson = createVideoHandler({
  authorize: (request) => new URL(request.url).hostname === "localhost",
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model: anthropic(PLANNER_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
  // Generated media is billed per scene, and the planner chooses how many
  // scenes there are. Set this whenever resolveMedia can spend.
  maxResolvedMedia: 4,
});

const NARRATION_SYSTEM = [
  "You narrate a short explainer video. You are given its scenes in order, as the data that will be on screen.",
  "",
  'Return JSON only: {"lines": string[], "followups": string[]}.',
  "lines has exactly one entry per scene, in the same order.",
  "followups has three short questions the learner would naturally ask next, specific to what you just explained.",
  "",
  "Each line is what a tutor says aloud while that scene is showing. One or two sentences, 12-30 words, plain spoken English.",
  "Say what the scene shows and why it matters. Never read the on-screen text back word for word - the viewer can already see it.",
  "Never mention scenes, videos or slides. The lines are heard in sequence, so they must join into one continuous explanation.",
].join("\n");

export async function narrateLesson(request: Request): Promise<Response> {
  const payload = await request.json() as { question?: string; scenes?: VideoScene[] };
  const scenes = (payload.scenes ?? []).slice(0, 12);
  if (scenes.length === 0) return Response.json({ error: "No scenes to narrate." }, { status: 400 });

  const { text } = await generateText({
    model: anthropic(NARRATION_MODEL),
    system: NARRATION_SYSTEM,
    prompt: [
      `QUESTION: ${payload.question ?? ""}`,
      "",
      "SCENES:",
      ...scenes.map((scene, index) => `${index + 1}. [${scene.templateId}] ${JSON.stringify(scene.variables).slice(0, 400)}`),
    ].join("\n"),
  });

  try {
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
      lines?: unknown; followups?: unknown;
    };
    const strings = (value: unknown, limit: number) => (Array.isArray(value) ? value : [])
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .slice(0, limit);
    return Response.json({ lines: strings(parsed.lines, scenes.length), followups: strings(parsed.followups, 3) });
  } catch {
    // A lesson with no narration is still a lesson.
    return Response.json({ lines: [], followups: [] });
  }
}
