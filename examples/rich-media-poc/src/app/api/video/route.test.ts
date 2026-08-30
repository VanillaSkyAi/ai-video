import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";

const previousLocalDemo = process.env.VANILLASKY_LOCAL_DEMO;

afterEach(() => {
  if (previousLocalDemo === undefined) delete process.env.VANILLASKY_LOCAL_DEMO;
  else process.env.VANILLASKY_LOCAL_DEMO = previousLocalDemo;
});

describe("POST /api/video", () => {
  it("fails closed when the local-only demo marker is absent", async () => {
    delete process.env.VANILLASKY_LOCAL_DEMO;
    const response = await POST(new Request("http://localhost/api/video", {
      method: "POST",
      body: JSON.stringify({
        protocolVersion: "0.5",
        requestId: "unauthorized-director",
        input: { input: "Create a launch video." },
      }),
    }));

    expect(response.status).toBe(401);
  });
});
