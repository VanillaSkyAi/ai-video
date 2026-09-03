# AI tutor — next session

The tutor is `examples/ai-tutor`, and everything through PR #24 is merged to
`main`. Branch from there.

```bash
ANTHROPIC_API_KEY=... XAI_API_KEY=... FAL_KEY=... npm run dev --prefix examples/ai-tutor
```

**Kill the process, do not touch a file.** Vite's "server restarted" reloads its
own module graph - `server.ts`, the `src/` files - but `@vanillaskyai/video` is
an externalized dependency imported by Node directly, and Node's ESM cache lives
for the life of the process. Every SDK change after start-up is invisible until
you Ctrl-C and run the command again, and the tutor goes on behaving as though
the fix were wrong. This cost most of an evening: the first scene "would not
film" through five fixes that were all already correct and none of which were
loaded. `server.ts` also caches a handler per mode, so it wants the same.

## Two problems, in order

**1. The planner failures - fixed, and they were not intermittent.** Counted
across two evenings: 33 rejections for an over-long variable against 8 for every
other cause combined. A `maxLength` is a layout contract and a scene that broke
one was rejected whole, so a five-scene answer arrived with three because a
caption ran two characters long. The SDK trims to the bound now and warns
(`scene_variable_clipped`). What is left is rare: one truncation, one malformed
JSON, one hallucinated template id across ~58 runs, all absorbed by the retry.

**2. Slow start - as good as it gets without changing the model.** Measured, in
templates mode: 5.95s planner, 1.06s narration, 1.03s speech, and a lead that is
now gone. Playback opens at ~7.6s and the first sound is at ~2.5s, because the
question is on screen immediately and a line is spoken over it. The planner is
three quarters of what is left and it is generation, not prompt processing - the
catalogue is ~3.3k tokens in templates mode, ~2k in full AI.

Do not go back to a realtime voice for this shape. It bills per open minute, and
its reason to exist is to start speaking before you know what to say - here the
script exists first. It earns its place only in a voice-led architecture, where
it removes the planner rather than sitting behind it.

## The target

`gokayfem/h3-max-education`, with our templates as the difference. Their design
is that the picture never stops and never lies: a bounded queue of clips, the
current one held while the next generates, handoff on decode, interruption that
cancels stale work without stopping playback. The clips come back in seconds, not
minutes: `minimax/h3-max` loads faster than it generates, which is what that
project is built on and why filmed mode is not inherently slower than templates.
The ordered flush with a lead is the same design at this scale; a bounded queue
is what it becomes if a lesson ever gets long enough to need one.

Template mode should behave identically, showing templates where the filmed mode
shows clips.

## Settled - do not re-litigate

- No opening scene. It is a rendered card that plays before anything real, and
  the first scene of a video never resolves media, so in a filmed mode it stands
  where a clip should be. The gradient warm-up covers the wait.
- Playback starts on a one-scene lead, not on the finished lesson. Waiting for
  the whole plan was the slowness; starting on scene one alone risks running
  out of picture. Two scenes in hand costs about a second and the rest have
  landed by the time it is spent.
- A filmed beat shows the film only: no caption, no contrast wash
  (`mediaTreatment: "none"`), no confetti, no background effect. Every one of
  those exists to carry type across a photograph, and the scene carries none.
- The player shows no controls of its own (`controls={false}`). The voice and
  the picture are one thing; pausing the picture alone desynchronises them, and
  the ended-state replay scrim would cover the answer the moment it landed.
- The player's own "Creating your video…" cover must never appear. Do not hand
  the player a stream before there are scenes in it.
- Scene length comes from the measured audio, never an estimate - which means
  `pacedScene` must strip the server's `startTime`/`endTime`. They win over
  `fixedDuration` in `resolveVideoTimeline`, so keeping them moves the picture
  on at the planner's estimate and cuts the line off mid-sentence. The stored
  answer gets the paced scenes too, or a replay from history repeats the bug.

## Measured, so you do not measure it again

- **Effort `low` is slower than `medium`** on the planner: 7.97s to first scene
  against 5.95s. It is not the lever.
- **Haiku 4.5 plans 1.4s faster and is not worth it.** It wrote four body scenes
  as `cardList` where Sonnet used tripleStats, steps, cardList and barChart.
  Choosing the shape that fits each beat is what templates mode is for.
  `ANTHROPIC_PLANNER_MODEL` overrides it.
- **Sonnet writes the opening line, Haiku does not.** Haiku gave the mechanism
  away on "why do waves break" and "why is the sky blue" - for those the
  interesting part genuinely is the answer, and it takes judgement to find an
  angle instead. `ANTHROPIC_HOOK_MODEL` overrides it. ~1.6s.
- **Prompt caching would save money, not time.** The system prompt is small; the
  wait is the model generating.

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
- A scene that never asked for footage is indistinguishable downstream from one
  that was refused: `resolveVariables` returns at its first line when there is no
  `mediaKeyword`. Log the planner's own output before assuming a gate.
- `mediaType: "gradient"` is the media template's no-footage mode, and the
  planner reaches for it on anything it reads as abstract. Naming the template is
  not enough; a filmed mode has to forbid gradient and require the keyword.

## Worth fixing in the SDK

- ~~No way to hide the player's controls~~ - fixed: `controls` prop on
  `VideoPlayer`, which also suppresses the ended-state replay.
- One invalid scene fails the whole video. Skipping it with a warning would be
  kinder, and every consumer will meet this.
- The planner's refusal never reaches the client, so the reason is invisible.
- ~~The first scene never resolves media~~ - fixed: `opening: false` now means
  the host owns the wait, and the three prompt rules that said the same thing
  moved with it.
- The player owns its clock and exposes no seek or handle, so nothing external
  can advance a scene. Any voice-led playback needs that first.

## Next: design

The bugs are done. The next session is about how the tutor looks, not whether it
works. What exists now: the question card and its spoken hook over a violet-blue
gradient, a shimmering camera line, one Loading/Live badge, the script revealing
line by line beside the video, and the composer and follow-up pills up
throughout.

Still open, in order, when design is done:

1. **The lesson arc is rigid.** Every lesson is observation -> cause -> what
   holds it -> consequence -> closer. That suits "why does X happen" and fits
   "what happened in the French Revolution" badly. The fixed arc is what stopped
   one scene swallowing the whole answer, so it earns its place - but it should
   adapt to the question rather than being one shape.
2. **The closer still summarises**, occasionally. It is told not to.
3. **Re-test `narrate: true`.** Measured as "0 scenes narrated" on both models -
   against a process that had cached the SDK from before the option existed, so
   the planner was never asked. If it holds it removes a round trip per scene.
4. **Seven templates, two of which can close.** Thin for a five-scene lesson and
   why shapes repeat. Adding a few is probably worth more than any further
   latency work.

## The prompts, and where they live

Three models write a lesson between them:

- **The hook** (`HOOK_SYSTEM` in `server.ts`, Sonnet, ~1.6s) - one line spoken
  over the loading screen. Two sentences: what someone would notice, then the
  question that notice raises. It may state both sides of the puzzle and never
  the step that connects them, which is what finally stopped it answering
  questions like "why is the sky blue". Tested against Haiku twice; Haiku is
  half a second faster and gives the answer away on those questions.
- **The planner** (`plannerInstructions` in `plan-lesson.ts`, Sonnet, ~6s) -
  five scenes, each with a job it cannot collapse. This text is the app's
  `instructions`; it sits inside a ~2,900-token system prompt the SDK builds,
  whose last section is the template catalogue. Anything said early loses to
  what the model reads last - that is why the `narration` field was ignored 100%
  of the time by two models.
- **The narration** (`NARRATION_SYSTEM`, Haiku, ~0.9s per scene) - says only
  what its own scene shows. It used to be told to say "what the scene shows and
  why it matters", and "why it matters" was an invitation to explain a scene the
  picture had deliberately left unexplained.

`examples/ai-tutor/scripts/print-transcript.mjs` prints a whole lesson as text -
hook, then every scene with what it shows and what is said over it. Judging a
prompt one scene at a time is how the hook and the first scene ended up
answering the same question twice.

## Also broken

`vanillasky-site` PR #170 moved fal generation to the AI SDK provider and is
broken for real generations - it was verified against a fake model. It is
**merged**, so the breakage is on site main and undoing it is a new PR.
Dev-only. Move it back to `@fal-ai/client`.
