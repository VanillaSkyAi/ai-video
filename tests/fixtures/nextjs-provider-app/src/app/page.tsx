"use client";

import { VideoChat } from "@vanillaskyai/video/react";
import "@vanillaskyai/video/video-chat.css";
import { templates } from "../../vanillasky";

export default function Page() {
  return <VideoChat options={{ templates }} />;
}
