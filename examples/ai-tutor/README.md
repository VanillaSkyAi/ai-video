# AI tutor example

Ask a question and get the answer as a narrated video: the scenes and the words
are planned together, so the voice and the picture start together and stay
together.

This is the tutor, not a sketch of one — the landing page, the style and visual
pickers, the session with the script beside the video, session history,
follow-up questions, and the two routes behind it.

<!-- verify:start -->
```bash
npm install
npm run build
npm run dev
```
<!-- verify:end -->

Nothing here is canned. Set `ANTHROPIC_API_KEY` before `npm run dev` and every
lesson is planned and narrated for the question you asked; without it the page
says so rather than replaying somebody else's answer.

Add `FAL_KEY` to film the beats. Without it, the filmed modes still plan and
narrate normally — the scenes simply keep their copy on the brand background.

## Running it with keys

```bash
ANTHROPIC_API_KEY=... FAL_KEY=... npm run dev
```

`FAL_KEY` is only needed for the filmed modes. Restart after changing `server.ts`:
the dev server caches one handler per visual mode, so an edit there does not take
effect until the process restarts.

## Visuals

Three modes, and each is a ceiling rather than a flag, because that is what it
costs: the planner decides how many scenes a lesson has, and each filmed one is
billed.

| Mode | `maxResolvedMedia` | |
| --- | --- | --- |
| Templates only | `0` | Rendered scenes. Free and instant. |
| Some AI video | `1` | The opening beat is filmed. |
| Full AI video | `4` | Every beat filmed, up to the ceiling. |

## Known rough edges

**Planning takes 30 to 90 seconds.** The whole lesson is composed before a word
is spoken, and that is the wait. Nothing is wrong when the warm-up runs for a
minute.

**Lessons come out shorter than asked for** - often one to three scenes rather
than the four or five the instructions request. A question is short input, and
the planner reads short input as sparse material; the instructions push back on
that but do not always win.

## How an answer is made

1. **`/api/lesson`** plans the whole answer through `createVideoHandler`, and
   resolves media for as many scenes as the mode allows. Beats film in parallel
   through `mediaConcurrency`, because waiting for each in turn would make a
   five-scene lesson half a minute of nothing.
2. **`/api/narration`** writes one line per scene — from the scenes, never from
   the question, because a script written from the question drifts from the
   composition that was actually chosen. It returns the follow-ups too.
3. Each line is attached to its scene as `narration`, so the words travel with
   the picture from here on: through pacing, playback, storage and replay.
4. `getSceneDuration` holds every scene for as long as its line takes to say.
5. `createSceneTimeline` turns the finished lesson into a stream the player
   accepts, and `useNarration` says each line as its scene begins.

Nothing plays until both the scenes and the words exist, which is what lets the
voice and the picture begin together.

## The look

A theme carries both halves of a style: the brand the captions are drawn with,
and `generatedLook`, the visual language the footage is filmed in. They travel
together on the style object, so a pale illustrated ground cannot end up under
dark documentary footage.

## The voice

`src/browser-voice.ts` is the browser's own speech synthesiser in thirty lines,
chosen because it costs nothing and needs no key. It is also the whole contract:
anything that can say a line and stop when told is a voice.

A production tutor passes a speech model instead. The lesson is composed before
it plays, so every line is known in advance and can be generated ahead of being
needed — which is why a realtime session is the wrong tool here, despite being
the obvious one. Nothing else about the page changes.
