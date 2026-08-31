import type { VideoPlayerProps } from "@vanillaskyai/video/react";
import { warmImage } from "./media-preload";
import { StartupBufferGate } from "./startup-buffer";
import type { ResolvedChannelScene } from "./types";

type PlayerEventStream = Exclude<VideoPlayerProps["stream"], undefined>;

export type ChannelPlayerStream = PlayerEventStream & {
  cancel(reason?: string): void;
};

export type ChannelStreamMessage =
  | { kind: "mode"; mode: "fixture" | "live" | "live-with-fixture-fallback"; targetBufferSeconds: number }
  | { kind: "chapter-start"; sequence: number; sceneCount: number }
  | {
      kind: "scene";
      chapterSequence: number;
      resolved: ResolvedChannelScene;
      scheduling: { queuedMs: number; generationMs: number; clientWarmMs?: number };
      bufferSeconds: number;
    }
  | { kind: "buffer"; bufferSeconds: number; waiting: boolean }
  | { kind: "chapter"; sequence: number; peakConcurrency: number; bufferSeconds: number }
  | { kind: "playback-ready"; startupBufferSeconds: number }
  | { kind: "complete"; reason: "chapter-limit"; chapters: number }
  | { kind: "error"; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

async function warmResolvedMedia(scene: ResolvedChannelScene, signal: AbortSignal): Promise<number> {
  const startedAt = performance.now();
  const { media } = scene;
  if (media.type === "gradient") return 0;
  if (media.type === "image") {
    await warmImage(media.url, signal);
    return Math.max(0, performance.now() - startedAt);
  }
  if (media.posterUrl) await warmImage(media.posterUrl, signal);
  if (typeof document === "undefined") return Math.max(0, performance.now() - startedAt);
  await new Promise<void>((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      video.onloadeddata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve();
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      reject(new DOMException("Channel generation was cancelled.", "AbortError"));
    };
    const timer = window.setTimeout(finish, 5_000);
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = finish;
    video.onerror = finish;
    signal.addEventListener("abort", cancel, { once: true });
    video.src = media.url;
    video.load();
  });
  return Math.max(0, performance.now() - startedAt);
}

export function createChannelPlayerStream(
  input: Record<string, unknown>,
  onMessage: (message: ChannelStreamMessage) => void,
): ChannelPlayerStream {
  const controller = new AbortController();
  const source = (async function* (): AsyncGenerator<unknown> {
    const response = await fetch("/api/channel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error || "The channel could not start.");
    }
    if (!response.body) throw new Error("The channel endpoint returned no stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const startupBufferSeconds = 8;
    const startupGate = new StartupBufferGate<unknown>(startupBufferSeconds);
    const readyDurations: number[] = [];
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as unknown;
          if (!isRecord(message) || typeof message.kind !== "string") continue;
          if (message.kind === "video" && isRecord(message.event)) {
            if (message.event.type === "response.start") {
              yield message.event;
              continue;
            }
            if (message.event.type === "scene.add") {
              const gated = startupGate.push(message.event, readyDurations.shift() || 0);
              if (gated.openedNow) onMessage({ kind: "playback-ready", startupBufferSeconds });
              for (const event of gated.events) yield event;
              continue;
            }
            for (const event of startupGate.flush()) yield event;
            yield message.event;
            continue;
          }
          if (message.kind === "scene") {
            const sceneMessage = message as ChannelStreamMessage & { kind: "scene" };
            sceneMessage.scheduling.clientWarmMs = await warmResolvedMedia(sceneMessage.resolved, controller.signal);
            readyDurations.push(sceneMessage.resolved.plan.durationSec);
          }
          onMessage(message as ChannelStreamMessage);
          if (message.kind === "error") return;
        }
        if (done) break;
      }
      for (const event of startupGate.flush()) yield event;
    } finally {
      if (controller.signal.aborted) {
        await reader.cancel(controller.signal.reason).catch(() => undefined);
      }
      reader.releaseLock();
    }
  })();

  return Object.assign(source, {
    cancel(reason = "Channel stopped") {
      controller.abort(new DOMException(reason, "AbortError"));
      void source.return(undefined).catch(() => undefined);
    },
  }) as unknown as ChannelPlayerStream;
}
