# AI tutor — next session

Work is on `feat/tutor-example-complete` (PR #22), in `examples/ai-tutor`.

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

**1. The planner still fails intermittently, and one failure kills the lesson.**
Seen: `Scene template list was not negotiated`, `The planner was truncated before
adding a generated scene`, `plan part.scene.timing must be an object`, and
`Scene template steps cannot be used as a closer`. `streamLessonWithRetry` asks
again and now says so in the console - a retry doubles the wait and interleaves
two plans' timings, which reads as the tutor behaving randomly rather than as one
failed plan. This is the last real bug.

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

## Next, in order

1. The intermittent planner failure above.
2. Re-test `narrate: true`. It was measured as "0 scenes narrated" on both
   models - against a process that had cached the SDK from before the option
   existed, so the planner was never asked. If it holds it removes a round trip
   per scene.
3. The planner still opens by restating the question despite being told not to,
   so the first frame gives the answer away right after the opening line said
   something else. Content, not plumbing, and the more damaging of the two.
4. The tutor has seven templates and only two can close; templates mode forbids
   one of those, leaving `milestone` alone. That is a thin catalogue for a
   five-scene lesson and it is why the scenes repeat shapes.

## Also broken

`vanillasky-site` PR #170 moved fal generation to the AI SDK provider and is
broken for real generations - it was verified against a fake model. It is
**merged**, so the breakage is on site main and undoing it is a new PR.
Dev-only. Move it back to `@fal-ai/client`.
