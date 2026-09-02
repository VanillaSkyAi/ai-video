import { describe, expect, it } from "vitest";
import { decodeVideoSse } from "../src/protocol/sse";

/**
 * A ceiling on how much media one request may resolve.
 *
 * Nothing bounded this. The planner decides how many scenes a video has, and
 * the base prompt encourages more of them for rich input, so a single request
 * could resolve a dozen. When media is searched for that is free; when it is
 * generated, every scene is a paid clip, and one careless request is several
 * dollars. The application that this was extracted from could be made to spend
 * by holding down a suggestion chip.
 *
 * Past the ceiling a scene falls back to the brand gradient. The video is
 * poorer; it is not broken, and nobody is billed for the difference.
 */
function plan(sceneCount: number) {
  return async function* () {
    for (let index = 0; index < sceneCount; index += 1) {
      yield `${JSON.stringify({
        type: "scene.add",
        scene: {
          id: `scene-${index + 1}`,
          templateId: "media",
          variables: { texts: `Beat ${index + 1}`, mediaKeyword: `subject ${index + 1}`, mediaType: "video" },
          timing: { fixedDuration: 3 },
        },
      })}\n`;
    }
    yield '{"type":"plan.complete"}\n';
  };
}

async function run(options: { scenes: number; maxResolvedMedia?: number }) {
  const { createVideoHandler } = await import("../src/server");
  let calls = 0;
  const warnings: Array<{ code: string; message: string }> = [];
  const handler = createVideoHandler({
    authorize: "none",
    heartbeatMs: false,
    maxResolvedMedia: options.maxResolvedMedia,
    onWarning: (warning) => { warnings.push(warning); },
    resolveMedia: () => {
      calls += 1;
      return { url: `https://media.example.test/${calls}.mp4`, type: "video" as const };
    },
    streamText: plan(options.scenes),
  });
  const response = await handler(new Request("https://app.example/api/video", {
    method: "POST",
    body: JSON.stringify({
      protocolVersion: "0.5",
      requestId: "request-media-budget",
      input: { input: "A question whose answer runs to several beats." },
      capabilities: { templates: ["media"] },
    }),
  }));
  const events = [];
  for await (const event of decodeVideoSse(response.body!)) events.push(event);
  // The handler adds its own opening scene; these assertions are about the
  // beats the planner wrote.
  const scenes = events
    .flatMap((event) => (event.type === "scene.add" ? [event.data.scene] : []))
    .filter((scene) => String(scene.id).startsWith("scene-"));
  return { calls, scenes, warnings };
}

describe("media budget", () => {
  it("resolves every scene when no ceiling is set", async () => {
    const { calls, scenes } = await run({ scenes: 6 });
    expect(scenes).toHaveLength(6);
    expect(calls).toBe(6);
  });

  it("stops resolving once the ceiling is reached", async () => {
    const { calls, scenes } = await run({ scenes: 6, maxResolvedMedia: 2 });
    expect(scenes).toHaveLength(6);
    expect(calls).toBe(2);
  });

  it("keeps the scenes it could not fill, on the brand gradient", async () => {
    const { scenes } = await run({ scenes: 5, maxResolvedMedia: 1 });
    expect(scenes).toHaveLength(5);
    const filled = scenes.filter((scene) => typeof scene.variables.mediaUrl === "string");
    expect(filled).toHaveLength(1);
    // A scene without footage still says its line, on the brand gradient.
    expect(scenes[4].variables.mediaType).toBe("gradient");
    expect(scenes[4].variables.texts).toBe("Beat 5");
  });

  // The ceiling is a spend policy, so it is reported to the application that
  // set it, not to the browser, which can do nothing about it.
  it("tells the application it stopped, rather than leaving it guessing", async () => {
    const { warnings } = await run({ scenes: 5, maxResolvedMedia: 1 });
    expect(warnings.some((warning) => warning.code === "media_budget_reached")).toBe(true);
  });

  it("warns once, however many scenes go without", async () => {
    const { warnings } = await run({ scenes: 8, maxResolvedMedia: 1 });
    expect(warnings.filter((warning) => warning.code === "media_budget_reached")).toHaveLength(1);
  });

  it("never resolves media when the ceiling is zero", async () => {
    const { calls, scenes } = await run({ scenes: 4, maxResolvedMedia: 0 });
    expect(calls).toBe(0);
    expect(scenes).toHaveLength(4);
  });
});
