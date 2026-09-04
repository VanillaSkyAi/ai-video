# Give your AI a video output

**VanillaSky is the open-source video response layer.** Turn text, structured
data, and live application context into personalized video responses that start
playing while your LLM composes them.

> **Status: Beta.** VanillaSky is pre-1.0 and its public API may change as we
> test it in real applications. Pin an exact version before production use.

Your application owns the model, data, authentication, provider keys, and
branding. VanillaSky owns the planning prompt, trusted templates, validation,
streaming, session, player, and an optional complete chat interface.

## See it first

Generate a video in the browser, with no install and no API key, in the
[playground](https://vanillasky.ai/playground/). The
[website](https://vanillasky.ai/) has the overview and full
[documentation](https://vanillasky.ai/docs/).

## Start

For humans:

```bash
npm install @vanillaskyai/video
npx vanillasky init
```

Add `ANTHROPIC_API_KEY` to the generated `.env.local`, then run `npm run dev`.
That one key gives you the complete interface with packaged templates and
browser voice. Run `npx vanillasky doctor` to see which optional upgrades are
enabled.

For coding agents:

```bash
npx skills add VanillaSkyAi/video@vanillasky
```

Then prompt: `Use $vanillasky to turn this application's data into a personalized video response.`

For a complete voice-and-video chat, mount the default interface after adding
the provider-neutral server handler:

```tsx
import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";

export function App() {
  return <VideoChat />;
}
```

The canonical [video-chat starter](https://github.com/VanillaSkyAi/video/tree/main/starters/video-chat)
shows the full server configuration. Use `useVideoChat` instead only when you
want a custom UI.

## Connect your LLM

VanillaSky never chooses a provider or model. Configure that separately on the
server, then connect the model your application already owns. The route below
assumes an AI SDK `LanguageModel` exported as `videoModel`; if you do not have
one yet, choose a provider and current model in [Provider integration](docs/provider-integration.md).

Create one authenticated server route:

```ts
// app/api/video/route.ts
import { streamText } from "ai";
import { createVideoHandler } from "@vanillaskyai/video/server";
import { videoModel } from "@/lib/video-model";

const handle = createVideoHandler({
  // Local development only. Replace with your session check before deploying.
  authorize: (request) => {
    if (process.env.VANILLASKY_LOCAL_DEMO !== "1") return false;
    const hostname = new URL(request.url).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  },
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model: videoModel,
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
  }),
});

export const POST = handle;
export const OPTIONS = handle;
```

The packaged development command supplies the local marker only to `next dev`,
so production builds and `next start` deny every request. Replace it before
deploying. The model can come from Anthropic, OpenAI, an AI SDK registry or
gateway, or any compatible streaming adapter. The
[Next.js quickstart](examples/nextjs-quickstart) shows the later, explicit
provider-selection step with a quality-oriented Claude Sonnet model.

For planner-selected image and video backgrounds, configure the optional
server-only `resolveMedia` callback described in
[Media and soundtrack audio](docs/media-and-audio.md#media-providers).

## Generate a video

Call the route from React and render the player:

```tsx
"use client";

import { VideoPlayer, useVideo } from "@vanillaskyai/video/react";

export function VideoResponse() {
  const video = useVideo();

  return <>
    <button onClick={() => { void video.generate({
      input: "Activation increased from 41% to 58% after guided onboarding.",
      personalization: { firstName: "Maya" },
    }); }}>
      Generate video
    </button>

    {video.error && <p role="alert">Video generation failed.</p>}
    <VideoPlayer {...video.playerProps} />
  </>;
}
```

That is the complete path. Built-in templates require no setup. VanillaSky
shows each complete, validated scene as soon as it is ready and returns a
deterministic `Video` object when generation finishes.

A copy-and-run app is in [`examples/nextjs-quickstart`](examples/nextjs-quickstart).

## Shape the response

Start with `input`. It is the complete factual boundary by default:

```ts
video.generate({
  input: JSON.stringify({
    period: "Q2",
    activation: { previous: 41, current: 58 },
    cause: "guided onboarding",
  }),
  instructions: "Lead with the improvement, then explain what changed.",
  personalization: { firstName: "Maya", plan: "Pro" },
});
```

- Put claims, numbers, names, dates, and quotations in `input`.
- Keep `knowledgeMode: "input-only"` (the default) for source-grounded video,
  or choose `knowledgeMode: "general"` when the model should answer a question
  or develop content with stable general knowledge.
- Put presentation direction in `instructions`.
- Put viewer or account context in `personalization`.
- Add brand, approved media, soundtrack audio, or a smaller template set only
  when the experience needs them.

VanillaSky does not provide an LLM, hosted generation service, narration, TTS,
or speech synchronization. MP4/WebM encoding and export are application-owned.
Completed videos can be stored as JSON and replayed without calling the LLM.

Custom templates are optional. Only source-owned templates need the local TSX
compiler: `npm install --save-dev tsx`.

## Documentation

| Goal | Guide |
| --- | --- |
| See a video without installing | [Playground](https://vanillasky.ai/playground/) |
| Integrate with a coding agent | [Agent integration guide](docs/agent-integration.md) |
| Build the first response | [Getting started](docs/getting-started.md) |
| Copy the Next.js route and component | [Next.js integration](docs/integrate-nextjs.md) |
| Connect another model | [Provider integration](docs/provider-integration.md) |
| Understand grounding and prompts | [Prompt and input](docs/prompt-and-input.md) |
| Add brand or viewer context | [Branding and personalization](docs/branding-and-personalization.md) |
| Add media or soundtrack audio | [Media and soundtrack audio](docs/media-and-audio.md) |
| Persist and replay results | [Persistence and replay](docs/persistence.md) |
| Run a looping, self-refreshing channel | [Live channels](docs/live-channels.md) |
| Create source-owned templates | [Custom templates](docs/custom-templates.md) |
| Test routes and streams | [Test integrations](docs/testing.md) |
| Deploy securely | [Production](docs/production.md) · [Security](docs/security.md) |
| Inspect the API contract | [Public API](PUBLIC-API.md) · [Protocol](docs/reference/protocol.md) |

Apache-2.0
