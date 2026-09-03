# The tutor's design system

One page, one video, and as little else as possible. Everything here exists so
that an application adopting this experience can restyle it by overriding a
handful of custom properties in `tokens.css` — no Tailwind config, no component
library, no build step.

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
| `caption2` | 11 | 1.18 | +0.09em | Section labels, uppercase |
| `caption` | 12 | 1.33 | 0 | History index, notes |
| `footnote` | 13 | 1.38 | −0.006em | Chips, session pill |
| `subhead` | 15 | 1.33 | −0.015em | Option descriptions |
| `body` | 17 | 1.47 | −0.022em | Subtitle line, composer, sheet |
| `headline` | 17 | 1.29 | −0.025em | Titles, option labels (600) |
| `title3` | 20 | 1.25 | −0.019em | Sheet title |
| `display` | 28→44 | 1.05 | −0.03em | The question on the gradient |

Two things to know about it. **Body is 17px, not 16** — the single change that
most affects how the subtitle line reads at arm's length. And **tracking
tightens as size grows**, which is what keeps a large question from reading
loose; the one exception is `caption2`, tracked wide on purpose as a
counterpoint to the display step. Tight where it is large, open where it is
small, is the system's own signature rather than a borrowed one.

## Colour

Three states, because that is what a theme actually is: the light palette on
bare `:root`, `prefers-color-scheme: dark` for the OS preference, and
`[data-theme]` winning over both. The dark block is guarded against
`[data-theme="light"]` so a viewer who chooses light on a dark OS gets light.

The neutrals are violet-tinted rather than cool grey — every surface is mixed
from hue 300, the same hue the lesson is composed in, so the chrome and the
picture belong to one palette.

What is deliberately **not** themed is the video. Its palette is the brand the
lesson was composed in and it is baked into the scenes, so a lesson that changed
colour with the OS setting would be a different lesson. Light mode is a chrome
concern, which is what keeps it small.

The surfaces are a scale — `raised`, `hover`, `selected`, `pop` — so a control
resting on the page, a control under the pointer and a floating panel are three
defined steps rather than three hand-mixed translucent whites.

## Measurements

Controls are 44px. The WCAG 2.2 AA floor is 24px and everything clears it, but
44 is the size a thumb actually wants, and two controls in one group at
different heights read as an accident. Chips are 36 — they are secondary, and
several sit in a row.

Radii come in three: 14px for a row inside a panel, 20px for a panel or the
composer, and a pill for anything round. The stage is 20px.

## The quality floor

Not features, and not announced in the UI: light and dark both above 4.5:1 for
text and 3:1 for icons, one `:focus-visible` ring declared once for everything,
Escape and outside-click on every popover, a real focus trap and focus return
on the sheet, `prefers-reduced-motion` handled in one block, and no control that
is visible but dead — the microphone is drawn only where the browser can
actually hear.
