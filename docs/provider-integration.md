[← Documentation home](../README.md) · [Previous: Getting started](getting-started.md) · [Next: Customization →](customization.md)

# Provider integration

Start from the generated chat so provider work stays confined to the
application-owned server:

```bash
npx @vanillaskyai/video init
npx vanillasky doctor
npm run dev
```

The generated `server.ts` is the canonical provider example. It starts with one
text key, packaged templates, and browser voice. Adding the optional generated
speech, stock, transcription, or generated-video key enables its callback and
advertises the capability automatically; `src/main.tsx` does not change.

For the full chat experience, mount one `createVideoChatHandler` and keep every
provider choice in its callbacks:

```ts
import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import { createVideoChatHandler } from "@vanillaskyai/video/server";

export const handler = createVideoChatHandler({
  authorize: verifySession,
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model: anthropic(process.env.TEXT_MODEL ?? "claude-sonnet-5"),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
  generateText: async ({ systemPrompt, userPrompt, maxOutputTokens, signal }) => {
    const result = await generateText({
      model: anthropic(process.env.TEXT_MODEL ?? "claude-sonnet-5"),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens,
      abortSignal: signal,
    });
    return result.text;
  },
});
```

That one text provider gives the browser templated video responses and local
browser speech. Supplying `generateSpeech`, `transcribe`, `searchMedia`, or
`generateVideo` enables those capabilities automatically. The callbacks are
structural and provider-neutral; their SDKs and credentials remain application
dependencies and never enter the browser bundle.

The planner emits a 6-9 word hook first, then continues into the scenes in the
same stream. The stock lookup is a separate cancellable request, so it cannot
delay speech or planning. A welcome card can carry a prewritten `opening`, which
starts immediately with its already-loaded media. For a full AI response, the
same first streamed object reserves the exact first body scene. Its clip starts
generating while the planner continues with scenes two through five. Template
responses stream their first resolved scene without waiting for the rest of the
plan, and normal narration is written in that same planner call rather than
through a second model round trip.

The matching complete React interface is one component and one scoped style
import:

```tsx
import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";

export function App() {
  return <VideoChat />;
}
```

## Custom interface

For a custom interface, use `useVideoChat` and render its `turns`, `welcome`,
`suggestions`, `caption`, and `status`; the hook owns their network and playback
lifecycle. Pass a selected card through
`chat.ask(card.prompt, { opening: card.opening, openingMedia: card.media })` to
start its hook and reuse its footage immediately. For typed prompts, the hook
and media keyword arrive through the response stream automatically.

Any AI SDK `LanguageModel` works in both `streamText` and `generateText`. Keep
selection in one server-only module when an application supports several text
providers. The chat route and React component stay unchanged; only the model
passed to those callbacks changes. The AI SDK result can be returned directly:
its text stream, finish reason, usage, warnings, and response metadata match the
structural callback contract. See the
[provider adapter reference](reference/provider-adapters.md) for native provider
alternatives.

## Planning effort and reasoning modes

Planning is a structured emit against a trusted catalog, not a reasoning task.
Where a provider exposes a reasoning or effort control, a host that wants a
video to start quickly should turn extended reasoning off and keep effort low
to moderate. The default matters: several current models reason by default, and
that reasoning happens before the first plan part is emitted, so it is added
directly to time to first generated scene.

With the Vercel AI SDK and a current Anthropic model, that is one option object:

```ts
streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
  model,
  system: systemPrompt,
  prompt: userPrompt,
  abortSignal: signal,
  providerOptions: {
    anthropic: { thinking: { type: "disabled" }, effort: "medium" },
  },
}),
```

Measured on one grounded chat answer with the 28 built-in templates, leaving
the Anthropic default in place cost roughly twenty seconds before the first
scene; disabling reasoning brought the same plan to a few seconds. Other
providers expose equivalent controls under their own names. Treat the exact
values as host-owned tuning: the lowest effort setting is the fastest, but a
weaker plan misses schema limits more often, which shows up as rejected scenes
in `onComplete`. Compare `timeToFirstSceneMs` and `rejectedSceneCount` across
settings before fixing one.

VanillaSky never sets these controls. Provider selection, sampling parameters,
and credentials stay with the application.

## Completion and usage

Use `onComplete` for server-side cost and completion measurement:

```ts
createVideoChatHandler({
  authorize: verifySession,
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
  generateText: runSmallTextTask,
  onWarning: (warning) => logSafeWarning(warning.code, warning.category),
  onComplete: (summary) => recordGeneration({
    finishReason: summary.finishReason,
    usage: summary.usage,
    requestedModelId: summary.requestedModelId,
    resolvedModelId: summary.resolvedModelId,
    totalDurationMs: summary.totalDurationMs,
  }),
  onError: (error) => recordPrivateFailure(error),
});
```

`onComplete` fires once only after `response.complete`. It does not fire for a
terminal error, abort, disconnect, or timeout. Callback failures are isolated
from the event stream. Normalized token usage and model IDs remain server-only;
they never enter SSE or the persisted `Video`. Set `includeRawProviderData:
true` only when the host deliberately needs bounded provider-native usage and
metadata and has an appropriate retention policy.

`acceptedSceneCount`, `rejectedSceneCount`, and `timeToFirstSceneMs` describe
model-generated scene additions; the streamed opening hook is not counted.
Their sum is the proposed scene count. `videoDurationSec` is the duration
actually committed. These fields provide a server-side quality signal without
exposing model metadata in the browser.
Warnings include the same bounded typed warnings emitted to the client.
`plan_incomplete` identifies a playable partial response whose planner reported
a length limit; applications should show that result as incomplete and may
offer a bounded retry with a larger output or duration budget.
`plan_missing_closer` identifies a playable answer that ended without its
explicit final scene. For non-interactive evaluation, define an application
threshold and retry a bounded number of times. Keep the best accepted result
rather than treating `finishReason: "stop"` alone as a quality score.

The generated system prompt includes the selected trusted-template catalog and
is intentionally substantial. It is stable for the same SDK version, template
kit, media policy, and base prompt. Record input-token usage, keep the selected
kit no broader than the product needs, and enable provider-side prompt caching
where the chosen provider/model supports it. VanillaSky does not assume one
provider's cache controls in its provider-neutral adapter. With the 28 built-in
templates, the current catalog prompt is roughly 28,000 characters (about
7,000 tokens before user input; tokenizer-dependent); provider-reported usage
is the authoritative measurement.

Provider finish reasons `error` and `tool-calls` are terminal failures.
`length` and `content-filter` may complete with already accepted scenes; a
truncation before the first generated scene fails instead of returning an empty
success. The request signal is forwarded to the provider. Configure route and
provider timeouts with that signal, and keep retries host-owned and within the
same explicit request budget.

## Product-level planner guidance

`createVideoChatHandler` constructs the planner prompt from the trusted template
registry. Normal integrations do not build prompts or capabilities. Use the
handler's `instructions` option for durable product-level direction such as a
character, audience, domain, or answer style. The current user prompt and
bounded prior turns are supplied separately by the SDK.
