[← Documentation home](../README.md) · [Previous: Getting started](getting-started.md) · [Next: Provider integration →](provider-integration.md)

# Next.js integration

After installing VanillaSky, choose the provider and model for your server. This
complete example uses Anthropic and asks you to select a current Claude Sonnet
model explicitly instead of baking a model ID into the SDK docs:

```bash
npm install @vanillaskyai/video ai @ai-sdk/anthropic
```

Create an ignored `.env.local`:

```bash
ANTHROPIC_API_KEY=your-key
ANTHROPIC_MODEL=your-current-sonnet-model
```

Create `app/api/video/route.ts`:

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { createVideoHandler } from "@vanillaskyai/video/server";

const modelId = process.env.ANTHROPIC_MODEL;
if (!modelId) throw new Error("Set ANTHROPIC_MODEL in the server environment");
const model = anthropic(modelId);

const handle = createVideoHandler({
  // Local development only. Replace with your session check before deploying.
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
```

The packaged `npm run dev` command supplies this non-secret marker only to
`next dev`. Production builds and `next start` never receive it.

Create a Client Component:

```tsx
"use client";

import { VideoPlayer, useVideo } from "@vanillaskyai/video/react";

export function Video() {
  const video = useVideo();
  return <>
    <button onClick={() => { void video.generate({
      input: "Activation increased from 41% to 58%.",
      personalization: { firstName: "Maya" },
    }); }}>
      Generate
    </button>
    {video.error && <p role="alert">Could not generate the video.</p>}
    <VideoPlayer {...video.playerProps} />
  </>;
}
```

That is the complete first path. Built-in templates need no registry setup.
The development authorization accepts only local requests and denies production
requests; replace it with your application's session validation before
deploying.

The copy-and-run app is in the
[`examples/nextjs-quickstart` directory](../examples/nextjs-quickstart).

For another LLM, replace `anthropic(...)` with the matching AI SDK model. The route
shape and React code stay the same. See [Provider integration](provider-integration.md)
for adapters, authentication, diagnostics, and production controls. Add media,
audio, persistence, or custom templates only after the default path works.
