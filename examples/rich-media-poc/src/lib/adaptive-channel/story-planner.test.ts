import { describe, expect, it } from "vitest";
import { createModelStoryPlanner } from "./story-planner";

function storyJson(headlines: readonly string[]): string {
  return JSON.stringify({
    contentType: "how-to",
    visualStyle: "natural instructional cinematography with tactile close-up detail",
    setting: "the same bright home kitchen throughout",
    characterBible: "the same cook's hands, bowls, pan, and utensils",
    continuityRules: ["Keep the setting, cookware, ingredients, and daylight consistent"],
    scenes: headlines.map((headline, index) => ({
      headline,
      description: `Concrete cooking step ${index + 1}.`,
      framing: "clear food close-up",
      camera: "one slow controlled push",
      action: `Complete cooking step ${index + 1}.`,
      lighting: "soft consistent daylight",
      sound: "quiet kitchen ambience and one action sound",
    })),
  });
}

describe("model story planner", () => {
  it("repairs generic model copy once before accepting a prompt-specific outline", async () => {
    const prompts: string[] = [];
    const outputs = [
      storyJson([
        "Enter the world.",
        "Something changes.",
        "The evidence appears.",
        "Now it cannot be undone.",
        "The choice arrives.",
      ]),
      storyJson([
        "Whisk the dry ingredients.",
        "Combine the wet ingredients.",
        "Fold just until mixed.",
        "Flip when bubbles appear.",
        "Stack and serve them warm.",
      ]),
    ];
    const planner = createModelStoryPlanner({
      generate: async ({ prompt }) => {
        prompts.push(prompt);
        return outputs.shift()!;
      },
    });

    const outline = await planner({
      premise: "How to make fluffy American pancakes",
      sceneCount: 5,
    });

    expect(outline.scenes.map(({ headline }) => headline)).toEqual([
      "Whisk the dry ingredients.",
      "Combine the wet ingredients.",
      "Fold just until mixed.",
      "Flip when bubbles appear.",
      "Stack and serve them warm.",
    ]);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("previous outline was rejected");
    expect(prompts[1]).toContain("generic copy");
  });
});
