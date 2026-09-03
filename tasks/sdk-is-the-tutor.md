# Make the SDK about this one experience

The tutor redesign is merged (`d1409d1`, PR #26, 28 commits). This is the next
job: stop presenting VanillaSky as a general "video response layer" with four
imagined use cases, and present it as **the thing that makes this** — an
assistant that answers with video. The tutor becomes the product's front door,
the site's homepage, and its only playground.

Read `examples/ai-tutor/src/DESIGN.md` first. It is the design system the
experience is built on and the vocabulary the rest of this depends on.

## The decision, and what it does not mean

Settled by the repository owner:

- The tutor experience is what the SDK is *for*. The README, the site homepage
  and the playground all lead with it.
- The site's **live playground and its use-case pages go**. The tutor becomes
  the playground, front and centre on the homepage.
- Templates are kept only where they support this use case.

What it explicitly does **not** mean, and this distinction matters because it is
where the work goes wrong if rushed:

**Narrow the story, not the capability surface.** The tutor *is* the general SDK
under load — streaming, custom templates, media resolution, narration, paced
scenes, replay from JSON, per-device orientation. There is no smaller SDK hiding
inside it. Deleting capability to match a narrower story would break the very
thing being promoted.

Live channels is the test case for this. It reads like something to cut, and it
is 149 lines of `docs/live-channels.md` plus one `loop` prop — **there is no
channel code in `src/` at all**. Cutting it removes a page and simplifies
nothing. Cut the *page* if the story is cleaner without it; do not go looking
for code to delete.

## What is actually clutter

Measured, not guessed.

**The abstract framing.** `docs/use-cases.md` (59 lines) is four hypothetical
snippets — news summary, contextual help, personalized briefing, dynamic page
content. Nobody has built them. They are what makes the repo read as a library
looking for a purpose. The README's "video response layer" opener is the same
problem in the first paragraph.

**Four examples where two would do.** Six exist:

| Example | What it is |
| --- | --- |
| `ai-tutor` | The real thing. Does not currently ship in the npm package. |
| `nextjs-quickstart` | The install path. Ships. |
| `react-vite` | Overlaps `nextjs-quickstart`; both exist to show install. |
| `custom-template` | 278 lines, ships, referenced by docs. |
| `rich-media-poc` | A separate adaptive-channel experiment. |
| `server-integrations` | Ships one file (`src/ai-sdk-media.ts`). |

`package.json` `files` ships `custom-template`, parts of `nextjs-quickstart`,
and one file from `server-integrations`. **It does not ship `ai-tutor`.** That
is the first thing to decide: how does someone get this experience?

## The part worth getting right: what moves into the SDK

Do not ship the tutor's chrome as SDK code. The composer, the sheet, the gear
popover are an example, and they should stay one.

What *should* move is the mechanism every consumer of this shape will otherwise
rebuild badly, and get wrong the same way:

- **`pacedScene`** (`examples/ai-tutor/src/main.tsx`) — hold a scene for the
  *measured* length of its generated audio, and strip the planner's
  `startTime`/`endTime`, which otherwise beat `fixedDuration` in
  `resolveVideoTimeline` and cut the voice off mid-sentence. This bug cost a
  session before it was understood.
- **The cue binding** — the subtitle is driven by the player's own
  `onSceneChange` and by nothing else. No timer anywhere.
- Possibly **the ordered flush with a one-scene lead** in `ask()`: scenes finish
  out of order, are held by position, and are appended only as an unbroken run
  from the front.

These are general, subtle, and load-bearing. The chrome is not.

## Templates

The tutor renders 7: `barChart`, `bigNumber`, `cardList`, `media`, `milestone`,
`steps`, `tripleStats`. The registry ships **33 items** (`registry/items/`),
including `chatWhatsapp`, `incomingCall`, `phoneMockup`, `reviewStack`,
`terminal`, `tweet`, `webMockup` — a promo/social vocabulary that has nothing to
do with explaining something to someone.

Two open questions for the owner, both real:

1. **Does the registry shrink, or does the tutor's catalogue just get curated?**
   Narrowing what the planner may choose is a per-request capability
   (`capabilities.templates`) and costs nothing. Deleting registry items is a
   consumer-visible break.
2. **Seven is thin for a five-scene lesson**, and only two can close. This is
   already why shapes repeat within a lesson — see the old handover. Adding two
   or three explainer-shaped templates is probably worth more than any other
   work on this list.

## The site (`~/vanillasky-site`)

Read its `CLAUDE.md` first; that repo's rules are canonical for it.

Routes today, from `src/App.tsx`:

```
/                        Home
/playground/sdk          Playground
/playground/live         Live            ← to go
/playground/live/templates LiveTemplates ← to go
/playground/prompt       PromptPlayground
/playground              Playground
/styleguide, /docs
/playground/tutor        DEV ONLY — the tutor already runs here
/playground/director     DEV ONLY
```

`/playground/tutor` already exists behind `import.meta.env.DEV`. **Promoting
that to the playground, and the playground to the homepage, is the main move.**
Pages `Live.tsx`, `LiveTemplates.tsx` and probably `Broadcast.tsx`, `Audio.tsx`,
`Motion.tsx` come out with it — check what each is before deleting; some may be
QA surfaces rather than marketing pages.

The tutor needs real keys to run. A public homepage playground has a spend
problem the current site already solved once — there is a per-IP AI budget cap
in the VanillaSky app. **Whatever ships publicly needs that same protection, and
the AI-video mode almost certainly must be off by default in public** (it bills
per clip). Templates mode is free apart from the planner.

## Open bugs, carried forward

- **Filmed mode leaves ~6 seconds of silence.** Measured from the dev log: hook
  text at 1.9s, audio at 3.8s, hook ends about 13s, video opens at 19.1s. The
  spoken hook is written to cover a ~6s planner wait and covers a third of a
  filmed one. Structural, fixable, not yet fixed.
- **The opening voice sometimes does not play at all.** Unreproduced. Two
  candidates: a second question asked while the first is still filming, which
  aborts the hook by design and is visible in the log; or a browser autoplay
  refusal. Needs one clean filmed run to separate them.
- **`planning failed: Scene template text was not negotiated`** — appeared twice
  in the log, cause unknown, new.

## Traps that have already cost hours

All of these are still live.

- **Vite's restart does not reload `@vanillaskyai/video`.** Node caches the
  externalised dep for the life of the process, so any SDK change is invisible
  until a full kill and restart. A stale dev server from a previous day cost an
  hour this session: the UI hot-reloaded on top of yesterday's SDK, so a new
  prop appeared to do nothing. Check `ps` for old `vite` processes before
  believing a symptom.
- **Stub every `/api` route in a browser probe.** The dev server holds real keys.
  Where a probe must hit something, `/api/welcome` is free (Pexels search,
  cached for the process).
- **Playwright matches the last-registered route first.** A catch-all
  `**/api/**` registered after a specific route silently swallows it.
- **Contrast ratio is the wrong instrument at the dark end.** `#10073C` on
  `#050121` computes 1.08:1 while being plainly visible. Space near-blacks by
  lightness in oklch, about 0.06 a step, and check by looking.
- **A translucent fill must be composited over what is actually behind it** when
  measuring contrast, not over black — this produced a false failure this
  session.
- **Chrome returns computed colours in their own space.** `oklch` stays `oklch`,
  so regex-based colour parsing reads the wrong numbers. Paint to a 1×1 canvas
  and read the pixel.
- **`examples/ai-tutor/scripts/print-transcript.mjs`** prints a whole lesson as
  text if you need to judge content without watching one.

## How to run it

```bash
cd ~/video/examples/ai-tutor \
  && set -a && . ~/vanillasky-site/.worktrees/sdk-0.6.0/.dev.vars && set +a \
  && npm run dev -- --port 5201
```

The design system renders at `/src/design-system.html` — light and dark side by
side, loading the real `tokens.css` and `styles.css`, so it cannot drift from
the product.
