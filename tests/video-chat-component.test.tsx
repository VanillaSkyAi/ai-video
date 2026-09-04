// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { UseVideoChatOptions } from "../src/react";

function chatFetcher(
  requests: Array<{ action: string | null; body?: unknown }> = [],
  storyMedia: { url: string; type: "video" } | null = null,
): typeof fetch {
  return vi.fn(async (input, init) => {
    const url = new URL(String(input), "https://app.example");
    const action = url.searchParams.get("action");
    requests.push({
      action,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    if (action === "capabilities") {
      return Response.json({
        templates: true,
        generatedSpeech: false,
        generatedVideo: false,
        stockMedia: false,
        transcription: false,
        modes: ["templates"],
      });
    }
    if (action === "welcome") {
      return Response.json({
        hero: null,
        cards: [
          { prompt: "Explain why the sky changes colour", media: null },
          {
            prompt: "Invent a surreal bedtime story",
            media: storyMedia,
          },
        ],
      });
    }
    if (action === "opening") {
      return Response.json({ line: "Tonight, the impossible feels close enough to touch.", keyword: "surreal night" });
    }
    if (action === "opening-media") return Response.json({ media: null });
    return new Response("Unavailable in this UI test", { status: 503 });
  });
}

describe("VideoChat", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the complete general-purpose experience from the React entry", async () => {
    const { VideoChat } = await import("../src/react");
    const options: UseVideoChatOptions = { fetcher: chatFetcher() };

    const { container } = render(<VideoChat options={options} className="customer-shell" />);

    expectTypeOf(VideoChat).toBeFunction();
    const root = container.querySelector(".vanillasky-video-chat");
    expect(root?.getAttribute("data-theme")).toBe("system");
    expect(root?.classList.contains("customer-shell")).toBe(true);
    expect(await screen.findByText("in video, not text.")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Explain why the sky changes colour" })).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("uses unique control ids and keeps appearance on each component root", async () => {
    const { VideoChat } = await import("../src/react");
    const { container } = render(<><VideoChat options={{ fetcher: chatFetcher() }} /><VideoChat options={{ fetcher: chatFetcher() }} /></>);
    const settings = await screen.findAllByRole("button", { name: "Settings" });
    const controlIds = settings.map((button) => button.getAttribute("aria-controls"));
    expect(new Set(controlIds).size).toBe(2);

    fireEvent.click(settings[0]!);
    fireEvent.click(await screen.findByRole("radio", { name: "Light" }));

    const roots = container.querySelectorAll(".vanillasky-video-chat");
    expect(roots[0]?.getAttribute("data-theme")).toBe("light");
    expect(roots[1]?.getAttribute("data-theme")).toBe("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    const source = readFileSync(join(process.cwd(), "src/video-chat/video-chat.tsx"), "utf8");
    expect(source).not.toContain('aria-haspopup="menu"');
  });

  it("submits welcome cards through the configured endpoint", async () => {
    const { VideoChat } = await import("../src/react");
    const requests: Array<{ action: string | null; body?: unknown }> = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const { container } = render(<VideoChat options={{
      endpoint: "/my/video",
      fetcher: chatFetcher(requests, { url: "https://media.example/surreal-story.mp4", type: "video" }),
    }} />);

    fireEvent.click(await screen.findByRole("button", { name: "Invent a surreal bedtime story" }));
    await waitFor(() => expect(container.querySelector(".stage video")?.getAttribute("src"))
      .toBe("https://media.example/surreal-story.mp4"));
    await waitFor(() => expect(requests).toContainEqual({
      action: "response",
      body: expect.objectContaining({
        prompt: "Invent a surreal bedtime story",
        spokenHook: "Tonight, the impossible feels close enough to touch.",
      }),
    }));
    expect(requests.some(({ action }) => action === "opening-media")).toBe(false);
  });
});
