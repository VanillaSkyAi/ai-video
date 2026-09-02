import { anthropic } from "@ai-sdk/anthropic";
import { createFal } from "@ai-sdk/fal";
import { experimental_generateVideo as generateVideo, generateText, streamText } from "ai";
import { createVideoHandler } from "@vanillaskyai/video/server";
import type { VideoScene } from "@vanillaskyai/video";

/**
 * The two routes a tutor needs.
 *
 * `/api/lesson` plans the scenes and resolves any media they ask for.
 * `/api/narration` writes what is said over them - given the scenes, never the
 * question, because a script written from the question drifts from the
 * composition that was actually chosen.
 *
 * Mounted by the Vite dev server in `vite.config.ts`, so this example runs from
 * one command. In production these are ordinary routes on your own server; the
 * only thing that must not move is the key.
 */
const PLANNER_MODEL = process.env.ANTHROPIC_PLANNER_MODEL ?? "claude-sonnet-5";
const NARRATION_MODEL = process.env.ANTHROPIC_NARRATION_MODEL ?? "claude-haiku-4-5";
const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL ?? "minimax/h3-max/text-to-video";

/**
 * Film one beat.
 *
 * The planner asks for a subject; every constraint is the host's. A model that
 * writes its own text into the frame competes with the caption over it, and one
 * that adds a voice talks over the narrator.
 */
async function filmScene(subject: string, generatedLook: string | undefined, signal: AbortSignal) {
  const fal = createFal({ apiKey: process.env.FAL_KEY });
  const result = await generateVideo({
    model: fal.video(VIDEO_MODEL),
    prompt: [
      `Locked-off shot, 16:9. ${subject}.`,
      "One slow continuous camera move. Physically plausible motion.",
      "No on-screen text, captions, subtitles, watermarks or logos.",
      "Diegetic sound only. No music, no voiceover.",
      generatedLook,
    ].filter(Boolean).join("\n\n"),
    duration: 5,
    resolution: "854x480",
    // The clip stays where the provider put it: a scene stores an address, so
    // pulling the bytes through this process would be wasted work.
    download: async () => ({ data: new Uint8Array(), mediaType: "video/mp4" }),
    abortSignal: signal,
  });
  const url = result.providerMetadata?.fal?.videos?.[0]?.url;
  if (typeof url !== "string") throw new Error("the video provider returned no url");
  return url;
}

/**
 * One handler per visual mode.
 *
 * The mode is a ceiling on how many scenes may be filmed, and a ceiling is a
 * handler option rather than request input - a client that could raise its own
 * spending limit would not be a limit.
 */
const handlers = new Map<number, ReturnType<typeof createVideoHandler>>();

function lessonHandler(filmedScenes: number) {
  const existing = handlers.get(filmedScenes);
  if (existing) return existing;

  const handler = createVideoHandler({
    authorize: (request) => new URL(request.url).hostname === "localhost",
    streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
      model: anthropic(PLANNER_MODEL),
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: signal,
    }),
    maxResolvedMedia: filmedScenes,
    // Beats film in parallel: waiting for each in turn would make a five-scene
    // lesson half a minute of nothing.
    mediaConcurrency: 4,
    allowMediaUrl: (url) => new URL(url).hostname.endsWith(".fal.media"),
    resolveMedia: filmedScenes === 0 || !process.env.FAL_KEY
      ? undefined
      : async (query, { generatedLook, signal }) => ({
          url: await filmScene(query, generatedLook, signal),
          type: "video" as const,
        }),
  });
  handlers.set(filmedScenes, handler);
  return handler;
}

export function planLesson(request: Request): Promise<Response> {
  const filmed = Number(new URL(request.url).searchParams.get("filmed") ?? 0);
  return lessonHandler(Number.isFinite(filmed) ? Math.max(0, Math.min(8, filmed)) : 0)(request);
}

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
