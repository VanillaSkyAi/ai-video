# Internal Next.js video-chat fixture

This internal fixture proves that `createVideoChatHandler` and `VideoChat` work
with supported AI SDK providers in a production Next.js build. The public setup
path is `npx @vanillaskyai/video init`; this directory is intentionally not an
example.

<!-- verify:start -->
```bash
npm install
cp .env.example .env.local
npm run build
npm run dev
```
<!-- verify:end -->

Before asking a question, replace `replace-me` in `.env.local` with an OpenAI
API key. The default configuration is:

```bash
VIDEO_PROVIDER=openai
VIDEO_MODEL=gpt-4.1
```

To switch to Anthropic, change only the server configuration and add the key:

```bash
VIDEO_PROVIDER=anthropic
VIDEO_MODEL=your-available-claude-model
ANTHROPIC_API_KEY=your-key
```

The video-chat route and React component do not change. Both adapters use the
Vercel AI SDK, and provider selection stays in server-only code.

The route deliberately authorizes only `localhost` and `127.0.0.1` while the
development command's local marker is present. This makes local development
explicit without turning the sample into an unauthenticated production
endpoint. Replace `authorize`
with your application's real session check before deploying; production
requests are denied until you do.

CI copies this fixture, installs the exact packed SDK candidate, injects
deterministic models, asks the chat a question, and verifies streaming,
server-only usage, custom-template rendering, safe failures, and production
authorization without calling a live provider.
