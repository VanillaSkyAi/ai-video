# AI tutor example

A question, answered as a narrated video. The lesson is composed first — scenes
and words planned together — so the voice and the picture start together and
stay together.

<!-- verify:start -->
```bash
npm install
npm run build
npm run dev
```
<!-- verify:end -->

It runs with no key and no provider: `src/lesson.ts` holds a lesson exactly as a
planner would return it. Point `/api/video` at your own `createVideoHandler`
route to plan live ones.

## What it shows

**`narration` on the scene.** The line said while a scene is showing belongs to
that scene, so the words and the picture travel together through planning,
playback and storage rather than being two lists kept in step by index.

**`useNarration`.** The player already reports which scene is showing, which is
the only cue a narrator needs. The line begins when its scene does, stops when
the picture moves on, and can be interrupted.

**Any voice.** `src/browser-voice.ts` is the browser's own speech synthesiser in
thirty lines — chosen because it needs no key and costs nothing. A production
tutor passes a speech model instead: the lesson is composed before it plays, so
every line is known in advance and can be generated ahead of being needed, and
nothing else about the page changes.

**`getSceneDuration`.** A scene is held for as long as its line takes to say.
These templates declare no pacing metadata, so the narration alone decides; pass
a built-in catalog entry and the template's own readable time becomes the floor
as well.

## What a live tutor adds

Plan the lesson through `createVideoHandler`, write the narration from the
scenes it chose rather than from the question, and set `maxResolvedMedia` if the
scenes resolve generated media, since every one of those is billed.
