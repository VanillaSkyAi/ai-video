import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const rootPackage = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  version: string;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function examplePackage(name: string): {
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
} {
  return JSON.parse(readFileSync(resolve(root, "examples", name, "package.json"), "utf8"));
}

describe("documented examples", () => {
  it("keeps first install provider-neutral and public guides free of stale release or model defaults", () => {
    const publicFiles = [
      "README.md",
      "docs/getting-started.md",
      "docs/integrate-nextjs.md",
      "docs/custom-templates.md",
      "examples/nextjs-quickstart/README.md",
      "examples/nextjs-quickstart/.env.example",
      "examples/nextjs-quickstart/src/app/api/video/route.ts",
    ].map((path) => [path, readFileSync(resolve(root, path), "utf8")] as const);
    const readme = publicFiles[0][1];

    expect(readme).toContain("npm install @vanillaskyai/video");
    expect(readme).not.toMatch(/shields\.io|!\[[^\]]*version[^\]]*\]/i);
    expect(readme).not.toMatch(/npm install @vanillaskyai\/video[^\n]*(?:\bai\b|@ai-sdk)/);
    for (const [path, contents] of publicFiles) {
      expect(contents, path).not.toContain("@vanillaskyai/video@0.4.1");
      expect(contents, path).not.toContain("tree/v0.4.1");
      expect(contents, path).not.toContain("gpt-4.1");
    }
  });

  it("gives coding agents one concise public integration path and keeps evaluation guidance maintainer-only", () => {
    const guidePath = resolve(root, "docs/agent-integration.md");
    const evaluationPath = resolve(root, "docs/maintainers/cold-start-evaluation.md");
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const agentInstructions = readFileSync(resolve(root, "AGENTS.md"), "utf8");

    expect(existsSync(guidePath)).toBe(true);
    expect(existsSync(evaluationPath)).toBe(true);
    const guide = readFileSync(guidePath, "utf8");
    const evaluation = readFileSync(evaluationPath, "utf8");
    expect(guide).toContain("## Set up the canonical chat");
    expect(guide).toContain("npx vanillasky init");
    expect(guide).toContain("npx vanillasky doctor");
    expect(guide).toContain("npm run dev");
    expect(guide).toContain("Never read or print a secret value");
    expect(guide).toContain(".env.local");
    expect(guide).not.toMatch(/createVideoHandler|useVideo\(|<VideoPlayer/);
    expect(guide).not.toMatch(/101 demo|proof of concept|cold-start evaluation/i);
    expect(evaluation).toContain("Do not inspect SDK source");
    expect(evaluation).toContain("npm pack --silent --json");
    expect(readme).toContain("[Agent integration guide](docs/agent-integration.md)");
    expect(agentInstructions).toContain("docs/agent-integration.md");
  });

  it("makes video chat the one primary onboarding path", () => {
    const paths = ["README.md", "docs/getting-started.md", "docs/agent-integration.md"];
    for (const path of paths) {
      const guide = readFileSync(resolve(root, path), "utf8");
      expect(guide, path).toContain("npm install @vanillaskyai/video");
      expect(guide, path).toContain("npx vanillasky init");
      expect(guide, path).toContain("npx vanillasky doctor");
      expect(guide, path).toContain("npm run dev");
      expect(guide, path).toMatch(/templates.*browser voice/is);
      expect(guide, path).not.toMatch(/\btutor|\blearner|\blesson|\beducation/i);
    }

    const gettingStarted = readFileSync(resolve(root, "docs/getting-started.md"), "utf8");
    expect(gettingStarted).toContain("<VideoChat />");
    expect(gettingStarted).not.toMatch(/createVideoHandler|useVideo\(|<VideoPlayer/);
    const providerGuide = readFileSync(resolve(root, "docs/provider-integration.md"), "utf8");
    expect(providerGuide.indexOf("npx vanillasky init")).toBeLessThan(providerGuide.indexOf("createVideoChatHandler"));

    const useCases = readFileSync(resolve(root, "docs/use-cases.md"), "utf8");
    const nextjsGuide = readFileSync(resolve(root, "docs/integrate-nextjs.md"), "utf8");
    const nextjsExample = readFileSync(resolve(root, "examples/nextjs-quickstart/README.md"), "utf8");
    expect(useCases).toMatch(/lower-level.*one-shot/is);
    expect(useCases).not.toContain("primary product shape");
    expect(nextjsGuide).toMatch(/lower-level.*one-shot/is);
    expect(nextjsExample).toMatch(/lower-level.*one-shot/is);
    expect(nextjsExample).not.toContain("smallest complete VanillaSky app");
  });

  it("separates low-level soundtrack audio from VideoChat narration", () => {
    const guide = readFileSync(resolve(root, "docs/media-and-audio.md"), "utf8");

    expect(guide).toContain("soundtrack");
    expect(guide).toContain("VideoChat");
    expect(guide).toMatch(/narration.*speech synchronization/is);
    expect(guide).not.toContain("SDK does not provide narration");
  });

  it("documents app-owned AI SDK media generation without adding it to the core install", () => {
    const guide = readFileSync(resolve(root, "docs/media-and-audio.md"), "utf8");
    const example = readFileSync(
      resolve(root, "examples/server-integrations/src/ai-sdk-media.ts"),
      "utf8",
    );

    expect(guide).toContain("npm install ai @ai-sdk/fal");
    expect(guide).toContain("requestId");
    expect(guide).toContain("scene");
    expect(example).toContain("generateImage");
    expect(example).toContain("experimental_generateVideo");
    expect(example).toContain("maxRetries: 0");
    expect(example).toContain("store");
    // Generation must stay app-owned: neither a runtime nor a peer requirement.
    const coreInstall = { ...rootPackage.dependencies, ...rootPackage.peerDependencies };
    expect(coreInstall).not.toHaveProperty("ai");
    expect(coreInstall).not.toHaveProperty("@ai-sdk/fal");
  });

  it("documents Vitest, route-handler, fake-timer, abort, and timeout testing", () => {
    const guide = readFileSync(new URL("../docs/testing.md", import.meta.url), "utf8");
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

    expect(guide).toContain('from "@vanillaskyai/video/test"');
    expect(guide).toContain("createMockVideoPlanner");
    expect(guide).toContain("simulateVideoStream");
    expect(guide).toContain("vi.useFakeTimers()");
    expect(guide).toContain("createVideoHandler");
    expect(guide).toContain("new Request");
    expect(guide).toContain("AbortController");
    expect(guide).toContain("timeoutMs");
    expect(readme).toContain("[Test integrations](docs/testing.md)");
  });

  it("documents which catalog commands execute trusted application code", () => {
    const security = readFileSync(new URL("../docs/security.md", import.meta.url), "utf8");
    expect(security).toContain("trusted application build code");
    expect(security).toMatch(/`vanillasky templates list`[\s\S]*`vanillasky templates describe`/);
    expect(security).toMatch(/`vanillasky templates add`[\s\S]*`--dry-run`[\s\S]*`--diff`/);
    expect(security).toMatch(/`vanillasky templates sync`[\s\S]*`vanillasky templates check`/);
    expect(security).toContain("--builtin");
    expect(security).toContain("does not execute project template modules");
  });

  it("documents that add previews include generated browser and server registries", () => {
    const guide = readFileSync(new URL("../docs/custom-templates.md", import.meta.url), "utf8");

    expect(guide).toMatch(/`--dry-run`[\s\S]*`--diff`[\s\S]*browser and server registries/);
    expect(guide).toMatch(/does not apply\s+any proposed file write/);
    expect(guide).toContain("trusted project source can have its own side effects");
    expect(guide).not.toContain("leave the project byte-identical");
  });

  it("strictly compiles the exact transition semantic value example", () => {
    const guide = readFileSync(resolve(root, "docs/custom-templates.md"), "utf8");
    const source = guide.match(
      /<!-- verify:transition-semantic-value:start -->\s*```tsx\r?\n([\s\S]*?)\r?\n```\s*<!-- verify:transition-semantic-value:end -->/,
    )?.[1];
    expect(source).toBeTruthy();

    const workspace = mkdtempSync(resolve(root, ".transition-semantic-doc-"));
    try {
      writeFileSync(resolve(workspace, "example.tsx"), source!);
      writeFileSync(resolve(workspace, "tsconfig.json"), JSON.stringify({
        compilerOptions: {
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noEmit: true,
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          skipLibCheck: false,
          isolatedModules: true,
        },
        include: ["example.tsx"],
      }));
      execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "tsconfig.json"], {
        cwd: workspace,
        stdio: "inherit",
      });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 15_000);
  it.each(["react-vite", "server-integrations", "nextjs-quickstart"])(
    "%s pins the repository's current public protocol version",
    (name) => {
      expect(examplePackage(name).dependencies["@vanillaskyai/video"]).toBe(rootPackage.version);
    },
  );

  it("includes a committed copy-and-run full-stack Next.js quickstart", () => {
    const exampleRoot = resolve(root, "examples", "nextjs-quickstart");
    expect(existsSync(resolve(exampleRoot, "package.json"))).toBe(true);
    expect(existsSync(resolve(exampleRoot, "src/app/api/video/route.ts"))).toBe(true);
    expect(existsSync(resolve(exampleRoot, "src/app/page.tsx"))).toBe(true);
  });

  it("exposes separate verification for documented examples and the packed candidate", () => {
    expect(rootPackage.scripts["examples:verify-documented"]).toBe(
      "node scripts/verify-documented-examples.mjs",
    );
    expect(rootPackage.scripts["examples:install-current"]).toBe(
      "npm run build && node scripts/install-current-examples.mjs",
    );
    expect(rootPackage.scripts["verify:nextjs"]).toBe(
      "node scripts/verify-nextjs-onboarding.mjs",
    );
  });

  it("runs documented commands against the unpublished packed candidate", () => {
    const verifier = readFileSync(resolve(root, "scripts/verify-documented-examples.mjs"), "utf8");
    const installer = readFileSync(resolve(root, "scripts/install-current-examples.mjs"), "utf8");
    const onboarding = readFileSync(resolve(root, "scripts/verify-onboarding.mjs"), "utf8");
    expect(verifier).toContain('"pack", "--silent", "--json", "--pack-destination", workspace');
    expect(verifier).toContain('manifest.dependencies["@vanillaskyai/video"] = `file:${candidateTarball}`');
    expect(verifier).toContain("installedVersion !== candidateVersion");
    expect(verifier).toContain('npm_config_audit: "false"');
    expect(verifier).toContain('npm_config_fund: "false"');
    expect(verifier).not.toContain('{ name: "video-chat"');
    expect(installer).not.toContain('{ name: "video-chat"');
    expect(onboarding).toContain('runCli(["init"])');
    expect(onboarding).toContain('responds in video, not text');
  });
});
