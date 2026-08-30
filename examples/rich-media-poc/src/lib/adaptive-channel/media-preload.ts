import type { ChannelSegment } from "./types";

export async function warmImage(url: string, signal: AbortSignal, timeoutMs = 3_000): Promise<void> {
  if (typeof Image === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timer = window.setTimeout(() => finish(), timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      image.onload = null;
      image.onerror = null;
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      image.src = "";
      reject(new DOMException("Channel generation was cancelled.", "AbortError"));
    };

    if (signal.aborted) {
      cancel();
      return;
    }
    image.onload = finish;
    image.onerror = finish;
    signal.addEventListener("abort", cancel, { once: true });
    image.src = url;
    if (image.complete) finish();
  });
}

export async function warmFirstFrame(segment: ChannelSegment, signal: AbortSignal): Promise<void> {
  const firstMedia = segment.scenes.find(({ media }) => media.type !== "gradient")?.media;
  const url = firstMedia?.type === "video" ? firstMedia.posterUrl : firstMedia?.url;
  if (url) await warmImage(url, signal);
}
