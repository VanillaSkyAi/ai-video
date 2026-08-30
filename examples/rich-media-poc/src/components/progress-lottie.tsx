"use client";

import {
  DotLottieReact,
  setWasmUrl,
  type DotLottie,
} from "@lottiefiles/dotlottie-react";
import { useEffect, useState } from "react";
import { lottieFrameAtProgress } from "../lib/timeline";

setWasmUrl("/dotlottie-player.wasm");

interface ProgressLottieProps {
  src: string;
  progress: number;
  label: string;
}

export function ProgressLottie({ src, progress, label }: ProgressLottieProps) {
  const [animation, setAnimation] = useState<DotLottie | null>(null);

  useEffect(() => {
    if (!animation) return;

    const seek = () => {
      animation.pause();
      animation.setFrame(lottieFrameAtProgress(progress, animation.totalFrames));
    };
    seek();
    animation.addEventListener("load", seek);
    return () => animation.removeEventListener("load", seek);
  }, [animation, progress]);

  return <div role="img" aria-label={label} style={{ width: "100%", height: "100%" }}>
    <DotLottieReact
      src={src}
      autoplay={false}
      loop={false}
      dotLottieRefCallback={setAnimation}
      renderConfig={{ autoResize: true, devicePixelRatio: 1 }}
      style={{ width: "100%", height: "100%" }}
    />
  </div>;
}
