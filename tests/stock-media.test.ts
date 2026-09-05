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
    vi.useRealTimers();
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


describe("stock search selection and total deadline", () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv("PEXELS_API_KEY", "mock-stock-key"); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("accepts documented Vimeo external MP4s but rejects unrelated locations", async () => {
    const allowed = "https://player.vimeo.com/external/123.hd.mp4?s=test";
    const links = ["https://player.vimeo.com/video/123", "https://player.vimeo.com.evil.invalid/external/123.mp4", "https://player.vimeo.com/external/123.html", allowed];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ videos: links.map(link => ({ video_files: [{ link, width: 1280, height: 720 }] })) })));
    expect(await lookup()).toEqual({ url: allowed, type: "video" });
  });

  it("tries broader video before photos when descriptive metadata clearly misses", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ videos: [{ ...clip, url: "https://www.pexels.com/video/city-traffic-123/" }] }))
      .mockResolvedValueOnce(Response.json({ videos: [{ ...clip, url: "https://www.pexels.com/video/medieval-castle-456/" }] }));
    vi.stubGlobal("fetch", fetcher);
    const { findStockFootage } = await import("../starters/video-chat/stock");
    expect(await findStockFootage("Minecraft castle", "landscape", new AbortController().signal, "medieval castle")).toEqual({ url: videoUrl, type: "video" });
    expect(fetcher.mock.calls.map(call => new URL(call[0]).searchParams.get("query"))).toEqual(["Minecraft castle", "medieval castle"]);
    expect(fetcher.mock.calls.every(call => new URL(call[0]).pathname === "/v1/videos/search")).toBe(true);
  });

  it("accepts unknown metadata and deduplicates equivalent fallback queries", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ videos: [{ ...clip, url: "https://www.pexels.com/video/123/", tags: [] }] }));
    vi.stubGlobal("fetch", fetcher);
    const { findStockFootage } = await import("../starters/video-chat/stock");
    expect(await findStockFootage("ocean", "landscape", new AbortController().signal, "OCEAN")).toEqual({ url: videoUrl, type: "video" });
    expect(await lookup()).toEqual({ url: videoUrl, type: "video" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses photo alt to skip clear mismatches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ videos: [] })).mockResolvedValueOnce(Response.json({ photos: [
      { alt: "A city highway", src: { large: "https://images.pexels.com/city.jpg" } },
      { alt: "Ocean waves", src: { large: photoUrl } },
    ] })));
    expect(await lookup()).toEqual({ url: photoUrl, type: "image" });
  });

  it("bounds the whole search including ignored cancellation during a broader response body", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve(Response.json({ videos: [] })), 2000)))
      .mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) });
    vi.stubGlobal("fetch", fetcher);
    const { findStockFootage } = await import("../starters/video-chat/stock");
    const pending = findStockFootage("ocean", "landscape", new AbortController().signal, "sea");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
  });

  it("returns promptly when outer cancellation is ignored by fetch", async () => {
    const fetcher = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    const { findStockFootage } = await import("../starters/video-chat/stock");
    const controller = new AbortController();
    const pending = findStockFootage("ocean", "landscape", controller.signal);
    controller.abort();
    expect(await pending).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
