import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live channel documentation contract", () => {
  it("documents continuous playback as a first-class use case", () => {
    // Prose is hard-wrapped, so phrases are matched against a single-line form
    // rather than as written -- otherwise an assertion fails purely because a
    // sentence broke across two lines.
    const guide = readFileSync("docs/live-channels.md", "utf8");
    const flowed = guide.replace(/\s+/g, " ");
    const readme = readFileSync("README.md", "utf8");
    const api = readFileSync("PUBLIC-API.md", "utf8");

    expect(readme).toContain("[Live channels](docs/live-channels.md)");

    // The three additions this use case needs, each documented where a reader
    // looking for them would go.
    expect(api).toContain("`resolveVideoBrand(input?: VideoBrandInput): VideoBrand`");
    expect(api).toContain("`loop`");
    expect(api).toContain("`onSceneChange(scene, index)`");

    expect(guide).toContain("loop");
    expect(guide).toContain("onSceneChange");
    expect(guide).toContain("resolveVideoBrand");
    expect(guide).toContain("parseVideo");
    expect(guide).toContain('playbackMode="muted-autoplay"');
    expect(guide).toContain('from "@vanillaskyai/ai-video"');
    expect(guide).toContain('from "@vanillaskyai/ai-video/react"');
    expect(guide).not.toContain(["@vanillaskyai", "sdk"].join("/"));

    // The cost argument is the reason this shape works at all, and the reason a
    // reader should not reach for per-viewer generation.
    expect(flowed).toMatch(/no generation request/i);
    expect(flowed).toMatch(/schedule, not per request/i);

    // Two failure modes a first implementation walks into.
    expect(flowed).toMatch(/onComplete.*never fires for a saved video/i);
    expect(flowed).toMatch(/drift/i);

    // Never replace a good channel with a broken one.
    expect(flowed).toMatch(/leave the previous (version|configuration) in place/i);
  });

  it("marks the live channel example for exact packed-package compilation", () => {
    const guide = readFileSync("docs/live-channels.md", "utf8");
    const verifier = readFileSync("scripts/verify-packed-package.mjs", "utf8");

    expect(guide).toContain("<!-- verify:live-channel-example:start -->");
    expect(guide).toContain("<!-- verify:live-channel-example:end -->");
    expect(verifier).toContain('join(packageRoot, "docs", "live-channels.md")');
    expect(verifier).toContain('join(consumer, "live-channel-example.tsx")');
    expect(verifier).toContain('include: ["live-channel-example.tsx"]');
  });

  it("keeps the documentation chain linked in both directions", () => {
    const guide = readFileSync("docs/live-channels.md", "utf8");
    const persistence = readFileSync("docs/persistence.md", "utf8");
    const protocol = readFileSync("docs/streaming-protocol.md", "utf8");

    expect(persistence).toContain("[Next: Live channels →](live-channels.md)");
    expect(guide).toContain("[Previous: Persistence and replay](persistence.md)");
    expect(guide).toContain("[Next: Streaming protocol →](streaming-protocol.md)");
    expect(protocol).toContain("[Previous: Live channels](live-channels.md)");
  });
});
