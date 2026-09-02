# AI tutor example

Ask a question and get the answer as a narrated video: the scenes and the words
are planned together, so the voice and the picture start together and stay
together.

This is the tutor, not a sketch of one — the landing page, the theme picker, the
session with the script beside the video, session history, follow-up questions,
and the two routes behind it.

<!-- verify:start -->
```bash
npm install
npm run build
npm run dev
```
<!-- verify:end -->

It runs with no key: without one, `/api/lesson` answers 404 and the page shows
the lesson checked into `src/lesson.ts`, which is exactly what a planner
returns. Set `ANTHROPIC_API_KEY` and restart to plan live ones.

## How an answer is made

1. **`/api/lesson`** plans the whole answer through `createVideoHandler`. The
   planner sees the entire question at once, so it can choose the template that
   fits each beat instead of repeating one shape.
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

## The voice

`src/browser-voice.ts` is the browser's own speech synthesiser in thirty lines,
chosen because it costs nothing and needs no key. It is also the whole contract:
anything that can say a line and stop when told is a voice.

A production tutor passes a speech model instead. The lesson is composed before
it plays, so every line is known in advance and can be generated ahead of being
needed — which is why a realtime session is the wrong tool here, despite being
the obvious one. Nothing else about the page changes.

## Generated video

Not enabled, deliberately: every generated scene is billed, and an example
should be free to run. To add it, give `createVideoHandler` a `resolveMedia`
that calls a video model, set `style.generatedLook` so the footage matches the
captions, and keep `maxResolvedMedia` set — the planner decides how many scenes
there are, and each one is a clip.
