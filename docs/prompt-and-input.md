[← Documentation home](../README.md) · [Next: Generate your first video →](getting-started.md)

# Prompt and conversation input

VanillaSky turns the same things people ask an AI chat into spoken video
answers. The SDK owns the video-planning prompt and conversation formatting;
the application owns the model, product guidance, authentication, and data.

## What the viewer sends

`<VideoChat />` and `useVideoChat` send the current prompt plus a bounded set of
earlier turns to one `/api/video-chat` endpoint. Prompts can ask for an
explanation, story, recommendation, ad, recap, or any other general-purpose AI
response. Do not put provider keys, private policy, or unrelated personal data
in the conversation.

When using the custom hook, ask in plain language:

```ts
await chat.ask("Pitch a playful ad for a coffee mug that never spills");
```

A selected welcome or follow-up card can also include a prepared opening line
and already-loaded media:

```ts
await chat.ask(card.prompt, {
  opening: card.opening,
  openingMedia: card.media,
});
```

That path starts immediately. A typed prompt instead receives its short spoken
hook and media keyword from the beginning of the planner stream.

## Application guidance

Use the server handler's `instructions` option for durable product direction:

```ts
createVideoChatHandler({
  authorize: verifySession,
  streamText: planWithYourModel,
  generateText: runSmallTextTask,
  instructions: [
    "Speak like a warm, concise creative partner.",
    "Prefer concrete examples over abstract explanations.",
  ].join(" "),
});
```

This can define a character, audience, subject area, tone, or answer style. It
does not change the protocol, authorize media, or weaken validation. Keep the
viewer prompt separate from these trusted server-side instructions.

## What reaches the model

`createVideoChatHandler` builds the trusted template catalog, video rules,
conversation context, and application guidance. Your provider adapter receives
two complete strings:

```ts
streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
  model,
  system: systemPrompt,
  prompt: userPrompt,
  abortSignal: signal,
});
```

Pass both strings unchanged. The system prompt describes the installed
templates, schema limits, pacing, narration, opening contract, and safe media
fields. The user prompt contains the current request, bounded prior turns,
orientation, visual mode, and whether an opening was already spoken.

Provider credentials and raw media URLs never belong in either prompt. Media
callbacks restore approved URLs on the server only after the model's structured
output has been parsed.

## One stream, one answer

The planner first emits a 6–9 word spoken hook and a media keyword, then keeps
streaming complete scenes. It is not a separate hook call followed by a second
planning call. This keeps the opening consistent with the scenes that follow
and lets the first playable scene arrive without waiting for the complete plan.

Every `scene.add` is validated before the browser receives it. The model never
returns React, HTML, CSS, or executable JavaScript. Accepted scenes are
immutable; invalid scenes are reported through safe warnings and omitted.

In template mode, the planner can choose any trusted template and request stock
media through `searchMedia`. In full mode, it plans a complete generated-video
answer and `generateVideo` resolves every visual beat. There is no mixed
"generate a few clips" mode.

## Grounding

General chat permits stable model knowledge, but it still forbids invented
citations, quotations, URLs, personal details, live facts, and guarantees. If
exact numbers, names, dates, or wording matter, include them in the prompt or
conversation. Use retrieval in the application before calling VanillaSky when
the answer depends on private or current data.

## Debugging weak answers

Check these boundaries in order:

1. Does the prompt contain the exact facts the answer needs?
2. Is `instructions` concise product guidance rather than extra source data?
3. Does the provider pass `systemPrompt` and `userPrompt` unchanged?
4. Is extended reasoning delaying the first streamed object?
5. Do `onWarning` and `onComplete` show rejected scenes or a length limit?
6. Does the trusted registry contain a suitable template for the requested answer?

Log request IDs, safe warning codes, provider finish reasons, model IDs, and
token usage. Never log credentials or expose raw provider errors in the video.

[← Documentation home](../README.md) · [Next: Generate your first video →](getting-started.md)
