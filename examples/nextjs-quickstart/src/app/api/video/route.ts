import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { createVideoHandler } from "@vanillaskyai/video/server";

// Resolved per request so the app still builds with the shipped placeholder.
function resolveModel() {
  const modelId = process.env.ANTHROPIC_MODEL;
  if (!modelId || modelId === "replace-with-current-sonnet-model") {
    throw new Error(
      "Set ANTHROPIC_MODEL in .env.local to a current Claude Sonnet model ID available to your " +
        "account. The shipped value is a placeholder: VanillaSky never selects a provider or " +
        "model for you.",
    );
  }
  return anthropic(modelId);
}

const handle = createVideoHandler({
  authorize: (request) => {
    if (process.env.VANILLASKY_LOCAL_DEMO !== "1") return false;
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  },
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model: resolveModel(),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
});

export const POST = handle;
export const OPTIONS = handle;
