import { describe, expect, it } from "vitest";
import {
  buildInitialComposition,
  normalizeVideoInput,
  resolveStreamCapabilities,
} from "../src/server/composition-input.js";

describe("composition input", () => {
  it("adds the default opening without mutating the caller input", () => {
    const input = { input: "Explain retained revenue" };

    const normalized = normalizeVideoInput(input);

    expect(normalized).not.toBe(input);
    expect(normalized.opening).toBe("Creating your video...");
    expect(input).not.toHaveProperty("opening");
  });

  it("preserves an explicitly disabled opening", () => {
    expect(normalizeVideoInput({ input: "Explain retained revenue", opening: false }).opening)
      .toBe(false);
  });

  it("negotiates the built-in opening template once", () => {
    expect(resolveStreamCapabilities({ templates: ["media", "bigNumber"] }, true)).toEqual({
      templates: ["media", "bigNumber"],
    });
    expect(resolveStreamCapabilities({ templates: ["bigNumber"] }, true)).toEqual({
      templates: ["media", "bigNumber"],
    });
  });

  it("leaves capabilities alone when no runtime opening is present", () => {
    const capabilities = { templates: ["bigNumber"] };
    expect(resolveStreamCapabilities(capabilities, false)).toBe(capabilities);
  });

  it("uses continuous transitions without implicit camera motion by default", () => {
    const { config } = buildInitialComposition(
      { input: "Explain retained revenue", opening: false },
      undefined,
      undefined,
      0,
      undefined,
    );

    expect(config.style).toMatchObject({
      defaultTransition: "crossfade",
      defaultBackgroundEffect: "static",
    });
  });
});
