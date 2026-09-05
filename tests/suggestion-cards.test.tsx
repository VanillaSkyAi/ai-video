// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SuggestionCards } from "../src/video-chat/suggestion-cards";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("keeps video posters available for inactive cards and denied autoplay", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new DOMException("Autoplay blocked", "NotAllowedError"));
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const { container } = render(<SuggestionCards label="Suggested prompts" onAsk={() => {}} suggestions={[
    {prompt:"Why do atoms bond?",media:{type:"video",url:"https://media.example/atom.mp4",posterUrl:"https://media.example/atom.jpg"}},
    {prompt:"Why did dinosaurs disappear?",media:{type:"video",url:"https://media.example/dinosaur.mp4",posterUrl:"https://media.example/dinosaur.jpg"}},
  ]} />);
  await Promise.resolve();
  const videos = container.querySelectorAll("video");
  expect(videos[0]!.poster).toBe("https://media.example/atom.jpg");
  expect(videos[1]!.poster).toBe("https://media.example/dinosaur.jpg");
  expect(videos[1]!.autoplay).toBe(false);
  expect(container.querySelectorAll("img.frame-poster")).toHaveLength(2);
  fireEvent.playing(videos[0]!);
  expect(container.querySelectorAll("img.frame-poster")).toHaveLength(1);
  fireEvent.error(videos[0]!);
  expect(container.querySelectorAll("img.frame-poster")).toHaveLength(2);
});
