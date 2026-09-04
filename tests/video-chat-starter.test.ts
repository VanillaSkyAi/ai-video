import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const starterRoot = join(process.cwd(), "starters", "video-chat");

describe("video chat starter", () => {
  it("is the canonical general-purpose starter", () => {
    const files = [
      "README.md",
      "package.json",
      "server.ts",
      "vite.config.ts",
      "src/main.tsx",
      "src/generate-response.ts",
      "src/welcome.tsx",
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
    expect(config).toContain('path !== "/api/welcome"');
  });
});

describe("video chat browser voice fallback", () => {
  it("prepares and speaks when generated speech is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
    const speak = vi.fn((utterance: { onend?: () => void }) => utterance.onend?.());
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      rate = 1;
      onend?: () => void;
      onerror?: () => void;
      constructor(public text: string) {}
    });

    const { createSpokenVoice } = await import("../starters/video-chat/src/spoken-voice");
    const voice = createSpokenVoice();
    const prepared = await voice.prepare("A short spoken response.");

    expect(prepared?.seconds).toBeGreaterThan(0);
    await voice.speak("A short spoken response.", { signal: new AbortController().signal });
    expect(speak).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});

describe("video chat voice input capabilities", () => {
  it("does not offer recorder transcription without a configured provider", async () => {
    vi.stubGlobal("window", {
      MediaRecorder: class {},
      navigator: { mediaDevices: { getUserMedia: vi.fn() } },
    });

    const { supportsVoiceInput } = await import("../starters/video-chat/src/use-voice-input");

    expect(supportsVoiceInput(false)).toBe(false);
    expect(supportsVoiceInput(true)).toBe(true);

    vi.unstubAllGlobals();
  });
});
