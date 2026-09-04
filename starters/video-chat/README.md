# Video chat starter

Prompt for an explanation, a story, a recommendation, a creative idea, or
anything else you would ask an AI chat. The response arrives as a narrated
video: scenes stream in as they are planned and the voice stays with the
picture.

<!-- verify:start -->
```bash
npm install
cp .env.example .env.local
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

1. The SDK's `/api/video-chat` endpoint plans five visual beats and resolves optional media.
2. Its narration action writes one spoken line for each scene as it arrives.
3. The browser prepares the line before placing its scene on the timeline.
4. `getSceneDuration` holds the scene for the measured or estimated speech time.
5. Its suggestions action prepares four possible next prompts while playback continues.

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
or `FAL_VIDEO_MODEL` when needed.
