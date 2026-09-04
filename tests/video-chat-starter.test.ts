import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const starterRoot = join(process.cwd(), "starters", "video-chat");

describe("video chat starter", () => {
  it("is the canonical general-purpose starter", () => {
    const files = [
      "README.md",
      "package.json",
      "server.ts",
      "vite.config.ts",
      "src/main.tsx",
    ];
    const source = files
      .map((file) => readFileSync(join(starterRoot, file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/\b(?:tutor|lesson|learner)\b/i);
    expect(source).toContain("creative");
    expect(source).toContain("recommend");
    expect(source).toContain("story");
  });

  it("documents one required key and optional upgrades", () => {
    const environment = readFileSync(join(starterRoot, ".env.example"), "utf8");

    expect(environment).toContain("ANTHROPIC_API_KEY=");
    expect(environment).toContain("# Optional");
    expect(environment).toContain("XAI_API_KEY=");
    expect(environment).toContain("FAL_KEY=");
    expect(environment).toContain("PEXELS_API_KEY=");
  });

  it("loads server-only keys from the local environment file", () => {
    const config = readFileSync(join(starterRoot, "vite.config.ts"), "utf8");

    expect(config).toContain("loadEnv");
    expect(config).not.toContain("import.meta.env");
    expect(config).toContain('action !== "welcome"');
  });

  it("keeps orchestration in the SDK behind one endpoint", () => {
    const server = readFileSync(join(starterRoot, "server.ts"), "utf8");
    const config = readFileSync(join(starterRoot, "vite.config.ts"), "utf8");
    const client = readFileSync(join(starterRoot, "src/main.tsx"), "utf8");

    expect(server).toContain("createVideoChatHandler");
    expect(server).not.toContain("createVideoHandler");
    expect(config).toContain('path !== "/api/video-chat"');
    expect(config).toContain('request.once("aborted"');
    expect(config).toContain('includes("text/event-stream")');
    expect(client).not.toMatch(/\/api\/(?:response|narration|suggestions|speech|opening|transcribe|welcome)/);
    expect(client).toContain("<VideoChat");
    expect(client).toContain('@vanillaskyai/video/video-chat.css');
    expect(client).not.toContain("useVideoChat");
    expect(client).not.toContain("createSceneTimeline");
    expect(client).not.toContain("useNarration");
    expect(client).not.toContain("createSpokenVoice");
    expect(server).toContain("async ({ text, signal })");
    expect(server).toContain("abortSignal: signal");
    expect(server).toContain("Uint8Array.from(audio)");
    expect(server).not.toContain("JSON.stringify(detail)");
    expect(server).toContain('const OPENING_MODEL = process.env.ANTHROPIC_OPENING_MODEL ?? "claude-haiku-4-5"');
  });

  it("does not duplicate SDK-owned UI and session behavior", () => {
    const client = readFileSync(join(starterRoot, "src/main.tsx"), "utf8");

    expect(client.split("\n").length).toBeLessThan(20);
    for (const duplicated of [
      "icons.tsx",
      "modes.ts",
      "suggestion-cards.tsx",
      "themes.ts",
      "use-dismiss.ts",
      "use-voice-input.ts",
      "welcome.tsx",
      "styles.css",
      "tokens.css",
    ]) {
      expect(() => readFileSync(join(starterRoot, "src", duplicated), "utf8")).toThrow();
    }
  });

  it("does not keep an obsolete source-owned template tree or transcript harness", () => {
    expect(existsSync(join(starterRoot, "vanillasky"))).toBe(false);
    expect(existsSync(join(starterRoot, "scripts"))).toBe(false);
  });

  it("uses packaged templates until the application opts into source ownership", () => {
    const client = readFileSync(join(starterRoot, "src/main.tsx"), "utf8");
    const server = readFileSync(join(starterRoot, "server.ts"), "utf8");

    expect(client).not.toContain("createTemplateRegistry");
    expect(client).not.toContain("../vanillasky");
    expect(server).not.toContain("./vanillasky/server");
  });
});
