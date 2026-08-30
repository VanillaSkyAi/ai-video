export type VideoPlaybackMode =
  | "manual"
  | "muted-autoplay"
  | "autoplay-with-sound"
  | "autoplay-after-interaction";

interface PlaybackPolicyInput {
  playbackMode?: VideoPlaybackMode;
  autoPlay: boolean;
  startMuted: boolean;
  audioUnlocked: boolean;
  reducedMotion: boolean;
  hasStream: boolean;
}

interface PlaybackPolicy {
  resolvedStartMuted: boolean;
  shouldAutoPlay: boolean;
  autoStartGeneration: boolean;
}

export function resolvePlaybackPolicy({
  playbackMode,
  autoPlay,
  startMuted,
  audioUnlocked,
  reducedMotion,
  hasStream,
}: PlaybackPolicyInput): PlaybackPolicy {
  const resolvedStartMuted = playbackMode === "muted-autoplay"
    ? true
    : playbackMode
      ? false
      : startMuted;
  const shouldAutoPlay = playbackMode === "manual"
    ? false
    : playbackMode === "autoplay-after-interaction"
      ? audioUnlocked
      : playbackMode === "muted-autoplay" || playbackMode === "autoplay-with-sound"
        ? true
        : autoPlay;

  return {
    resolvedStartMuted,
    shouldAutoPlay,
    autoStartGeneration: Boolean(playbackMode && hasStream && shouldAutoPlay && !reducedMotion),
  };
}
