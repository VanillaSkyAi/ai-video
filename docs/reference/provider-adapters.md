# Secure LLM provider adapters

This page covers the planner boundary. For Pexels and other visual providers,
read [Media and voice](../media-and-audio.md).

VanillaSky deliberately does not depend on a model provider or AI framework.
Your server owns the model and credentials; `createVideoChatHandler` accepts
`streamText` and `generateText` callbacks. The recommended adapter is the [AI SDK](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text),
which gives the application one `LanguageModel` interface across official,
community, AI Gateway, OpenAI-compatible, and custom providers.

## Recommended: AI SDK

Install the AI SDK plus the provider package your application chooses:

```bash
npm install ai @ai-sdk/anthropic
```

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { createVideoChatHandler } from "@vanillaskyai/video/server";

const modelId = process.env.ANTHROPIC_MODEL;
if (!modelId) throw new Error("Set ANTHROPIC_MODEL in the server environment");

export const POST = createVideoChatHandler({
  authorize: verifySession,
  generateText: async ({ systemPrompt, userPrompt, signal }) => {
    const result = await generateText({
      model: anthropic(modelId),
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: signal,
    });
    return result.text;
  },
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model: anthropic(modelId),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
});
```

Return the AI SDK `StreamTextResult` directly. It is structurally compatible
with VanillaSky's callback: VanillaSky reads `textStream`, finish metadata,
usage, safe provider warnings, provider metadata, and response/final-step model
metadata. Usage and model IDs are available only through the server-side
`onComplete` summary. Provider-native usage and metadata require the explicit
bounded `includeRawProviderData` opt-in and never enter SSE. The forwarded abort
signal cancels provider work when the request disconnects or the host timeout
fires.

Only the model expression changes:

- Use any [official AI SDK provider](https://ai-sdk.dev/providers/ai-sdk-providers).
- Use an [AI Gateway model ID](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway).
- Use an [OpenAI-compatible provider](https://ai-sdk.dev/providers/openai-compatible-providers).
- Use a [community or custom provider](https://ai-sdk.dev/providers/community-providers)
  implementing the Language Model Specification.

The callback runs for every video request, so the application may select a
different model each time. A product can route routine planning to a cheap,
fast model and reserve a stronger model for difficult inputs without changing
VanillaSky or its protocol. The same boundary also accepts a self-hosted model
or a provider-native async text stream when it is not represented in the AI
SDK. VanillaSky has no model allowlist.

The provider must emit NDJSON text: one complete VanillaSky plan part per line.
The SDK buffers arbitrary text chunks until a newline, parses the completed
object, validates it, and only then forwards it to the motion runtime. Do not
replace that per-line validator with whole-response structured output: motion
streaming intentionally renders the first scene before the full composition is
complete.

## Native or self-hosted providers

The same chat contract supports a native provider without an AI SDK dependency.
Return an `AsyncIterable<string>` from `streamText`, or an object with
`textStream` and optional completion metadata. Implement `generateText` for the
small welcome, suggestion, and fallback narration tasks and return its text.
Infer each callback from `VideoChatHandlerOptions` so the adapter stays aligned
with the public contract.

Forward the supplied signal, preserve both prompt strings, and keep provider
errors and credentials on the server. Retry only within an explicit time and
spend budget before output is visible. The chat does not expose a durable
stream-reconnect contract.

## Application retrieval

Fetch or search approved context in the application before asking the chat.
Include only authorized facts in the prompt or conversation and record
provenance separately. Keep retrieval tools and private URLs server-side.
