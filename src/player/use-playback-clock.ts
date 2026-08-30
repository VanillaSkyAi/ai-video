import { useEffect } from "react";
import type { VideoScene } from "../protocol/types.js";
import type { VideoState } from "../protocol/state.js";
import { getVideoDuration, resolveVideoTimeline } from "../protocol/timeline.js";

interface PlaybackClockOptions {
  isPlaying: boolean;
  stateRef: { current: VideoState };
  timeRef: { current: number };
  audioRef: { current: HTMLAudioElement | null };
  loopRef: { current: boolean };
  sceneIndexRef: { current: number };
  callbacksRef: {
    current: {
      onSceneChange?: (scene: VideoScene, index: number) => void;
    };
  };
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

export function usePlaybackClock({
  isPlaying,
  stateRef,
  timeRef,
  audioRef,
  loopRef,
  sceneIndexRef,
  callbacksRef,
  setCurrentTime,
  setIsPlaying,
}: PlaybackClockOptions): void {
  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const current = stateRef.current;
      const config = current.config;
      const delta = Math.max(0, (now - previous) / 1000);
      previous = now;
      const settled = current.status === "complete" || current.status === "error" || current.status === "aborted";
      const looping = loopRef.current && settled;
      let wrapped = false;
      if (config?.scenes.length) {
        const duration = getVideoDuration(config);
        const raw = timeRef.current + delta;
        let nextTime: number;
        if (looping && duration > 0 && raw >= duration) {
          nextTime = raw % duration;
          wrapped = true;
        } else {
          nextTime = Math.min(raw, duration);
        }
        if (nextTime !== timeRef.current) {
          timeRef.current = nextTime;
          setCurrentTime(nextTime);
        }
        const audio = audioRef.current;
        if (audio && (current.status === "complete" || current.status === "error")) {
          if (wrapped) {
            audio.currentTime = 0;
            if (audio.paused) void audio.play().catch(Boolean);
          }
          const fadeSeconds = Math.max(0, (config.audio?.fadeOutMs ?? 3000) / 1000);
          const remaining = Math.max(0, duration - nextTime);
          const baseVolume = config.audio?.volume ?? 1;
          audio.volume = fadeSeconds > 0
            ? baseVolume * Math.min(1, remaining / fadeSeconds)
            : baseVolume;
          if (remaining <= 0 && !looping) audio.pause();
        }
        const notify = callbacksRef.current.onSceneChange;
        if (notify) {
          if (wrapped) sceneIndexRef.current = -1;
          const ranges = resolveVideoTimeline(config);
          const index = ranges.findIndex((range) => nextTime >= range.start && nextTime < range.end);
          const resolved = index === -1 && nextTime >= duration ? ranges.length - 1 : index;
          if (resolved !== -1 && resolved !== sceneIndexRef.current) {
            sceneIndexRef.current = resolved;
            notify(ranges[resolved].scene, resolved);
          }
        }
      }
      const duration = current.config ? getVideoDuration(current.config) : 0;
      if (!settled || looping || timeRef.current < duration) frame = requestAnimationFrame(tick);
      else setIsPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);
}
