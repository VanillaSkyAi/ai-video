// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { warmImage } from "./media-preload";

class FakeImage {
  static instances: FakeImage[] = [];
  complete = false;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  src = "";

  constructor() {
    FakeImage.instances.push(this);
  }
}

describe("adaptive channel media preload", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeImage.instances = [];
  });

  it("detaches image handlers and the abort listener after a timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", FakeImage);
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");

    const warming = warmImage("https://cdn.example/poster.webp", controller.signal, 25);
    await vi.advanceTimersByTimeAsync(25);
    await warming;

    expect(FakeImage.instances[0]?.onload).toBeNull();
    expect(FakeImage.instances[0]?.onerror).toBeNull();
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
