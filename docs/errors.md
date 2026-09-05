[← Documentation home](../README.md) · [Previous: Security](security.md) · [Next: Production →](production.md)

# Errors and recovery

`VideoChat` preserves the opening and accepted scenes when an optional scene,
provider, or stream fails. It shows concise non-fatal status notices and keeps
the answer playable. A fatal error is shown only when no playable response can
be produced. Never put provider details or stack traces in the interface.

## Recovery by boundary

| Failure | Result |
| --- | --- |
| Invalid planner scene | Skip the part and accept later valid scenes |
| Generated footage | Try stock media, then a safe template |
| Stock lookup or candidate | Continue with another candidate or template |
| Template renderer | Isolate the failed scene with a safe visual |
| Missing narration | Continue with scene text |
| Generated speech | Use browser voice |
| Late stream failure | Keep playable opening and completed scenes |
| Unauthorized or invalid request without playable output | Show a safe error |

For a custom interface, render `chat.warnings` as status messages and
`chat.error` as an error. Notices are also retained on the corresponding
`VideoChatTurn.warnings`. Keep `chat.playerProps` mounted while showing notices.
Check `turn.completed` before persisting it as completed conversation context;
a cancelled or partial visible turn is not automatically a completed turn.

`VideoError` exposes actionable public fields: `code`, `message`, optional HTTP
`status`, `requestId`, `runId`, and `recoverable`. Log only safe codes and IDs
from the client. The server's `onError` observer receives internal diagnostics;
redact credentials, source data, provider payloads, and signed URLs before logging.
Observer failures are isolated from response generation.

## Cancellation and retries

`chat.cancel()` cancels the current work while preserving available output.
Replacing a prompt aborts its old providers and speech. The host must forward
`signal` to every provider callback and own deadlines, quotas, and retry budgets.
The chat retries once only before playback. Never silently restart generation
after the viewer has begun watching, and do not replay paid generation requests
without a deliberate idempotency and spend policy.

The server drops invalid generated parts by default. `invalidPartBehavior: "fail"`
is an explicit strict policy; ordinary chat should retain the resilient default.
`onComplete` runs after a `response.complete`, including a recovered playable
response. Fatal errors, disconnects, and explicit aborts do not call it.

Automated regression and acceptance tests use mocked providers. See
[Testing](testing.md) and the [chat acceptance gate](https://github.com/VanillaSkyAi/video/blob/main/docs/maintainers/acceptance.md).

## Slow optional providers

Generated video has a 15-second deadline per lookup. Stock media, generated
speech preparation, and fallback scene narration have 3-second deadlines.
A deadline uses the same safe fallback as a failed provider; completed scenes
and scene order are preserved. Providers receive cancellation, and late results
are ignored even when a provider does not cooperate. These initial limits bound
waiting; they are not claims about measured live-provider performance.

A completed turn and its saved video are available before follow-up suggestions.
Suggestions load separately and may be omitted after a short deadline. Starting
another turn or cancelling discards outstanding suggestions.
