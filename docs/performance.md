# Video-chat performance

Measure the moment the response becomes visible and audible, and any wait for
its next scene. Attach local observations without changing the default UI:

```tsx
import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";

export function App() {
  return <VideoChat options={{
    onPlaybackMetric(metric) {
      console.info(metric.type, metric.elapsedMs);
    },
  }} />;
}
```

The SDK sends nothing to a telemetry service. Events contain only an opaque
turn ID, mode, relative timing, and fixed event categories. Keep custom turn IDs
opaque; do not put prompts or customer information into them.

## What the measurements mean

`first-frame` is the first committed active scene reaching an animation-frame
opportunity. It excludes the generation cover and idle poster. It is not proof
of physical screen paint or decoded footage. The existing `onFirstFrame`
callback observes this same point.

`first-speech` comes from actual browser utterance start or generated audio
playback. It is not the time a speech request finishes. Custom voices must call
`onStart()` when sound begins; otherwise this measurement remains unavailable.
Muted responses do not produce a speech-start event.

`stall` measures a wait after the player reaches the end of its available scenes
while more scenes are being prepared. A completed interval includes `durationMs`.
Deliberate pauses are excluded. This does not measure network buffering inside
an image or video, because those assets do not control the scene clock.

Elapsed times start at prompt submission and can include user pauses. Compare
unpaused runs with the same mode and voice configuration. Treat missing speech
observations as missing data rather than zero milliseconds.

## Reproducible checks

Run `npm run browser:test -- tests/browser/video-chat-performance.spec.ts` for
controlled local scenarios. They delay scene delivery, report speech onset from
a mock voice, verify pause exclusion, and attach the observed metrics as JSON.
These checks detect sequencing regressions. Their results are not live-provider
benchmarks and do not predict generated-video latency.

The initial fallback limits are 15 seconds for generated video and 3 seconds
for stock media, generated speech preparation, and fallback narration. Validate
these against an explicitly authorized, bounded live run before treating them
as tuned provider budgets. Compare first-frame/speech times, stalled duration,
and visual/voice quality together; faster fallback alone does not prove quality.
