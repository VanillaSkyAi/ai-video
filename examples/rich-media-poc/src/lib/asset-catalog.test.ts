import { describe, expect, it } from "vitest";
import {
  LOTTIE_ASSETS,
  STICKER_ASSETS,
  resolveLottieAsset,
  resolveStickerAsset,
} from "./asset-catalog";

describe("rich media asset catalog", () => {
  it("maps every sticker choice to a distinct local GIF", () => {
    const assets = Object.values(STICKER_ASSETS);

    expect(new Set(assets.map(({ url }) => url)).size).toBe(assets.length);
    expect(assets.every(({ url }) => url.endsWith(".gif"))).toBe(true);
  });

  it("maps every motion choice to a distinct local Lottie document", () => {
    const assets = Object.values(LOTTIE_ASSETS);

    expect(new Set(assets.map(({ url }) => url)).size).toBe(assets.length);
    expect(assets.every(({ url }) => url.endsWith(".json"))).toBe(true);
  });

  it("uses safe fallbacks for untrusted persisted keys", () => {
    expect(resolveStickerAsset("not-in-the-catalog")).toBe(STICKER_ASSETS.spark);
    expect(resolveLottieAsset("not-in-the-catalog")).toBe(LOTTIE_ASSETS.orbit);
  });
});
