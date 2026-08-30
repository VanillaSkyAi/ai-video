import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const previousLocalDemo = process.env.VANILLASKY_LOCAL_DEMO;
const previousLiveMedia = process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA;
const previousFalKey = process.env.FAL_KEY;
const previousPexelsKey = process.env.PEXELS_API_KEY;
const previousFixtureFallback = process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK;

afterEach(() => {
  if (previousLocalDemo === undefined) delete process.env.VANILLASKY_LOCAL_DEMO;
  else process.env.VANILLASKY_LOCAL_DEMO = previousLocalDemo;
  if (previousLiveMedia === undefined) delete process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA;
  else process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA = previousLiveMedia;
  if (previousFalKey === undefined) delete process.env.FAL_KEY;
  else process.env.FAL_KEY = previousFalKey;
  if (previousPexelsKey === undefined) delete process.env.PEXELS_API_KEY;
  else process.env.PEXELS_API_KEY = previousPexelsKey;
  if (previousFixtureFallback === undefined) delete process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK;
  else process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK = previousFixtureFallback;
});

describe("POST /api/channel", () => {
  it("fails closed outside explicit local demo mode", async () => {
    delete process.env.VANILLASKY_LOCAL_DEMO;
    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ premise: "A strange signal arrives.", sceneCount: 3 }),
    }));

    expect(response.status).toBe(403);
  });

  it("builds the first mixed-media segment with fixtures and no provider keys", async () => {
    process.env.VANILLASKY_LOCAL_DEMO = "1";
    delete process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA;
    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ premise: "A strange signal predicts tomorrow.", sceneCount: 3 }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.segment.sequence).toBe(0);
    expect(body.segment.video.scenes).toHaveLength(3);
    expect(body.segment.scenes.map((scene: { decision: { route: string } }) => scene.decision.route))
      .toEqual(["gradient", "generate-image", "generate-video"]);
    expect(body.segment.continuation.sequence).toBe(1);
  });

  it("does not mask a broken live configuration with fixtures", async () => {
    process.env.VANILLASKY_LOCAL_DEMO = "1";
    process.env.ADAPTIVE_CHANNEL_LIVE_MEDIA = "1";
    delete process.env.FAL_KEY;
    delete process.env.PEXELS_API_KEY;
    delete process.env.ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK;

    const response = await POST(new Request("http://localhost/api/channel", {
      method: "POST",
      body: JSON.stringify({ premise: "A strange signal predicts tomorrow.", sceneCount: 3 }),
    }));

    expect(response.status).toBe(503);
  });
});
