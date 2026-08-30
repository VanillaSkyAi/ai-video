import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createSceneDirectorHandler } from "../../../lib/scene-director";

export const runtime = "nodejs";
export const maxDuration = 90;

const model = openai(process.env.OPENAI_PLANNER_MODEL?.trim() || "gpt-5.4-mini");

const handle = createSceneDirectorHandler({
  authorize: (request) => {
    if (process.env.VANILLASKY_LOCAL_DEMO !== "1") return false;
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  },
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
});

export const POST = handle;
export const OPTIONS = handle;
