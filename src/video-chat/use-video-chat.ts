import { useCallback, useEffect, useReducer, useRef } from "react";
import { createSceneTimeline } from "../protocol/scene-timeline.js";
import { decodeVideoSse } from "../protocol/sse.js";
import { getSceneDuration } from "../protocol/scene-duration.js";
import type { VideoEvent } from "../protocol/events.js";
import type {
  Video,
  VideoBrandInput,
  VideoOrientation,
  VideoScene,
  VideoStyle,
  VideoStyleOptions,
} from "../protocol/types.js";
import { VideoError } from "../player/video-error.js";
import type { VideoPlayerProps } from "../player/video-player.js";
import { useNarration } from "../player/use-narration.js";
import { preloadBuiltinTemplate } from "../visual-system/catalog/builtin-player.js";
import { getBuiltinTemplateMetadata } from "../visual-system/catalog/builtin-metadata.js";
import type { TemplateRegistry } from "../visual-system/catalog/kit.js";
import { warmSceneMedia } from "../player/warm-scene-media.js";
import { safePublicDiagnostic } from "../protocol/warnings.js";
import type {
  VideoChatCapabilities,
  VideoChatAskOptions,
  VideoChatConversationTurn,
  VideoChatMedia,
  VideoChatMode,
  VideoChatSuggestion,
  VideoChatWelcome,
} from "./types.js";
import { sanitizeVideoChatMedia } from "./media.js";
import { createVideoChatVoice, type VideoChatVoice } from "./voice.js";

const DEFAULT_TIMEOUT_MS = 180_000;
const OPENING_TIMEOUT_MS = 4_000;

export type VideoChatStatus = "idle" | "composing" | "playing" | "paused" | "ended" | "cancelled" | "error";

export interface VideoChatTurn {
  id: string;
  prompt: string;
  /** True only after the complete response has been received. */
  completed: boolean;
  opening?: string;
  /** Optional stock footage held behind the opening hook until playback starts. */
  openingMedia?: VideoChatMedia;
  orientation: VideoOrientation;
  /** Generated footage keeps the orientation it was created in. */
  fixedOrientation: boolean;
  video?: Video;
  suggestions: readonly VideoChatSuggestion[];
}

export interface UseVideoChatOptions {
  /** One provider-neutral route created with createVideoChatHandler. */
  endpoint?: string | URL;
  /** Customer-owned templates that replace built-ins and add new renderers. */
  templates?: TemplateRegistry;
  mode?: VideoChatMode;
  orientation?: VideoOrientation;
  brand?: VideoBrandInput;
  style?: VideoStyleOptions;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  fetcher?: typeof fetch;
  /** Replace the SDK speech client while keeping session timing and cancellation. */
  voice?: VideoChatVoice;
  initialMuted?: boolean;
  timeoutMs?: number;
  createTurnId?: () => string;
}

export interface UseVideoChatResult {
  ask(prompt: string, options?: VideoChatAskOptions): Promise<Video | undefined>;
  cancel(reason?: string): void;
  pause(): void;
  resume(): void;
  replay(): void;
  selectTurn(id: string): void;
  reset(): void;
  turns: readonly VideoChatTurn[];
  currentTurn?: VideoChatTurn;
  shownTurn?: VideoChatTurn;
  capabilities?: VideoChatCapabilities;
  welcome?: VideoChatWelcome;
  availableModes: readonly VideoChatMode[];
  status: VideoChatStatus;
  error?: VideoError;
  suggestions: readonly VideoChatSuggestion[];
  caption?: string;
  /** Narration revealed so far for the shown response. */
  transcript: readonly string[];
  speaking: boolean;
  muted: boolean;
  setMuted(muted: boolean): void;
  playbackEnded: boolean;
  /** Changes whenever saved content should restart from zero. */
  playerKey: number;
  /** Spread into VideoPlayer when present. */
  playerProps?: VideoPlayerProps;
}

interface Playback {
  kind: "stream" | "video";
  stream?: AsyncIterable<VideoEvent>;
  video?: Video;
}

interface SessionState {
  turns: VideoChatTurn[];
  shownTurnId?: string;
  capabilities?: VideoChatCapabilities;
  welcome?: VideoChatWelcome;
  status: VideoChatStatus;
  resumeStatus: Exclude<VideoChatStatus, "paused">;
  error?: VideoError;
  caption?: string;
  spokenUpTo: number;
  muted: boolean;
  playbackEnded: boolean;
  playerKey: number;
  playback?: Playback;
  openingSpeaking: boolean;
}

type SessionAction =
  | { type: "capabilities"; value: VideoChatCapabilities }
  | { type: "welcome"; value: VideoChatWelcome }
  | { type: "start"; turn: VideoChatTurn }
  | { type: "opening-start"; id: string; line: string }
  | { type: "opening-media"; id: string; media: VideoChatMedia }
  | { type: "opening-end"; id: string }
  | { type: "player"; id: string; stream: AsyncIterable<VideoEvent> }
  | { type: "partial"; id: string; video: Video }
  | { type: "complete"; id: string; video: Video; suggestions: VideoChatSuggestion[] }
  | { type: "scene"; key: number; scene: VideoScene; index: number }
  | { type: "playback-end"; key: number }
  | { type: "error"; id: string; error: VideoError }
  | { type: "cancelled" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "mute"; value: boolean }
  | { type: "select"; id: string }
  | { type: "replay" }
  | { type: "reset" };

function initialState(muted: boolean): SessionState {
  return {
    turns: [],
    status: "idle",
    resumeStatus: "idle",
    spokenUpTo: -1,
    muted,
    playbackEnded: false,
    playerKey: 0,
    openingSpeaking: false,
  };
}

function replaceTurn(
  turns: VideoChatTurn[],
  id: string,
  update: (turn: VideoChatTurn) => VideoChatTurn,
): VideoChatTurn[] {
  return turns.map((turn) => turn.id === id ? update(turn) : turn);
}

function reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "capabilities": return { ...state, capabilities: action.value };
    case "welcome": return { ...state, welcome: action.value };
    case "start": return {
      ...state,
      turns: [...state.turns, action.turn],
      shownTurnId: action.turn.id,
      status: "composing",
      resumeStatus: "composing",
      error: undefined,
      caption: undefined,
      spokenUpTo: -1,
      playbackEnded: false,
      playback: undefined,
      openingSpeaking: false,
    };
    case "opening-start":
      if (state.turns.at(-1)?.id !== action.id) return state;
      return {
        ...state,
        turns: replaceTurn(state.turns, action.id, (turn) => ({
          ...turn,
          opening: turn.opening ? `${turn.opening} ${action.line}` : action.line,
        })),
        status: state.status === "paused" ? "paused" : "playing",
        resumeStatus: "playing",
        caption: action.line,
        openingSpeaking: true,
      };
    case "opening-media":
      if (state.turns.at(-1)?.id !== action.id || state.playback) return state;
      return {
        ...state,
        turns: replaceTurn(state.turns, action.id, (turn) => ({ ...turn, openingMedia: action.media })),
      };
    case "opening-end":
      if (state.turns.at(-1)?.id !== action.id) return state;
      return {
        ...state,
        status: state.status === "paused" ? "paused" : state.playback ? "playing" : "composing",
        resumeStatus: state.playback ? "playing" : "composing",
        openingSpeaking: false,
      };
    case "player":
      if (state.turns.at(-1)?.id !== action.id) return state;
      return {
        ...state,
        status: state.status === "paused" ? "paused" : "playing",
        resumeStatus: "playing",
        playback: { kind: "stream", stream: action.stream },
        playerKey: state.playerKey + 1,
        playbackEnded: false,
      };
    case "partial":
      return { ...state, turns: replaceTurn(state.turns, action.id, (turn) => ({ ...turn, video: action.video })) };
    case "complete":
      return {
        ...state,
        turns: replaceTurn(state.turns, action.id, (turn) => ({
          ...turn,
          completed: true,
          video: action.video,
          suggestions: action.suggestions,
        })),
      };
    case "scene":
      if (state.playerKey !== action.key) return state;
      return {
        ...state,
        caption: action.scene.narration?.trim() || state.caption,
        spokenUpTo: Math.max(state.spokenUpTo, action.index),
      };
    case "playback-end":
      if (state.playerKey !== action.key) return state;
      return { ...state, status: "ended", resumeStatus: "ended", playbackEnded: true, openingSpeaking: false };
    case "error":
      if (state.turns.at(-1)?.id !== action.id) return state;
      return {
        ...state,
        status: "error",
        resumeStatus: "error",
        error: action.error,
        openingSpeaking: false,
        playback: undefined,
      };
    case "cancelled":
      return {
        ...state,
        status: "cancelled",
        resumeStatus: "cancelled",
        openingSpeaking: false,
        playback: undefined,
      };
    case "pause":
      if (state.status === "idle" || state.status === "paused" || state.status === "ended" || state.status === "cancelled" || state.status === "error") return state;
      return { ...state, resumeStatus: state.status, status: "paused" };
    case "resume":
      return state.status === "paused" ? { ...state, status: state.resumeStatus } : state;
    case "mute": return { ...state, muted: action.value };
    case "select": {
      const turn = state.turns.find((entry) => entry.id === action.id);
      if (!turn?.video) return state;
      return {
        ...state,
        shownTurnId: turn.id,
        playback: { kind: "video", video: turn.video },
        status: "playing",
        resumeStatus: "playing",
        playerKey: state.playerKey + 1,
        playbackEnded: false,
        spokenUpTo: -1,
        caption: turn.opening,
        error: undefined,
      };
    }
    case "replay": {
      const turn = state.turns.find((entry) => entry.id === state.shownTurnId);
      if (!turn?.video) return state;
      return {
        ...state,
        playback: { kind: "video", video: turn.video },
        status: "playing",
        resumeStatus: "playing",
        playerKey: state.playerKey + 1,
        playbackEnded: false,
        spokenUpTo: -1,
        caption: turn.opening,
        error: undefined,
      };
    }
    case "reset": return { ...initialState(state.muted), capabilities: state.capabilities, welcome: state.welcome };
  }
}

function actionEndpoint(endpoint: string | URL, action: string): string {
  const value = String(endpoint);
  return `${value}${value.includes("?") ? "&" : "?"}action=${encodeURIComponent(action)}`;
}

function defaultTurnId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function filmedScenes(mode: VideoChatMode): number {
  return mode === "full" ? 5 : mode === "some" ? 1 : 0;
}

function transcriptFor(turn: VideoChatTurn): string[] {
  return [
    ...(turn.opening ? [turn.opening] : []),
    ...(turn.video?.scenes.flatMap((entry) => entry.narration?.trim() ? [entry.narration.trim()] : []) ?? []),
  ];
}

function conversationFor(turns: readonly VideoChatTurn[]): VideoChatConversationTurn[] {
  return turns.filter((turn) => turn.completed && turn.video).slice(-12).map((turn) => ({
    prompt: turn.prompt,
    response: [...transcriptFor(turn).join(" ")].slice(0, 8_000).join(""),
  }));
}

function errorFrom(cause: unknown): VideoError {
  if (cause instanceof VideoError) return cause;
  if (cause instanceof DOMException && cause.name === "AbortError") {
    return new VideoError("Video chat was cancelled", { code: "aborted", recoverable: false });
  }
  return new VideoError(safePublicDiagnostic(
    cause instanceof Error ? cause.message : String(cause),
    "Video chat failed",
  ), { code: "video_chat_failed", recoverable: false });
}

async function responseError(response: Response): Promise<VideoError> {
  let code = "http_error";
  let message = `Video chat endpoint failed (${response.status})`;
  try {
    const body = await response.json() as { error?: { code?: unknown; message?: unknown } };
    if (typeof body.error?.code === "string") code = body.error.code.slice(0, 80);
    if (typeof body.error?.message === "string") {
      message = safePublicDiagnostic(body.error.message, message);
    }
  } catch {
    // Keep the status-only error for non-JSON responses.
  }
  return new VideoError(message, { code, status: response.status, recoverable: false });
}

function pacedScene(
  scene: VideoScene,
  spokenSeconds: number | undefined,
  templates?: TemplateRegistry,
): VideoScene {
  const held = spokenSeconds && spokenSeconds > 0
    ? spokenSeconds + 0.8
    : getSceneDuration(scene, templates?.getTemplateMetadata(scene.templateId) ?? getBuiltinTemplateMetadata(scene.templateId));
  const {
    startTime: _startTime,
    endTime: _endTime,
    beatStart: _beatStart,
    beatEnd: _beatEnd,
    ...timing
  } = scene.timing ?? {};
  return { ...scene, timing: { ...timing, fixedDuration: held } };
}

function prepareVisualScene(scene: VideoScene, mode: VideoChatMode): VideoScene {
  const overMedia = typeof (scene.variables as { mediaUrl?: unknown }).mediaUrl === "string";
  const filmed = filmedScenes(mode) > 0 && overMedia;
  const shown = filmed
    ? {
        ...scene,
        backgroundEffect: "static" as const,
        variables: {
          ...scene.variables,
          texts: "",
          mediaTreatment: "none",
          confetti: false,
        },
      }
    : scene;
  return overMedia ? { ...shown, textArchetype: "subtle" } : shown;
}

/** Own a complete video conversation while the application owns its UI. */
export function useVideoChat(options: UseVideoChatOptions = {}): UseVideoChatResult {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const ownedVoiceRef = useRef<VideoChatVoice | undefined>(undefined);
  if (!options.voice && !ownedVoiceRef.current) {
    ownedVoiceRef.current = createVideoChatVoice({
      endpoint: options.endpoint,
      headers: options.headers,
      credentials: options.credentials,
      fetcher: options.fetcher,
    });
  }
  const voice = options.voice ?? ownedVoiceRef.current!;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const narration = useNarration({ voice });
  const narrationRef = useRef(narration);
  narrationRef.current = narration;

  const [state, dispatch] = useReducer(reducer, options.initialMuted ?? false, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const runRef = useRef(0);
  const inFlightRef = useRef<AbortController | undefined>(undefined);
  const openingRef = useRef<AbortController | undefined>(undefined);
  const timelineRef = useRef<ReturnType<typeof createSceneTimeline> | undefined>(undefined);
  const heldRef = useRef(false);
  const flushRef = useRef<(() => void) | undefined>(undefined);
  const mountedRef = useRef(true);

  const request = useCallback(async (
    action: string,
    init: Omit<RequestInit, "signal"> = {},
    signal?: AbortSignal,
  ): Promise<Response> => {
    const current = optionsRef.current;
    const headers = new Headers(current.headers);
    new Headers(init.headers).forEach((header, name) => headers.set(name, header));
    if (init.body && !(init.body instanceof FormData) && !(init.body instanceof Blob)) {
      headers.set("content-type", "application/json");
    }
    return (current.fetcher ?? fetch)(actionEndpoint(current.endpoint ?? "/api/video-chat", action), {
      ...init,
      headers,
      credentials: current.credentials,
      signal,
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void request("capabilities", {}, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw await responseError(response);
        return response.json() as Promise<VideoChatCapabilities>;
      })
      .then((value) => { if (mountedRef.current) dispatch({ type: "capabilities", value }); })
      .catch(() => undefined);
    void request("welcome", {}, controller.signal)
      .then(async (response) => {
        if (!response.ok) throw await responseError(response);
        return response.json() as Promise<VideoChatWelcome>;
      })
      .then((value) => { if (mountedRef.current) dispatch({ type: "welcome", value }); })
      .catch(() => undefined);
    return () => {
      mountedRef.current = false;
      controller.abort();
      runRef.current += 1;
      inFlightRef.current?.abort(new DOMException("Component unmounted", "AbortError"));
      openingRef.current?.abort(new DOMException("Component unmounted", "AbortError"));
      timelineRef.current?.complete();
      timelineRef.current = undefined;
      narrationRef.current.interrupt();
      queueMicrotask(() => {
        if (!mountedRef.current) ownedVoiceRef.current?.dispose?.();
      });
    };
  }, [request]);

  useEffect(() => voice.setMuted(state.muted), [state.muted, voice]);

  const cancel = useCallback((reason = "Video chat was cancelled") => {
    runRef.current += 1;
    inFlightRef.current?.abort(new DOMException(reason, "AbortError"));
    openingRef.current?.abort(new DOMException(reason, "AbortError"));
    inFlightRef.current = undefined;
    openingRef.current = undefined;
    timelineRef.current?.complete();
    timelineRef.current = undefined;
    flushRef.current = undefined;
    narrationRef.current.interrupt();
    dispatch({ type: "cancelled" });
  }, []);

  const ask = useCallback(async (
    value: string,
    askOptions: VideoChatAskOptions = {},
  ): Promise<Video | undefined> => {
    const prompt = value.trim();
    if (!prompt) return undefined;

    inFlightRef.current?.abort(new DOMException("Replaced by a new prompt", "AbortError"));
    openingRef.current?.abort(new DOMException("Replaced by a new prompt", "AbortError"));
    timelineRef.current?.complete();
    timelineRef.current = undefined;
    narrationRef.current.interrupt();
    voiceRef.current.resume();
    heldRef.current = false;
    const controller = new AbortController();
    const openingController = new AbortController();
    inFlightRef.current = controller;
    openingRef.current = openingController;
    controller.signal.addEventListener("abort", () => {
      openingController.abort(controller.signal.reason);
    }, { once: true });
    const run = runRef.current + 1;
    runRef.current = run;
    const currentOptions = optionsRef.current;
    const timeoutMs = currentOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      inFlightRef.current = undefined;
      throw new VideoError("timeoutMs must be positive", { code: "invalid_option" });
    }
    const timeout = setTimeout(() => controller.abort(new DOMException("Video chat timed out", "TimeoutError")), timeoutMs);
    const requestedMode = currentOptions.mode ?? "templates";
    const knownModes = stateRef.current.capabilities?.modes;
    const mode = knownModes && !knownModes.includes(requestedMode) ? "templates" : requestedMode;
    const orientation = currentOptions.orientation ?? "landscape";
    const id = (currentOptions.createTurnId ?? defaultTurnId)();
    const conversation = conversationFor(stateRef.current.turns);
    const openingMedia = sanitizeVideoChatMedia(askOptions.openingMedia);
    const turn: VideoChatTurn = {
      id,
      prompt,
      completed: false,
      orientation,
      fixedOrientation: filmedScenes(mode) > 0,
      suggestions: [],
      ...(openingMedia ? { openingMedia } : {}),
    };
    dispatch({ type: "start", turn });

    let timeline: ReturnType<typeof createSceneTimeline> | undefined;
    let style: VideoStyle | undefined;
    let openingActive = false;
    let spokenHook = "";
    let planDone = false;
    let timelineCompleted = false;
    let terminal = false;
    let attempt = 0;
    let ready: Array<VideoScene | undefined> = [];
    let appended = 0;

    const isCurrent = () => mountedRef.current && runRef.current === run && !controller.signal.aborted;
    const isOpeningCurrent = () => (
      isCurrent()
      && !terminal
      && openingRef.current === openingController
      && !openingController.signal.aborted
    );
    const flush = () => {
      if (!isCurrent()) return;
      let available = appended;
      while (ready[available]) available += 1;
      if (available === appended && timeline) {
        if (planDone && !timelineCompleted) {
          timelineCompleted = true;
          timeline.complete();
          if (timelineRef.current === timeline) timelineRef.current = undefined;
        }
        return;
      }
      if (!timeline) {
        if (!style || openingActive || heldRef.current || available === appended) return;
        timeline = createSceneTimeline({ style, orientation });
        timelineRef.current = timeline;
        openingController.abort(new DOMException("Opening replaced by response", "AbortError"));
        if (openingRef.current === openingController) openingRef.current = undefined;
        dispatch({ type: "player", id, stream: timeline.stream });
      }
      while (ready[appended]) timeline.add(ready[appended++]!);
      dispatch({
        type: "partial",
        id,
        video: { schemaVersion: "0.1", orientation, scenes: ready.slice(0, appended) as VideoScene[], style: style! },
      });
      if (planDone && !timelineCompleted) {
        timelineCompleted = true;
        timeline.complete();
        if (timelineRef.current === timeline) timelineRef.current = undefined;
      }
    };
    flushRef.current = flush;

    const resolveOpeningMedia = async (keyword: string) => {
      try {
        const response = await request("opening-media", {
          method: "POST",
          body: JSON.stringify({ keyword, orientation }),
        }, openingController.signal);
        if (!response.ok || !isOpeningCurrent() || timeline) return;
        const payload = await response.json() as { media?: unknown };
        const media = sanitizeVideoChatMedia(payload.media);
        if (media && isOpeningCurrent() && !timeline) dispatch({ type: "opening-media", id, media });
      } catch {
        // Stock footage is an enhancement; the branded ground remains usable.
      }
    };

    const speakOpening = async (text: string) => {
      try {
        await voiceRef.current.prepare(text, { signal: openingController.signal });
        if (!isOpeningCurrent()) return;
        dispatch({ type: "opening-start", id, line: text });
        await voiceRef.current.speak(text, { signal: openingController.signal });
      } catch {
        // A missing voice falls back inside the voice adapter; cancellation is silent.
      } finally {
        openingActive = false;
        if (isOpeningCurrent()) dispatch({ type: "opening-end", id });
        flush();
      }
    };

    try {
      const openingSignal = AbortSignal.any([
        openingController.signal,
        AbortSignal.timeout(OPENING_TIMEOUT_MS),
      ]);
      const response = await request("opening", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      }, openingSignal);
      if (response.ok && isOpeningCurrent()) {
        const payload = await response.json() as { line?: unknown; keyword?: unknown };
        spokenHook = typeof payload.line === "string" ? payload.line.trim() : "";
        const keyword = typeof payload.keyword === "string" ? payload.keyword.trim() : "";
        if (!openingMedia && keyword) void resolveOpeningMedia(keyword);
        if (spokenHook) {
          openingActive = true;
          void speakOpening(spokenHook);
        }
      }
    } catch {
      // The response still proceeds if the small opening hook misses its deadline.
    }

    const runAttempt = async (currentAttempt: number): Promise<{ video: Video; suggestions: VideoChatSuggestion[] }> => {
      const response = await request("response", {
        method: "POST",
        headers: { accept: "text/event-stream" },
        body: JSON.stringify({
          prompt,
          ...(spokenHook ? { spokenHook } : {}),
          mode,
          orientation,
          conversation,
          ...(currentOptions.brand ? { brand: currentOptions.brand } : {}),
          ...(currentOptions.style ? { style: currentOptions.style } : {}),
        }),
      }, controller.signal);
      if (!response.ok) throw await responseError(response);
      if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        throw new VideoError("Video chat endpoint did not return a video stream", { code: "invalid_response" });
      }

      const planned: VideoScene[] = [];
      const lines: string[] = spokenHook ? [spokenHook] : [];
      const pending: Promise<void>[] = [];
      let narrating: Promise<unknown> = Promise.resolve();
      let terminalError: VideoError | undefined;

      for await (const event of decodeVideoSse(response.body)) {
        if (!isCurrent() || currentAttempt !== attempt) return { video: { schemaVersion: "0.1", orientation, scenes: [], style: style! }, suggestions: [] };
        if (event.type === "response.start") style = event.data.style;
        if (event.type === "response.error" && event.data.terminal) {
          terminalError = new VideoError(event.data.error.message, {
            code: event.data.error.code,
            requestId: event.data.snapshot ? undefined : id,
            recoverable: event.data.error.recoverable,
          });
        }
        if (event.type === "response.abort") {
          terminalError = new VideoError(event.data.reason, { code: "aborted", recoverable: false });
        }
        if (event.type !== "scene.add") continue;
        const position = event.data.position;
        const plannedScene = event.data.scene;
        planned[position] = plannedScene;
        if (!currentOptions.templates?.getTemplate(plannedScene.templateId)) {
          preloadBuiltinTemplate(plannedScene.templateId);
        }
        warmSceneMedia(plannedScene.variables);

        const narrated = narrating.then(async () => {
          const supplied = plannedScene.narration?.trim();
          if (supplied) return supplied;
          const narrationResponse = await request("narration", {
            method: "POST",
            body: JSON.stringify({ prompt, scene: plannedScene, earlier: [...lines] }),
          }, controller.signal);
          if (!narrationResponse.ok) return "";
          const payload = await narrationResponse.json() as { line?: unknown };
          return typeof payload.line === "string" ? payload.line.trim() : "";
        }).then((line) => {
          if (line) lines.push(line);
          return line;
        });
        narrating = narrated.catch(() => "");
        pending.push(narrated.then(async (line) => {
          if (!isCurrent() || currentAttempt !== attempt) return;
          const visual = prepareVisualScene(plannedScene, mode);
          const withNarration = line ? { ...visual, narration: line } : visual;
          const spoken = line
            ? await voiceRef.current.prepare(line, { signal: controller.signal })
            : undefined;
          if (!isCurrent() || currentAttempt !== attempt) return;
          ready[position] = pacedScene(withNarration, spoken?.seconds, currentOptions.templates);
          flush();
        }));
      }
      await Promise.all(pending);
      if (terminalError) throw terminalError;
      if (planned.length === 0 || ready.filter(Boolean).length === 0 || !style) {
        throw new VideoError("The video response contained no playable scenes", { code: "empty_response" });
      }

      let suggestions: VideoChatSuggestion[] = [];
      try {
        const suggestionsResponse = await request("suggestions", {
          method: "POST",
          body: JSON.stringify({ prompt, lines }),
        }, controller.signal);
        if (suggestionsResponse.ok) {
          suggestions = ((await suggestionsResponse.json()) as { suggestions?: VideoChatSuggestion[] }).suggestions ?? [];
        }
      } catch (cause) {
        if (controller.signal.aborted) throw cause;
      }
      return {
        video: {
          schemaVersion: "0.1",
          orientation,
          scenes: ready.filter((entry): entry is VideoScene => entry != null),
          style,
        },
        suggestions,
      };
    };

    try {
      let response: { video: Video; suggestions: VideoChatSuggestion[] };
      try {
        response = await runAttempt(attempt);
      } catch (cause) {
        if (controller.signal.aborted || timeline) throw cause;
        attempt += 1;
        ready = [];
        appended = 0;
        style = undefined;
        response = await runAttempt(attempt);
      }
      if (!isCurrent()) return undefined;
      planDone = true;
      flush();
      dispatch({ type: "complete", id, video: response.video, suggestions: response.suggestions });
      return response.video;
    } catch (cause) {
      if (runRef.current !== run) return undefined;
      if (controller.signal.aborted && !(controller.signal.reason instanceof DOMException && controller.signal.reason.name === "TimeoutError")) {
        return undefined;
      }
      terminal = true;
      openingController.abort(new DOMException("Response failed", "AbortError"));
      timeline?.complete();
      if (timelineRef.current === timeline) timelineRef.current = undefined;
      const error = errorFrom(cause);
      dispatch({ type: "error", id, error });
      return undefined;
    } finally {
      clearTimeout(timeout);
      if (runRef.current === run) inFlightRef.current = undefined;
    }
  }, [request]);

  const pause = useCallback(() => {
    heldRef.current = true;
    voiceRef.current.pause();
    dispatch({ type: "pause" });
  }, []);

  const resume = useCallback(() => {
    heldRef.current = false;
    voiceRef.current.resume();
    dispatch({ type: "resume" });
    flushRef.current?.();
  }, []);

  const replay = useCallback(() => {
    const turn = stateRef.current.turns.find((entry) => entry.id === stateRef.current.shownTurnId);
    if (!turn?.completed || !turn.video) return;
    if (inFlightRef.current) {
      runRef.current += 1;
      inFlightRef.current.abort(new DOMException("Replaying a saved response", "AbortError"));
      inFlightRef.current = undefined;
    }
    openingRef.current?.abort(new DOMException("Replaying a saved response", "AbortError"));
    openingRef.current = undefined;
    timelineRef.current?.complete();
    timelineRef.current = undefined;
    narrationRef.current.interrupt();
    heldRef.current = false;
    voiceRef.current.resume();
    dispatch({ type: "replay" });
  }, []);

  const selectTurn = useCallback((id: string) => {
    const turn = stateRef.current.turns.find((entry) => entry.id === id);
    if (!turn?.completed || !turn.video) return;
    if (inFlightRef.current) {
      runRef.current += 1;
      inFlightRef.current.abort(new DOMException("Viewing a saved response", "AbortError"));
      inFlightRef.current = undefined;
    }
    openingRef.current?.abort(new DOMException("Viewing a saved response", "AbortError"));
    openingRef.current = undefined;
    timelineRef.current?.complete();
    timelineRef.current = undefined;
    narrationRef.current.interrupt();
    heldRef.current = false;
    voiceRef.current.resume();
    dispatch({ type: "select", id });
  }, []);

  const reset = useCallback(() => {
    cancel("Session reset");
    heldRef.current = false;
    voiceRef.current.resume();
    dispatch({ type: "reset" });
  }, [cancel]);

  const setMuted = useCallback((muted: boolean) => dispatch({ type: "mute", value: muted }), []);

  const currentTurn = state.turns.at(-1);
  const shownTurn = state.turns.find((turn) => turn.id === state.shownTurnId) ?? currentTurn;
  const availableModes = state.capabilities?.modes ?? (["templates"] as const);
  const suggestions = shownTurn?.suggestions ?? [];
  const fullTranscript = shownTurn ? transcriptFor(shownTurn) : [];
  const transcript = shownTurn && shownTurn === currentTurn && state.playback?.kind !== "video"
    ? fullTranscript.slice(0, (shownTurn.opening ? 1 : 0) + state.spokenUpTo + 1)
    : fullTranscript;
  const playbackKey = state.playerKey;
  const playerProps = state.playback ? {
    ...(options.templates ? { templates: options.templates } : {}),
    ...(state.playback.kind === "stream"
      ? { stream: state.playback.stream! }
      : { video: state.playback.video! }),
    autoPlay: true,
    paused: state.status === "paused",
    controls: false,
    orientation: shownTurn?.fixedOrientation ? shownTurn.orientation : "auto" as const,
    onSceneChange: (scene: VideoScene, index: number) => {
      if (stateRef.current.playerKey !== playbackKey) return;
      dispatch({ type: "scene", key: playbackKey, scene, index });
      narrationRef.current.onSceneChange(scene, index);
    },
    onPlaybackEnd: () => dispatch({ type: "playback-end", key: playbackKey }),
    onError: (cause: Error) => {
      const id = stateRef.current.turns.at(-1)?.id;
      if (id) dispatch({ type: "error", id, error: errorFrom(cause) });
    },
  } satisfies VideoPlayerProps : undefined;

  return {
    ask,
    cancel,
    pause,
    resume,
    replay,
    selectTurn,
    reset,
    turns: state.turns,
    currentTurn,
    shownTurn,
    capabilities: state.capabilities,
    welcome: state.welcome,
    availableModes,
    status: state.status,
    error: state.error,
    suggestions,
    caption: state.caption,
    transcript,
    speaking: narration.speaking || state.openingSpeaking,
    muted: state.muted,
    setMuted,
    playbackEnded: state.playbackEnded,
    playerKey: state.playerKey,
    playerProps,
  };
}
