# Video chat interface design

The current public interface is documented in
[Immersive video chat](../immersive-interface.md). Its
[interactive component reference](../reference/design-system.html) links the
shipped `styles/video-chat.css` directly and uses the
`.vanillasky-video-chat` root.

Keep the reference's component markup aligned with `src/video-chat/video-chat.tsx`.
Reference-only CSS may arrange components in a scrolling documentation page;
component appearance belongs in the shipped stylesheet. Do not introduce a
second appearance palette, copied example styles or an independently themed
reference.

Preserve the conversation lifecycle in `useVideoChat`: editing pauses playback,
canceling restores the previous state, and late microphone/transcription work
cannot overwrite a newer draft. Verify subtitle arrival, reveal/hide behavior,
long cues, transcript access, keyboard focus, reduced motion, mobile safe areas
and adaptive stage sizing against the installed package.
