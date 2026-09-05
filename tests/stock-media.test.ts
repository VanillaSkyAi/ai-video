import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const videoUrl = "https://videos.pexels.com/clip.mp4";
const photoUrl = "https://images.pexels.com/photo.jpg";
const clip = { video_files: [{ link: videoUrl, width: 1920, height: 1080 }] };

async function lookup() {
  const { findStockFootage } = await import("../starters/video-chat/stock");
  return findStockFootage("ocean", "landscape", new AbortController().signal);
}

describe("starter stock recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PEXELS_API_KEY", "mock-stock-key");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falls back to a photo when video lookup rejects without logging private details", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error("private-provider-detail"))
      .mockResolvedValueOnce(Response.json({ photos: [{ src: { large: photoUrl } }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await lookup()).toEqual({ url: photoUrl, type: "image" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private-provider-detail");
  });

  it("preserves a valid video when its optional poster is unsafe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ videos: [{ ...clip, image: "https://unsafe.invalid/poster.jpg" }] })));
    expect(await lookup()).toEqual({ url: videoUrl, type: "video" });
  });

  it("skips malformed video candidates and renditions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ videos: [null, { video_files: {} }, { video_files: [null, ...clip.video_files] }] })));
    expect(await lookup()).toEqual({ url: videoUrl, type: "video" });
  });

  it("tries usable photo sources and later candidates", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ videos: [] }))
      .mockResolvedValueOnce(Response.json({ photos: [null, { src: { large2x: "https://unsafe.invalid/a.jpg" } }, { src: { large2x: "invalid", large: photoUrl } }] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await lookup()).toEqual({ url: photoUrl, type: "image" });
  });

  it("falls through malformed video payloads to photo lookup", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ videos: {} }))
      .mockResolvedValueOnce(Response.json({ photos: [{ src: { large: photoUrl } }] })));
    expect(await lookup()).toEqual({ url: photoUrl, type: "image" });
  });

  it("does not start a fallback search after cancellation", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("cancelled");
    });
    vi.stubGlobal("fetch", fetcher);
    const { findStockFootage } = await import("../starters/video-chat/stock");
    expect(await findStockFootage("ocean", "landscape", controller.signal)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never searches for an already cancelled request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { findStockFootage } = await import("../starters/video-chat/stock");
    expect(await findStockFootage("ocean", "landscape", AbortSignal.abort())).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
