import { afterEach, describe, expect, it, vi } from "vitest";
import { withDeadline } from "../src/video-chat/deadline";

describe("optional work deadlines", () => {
  afterEach(() => vi.useRealTimers());

  it("preserves parent cancellation and aborts an ignoring provider immediately", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    let child: AbortSignal | undefined;
    const result = withDeadline((signal) => { child = signal; return new Promise(() => {}); }, 3_000, parent.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: "AbortError" });
    parent.abort();
    await rejection;
    expect(child?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start work for an already cancelled parent", async () => {
    const parent = new AbortController();
    const reason = new Error("cancelled");
    parent.abort(reason);
    const operation = vi.fn();
    await expect(withDeadline(operation, 3_000, parent.signal)).rejects.toBe(reason);
    expect(operation).not.toHaveBeenCalled();
  });

  it("ignores late rejection after a deadline and cleans up timers", async () => {
    vi.useFakeTimers();
    let rejectLate!: (error: Error) => void;
    const result = withDeadline(() => new Promise((_resolve, reject) => { rejectLate = reject; }), 3_000);
    const rejection = expect(result).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(3_000);
    await rejection;
    rejectLate(new Error("private late failure"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns timely work without leaving timers or cancellation listeners", async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const remove = vi.spyOn(parent.signal, "removeEventListener");
    await expect(withDeadline(() => "ready", 3_000, parent.signal)).resolves.toBe("ready");
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
