import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { VideoOrientation } from "../protocol/types.js";
import { VideoPlayer } from "../player/video-player.js";
import { useVideoChat, type UseVideoChatOptions } from "./use-video-chat.js";
import type { VideoChatMode, VideoChatSuggestion } from "./types.js";
import { defaultMode, modeById, visualModes } from "./modes";
import { defaultTheme, themeBackground, themeById, themes } from "./themes";
import { ChevronUp, Close, Gear, Mic, Replay, Send, Sound, Stop, Muted, Play, Plus, Warning } from "./icons";
import { useDismiss, useFocusTrap } from "./use-dismiss";
import { Welcome } from "./welcome";
import { Frame, SuggestionCards } from "./suggestion-cards";
import { useVoiceInput } from "./use-voice-input";
const DESKTOP_WIDTH = 900;

type ThemeChoice = "system" | "light" | "dark";
type Status = "idle" | "drawing" | "narrating" | "paused" | "ended";

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

const STEPS = [
  "Rolling camera…",
  "Framing the shots…",
  "Filming your response…",
  "Still filming…",
];

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

function Waveform({ active, listening }: { active: boolean; listening?: boolean }) {
  return <span className={`waveform${active ? " on" : ""}${listening ? " hearing" : ""}`} aria-hidden="true">
    {[0, 1, 2, 3, 4].map((bar) => <span key={bar} style={{ animationDelay: `${bar * 140}ms`, animationDuration: `${900 + bar * 130}ms` }} />)}
  </span>;
}

export interface VideoChatProps {
  /** Connection, providers, templates, and rendering defaults for the session. */
  options?: UseVideoChatOptions;
  /** Added to the scoped component root for application layout and branding. */
  className?: string;
  /** Replaces the default two-line welcome heading without changing the interaction. */
  welcomeTitle?: ReactNode;
}

/** A complete voice-and-video chat interface backed by createVideoChatHandler. */
export function VideoChat({ options = {}, className, welcomeTitle }: VideoChatProps) {
  const [draft, setDraft] = useState("");
  const [themeId, setThemeId] = useState(defaultTheme.id);
  const [modeId, setModeId] = useState<VideoChatMode>(options.mode ?? defaultMode.id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const viewportOrientation = useViewportOrientation();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("system");
  const theme = themeById(themeId);
  const sessionOrientation = options.orientation ?? viewportOrientation;
  const { brand: configuredBrand, style: configuredStyle, ...sessionOptions } = options;
  const presentationBrand = configuredBrand ?? theme.brand;
  const chat = useVideoChat({
    ...sessionOptions,
    mode: modeId,
    orientation: sessionOrientation,
    brand: presentationBrand,
    style: { generatedLook: theme.generatedLook, ...configuredStyle },
  });

  const instanceId = useId();
  const historyId = `${instanceId}-history`;
  const settingsId = `${instanceId}-settings`;
  const promptId = `${instanceId}-prompt`;
  const responseTitleId = `${instanceId}-response-title`;
  const appearanceName = `${instanceId}-appearance`;
  const visualsName = `${instanceId}-visuals`;
  const styleName = `${instanceId}-style`;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const listen = useVoiceInput(setDraft, chat.capabilities?.transcription ?? false, {
    endpoint: options.endpoint,
    headers: options.headers,
    credentials: options.credentials,
    fetcher: options.fetcher,
  });

  const historySurfaces = useMemo(() => [historyRef, historyButtonRef], []);
  const settingsSurfaces = useMemo(() => [settingsRef, settingsButtonRef], []);
  const noSurfaces = useMemo(() => [], []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  useDismiss(historyOpen, closeHistory, historySurfaces);
  useDismiss(settingsOpen, closeSettings, settingsSurfaces);
  useDismiss(sheetOpen, closeSheet, noSurfaces);
  useFocusTrap(sheetOpen, sheetRef);

  const ask = useCallback((value: string | VideoChatSuggestion) => {
    const prompt = (typeof value === "string" ? value : value.prompt).trim();
    if (!prompt) return;
    setDraft("");
    listen.stop();
    setHistoryOpen(false);
    setSettingsOpen(false);
    setSheetOpen(false);
    void chat.ask(prompt, typeof value === "string" ? undefined : {
      openingMedia: value.media,
      opening: value.opening,
    });
  }, [chat, listen]);

  const newSession = useCallback(() => {
    if (chat.turns.length === 0) {
      inputRef.current?.focus();
      return;
    }
    chat.reset();
    setHistoryOpen(false);
    setSettingsOpen(false);
    setSheetOpen(false);
  }, [chat]);

  const current = chat.currentTurn;
  const shown = chat.shownTurn;
  const showing = chat.playerProps != null;
  const waitingForPicture = chat.turns.length > 0 && !showing
    && (chat.status === "composing" || chat.status === "playing" || chat.status === "paused");
  const filmingStep = useFilmingStep(waitingForPicture, current?.id);
  const status: Status = chat.turns.length === 0 ? "idle"
    : chat.status === "composing" ? "drawing"
    : chat.status === "playing" ? "narrating"
    : chat.status === "error" || chat.status === "cancelled" ? "ended"
    : chat.status;

  const shownOrientation = shown?.orientation ?? sessionOrientation;
  const stageOrientation = shown?.fixedOrientation ? shownOrientation : sessionOrientation;
  const availableModes = visualModes.filter((option) => chat.availableModes.includes(option.id));
  const selectedMode = modeById(modeId);
  const line = chat.caption ?? "";
  const transport = status === "narrating"
    ? { label: "Pause", action: chat.pause, icon: <Stop /> }
    : status === "paused"
      ? { label: "Continue", action: chat.resume, icon: <Play /> }
      : status === "ended" && shown?.completed && shown.video
        ? { label: "Play again", action: chat.replay, icon: <Replay /> }
        : undefined;

  return <div
    className={`vanillasky-video-chat${className ? ` ${className}` : ""}`}
    data-orientation={stageOrientation}
    data-theme={themeChoice}
  >
    <header className="chrome">
      <div className="group">
        <button
          type="button"
          className="round"
          aria-label={chat.turns.length === 0 ? "Ask a prompt" : "New session"}
          onClick={newSession}
        ><Plus /></button>
        {chat.turns.length > 0 && <button
          ref={historyButtonRef}
          type="button"
          className="pill"
          aria-expanded={historyOpen}
          aria-controls={historyId}
          onClick={() => { setHistoryOpen((open) => !open); setSettingsOpen(false); }}
        >
          {chat.turns.length} asked
        </button>}
      </div>
      <div className="group">
        <button
          ref={settingsButtonRef}
          type="button"
          className="round"
          aria-label="Settings"
          aria-expanded={settingsOpen}
          aria-controls={settingsId}
          aria-haspopup="dialog"
          onClick={() => { setSettingsOpen((open) => !open); setHistoryOpen(false); }}
        ><Gear /></button>
        <button
          type="button"
          className="round"
          aria-label={chat.muted ? "Turn the voice on" : "Turn the voice off"}
          aria-pressed={chat.muted}
          onClick={() => chat.setMuted(!chat.muted)}
        >{chat.muted ? <Muted /> : <Sound />}</button>
      </div>
    </header>

    <div className="stage-area">
      <div className="stage" style={{ background: themeBackground(presentationBrand) }}>
        {!showing && <>
          <div className="ground" aria-hidden="true" />
          {shown?.openingMedia && <>
            <Frame media={shown.openingMedia} poster />
            <div className="opening-wash" aria-hidden="true" />
          </>}
          {chat.turns.length === 0 && <Welcome data={chat.welcome} onAsk={ask} title={welcomeTitle} />}
          {shown?.prompt && <div className="asked">
            <p className="asked-prompt">{shown.prompt}</p>
            {waitingForPicture && <p className="asked-step" aria-live="polite">{filmingStep}</p>}
          </div>}
        </>}
        {chat.playerProps && <VideoPlayer
          key={chat.playerKey}
          {...chat.playerProps}
          templates={options.templates}
          responsiveBreakpoint={DESKTOP_WIDTH}
          ariaLabel={chat.playerProps.video ? "Replay" : "The response"}
        />}

        {showing && chat.playbackEnded && chat.suggestions.length > 0 && <div className="ending">
          <div className="ending-wash" aria-hidden="true" />
          <div className="ending-body">
            <p className="ending-label">Ask next</p>
            <SuggestionCards suggestions={[...chat.suggestions]} label="Follow-up prompts" onAsk={ask} />
          </div>
        </div>}
      </div>

      {historyOpen && <nav ref={historyRef} id={historyId} className="sheet-popover history" aria-label="Prompts this session">
        {chat.turns.map((turn, index) => <button
          key={turn.id}
          type="button"
          className={turn.id === shown?.id ? "current" : undefined}
          disabled={!turn.completed || !turn.video}
          onClick={() => {
            chat.selectTurn(turn.id);
            setHistoryOpen(false);
          }}
        >
          <span className="index">{String(index + 1).padStart(2, "0")}</span>
          <span className="prompt">{turn.prompt}</span>
        </button>)}
      </nav>}

      {settingsOpen && <div
        ref={settingsRef}
        id={settingsId}
        className="sheet-popover settings"
        role="dialog"
        aria-label="Settings"
      >
        <fieldset>
          <legend>Appearance</legend>
          {([["system", "Match system"], ["light", "Light"], ["dark", "Dark"]] as const).map(([value, label]) => <label key={value}>
            <input type="radio" name={appearanceName} checked={value === themeChoice} onChange={() => setThemeChoice(value)} />
            <span><strong>{label}</strong></span>
          </label>)}
        </fieldset>
        <p className="settings-note">Visuals and style apply to your next prompt.</p>
        <fieldset>
          <legend>Visuals</legend>
          {availableModes.map((option) => <label key={option.id}>
            <input type="radio" name={visualsName} checked={option.id === selectedMode.id} onChange={() => setModeId(option.id)} />
            <span><strong>{option.label}</strong>{option.note}</span>
          </label>)}
        </fieldset>
        <fieldset>
          <legend>Style</legend>
          {themes.map((option) => <label key={option.id}>
            <input type="radio" name={styleName} checked={option.id === themeId} onChange={() => setThemeId(option.id)} />
            <span><strong>{option.label}</strong></span>
          </label>)}
        </fieldset>
      </div>}
    </div>

    <div className="panel">
      <div className="panel-inner">
        <div className="line-row">
          <p className="line" aria-live="polite">{line}</p>
          {shown?.video && <button type="button" className="full-response" onClick={() => setSheetOpen(true)}>
            Full response <ChevronUp />
          </button>}
        </div>

        {!chat.error && chat.warnings.length > 0 && <p className="error" role="status">
          <Warning /><span>{chat.warnings.at(-1)}</span>
        </p>}

        {(chat.error || listen.error) && <p className="error" role="status">
          <Warning /><span>{chat.error?.message ?? listen.error}</span>
        </p>}

        <form className="composer" onSubmit={(event) => { event.preventDefault(); ask(draft); }}>
          <Waveform active={listen.listening || (chat.speaking && !chat.muted && status !== "paused")} listening={listen.listening} />
          <label className="sr-only" htmlFor={promptId}>Prompt</label>
          <textarea
            id={promptId}
            ref={inputRef}
            rows={1}
            value={draft}
            placeholder={listen.listening ? "Listening…"
              : listen.thinking ? "Working out what you said…"
              : status === "narrating" ? "Talking — type to jump in…"
              : chat.turns.length > 0 ? "Ask a follow-up…" : "Ask anything…"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(draft);
              }
            }}
          />
          {transport && <button type="button" className="ghost transport" aria-label={transport.label} onClick={transport.action}>{transport.icon}</button>}
          {listen.supported && <button
            type="button"
            className={`ghost${listen.listening ? " listening" : ""}`}
            aria-label={listen.listening ? "Stop listening" : "Ask by voice"}
            aria-pressed={listen.listening}
            disabled={listen.thinking}
            onClick={listen.toggle}
          ><Mic /></button>}
          <button type="submit" className="send" aria-label="Ask" disabled={!draft.trim() || status === "drawing"}><Send /></button>
        </form>
      </div>
    </div>

    {sheetOpen && shown && <div className="sheet-layer">
      <button type="button" className="scrim" tabIndex={-1} aria-hidden="true" onClick={() => setSheetOpen(false)} />
      <article ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={responseTitleId}>
        <header>
          <h1 id={responseTitleId}>{shown.prompt}</h1>
          <button type="button" className="round" aria-label="Close the full response" onClick={() => setSheetOpen(false)}><Close /></button>
        </header>
        <div className="sheet-body">
          {chat.transcript.map((entry, index) => <p key={`${index}-${entry}`}>{entry}</p>)}
        </div>
      </article>
    </div>}
  </div>;
}
