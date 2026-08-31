"use client";

import type { Video } from "@vanillaskyai/video";
import { VideoPlayer, useVideo } from "@vanillaskyai/video/react";
import { useMemo, useState } from "react";
import { templates } from "../../vanillasky";
import { DIRECTOR_TEMPLATE_IDS } from "../lib/scene-director-contract";
import { describeScenePlan, hydrateGeneratedScenes } from "../lib/scene-plan";

const starterPrompt = "Launch a creative tool that turns one rough idea into a polished video, explains the workflow, and ends with a celebratory payoff.";

const starterVideo: Video = {
  schemaVersion: "0.1",
  orientation: "portrait",
  scenes: [
    {
      id: "starter-world",
      templateId: "generatedScene",
      variables: {
        imageBrief: "A translucent portal releasing colorful creative ideas into a midnight sky with room for a bold headline",
        imageUrl: "/ai-scene.webp",
        decisionReason: "An original visual world makes the transformation promise feel immediate.",
        eyebrow: "THE CREATIVE HOOK",
        headline: "Turn one idea into a world.",
      },
      timing: { fixedDuration: 5 },
    },
    {
      id: "starter-payoff",
      templateId: "animatedSticker",
      variables: {
        stickerKey: "confetti",
        decisionReason: "Confetti gives the launch payoff a recognizable social reaction.",
        headline: "Make the payoff pop.",
        caption: "A short reaction beat makes the ending easier to remember and share.",
      },
      timing: { fixedDuration: 4 },
    },
    {
      id: "starter-process",
      templateId: "lottieMotion",
      variables: {
        motionKey: "steps",
        decisionReason: "A step animation communicates the repeatable workflow more clearly than a photo.",
        kicker: "THE SYSTEM",
        headline: "Prompt. Plan. Publish.",
      },
      timing: { fixedDuration: 5 },
    },
  ],
  style: {
    brand: {
      name: "VanillaSky",
      font: "Inter",
      scriptFont: "Caveat",
      background: { type: "gradient", colors: ["#111028", "#6d4aff"] },
      colors: {
        primary: "#8b7cff",
        secondary: "#ff6f91",
        foreground: "#ffffff",
        surface: "#080711",
        surfaceElevated: "#17142b",
        muted: "#aaa4bc",
      },
    },
  },
  meta: {
    name: "Scene director starter",
    source: "examples/rich-media-poc",
  },
};

const promptIdeas = [
  "Reveal a calm focus app that helps busy teams turn noise into one clear next step.",
  "Explain a three-step workflow for turning customer feedback into a shipped product improvement.",
  "Celebrate a small startup reaching its first 1,000 customers after months of iteration.",
];

type DirectorPhase = "idle" | "planning" | "resolving" | "ready" | "error";

export default function Page() {
  const director = useVideo({
    templates,
    templateIds: DIRECTOR_TEMPLATE_IDS,
  });
  const [prompt, setPrompt] = useState(starterPrompt);
  const [phase, setPhase] = useState<DirectorPhase>("idle");
  const [resolvedVideo, setResolvedVideo] = useState<Video>(starterVideo);
  const [notice, setNotice] = useState("Starter storyboard · change the prompt to get a new plan");
  const [error, setError] = useState<string>();
  const [playbackKey, setPlaybackKey] = useState(0);

  const decisions = useMemo(() => describeScenePlan(resolvedVideo), [resolvedVideo]);
  const isWorking = phase === "planning" || phase === "resolving";

  const directVideo = async () => {
    const source = prompt.trim();
    if (!source || isWorking) return;

    setPhase("planning");
    setNotice("AI is choosing scenes, treatments, copy, and asset briefs…");
    setError(undefined);

    try {
      const planned = await director.generate({
        input: source,
        instructions: "Create a visually varied, punchy social video. Let the meaning of each beat determine the media treatment, and explain every choice.",
        knowledgeMode: "general",
        orientation: "portrait",
        opening: false,
        audio: false,
        maxDurationSec: 20,
      });

      setPhase("resolving");
      const generatedSceneCount = planned.scenes.filter(({ templateId }) => templateId === "generatedScene").length;
      setNotice(generatedSceneCount > 0
        ? `Plan ready · creating ${generatedSceneCount} custom visual${generatedSceneCount === 1 ? "" : "s"}…`
        : "Plan ready · resolving selected motion assets…");

      const hydrated = await hydrateGeneratedScenes(planned, async (imageBrief) => {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imageBrief }),
        });
        const result = await response.json() as { imageUrl?: string; model?: string; error?: string };
        if (!response.ok || !result.imageUrl) throw new Error(result.error || "Image generation failed.");
        return { imageUrl: result.imageUrl, model: result.model || "image model" };
      });

      setResolvedVideo(hydrated.video);
      setPlaybackKey((value) => value + 1);
      setPhase("ready");
      setNotice([
        `Ready · ${hydrated.video.scenes.length} AI-directed scenes`,
        hydrated.generatedCount > 0 ? `${hydrated.generatedCount} new image generated` : undefined,
        hydrated.failures.length > 0 ? `${hydrated.failures.length} image fallback used` : undefined,
      ].filter(Boolean).join(" · "));
    } catch (caught) {
      setPhase("error");
      setNotice("The previous storyboard is still available.");
      setError(caught instanceof Error ? caught.message : "Scene direction failed. Try again.");
    }
  };

  return <main className="app-shell">
    <header className="masthead">
      <div>
        <p className="eyebrow">VANILLASKY · AI SCENE DIRECTOR</p>
        <h1>Let the AI direct every scene.</h1>
        <p className="intro">Describe the message once. The planner chooses the scene structure, visual treatment, specific asset, copy, timing—and tells you why.</p>
      </div>
      <nav className="masthead-links" aria-label="Proof of concept navigation">
        <a href="/channel">Adaptive channel POC →</a>
        <a href="https://vanillasky.ai">vanillasky.ai ↗</a>
      </nav>
    </header>

    <section className="workspace director-workspace">
      <aside className="panel controls-panel">
        <div className="panel-heading">
          <div><span>Creative brief</span><h2>What should this video do?</h2></div>
          <i>Prompt → plan → assets</i>
        </div>
        <label htmlFor="director-prompt">What should the video communicate?</label>
        <textarea
          id="director-prompt"
          value={prompt}
          maxLength={1_200}
          rows={7}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="prompt-ideas" aria-label="Example prompts">
          {promptIdeas.map((idea, index) => <button
            key={idea}
            className="prompt-chip"
            type="button"
            disabled={isWorking}
            onClick={() => setPrompt(idea)}
          >
            Example {index + 1}
          </button>)}
        </div>
        <button type="button" disabled={isWorking || prompt.trim().length < 8} onClick={() => void directVideo()}>
          {phase === "planning" ? "Directing scenes…" : phase === "resolving" ? "Creating assets…" : "Direct a new video"}
        </button>
        <p className={`status-line ${phase === "error" ? "status-error" : ""}`} data-testid="director-status">
          {notice}
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="boundary">
          <span>What the AI controls</span>
          <p>Scene order, treatment, catalog asset, generation brief, copy, timing, and the reason for each choice. Provider keys and asset resolution stay server-side.</p>
        </div>
      </aside>

      <section className="panel video-panel">
        <div className="panel-heading">
          <div><span>{isWorking ? "Live plan" : "Directed result"}</span><h2>{isWorking ? "Scenes appear as they are accepted" : "Replay the resolved video"}</h2></div>
          <i>9:16 · max 20s</i>
        </div>
        <div className="player-stage">
          {isWorking
            ? <VideoPlayer
                {...director.playerProps}
                autoPlay
                startMuted
                ariaLabel="AI-directed rich media video"
              />
            : <VideoPlayer
                key={playbackKey}
                video={resolvedVideo}
                templates={templates}
                autoPlay
                startMuted
                loop
                ariaLabel="AI-directed rich media video"
              />}
        </div>
      </section>

      <aside className="panel decisions-panel">
        <div className="panel-heading">
          <div><span>Director notes</span><h2>Why the AI chose each scene</h2></div>
          <i>{decisions.length} scenes</i>
        </div>
        <ol className="decision-list">
          {decisions.map((decision, index) => <li key={decision.sceneId} data-testid="decision-card">
            <b>{String(index + 1).padStart(2, "0")}</b>
            <div>
              <strong>{decision.treatment}</strong>
              <code>{decision.asset}</code>
              <p><span>Why:</span> {decision.reason}</p>
            </div>
          </li>)}
        </ol>
        <div className="verdict">
          <span>The point of the POC</span>
          <p>Variation is semantic, not random. A workflow should pull motion; an emotional metaphor should pull imagery; a payoff should pull the right reaction.</p>
        </div>
      </aside>
    </section>
  </main>;
}
