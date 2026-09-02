import { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSceneTimeline, getSceneDuration, type Video } from "@vanillaskyai/video";
import { VideoPlayer, useNarration } from "@vanillaskyai/video/react";

const OPENING_QUESTIONS = [
  "Why does the Moon always show one face?",
  "What makes ocean waves break?",
  "How does an atom hold itself together?",
  "Why do some animals walk on two legs?",
];
import { createTemplateRegistry } from "@vanillaskyai/video/templates";
import { definitions } from "./templates";
import { createBrowserVoice } from "./browser-voice";
import { planLesson } from "./plan-lesson";
import { defaultMode, modeById, visualModes } from "./modes";
import { defaultTheme, themeById, themes } from "./themes";
import { Warmup } from "./warmup";
import "./styles.css";

const templates = createTemplateRegistry({ definitions });

interface Answer {
  index: number;
  question: string;
  /** Replayable from JSON, with no model call: an answer is just data. */
  video?: Video;
}

/** Hold every scene for as long as its line takes to say. */
function paced(video: Video): Video {
  return {
    ...video,
    scenes: video.scenes.map((scene) => ({
      ...scene,
      timing: { ...scene.timing, fixedDuration: getSceneDuration(scene, templates.getTemplateMetadata(scene.templateId)) },
    })),
  };
}

function App() {
  const [draft, setDraft] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [themeId, setThemeId] = useState(defaultTheme.id);
  const [modeId, setModeId] = useState(defaultMode.id);
  const [stream, setStream] = useState<AsyncIterable<unknown>>();
  const [replaying, setReplaying] = useState<Video>();
  const [viewing, setViewing] = useState<number>();
  const [followups, setFollowups] = useState<string[]>([]);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string>();

  const voice = useMemo(createBrowserVoice, []);
  const narration = useNarration({ voice });
  const theme = themeById(themeId);
  const mode = modeById(modeId);
  const answerRef = useRef(0);
  const inFlightRef = useRef<AbortController | undefined>(undefined);

  const ask = useCallback(async (value: string) => {
    const question = value.trim();
    if (!question) return;
    setDraft("");
    // Composing outlives the question that asked for it, so the next question
    // cancels it: otherwise a lesson nobody is waiting for arrives and
    // overwrites the one that replaced it.
    inFlightRef.current?.abort();
    const inFlight = new AbortController();
    inFlightRef.current = inFlight;

    narration.interrupt();
    setError(undefined);
    setFollowups([]);
    setViewing(undefined);
    setReplaying(undefined);
    setStream(undefined);
    setComposing(true);
    const index = (answerRef.current += 1);
    setAnswers((current) => [...current, { index, question }]);

    try {
      const lesson = await planLesson(question, theme, mode, inFlight.signal);
      if (inFlight.signal.aborted) return;
      const video = paced(lesson.video);

      // The timeline is what the player understands: envelopes with exact
      // sequence numbers, scene positions and a completion snapshot. Composing
      // one by hand is where every silent playback failure comes from.
      const timeline = createSceneTimeline({ style: video.style, orientation: "landscape" });
      setStream(timeline.stream);
      for (const scene of video.scenes) timeline.add(scene);
      timeline.complete();

      setAnswers((current) => current.map((answer) => (answer.index === index ? { ...answer, video } : answer)));
      setFollowups(lesson.followups);
    } catch (cause) {
      if (inFlight.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!inFlight.signal.aborted) setComposing(false);
    }
  }, [narration, theme, mode]);

  const current = answers.at(-1);
  const shown = viewing === undefined ? current : answers.find((answer) => answer.index === viewing) ?? current;
  const suggestions = followups.length > 0 ? followups : OPENING_QUESTIONS;
  // Asking mid-lesson cuts the tutor off, so there is nothing to ask with until
  // it has finished - only a deliberate way to cut in.
  const answering = composing || narration.speaking;

  const composer = <form className="composer" onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
    <label className="sr-only" htmlFor="question">Question</label>
    <input
      id="question"
      value={draft}
      placeholder={answers.length > 0 ? "Ask a follow-up…" : "Ask a science question…"}
      onChange={(event) => setDraft(event.target.value)}
    />
    <button type="submit" disabled={!draft.trim()} aria-label="Ask">↑</button>
  </form>;

  if (answers.length === 0) {
    return <main className="landing">
      <h1>What do you want to <em>understand today?</em></h1>
      <p className="lede">
        Ask a question and the answer is composed as a short narrated video — the
        scenes and the words planned together, so the voice and the picture start
        together.
      </p>
      {composer}
      <div className="setup">
        <label>
          <span>Style</span>
          <select value={themeId} onChange={(event) => setThemeId(event.target.value)}>
            {themes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Visuals</span>
          <select value={modeId} onChange={(event) => setModeId(event.target.value as typeof modeId)}>
            {visualModes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <p className="setup-note">{mode.note}</p>
      </div>
      <div className="suggestions wide">
        {OPENING_QUESTIONS.map((question) => <button key={question} type="button" onClick={() => void ask(question)}>{question}</button>)}
      </div>
      {error && <p className="error">{error}</p>}
    </main>;
  }

  return <main className="session">
    <header className="bar">
      <details className="history">
        <summary>{answers.length} question{answers.length === 1 ? "" : "s"} this session</summary>
        <ol>
          {answers.map((answer) => <li key={answer.index}>
            <button
              type="button"
              className={answer.index === shown?.index ? "current" : undefined}
              disabled={!answer.video}
              onClick={() => { setViewing(answer.index); setReplaying(answer.video); }}
            >
              <span className="turn-index">{String(answer.index).padStart(2, "0")}</span>
              <span className="turn-question">{answer.question}</span>
            </button>
          </li>)}
        </ol>
      </details>
      <button type="button" className="new" onClick={() => { inFlightRef.current?.abort(); narration.interrupt(); setAnswers([]); setStream(undefined); setReplaying(undefined); setViewing(undefined); setFollowups([]); setError(undefined); answerRef.current = 0; }}>
        + New session
      </button>
    </header>

    <div className="columns">
      <div className="stage-column">
        <div className="stage" data-theme={theme.id}>
          {replaying
            ? <VideoPlayer video={replaying} templates={templates} orientation="landscape" autoPlay onSceneChange={narration.onSceneChange} ariaLabel="Replay" />
            : stream
              ? <VideoPlayer stream={stream as never} templates={templates} orientation="landscape" autoPlay onSceneChange={narration.onSceneChange} onError={(cause) => setError(cause.message)} ariaLabel="The lesson" />
              : null}
          <Warmup visible={composing && !error} />
          {narration.speaking && <span className="live"><span aria-hidden="true">●</span> Speaking</span>}
        </div>

        {answering
          ? <p className="answering">
              <span>{narration.speaking ? "Explaining…" : "Composing the lesson…"}</span>
              {narration.speaking && <button type="button" onClick={() => narration.interrupt()}>Cut in</button>}
            </p>
          : <>
              {composer}
              <div className="suggestions">
                {suggestions.map((question) => <button key={question} type="button" onClick={() => void ask(question)}>{question}</button>)}
              </div>
            </>}

        {error && <p className="error">{error}</p>}
      </div>

      <article className="script" aria-label="What the tutor said">
        <h1>{shown?.question}</h1>
        {(shown?.video?.scenes ?? []).map((scene) => scene.narration && <p key={scene.id}>{scene.narration}</p>)}
      </article>
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
