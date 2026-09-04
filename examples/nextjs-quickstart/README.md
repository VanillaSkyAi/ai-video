# Next.js one-shot example

This lower-level, one-shot example has one server route, one React page, and the
built-in templates. Use `vanillasky init` for the primary voice-and-video chat
experience.

<!-- verify:start -->
```bash
npm install
cp .env.example .env.local
npm run build
npm run dev
```
<!-- verify:end -->

Before selecting **Generate video**, add your Anthropic API key and replace the
model placeholder with a current Claude Sonnet model ID available to your
account. Provider and model selection happen here, after SDK installation, so
VanillaSky never silently chooses either one.

Open <http://localhost:3000> and select **Generate video**.

The packaged development command supplies a non-secret marker only to
`next dev`, so the example authorizes local development and denies production
requests.
Replace the local-only authorization before deploying. See the
[Next.js guide](../../docs/integrate-nextjs.md) for production and optional
configuration.
