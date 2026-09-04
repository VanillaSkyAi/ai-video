[← Documentation home](../README.md) · [Next: Provider integration →](provider-integration.md)

# Getting started

The fastest VanillaSky integration is the complete, general-purpose video chat.
It starts with packaged templates and browser voice, then turns on optional
speech, stock, transcription, and generated video when their server keys exist.

## Create the app

Start in an empty npm project:

```bash
npm install @vanillaskyai/video
npx vanillasky init
```

Init creates a small application shell and installs its provider dependencies.
It does not copy VanillaSky's template tree. The important generated files are:

| File | Your application owns |
| --- | --- |
| `src/main.tsx` | The mount point for the SDK-owned chat |
| `server.ts` | Provider choices and callbacks |
| `stock.ts` | Optional stock search policy |
| `vite.config.ts` | Local UI and `/api/video-chat` endpoint |
| `.env.local` | Ignored server-only credentials |

The generated browser entry is intentionally tiny:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><VideoChat /></StrictMode>,
);
```

The SDK owns the responsive interface, conversation state, suggestions, voice
input, narration pacing, streaming player, and packaged templates. Your shell
stays responsible for providers, keys, authorization, limits, storage,
branding, and product copy.

## Add the one required key

Add the text-provider key to the generated, ignored `.env.local`:

```dotenv
ANTHROPIC_API_KEY=
```

Fill the value locally; do not expose it through a client-prefixed environment
variable. Then inspect the setup without calling any provider:

```bash
npx vanillasky doctor
```

The base experience reports `templates + browser voice`. A ready text key makes
the chat answer. Optional keys progressively add capabilities:

```dotenv
# Optional generated speech
XAI_API_KEY=

# Optional generated video and voice transcription
FAL_KEY=

# Optional stock media
PEXELS_API_KEY=
```

Doctor reports only key names and readiness, never values. Adding or removing
an optional key changes the available modes after a server restart; the client
does not need to change.

## Run and verify

```bash
npm run dev
```

Open the reported localhost URL. Try one explanatory question and one unrelated
creative request in the same conversation. Confirm each response starts with a
spoken hook from the response stream before the full plan is complete, holds its opening until the first
scene is ready, reaches its final frame, and leaves the composer ready for
another turn. With stock media enabled, click a welcome or follow-up card and
confirm its footage carries directly into that opening. With generated video
enabled, confirm the only choices are Templates and Full AI video and that the
first generated shot continues the spoken hook without repeating it.

The generated local authorization accepts localhost only. Replace it with your
real session check, rate limits, and usage policy before deploying.

If you prefer a committed Next.js example of the lower-level response APIs,
use the tested [Next.js one-shot example](../examples/nextjs-quickstart). The default
chat path above is the shortest way to reproduce the complete experience.

## Continue

- Change providers or add media capabilities in [Provider integration](provider-integration.md).
- Brand or reshape the default experience in [Customization](customization.md).
- Use a fully custom UI with the headless chat hook described in
  [Provider integration](provider-integration.md#custom-interface).
- Copy and edit a visual only when needed in [Custom templates](custom-templates.md).
- Apply production authorization and key handling from
  [Production](production.md) and [Security](security.md).
