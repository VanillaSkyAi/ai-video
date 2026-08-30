"use client";

import { decompressFrames, parseGIF } from "gifuct-js";

export interface DecodedGifFrame {
  delayMs: number;
  pixels: ImageData;
}

export interface DecodedGif {
  width: number;
  height: number;
  frames: readonly DecodedGifFrame[];
}

/** Decode and pre-compose every GIF frame so seeking never depends on wall time. */
export async function decodeGif(src: string, signal: AbortSignal): Promise<DecodedGif> {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error(`GIF request failed with ${response.status}`);

  const parsed = parseGIF(await response.arrayBuffer());
  const sourceFrames = decompressFrames(parsed, true);
  const canvas = document.createElement("canvas");
  canvas.width = parsed.lsd.width;
  canvas.height = parsed.lsd.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable");

  const frames: DecodedGifFrame[] = [];
  for (const frame of sourceFrames) {
    const previous = frame.disposalType === 3
      ? context.getImageData(0, 0, canvas.width, canvas.height)
      : undefined;
    const patch = context.createImageData(frame.dims.width, frame.dims.height);
    patch.data.set(frame.patch);
    context.putImageData(patch, frame.dims.left, frame.dims.top);
    frames.push({
      delayMs: frame.delay,
      pixels: context.getImageData(0, 0, canvas.width, canvas.height),
    });

    if (frame.disposalType === 2) {
      context.clearRect(
        frame.dims.left,
        frame.dims.top,
        frame.dims.width,
        frame.dims.height,
      );
    } else if (frame.disposalType === 3 && previous) {
      context.putImageData(previous, 0, 0);
    }
  }

  if (frames.length === 0) throw new Error("GIF contains no drawable frames");
  return { width: canvas.width, height: canvas.height, frames };
}
