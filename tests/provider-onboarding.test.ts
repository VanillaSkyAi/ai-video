import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const fixture = resolve(root, "tests", "fixtures", "nextjs-provider-app");
const read = (path: string) => readFileSync(resolve(fixture, path), "utf8");
const packageVersion = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version as string;

describe("canonical provider onboarding", () => {
  it("keeps broad provider compatibility in an internal fixture", () => {
    const manifest = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };

    expect(manifest.dependencies).toMatchObject({
      "@ai-sdk/anthropic": expect.any(String),
      "@ai-sdk/openai": expect.any(String),
      "@vanillaskyai/video": packageVersion,
      ai: expect.any(String),
      next: expect.any(String),
      react: expect.any(String),
      "react-dom": expect.any(String),
    });
    expect(manifest.devDependencies).toHaveProperty("tsx");
    expect(existsSync(resolve(fixture, "src/app/api/video-chat/providers/openai.ts"))).toBe(true);
    expect(existsSync(resolve(fixture, "src/app/api/video-chat/providers/anthropic.ts"))).toBe(true);
    expect(existsSync(resolve(fixture, "src/app/api/video"))).toBe(false);
  });

  it("connects supported models to one fail-closed chat route", () => {
    const route = read("src/app/api/video-chat/route.ts");
    const planner = read("src/app/api/video-chat/planner.ts");
    const provider = read("src/app/api/video-chat/provider.ts");

    expect(route).toContain('from "@vanillaskyai/video/server"');
    expect(route).toContain("createVideoChatHandler({");
    expect(route).toContain("streamText: streamVideoPlan");
    expect(route).toContain("generateText:");
    expect(route).toContain('process.env.VANILLASKY_LOCAL_DEMO !== "1"');
    expect(route).toContain("export const GET = handle");
    expect(route).toContain("export const POST = handle");
    expect(planner).toContain('from "ai"');
    expect(provider).toContain('from "./providers/openai"');
    expect(provider).toContain('from "./providers/anthropic"');
  });

  it("renders the complete SDK-owned chat interface", () => {
    const page = read("src/app/page.tsx");

    expect(page).toContain('import { VideoChat } from "@vanillaskyai/video/react"');
    expect(page).toContain('import "@vanillaskyai/video/video-chat.css"');
    expect(page).toContain("<VideoChat options={{ templates }} />");
    expect(page).not.toMatch(/useVideo\(|<VideoPlayer|video\.generate\(/);
  });

  it("labels the fixture as internal and points users to init", () => {
    const readme = read("README.md");
    const environment = read(".env.example");

    expect(environment).toContain("VIDEO_PROVIDER=openai");
    expect(environment).toContain("OPENAI_API_KEY=replace-me");
    expect(environment).toContain("ANTHROPIC_API_KEY=");
    expect(readme).toContain("Internal Next.js video-chat fixture");
    expect(readme).toContain("npx vanillasky init");
    expect(readme).toContain("Replace `authorize`");
    expect(readme).not.toMatch(/public quickstart|one-shot/i);
  });

  it("verifies chat streaming, safety, and provider compatibility without live keys", () => {
    const verifier = readFileSync(resolve(root, "scripts", "verify-nextjs-onboarding.mjs"), "utf8");

    expect(verifier).toContain('"tests", "fixtures", "nextjs-provider-app"');
    expect(verifier).toContain('const providers = ["openai", "anthropic"]');
    expect(verifier).toContain("MockLanguageModelV4");
    expect(verifier).toContain("response.status !== 401");
    expect(verifier).toContain("provider_warning");
    expect(verifier).toContain("credentialForbiddenValues");
    expect(verifier).toContain("allocateLocalPort");
    expect(verifier).toContain('url.pathname === "/api/video-chat"');
    expect(verifier).toContain('getByRole("textbox", { name: "Prompt", exact: true })');
    expect(verifier).toContain('getByRole("button", { name: "Ask", exact: true })');
    expect(verifier).not.toMatch(/assertSavedDuration|localStorage|video\.generate|<VideoPlayer/);
    expect(verifier).not.toMatch(/const (?:production|development)Port = 43\d{2}/);
  });

  it("keeps live provider acceptance explicitly gated and separate from deterministic CI", () => {
    const packageManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const audit = readFileSync(resolve(root, "docs", "maintainers", "provider-onboarding.md"), "utf8");

    expect(packageManifest.scripts["acceptance:live"]).toBe("tsx scripts/acceptance/run-live.ts");
    expect(packageManifest.scripts["verify:nextjs"]).toBe("node scripts/verify-nextjs-onboarding.mjs");
    expect(audit).toContain("Deterministic CI does not read real provider credentials");
  });
});
