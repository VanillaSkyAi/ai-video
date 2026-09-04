import { anthropic } from "@ai-sdk/anthropic";
import { fal } from "@fal-ai/client";
import { createXai } from "@ai-sdk/xai";
import {
  experimental_generateSpeech as synthesizeSpeech,
  generateText,
  streamText,
} from "ai";
import { createVideoChatHandler } from "@vanillaskyai/video/server";
import { findStockFootage } from "./stock";

const PLANNER_MODEL = process.env.ANTHROPIC_PLANNER_MODEL ?? "claude-sonnet-5";
const NARRATION_MODEL = process.env.ANTHROPIC_NARRATION_MODEL ?? "claude-haiku-4-5";
const OPENING_MODEL = process.env.ANTHROPIC_OPENING_MODEL ?? "claude-haiku-4-5";
const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL ?? "minimax/h3-max/text-to-video";
const SHOT_DEADLINE_MS = 180_000;

async function filmScene(
  subject: string,
  generatedLook: string | undefined,
  orientation: "portrait" | "landscape",
  signal: AbortSignal,
) {
  fal.config({ credentials: process.env.FAL_KEY });
  const started = Date.now();
  console.log(`[video-chat] filming: ${subject.slice(0, 70)}`);
  try {
    const result = await fal.subscribe(VIDEO_MODEL, {
      input: {
        prompt: [
          `Locked-off shot, ${orientation === "portrait" ? "9:16 vertical" : "16:9"}. ${subject}.`,
          "One slow continuous camera move. Physically plausible motion.",
          "No on-screen text, captions, subtitles, watermarks or logos.",
          "Diegetic sound only. No music, no voiceover.",
          generatedLook,
        ].filter(Boolean).join("\n\n"),
        duration: 5,
        resolution: "480P",
        aspect_ratio: orientation === "portrait" ? "9:16" : "16:9",
      },
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(SHOT_DEADLINE_MS)]),
    });
    const url = result?.data?.video?.url;
    if (typeof url !== "string") throw new Error("the video provider returned no url");
    console.log(`[video-chat] filmed in ${Date.now() - started}ms`);
    return url;
  } catch (cause) {
    const status = (cause as { status?: unknown })?.status;
    console.error(
      `[video-chat] filming failed after ${Date.now() - started}ms${typeof status === "number" ? ` (status ${status})` : ""}`,
    );
    throw cause;
  }
}

/**
 * The application chooses providers and keeps their credentials here. The SDK
 * owns the video-chat protocol, prompts, capability negotiation, spend limits,
 * and HTTP responses.
 */
export const handleVideoChat = createVideoChatHandler({
  authorize: (request) => new URL(request.url).hostname === "localhost",
  streamText: ({ systemPrompt, userPrompt, signal }) => streamText({
    model: anthropic(PLANNER_MODEL),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: signal,
    maxOutputTokens: 8_192,
    providerOptions: {
      anthropic: {
        thinking: { type: "disabled" },
        output_config: { effort: "medium" },
      },
    },
    onFinish: ({ finishReason, text }) => {
      if (finishReason !== "stop") console.warn(`[planner] ${finishReason}: ${text.slice(0, 300)}`);
      const keyed = (text.match(/"mediaKeyword"/g) ?? []).length;
      console.log(`[planner] ${(text.match(/"scene\.add"/g) ?? []).length} scenes, ${keyed} asked for footage`);
    },
  }),
  generateText: async ({ task, systemPrompt, userPrompt, maxOutputTokens, signal }) => {
    const { text } = await generateText({
      model: anthropic(task === "opening" || task === "opening-continuation" ? OPENING_MODEL : NARRATION_MODEL),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens,
      abortSignal: signal,
    });
    return text;
  },
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
  transcribe: process.env.FAL_KEY
    ? async ({ audio, mediaType, signal }) => {
        fal.config({ credentials: process.env.FAL_KEY });
        const bytes = Uint8Array.from(audio);
        const url = await fal.storage.upload(new Blob([bytes.buffer], { type: mediaType }));
        const result = await fal.subscribe(process.env.FAL_TRANSCRIBE_MODEL ?? "fal-ai/whisper", {
          input: { audio_url: url, task: "transcribe" },
          abortSignal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
        });
        return String((result?.data as { text?: unknown })?.text ?? "");
      }
    : undefined,
  searchMedia: process.env.PEXELS_API_KEY
    ? (query, { orientation, signal }) => findStockFootage(query, orientation, signal)
    : undefined,
  generateVideo: process.env.FAL_KEY
    ? async (query, { generatedLook, orientation, signal }) => ({
        url: await filmScene(query, generatedLook, orientation, signal),
        type: "video" as const,
      })
    : undefined,
  welcome: {
    heroQuery: process.env.VIDEO_CHAT_WELCOME_KEYWORD ?? "underwater ocean sunlight",
    prompts: [
      { prompt: "Why does the Moon always show one face?", mediaQuery: "full moon night sky" },
      { prompt: "Tell me a tiny story about a robot growing a garden on Mars", mediaQuery: "robot garden mars" },
      { prompt: "Recommend a perfect rainy afternoon in Amsterdam", mediaQuery: "Amsterdam rain cafe" },
      { prompt: "Pitch a playful ad for a coffee mug that never spills", mediaQuery: "coffee mug desk" },
    ],
  },
  onError: (error) => console.error("[video-chat] planning failed:", error.message),
  onWarning: (warning) => console.warn(`[video-chat] ${warning.code}: ${warning.message}`),
  mediaConcurrency: 5,
});
