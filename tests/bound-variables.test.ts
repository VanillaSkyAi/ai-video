import { describe, expect, it } from "vitest";
import { decodeVideoSse } from "../src/protocol/sse";
import { clipText } from "../src/server/bound-variables";

/**
 * A template's bounds are a layout contract, and a scene that breaks one used
 * to be rejected whole. Measured across real video-chat responses, that was
 * the single most common reason a planned scene never reached the browser -
 * more common than every other planner failure combined, and it is why a
 * five-scene answer kept arriving with three.
 */
async function plan(texts: string) {
  const { createVideoHandler } = await import("../src/server/create-video-handler");
  const warnings: Array<{ code: string; message: string }> = [];
  const handler = createVideoHandler({
    authorize: "none",
    heartbeatMs: false,
    onWarning: (warning) => { warnings.push(warning); },
    streamText: async function* () {
      yield `${JSON.stringify({
        type: "scene.add",
        scene: {
          id: "one",
          templateId: "cardList",
          variables: { texts, items: ["a", "b", "c"] },
          timing: { fixedDuration: 4 },
        },
      })}\n`;
      yield '{"type":"plan.complete","finishReason":"stop"}\n';
    },
  });
  const response = await handler(new Request("https://app.example/api/video", {
    method: "POST",
    body: JSON.stringify({
      protocolVersion: "0.5",
      requestId: "request-bound-variables",
      input: { input: "A question worth several beats." },
      capabilities: { templates: ["cardList"] },
    }),
  }));
  const scenes = [];
  for await (const event of decodeVideoSse(response.body!)) {
    if (event.type === "scene.add" && event.data.scene.id === "one") scenes.push(event.data.scene);
  }
  return { scenes, warnings };
}

describe("bounded planner variables", () => {
  it("keeps a scene whose headline ran long, trimmed to the declared length", async () => {
    const long = "This balance between attraction and quantum confinement is why atoms are stable";
    const { scenes, warnings } = await plan(long);
    expect(scenes).toHaveLength(1);
    expect(String(scenes[0].variables.texts).length).toBeLessThanOrEqual(48);
    expect(warnings.some((warning) => warning.code === "scene_variable_clipped")).toBe(true);
  });

  it("leaves copy that already fits exactly as written", async () => {
    const short = "Two locked rhythms";
    const { scenes, warnings } = await plan(short);
    expect(scenes[0].variables.texts).toBe(short);
    expect(warnings.some((warning) => warning.code === "scene_variable_clipped")).toBe(false);
  });

  // Cutting mid-word reads as a bug rather than as brevity.
  it("clips to a whole word, and fits the ellipsis inside the bound", () => {
    expect(clipText("Shallow water trips the wave and that is the break", 24)).toBe("Shallow water trips…");
    expect(clipText("Shallow water trips the wave", 24).length).toBeLessThanOrEqual(24);
    expect(clipText("short", 24)).toBe("short");
  });
});
