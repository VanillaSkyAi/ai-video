// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { UseVideoChatResult } from "../src/video-chat/use-video-chat";
import { VideoChat } from "../src/video-chat/video-chat";

const session = vi.hoisted(() => ({ current: {} as UseVideoChatResult }));
vi.mock("../src/video-chat/use-video-chat", () => ({ useVideoChatSession: () => ({ chat: session.current, restoreSession: vi.fn() }) }));

vi.mock("../src/player/video-player", () => ({ VideoPlayer: (props: { orientation?: string }) => <div data-testid="player" data-orientation={props.orientation} /> }));

beforeEach(() => {
  const turn = { id: "one", prompt: "Explain tides", completed: true, orientation: "landscape" as const, fixedOrientation: false, suggestions: [], opening: "The Moon moves our oceans." };
  session.current = {
    ask: vi.fn(async () => undefined), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), replay: vi.fn(), selectTurn: vi.fn(), reset: vi.fn(), setMuted: vi.fn(),
    turns: [turn], currentTurn: turn, shownTurn: turn, availableModes: ["templates"], status: "playing", warnings: [], suggestions: [],
    caption: "The tide rises.", transcript: ["The Moon moves our oceans.", "The tide rises.", "Then the tide falls."], speaking: true, muted: false, playbackEnded: false, playerKey: 0,
  };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("replaces full-response and appearance controls with subtitle preferences", () => {
  render(<VideoChat />);
  expect(screen.queryByRole("button", { name: "Full response" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.queryByText("Appearance")).toBeNull();
  expect(screen.getByRole("switch", { name: "Subtitles Read along with the answer" })).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Keep controls visible Keep the input bar on screen" })).toBeTruthy();
});

it("expands the available transcript, hides it and restores subtitles", () => {
  render(<VideoChat />);
  fireEvent.click(screen.getByRole("button", { name: "Expand subtitles" }));
  const transcript = screen.getByRole("region", { name: "Expanded subtitles" });
  expect(transcript.textContent).toContain("The Moon moves our oceans.");
  expect(transcript.textContent).toContain("Then the tide falls.");
  fireEvent.click(screen.getByRole("button", { name: "Hide subtitles" }));
  expect(screen.queryByRole("region", { name: "Expanded subtitles" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("switch", { name: "Subtitles Read along with the answer" }));
  expect(screen.getByRole("button", { name: "Expand subtitles" })).toBeTruthy();
});

it("pauses to type a follow-up and resumes on canceling the question", () => {
  render(<VideoChat />);
  fireEvent.focus(screen.getByRole("textbox", { name: "Prompt" }));
  expect(session.current.pause).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), { target: { value: "Why twice daily?" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel question" }));
  expect(session.current.resume).toHaveBeenCalledOnce();
  expect(session.current.ask).not.toHaveBeenCalled();
});

it("submits a follow-up without resuming the previous answer", () => {
  render(<VideoChat />);
  fireEvent.focus(screen.getByRole("textbox", { name: "Prompt" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Prompt" }), { target: { value: "Why twice daily?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(session.current.ask).toHaveBeenCalledWith("Why twice daily?", undefined);
  expect(session.current.resume).not.toHaveBeenCalled();
});


it("keeps a deliberately paused answer paused when canceling a follow-up", () => {
  session.current.status = "paused";
  render(<VideoChat />);
  fireEvent.focus(screen.getByRole("textbox", { name: "Prompt" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel question" }));
  expect(session.current.pause).not.toHaveBeenCalled();
  expect(session.current.resume).not.toHaveBeenCalled();
});


it.each([
  { fixedPortrait: false, expected: "landscape" },
  { fixedPortrait: true, expected: "portrait" },
])("matches player and frame orientation on a landscape phone (fixed portrait=$fixedPortrait)", ({ fixedPortrait, expected }) => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") && !query.includes("orientation: portrait"),
    addEventListener() {}, removeEventListener() {},
  }));
  window.matchMedia = globalThis.matchMedia;
  session.current.shownTurn = { ...session.current.shownTurn!, fixedOrientation: fixedPortrait, orientation: fixedPortrait ? "portrait" : "landscape" };
  session.current.playerProps = { orientation: "auto" };
  const { container } = render(<VideoChat />);
  expect(container.querySelector(".vanillasky-video-chat")?.getAttribute("data-orientation")).toBe(expected);
  expect(screen.getByTestId("player").getAttribute("data-orientation")).toBe(expected);
  expect(container.querySelector<HTMLElement>(".player-fit")?.style.width).toContain(fixedPortrait ? "56.25" : "177.7778");
});

it("offers SDK discovery without leaving the current conversation", () => {
  render(<VideoChat />);
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const links = [
    ["Get the SDK", "https://vanillasky.ai/docs/getting-started/"],
    ["View on GitHub", "https://github.com/VanillaSkyAi/video"],
  ];
  for (const [name, href] of links) {
    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  }
  expect(session.current.reset).not.toHaveBeenCalled();
});
