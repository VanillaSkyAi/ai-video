import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { createVideoHandler } from "@vanillaskyai/video/server";

const modelId = process.env.ANTHROPIC_MODEL;
if (!modelId) throw new Error("Set ANTHROPIC_MODEL in the server environment");
const model = anthropic(modelId);

const handle = createVideoHandler({
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
