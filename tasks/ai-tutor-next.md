# AI tutor — what it should be

The example in `examples/ai-tutor` works end to end but does not yet feel right.
This is the target and the ground already covered, so the next session starts
from the design rather than from the symptoms.

## The experience

Model it on `gokayfem/h3-max-education`, with the SDK's templates as the
difference. Their whole design is that **the picture never stops and never
lies**: a bounded queue of clips, the current one held while the next generates,
handoff on decode, and an interruption that cancels stale work without stopping
playback.

Four requirements, all currently unmet:

1. **Nothing plays until the first real scene is ready.** In AI video mode that
   means the first generated clip, not a placeholder. Today an opening template
   scene plays first, which is why a lesson starts instantly and then stalls.
2. **A filmed scene shows only the film.** No template chrome over it. The
   caption belongs to the rendered modes.
3. **The player's own "Creating your video…" cover must never appear.** The
   gradient warm-up with cycling text is the only loading state. It currently
   shows whenever a stream exists with no scenes yet.
4. **Pause pauses everything.** The player's pause must stop the narration too,
   and resume must resume it. `useNarration` has no pause today, only interrupt.

Template mode should behave identically, showing templates where the filmed mode
shows clips. One flow, two kinds of scene.

## What already works, and must not regress

- Planning streams and completes in 5-9 seconds.
- `knowledgeMode: "general"` is required. Without it the planner refuses: a
  question carries no facts and it will not invent them. Every "one scene only"
  failure traced back to this.
- Thinking must be disabled (`providerOptions.anthropic.thinking.type =
  "disabled"`) with `maxOutputTokens: 8192`. Left on the default, planning took
  76 seconds.
- Filming goes through `@fal-ai/client`, not the AI SDK's fal provider. A video
  model is queued and polled; the provider posts to the synchronous endpoint and
  returns "Not Found" in six seconds however valid the id. A clip takes about
  four seconds.
- Speech is `experimental_generateSpeech` through xAI. Audio is generated while
  the previous scene plays and cached, so replay costs nothing.
- Scene duration comes from the measured audio, not an estimate. Decode it; the
  MP3 header's own duration runs short, and a short duration cuts the line off.
- The planner emits an invalid scene now and then - a headline over its limit, a
  scene with no timing - and one invalid scene fails the whole run. There is a
  single retry.

## Two SDK questions this raised

- **One invalid scene fails the entire video.** Skipping it with a warning would
  be more forgiving, and every consumer will meet this.
- **The planner's refusal never reaches the client.** The browser is told only
  "generation failed". The reason is in the model's own text and is the
  difference between three hours of guessing and one look.

## Known broken elsewhere

`vanillasky-site` PR #170 migrated fal generation to the AI SDK provider and is
therefore broken for real generations - it was verified against a fake model,
which proved the adapter's shape and nothing about whether fal would accept it.
Dev-only, so nothing user-facing, but it should be reverted or moved back to
`@fal-ai/client`.

## Running it

```bash
ANTHROPIC_API_KEY=... XAI_API_KEY=... FAL_KEY=... npm run dev --prefix examples/ai-tutor
```

Restart after any change to `server.ts`: the dev server caches one handler per
visual mode, and edits there do not take effect until the process restarts.
