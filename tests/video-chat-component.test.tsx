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
            opening: "Tonight, the impossible feels close enough to touch.",
            media: storyMedia,
          },
        ],
      });
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

  it("keeps recoverable diagnostics out of the default UI while preserving the completed answer", async () => {
    const { VideoChat } = await import("../src/react");
    const { checksumVideo } = await import("../src/protocol/checksum");
    const { TEST_VIDEO_STYLE } = await import("./semantic-brand-fixture");
    const baseFetcher = chatFetcher();
    const scene = { id: "recovered", templateId: "media", variables: { texts: "A playable answer", mediaType: "gradient" }, narration: "The ocean brings a new wave to the shore every moment.", timing: { fixedDuration: 4 } };
    const snapshot = { schemaVersion: "0.1" as const, orientation: "landscape" as const, scenes: [scene], style: TEST_VIDEO_STYLE };
    const parts = [
      { type: "response.start", data: { requestId: "recover", format: { orientation: "landscape" }, style: TEST_VIDEO_STYLE, capabilities: { templates: ["media"] } } },
      { type: "scene.add", data: { scene, position: 0 } },
      { type: "response.warning", data: { warning: { code: "provider_warning", category: "provider", message: "Some visuals were replaced so your response can continue.", recoverable: true } } },
      { type: "response.complete", data: { finishReason: "stop", snapshot, checksum: checksumVideo(snapshot) } },
    ];
    const response = new Response(parts.map((part, sequence) => `data: ${JSON.stringify({ protocolVersion: "0.5", eventId: `recover:${sequence}`, runId: "recover", sequence, ...part })}\n\n`).join(""), { headers: { "content-type": "text/event-stream", "x-vanillasky-video-stream": "0.5" } });
    render(<VideoChat options={{
      fetcher: async (input, init) => new URL(String(input), "https://app.example").searchParams.get("action") === "response"
        ? response.clone()
        : baseFetcher(input, init),
      voice: { prepare: async () => ({ seconds: 1 }), speak: async () => {}, pause() {}, resume() {}, setMuted() {} },
    }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Invent a surreal bedtime story" }));
    fireEvent.click(await screen.findByRole("button", { name: "Full response" }));
    await waitFor(() => expect(screen.getByRole("dialog").textContent).toContain("The ocean brings a new wave"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.body.textContent).not.toMatch(/simplified|private-provider-detail|Some visuals/);
  });

  it("still shows an error when no playable response can be produced", async () => {
    const { VideoChat } = await import("../src/react");
    render(<VideoChat options={{ fetcher: chatFetcher() }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Invent a surreal bedtime story" }));
    expect((await screen.findByRole("status")).textContent).toBeTruthy();
  });

  it("hydrates when voice input exists only in the browser", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const { VideoChat } = await import("../src/react");
    const browser = window as unknown as Record<string, unknown>;
    const originalRecognition = browser.SpeechRecognition;
    delete browser.SpeechRecognition;
    const html = renderToString(<VideoChat options={{ fetcher: chatFetcher() }} />);
    browser.SpeechRecognition = class {};
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const root = hydrateRoot(container, <VideoChat options={{ fetcher: chatFetcher() }} />);
    try {
      await waitFor(() => expect(container.querySelector('[aria-label="Ask by voice"]')).toBeTruthy());
      expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration failed/i);
    } finally {
      root.unmount();
      container.remove();
      if (originalRecognition === undefined) delete browser.SpeechRecognition;
      else browser.SpeechRecognition = originalRecognition;
    }
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
        opening: "Tonight, the impossible feels close enough to touch.",
      }),
    }));
    expect(requests.some(({ action }) => action === "opening-media")).toBe(false);
  });
});
