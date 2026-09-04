# The video chat's design system

One page, one video, and as little else as possible. Everything here exists so
that an application adopting this experience can restyle it by overriding the
custom properties scoped under `.vanillasky-video-chat` in
`styles/video-chat.css` — no Tailwind config, component library, or CSS build
step.

## The one rule

**The video is the only saturated thing on the page.** The chrome is mixed from
near-neutral violets and carries colour only where colour means something: the
send action, the voice waveform, a focus ring, a selected row. A control that
is merely present is grey. This is why the send button is a flat fill rather
than a gradient with a glow — a gradient there competes with the picture two
inches above it.

## Type

System faces only: SF where it exists, then Helvetica Neue, then Helvetica.
Nothing to download, nothing to license, and the chrome renders in whatever the
reader's machine already draws its own interface in. All three share a grotesque
skeleton, so the tracking below holds across the stack rather than being tuned
for one face. The video keeps its own webfont — scenes must render identically
for every viewer, where the chrome only has to look right where it is read.

Nine steps, each carrying its own leading and tracking, because that is what
makes a scale a system rather than a list of sizes:

| Step | Size | Leading | Tracking | Where |
| --- | --- | --- | --- | --- |
| `caption` | 12 | 1.33 | 0 | History index, notes |
| `footnote` | 13 | 1.38 | −0.006em | Chips, session pill, section labels |
| `subhead` | 15 | 1.33 | −0.015em | Option descriptions |
| `body` | 17 | 1.47 | −0.022em | Subtitle line, composer, sheet |
| `headline` | 17 | 1.29 | −0.025em | Titles, option labels (600) |
| `title3` | 20 | 1.25 | −0.019em | Sheet title |
| `display` | 28→44 | 1.05 | −0.03em | The prompt on the gradient |

Three things to know about it. **Body is 17px, not 16** — Apple's own default
for a reading distance, and the single change that most affects how the subtitle
line reads.

**The tracking is not a slope.** It comes from the tracking table in Apple's
typography guidance, and that curve is not monotonic: SF tightens to about
−26/1000em around 17–20pt, then opens back up, crossing zero near 23pt and
reaching +14/1000em by 28. So the display step is tracked *wider* than body, not
tighter. The rule of thumb that large type wants tightening is true up to about
20px and wrong above it.

And **nothing is uppercase.** Section labels are sentence case at 13px semibold, which is what
macOS System Settings actually does; uppercase with wide tracking is a
design-system habit rather than a system one, and eight of them down a popover
reads as filing rather than as an interface.

## Colour

Two accents, split by meaning rather than by taste. **Blue is what the viewer
can act on** — send, focus, selection — which is the convention every system
reader already knows. **Pink is the video chat's own voice**, and appears only while
it is speaking or listening. One accent for you, one for it.

Focus is its own colour, because it has one job: to be found. On the light page
the blue is the clearest thing available at 4.53:1; on the dark violet ground
blue sits close to the ground in hue and falls to 4.05:1 against the composer,
where the pink separates at 5.45:1. So focus is blue in light and pink in dark —
following legibility rather than following the action colour.

The blue is `#0079C4` — deep enough that a **white** glyph sits on it at 4.63:1,
where the brand blue itself is 2.68:1 under white and fails even the bar for an
icon. One blue serves both themes: 4.53:1 against the light page, 4.39:1 against
the dark one.

Three states, because that is what a theme actually is: the light palette on
the component root, `prefers-color-scheme: dark` for the OS preference, and
the root's `[data-theme]` winning over both. The dark block is guarded against
`[data-theme="light"]` so a viewer who chooses light on a dark OS gets light.

The neutrals come from the brand's own ink rather than from a neutral grey.
The dark page sits *below* `#10073C` at `#050121`, so the ink itself becomes the
surface a control rests on and the page recedes behind it; the surfaces ramp up
from there through `#1C184B` and `#272657`. The light theme is mixed from the
same hue at very low chroma, so the two themes are one palette at two ends
rather than two palettes.

Contrast ratio is the wrong instrument at this end of the scale — two
near-blacks always compute close — so the ramp is spaced by lightness in oklch
instead, about 0.06 a step, which is what makes a control read against the page.

What is deliberately **not** themed is the video. Its palette is the brand the
response was composed in and it is baked into the scenes, so a response that changed
colour with the OS setting would be a different response. Light mode is a chrome
concern, which is what keeps it small.

The surfaces are a scale — `raised`, `hover`, `selected`, `pop` — so a control
resting on the page, a control under the pointer and a floating panel are three
defined steps rather than three hand-mixed translucent whites.

## Measurements

Controls are 44px, which is Apple's iOS minimum; their macOS minimum is 28×28pt
and the WCAG 2.2 AA floor is 24px, so this is the generous end of all three.
Chips are 36 — secondary, and several sit in a row. Controls are 12px apart,
which is Apple's recommended padding around a bezelled element.

The bottom bar runs on an 8px grid: one step from the divider to the field, one
step between the field and the chips, and two at the bottom — because that edge
is the window rather than a neighbour, and a control resting on the frame reads
as unfinished. Apple's content margins sit at 16 on a phone and 20 on a desktop,
and the bar's bottom follows them.

Radii come in three: 14px for a row inside a panel, 20px for a panel or the
composer, and a pill for anything round. The stage is 20px.

## Increase Contrast

Apple's rule is that an interface which does not meet the minimum contrast by
default must at least offer more when the system setting asks for it. Ours meets
it, so `prefers-contrast: more` is the second half of that rule: someone who has
asked every app on their machine for more contrast gets more here too, rather
than the minimum. Borders become visible lines, muted type stops being muted,
and the accent deepens far enough to carry white at 7:1 — measured at 10.6:1 for
secondary type in light and 14.1:1 in dark.

## The quality floor

Not features, and not announced in the UI: light and dark both above 4.5:1 for
text and 3:1 for icons, one `:focus-visible` ring declared once for everything,
Escape and outside-click on every popover, a real focus trap and focus return
on the sheet, `prefers-reduced-motion` handled in one block, and no control that
is visible but dead — the microphone is drawn only where the browser can
actually hear.
