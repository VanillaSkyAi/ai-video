# AI scene director proof of concept

This isolated consumer app turns a creative brief into a real VanillaSky plan.
The app-owned OpenAI model chooses the scene structure, copy, timing, media
treatment, specific catalog asset, and a visible reason for every choice.

The planner can choose among three source-owned templates:

1. **AI scene imagery** with a concrete image brief. After planning, the host
   application generates the image and hydrates the replayable video.
2. **Animated GIF stickers** selected from four semantic catalog keys and
   decoded into deterministic timeline frames.
3. **Lottie motion** selected from three semantic catalog keys and explicitly
   sought from VanillaSky scene progress.

The checked-in starter storyboard and all local assets work without a provider.
Add an OpenAI key to direct a fresh video:

```bash
npm install
cp .env.example .env.local
npm test
npm run typecheck
npm run templates:check
npm run build
npm run dev
```

Open `http://localhost:3000`. The development command enables both provider
routes only for localhost; replace that policy with real session authorization,
rate limits, moderation, storage, and media policy before deployment.

## Adaptive channel POC

Open `http://localhost:3000/channel` for the continuous-story experiment. It
works without keys: local fixtures prove the planning, route selection,
playback, fallback, and rolling-queue behavior without model spend.

The channel separates four responsibilities:

1. A bounded planner turns one premise into two to five structured scene
   intents and a persistent world/character bible.
2. Deterministic policy picks `stock`, `generate-image`, `generate-video`, or
   `gradient`. Factual scenes prefer retrieval, motion-critical scenes use
   video only when the measured remaining playback deadline exceeds configured
   video p95 latency plus a safety margin, and a manual override wins.
3. Provider adapters compile the intent differently. Pexels receives a short
   keyword query; an image model receives role-scoped continuity and
   composition constraints; H3 Max receives one prompt containing timed beats,
   camera, lighting, and only the continuity relevant to that shot, plus an
   optional first-frame reference image. Native generated audio is intentionally
   outside this visual-only prototype.
4. The browser holds only the current and next finite VanillaSky `Video`.
   While one chapter plays, the server resolves the next. If generation is
   late, the current chapter loops instead of leaving a blank frame.

To exercise live providers locally, add keys in `.env.local` and explicitly
set `ADAPTIVE_CHANNEL_LIVE_MEDIA=1`. The app uses Pexels' current `/v1` video
endpoint and fal's `minimax/h3-max` text-to-video or image-to-video endpoint.
Live provider failures degrade through the same route, then another safe media
type, then the brand gradient. Factual retrieval never falls back to invented
imagery. Fixture mode and live-validation mode are separate so broken keys or
provider contracts stay visible; `ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK=1`
is an explicit, optional choice for a forgiving demo.
Production should copy generated assets from provider URLs into application-owned
storage before saving or distributing a channel segment.

Restarting or leaving the page aborts the active request instead of allowing an
obsolete generation to continue spending. Character identity and previous-shot
keyframes are tracked separately, so unrelated stock imagery cannot become the
next character reference. The next chapter is marked ready only after its first
image or video poster has been warmed by the browser.

This POC intentionally leaves planning deterministic so orchestration can be
evaluated separately from story-writing quality. The `planChannelSegment`
boundary can later be implemented by an LLM without changing route policy,
provider adapters, saved segments, or playback.

## What the POC proves

- VanillaSky's existing trusted-template planner can make the creative choice;
  the SDK does not need a separate provider API for every media type.
- Variation is semantic rather than random. The model sees bounded sticker and
  motion keys plus `useWhen`/`avoidWhen` guidance, then explains its selection.
- Generated images need a two-stage flow: plan an `imageBrief`, resolve it in
  the host application, then store/replay the hydrated deterministic video.
- GIF and Lottie stay seek-safe because their frames follow scene `progress`
  rather than wall-clock autoplay.
- Infinite playback does not require an unterminated SDK protocol. A bounded
  queue of completed, validated segments keeps memory and failure behavior
  understandable while preserving the current public contract.

See [RESEARCH.md](RESEARCH.md) for the ranked product bets and the longer-term
voice decision.
