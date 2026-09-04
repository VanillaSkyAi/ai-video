# Video-chat focus and repository cleanup

## Product boundary

VanillaSky's primary product is one general-purpose AI conversation that answers
with synchronized voice and video. The SDK owns the chat, planning, templates,
timing, streaming, and player. The generated application owns provider choices,
keys, authentication, storage, branding, and product instructions.

The default must stay provider-neutral at the SDK boundary and offer two visual
modes only:

- packaged templates, the fast and inexpensive default;
- full generated video through an app-owned provider callback.

## Current baseline

The canonical path already exists:

```bash
npm install @vanillaskyai/video
npx vanillasky init
# add keys to .env.local
npm run dev
```

`init` generates the same `VideoChat` UI as the canonical starter. The packed
onboarding gate now begins in a genuinely empty directory, installs only the SDK,
runs `init`, builds the generated app, and opens it in a browser before adding
the optional template compiler.

## Obsolete code found

### Remove without a product decision

1. **`examples/rich-media-poc/`** — 91 tracked files and 19,037 lines. Nothing
   outside the directory references it, it is not shipped in the npm package,
   and the root test and CI commands do not run it. It belongs to the previous
   adaptive-channel and mixed-media exploration, not the video-chat product.
2. **`mdast-util-from-markdown`** — declared development dependency with no
   import anywhere in the repository.
3. **`sanitizeVideoChatFirstShot`** — internal helper left behind when browser-
   supplied first-shot data was removed. Keep the small internal type where it
   is used and remove the unused sanitizer.
4. **Merged local worktrees** — the workspace currently has 17 clean completed
   worktrees in addition to the active one. They are not repository content;
   prune them separately after confirming no process still uses them.

### Replace, then remove

1. **One-shot examples.** `examples/react-vite/` and
   `examples/nextjs-quickstart/` teach `useVideo` + `VideoPlayer`, while the
   canonical product teaches `VideoChat`. Replace their remaining framework and
   browser coverage with one generated-chat consumer, then delete both examples.
2. **One-shot provider examples.** `examples/server-integrations/` and
   `tests/fixtures/nextjs-provider-app/` validate `createVideoHandler`. Rework
   the provider matrix around `createVideoChatHandler`, preserving Anthropic,
   OpenAI, Google, and OpenRouter compatibility, then remove the old adapters.
3. **Old product documentation.** Delete `docs/use-cases.md` and
   `docs/live-channels.md`. Absorb any still-useful deployment details from
   `docs/integrate-nextjs.md` and input details from
   `docs/input-and-first-scene.md` into the chat-first provider and production
   guides, then delete those two pages as well.
4. **Old acceptance harness.** `scripts/acceptance/`, its six dedicated test
   files, and `docs/maintainers/acceptance.md` contain roughly 1,500 lines built
   around personalized recaps and daily briefings. Replace them with a small
   recorded video-chat journey covering explanation, creative response,
   follow-up, templates, and full-video mode, then remove the old fixtures.

Older changelog entries remain part of the release record and should not be
rewritten when their old example code is deleted.

## Public API decision required

The lower-level one-shot API is still public even though the product no longer
leads with it: `createVideoHandler`, `useVideo`, `useNarration`,
`createSceneTimeline`, and their provider/lifecycle types. Much of their
implementation remains useful internally to `VideoChat`; the avoidable cost is
the public contract, documentation, examples, and compatibility matrix.

For the next pre-1.0 minor, approve one deliberate breaking change:

- keep `VideoChat`, `useVideoChat`, `createVideoChatHandler`, voice hooks, the
  template authoring/catalog entries, and the persisted `Video` parser;
- keep `VideoPlayer` only if standalone replay remains a supported chat need;
- stop exporting the one-shot generation hooks and handler;
- keep their implementation internal until the chat path no longer needs it.

Do not start this phase without explicit owner approval because the repository
freezes all six entry-point signatures.

## Improvement sequence

### 1. Delete isolated dead weight

Remove the rich-media POC, unused dependency, and unused first-shot sanitizer.
This is low risk and should be one PR with the full root suite and package gates.

### 2. Make every integration chat-shaped

Replace the provider compatibility fixture with `createVideoChatHandler`, remove
the duplicate one-shot examples, and reduce the public documentation to one
getting-started path plus customization, providers, templates, persistence,
production, security, and reference material.

### 3. Narrow the public API

After explicit approval, remove the one-shot exports and regenerate the frozen
surface and signature fixtures. Ship this as a clearly documented pre-1.0 minor.

### 4. Shorten CI around the product contract

Keep these gates:

- core lint, types, and unit tests;
- generated app build and browser smoke test from the packed artifact;
- chat handler compatibility for supported text-provider adapters;
- React 18 compatibility;
- package boundary, size, and release integrity.

Remove duplicated example builds and browser installs once their coverage moves
to the generated app. Target a pull-request wall time under 90 seconds; the
current green baseline is about 2 minutes 20 seconds.

### 5. Improve the product after cleanup

1. Add stage-level timing alongside `onFirstFrame`: hook received, speech ready,
   first scene planned, media ready, and first scene painted. Optimize the
   slowest measured stage rather than total time by guesswork.
2. Let `init` select a text-provider recipe while keeping Anthropic as the
   zero-question default. Provider packages and credentials remain app-owned;
   the SDK contract remains callbacks.
3. Add one production deployment recipe for the generated chat after the
   localhost path is stable. Avoid adding another product-shaped example.

## Definition of done

- A fresh directory becomes the canonical chat after SDK install, `init`, and
  adding keys to one ignored file.
- No public guide leads with a non-chat use case.
- No committed example duplicates the SDK-owned chat UI.
- Templates and full generated video remain the only visual modes.
- Provider compatibility tests exercise the chat handler.
- Pull-request CI completes in under 90 seconds without reducing package,
  browser, provider, or public-surface coverage.
