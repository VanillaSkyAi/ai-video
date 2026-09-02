import { useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSceneTimeline, getSceneDuration, type Video, type VideoScene } from "@vanillaskyai/video";
import { VideoPlayer, useNarration } from "@vanillaskyai/video/react";

const OPENING_QUESTIONS = [
  "Why does the Moon always show one face?",
  "What makes ocean waves break?",
  "How does an atom hold itself together?",
  "Why do some animals walk on two legs?",
];
import { createTemplateRegistry } from "@vanillaskyai/video/templates";
import { definitions } from "../vanillasky";
import { createSpokenVoice } from "./spoken-voice";
import { streamLessonWithRetry } from "./plan-lesson";
import { defaultMode, modeById, visualModes } from "./modes";
import { defaultTheme, themeBackground, themeById, themeForeground, themes } from "./themes";
import { Warmup } from "./warmup";
import "./styles.css";

const templates = createTemplateRegistry({ definitions });

interface Answer {
  index: number;
  question: string;
  /**
   * The line said over the question while the lesson was being composed.
   *
   * It belongs to the answer rather than to the warm-up: it is the first thing
   * the tutor said, so it is the first thing the script shows, and a session
   * replayed from history is missing its opening without it.
   */
  opening?: string;
  /** Replayable from JSON, with no model call: an answer is just data. */
  video?: Video;
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

const EMPTY_VIDEO = { schemaVersion: "0.1", orientation: "landscape", scenes: [], style: undefined } as unknown as Video;

/**
 * How many scenes must be ready before the first one plays.
 *
 * One, now that the planner writes the lines. A scene used to trail the one
 * before it by a whole narration call, so starting on scene one risked
 * reaching its end with nothing behind it; the only thing still trailing is
 * that scene's own speech, and every scene's runs at the same time. Scene two
 * lands about a second after scene one and scene one runs for five, so the
 * lead was buying insurance against a gap that can no longer open.
 */
const SCENE_LEAD = 1;

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
  // How far the voice has got. The script is written as the lesson is planned,
  // so without this every line is on the page before a word is said - the
  // answer readable in full while the video is still on its first scene.
  const [spokenUpTo, setSpokenUpTo] = useState(-1);
  // Whether a lesson is on the stage, not whether a sentence is being said.
  // The voice falls silent in the gap between two scenes, and a badge tied to
  // that blinked off and on all the way through the answer.
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string>();

  const voice = useMemo(createSpokenVoice, []);
  const narration = useNarration({ voice });
  // The player reports which scene is showing; that is the cue for both the
  // voice and the script, so they arrive together rather than the words
  // running ahead of the picture.
  const onSceneChange = useCallback((scene: VideoScene, index: number) => {
    setSpokenUpTo((furthest) => Math.max(furthest, index));
    narration.onSceneChange(scene, index);
  }, [narration]);
  // Read inside the async run, which was created before the speaking state it
  // needs to wait on existed.
  const speakingRef = useRef(false);
  speakingRef.current = narration.speaking;
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
    // Composing takes thirty to ninety seconds, so there is no honest way to
    // tell a slow lesson from a stalled one by watching. Past three minutes it
    // is stalled: say so rather than animating forever.
    const deadline = window.setTimeout(() => inFlight.abort(new Error("stalled")), 180_000);

    narration.interrupt();
    setError(undefined);
    setFollowups([]);
    setViewing(undefined);
    setReplaying(undefined);
    setStream(undefined);
    setComposing(true);
    const index = (answerRef.current += 1);
    setAnswers((current) => [...current, { index, question }]);

    setSpokenUpTo(-1);
    setLive(false);
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
    let planComplete = false;
    // The opening line holds playback only while it is actually being said.
    // Cutting a sentence off two seconds in is worse than the second it costs
    // to let it land, and the lesson is rarely ready first: the line starts at
    // about two seconds and the plan arrives at six.
    let speakingOpening = false;

    const flush = () => {
      let available = appended;
      while (ready[available]) available += 1;
      if (available === appended) return;
      if (!timeline) {
        if (!pendingStyle) return;
        // A one-scene lead. Starting on scene one alone risks reaching its end
        // before scene two exists; waiting for the whole lesson is the wait
        // being removed. One scene in hand costs about a second, and it is
        // enough, because every scene's line and audio were started within a
        // moment of each other rather than one after the last.
        if (available < SCENE_LEAD && !planComplete) return;
        if (speakingOpening) return;
        timeline = createSceneTimeline({ style: pendingStyle, orientation: "landscape" });
        playbackStartedAt = Date.now();
        setLive(true);
        console.log(`[tutor] ${String(playbackStartedAt - askedAt).padStart(6)}ms  playback opened on ${available} scene${available === 1 ? "" : "s"}`);
        setStream(timeline.stream);
        setComposing(false);
      }
      while (ready[appended]) timeline.add(ready[appended++]!);
      const script = ready.slice(0, appended) as VideoScene[];
      setAnswers((current) => current.map((answer) => (answer.index === index
        ? { ...answer, video: { ...(answer.video ?? EMPTY_VIDEO), scenes: script } }
        : answer)));
    };

    // Fired with the lesson, not after it, because its whole purpose is to
    // occupy the six seconds the planner spends writing its first scene.
    void (async () => {
      try {
        const response = await fetch("/api/hook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: inFlight.signal,
          body: JSON.stringify({ question }),
        });
        if (!response.ok) return;
        const line = ((await response.json() as { line?: string }).line ?? "").trim();
        if (!line || inFlight.signal.aborted) return;
        const spoken = await voice.prepare(line);
        // If the lesson got here first there is nothing to cover, and an
        // opening line over a video that is already playing is just two
        // voices.
        if (!spoken || timeline || inFlight.signal.aborted) return;
        speakingOpening = true;
        // Written down as it starts being said, like every other line.
        setAnswers((current) => current.map((answer) => (answer.index === index
          ? { ...answer, opening: line }
          : answer)));
        await voice.speak(line, { signal: inFlight.signal });
      } catch {
        // A warm-up with no voice, not a broken lesson.
      } finally {
        speakingOpening = false;
        flush();
      }
    })();

    try {
      const lesson = await streamLessonWithRetry({
        question,
        theme,
        mode,
        signal: inFlight.signal,
        // The style arrives before any scene, and the timeline needs it. The
        // player is still not given a stream yet: handed one with no scenes it
        // shows its own generation cover, and the warm-up owns that wait.
        onStyle: (style) => { pendingStyle = style; },
        onScene: async (scene, position) => {
          // The audio exists before the scene is appended, because its
          // measured length is what the scene is held for. Every line's audio
          // is requested as that line lands, so the requests overlap instead
          // of queueing behind each other.
          const spoken = scene.narration ? await voice.prepare(scene.narration) : undefined;
          ready[position] = pacedScene(scene, spoken?.seconds);
          flush();
        },
      });
      if (inFlight.signal.aborted) return;
      // Whatever is still held goes in now, including the case of a lesson
      // short enough to have never reached the lead.
      planComplete = true;
      flush();

      // Completing the timeline is what ends playback and offers a replay, so
      // doing it while the last line is still being said cuts the tutor off
      // mid-sentence and invites the viewer to start again over the top of it.
      // The scenes are held for their measured audio, so their total is when
      // the picture runs out; the voice check catches the tail. Watching only
      // for silence would end the lesson in the gap between two lines.
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
      setLive(false);
      // The paced scenes, not the planned ones. What is stored is what gets
      // replayed, and the planner's own timing is the estimate that cuts the
      // voice off - a replay has to hold each scene for the same measured
      // audio the first showing did.
      const answered: Video = { ...lesson.video, scenes: ready.slice(0, appended) as VideoScene[] };
      setAnswers((current) => current.map((answer) => (answer.index === index ? { ...answer, video: answered } : answer)));
      setFollowups(lesson.followups);
    } catch (cause) {
      if (inFlight.signal.reason instanceof Error && inFlight.signal.reason.message === "stalled") {
        setComposing(false);
        setError("The lesson did not come back within three minutes. Check the dev server output and ask again.");
        return;
      }
      if (inFlight.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      window.clearTimeout(deadline);
      if (!inFlight.signal.aborted) setComposing(false);
    }
  }, [narration, theme, mode]);

  const current = answers.at(-1);
  const shown = viewing === undefined ? current : answers.find((answer) => answer.index === viewing) ?? current;
  const suggestions = followups.length > 0 ? followups : OPENING_QUESTIONS;

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
            ? <VideoPlayer video={replaying} templates={templates} orientation="landscape" autoPlay onSceneChange={onSceneChange} controls={false} ariaLabel="Replay" />
            : stream
              ? <VideoPlayer stream={stream as never} templates={templates} orientation="landscape" autoPlay onSceneChange={onSceneChange} onError={(cause) => setError(cause.message)} controls={false} ariaLabel="The lesson" />
              : null}
          <Warmup visible={composing && !error} question={current?.question} background={themeBackground(theme)} foreground={themeForeground(theme)} />
          {/* One badge for the whole answer: composing, then playing. It says
              what the stage is doing, which does not change between scenes. */}
          {(composing || live || replaying) && !error && <span className="live" data-state={composing ? "loading" : "live"}>
            <span aria-hidden="true">●</span> {composing ? "Loading" : "Live"}
          </span>}
        </div>

        {/* Always here, from the first moment to the last. Hiding the way to
            ask until the lesson finished meant the one thing a learner wants
            while watching - to cut in and ask something else - was the one
            thing the page took away. */}
        {composer}
        <div className="suggestions">
          {suggestions.map((question) => <button key={question} type="button" onClick={() => void ask(question)}>{question}</button>)}
        </div>

        {error && <p className="error">{error}</p>}
      </div>

      <article className="script" aria-label="What the tutor said">
        <h1>{shown?.question}</h1>
        {shown?.opening && <p>{shown.opening}</p>}
        {(shown?.video?.scenes ?? [])
          // A past answer is finished, so all of it is readable. The one being
          // said arrives a line at a time, with the scene it belongs to.
          .slice(0, shown === current && !replaying ? spokenUpTo + 1 : undefined)
          .map((scene) => scene.narration && <p key={scene.id}>{scene.narration}</p>)}
      </article>
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<App />);
