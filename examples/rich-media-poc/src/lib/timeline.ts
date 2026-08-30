export interface DelayedFrame {
  delayMs: number;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

function safeDelay(delayMs: number): number {
  return Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 100;
}

/** Select a GIF frame using its authored variable frame delays. */
export function selectGifFrame(
  frames: readonly DelayedFrame[],
  progress: number,
): number {
  if (frames.length === 0) return 0;
  const clamped = clampProgress(progress);
  if (clamped === 1) return frames.length - 1;

  const durationMs = frames.reduce((total, frame) => total + safeDelay(frame.delayMs), 0);
  const playheadMs = clamped * durationMs;
  let elapsedMs = 0;

  for (let index = 0; index < frames.length; index += 1) {
    elapsedMs += safeDelay(frames[index].delayMs);
    if (playheadMs < elapsedMs) return index;
  }

  return frames.length - 1;
}

/** Convert scene progress to a seek-safe Lottie frame. */
export function lottieFrameAtProgress(progress: number, totalFrames: number): number {
  if (!Number.isFinite(totalFrames) || totalFrames <= 1) return 0;
  return clampProgress(progress) * (totalFrames - 1);
}
