import { fal } from "@fal-ai/client";
import type { VideoChatHandlerOptions } from "@vanillaskyai/video/server";

const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL ?? "minimax/h3-max/text-to-video";

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
      abortSignal: signal,
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

/** Optional generated video and transcription; credentials remain server-only. */
export const videoProvider: Pick<VideoChatHandlerOptions, "generateVideo" | "transcribe"> = {
  generateVideo: process.env.FAL_KEY
    ? async (query, { generatedLook, orientation, signal }) => ({
        url: await filmScene(query, generatedLook, orientation, signal),
        type: "video" as const,
      })
    : undefined,
  transcribe: process.env.FAL_KEY
    ? async ({ audio, mediaType, signal }) => {
        signal.throwIfAborted();
        fal.config({ credentials: process.env.FAL_KEY });
        const bytes = Uint8Array.from(audio);
        const url = await fal.storage.upload(new Blob([bytes.buffer], { type: mediaType }));
        signal.throwIfAborted();
        const result = await fal.subscribe(process.env.FAL_TRANSCRIBE_MODEL ?? "fal-ai/whisper", {
          input: { audio_url: url, task: "transcribe" },
          abortSignal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
        });
        return String((result?.data as { text?: unknown })?.text ?? "");
      }
    : undefined,
};
