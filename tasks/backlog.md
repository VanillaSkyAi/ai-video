# Backlog

Work the SDK needs, written from building an AI tutor on top of it in
`vanillasky-site` (`/playground/tutor`). Each item names what it unblocks and
what it cost to work around, so the reason survives the person who found it.

The bar these are measured against: someone asks the SDK skill for an AI tutor
and has a working one in minutes, without opening the SDK source.

## Export a readable scene duration, and make it a range

`getReadableSceneDuration` in `src/server/pacing.ts` already computes how long a
scene needs from `timing.contentFields` - 2s plus a second an item, or a second
plus words over 4.5 - but it is internal. Consumers reach for the metadata
instead and get `minDuration`, which is the least a template survives being
squeezed to, not the time it takes to read: 1s for `media`, 1.5s for
`bigNumber`. A narrated lesson that uses it flashes past.

Export it, have it return a floor and a ceiling rather than a floor, and say in
the metadata docs that `minDuration` is a compression bound so nobody else
reaches for it first. The ceiling matters as much as the floor - without one, a
long line over a static card is dead air, and the consumer has to invent a
number.

## Carry the narration on the scene

`VideoScene` has no field for what is said over it, so a narrated video is two
arrays kept in step by index. Every alignment bug in the tutor came from that:
the script drifting from the composition, replay needing a parallel `script[]`
on its own record, the transcript pane unable to follow the picture even though
`onSceneChange` already exists and would drive it.

One optional `narration` field on the scene. The planner writes it, duration
derives from it, replay carries it, and the transcript follows for free.

## A continuous timeline that never goes blank

Composing a growing video that the player accepts is pure protocol - sequence
numbering, `eventId` shape, 0-based `position`, the completion checksum - and
getting any of it wrong rejects the whole stream with a clean console and no
error. That cost days in the tutor and five paid generations before the cause
turned out to be an event id joined with `-` instead of `:`. The site now has a
`scene-stream.ts` that gets it right; it should not have had to.

Beyond composing, the playback discipline belongs here too: hold the last
decoded scene while the next generates, hand off on decode rather than on
arrival, keep a bounded prefetch queue, and cancel stale generation on an
interrupt without stopping playback. `gokayfem/h3-max-education` spends about
1,600 lines on exactly this, which is the clearest evidence it is not something
a consumer should be rebuilding.

There is prior art in this repository's own history. The `rich-media-poc`
example, removed before launch, had a `src/lib/adaptive-channel/` with a
startup-buffer gate that holds events until enough duration has accumulated
before opening playback, a scene scheduler, and media continuity that carries a
keyframe from one scene into the next. Worth reading before writing this from
scratch: `git show 670206d^:examples/rich-media-poc/src/lib/adaptive-channel/`.

## Plan one scene at a time, with context

The planner only plans whole videos. That forces a choice between composing
everything up front - correct, validated, and a ~25s wait before anything plays
- and letting a voice model invent scenes beat by beat, which cannot vary its
template choice because nothing sees the whole answer, and cannot resolve stock
media because nothing produces a search intent. The tutor shipped both and
neither is right.

Planning a single scene against the full catalogue, given an outline of the
other beats, is what allows a lesson to start immediately and still be composed:
speak the first line while the rest realize behind it. It is the piece the
two-phase tutor design stands on.

## Media resolution that runs in parallel

`resolveMedia` resolves one part at a time inside the plan stream, so five
generated backdrops cost five sequential round trips. The scene director route
in the site had to rebuild the planner to film in parallel. The scheduling is
the SDK's concern, not the consumer's.

## The generated half of style

A style now has two halves: the brand the templates render with, and the look
the video model films in. They have to move together - pale illustrated ground
with dark documentary footage looks broken - but only the first is in the style
object, so the site threads its own `styleTail` into every generation call by
hand.

Put it on the style object and have the media resolver apply it, and generating
footage that clashes with the captions becomes structurally impossible. Ship the
four looks the tutor uses as presets, the way brands already ship as presets.

## A voice contract, with a fal adapter in the box

Voice is not next to the video in this product, it is the clock. The coupling is
all video-side and all of it was a bug at least once: voice and picture starting
together, scene duration following the spoken line, an interrupt aborting
filming, the transcript following the scene. A consumer wiring their own hook
hits every one.

Own the contract - speak, interrupt, events - and ship providers as adapters.
fal serves both voice and video from one key, which is the dependency the SDK
already has, so the first adapter adds no new provider surface. Pacing off the
audio clock instead of a words-per-second estimate is only possible once the SDK
owns both ends; today the tutor's alignment is a guess for exactly this reason.

## A default tutor instruction contract and tool schemas

The prompt work is a day per rebuild otherwise: how a tutor should speak, that
it must never mention the visual process, what a visual request contains, when
to stop one. `gokayfem/h3-max-education` ships all of it as a protocol package
with zod schemas, safety policy included, and is better for it. Shippable and
overridable, not baked in.

## Budget caps as a first-class option

Filmed scenes cost real money per beat and nothing in the SDK bounds them. The
tutor can be made to spend by holding down a suggestion chip. Per-session and
global ceilings, with a documented way to degrade to rendered scenes rather than
fail, belong beside the media resolver that spends the money.
