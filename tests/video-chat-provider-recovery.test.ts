import { describe, expect, it, vi } from "vitest";
import { createVideoChatHandler } from "../src/server/create-video-chat-handler";
import { decodeVideoSse } from "../src/protocol/sse";
import type { ResolvedMedia } from "../src/server/media-resolver";

const media = { url: "https://media.example/stock.mp4", type: "video" as const };
const request = () => new Request("https://app.example/api/video-chat?action=response", {
  method: "POST",
  body: JSON.stringify({ prompt: "Explain ocean currents", mode: "full" }),
});
function streamText() {
  return (async function* () {
    yield JSON.stringify({ type: "video-chat.opening", spokenHook: "Ocean currents carry warmth around the world.", mediaKeyword: "ocean currents" }) + "\n";
    for (const [id, placement] of [["first", undefined], ["last", "closer"]] as const) {
      yield JSON.stringify({ type: "scene.add", placement, scene: { id, templateId: "media", variables: { texts: "Warm water travels", mediaKeyword: "ocean currents", mediaType: "video" }, narration: "Warm water travels around the world.", timing: { fixedDuration: 5 } } }) + "\n";
    }
    yield '{"type":"plan.complete"}\n';
  })();
}

describe("video chat optional provider recovery", () => {
  it.each(["rejection", "abort", "timeout", "empty", "invalid"])("uses stock and preserves scenes after generated video %s", async (failure) => {
    const searchMedia = vi.fn(async () => media);
    const handler = createVideoChatHandler({
      authorize: "none", heartbeatMs: false, streamText,
      generateText: async () => "unused",
      generateVideo: async () => {
        if (failure === "empty") return null;
        if (failure === "invalid") return { url: "javascript:private-provider-detail", type: "video" };
        throw failure === "abort" || failure === "timeout"
          ? new DOMException("private-provider-detail", failure === "abort" ? "AbortError" : "TimeoutError")
          : new Error("private-provider-detail");
      },
      searchMedia,
    });
    const response = await handler(request());
    const events = [];
    for await (const event of decodeVideoSse(response.body!)) events.push(event);
    expect(searchMedia).toHaveBeenCalledTimes(2);
    expect(events.filter((event) => event.type === "scene.add").map((event) => event.data.scene.variables.mediaUrl)).toEqual([media.url, media.url]);
    expect(events.at(-1)?.type).toBe("response.complete");
    expect(events.some((event) => event.type === "response.warning")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("private-provider-detail");
  });

  it("continues on safe templates when both media providers fail", async () => {
    const handler = createVideoChatHandler({
      authorize: "none", heartbeatMs: false, streamText,
      generateText: async () => "unused",
      generateVideo: async () => { throw new Error("private-ai-detail"); },
      searchMedia: async () => { throw new Error("private-stock-detail"); },
    });
    const response = await handler(request());
    const events = [];
    for await (const event of decodeVideoSse(response.body!)) events.push(event);
    expect(events.filter((event) => event.type === "scene.add").map((event) => event.data.scene.variables.mediaType)).toEqual(["gradient", "gradient"]);
    expect(events.at(-1)?.type).toBe("response.complete");
    expect(events.some((event) => event.type === "response.warning")).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/private-ai-detail|private-stock-detail/);
  });

  it("keeps valid generated footage without calling stock", async () => {
    const searchMedia = vi.fn(async () => media);
    const handler = createVideoChatHandler({
      authorize: "none", heartbeatMs: false, streamText,
      generateText: async () => "unused", generateVideo: async () => media, searchMedia,
    });
    await (await handler(request())).text();
    expect(searchMedia).not.toHaveBeenCalled();
  });

  it("does not invoke stock after request cancellation", async () => {
    const controller = new AbortController();
    const searchMedia = vi.fn(async () => media);
    const handler = createVideoChatHandler({
      authorize: "none", heartbeatMs: false, streamText,
      generateText: async () => "unused",
      generateVideo: async (): Promise<ResolvedMedia> => {
        controller.abort();
        throw new DOMException("cancelled", "AbortError");
      }, searchMedia,
    });
    const response = await handler(new Request(request(), { signal: controller.signal }));
    await response.text();
    expect(searchMedia).not.toHaveBeenCalled();
  });
});
