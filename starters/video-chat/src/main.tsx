import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><VideoChat /></StrictMode>,
);
