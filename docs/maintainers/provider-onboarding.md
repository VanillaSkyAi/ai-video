# Provider onboarding verification

`npm run verify:nextjs` installs the exact candidate tarball into isolated
Next.js consumers. The fixture uses `VideoChat`, `createVideoChatHandler`, and a
project-owned `activationLift` template with matching browser/server registries.
It is a maintainer compatibility fixture; the generated starter remains the
public onboarding path.

## Provider boundaries

A server-only module selects OpenAI or Anthropic through the application-owned
AI SDK adapters. Deterministic verification replaces the external adapters with
AI SDK test models, builds each configuration, checks fail-closed production
authorization, and submits a prompt through the unchanged chat interface.
Distinct fake credentials and model sentinels prove the selected adapter is
used without leaking provider data into SSE, the DOM, or browser bundles.
Server observers verify normalized usage, warnings, and completion metadata.

Additional isolated consumers exercise Google and OpenRouter provider factories
with injected local fetch responses. They validate native stream parsing without
provider network requests. Provider SDKs belong to the consumers, never to the
published VanillaSky runtime.

## Evidence and scope

Retain the candidate commit, tarball integrity, command output, provider
configuration, and browser result together. Setup-time measurements are
machine-readable and environment-sensitive; do not present an old fixture run
as evidence for a new artifact.

`npm run verify:onboarding` exercises the actual blank-folder starter.
`npm run acceptance:chat` checks deterministic conversation quality and recovery;
see [Acceptance](acceptance.md). Automated checks must not read real provider
credentials or spend generation credits. A final manual localhost test may use
only the capabilities and spend explicitly authorized by the maintainer.

Applications still own model selection, credentials, authentication, limits,
media policy, and persistence of completed turns. Saved JSON replay is tested
at the storage/player boundary rather than by replacing the default chat UI.
