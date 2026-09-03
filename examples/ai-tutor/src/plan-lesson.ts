import type { Video, VideoScene } from "@vanillaskyai/video";
import type { Theme } from "./themes";
import type { VisualMode } from "./modes";
import { definitions } from "../vanillasky";

const templateIds = definitions.map((template) => template.id);

/**
 * How many scenes a lesson has.
 *
 * Fixed rather than left to the planner, because the visual mode is a ceiling
 * on filmed scenes and a ceiling only means "every beat" if you know how many
 * beats there are.
 */
const LESSON_SCENES = 5;

/**
 * Stream a lesson, narrating each scene as it arrives.
 *
 * Composing the whole answer first is what keeps the words matched to the
 * pictures, but it costs the entire plan before a single frame - thirty to
 * ninety seconds of nothing. The scenes arrive one at a time, so the narration
 * can too: each line is written as its scene lands, and the first scene plays
 * within a few seconds with its own line spoken over it.
 *
 * The narrator is given the lines already written, so the script still joins up
 * into one explanation rather than four unrelated remarks. What it cannot do is
 * set up a payoff it has not seen yet - the price of not waiting.
 */
/**
 * The brief, which depends on how much of the answer is filmed.
 *
 * A planner told only that a media template exists will not reach for it: the
 * cheaper templates always look like a reasonable choice. If the application is
 * willing to pay for footage, it has to ask for footage.
 */
function plannerInstructions(filmedScenes: number): string {
  const everyBeatFilmed = filmedScenes >= LESSON_SCENES;
  return [
    "The input is a question from a learner. Answer it as a short explainer video.",
    "The material is the answer, not the question: a one-line question still deserves a full explanation.",
    // The warm-up already says what makes the question interesting, spoken
    // over the question itself while this plan is being written. A lesson that
    // then opens by framing the question again says the same thing twice, so
    // the opening beat is spent on the answer instead - the hook buys the
    // lesson a scene rather than only filling time.
    `Use exactly ${LESSON_SCENES} scenes. The question has already been put to the learner, so do not open by restating or reframing it: open on the first real step of the answer, spend three scenes on the mechanism, and close on the point that makes it stick.`,
    // Two briefs, not one with a clause bolted on. Asking for template variety
    // and for everything to be filmed in the same breath gets a lesson that is
    // half of each, which is what "full AI video" was producing.
    everyBeatFilmed
      // Naming the template is not enough: the media template has a no-footage
      // mode, and the planner reaches for it. It opened on
      // mediaType=gradient with no mediaKeyword at all, so there was nothing
      // to film - the scene was never blocked, it never asked. Every beat here
      // is filmed, so gradient is not an option and the keyword is mandatory.
      ? "Use the media template for every scene, including the first and the closer. Every scene must set mediaType to video and carry a mediaKeyword: a concrete, filmable subject, a real object doing a real thing, never a diagram or an abstraction. Never use mediaType gradient and never omit mediaKeyword - a scene without one has nothing to film. If a beat seems too abstract to film, film the closest real thing that shows it."
      : filmedScenes > 0
        ? `Choose the template that fits each beat honestly - a figure belongs in a number scene, an ordered process in steps, a comparison in a chart - rather than repeating one shape. Use the media template for ${filmedScenes === 1 ? "the single beat" : `the ${filmedScenes} beats`} most worth watching happen, and give each one a mediaKeyword: a concrete, filmable subject, a real object doing a real thing, never a diagram or an abstraction.`
        // Stock footage rather than none. A lesson of cards on a brand gradient
        // is the least a template set can look like, and a search costs a few
        // hundred milliseconds - so the media template is available here too,
        // for the beats that are worth watching happen.
        : "Choose the template that fits each beat honestly - a figure belongs in a number scene, an ordered process in steps, a comparison in a chart - rather than repeating one shape. Give any scene that would be stronger over real footage a mediaKeyword: a concrete, filmable subject, a real object doing a real thing, never a diagram or an abstraction. Use the media template for the one or two beats most worth watching happen.",
    // Without this the plan comes back with no closer, and the runtime drops
    // every scene it was holding for one - five planned, three delivered. Only
    // a template with a payoff job may close, and naming it is the difference
    // between a lesson that ends and a lesson that stops.
    everyBeatFilmed
      ? 'Mark the final scene placement:"closer". Use the media template for it, as for every other beat.'
      // Only a template with a payoff job may close, and there are two: media
      // and milestone. Naming them is the difference between a lesson that
      // ends and a lesson that stops - without it the plan comes back with no
      // closer and the runtime drops every scene it was holding for one.
      : 'Mark the final scene placement:"closer" and use either the milestone or the media template for it. Those are the only two here that may close, so the lesson must end on one.',
    "Every scene must carry a timing object, even an empty one. A scene without it fails the whole lesson.",
    "Never invent statistics. Never mention the video, the scenes, or yourself.",
  ].join("\n");
}

export interface StreamedLesson {
  /** Resolves when the last scene has been planned and narrated. */
  done: Promise<{ video: Video; followups: string[] }>;
}

async function narrateScene(
  question: string,
  scene: VideoScene,
  earlier: string[],
  signal?: AbortSignal,
): Promise<string> {
  const result = await fetch("/api/narration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ question, scene, earlier }),
  });
  if (!result.ok) return "";
  const payload = await result.json() as { line?: string };
  return typeof payload.line === "string" ? payload.line : "";
}

/**
 * Ask once, and once more if the planner produced something invalid.
 *
 * The planner writes to tight schema limits and occasionally misses one, and a
 * plan that fails outright is a dead lesson. A retry turns that into an
 * occasional slow one.
 *
 * Only while nothing has played, though. The second attempt numbers its scenes
 * from zero like the first, so a run that already put scene one and two on
 * screen would take scene three onwards from a different plan and splice two
 * explanations together - each half coherent, the whole thing nonsense. Once
 * the picture is up, a failure is a failure.
 */
export async function streamLessonWithRetry(
  options: Parameters<typeof streamLesson>[0] & {
    /** False once scenes are on screen and a second plan can no longer replace them. */
    canRetry?: () => boolean;
    /** Drop what the failed attempt had staged, so positions line up again. */
    onRetry?: () => void;
  },
): Promise<{ video: Video; followups: string[] }> {
  try {
    return await streamLesson(options);
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    if (options.canRetry?.() === false) {
      console.warn("[tutor] the plan failed with the lesson already playing, so it stands:", cause instanceof Error ? cause.message : cause);
      throw cause;
    }
    // Loud, because a retry doubles the wait and interleaves two plans' marks
    // in the console - which reads as the tutor behaving randomly rather than
    // as one failed plan.
    console.warn("[tutor] the plan failed, asking again:", cause instanceof Error ? cause.message : cause);
    options.onRetry?.();
    return streamLesson(options);
  }
}

/**
 * Where the wait actually goes.
 *
 * The start is several waits in a row - the planner's first token, a clip
 * being generated, a line being written, its audio - and guessing which one
 * dominates is how you optimise the wrong one. Every run says so in the
 * console instead.
 */
function mark(started: number, what: string): void {
  console.log(`[tutor] ${String(Date.now() - started).padStart(6)}ms  ${what}`);
}

export async function streamLesson(options: {
  question: string;
  theme: Theme;
  mode: VisualMode;
  signal?: AbortSignal;
  /**
   * Called with each scene once its line has been written, in whatever order
   * the lines finish. `position` is where the scene belongs in the lesson.
   */
  onScene: (scene: VideoScene, position: number) => void | Promise<void>;
  onStyle: (style: Video["style"]) => void;
}): Promise<{ video: Video; followups: string[] }> {
  const started = Date.now();
  const response = await fetch(`/api/lesson?filmed=${options.mode.filmedScenes}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      protocolVersion: "0.5",
      requestId: `tutor-${Date.now()}`,
      // The templates this page can render - and, when every beat is filmed,
      // the one it wants. Narrowing the catalogue is what makes a filmed
      // lesson filmed: asking the planner in prose to use the media template
      // throughout still leaves the others in front of it, and it opens on a
      // number card often enough to matter. A brief is a preference; a
      // catalogue of one is not.
      capabilities: {
        templates: options.mode.filmedScenes >= LESSON_SCENES ? ["media"] : templateIds,
      },
      input: {
        input: options.question,
        instructions: plannerInstructions(options.mode.filmedScenes),
        // Without this the planner refuses outright, and says why: a question
        // carries no facts, and it will not invent what the input does not
        // contain. A tutor is the case where the answer has to come from the
        // model's own knowledge rather than from the material handed to it.
        knowledgeMode: "general",
        // No opening card. It is composed by the runtime rather than the
        // model, so it arrives instantly - but it is a rendered scene either
        // way, it plays before anything real, and the first scene of a video
        // never resolves media, so in a filmed mode it is a gradient standing
        // where a clip should be. The warm-up covers the wait instead.
        opening: false,
        orientation: "landscape",
        maxDurationSec: 40,
        brand: options.theme.brand,
        style: {
          density: "airy",
          motion: "calm",
          textArchetype: "cinematic",
          generatedLook: options.theme.generatedLook,
        },
      },
    }),
  });
  if (!response.ok || !response.body) {
    throw new Error((await response.text()).slice(0, 300) || `Planning failed (${response.status})`);
  }

  const scenes: VideoScene[] = [];
  const lines: string[] = [];
  // Everything downstream of a planned scene - its line, its audio - runs
  // beside the reader rather than inside it. Awaiting that work here made the
  // planner wait on the narrator: scene three was not even read off the stream
  // until scene two had been spoken.
  const pending: Promise<void>[] = [];
  // Narration is chained rather than fanned out, because a line is written
  // knowing the ones before it - that is what makes four remarks read as one
  // explanation. The chain is what is serial; the reader is not.
  let narrating: Promise<unknown> = Promise.resolve();
  let style: Video["style"] | undefined;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const rows = buffer.split("\n");
    buffer = rows.pop() ?? "";
    for (const row of rows) {
      if (!row.startsWith("data: ") || row === "data: [DONE]") continue;
      const event = JSON.parse(row.slice(6)) as { type?: string; data?: Record<string, unknown> };
      if (event.type === "response.start") {
        mark(started, "planner opened the stream");
        style = event.data?.style as Video["style"];
        options.onStyle(style);
      }
      if (event.type !== "scene.add" || !event.data?.scene) continue;

      const planned = event.data.scene as VideoScene;
      // The position is claimed now, while the order is still known. The scene
      // that fills it is finished asynchronously and they do not finish in
      // order, but the lesson has to end up in the order it was planned.
      const position = scenes.length;
      mark(started, `scene ${position + 1} planned [${planned.templateId}]${typeof (planned.variables as { mediaUrl?: unknown }).mediaUrl === "string" ? " and filmed" : " - NOT filmed"}`);
      scenes.push(planned);

      // The planner writes the line now, on the scene. The chained call below
      // is the fallback for a scene that came back without one - it costs a
      // round trip and it holds every later line behind this one, so it runs
      // only when there is nothing to say.
      const narrated = typeof planned.narration === "string" && planned.narration.trim() !== ""
        ? Promise.resolve(planned.narration.trim()).then((line) => { lines.push(line); return line; })
        : narrating.then(async () => {
            const line = await narrateScene(options.question, planned, [...lines], options.signal);
            if (line) lines.push(line);
            return line;
          });
      // The next scene's line waits for this one, and only for this one. A
      // failed line must not stop the rest of the script being written.
      narrating = narrated.catch(() => "");

      pending.push(narrated.then(async (line) => {
        // A generated beat shows the film and nothing else - no caption, no
        // contrast wash, no confetti, and no background effect panning a clip
        // that already has a camera move of its own. Every one of those exists
        // to make a still photograph carry type, and this scene carries none:
        // the line is being spoken, and anything laid over the picture is what
        // makes generated video look like a slide.
        //
        // Stock footage is the opposite case. It is a backdrop the template was
        // designed to sit on, and stripping the copy off it leaves a scene that
        // says nothing - so this applies to the modes that generate, not to
        // every scene that happens to have found a picture.
        const filmed = options.mode.filmedScenes > 0
          && typeof (planned.variables as { mediaUrl?: unknown }).mediaUrl === "string";
        const shown = filmed
          ? {
              ...planned,
              backgroundEffect: "static",
              variables: {
                ...planned.variables,
                texts: "",
                mediaTreatment: "none",
                confetti: false,
              },
            }
          : planned;
        const scene = line ? { ...shown, narration: line } : shown;
        mark(started, `scene ${position + 1} narrated`);
        scenes[position] = scene;
        await options.onScene(scene, position);
        mark(started, `scene ${position + 1} ready to play`);
      }));
    }
    if (done) break;
  }
  // The plan is read; the lines and the audio behind them are still landing.
  await Promise.all(pending);
  if (scenes.length === 0) throw new Error("The planner returned no scenes");

  const followups = await fetch("/api/followups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({ question: options.question, lines }),
  })
    .then(async (result) => (result.ok ? (await result.json()).followups ?? [] : []))
    .catch(() => []);

  return {
    video: { schemaVersion: "0.1", orientation: "landscape", scenes, style: style! },
    followups: followups as string[],
  };
}
