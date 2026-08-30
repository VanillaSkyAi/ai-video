import { describe, expect, it } from "vitest";
import { createDeadlineBudget } from "./deadline-budget";

describe("channel generation deadline", () => {
  it("decrements remaining playback buffer as sequential media jobs consume time", () => {
    let now = 1_000;
    const remaining = createDeadlineBudget(15, () => now);

    expect(remaining()).toBe(15);
    now += 3_400;
    expect(remaining()).toBeCloseTo(11.6, 5);
    now += 20_000;
    expect(remaining()).toBe(0);
  });
});
