import React from "react";
import { createRoot } from "react-dom/client";
import { VideoChat, type VideoChatVoice } from "../../../src/react";

// Predictable silent voice keeps this browser test independent of OS voices.
// The production voice fallback is exercised separately by the voice suite.
const voice: VideoChatVoice = {
  prepare: async () => ({ seconds: 1 }),
  speak: async (_text, { signal }) => new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 250);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  }),
  pause() {}, resume() {}, setMuted() {},
};

createRoot(document.getElementById("root")!).render(
  <VideoChat options={{ endpoint: "/api/video-chat", mode: "full", voice }} />,
);
