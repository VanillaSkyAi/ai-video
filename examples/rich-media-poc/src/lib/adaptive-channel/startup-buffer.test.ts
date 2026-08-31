import { describe, expect, it } from "vitest";
import { StartupBufferGate } from "./startup-buffer";

describe("channel startup buffer", () => {
  it("holds early scene events until enough playable duration is ready, then stays open", () => {
    const gate = new StartupBufferGate<string>(8);

    expect(gate.push("title", 3)).toEqual({ events: [], openedNow: false });
    expect(gate.push("image", 5)).toEqual({ events: ["title", "image"], openedNow: true });
    expect(gate.push("video", 5)).toEqual({ events: ["video"], openedNow: false });
  });

  it("can flush a short or failed stream without losing resolved scenes", () => {
    const gate = new StartupBufferGate<string>(8);
    gate.push("title", 3);

    expect(gate.flush()).toEqual(["title"]);
    expect(gate.flush()).toEqual([]);
  });
});
