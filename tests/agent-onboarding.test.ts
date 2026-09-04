import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("human and agent onboarding", () => {
  it("offers one obvious package command and one optional agent command", () => {
    const readme = read("README.md");
    const product = readme.indexOf("VanillaSky is the open-source video response layer");
    const install = readme.indexOf("npm install @vanillaskyai/video");
    const skill = readme.indexOf("npx skills add VanillaSkyAi/video@vanillasky");

    expect(product).toBeGreaterThanOrEqual(0);
    expect(install).toBeGreaterThan(product);
    expect(skill).toBeGreaterThan(install);
    expect(readme).not.toMatch(/npm install @vanillaskyai\/video[^\n]*(?:\bai\b|@ai-sdk)/);
    expect(readme).toContain("Use $vanillasky to turn this application's data into a personalized video response.");
    expect(readme.split("\n").length).toBeLessThan(200);
  });

  it("ships a generic VanillaSky video-chat setup skill", () => {
    const skillRoot = resolve(root, "skills", "vanillasky");
    expect(existsSync(resolve(skillRoot, "SKILL.md"))).toBe(true);
    expect(existsSync(resolve(skillRoot, "agents/openai.yaml"))).toBe(true);
    const source = read("skills/vanillasky/SKILL.md");
    const metadata = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

    expect(metadata).toContain("name: vanillasky");
    expect(metadata).toContain("@vanillaskyai/video");
    expect(metadata).not.toMatch(/POC|101|cold-start|evaluation|HyperFrames|Remotion/i);
    expect(source).toContain("npm install @vanillaskyai/video");
    expect(source).not.toMatch(/npm install @vanillaskyai\/video[^\n]*(?:\bai\b|@ai-sdk)/);
    expect(source).toContain("npx vanillasky init");
    expect(source).toContain("npx vanillasky doctor");
    expect(source).toContain("npm run dev");
    expect(source).toContain("templates + browser voice");
    expect(source).toContain("generated video");
    expect(source).toContain("ignored `.env.local`");
    expect(source).not.toMatch(/\btutor|\blearner|\blesson|\beducation/i);
    expect(source).not.toMatch(/createVideoHandler|useVideo\(|<VideoPlayer/);
  });

  it("makes the agent verify the canonical chat in a real browser without handling secrets", () => {
    const source = read("skills/vanillasky/SKILL.md");
    const agent = read("skills/vanillasky/agents/openai.yaml");

    expect(source).toMatch(/real browser/i);
    expect(source).toMatch(/explain|explanatory/i);
    expect(source).toMatch(/creative prompt/i);
    expect(source).toMatch(/console errors/i);
    expect(source).toMatch(/never (?:ask for|request|read|print|echo|display)[^\n]*secret/i);
    expect(source).toMatch(/doctor[^\n]*generated video/i);
    expect(agent).toContain("video chat");
    expect(agent).not.toMatch(/personalized video response|tutor|learning/i);
  });

  it("keeps the public agent guide task-focused and evaluation rules maintainer-only", () => {
    const publicGuide = read("docs/agent-integration.md");
    const maintainerGuide = read("docs/maintainers/cold-start-evaluation.md");
    const agents = read("AGENTS.md");

    expect(publicGuide).toContain("input");
    expect(publicGuide).toContain("createVideoHandler");
    expect(publicGuide).toContain("useVideo");
    expect(publicGuide).not.toMatch(/choose.*101|proof of concept|candidate tarball|fresh consumer directory/i);
    expect(maintainerGuide).toMatch(/cold-start evaluation/i);
    expect(maintainerGuide).toContain("fresh consumer");
    expect(agents).toContain("Only for an explicit cold-start evaluation");
  });
});
