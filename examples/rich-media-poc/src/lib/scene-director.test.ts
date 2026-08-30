import { createMockVideoPlanner } from "@vanillaskyai/ai-video/test";
import { describe, expect, it } from "vitest";
import {
  DIRECTOR_TEMPLATE_IDS,
  createSceneDirectorHandler,
} from "./scene-director";

describe("AI scene director", () => {
  it("accepts a varied, explainable plan through the real VanillaSky handler", async () => {
    const handle = createSceneDirectorHandler({
      authorize: "none",
      heartbeatMs: false,
      streamText: createMockVideoPlanner({
        parts: [
          {
            type: "scene.add",
            scene: {
              id: "visual-hook",
              templateId: "generatedScene",
              variables: {
                imageBrief: "A paper sketch unfolding into a colorful product universe",
                decisionReason: "A generated world creates an emotional hook.",
                eyebrow: "THE BIG IDEA",
                headline: "Turn a sketch into a launch.",
              },
              timing: { fixedDuration: 5 },
            },
          },
          {
            type: "scene.add",
            placement: "closer",
            scene: {
              id: "reaction-close",
              templateId: "animatedSticker",
              variables: {
                stickerKey: "rocket",
                decisionReason: "The rocket makes the launch payoff immediate.",
                headline: "Ready for lift-off.",
                caption: "The visual punchline matches the story.",
              },
              timing: { fixedDuration: 4 },
            },
          },
          { type: "plan.complete" },
        ],
      }),
    });

    const response = await handle(new Request("https://app.test/api/video", {
      method: "POST",
      body: JSON.stringify({
        protocolVersion: "0.5",
        requestId: "scene-director-test",
        capabilities: { templates: [...DIRECTOR_TEMPLATE_IDS] },
        input: {
          input: "Launch an AI product that turns sketches into videos.",
          opening: false,
          orientation: "portrait",
          maxDurationSec: 18,
        },
      }),
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"response.complete"');
    expect(body).toContain('"templateId":"generatedScene"');
    expect(body).toContain('"stickerKey":"rocket"');
    expect(body).toContain('"decisionReason":"The rocket makes the launch payoff immediate."');
  });

  it("exposes only the three rich-media treatments to the client", () => {
    expect(DIRECTOR_TEMPLATE_IDS).toEqual([
      "generatedScene",
      "animatedSticker",
      "lottieMotion",
    ]);
  });
});
