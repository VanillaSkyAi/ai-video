import { createXai } from "@ai-sdk/xai";
import { experimental_generateSpeech as synthesizeSpeech } from "ai";
import type { VideoChatHandlerOptions } from "@vanillaskyai/video/server";

/** Optional generated speech; the SDK supplies the browser-voice fallback. */
export const speechProvider: Pick<VideoChatHandlerOptions, "generateSpeech"> = {
  generateSpeech: process.env.XAI_API_KEY
    ? async ({ text, signal }) => {
        const speech = await synthesizeSpeech({
          model: createXai({ apiKey: process.env.XAI_API_KEY }).speech(),
          text,
          abortSignal: signal,
        });
        return {
          audio: speech.audio.uint8Array,
          mediaType: speech.audio.mediaType || "audio/mpeg",
        };
      }
    : undefined,
};
