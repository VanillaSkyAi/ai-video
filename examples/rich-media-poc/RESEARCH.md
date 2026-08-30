# Rich-media product decision

Research date: 2026-08-25

## Recommendation

Build a **universal visual-asset contract** before building a provider
marketplace. Then ship generated images as one app-owned resolver and GIF/Lottie
as optional render adapters.

The follow-up scene-director POC validates the missing orchestration layer: the
LLM receives the trusted three-template catalog, selects treatments and bounded
asset keys from the user's brief, emits a short `decisionReason`, and writes an
`imageBrief` when a unique image is justified. The host resolves that brief
after the streamed plan completes and replays the hydrated deterministic video.
This is a better SDK fit than random asset rotation because the saved plan keeps
both the creative choice and its rationale.

| Rank | Bet | SDK fit | Launch/virality | Reuse | Main risk |
| --- | --- | --- | --- | --- | --- |
| 1 | AI scene imagery | Very high | Very high | High | generation cost, safety, storage |
| 2 | Animated stickers/GIF | High | Very high | Medium | CORS, licensing, GIF disposal/timing |
| 3 | Lottie/dotLottie | High | Medium | Very high | runtime/wasm weight and async loading |

### 1. AI scene imagery

Best use cases: opening hooks, visual metaphors, backgrounds for abstract ideas,
personalized covers, thumbnails, and one-off campaign worlds. It ranks first
because the current SDK already understands approved media URLs and deterministic
scene timing. The host can generate and store an image, then hand VanillaSky the
result without coupling the package to a provider.

The POC proves a server-only adapter using the current `gpt-image-2` image
generation endpoint. It intentionally returns a data URL for local demonstration;
production should moderate as needed, upload bytes to host-owned storage, and
return an approved HTTPS CDN URL.

### 2. Animated stickers/GIF

Best use cases: reactions, reveals, celebrations, transitions, branded memes,
and visual punchlines in social clips. This is probably the strongest pure
virality feature: it adds recognizable emotion and pacing without requiring a
new narrative layer.

The hard part is not displaying a GIF. A normal `<img>` advances on wall time,
so pause, replay, screenshot export, and arbitrary render frames can disagree.
The POC decodes patches, applies GIF disposal rules, respects authored frame
delays, and selects the composed frame from VanillaSky scene progress.

Catalog search should remain host-owned. Provider migrations and attribution
rules change; the current GIPHY documentation even includes a Tenor-compatible
migration surface. VanillaSky should accept an authorized asset rather than
hard-code a GIF catalog.

### 3. Lottie/dotLottie

Best use cases: branded icon systems, loading/progress states, diagrams,
explainers, lower-thirds, CTA accents, and reusable motion kits. dotLottie v2
adds packaging for themes and state machines, making it a strong long-term
design-system format.

The POC pauses the runtime and seeks its frame from scene progress. That works
cleanly. The tradeoff is dependency weight and asynchronous canvas/WASM setup,
so the renderer should be optional and lazy—not part of every VanillaSky
consumer's core bundle. In this build the shared adapter chunk is about 142 KB
minified / 39 KB gzip and the version-matched renderer is about 1.2 MB WASM.
The POC self-hosts that WASM file and browser-tests that no runtime asset is
fetched from a third-party CDN.

## Why voice is not in this first three

Voice can be more important for long explainers, accessibility, or hands-free
consumption. It is not the best first launch bet for the SDK's present goal.
Good narration requires a script contract, duration negotiation, word timings,
captions, music ducking, localization, browser audio policy, and render/export
alignment. That is a larger synchronized-audio system, not one more media URL.

For launch, generated imagery and motion are instantly visible, highly
demoable, and fit the current deterministic scene model. Voice should follow as
a narration track with timing metadata after the visual-asset contract is
settled.

## Competitive implication

[Varg](https://docs.varg.ai/) positions itself as one gateway for images,
video, speech, music, lipsync, caching, and cloud rendering. VanillaSky should
not copy that provider-gateway breadth. Its clearer differentiation is the
trusted, LLM-planned, streaming video-response model: applications own providers
and assets; VanillaSky owns planning, validation, timing, and playback.

[Remotion](https://www.remotion.dev/) already offers broad programmatic video
rendering, and its guidance includes animated media. That reinforces the same
positioning: VanillaSky wins by making high-quality video a native AI response,
not by becoming the largest low-level render toolbox.

## Sources

- [GPT Image 2 model and image-generation endpoint](https://developers.openai.com/api/docs/models/gpt-image-2)
- [dotLottie specification](https://www.dotlottie.io/spec/)
- [dotLottie overview: multiple animations, themes, and state machines](https://dotlottie.io/intro/)
- [gifuct-js decoder and transparency behavior](https://www.npmjs.com/package/gifuct-js)
- [GIPHY's Tenor-compatible migration guide](https://developers.giphy.com/docs/api/tenor-migration/)
- [Varg product documentation](https://docs.varg.ai/)
- [Remotion product documentation](https://www.remotion.dev/)
