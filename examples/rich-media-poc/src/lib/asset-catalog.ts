export const STICKER_ASSETS = {
  spark: { url: "/spark-sticker.gif", label: "Spark" },
  rocket: { url: "/rocket-sticker.gif", label: "Rocket" },
  confetti: { url: "/confetti-sticker.gif", label: "Confetti" },
  launch: { url: "/launch-sticker.gif", label: "Launch burst" },
} as const;

export const LOTTIE_ASSETS = {
  orbit: { url: "/orbit.json", label: "Orbit" },
  pulse: { url: "/pulse.json", label: "Pulse" },
  steps: { url: "/steps.json", label: "Steps" },
} as const;

export type StickerKey = keyof typeof STICKER_ASSETS;
export type LottieKey = keyof typeof LOTTIE_ASSETS;

export function resolveStickerAsset(key: string) {
  return key in STICKER_ASSETS
    ? STICKER_ASSETS[key as StickerKey]
    : STICKER_ASSETS.spark;
}

export function resolveLottieAsset(key: string) {
  return key in LOTTIE_ASSETS
    ? LOTTIE_ASSETS[key as LottieKey]
    : LOTTIE_ASSETS.orbit;
}
