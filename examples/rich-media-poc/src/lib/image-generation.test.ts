import { describe, expect, it, vi } from "vitest";
import { generateSceneImage } from "./image-generation";

describe("generateSceneImage", () => {
  it("keeps the provider credential server-owned", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-test-key" });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "gpt-image-2",
        quality: "low",
        size: "1024x1536",
      });
      return new Response(JSON.stringify({ data: [{ b64_json: "cG9j" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    await expect(generateSceneImage("A glass cube opening into the sky", {
      apiKey: "secret-test-key",
      fetchImpl: fetchMock,
    })).resolves.toEqual({
      imageUrl: "data:image/webp;base64,cG9j",
      model: "gpt-image-2",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/generations",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails clearly without pretending the bundled sample is newly generated", async () => {
    await expect(generateSceneImage("A useful launch image", {
      apiKey: "",
      fetchImpl: vi.fn(),
    })).rejects.toMatchObject({ code: "missing_configuration" });
  });

  it("redacts provider response details", async () => {
    const fetchMock = vi.fn(async () => new Response("private provider detail", { status: 500 }));

    await expect(generateSceneImage("A useful launch image", {
      apiKey: "secret-test-key",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject({
      code: "provider_failure",
      message: "Image generation failed. Try again.",
    });
  });

  it("preserves timeout errors so the route can return the right status", async () => {
    const timeout = new DOMException("timed out", "TimeoutError");
    const fetchMock = vi.fn(async () => { throw timeout; });

    await expect(generateSceneImage("A useful launch image", {
      apiKey: "secret-test-key",
      fetchImpl: fetchMock,
    })).rejects.toBe(timeout);
  });
});
