import type {
  VideoBrandInput,
  VideoOrientation,
  VideoScene,
  VideoStyleOptions,
} from "../protocol/types.js";
import {
  createVideoHandler,
  type VideoHandlerOptions,
} from "./create-video-handler.js";
import type { ResolvedMedia } from "./media-resolver.js";
import { MAX_RETAINED_MEDIA_URL_LENGTH } from "../protocol/persistence.js";
import {
  createNarrationUserPrompt,
  createVideoChatResponseInstructions,
  VIDEO_CHAT_NARRATION_PROMPT,
  VIDEO_CHAT_OPENING_CONTINUATION_PROMPT,
  VIDEO_CHAT_OPENING_PROMPT,
  VIDEO_CHAT_SUGGESTIONS_PROMPT,
} from "./video-chat-prompts.js";
import type {
  VideoChatCapabilities,
  VideoChatConversationTurn,
  VideoChatMode,
  VideoChatWelcomeOptions,
  VideoChatWelcomePrompt,
} from "../video-chat/types.js";

export type {
  VideoChatCapabilities,
  VideoChatConversationTurn,
  VideoChatMode,
  VideoChatWelcomeOptions,
  VideoChatWelcomePrompt,
} from "../video-chat/types.js";

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_PROMPT_CHARACTERS = 8_000;
const MAX_CONVERSATION_TURNS = 12;
const MAX_CONVERSATION_RESPONSE_CHARACTERS = 8_000;

export type VideoChatTextTask =
  | "opening"
  | "opening-continuation"
  | "narration"
  | "suggestions";

export interface VideoChatTextContext {
  task: VideoChatTextTask;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export type VideoChatTextGenerator = (
  context: VideoChatTextContext,
) => string | Promise<string>;

export interface VideoChatSpeechContext {
  text: string;
  signal: AbortSignal;
}

export interface VideoChatSpeechResult {
  audio: Uint8Array | ArrayBuffer;
  mediaType?: string;
}

export type VideoChatSpeechGenerator = (
  context: VideoChatSpeechContext,
) => VideoChatSpeechResult | Promise<VideoChatSpeechResult>;

export interface VideoChatTranscriptionContext {
  audio: Uint8Array;
  mediaType: string;
  signal: AbortSignal;
}

export type VideoChatTranscriber = (
  context: VideoChatTranscriptionContext,
) => string | Promise<string>;

export interface VideoChatMediaContext {
  purpose: "response" | "welcome" | "suggestion";
  orientation: VideoOrientation;
  generatedLook?: string;
  signal: AbortSignal;
  requestId?: string;
  scene?: Readonly<VideoScene>;
  templateId?: string;
  preferredType?: "image" | "video" | "any";
}

export type VideoChatMediaResolver = (
  query: string,
  context: VideoChatMediaContext,
) => ResolvedMedia | null | Promise<ResolvedMedia | null>;

export interface VideoChatHandlerOptions extends Omit<
  VideoHandlerOptions,
  "allowMediaUrl" | "basePrompt" | "maxResolvedMedia" | "narrate" | "resolveMedia"
> {
  /** Generate the small non-streaming text tasks around the visual plan. */
  generateText: VideoChatTextGenerator;
  /** Optional generated speech. Browsers can speak locally when absent. */
  generateSpeech?: VideoChatSpeechGenerator;
  /** Optional server transcription used when browser recognition is unavailable. */
  transcribe?: VideoChatTranscriber;
  /** Optional stock or application-owned media search. */
  searchMedia?: VideoChatMediaResolver;
  /** Optional generated-video provider. Its presence enables paid visual modes. */
  generateVideo?: VideoChatMediaResolver;
  /** Trusted application guidance appended to the general-purpose response brief. */
  instructions?: string;
  /** Application-owned prompts and visual searches shown before the first turn. */
  welcome?: VideoChatWelcomeOptions;
  /** Maximum accepted transcription body. Defaults to 8 MiB. */
  maxAudioBytes?: number;
}

export type VideoChatHandler = (request: Request) => Promise<Response>;

interface ParsedResponseRequest {
  prompt: string;
  mode: VideoChatMode;
  orientation: VideoOrientation;
  conversation: VideoChatConversationTurn[];
  brand?: VideoBrandInput;
  style?: VideoStyleOptions;
}

interface SuggestionSubject {
  prompt: string;
  keyword: string;
}

const DEFAULT_WELCOME_PROMPTS: readonly VideoChatWelcomePrompt[] = [
  { prompt: "Why does the Moon always show one face?", mediaQuery: "full moon night sky" },
  { prompt: "Tell me a tiny story about a robot growing a garden on Mars", mediaQuery: "robot garden mars" },
  { prompt: "Recommend a perfect rainy afternoon in Amsterdam", mediaQuery: "Amsterdam rain cafe" },
  { prompt: "Pitch a playful ad for a coffee mug that never spills", mediaQuery: "coffee mug desk" },
];

function jsonError(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers });
}

function allowedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const permitted = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !permitted.has(key));
  if (unexpected) throw new Error(`${label}.${unexpected} is not supported`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function boundedString(value: unknown, label: string, maximum = MAX_PROMPT_CHARACTERS): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  const trimmed = value.trim();
  if ([...trimmed].length > maximum) throw new Error(`${label} is too long`);
  return trimmed;
}

function parseResponseRequest(value: unknown): ParsedResponseRequest {
  const body = record(value, "request");
  allowedKeys(body, ["prompt", "mode", "orientation", "conversation", "brand", "style"], "request");
  const mode = body.mode ?? "templates";
  if (mode !== "templates" && mode !== "some" && mode !== "full") {
    throw new Error("request.mode must be templates, some, or full");
  }
  const orientation = body.orientation ?? "landscape";
  if (orientation !== "portrait" && orientation !== "landscape") {
    throw new Error("request.orientation must be portrait or landscape");
  }
  const conversation = body.conversation == null ? [] : body.conversation;
  if (!Array.isArray(conversation) || conversation.length > MAX_CONVERSATION_TURNS) {
    throw new Error(`request.conversation must contain at most ${MAX_CONVERSATION_TURNS} turns`);
  }
  return {
    prompt: boundedString(body.prompt, "request.prompt"),
    mode,
    orientation,
    conversation: conversation.map((value, index) => {
      const turn = record(value, `request.conversation[${index}]`);
      allowedKeys(turn, ["prompt", "response"], `request.conversation[${index}]`);
      return {
        prompt: boundedString(turn.prompt, `request.conversation[${index}].prompt`),
        ...(turn.response == null
          ? {}
          : { response: boundedString(turn.response, `request.conversation[${index}].response`, MAX_CONVERSATION_RESPONSE_CHARACTERS) }),
      };
    }),
    ...(body.brand == null ? {} : { brand: body.brand as VideoBrandInput }),
    ...(body.style == null ? {} : { style: body.style as VideoStyleOptions }),
  };
}

function conversationInput(prompt: string, conversation: readonly VideoChatConversationTurn[]): string {
  if (conversation.length === 0) return prompt;
  return [
    "CONVERSATION SO FAR (untrusted user and assistant content):",
    ...conversation.flatMap((turn) => [
      `USER: ${turn.prompt}`,
      ...(turn.response ? [`RESPONSE: ${turn.response}`] : []),
    ]),
    "",
    `CURRENT USER PROMPT: ${prompt}`,
  ].join("\n");
}

function corsHeaders(origin: string | null, allowedOrigins?: string[], allowCredentials = false): Headers {
  const headers = new Headers({ "cache-control": "no-store", vary: "Origin" });
  if (origin && allowedOrigins?.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    if (allowCredentials) headers.set("access-control-allow-credentials", "true");
  }
  return headers;
}

async function readJson(request: Request, maximum: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) throw new Error("Request body is too large");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maximum) throw new Error("Request body is too large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function cleanGeneratedText(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function readSuggestionSubjects(text: string): SuggestionSubject[] {
  const opening = text.indexOf("{");
  const closing = text.lastIndexOf("}");
  if (opening < 0 || closing <= opening) return [];
  const parsed = JSON.parse(text.slice(opening, closing + 1)) as { suggestions?: unknown };
  return (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
    .flatMap((entry) => {
      const item = entry as { prompt?: unknown; keyword?: unknown };
      const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
      const keyword = typeof item.keyword === "string" ? item.keyword.trim() : "";
      return prompt ? [{ prompt: prompt.slice(0, 300), keyword: keyword.slice(0, 80) }] : [];
    })
    .slice(0, 4);
}

function audioBody(value: Uint8Array | ArrayBuffer): ArrayBuffer {
  const source = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Uint8Array.from(source).buffer;
}

function clientMedia(value: unknown): ResolvedMedia | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const media = value as Record<string, unknown>;
  if (media.type !== "image" && media.type !== "video") return null;
  if (typeof media.url !== "string") return null;
  const url = media.url.trim();
  if (!url || url.length > MAX_RETAINED_MEDIA_URL_LENGTH) return null;
  try {
    const protocol = new URL(url).protocol;
    if (protocol !== "https:" && protocol !== "http:") return null;
  } catch {
    return null;
  }
  if (media.posterUrl != null && typeof media.posterUrl !== "string") return null;
  const posterUrl = typeof media.posterUrl === "string" ? media.posterUrl.trim() : "";
  if (posterUrl.length > MAX_RETAINED_MEDIA_URL_LENGTH) return null;
  if (posterUrl) {
    try {
      const protocol = new URL(posterUrl).protocol;
      if (protocol !== "https:" && protocol !== "http:") return null;
    } catch {
      return null;
    }
  }
  return {
    url,
    type: media.type,
    ...(posterUrl ? { posterUrl } : {}),
  };
}

class VideoChatProviderError extends Error {
  constructor(readonly task: VideoChatTextTask) {
    super(`Video chat ${task} provider failed`);
  }
}

/**
 * Create the complete provider-neutral server endpoint for a video chat.
 *
 * Mount the returned handler once and select operations with the `action`
 * query parameter. Provider libraries and credentials stay in the application
 * closures passed here; only bounded prompts, media, and capability booleans
 * cross the browser boundary.
 */
export function createVideoChatHandler(options: VideoChatHandlerOptions): VideoChatHandler {
  if (!options || typeof options.streamText !== "function" || typeof options.generateText !== "function") {
    throw new Error("createVideoChatHandler requires streamText and generateText");
  }
  if (options.authorize !== "none" && typeof options.authorize !== "function") {
    throw new Error('createVideoChatHandler requires authorize or authorize: "none"');
  }
  const reportError = (cause: unknown) => {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    try { void Promise.resolve(options.onError?.(error)).catch(() => undefined); } catch {
      // Private diagnostics must never alter the public response.
    }
  };
  const {
    authorize,
    generateText,
    generateSpeech,
    transcribe,
    searchMedia,
    generateVideo,
    instructions,
    welcome: welcomeOptions,
    maxAudioBytes = DEFAULT_MAX_AUDIO_BYTES,
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
    allowedOrigins,
    allowCredentials,
    mediaConcurrency = 5,
    ...videoOptions
  } = options;
  if (!Number.isFinite(maxAudioBytes) || maxAudioBytes <= 0) throw new Error("maxAudioBytes must be positive");
  if (!Number.isFinite(maxBodyBytes) || maxBodyBytes <= 0) throw new Error("maxBodyBytes must be positive");

  const capabilities: VideoChatCapabilities = {
    templates: true,
    generatedSpeech: generateSpeech != null,
    generatedVideo: generateVideo != null,
    stockMedia: searchMedia != null,
    transcription: transcribe != null,
    modes: generateVideo ? ["templates", "some", "full"] : ["templates"],
  };
  const welcomePrompts = (welcomeOptions?.prompts ?? DEFAULT_WELCOME_PROMPTS).slice(0, 4);
  const heroQuery = welcomeOptions?.heroQuery ?? "underwater ocean sunlight";
  let welcomeResponse: Record<string, unknown> | undefined;
  let requestSequence = 0;
  const responseHandlers = new Map<VideoChatMode, ReturnType<typeof createVideoHandler>>();

  const responseHandler = (requestedMode: VideoChatMode) => {
    const mode = requestedMode !== "templates" && !generateVideo ? "templates" : requestedMode;
    const existing = responseHandlers.get(mode);
    if (existing) return existing;
    const filmedScenes = mode === "full" ? 5 : mode === "some" ? 1 : 0;
    const selectedResolver = filmedScenes > 0 ? generateVideo : searchMedia;
    const handler = createVideoHandler({
      ...videoOptions,
      authorize: "none",
      allowedOrigins,
      allowCredentials,
      maxBodyBytes,
      mediaConcurrency,
      basePrompt: [createVideoChatResponseInstructions(filmedScenes), instructions?.trim()]
        .filter(Boolean)
        .join("\n\nAPPLICATION GUIDANCE\n"),
      narrate: false,
      ...(filmedScenes > 0 ? { maxResolvedMedia: filmedScenes } : {}),
      resolveMedia: selectedResolver
        ? (query, context) => selectedResolver(query, {
            purpose: "response",
            orientation: context.input.orientation ?? "landscape",
            generatedLook: context.generatedLook,
            signal: context.signal,
            requestId: context.requestId,
            scene: context.scene,
            templateId: context.templateId,
            preferredType: context.preferredType,
          })
        : undefined,
    });
    responseHandlers.set(mode, handler);
    return handler;
  };

  const callText = async (
    task: VideoChatTextTask,
    systemPrompt: string,
    userPrompt: string,
    maxOutputTokens: number,
    signal: AbortSignal,
  ) => {
    try {
      return cleanGeneratedText(await generateText({ task, systemPrompt, userPrompt, maxOutputTokens, signal }));
    } catch (cause) {
      reportError(cause);
      throw new VideoChatProviderError(task);
    }
  };

  return async function handleVideoChat(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const origin = request.headers.get("origin");
    const headers = corsHeaders(origin, allowedOrigins, allowCredentials);

    if (request.method === "OPTIONS") {
      if (origin && allowedOrigins && !allowedOrigins.includes(origin)) {
        return jsonError(403, "origin_forbidden", "Origin is not allowed", headers);
      }
      headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
      headers.set("access-control-allow-headers", "Authorization, Content-Type");
      return new Response(null, { status: 204, headers });
    }
    if (origin && allowedOrigins && !allowedOrigins.includes(origin)) {
      return jsonError(403, "origin_forbidden", "Origin is not allowed", headers);
    }
    if (authorize !== "none") {
      let authorized = false;
      try { authorized = await authorize(request); } catch (cause) {
        reportError(cause);
        authorized = false;
      }
      if (!authorized) return jsonError(401, "unauthorized", "Authentication required", headers);
    }

    if (action === "capabilities") {
      if (request.method !== "GET") return jsonError(405, "method_not_allowed", "Use GET", headers);
      return Response.json(capabilities, { headers });
    }
    if (action === "welcome") {
      if (request.method !== "GET") return jsonError(405, "method_not_allowed", "Use GET", headers);
      if (welcomeResponse) return Response.json(welcomeResponse, { headers });
      const resolvedWelcome = await (async () => {
        let failed = false;
        const mediaResolver = searchMedia;
        const resolve = async (query: string | undefined) => {
          if (!mediaResolver || !query) return null;
          const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
          try {
            const raw = await Promise.resolve().then(() => mediaResolver(query, {
              purpose: "welcome",
              orientation: "landscape",
              signal,
            }));
            const media = clientMedia(raw);
            if (signal.aborted || (raw != null && !media)) failed = true;
            return media;
          } catch (cause) {
            failed = true;
            if (!request.signal.aborted) reportError(cause);
            return null;
          }
        };
        const [hero, ...cards] = await Promise.all([
          resolve(heroQuery),
          ...welcomePrompts.map((entry) => resolve(entry.mediaQuery)),
        ]);
        return {
          cacheable: !failed,
          body: {
            hero,
            cards: welcomePrompts.map((entry, index) => ({
              prompt: entry.prompt,
              media: cards[index] ?? null,
            })),
          },
        };
      })();
      if (!request.signal.aborted && resolvedWelcome.cacheable) welcomeResponse = resolvedWelcome.body;
      return Response.json(resolvedWelcome.body, { headers });
    }
    if (request.method !== "POST") return jsonError(405, "method_not_allowed", "Use POST", headers);

    if (action === "transcription") {
      if (!transcribe) return jsonError(404, "capability_unavailable", "Transcription is not configured", headers);
      const declared = Number(request.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxAudioBytes) {
        return jsonError(413, "body_too_large", "The recording is too large", headers);
      }
      const audio = new Uint8Array(await request.arrayBuffer());
      if (audio.byteLength === 0) return jsonError(400, "empty_audio", "No audio was provided", headers);
      if (audio.byteLength > maxAudioBytes) return jsonError(413, "body_too_large", "The recording is too large", headers);
      try {
        const text = await transcribe({
          audio,
          mediaType: request.headers.get("content-type") || "audio/webm",
          signal: request.signal,
        });
        return Response.json({ text: text.trim() }, { headers });
      } catch (cause) {
        reportError(cause);
        return jsonError(502, "transcription_failed", "The recording could not be transcribed", headers);
      }
    }

    let body: unknown;
    try {
      body = await readJson(request, maxBodyBytes);
    } catch (cause) {
      return jsonError(
        cause instanceof Error && cause.message.includes("too large") ? 413 : 400,
        "invalid_body",
        cause instanceof Error ? cause.message : "Request body is invalid",
        headers,
      );
    }

    if (action === "response") {
      let input: ParsedResponseRequest;
      try { input = parseResponseRequest(body); } catch (cause) {
        return jsonError(400, "invalid_request", cause instanceof Error ? cause.message : "Request is invalid", headers);
      }
      const mode = input.mode !== "templates" && !generateVideo ? "templates" : input.mode;
      const filmedScenes = mode === "full" ? 5 : mode === "some" ? 1 : 0;
      const requestId = `video-chat-${Date.now()}-${requestSequence += 1}`;
      const forwardedHeaders = new Headers(request.headers);
      forwardedHeaders.delete("content-length");
      const videoRequest = new Request(request.url, {
        method: "POST",
        headers: forwardedHeaders,
        signal: request.signal,
        body: JSON.stringify({
          protocolVersion: "0.5",
          requestId,
          ...(filmedScenes >= 5 ? { capabilities: { templates: ["media"] } } : {}),
          input: {
            input: conversationInput(input.prompt, input.conversation),
            knowledgeMode: "general",
            opening: false,
            orientation: input.orientation,
            maxDurationSec: 40,
            ...(input.brand ? { brand: input.brand } : {}),
            style: {
              density: "airy",
              motion: "calm",
              textArchetype: "cinematic",
              ...input.style,
            },
          },
        }),
      });
      return responseHandler(mode)(videoRequest);
    }

    try {
      if (action === "opening") {
        const value = record(body, "request");
        allowedKeys(value, ["prompt", "said"], "request");
        const prompt = boundedString(value.prompt, "request.prompt");
        const said = value.said == null ? "" : boundedString(value.said, "request.said", 2_000);
        const line = said
          ? await callText(
              "opening-continuation",
              VIDEO_CHAT_OPENING_CONTINUATION_PROMPT,
              `USER PROMPT: ${prompt}\n\nALREADY SAID: ${said}`,
              128,
              request.signal,
            )
          : await callText("opening", VIDEO_CHAT_OPENING_PROMPT, `USER PROMPT: ${prompt}`, 128, request.signal);
        return Response.json({ line }, { headers });
      }
      if (action === "narration") {
        const value = record(body, "request");
        allowedKeys(value, ["prompt", "scene", "earlier"], "request");
        const prompt = boundedString(value.prompt, "request.prompt");
        const scene = record(value.scene, "request.scene") as unknown as VideoScene;
        if (typeof scene.templateId !== "string" || !scene.variables || typeof scene.variables !== "object") {
          throw new Error("request.scene is invalid");
        }
        const earlier = Array.isArray(value.earlier)
          ? value.earlier.slice(-4).map((line, index) => boundedString(line, `request.earlier[${index}]`, 2_000))
          : [];
        const line = await callText(
          "narration",
          VIDEO_CHAT_NARRATION_PROMPT,
          createNarrationUserPrompt(prompt, scene, earlier),
          256,
          request.signal,
        );
        return Response.json({ line }, { headers });
      }
      if (action === "suggestions") {
        const value = record(body, "request");
        allowedKeys(value, ["prompt", "lines"], "request");
        const prompt = boundedString(value.prompt, "request.prompt");
        const lines = Array.isArray(value.lines)
          ? value.lines.slice(-8).map((line, index) => boundedString(line, `request.lines[${index}]`, 2_000))
          : [];
        try {
          const text = await callText(
            "suggestions",
            VIDEO_CHAT_SUGGESTIONS_PROMPT,
            `USER PROMPT: ${prompt}\n\nVIDEO RESPONSE:\n${lines.join("\n")}`,
            512,
            request.signal,
          );
          const subjects = readSuggestionSubjects(text);
          const mediaResolver = searchMedia;
          const media = await Promise.all(subjects.map(async (subject) => {
            if (!mediaResolver || !subject.keyword) return null;
            try {
              const raw = await Promise.resolve().then(() => mediaResolver(subject.keyword, {
                purpose: "suggestion",
                orientation: "landscape",
                signal: request.signal,
              }));
              return clientMedia(raw);
            } catch (cause) {
              if (!request.signal.aborted) reportError(cause);
              return null;
            }
          }));
          return Response.json({
            suggestions: subjects.map((subject, index) => ({
              prompt: subject.prompt,
              media: media[index] ?? null,
            })),
          }, { headers });
        } catch (cause) {
          if (!(cause instanceof VideoChatProviderError)) reportError(cause);
          return Response.json({ suggestions: [] }, { headers });
        }
      }
      if (action === "speech") {
        if (!generateSpeech) return jsonError(404, "capability_unavailable", "Generated speech is not configured", headers);
        const value = record(body, "request");
        allowedKeys(value, ["text"], "request");
        const text = boundedString(value.text, "request.text", 4_000);
        try {
          const result = await generateSpeech({ text, signal: request.signal });
          return new Response(audioBody(result.audio), {
            headers: {
              ...Object.fromEntries(headers),
              "content-type": result.mediaType || "audio/mpeg",
              "cache-control": "no-store",
            },
          });
        } catch (cause) {
          reportError(cause);
          return jsonError(502, "speech_failed", "Speech could not be generated", headers);
        }
      }
    } catch (cause) {
      if (cause instanceof VideoChatProviderError) {
        return jsonError(502, "text_generation_failed", "Text could not be generated", headers);
      }
      return jsonError(400, "invalid_request", cause instanceof Error ? cause.message : "Request is invalid", headers);
    }

    return jsonError(404, "unknown_action", "Video chat action was not found", headers);
  };
}
