# AI tutor — next session

Work is on `feat/tutor-example-complete` (PR #22), in `examples/ai-tutor`.

```bash
ANTHROPIC_API_KEY=... XAI_API_KEY=... FAL_KEY=... npm run dev --prefix examples/ai-tutor
```

Restart after editing `server.ts`; the dev server caches a handler per mode.

## Two problems, in order

**1. The planner fails intermittently, and one failure kills the lesson.**
Seen: `plan part.scene.timing must be an object`, and `Scene template steps
cannot be used as a closer`. There is a single retry, which hides it about half
the time - which is why a question sometimes answers with one scene. Until this
is reliable nothing else is worth tuning.

**2. It is slower than the prompt playground, because of how the voice is
wired.** Each scene costs a narration call and a speech call, run serially
inside the loop that reads the plan, so four scenes add ~14s. Run them in
parallel once the scenes are known and it is ~3.5s. Do not go back to a realtime
voice: it bills per open minute, sounds no better, and exists to start speaking
before you know what to say - here the script already exists.

## The target

`gokayfem/h3-max-education`, with our templates as the difference. Their design
is that the picture never stops and never lies: a bounded queue of clips, the
current one held while the next generates, handoff on decode, interruption that
cancels stale work without stopping playback. The example does not work this way
yet, and patching toward it has not converged - expect to restructure.

Template mode should behave identically, showing templates where the filmed mode
shows clips.

## Settled - do not re-litigate

- No opening scene. It is a rendered card that plays before anything real, and
  the first scene of a video never resolves media, so in a filmed mode it stands
  where a clip should be. The gradient warm-up covers the wait.
- Nothing plays until the whole lesson is ready.
- A filmed beat shows the film only; no caption over it.
- The player's own "Creating your video…" cover must never appear. Do not hand
  the player a stream before there are scenes in it.
- Scene length comes from the measured audio, never an estimate.

## Traps already paid for

- `knowledgeMode: "general"` is required, or the planner refuses: a question
  carries no facts and it will not invent them. Every "one scene only" mystery
  began here.
- Disable thinking (`providerOptions.anthropic.thinking.type = "disabled"`) and
  set `maxOutputTokens: 8192`. On defaults, planning took 76s instead of 5.
- Film through `@fal-ai/client`, not the AI SDK's fal provider: video models are
  queued and polled, and the provider posts to the synchronous endpoint - every
  request returns "Not Found" in six seconds however valid the id.
- Never diagnose from the client's error. It says only "generation failed". Log
  the planner's own text; every real cause today was in it.
- Stub every `/api` route in a browser probe. The dev server is usually running
  and unstubbed calls spend money.

## Worth fixing in the SDK

- One invalid scene fails the whole video. Skipping it with a warning would be
  kinder, and every consumer will meet this.
- The planner's refusal never reaches the client, so the reason is invisible.
- The player owns playback but cannot report a pause, so the example watches its
  control's `aria-label` to pause the voice with it.
- The first scene never resolves media, which is wrong when it should be filmed.

## Also broken

`vanillasky-site` PR #170 moved fal generation to the AI SDK provider and is
broken for real generations - it was verified against a fake model. Dev-only.
Revert it or move it back to `@fal-ai/client`.
