import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSceneTimeline, getSceneDuration, type Video, type VideoOrientation, type VideoScene } from "@vanillaskyai/video";
import { VideoPlayer, useNarration } from "@vanillaskyai/video/react";
import { createTemplateRegistry } from "@vanillaskyai/video/templates";
import { definitions } from "../vanillasky";
import { createSpokenVoice } from "./spoken-voice";
import { streamResponseWithRetry } from "./generate-response";
import { defaultMode, visualModes } from "./modes";
import { defaultTheme, themeBackground, themeById, themes } from "./themes";
import { ChevronUp, Close, Gear, Mic, Replay, Send, Sound, Stop, Muted, Play, Plus, Warning } from "./icons";
import { useDismiss, useFocusTrap } from "./use-dismiss";
import { Welcome, useWelcome } from "./welcome";
import { SuggestionCards, type Suggestion } from "./suggestion-cards";
import { useVoiceInput } from "./use-voice-input";
import "./styles.css";

const templates = createTemplateRegistry({ definitions });

/**
 * Where the layout turns over, in one place.
 *
 * The stylesheet switches the chrome here, the prompt below decides what
 * shape to compose in here, and the player is told to re-lay-out here. Three
 * numbers that had to agree were three numbers that could disagree.
 */
const DESKTOP_WIDTH = 900;

type ThemeChoice = "system" | "light" | "dark";

/**
 * The viewer's theme, in the three states a theme actually has.
 *
 * "system" sets no attribute at all, which is what lets the stylesheet's
 * `prefers-color-scheme` block decide; the other two stamp `data-theme` on the
 * root and win over it. An application embedding this would more likely hand
 * the choice down from its own theme control - this is here because an example
 * that cannot show light mode has not demonstrated it.
 */
function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", choice);
  }, [choice]);
  return [choice, setChoice];
}

/** Live, because a window can be resized and a phone can be turned. */
function useViewportOrientation(): VideoOrientation {
  const [portrait, setPortrait] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(`(max-width: ${DESKTOP_WIDTH - 1}px)`).matches
      : false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(`(max-width: ${DESKTOP_WIDTH - 1}px)`);
    const update = () => setPortrait(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return portrait ? "portrait" : "landscape";
}

interface ConversationTurn {
  index: number;
  prompt: string;
  /**
   * The line said over the prompt while the response was being composed.
   *
   * It belongs to the response rather than to the wait: it is the first thing
   * the video chat said, so it is the first line of the transcript and the first
   * subtitle shown, and a session replayed from history is missing its opening
   * without it.
   */
  opening?: string;
  /** What the viewport asked for when the prompt was put. */
  orientation: VideoOrientation;
  /**
   * Whether that shape is now permanent.
   *
   * Templates re-lay-out at any size, so a templates-only response follows the
   * window for as long as it exists. A generated clip cannot: its aspect ratio
   * is baked into the file it was filmed as, and re-cropping a shot that is
   * the whole scene loses the scene. So a filmed response keeps the shape it was
   * filmed in, wherever it is later opened.
   */
  fixedShape: boolean;
  /** Replayable from JSON, with no model call: a response is just data. */
  video?: Video;
}

interface VideoChatCapabilities {
  generatedSpeech: boolean;
  generatedVideo: boolean;
  stockMedia: boolean;
  transcription: boolean;
}

/**
 * Hold a scene for exactly as long as its line takes to say.
 *
 * The voice decides, not the template. `spokenSeconds` is the measured length
 * of the generated audio, so a scene ends when its sentence does - the picture
 * follows the narration rather than the narration being fitted to the picture.
 * The small tail is the breath between one scene and the next.
 *
 * A scene with no line falls back to how long its own content takes to read,
 * because something has to decide.
 */
function pacedScene(scene: VideoScene, spokenSeconds?: number): VideoScene {
  // The tail covers the moment between a scene starting and its audio actually
  // playing, plus a beat of silence before the next line begins.
  const held = spokenSeconds && spokenSeconds > 0
    ? spokenSeconds + 0.8
    : getSceneDuration(scene, templates.getTemplateMetadata(scene.templateId));
  // Only the duration survives. The server paces every scene it plans and
  // stamps an absolute startTime and endTime on it, and those beat
  // fixedDuration when the timeline is resolved - so keeping them means the
  // picture moves on at the planner's estimate while the line is still being
  // said, and the voice is cut off. The measured audio decides, which means
  // nothing else may.
  const { startTime: _startTime, endTime: _endTime, beatStart: _beatStart, beatEnd: _beatEnd, ...timing } = scene.timing ?? {};
  return { ...scene, timing: { ...timing, fixedDuration: held } };
}

const emptyVideo = (orientation: VideoOrientation) =>
  ({ schemaVersion: "0.1", orientation, scenes: [], style: undefined } as unknown as Video);

/**
 * What the session is doing, as one word.
 *
 * The page used to carry `composing`, `live` and `replaying` as three
 * independent booleans, and every control read two of them to decide what it
 * was. One value is what the chrome actually responds to: the subtitle line,
 * the transport glyph and whether the suggestion chips are up are all this and
 * nothing else.
 */
type Status = "idle" | "drawing" | "narrating" | "paused" | "ended";

/**
 * Short, and unmistakably about a camera.
 *
 * The wait is about seven seconds and these change every three, so line one
 * and half of line two are all anyone reads - and line one is the only one
 * seen before the voice starts. "Choosing the beats" was our own jargon, and
 * "writing the narration" reads like a text response is coming. A rolling camera
 * does not.
 *
 * They sit under the prompt, on the ground the response is composed on, and
 * they describe the machine rather than the response - which is why they belong
 * on the stage and not in the line below it. That line is the video chat talking.
 */
const STEPS = [
  "Rolling camera…",
  "Framing the shots…",
  "Filming your response…",
  "Still filming…",
];

/** Advance while there is no picture yet, and start over for each prompt. */
function useFilmingStep(active: boolean, key: unknown): string {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    setStep(0);
    const stepper = window.setInterval(() => setStep((current) => current + 1), 3000);
    return () => window.clearInterval(stepper);
  }, [active, key]);
  return STEPS[Math.min(step, STEPS.length - 1)]!;
}

/**
 * Five bars that move while a voice is speaking.
 *
 * It sits inside the composer because that is where the video chat's voice belongs
 * once the badge is gone: the thing that says a response is talking should be
 * next to the way to interrupt it.
 */
function Waveform({ active, listening }: { active: boolean; listening?: boolean }) {
  return <span className={`waveform${active ? " on" : ""}${listening ? " hearing" : ""}`} aria-hidden="true">
    {[0, 1, 2, 3, 4].map((bar) => <span key={bar} style={{ animationDelay: `${bar * 140}ms`, animationDuration: `${900 + bar * 130}ms` }} />)}
  </span>;
}

function App() {
  const [draft, setDraft] = useState("");
  const [turns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [themeId, setThemeId] = useState(defaultTheme.id);
  const [modeId, setModeId] = useState(defaultMode.id);
  const [capabilities, setCapabilities] = useState<VideoChatCapabilities>();
  const [stream, setStream] = useState<AsyncIterable<unknown>>();
  const [replaying, setReplaying] = useState<Video>();
  // Bumped to remount the player. Replaying a response that is already on the
  // stage is the same `video` object, and React would keep the playhead where
  // it was - a replay button that does nothing.
  const [replayCount, setReplayCount] = useState(0);
  const [viewing, setViewing] = useState<number>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [composing, setComposing] = useState(false);
  /*
   * Whether the picture has run out, as reported by the player.
   *
   * This used to be a `playing` flag turned off by the narration pacing loop,
   * which is a different thing: the loop is finished when the last line has
   * been said, and the video keeps going for as long as its own timeline says.
   * When the two disagreed - a scene with no measured audio, a line shorter
   * than the shot it sits under - the session called itself over while the
   * response was still on screen, and the follow-ups arrived mid-response.
   *
   * The player knows when its last scene has played. Nothing else does.
   */
  const [pictureEnded, setPictureEnded] = useState(false);
  // The opening line is not a loading state. It is the video chat's first sentence,
  // said out loud, and the session is already running while it is said - so it
  // wears the narrating chrome and turns the stop button like any other line.
  const [openingSpeaking, setOpeningSpeaking] = useState(false);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // How far the voice has got. The sheet is written as the response is planned,
  // so without this the whole response is readable the moment it is opened -
  // while the video is still on its first scene.
  const [spokenUpTo, setSpokenUpTo] = useState(-1);
  // The one line under the stage. It is set by the player's own scene change
  // and by the opening line as it starts being said, and by nothing else -
  // there is no timer anywhere in this file advancing a subtitle.
  const [cue, setCue] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const inFlight = new AbortController();
    void fetch("/api/video-chat?action=capabilities", { signal: inFlight.signal })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((value) => {
        if (value) setCapabilities(value as VideoChatCapabilities);
      })
      .catch(() => undefined);
    return () => inFlight.abort();
  }, []);

  const viewportOrientation = useViewportOrientation();
  const [themeChoice, setThemeChoice] = useThemeChoice();
  const voice = useMemo(createSpokenVoice, []);
  const narration = useNarration({ voice });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

  // Speech goes to the box, never straight to the video chat: a mis-heard prompt
  // costs a whole response, so what was heard is a draft to correct.
  const listen = useVoiceInput(setDraft, capabilities?.transcription ?? false);

  // Stable across renders, so the listeners are bound once per opening rather
  // than torn down and rebuilt on every keystroke in the composer.
  const historySurfaces = useMemo(() => [historyRef, historyButtonRef], []);
  const settingsSurfaces = useMemo(() => [settingsRef, settingsButtonRef], []);
  const noSurfaces = useMemo(() => [], []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useDismiss(historyOpen, closeHistory, historySurfaces);
  useDismiss(settingsOpen, closeSettings, settingsSurfaces);
  // The sheet is modal, so anywhere outside it is outside.
  useDismiss(sheetOpen, closeSheet, noSurfaces);
  useFocusTrap(sheetOpen, sheetRef);

  // The player reports which scene is showing; that is the cue for the voice
  // and for the subtitle, so the words and the picture arrive together rather
  // than the line running ahead of what it describes.
  const onSceneChange = useCallback((scene: VideoScene, index: number) => {
    setSpokenUpTo((furthest) => Math.max(furthest, index));
    if (scene.narration) setCue(scene.narration);
    narration.onSceneChange(scene, index);
  }, [narration]);

  // Read inside the async run, which was created before the speaking state it
  // needs to wait on existed.
  const speakingRef = useRef(false);
  speakingRef.current = narration.speaking;
  const theme = themeById(themeId);
  const availableModes = capabilities?.generatedVideo ? visualModes : [defaultMode];
  const mode = availableModes.find((option) => option.id === modeId) ?? defaultMode;
  const turnRef = useRef(0);
  const inFlightRef = useRef<AbortController | undefined>(undefined);
  // A paused session must not be started for you. The plan usually lands while
  // the opening line is still being said, and without these the video opened
  // over the top of a session the user had deliberately stopped.
  const heldRef = useRef(false);
  const flushRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => voice.setMuted(muted), [voice, muted]);

  const ask = useCallback(async (value: string) => {
    const prompt = value.trim();
    if (!prompt) return;
    setDraft("");
    listen.stop();
    // Composing outlives the prompt that asked for it, so the next prompt
    // cancels it: otherwise a response nobody is waiting for arrives and
    // overwrites the one that replaced it.
    inFlightRef.current?.abort();
    const inFlight = new AbortController();
    inFlightRef.current = inFlight;
    // Composing takes thirty to ninety seconds, so there is no honest way to
    // tell a slow response from a stalled one by watching. Past three minutes it
    // is stalled: say so rather than animating forever.
    const deadline = window.setTimeout(() => inFlight.abort(new Error("stalled")), 180_000);

    narration.interrupt();
    voice.resume();
    heldRef.current = false;
    setHeld(false);
    setError(undefined);
    setSuggestions([]);
    setViewing(undefined);
    setReplaying(undefined);
    setStream(undefined);
    setHistoryOpen(false);
    setSettingsOpen(false);
    setSheetOpen(false);
    setComposing(true);
    setOpeningSpeaking(false);
    setCue(undefined);
    const index = (turnRef.current += 1);
    // Read now rather than at render: the shape the response is composed in is
    // the shape the window was when it was asked for, and a filmed one is
    // stuck with it.
    const orientation = viewportOrientation;
    const fixedShape = mode.filmedScenes > 0;
    setConversationTurns((current) => [...current, { index, prompt, orientation, fixedShape }]);

    setSpokenUpTo(-1);
    setPictureEnded(false);
    const askedAt = Date.now();
    let timeline: ReturnType<typeof createSceneTimeline> | undefined;
    let pendingStyle: Video["style"] | undefined;
    let playbackStartedAt: number | undefined;
    // Scenes are finished out of order - each one's line and its audio take
    // their own time - so they are held by position and appended only as an
    // unbroken run from the front. A quick scene three must not overtake a
    // slow scene two.
    const ready: (VideoScene | undefined)[] = [];
    let appended = 0;
    // The opening line holds playback only while it is actually being said.
    // Cutting a sentence off two seconds in is worse than the second it costs
    // to let it land, and the response is rarely ready first: the line starts at
    // about two seconds and the plan arrives at six.
    let speakingOpening = false;

    const flush = () => {
      // A cancelled run must not put anything on screen. The opening line's
      // own cleanup calls this after the prompt that asked for it was
      // abandoned, and without the guard an abandoned response opens a timeline
      // over the top of the one that replaced it.
      if (inFlight.signal.aborted) return;
      let available = appended;
      while (ready[available]) available += 1;
      if (available === appended) return;
      if (!timeline) {
        if (!pendingStyle) return;
        if (speakingOpening) return;
        // Released by the continue button, which calls this again.
        if (heldRef.current) return;
        timeline = createSceneTimeline({ style: pendingStyle, orientation });
        playbackStartedAt = Date.now();
        console.log(`[video-chat] ${String(playbackStartedAt - askedAt).padStart(6)}ms  playback opened on ${available} scene${available === 1 ? "" : "s"}`);
        setStream(timeline.stream);
        setComposing(false);
      }
      while (ready[appended]) timeline.add(ready[appended++]!);
      const script = ready.slice(0, appended) as VideoScene[];
      setConversationTurns((current) => current.map((turn) => (turn.index === index
        ? { ...turn, video: { ...(turn.video ?? emptyVideo(orientation)), scenes: script } }
        : turn)));
    };
    flushRef.current = flush;

    // Fired with the response, not after it, because its whole purpose is to
    // occupy the six seconds the planner spends writing its first scene.
    void (async () => {
      try {
        const response = await fetch("/api/video-chat?action=opening", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: inFlight.signal,
          body: JSON.stringify({ prompt }),
        });
        if (!response.ok) return void console.warn(`[video-chat] no opening line: endpoint returned ${response.status}`);
        const line = ((await response.json() as { line?: string }).line ?? "").trim();
        if (!line) return void console.warn("[video-chat] no opening line: the model returned an empty line");
        if (inFlight.signal.aborted) return void console.warn("[video-chat] opening line dropped: the prompt was replaced");
        const spoken = await voice.prepare(line, inFlight.signal);
        // If the response got here first there is nothing to cover, and an
        // opening line over a video that is already playing is just two
        // voices. Each of these is silence the viewer cannot explain, so each
        // says which one it was - the alternative is guessing from a log that
        // records only what did happen.
        if (!spoken) return void console.warn("[video-chat] opening line has no audio: speech action gave nothing back");
        if (timeline) return void console.warn("[video-chat] opening line skipped: the response was ready first");
        if (inFlight.signal.aborted) return void console.warn("[video-chat] opening line dropped: the prompt was replaced");
        speakingOpening = true;
        setOpeningSpeaking(true);
        // The opening is the response's first line, so it takes the subtitle slot
        // as it starts being said. The wait then holds the same one line the
        // response will, and the cut to scene one is a line change rather than a
        // change of screen.
        setCue(line);
        setConversationTurns((current) => current.map((turn) => (turn.index === index
          ? { ...turn, opening: line }
          : turn)));
        await voice.speak(line, { signal: inFlight.signal });

        // A filmed response takes about three times as long to compose as a
        // templated one, and one line covers a third of that wait. If the
        // picture still is not ready, say one more thing about the same puzzle
        // rather than leaving the card silent. Asked for only once, and only
        // when the wait has actually outlasted the first line.
        if (timeline || inFlight.signal.aborted) return;
        const more = await fetch("/api/video-chat?action=opening", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: inFlight.signal,
          body: JSON.stringify({ prompt, said: line }),
        })
          .then(async (result) => (result.ok ? ((await result.json()) as { line?: string }).line ?? "" : ""))
          .catch(() => "");
        const second = more.trim();
        if (!second || timeline || inFlight.signal.aborted) return;
        if (!(await voice.prepare(second, inFlight.signal))) return;
        if (timeline || inFlight.signal.aborted) return;
        setCue(second);
        setConversationTurns((current) => current.map((turn) => (turn.index === index
          ? { ...turn, opening: `${line} ${second}` }
          : turn)));
        await voice.speak(second, { signal: inFlight.signal });
      } catch {
        // A warm-up with no voice, not a broken response.
      } finally {
        speakingOpening = false;
        setOpeningSpeaking(false);
        flush();
      }
    })();

    try {
      const response = await streamResponseWithRetry({
        prompt,
        theme,
        mode,
        orientation,
        signal: inFlight.signal,
        // A second plan numbers its scenes from zero, so it can only replace
        // the first while nothing has been appended yet.
        canRetry: () => timeline === undefined,
        onRetry: () => { ready.length = 0; },
        // The style arrives before any scene, and the timeline needs it. The
        // player is still not given a stream yet: handed one with no scenes it
        // shows its own generation cover, and the wait owns that screen.
        onStyle: (style) => { pendingStyle = style; },
        onScene: async (scene, position) => {
          // The audio exists before the scene is appended, because its
          // measured length is what the scene is held for. Every line's audio
          // is requested as that line lands, so the requests overlap instead
          // of queueing behind each other.
          const spoken = scene.narration ? await voice.prepare(scene.narration, inFlight.signal) : undefined;
          ready[position] = pacedScene(scene, spoken?.seconds);
          flush();
        },
      });
      if (inFlight.signal.aborted) return;
      // Whatever is still held goes in now: the last scene's audio may have
      // landed after the stream closed, and the opening line may still have
      // been speaking when the one before it was appended.
      flush();

      // Completing the timeline is what ends playback and offers a replay, so
      // doing it while the last line is still being said cuts the video chat off
      // mid-sentence and invites the viewer to start again over the top of it.
      // The scenes are held for their measured audio, so their total is when
      // the picture runs out; the voice check catches the tail. Watching only
      // for silence would end the response in the gap between two lines.
      const runtime = (ready.slice(0, appended) as VideoScene[])
        .reduce((total, scene) => total + (scene.timing?.fixedDuration ?? 0), 0) * 1000;
      await new Promise<void>((resolve) => {
        const startedAt = playbackStartedAt ?? Date.now();
        const poll = window.setInterval(() => {
          const elapsed = Date.now() - startedAt;
          // A voice that never starts must not hold the video open forever.
          if ((elapsed >= runtime && !speakingRef.current) || elapsed > runtime + 30_000 || inFlight.signal.aborted) {
            window.clearInterval(poll);
            resolve();
          }
        }, 150);
      });
      if (inFlight.signal.aborted) return;
      timeline?.complete();
      // The paced scenes, not the planned ones. What is stored is what gets
      // replayed, and the planner's own timing is the estimate that cuts the
      // voice off - a replay has to hold each scene for the same measured
      // audio the first showing did.
      const completed: Video = { ...response.video, scenes: ready.slice(0, appended) as VideoScene[] };
      setConversationTurns((current) => current.map((turn) => (turn.index === index ? { ...turn, video: completed } : turn)));
      setSuggestions(response.suggestions);
    } catch (cause) {
      if (inFlight.signal.reason instanceof Error && inFlight.signal.reason.message === "stalled") {
        setComposing(false);
        setError("The response did not come back within three minutes. Check the dev server output and ask again.");
        return;
      }
      if (inFlight.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      window.clearTimeout(deadline);
      if (!inFlight.signal.aborted) setComposing(false);
    }
  }, [narration, voice, theme, mode, viewportOrientation, listen]);

  const current = turns.at(-1);
  const shown = viewing === undefined ? current : turns.find((turn) => turn.index === viewing) ?? current;
  const showing = Boolean(stream || replaying);

  // Held wins over everything: a stopped session is stopped, whether the voice
  // it stopped was the opening line or the fourth scene. And the opening line
  // counts as narrating, because it is - the video chat is talking, and the only
  // thing still loading is the picture behind it.
  const filmingStep = useFilmingStep(composing, current?.index);
  const welcome = useWelcome(turns.length === 0);

  /*
   * What shape the stage is, and whether it may change.
   *
   * A templates-only response is handed "auto" and re-lays-out with the window,
   * because every template is built for both shapes. A filmed one is handed
   * the orientation it was filmed in and keeps it - opened on a desktop, a
   * response shot in portrait is a portrait video with black either side, which
   * is honest, where stretching it to 16:9 would not be.
   */
  const shownOrientation = shown?.orientation ?? viewportOrientation;
  const playerOrientation = shown?.fixedShape ? shownOrientation : "auto" as const;
  const stageOrientation = shown?.fixedShape ? shownOrientation : viewportOrientation;

  const status: Status = turns.length === 0 ? "idle"
    : held ? "paused"
    : composing ? (openingSpeaking ? "narrating" : "drawing")
    : showing && !pictureEnded ? "narrating"
    : "ended";

  /** Stop the picture and the voice together, and put the cursor in the box. */
  const holdPlayback = useCallback(() => {
    heldRef.current = true;
    setHeld(true);
    voice.pause();
    inputRef.current?.focus();
  }, [voice]);

  const releasePlayback = useCallback(() => {
    heldRef.current = false;
    setHeld(false);
    voice.resume();
    // A response that finished composing while the session was stopped is
    // waiting to be let onto the stage, and this is what lets it on.
    flushRef.current?.();
  }, [voice]);

  const replay = useCallback(() => {
    if (!shown?.video) return;
    narration.interrupt();
    voice.resume();
    heldRef.current = false;
    setHeld(false);
    setStream(undefined);
    setSpokenUpTo(-1);
    setCue(shown.opening);
    setReplaying(shown.video);
    setReplayCount((count) => count + 1);
    setPictureEnded(false);
  }, [shown, narration, voice]);

  const newSession = useCallback(() => {
    // Nothing to clear yet: the only useful thing this can do is put the cursor
    // in the box, which is where someone pressing it was heading.
    if (turns.length === 0) {
      inputRef.current?.focus();
      return;
    }
    inFlightRef.current?.abort();
    narration.interrupt();
    voice.resume();
    setConversationTurns([]);
    setStream(undefined);
    setReplaying(undefined);
    setViewing(undefined);
    setSuggestions([]);
    setError(undefined);
    setCue(undefined);
    heldRef.current = false;
    setHeld(false);
    setPictureEnded(false);
    setOpeningSpeaking(false);
    setComposing(false);
    setHistoryOpen(false);
    setSettingsOpen(false);
    setSheetOpen(false);
    turnRef.current = 0;
  }, [narration, voice, turns.length]);

  /**
   * The one line under the stage.
   *
   * It carries only what the video chat has actually said - the opening line while
   * the response is being composed, then each scene's line as that scene plays.
   * It stays empty rather than reporting progress: the stage says what is
   * being filmed, and this slot is the voice.
   */
  // Nothing until the video chat says something. The slot is the voice, so an
  // empty voice is an empty slot - a sentence explaining the page to someone
  // already looking at it is not the voice, and it was the only thing on
  // screen pretending to be spoken when nothing was.
  const line = cue ?? "";

  const transport = status === "narrating"
    ? { label: "Pause", action: holdPlayback, icon: <Stop /> }
    : status === "paused"
      ? { label: "Continue", action: releasePlayback, icon: <Play /> }
      : status === "ended" && shown?.video
        ? { label: "Play again", action: replay, icon: <Replay /> }
        : undefined;

  return <div className="app" data-orientation={stageOrientation}>
    <header className="chrome">
      <div className="group">
        <button
          type="button"
          className="round"
          aria-label={turns.length === 0 ? "Ask a prompt" : "New session"}
          onClick={newSession}
        ><Plus /></button>
        {turns.length > 0 && <button
          ref={historyButtonRef}
          type="button"
          className="pill"
          aria-expanded={historyOpen}
          aria-controls="session-history"
          aria-haspopup="menu"
          onClick={() => { setHistoryOpen((open) => !open); setSettingsOpen(false); }}
        >
          {turns.length} asked
        </button>}
      </div>
      <div className="group">
        <button
          ref={settingsButtonRef}
          type="button"
          className="round"
          aria-label="Settings"
          aria-expanded={settingsOpen}
          aria-controls="session-settings"
          aria-haspopup="dialog"
          onClick={() => { setSettingsOpen((open) => !open); setHistoryOpen(false); }}
        ><Gear /></button>
        <button
          type="button"
          className="round"
          aria-label={muted ? "Turn the voice on" : "Turn the voice off"}
          aria-pressed={muted}
          onClick={() => setMuted((quiet) => !quiet)}
        >{muted ? <Muted /> : <Sound />}</button>
      </div>
    </header>

    <div className="stage-area">
      <div className="stage" style={{ background: themeBackground(theme) }}>
        {/* The ground the response's own scenes are composed on, kept moving,
            with the prompt on it. No step list and no clock - at eight
            seconds a number counting up measures the wait rather than filling
            it. The prompt is what the opening line is spoken over, and that
            line is read below the stage: prompt on top, words underneath.
            Both are gone the moment the video has something to show. */}
        {!showing && <>
          <div className="ground" aria-hidden="true" />
          {turns.length === 0 && <Welcome data={welcome} onAsk={(prompt) => void ask(prompt)} />}
          {shown?.prompt && <div className="asked">
            <p className="asked-prompt">{shown.prompt}</p>
            {composing && <p className="asked-step" aria-live="polite">{filmingStep}</p>}
          </div>}
        </>}
        {replaying
          ? <VideoPlayer key={`replay-${replayCount}`} video={replaying} templates={templates} orientation={playerOrientation} responsiveBreakpoint={DESKTOP_WIDTH} autoPlay paused={held} onSceneChange={onSceneChange} onComplete={() => setPictureEnded(true)} controls={false} ariaLabel="Replay" />
          : stream
            ? <VideoPlayer stream={stream as never} templates={templates} orientation={playerOrientation} responsiveBreakpoint={DESKTOP_WIDTH} autoPlay paused={held} onSceneChange={onSceneChange} onComplete={() => setPictureEnded(true)} onError={(cause) => setError(cause.message)} controls={false} ariaLabel="The response" />
            : null}

        {/* What to ask next, on the frame the response ended on.
            The same cards the opening screen offers, because they are the same
            kind of thing - a prompt the video chat will respond to. As pills under
            the composer they read as tags describing the page; here they are
            the end of the response, in the shape the next response arrives in.
            The last scene stays visible above them, so the response does not
            vanish the moment it finishes.

            Gated on a picture that exists and has finished, rather than on the
            ended status. Status is ended whenever nothing is composing and
            nothing is on the stage, which is also true in the gap before the
            first scene opens - and the cards flashed there, over an empty
            frame, until the video started and took them away again. */}
        {showing && pictureEnded && suggestions.length > 0 && <div className="ending">
          <div className="ending-wash" aria-hidden="true" />
          <div className="ending-body">
            <p className="ending-label">Ask next</p>
            <SuggestionCards suggestions={suggestions} label="Follow-up prompts" onAsk={(prompt) => void ask(prompt)} />
          </div>
        </div>}
      </div>

      {historyOpen && <nav ref={historyRef} id="session-history" className="sheet-popover history" aria-label="Prompts this session">
        {turns.map((turn) => <button
          key={turn.index}
          type="button"
          className={turn.index === shown?.index ? "current" : undefined}
          disabled={!turn.video}
          onClick={() => {
            setViewing(turn.index);
            setStream(undefined);
            setReplaying(turn.video);
            setReplayCount((count) => count + 1);
            setPictureEnded(false);
            setCue(turn.opening);
            setSpokenUpTo(-1);
            heldRef.current = false;
            setHeld(false);
            setHistoryOpen(false);
          }}
        >
          <span className="index">{String(turn.index).padStart(2, "0")}</span>
          <span className="prompt">{turn.prompt}</span>
        </button>)}
      </nav>}

      {settingsOpen && <div
        ref={settingsRef}
        id="session-settings"
        className="sheet-popover settings"
        role="dialog"
        aria-label="Settings"
      >
        <fieldset>
          <legend>Appearance</legend>
          {([["system", "Match system"], ["light", "Light"], ["dark", "Dark"]] as const).map(([value, label]) => <label key={value}>
            <input type="radio" name="theme" checked={value === themeChoice} onChange={() => setThemeChoice(value)} />
            <span><strong>{label}</strong></span>
          </label>)}
        </fieldset>
        <p className="settings-note">Visuals and style apply to your next prompt.</p>
        <fieldset>
          <legend>Visuals</legend>
          {availableModes.map((option) => <label key={option.id}>
            <input type="radio" name="visuals" checked={option.id === modeId} onChange={() => setModeId(option.id)} />
            <span><strong>{option.label}</strong>{option.note}</span>
          </label>)}
        </fieldset>
        <fieldset>
          <legend>Style</legend>
          {themes.map((option) => <label key={option.id}>
            <input type="radio" name="style" checked={option.id === themeId} onChange={() => setThemeId(option.id)} />
            <span><strong>{option.label}</strong></span>
          </label>)}
        </fieldset>
      </div>}
    </div>

    <div className="panel">
      <div className="panel-inner">
        {/* Always, empty or not. The bar is the floor the picture stands on, so
            a row that appears with the first prompt shortens the picture at
            the moment attention moves to it - the one moment it should not
            move. Reserved from the first paint, the stage is one size for the
            whole session and the opening screen is that same size. */}
        <div className="line-row">
          <p className="line" aria-live="polite">{line}</p>
          {shown?.video && <button type="button" className="full-response" onClick={() => setSheetOpen(true)}>
            Full response <ChevronUp />
          </button>}
        </div>

        {(error || listen.error) && <p className="error" role="status">
          <Warning /><span>{error ?? listen.error}</span>
        </p>}

        {/* Always here, from the first moment to the last. Hiding the way to
            ask until the response finished meant the one thing a user wants
            while watching - to cut in and ask something else - was the one
            thing the page took away. */}
        <form className="composer" onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
          <Waveform active={listen.listening || ((narration.speaking || openingSpeaking) && !muted && !held)} listening={listen.listening} />
          <label className="sr-only" htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder={listen.listening ? "Listening…"
              : listen.thinking ? "Working out what you said…"
              : status === "narrating" ? "Talking — type to jump in…"
              // A placeholder's job is to prompt what to type, not to restate
              // the product - the headline above it already says the response
              // comes back as video. And "science prompt" narrowed a video chat
              // that turns anything to one subject it does not enforce.
              : turns.length > 0 ? "Ask a follow-up…" : "Ask anything…"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
          />
          {transport && <button type="button" className="ghost transport" aria-label={transport.label} onClick={transport.action}>{transport.icon}</button>}
          {/* Only where the browser can actually hear. A disabled mic is a
              control that fails silently every time it is pressed; a button
              that is not there explains itself. */}
          {listen.supported && <button
            type="button"
            className={`ghost${listen.listening ? " listening" : ""}`}
            aria-label={listen.listening ? "Stop listening" : "Ask by voice"}
            aria-pressed={listen.listening}
            onClick={listen.toggle}
          ><Mic /></button>}
          <button type="submit" className="send" aria-label="Ask" disabled={!draft.trim() || status === "drawing"}><Send /></button>
        </form>
      </div>
    </div>

    {sheetOpen && shown && <div className="sheet-layer">
      <button type="button" className="scrim" tabIndex={-1} aria-hidden="true" onClick={() => setSheetOpen(false)} />
      <article ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="full-response-title">
        <header>
          <h1 id="full-response-title">{shown.prompt}</h1>
          <button type="button" className="round" aria-label="Close the full response" onClick={() => setSheetOpen(false)}><Close /></button>
        </header>
        <div className="sheet-body">
          {shown.opening && <p>{shown.opening}</p>}
          {(shown.video?.scenes ?? [])
            // A past response is finished, so all of it is readable. The one
            // being said arrives a line at a time, with the scene it belongs
            // to - opening this mid-response must not hand over the ending.
            .slice(0, shown === current && !replaying ? spokenUpTo + 1 : undefined)
            .map((scene) => scene.narration && <p key={scene.id}>{scene.narration}</p>)}
        </div>
      </article>
    </div>}
  </div>;
}

createRoot(document.getElementById("root")!).render(<App />);
