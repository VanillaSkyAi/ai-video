[← Documentation home](../README.md)

# Customization

## Video chat interface

The default `VideoChat` uses an immersive video canvas with a floating
conversation field, on-video subtitles, and a single dark settings/history
treatment. See [interface behavior](immersive-interface.md) and the
[component reference](reference/design-system.html). Pass a custom welcome
heading and a root class when the application needs its own copy or chrome colors:

```tsx
<VideoChat
  className="acme-chat"
  welcomeTitle={<>Ask Acme<br />See the answer</>}
  options={{ brand: acmeBrand }}
/>
```

Override the scoped custom properties after importing
`@vanillaskyai/video/video-chat.css`; the selectors and values stay local to
that instance:

```css
.acme-chat {
  --vs-media-glass: rgb(18 24 40 / 80%);
  --vs-media-text: #f8f8fc;
  --vs-voice: #e11d74;
  --vs-font: "Inter", sans-serif;
}
```

The built-in navigation carries the VanillaSky logo. `welcomeTitle` changes
the welcome heading; it does not replace the navigation logo. `options.brand`
styles generated video content independently of the surrounding controls.

Use `options` for the endpoint, templates, orientation, visual brand, request
headers, and an optional custom voice. Provider capabilities are discovered
from the server. Use `useVideoChat()` only when the application needs to own the
entire interface.

Pass the following visual settings through `VideoChat` or `useVideoChat` options.
Keep viewer context in the prompt and completed conversation turns; use the
server handler’s `instructions` for trusted product guidance.

## Background and semantic brand

Omit brand configuration to use the standard `cosmic` background. Prefer a
named curated choice over raw color work:

```ts
const brand = {
  name: "Acme",
  logoUrl: "https://cdn.acme.com/logo.svg",
  font: "Inter",
  scriptFont: "Caveat",
  background: "twilight",
  colors: {
    primary: "#6D5EF5",
    secondary: "#3D2A78",
    foreground: "#FFFFFF",
    surface: "#17122F",
    surfaceElevated: "#231B42",
    muted: "#A7A6B0",
  },
};
```

Gradient presets: `cosmic`, `horizon`, `twilight`, `meadow`, `velvet`,
`flamingo`, `peach`, `saffron`. Solid presets: `black`, `midnight`,
`aubergine`, `coal`, `navy`. When a named choice genuinely cannot express the
brand, use `{ colors: ["#112233", "#334455"] }` for a custom gradient or
`{ color: "#070B20" }` for a custom solid.

`colors` may be partial; the resolver fills every semantic token before the
video is emitted. With no foreground, named and custom backgrounds
deterministically select black or white for at least 4.5:1 contrast across the
full rendered sRGB ramp, including gradient interiors. A ramp that neither can
cover is rejected. An explicit foreground is preserved and validated by the
same invariant during input resolution and replay; low-contrast values are
rejected with the failing path and minimum ratio. Elevated surfaces derive an
accessible internal text treatment without changing the semantic foreground.
Use an approved public or signed URL for logos, and never put a private storage
credential in the config.

## Global visual direction

Leave visual direction unset to use VanillaSky's defaults, or set one coherent
look for the completed video:

```ts
style: {
  density: "airy",           // airy | normal | packed
  motion: "calm",            // calm | normal | punchy
  textArchetype: "cinematic",
  backgroundEffect: "slow-zoom-out",
}
```

These are defaults, not generated CSS. A validated scene may still select a
more appropriate text or background treatment when its trusted template allows
it.

## Opening

The planner streams a short spoken hook before the scenes. The chat holds that
opening until its speech finishes and the first scene is ready. A selected
suggestion can start with its prewritten opening and already-loaded media:

```ts
await chat.ask(card.prompt, { opening: card.opening, openingMedia: card.media });
```

Openings and scene narration share the chat voice and pause/mute controls.

## Aspect ratio and responsive layout

The player is responsive by default: it fills its container width. Templates
and copy must work at either aspect ratio; orientation is not an AI-planning
input and must not influence the selected templates or wording.

`portrait` reserves a 9:16 response/export frame and `landscape` reserves 16:9.
This input setting remains stable in the completed config. For an embed that
should display landscape on desktop and portrait on mobile without changing the
saved response, pass `orientation="auto"` to `VideoPlayer`; it responds
to its container width. See [responsive orientation](responsive-orientation.md).

## Media and voice

Configure `searchMedia`, `generateVideo`, and `generateSpeech` on the server
handler. They progressively enhance the same chat; failed optional providers
fall back to templates or browser voice. See [Media and voice](media-and-audio.md).

## Custom templates

The built-in catalog needs no setup. Only source-owned templates need the
optional local TSX compiler; install it once with `npm install --save-dev tsx`.
Then use `npx vanillasky templates create <id>` for an original one-file template or
`npx vanillasky templates add <builtin>` to copy a close built-in. Edit the owned file,
run `npx vanillasky templates sync`, then run `npx vanillasky templates check` before committing.
Pass the generated registry to the server and browser; project-owned IDs
replace matching built-ins and new IDs extend the catalog.

The model sees selection guidance and a schema, not component source. It chooses
a trusted template and fills validated variables. Never evaluate model-authored
React, HTML, CSS, or JavaScript on the live path.

See [custom templates](custom-templates.md).
