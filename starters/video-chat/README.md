# Video chat starter

Prompt for an explanation, a story, a recommendation, a creative idea, or
anything else you would ask an AI chat. The response arrives as a narrated
video: scenes stream in as they are planned and the voice stays with the
picture.

<!-- verify:start -->
```bash
npm install
npm run build
npm run dev
```
<!-- verify:end -->

Add one required key to `.env.local`:

```bash
ANTHROPIC_API_KEY=...
```

That is enough for rendered templates and the browser's built-in voice. The
optional keys progressively improve the same experience:

- `XAI_API_KEY` replaces the browser voice with generated speech.
- `FAL_KEY` enables generated-video modes and server transcription.
- `PEXELS_API_KEY` adds stock footage to rendered responses and suggestion cards.

Restart the development server after changing keys. Open
<http://localhost:5173> and prompt anything.

## How a response is made

1. A fast text model writes one short spoken hook and a stock-footage keyword.
2. A clicked welcome or follow-up card reuses its loaded footage immediately;
   a typed prompt resolves the hook keyword through the optional stock provider.
3. The SDK speaks that hook while the main model plans five visual beats.
4. The opening footage loops or holds until the first planned scene and its
   voice are ready, then the response timeline takes over without a blank gap.
5. The SDK holds every planned scene for its measured or estimated speech time
   and prepares four possible next prompts while playback continues.

The text model is the only required provider. Generated speech, transcription,
stock media, and generated video are independent upgrades and never prevent a
template response from completing.

## Visual modes

The templates mode is always available. Generated modes appear only when a
video provider is configured.

| Mode | Generated scenes | Cost profile |
| --- | ---: | --- |
| Templates only | 0 | Rendered locally |
| Some AI video | 1 | One generated clip |
| Full AI video | 5 | Every beat generated |

The provider names its own model. Override the tested defaults with
`ANTHROPIC_PLANNER_MODEL`, `ANTHROPIC_NARRATION_MODEL`, `ANTHROPIC_OPENING_MODEL`,
or `FAL_VIDEO_MODEL` when needed. The opening defaults to Haiku so this first
hook stays off the critical path as much as possible.
