import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("published video chat stylesheet", () => {
  it("is fully scoped and leaves the host application alone", () => {
    const css = readFileSync(new URL("../styles/video-chat.css", import.meta.url), "utf8");

    expect(css).toContain(".vanillasky-video-chat");
    expect(css).not.toMatch(/(^|[},]\s*)(?::root|html|body|\*)(?=[\s,{])/m);
    expect(css).not.toContain("document.documentElement");
    expect(css).toContain("@media (prefers-contrast: more)");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).not.toContain("data-theme");
    const selectorLines = css.split("\n").filter((line) =>
      line.includes("{")
      && !line.trimStart().startsWith("@")
      && !/^(?:from|to|\d+%)\b/.test(line.trim()),
    );
    for (const selector of selectorLines) {
      expect(selector).toContain(".vanillasky-video-chat");
    }
  });

  it("keeps spoken captions complete rather than line-clamped", () => {
    const css = readFileSync(new URL("../styles/video-chat.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/(?:-webkit-)?line-clamp\s*:/);
    const captionRules = [...css.matchAll(/\.vanillasky-video-chat \.line\s*\{([^}]+)\}/g)]
      .map((match) => match[1]);
    expect(captionRules.length).toBeGreaterThan(0);
    expect(captionRules.join("\n")).not.toMatch(/overflow\s*:\s*(?:hidden|clip)/);
    expect(captionRules.join("\n")).toContain("overflow-wrap: anywhere");
  });
});
