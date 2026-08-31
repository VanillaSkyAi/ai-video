import { afterEach, describe, expect, it, vi } from "vitest";
import { createChannelPlayerStream } from "./channel-stream";

describe("progressive channel player stream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cancels the response body when the viewer stops during playback", async () => {
    const cancelBody = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${JSON.stringify({
          kind: "video",
          event: { type: "response.start", id: "local-channel" },
        })}\n`));
      },
      cancel: cancelBody,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const stream = createChannelPlayerStream({}, vi.fn());
    const iterator = stream as unknown as AsyncGenerator<unknown>;
    await expect(iterator.next()).resolves.toMatchObject({
      value: { type: "response.start", id: "local-channel" },
      done: false,
    });

    stream.cancel("Stopped in test");

    await vi.waitFor(() => expect(cancelBody).toHaveBeenCalledOnce());
  });

  it("preserves an application error without converting it into a player transport failure", async () => {
    const startEvent = { type: "response.start", id: "local-channel" };
    const applicationError = { kind: "error", error: "Fal rejected story planning. Check account credit." };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode([
          JSON.stringify({ kind: "video", event: startEvent }),
          JSON.stringify(applicationError),
          "",
        ].join("\n")));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const onMessage = vi.fn();
    const stream = createChannelPlayerStream({}, onMessage);

    const consume = async () => {
      const events: unknown[] = [];
      for await (const event of stream) events.push(event);
      return events;
    };

    await expect(consume()).resolves.toEqual([startEvent]);
    expect(onMessage).toHaveBeenCalledWith(applicationError);
  });
});
