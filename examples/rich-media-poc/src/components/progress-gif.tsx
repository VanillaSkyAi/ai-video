"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { decodeGif, type DecodedGif } from "../lib/gif-frames";
import { selectGifFrame } from "../lib/timeline";

interface ProgressGifProps {
  src: string;
  progress: number;
  label: string;
}

export function ProgressGif({ src, progress, label }: ProgressGifProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animation, setAnimation] = useState<DecodedGif>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setAnimation(undefined);
    setFailed(false);
    void decodeGif(src, controller.signal)
      .then(setAnimation)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      });
    return () => controller.abort();
  }, [src]);

  const frameIndex = useMemo(
    () => selectGifFrame(animation?.frames ?? [], progress),
    [animation, progress],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = animation?.frames[frameIndex];
    if (!canvas || !animation || !frame) return;
    canvas.width = animation.width;
    canvas.height = animation.height;
    canvas.getContext("2d")?.putImageData(frame.pixels, 0, 0);
  }, [animation, frameIndex]);

  if (failed) {
    return <div className="asset-fallback" role="img" aria-label={label}>
      GIF needs a same-origin or CORS-enabled URL
    </div>;
  }

  return <canvas
    ref={canvasRef}
    role="img"
    aria-label={label}
    data-gif-frame={frameIndex}
    style={{ width: "100%", height: "100%", objectFit: "contain" }}
  />;
}
