import { describe, expect, it } from "vitest";
import { createVideoChatHandler } from "../src/server";
import { decodeVideoSse } from "../src/protocol/sse";

async function run(budget: number | undefined, fail = false, queries = Array.from({ length: 7 }, (_, i) => `ocean wave ${i}`), stockFails = false, mediaConcurrency = 5) {
  let generated = 0;
  let stock = 0;
  let brief = "";
  const handler = createVideoChatHandler({
    authorize: "none", heartbeatMs: false, mediaConcurrency,
    ...({ maxGeneratedVideos: budget }),
    generateText: async () => "unused",
    streamText: ({ systemPrompt }) => {
      brief = systemPrompt;
      return (async function* () {
        yield `${JSON.stringify({ type: "video-chat.opening", spokenHook: "Watch the ocean come alive today", mediaKeyword: "ocean", firstShot: { text: "Ocean waves", narration: "The ocean moves with a rhythm all of its own today.", mediaKeyword: queries[0] } })}\n`;
        for (const [i, query] of queries.slice(1).entries()) yield `${JSON.stringify({ type: "scene.add", ...(i === queries.length - 2 ? { placement: "closer" } : {}), scene: { id: `shot-${i}`, templateId: "media", variables: { texts: "Ocean", mediaType: "video", mediaKeyword: query }, narration: "A new wave brings another quiet moment to the shore today.", timing: { fixedDuration: 4 } } })}\n`;
        yield '{"type":"plan.complete"}\n';
      })();
    },
    generateVideo: async () => { generated++; if (fail) throw new Error("private provider detail"); return { url: "https://media.example/generated.mp4", type: "video" }; },
    searchMedia: async () => { stock++; if (stockFails) return null; return { url: "https://media.example/stock.mp4", type: "video" }; },
  });
  const response = await handler(new Request("https://app.example/api?action=response", { method: "POST", body: JSON.stringify({ prompt: "Ocean", mode: "full", opening: "Watch the ocean come alive today" }) }));
  const events = [];
  for await (const event of decodeVideoSse(response.body!)) events.push(event);
  return { generated, stock, brief, events };
}

describe("chat generation budget", () => {
  it("defaults to five attempts including the reserved shot while stock continues", async () => {
    const result = await run(undefined);
    expect(result.generated).toBe(5);
    expect(result.stock).toBe(2);
    expect(JSON.stringify(result.events)).not.toContain('"mediaType":"gradient"');
  });
  it("enforces a configured attempt limit even when attempts fail", async () => {
    const result = await run(2, true);
    expect(result.generated).toBe(2);
    expect(result.stock).toBe(7);
    expect(JSON.stringify(result.events)).not.toContain("private provider detail");
    expect(result.brief).toContain("2 generated-video attempts");
  });
  it("supports zero paid attempts", async () => {
    const result = await run(0);
    expect(result.generated).toBe(0);
    expect(result.stock).toBe(7);
  });
  it("reuses a completed exact-subject clip once when stock fails, never unrelated footage", async () => {
    const result = await run(1, false, ["ocean waves", "ocean waves", "ocean waves", "desert dunes"], true, 1);
    const text = JSON.stringify(result.events);
    // One generated shot plus one reuse; subsequent/unrelated shots recover to templates.
    const scenes = result.events.filter((event) => event.type === "scene.add");
    expect(scenes.filter((event) => JSON.stringify(event).includes("generated.mp4"))).toHaveLength(2);
    expect(text).toContain('"mediaType":"gradient"');
  });
  it.each([-1, 1.5, Infinity, NaN])("rejects invalid limit %s", (maxGeneratedVideos) => {
    expect(() => createVideoChatHandler({ authorize: "none", streamText: async function* () {}, generateText: async () => "", ...({ maxGeneratedVideos }) })).toThrow("maxGeneratedVideos");
  });
});
