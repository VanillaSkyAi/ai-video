import type { Video, VideoOrientation, VideoScene } from "@vanillaskyai/video";
import type { Theme } from "./themes";
import type { VisualMode } from "./modes";
import type { Suggestion } from "./suggestion-cards";

export interface StreamedResponse {
  /** Resolves when the last scene has been planned and narrated. */
  done: Promise<{ video: Video; suggestions: Suggestion[] }>;
}

async function narrateScene(
  prompt: string,
  scene: VideoScene,
  earlier: string[],
  signal?: AbortSignal,
): Promise<string> {
  const result = await fetch("/api/video-chat?action=narration", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({ prompt, scene, earlier }),
  });
  if (!result.ok) return "";
  const payload = await result.json() as { line?: string };
  return typeof payload.line === "string" ? payload.line : "";
}

/**
 * Ask once, and once more if the planner produced something invalid.
 *
 * The planner writes to tight schema limits and occasionally misses one, and a
 * plan that fails outright is a dead response. A retry turns that into an
 * occasional slow one.
 *
 * Only while nothing has played, though. The second attempt numbers its scenes
 * from zero like the first, so a run that already put scene one and two on
 * screen would take scene three onwards from a different plan and splice two
 * explanations together - each half coherent, the whole thing nonsense. Once
 * the picture is up, a failure is a failure.
 */
export async function streamResponseWithRetry(
  options: Parameters<typeof streamResponse>[0] & {
    /** False once scenes are on screen and a second plan can no longer replace them. */
    canRetry?: () => boolean;
    /** Drop what the failed attempt had staged, so positions line up again. */
    onRetry?: () => void;
  },
): Promise<{ video: Video; suggestions: Suggestion[] }> {
  try {
    return await streamResponse(options);
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    if (options.canRetry?.() === false) {
      console.warn("[video-chat] the plan failed with the response already playing, so it stands:", cause instanceof Error ? cause.message : cause);
      throw cause;
    }
    // Loud, because a retry doubles the wait and interleaves two plans' marks
    // in the console - which reads as the video chat behaving randomly rather than
    // as one failed plan.
    console.warn("[video-chat] the plan failed, asking again:", cause instanceof Error ? cause.message : cause);
    options.onRetry?.();
    return streamResponse(options);
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
  console.log(`[video-chat] ${String(Date.now() - started).padStart(6)}ms  ${what}`);
}

export async function streamResponse(options: {
  prompt: string;
  theme: Theme;
  mode: VisualMode;
  /**
   * The shape the response is composed in, decided by the viewport that asked
   * for it. Templates re-lay-out at any size, so a templates-only response is
   * still readable either way - but a generated clip has its aspect ratio
   * baked into the file, so this is also what the footage is filmed as.
   */
  orientation: VideoOrientation;
  signal?: AbortSignal;
  /**
   * Called with each scene once its line has been written, in whatever order
   * the lines finish. `position` is where the scene belongs in the response.
   */
  onScene: (scene: VideoScene, position: number) => void | Promise<void>;
  onStyle: (style: Video["style"]) => void;
}): Promise<{ video: Video; suggestions: Suggestion[] }> {
  const started = Date.now();
  const response = await fetch("/api/video-chat?action=response", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({
      prompt: options.prompt,
      mode: options.mode.id,
      orientation: options.orientation,
      brand: options.theme.brand,
      style: {
        generatedLook: options.theme.generatedLook,
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
      // order, but the response has to end up in the order it was planned.
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
            const line = await narrateScene(options.prompt, planned, [...lines], options.signal);
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
        // Any scene that ended up with a picture behind it, generated or
        // searched. Type over a photograph wants the quiet archetype: the
        // cinematic one animates word by word, which is a lot of movement to
        // put on top of footage that is already moving.
        const overMedia = typeof (planned.variables as { mediaUrl?: unknown }).mediaUrl === "string";
        const filmed = options.mode.filmedScenes > 0 && overMedia;
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
        const withText = overMedia ? { ...shown, textArchetype: "subtle" } : shown;
        const scene = line ? { ...withText, narration: line } : withText;
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

  const suggestions = await fetch("/api/video-chat?action=suggestions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body: JSON.stringify({ prompt: options.prompt, lines }),
  })
    .then(async (result) => (result.ok ? (await result.json()).suggestions ?? [] : []))
    .catch(() => []);

  return {
    video: { schemaVersion: "0.1", orientation: options.orientation, scenes, style: style! },
    suggestions: suggestions as Suggestion[],
  };
}
