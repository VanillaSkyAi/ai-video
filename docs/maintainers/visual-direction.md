# VanillaSky visual direction

Date: 5 September 2026. Baseline: SDK 0.8.4, `26b672d`.

## Decision

Make the default experience an editorially composed visual answer: precise graphics when the idea is structural, relevant photography when the subject is concrete, and generated scenes when an original image or action earns its cost. Do not require a response to demonstrate every format.

Keep animation as a core capability. Narrow the default vocabulary and remove decorative motion from informational scenes. Keep stock and generation optional, application-owned sources. A source restriction must not prevent the use of an exact chart, a product screenshot, or a necessary label.

The first implementation is a redesign of the existing `barChart` template, using a two-value comparison as the reference. The rest of this document is a delivery plan, not a claim that the media pipeline or all templates have already changed.

## What the Apple bar means here

Borrow clarity, hierarchy, material quality, confident spacing, and purposeful motion—not Apple logos, copied layouts, or a layer of glass effects. Apple's design guidance connects clarity to order, spacing, and contrast and treats animation as deliberate communication ([design principles](https://developer.apple.com/videos/play/wwdc2026/250/), [motion](https://developer.apple.com/design/human-interface-guidelines/motion)). The specifications below are our design decisions, not Apple requirements.

- One visual subject or relationship dominates each scene.
- A scene should read at actual phone size, not just in a 1920-pixel screenshot.
- Motion reveals, compares, connects, or directs attention. It does not continuously announce that the scene is animated.
- Numbers and units remain exact. An animation must not suggest invented intermediate measurements, misleading proportions, or unsupported improvements.
- A quiet hold is part of the composition. No compulsory pulse, bounce, shake, confetti, emoji, or camera movement.
- A coherent response may repeat the same template. Variation must have a content reason.

### Reference design tokens

Use semantic brand tokens in the renderer. These are the review fixture values, not new hardcoded SDK brand defaults:

| Role | Light fixture | Dark fixture |
| --- | --- | --- |
| Canvas | `#F5F5F7` | `#111114` |
| Primary text | `#1D1D1F` | `#F5F5F7` |
| Secondary text | `#626267` | `#AEAEB4` |
| Accent | `#0066CC` | `#66AAFF` |
| Quiet structure | `#DADAE0` | `#35353B` |

Use the application's brand font with the existing system sans fallback. The reference uses a system sans, regular/medium labels, semibold data, tabular numerals, and no ornamental font pairing. Keep exact data visually larger than the topic label. Do not import proprietary font files.

## Voice, subtitles, and visible information

The voice explains the point. Subtitles make that explanation accessible. The scene shows what benefits from being seen. Avoid displaying a paragraph, speaking that paragraph, and repeating it in subtitles.

Suggested narrated-scene copy budgets:

| Element | Budget and purpose |
| --- | --- |
| Topic | Optional; 2–5 words, generally one line |
| Metric | Exact value, unit, and a 1–3 word label |
| Comparison | Prefer two alternatives; short labels plus exact values |
| Sequence | Prefer three visible stages; 1–3 words per label |
| Diagram | 2–4 meaningful objects; short labels |
| Media overlay | None by default; at most one short title or necessary label |
| Quote | Exact, short excerpt with attribution; only when the wording itself matters |
| Action | One grounded action, with no mandatory sales CTA |

These are planning targets, not permission to truncate units, qualifiers, names, or factual meaning. When content does not fit, split the thought, choose another layout, or omit a nonessential topic line. Never silently clip facts. Existing saved scenes retain their accepted schema budgets.

Reserve a stable caption area in the player and pass its measured bounds to scene layout in a later integration step. Include controls and expanded subtitle states. Today the player supplies orientation-based safe zones, not the live height of the chat subtitle panel; a conservative template margin is useful but does not solve that integration by itself.

For the reference template, keep the bottom part of the canvas quiet and verify captions in both orientations. A visible topic can include the unit (for example, `Activation (%)`) until a reviewed unit field is added to the chart contract. Do not append a percentage to arbitrary numeric data.

Muted viewers can read subtitles. Turning off both voice and subtitles is an explicit preference; do not automatically add a wall of scene text to compensate. Long-term, offer a readable transcript/summary alongside playback.

## The template vocabulary we need

These are semantic families, not a commitment to expose one new public template ID per row. Reuse existing IDs where their schemas express the job honestly. Any incompatible schema/removal requires its own contract decision.

| Family | Purpose | Existing foundation | Planned work |
| --- | --- | --- | --- |
| Media | Show a relevant photo, supplied clip, or generated shot | `media` | Make no-overlay composition first class; provide stable title placement when needed |
| Metric | Show one exact value or bounded completion | `bigNumber`, `progressRing` | Quiet typography; restrained reveal; exact visible values; preserve units and qualifiers |
| Comparison | Compare quantities or two actual states | `barChart`, `beforeAfter` | Reference bar chart now; later genuine image/state comparison rather than emoji transformation |
| Trend | Show change over time | Missing | Grounded line chart, actual time axis, gaps preserved, no invented smoothing |
| Sequence | Show what happens next | `steps` | Calm connected stages, no mandatory emoji, focus one stage while retaining context |
| Relationship | Explain a system or cause-and-effect relationship | Missing; `problemSolution` only supplies paired statements | Bounded 2–4 node diagrams; labeled relationships must be supported by input |
| Product | Show the real thing and a specific feature | `phoneMockup`, `webMockup` | Actual supplied screenshot/image as hero; device frame optional; one meaningful crop/callout |
| Place | Explain a location or route | Missing | Verified geographic data and labeled locations; no generated maps |

Supporting formats remain available for genuine source material: attributed quotes/testimonials, a concise conclusion, and an optional action. A comparison, trend, or product scene can itself be a sufficient final visual; the planner should not invent a celebratory or promotional ending.

### Disposition of all 28 current templates

| Current IDs | Direction |
| --- | --- |
| `media` | Core media family; allow an image to stand on its own |
| `bigNumber`, `barChart`, `progressRing` | Core data family; remove ornamental motion |
| `steps` | Core sequence family; calm geometry and short labels |
| `phoneMockup`, `webMockup` | Core supplied-product capability; make mockup styling optional |
| `beforeAfter` | Replace default emoji storytelling with factual comparison; retain old accepted scenes until a reviewed change |
| `problemSolution` | Remove default tremor/bounce/celebration; use only for a supported contrast |
| `tripleStats`, `cardList` | Supporting information layouts; not automatic filler or a reason to invent three facts |
| `testimonial` | Supporting exact quotation; quiet attribution |
| `ctaLogo`, `ctaMedia` | Supporting grounded action only; no default sales ending |
| `codeEditor`, `terminal`, `promptInput` | Optional developer/product vocabulary |
| `tweet`, `notification`, `chatMessenger`, `chatWhatsapp`, `reviewStack` | Optional source-specific social vocabulary; never fabricate a post or conversation for atmosphere |
| `reaction`, `confetti`, `emojiBurst`, `incomingCall`, `brandMessage`, `milestone` | Optional expressive vocabulary, enabled by explicit tone/use case |

Start with media, metric, comparison, sequence, product, quote, and a quiet conclusion. Build trend and relationship next because they expand explanatory coverage. Add maps after the verified-data path exists. Do not build all families before testing the reference direction.

## Gradients

Flat light or dark backgrounds should be the default for information. Keep gradients as an optional authored background for atmosphere, a product reveal, or an explicit brand direction. They should not breathe, drift, or cycle simply to fill time.

Do not use a gradient as a silent substitute for a missing subject. If footage fails, the scene needs a coherent graphic/still alternative chosen for the same idea. A neutral surface is the background of that alternative, not the alternative itself.

The reference renderer preserves supplied brand backgrounds and media because the existing contract cannot distinguish an explicitly chosen gradient from one populated by a host theme. Changing the default chat ground and all template defaults is a separate coordinated phase; otherwise generated footage, captions, loading surfaces, and saved-video replay can disagree.

## Fix stock relevance before increasing stock usage

Current production starter: `starters/video-chat/stock.ts`. It already requests three candidates, checks trusted URLs, shares a three-second lookup deadline, supports video/photo fallback, and caches bounded search results. Its metadata filter accepts any matching query word or missing descriptive metadata. That is a useful technical filter, not a semantic relevance decision. The older rich-media example is not the production reference.

The [Pexels API](https://www.pexels.com/api/documentation/) supplies search, orientation, renditions, and asset metadata. It does not provide a documented score saying a clip faithfully represents this scene or has room for our subtitles. We must make that decision.

### Proposed selection flow

1. **Write a visual intent before a search query.** Record subject, required action, essential attributes, exclusions, whether a real identity/place/event must be exact, and whether media is evidence or illustration. Example: `golden retriever swimming` requires that animal and action; a clip of a person swimming is a reject even though one word matches.
2. **Use supplied/verified assets for exact identity.** Generic stock cannot substantiate a particular customer, product interface, named event, or route. AI imagery cannot repair absent evidence.
3. **Retrieve a bounded shortlist.** Start with up to six candidates and one semantically safe reformulation inside a total deadline. Relax nonessential modifiers, never the subject/action or required identity. Do not turn an empty precise query into unrelated generic footage.
4. **Apply cheap hard filters.** Trusted source URL, MIME/type, usable duration and crop, orientation, duplicates, known contradictions. A missing description means unknown, not approved. Keep existing cancellation and URL safeguards.
5. **Assess the best few candidates visually when available.** For photos inspect the image; for clips inspect representative beginning/middle/end frames of the selected interval, not only a poster. Check subject/action, visible contradictions, crop, existing text, and overlay collision. Use full temporal review when action is central. Sampling cannot prove unseen portions are clear.
6. **Return an explicit decision.** Separate verified match, illustrative match, uncertain, no match, timeout, and provider error internally. Only qualified candidates may proceed. Model confidence is not a calibrated probability; tune acceptance rules against human-reviewed fixtures.
7. **Choose a semantic fallback.** Prefer an approved relevant still, then an appropriate structured scene. Generated imagery is a possible alternative only for illustrative intent, within host permission and budget. Never reclassify an exact factual scene as fictional just to fill it.
8. **Freeze the selected asset and rationale before emission.** Keep already emitted scenes immutable. Store provenance, assessment version, crop, and source identity in server-owned records. Expose suitable attribution to the UI, not provider secrets or raw internal prompts.

Ranking priorities: semantic match first, factual suitability second, useful framing third, coherent visual style fourth. A gorgeous unrelated shot loses. Avoid a weighted total in which aesthetics can compensate for the wrong subject.

Cache visual assessments by asset identity, requested intent, crop/time interval, and assessor version—not just search words. Reuse approved assets across identical requests where licensing and host policy permit. Record rejection reasons so the same mismatch is not purchased or fetched repeatedly.

Vision review is application-owned and optional. Without it, use approved/pre-reviewed media or strong metadata matches for low-specificity illustrative scenes; keep uncertain results out. Do not silently add a mandatory vision-model dependency or a billable call to every SDK request.

## When to generate

Select visual format before provider:

- **Stock photo:** a real setting/object is sufficient; no meaningful action must be seen.
- **Stock video:** ordinary real-world action or atmosphere matters and a matching clip exists.
- **AI image:** an original illustrative scene is needed but motion is optional.
- **AI video:** an original action, transformation, or imagined environment is central, generation is allowed, and budget/latency permit it.
- **Graphic:** the meaning is a quantity, relationship, sequence, exact label, or grounded comparison.
- **Supplied asset:** the meaning depends on the actual product, person, document, or location.

The shipped `starters/video-chat/providers/video.ts` already adds a common look, framing, duration, and no-text constraints. It also asks for both a locked-off shot and a slow camera move; remove that contradiction. Extend this into a shot brief with subject, action, camera, duration, aspect ratio, visual style, subject placement, continuity references, and any reserved overlay area. Do not bake readable labels or numerical claims into generated pixels. Check the result before treating requested composition as achieved. Camera/framing are supported prompt concepts, not guarantees ([Veo guide](https://deepmind.google/models/veo/prompt-guide/)).

Begin with at most one newly generated video clip per short automatic response as a proposed cost/latency policy, not a universal SDK hard limit. Keep the host in control. Do not call generation just because a configured provider exists. Generate later beats concurrently within a bounded queue, keep the first useful response asset-free or cached, and preserve existing deadlines and cancellation. A clip that is too late must not stall an otherwise complete answer indefinitely.

Never substitute a still when the entire claim depends on seeing motion without replanning the accompanying scene/narration. Decide the fallback before emitting immutable content.

## Combining formats and detecting busy footage

One dominant visual per scene. Complex chart/diagram + moving footage is disallowed by default. A photo/video can carry a short label or headline only when the composition supports it. Frame occupancy, movement, existing lettering, and contrast are distinct checks; there is no single useful universal busy score.

Plan known graphic density first. A complex diagram gets a quiet canvas without asking a model whether some unrelated clip could fit behind it. For a media scene, choose an asset/crop that leaves the caption and optional label area clear. If the subject crosses that area later, remove/move the optional label, use a stable separated caption region, or choose another asset. A scrim fixes contrast, not conflicting action.

Do not automatically add Ken Burns to photos or extra camera movement to footage. Default to stillness. Make one authored move only when it guides attention to the subject.

## Settings and planner contract

Current `templates` and `full` modes tie visual vocabulary to media strategy. The target is an automatic editorial default with independent host policies:

- Sources permitted: supplied, stock, AI image, AI video.
- Generation budget/deadline and optional human-approved media collection.
- Visual direction: restrained by default; coherent cinematic or expressive alternatives when requested.
- Accessibility: voice, subtitles, reduced motion, readable transcript.

Names here describe the intended product behavior, not new implemented TypeScript properties. Preserve existing clients while proposing the new contract. Do not remove mode values or change persisted-video schemas without explicit approval.

Planner changes:

1. Choose the fact/idea, visual job, and compact visible payload before choosing a template or source.
2. Include catalogue avoidance guidance and information-density constraints.
3. Remove encouragement to decorate every concrete scene with media.
4. Remove compulsory per-scene template diversity.
5. Make narration, subtitles, and visuals complementary, while preserving factual units and qualifiers.
6. Allow a concise explanatory ending without a marketing arc or compulsory celebration.
7. Select a coherent fallback before external media resolves; validate the final scene against that choice.

## Delivery sequence

| Phase | Work | Acceptance |
| --- | --- | --- |
| 1 — Reference, this PR | Redesign existing bar chart; create plan and a reviewable portrait/landscape comparison | Actual installed-package render, exact values, safe bounds, long hold, light/dark, no distracting effects |
| 2 — Stock trust | Structured media intent, bounded selection/assessment, explicit no-match outcomes, provenance and semantic fallback | Wrong subject/action fixtures rejected; unknown metadata not treated as verification; no regression in deadline/cancellation; no unapproved billable calls |
| 3 — Editorial default | Planner selection rules, catalogue avoidance, low-copy policy, conclusion behavior | Held-out inputs choose formats for meaning; no forced mixture, no duplicate spoken paragraphs |
| 4 — Shared composition | Measured subtitle/control safe area, flat default grounds, consistent type/motion across metric/sequence/product/media | No caption collisions in real chat at narrow/wide sizes; accessible contrast and reduced-motion behavior |
| 5 — Broader explanation | Trend and relationship diagrams, then true image comparison and verified maps | Every visible relationship/value backed by input; understandable at phone size |
| 6 — Generated shots | Shot compiler, continuity, quality assessment, capped concurrency/budget and intentional fallbacks | Original action earns generation; replay uses frozen assets; costs and latency recorded |
| 7 — Vocabulary cleanup | Move expressive/social formats out of automatic defaults, remove unused/dead internals where safe | Reviewed public-contract changes; installed consumer, saved replay, and starter parity |

Each phase gets a focused branch, tests, packed consumer verification, PR, and CI. Stop at the merge decision. Do not change every template at once or ship visual hypotheses directly to production.

## Reference comparison brief and acceptance

Existing ID: `barChart`. Job: grounded quantity comparison. Contract remains `texts` and 2–6 nonnegative labeled values. Reference fixture: topic `Activation (%)`, labels `Before` and `After`, values `41` and `58`. Voice: `Activation rose from 41 to 58 percent after guided onboarding.` No causal claim stronger than the supplied source; no computed uplift badge.

Composition: two horizontal bars share a zero baseline and scale. Exact values and short labels remain readable. A small topic identifies the unit. No card border, emoji, explanatory paragraph, glow, or animated numerical counter. No automatic green/red judgment. A single brand accent supports the relationship.

Motion: a short monotonic ease reveals proportional bars together; no spring overshoot or beat scaling. Labels expose exact final values rather than interpolated measurements. Hold through most of the scene. Seek deterministically. At terminal progress, preserve the actual values and clean visual state; any renderer-owned transition must not corrupt data.

Verification:

- Two, three, and six values; zero/all-zero; decimal values; maximum allowed label/topic lengths; very large/small finite values.
- Portrait 1080×1920 and landscape 1920×1080, plus actual 360–390px phone display and desktop display.
- Minimum and preferred durations; progress 0, .2, .25, .6, .7, .85, and 1; incoming/outgoing overlap where applicable.
- Light and dark solid brands; explicit gradient/media compatibility; subtitle region; reduced motion and keyboard controls in the review harness.
- Exact text/values; proportional nonnegative bars with no minimum-length distortion; no overflow/collisions; no console/page failures.
- Canonical source plus generated registry parity; build/lint/types/tests; strict fresh installed-package consumer and public API checks.

## How we judge the larger change

Use a fixed initial review set covering customer metrics, product onboarding, a place-based itinerary, an abstract process, and an imaginary story. Include adversarial stock cases: wrong animal with right action, wrong place with generic matching nouns, numeric-only asset metadata, irrelevant beautiful footage, and an empty result.

Compare the current output, the restrained graphics default, and automatically composed mixed media with the same source facts and narration. Review without knowing which implementation produced each result. Ask viewers to identify the main point and judge relevance/readability/coherence. Record time to useful first frame, stalls, media rejections, generation spend, and completion rate.

Release gates: zero known factual-substitution errors or caption collisions in the acceptance set; all exact data tests pass; latency/cost stay within host limits; human review prefers or matches the new treatment on comprehension and relevance. These are proposed gates, not measured outcomes or proof that every future asset will be correct.
