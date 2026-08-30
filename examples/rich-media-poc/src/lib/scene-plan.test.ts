import type { Video } from "@vanillaskyai/ai-video";
import { describe, expect, it } from "vitest";
import { describeScenePlan, hydrateGeneratedScenes } from "./scene-plan";

const plannedVideo: Video = {
  schemaVersion: "0.1",
  orientation: "portrait",
  scenes: [
    {
      id: "world",
      templateId: "generatedScene",
      variables: {
        imageBrief: "A calm workspace transforming into a vivid launch world",
        imageUrl: "/ai-scene.webp",
        decisionReason: "An original visual makes the abstract transformation memorable.",
        eyebrow: "FROM IDEA TO WORLD",
        headline: "Build the feeling first.",
      },
      timing: { fixedDuration: 5 },
    },
    {
      id: "celebrate",
      templateId: "animatedSticker",
      variables: {
        stickerKey: "confetti",
        decisionReason: "Confetti punctuates the launch payoff.",
        headline: "It shipped.",
        caption: "A playful ending earns the reaction.",
      },
      timing: { fixedDuration: 4 },
    },
    {
      id: "explain",
      templateId: "lottieMotion",
      variables: {
        motionKey: "steps",
        decisionReason: "A step animation clarifies the three-stage workflow.",
        kicker: "HOW IT WORKS",
        headline: "Plan. Resolve. Render.",
      },
      timing: { fixedDuration: 4 },
    },
  ],
  style: {
    brand: {
      font: "Inter",
      scriptFont: "Caveat",
      background: { type: "gradient", colors: ["#111028", "#6d4aff"] },
      colors: {
        primary: "#8b7cff",
        secondary: "#ff6f91",
        foreground: "#ffffff",
        surface: "#080711",
        surfaceElevated: "#17142b",
        muted: "#aaa4bc",
      },
    },
  },
};

describe("scene plan enrichment", () => {
  it("generates only planned image scenes and preserves the streamed video", async () => {
    const briefs: string[] = [];
    const result = await hydrateGeneratedScenes(plannedVideo, async (brief) => {
      briefs.push(brief);
      return { imageUrl: "data:image/webp;base64,cG9j", model: "fixture-image" };
    });

    expect(briefs).toEqual(["A calm workspace transforming into a vivid launch world"]);
    expect(result.generatedCount).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.video.scenes[0]?.variables.imageUrl).toBe("data:image/webp;base64,cG9j");
    expect(plannedVideo.scenes[0]?.variables.imageUrl).toBe("/ai-scene.webp");
    expect(result.video.scenes[1]).toEqual(plannedVideo.scenes[1]);
  });

  it("keeps the fallback image when generation fails", async () => {
    const result = await hydrateGeneratedScenes(plannedVideo, async () => {
      throw new Error("provider unavailable");
    });

    expect(result.generatedCount).toBe(0);
    expect(result.failures).toEqual(["world"]);
    expect(result.video.scenes[0]?.variables.imageUrl).toBe("/ai-scene.webp");
  });

  it("turns planner variables into an explainable storyboard", () => {
    expect(describeScenePlan(plannedVideo)).toEqual([
      {
        sceneId: "world",
        templateId: "generatedScene",
        treatment: "AI image",
        asset: "A calm workspace transforming into a vivid launch world",
        reason: "An original visual makes the abstract transformation memorable.",
      },
      {
        sceneId: "celebrate",
        templateId: "animatedSticker",
        treatment: "Sticker · Confetti",
        asset: "/confetti-sticker.gif",
        reason: "Confetti punctuates the launch payoff.",
      },
      {
        sceneId: "explain",
        templateId: "lottieMotion",
        treatment: "Lottie · Steps",
        asset: "/steps.json",
        reason: "A step animation clarifies the three-stage workflow.",
      },
    ]);
  });
});
