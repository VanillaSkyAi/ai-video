import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("published video chat stylesheet", () => {
  it("is fully scoped and leaves the host application alone", () => {
    const css = readFileSync(new URL("../styles/video-chat.css", import.meta.url), "utf8");

    expect(css).toContain(".vanillasky-video-chat");
    expect(css).not.toMatch(/(^|[},]\s*)(?::root|html|body|\*)(?=[\s,{])/m);
    expect(css).not.toContain("document.documentElement");
    expect(css).toContain('@media (prefers-color-scheme: dark) and (prefers-contrast: more)');
    expect(css.match(/\.vanillasky-video-chat:not\(\[data-theme="light"\]\)/g)).toHaveLength(2);
    const selectorLines = css.split("\n").filter((line) =>
      line.includes("{")
      && !line.trimStart().startsWith("@")
      && !/^(?:from|to|\d+%)\b/.test(line.trim()),
    );
    for (const selector of selectorLines) {
      expect(selector).toContain(".vanillasky-video-chat");
    }
  });
});
