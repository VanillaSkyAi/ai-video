import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VideoChat } from "@vanillaskyai/video/react";
import { createTemplateRegistry } from "@vanillaskyai/video/templates";
import "@vanillaskyai/video/video-chat.css";
import { definitions } from "../vanillasky";

const templates = createTemplateRegistry({ definitions });

createRoot(document.getElementById("root")!).render(
  <StrictMode><VideoChat options={{ templates }} /></StrictMode>,
);
