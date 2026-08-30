[← Documentation home](../README.md) · [Previous: Persistence and replay](persistence.md) · [Next: Streaming protocol →](streaming-protocol.md)

# Live channels

A live channel is a video that plays continuously and rebuilds itself on a
schedule: a market ticker, a news wall, a status board in an office, a loop
behind a conference stand. Nobody presses play, nobody watches from the start,
and the content changes on its own.

This is a different shape from a generated response. A response is produced for
one person, once, in reply to something they asked. A channel is produced ahead
of time for nobody in particular, and then played to whoever is looking.

That difference is what makes it cheap. Playback of a saved `Video` performs no
generation request and no model call — the player is DOM and CSS advanced by a
`requestAnimationFrame` clock — so a channel that loops all day costs exactly as
much as a channel that loops once. All of the cost lives in building the
configuration, which happens on your schedule rather than per viewer.

## The shape

```
scheduled job                       browser
─────────────                       ───────
fetch your data          ┌────────► fetch the stored Video
map it to scenes         │          parseVideo(...)
parseVideo(...)  ────────┘          <VideoPlayer video={...} loop />
store the JSON                      plays forever
```

The job owns the data and the mapping. The player owns nothing but playback.

## Play without stopping

Pass `loop` alongside a saved video. The player restarts from the beginning
instead of showing its replay affordance and loops its soundtrack continuously.
A track shorter than the channel repeats as soon as it ends; when the visual
timeline wraps, the soundtrack restarts from the beginning with it.

<!-- verify:live-channel-example:start -->
```tsx
import { useEffect, useState } from "react";
import { parseVideo, type Video, type VideoScene } from "@vanillaskyai/ai-video";
import { VideoPlayer } from "@vanillaskyai/ai-video/react";

export function Channel({ endpoint }: { endpoint: string }) {
  const [video, setVideo] = useState<Video | undefined>(undefined);
  const [onScreen, setOnScreen] = useState<VideoScene | undefined>(undefined);

  const load = async () => {
    const stored: unknown = await fetch(endpoint).then((response) => response.json());
    setVideo(parseVideo(stored));
  };

  useEffect(() => { void load(); }, []);
  if (!video) return null;

  return <>
    <VideoPlayer
      video={video}
      loop
      autoPlay
      playbackMode="muted-autoplay"
      onSceneChange={(scene, index) => {
        setOnScreen(scene);
        // Wrapping back to the start is a natural moment to pick up a rebuild,
        // so a screen left running all day never serves a stale channel.
        if (index === 0) void load();
      }}
    />
    <p>{onScreen ? onScreen.templateId : "starting"}</p>
  </>;
}
```
<!-- verify:live-channel-example:end -->

`loop` applies to saved videos. A streaming response still ends when the stream
ends, because there is nothing to loop back to until it completes.

## Follow what is on screen

`onSceneChange` fires whenever the scene under the playhead changes, and again
on index `0` each time a loop wraps. Use it to drive anything that has to stay
in step with the video: a caption rail, a source panel, chapter markers, an
analytics event per scene.

Do not run your own timer for this. A parallel clock drifts from the player's
as soon as playback is paused, throttled in a background tab, or delayed by a
slow asset, and the drift is silent.

`onComplete` is not an alternative here: it reports the end of a *stream*, so it
never fires for a saved video.

## Build the configuration yourself

A channel's scenes usually come from your own data rather than from a model.
`resolveVideoBrand` fills a partial brand with the documented defaults, so a
hand-authored `Video` satisfies `parseVideo` without copying a defaults blob
into your application:

```ts
import { parseVideo, resolveVideoBrand } from "@vanillaskyai/ai-video";

const channel = parseVideo({
  schemaVersion: "0.1",
  orientation: "landscape",
  scenes: rows.map((row, index) => ({
    id: `row-${index}`,
    templateId: "bigNumber",
    variables: { texts: row.label, value: row.value, unit: row.unit },
    timing: { fixedDuration: 5 },
  })),
  style: { brand: resolveVideoBrand({ name: "Acme", background: "midnight" }) },
});
```

Validate with `parseVideo` inside the job, before storing. A channel that fails
validation in the browser is a channel nobody can watch; one that fails in the
job can simply leave the previous version in place.

## Keep motion independent of scene length

Templates receive `sceneDuration`. Express motion in seconds against it rather
than as a fraction of `progress`, or lengthening a scene to give viewers more
reading time will stretch its animation instead and give them none.

## Practical notes

- **Rebuild on a schedule, not per request.** Viewers should read a stored
  configuration. If every viewer triggers generation, a channel becomes the most
  expensive surface you own rather than the cheapest.
- **Never replace a good channel with a broken one.** Validate first, and on
  failure leave the previous configuration in place.
- **Autoplay needs `playbackMode="muted-autoplay"`.** Browsers refuse unmuted
  autoplay. A channel can still carry a looping soundtrack: it starts muted and
  becomes audible when a viewer uses the player's sound control.
- **Host your media.** Loops re-request assets over long sessions; serving them
  from your own origin keeps a content policy simple and avoids depending on
  someone else's CDN.
- **Long channels are ordinary videos.** Ten minutes of scenes is one `Video`
  with more entries in `scenes`; there is no separate playlist concept.

## Related

- [Persistence and replay](persistence.md) — the storage boundary these
  configurations pass through
- [Custom templates](custom-templates.md) — templates for your own data shapes
- [Responsive orientation](responsive-orientation.md) — the same channel on a
  portrait screen
