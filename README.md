# Give your AI a voice and a face

**VanillaSky is the open-source voice-and-video chat layer.** Add a polished,
general-purpose AI conversation that speaks and starts playing visual answers
while they are still being composed.

> **Status: Beta.** VanillaSky is pre-1.0 and its public API may change as we
> test it in real applications. Pin an exact version before production use.

Your application owns the providers, keys, authentication, persistence,
branding, and product copy. VanillaSky owns the chat flow, planning prompts,
trusted templates, validation, streaming, voice timing, and player.

## Start on localhost

```bash
npx @vanillaskyai/video init
```

Add `ANTHROPIC_API_KEY` to the generated, ignored `.env.local`, then run:

```bash
npx vanillasky doctor
npm run dev
```

Open the reported localhost URL. One text key gives you the complete chat with
packaged templates and browser voice. No template setup is required.

Optional server-only keys progressively add capabilities without changing the
client:

| Key | Adds |
| --- | --- |
| `XAI_API_KEY` | Generated speech |
| `FAL_KEY` | Generated video and voice transcription |
| `PEXELS_API_KEY` | Stock media, including opening backgrounds |

`npx vanillasky doctor` reports readiness by key name and never prints values.
Provider SDKs remain dependencies of the generated application, not the core
package.

For coding agents:

```bash
npx skills add VanillaSkyAi/video@vanillasky
```

Then prompt: `Use $vanillasky to set up and verify a general-purpose video chat in this project.`

## What init creates

The generated application is a thin, editable shell:

- `src/main.tsx` mounts the complete SDK-owned `<VideoChat />` interface;
- `server.ts` connects app-owned text, speech, transcription, stock, and video
  providers through one `createVideoChatHandler`;
- `vite.config.ts` serves the UI and the single `/api/video-chat` endpoint;
- `.env.local` holds server-only keys and is ignored by Git.

The UI stays this small:

```tsx
import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";

export function App() {
  return <VideoChat />;
}
```

Use `useVideoChat` when you want a custom interface while keeping the SDK-owned
conversation and playback lifecycle. Edit the generated server when you want a
different provider. The [provider guide](docs/provider-integration.md) explains
both boundaries.

## Templates are the built-in fallback

The packaged visual templates are the fast, inexpensive default and require no
copied source tree. Add a video provider when you want generated footage; the
same conversation can mix both modes.

Copy template source only when you want to own and edit it:

```bash
npm install --save-dev tsx
npx vanillasky templates add bigNumber
```

That compiler is needed only for source-owned templates. See
[Custom templates](docs/custom-templates.md).

## Go deeper

Completed chat responses are deterministic JSON and can be stored and replayed.
MP4/WebM export remains application-owned.

## Documentation

| Goal | Guide |
| --- | --- |
| Run the complete chat | [Getting started](docs/getting-started.md) |
| Set it up with a coding agent | [Agent integration guide](docs/agent-integration.md) |
| Change or add providers | [Provider integration](docs/provider-integration.md) |
| Customize the interface | [Customization](docs/customization.md) |
| Understand prompts and grounding | [Prompt and input](docs/prompt-and-input.md) |
| Add brand or viewer context | [Branding and personalization](docs/branding-and-personalization.md) |
| Add media or soundtrack audio | [Media and soundtrack audio](docs/media-and-audio.md) |
| Persist and replay results | [Persistence and replay](docs/persistence.md) |
| Test routes and streams | [Test integrations](docs/testing.md) |
| Deploy securely | [Production](docs/production.md) · [Security](docs/security.md) |
| Inspect the API contract | [Public API](PUBLIC-API.md) · [Protocol](docs/reference/protocol.md) |

Try a keyless template response in the
[playground](https://vanillasky.ai/playground/), or visit
[vanillasky.ai](https://vanillasky.ai/).

Apache-2.0
