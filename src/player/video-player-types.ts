import type { CSSProperties } from "react";
import type { VideoEvent } from "../protocol/events.js";
import type { VideoState } from "../protocol/state.js";
import type { Video, VideoOrientation, VideoScene } from "../protocol/types.js";
import type { TemplateRegistry } from "../visual-system/catalog/kit.js";
import type { PlayerTemplateRegistry } from "../visual-system/catalog/player-kit.js";
import type { VideoPlaybackMode } from "./playback-policy.js";

export interface NativeMediaAudioOptions {
  /** Volume of the active scene video's embedded audio, from 0 to 1. */
  volume?: number;
}

interface VideoPlayerSharedProps {
  /** High-level startup policy. When set, this overrides autoPlay and startMuted. */
  playbackMode?: VideoPlaybackMode;
  /** Initial playback state. Reduced-motion preferences take precedence. */
  autoPlay?: boolean;
  startMuted?: boolean;
  /** Play embedded audio from active scene videos as a layer beneath the master mute control. */
  nativeMediaAudio?: NativeMediaAudioOptions;
  /** Fixed display width. Omit to observe and fill the parent width. */
  width?: number;
  /** Override the streamed orientation, or switch at the container breakpoint. */
  orientation?: VideoOrientation | "auto";
  /** Container width at or below which auto orientation uses portrait. */
  responsiveBreakpoint?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name for the player region. */
  ariaLabel?: string;
  /**
   * Show the player's own controls: play, mute, fullscreen, and the replay
   * offered when the video ends. Default true.
   *
   * Turn them off where the host drives playback itself and a second set of
   * controls would contradict it - a narrated answer whose voice and picture
   * are one thing, where pausing the picture alone desynchronises them, and
   * where a replay scrim would cover the answer the moment it finished.
   */
  controls?: boolean;
  /** Repeat the saved video and its soundtrack instead of showing the replay affordance. */
  loop?: boolean;
  onComplete?: (video: Video) => void;
  onError?: (error: Error) => void;
  /** Fires when the scene under the playhead changes, including on a loop wrap. */
  onSceneChange?: (scene: VideoScene, index: number) => void;
}

export type VideoPlayerProps = VideoPlayerSharedProps & (
  | { video: Video; stream?: never; templates?: TemplateRegistry }
  | { stream?: AsyncIterable<VideoEvent>; video?: never; templates?: TemplateRegistry }
);

export interface VideoPlayerRuntimeProps extends Omit<VideoPlayerSharedProps, "onComplete" | "onError"> {
  kit: PlayerTemplateRegistry;
  stream?: AsyncIterable<VideoEvent>;
  video?: Video;
  onComplete?: (state: VideoState) => void;
  onError?: (error: Error, state: VideoState) => void;
  onStateChange?: (state: VideoState) => void;
}
