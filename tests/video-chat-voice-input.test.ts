import { describe, expect, it, vi } from "vitest";

describe("default video chat voice input", () => {
  it("transcribes through the configured chat route without losing auth", async () => {
    const { transcribeRecording } = await import("../src/video-chat/use-voice-input");
    const fetcher: typeof fetch = vi.fn(async () => Response.json({ text: "A spoken prompt" }));
    const clip = new Blob(["audio"], { type: "audio/webm" });

    const text = await transcribeRecording(clip, new AbortController().signal, {
      endpoint: "https://app.example/chat?tenant=one",
      headers: { authorization: "Bearer local-session" },
      credentials: "include",
      fetcher,
    });

    expect(text).toBe("A spoken prompt");
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetcher).mock.calls[0]!;
    expect(String(url)).toBe("https://app.example/chat?tenant=one&action=transcription");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer local-session");
    expect(new Headers(init?.headers).get("content-type")).toBe("audio/webm");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe(clip);
  });
});
