"use client";

import { VideoPlayer } from "@vanillaskyai/ai-video/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { templates } from "../../../vanillasky";
import { warmFirstFrame } from "../../lib/adaptive-channel/media-preload";
import type {
  ChannelContinuation,
  ChannelSegment,
  ManualMediaRoute,
} from "../../lib/adaptive-channel/types";

const STARTER_PREMISE = "A late-night radio operator receives tomorrow's weather report from space—and the final forecast mentions her name.";
const ROUTE_OPTIONS: Array<{ value: ManualMediaRoute; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "stock", label: "Stock" },
  { value: "image", label: "AI image" },
  { value: "video", label: "AI video" },
  { value: "gradient", label: "Title card" },
];

interface ChannelResponse {
  segment: ChannelSegment;
  mode: "fixture" | "live" | "live-with-fixture-fallback";
}

async function requestSegment(body: Record<string, unknown>, signal: AbortSignal): Promise<ChannelResponse> {
  const response = await fetch("/api/channel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json() as ChannelResponse & { error?: string };
  if (!response.ok || !result.segment) throw new Error(result.error || "The next chapter could not be built.");
  return result;
}

function segmentDuration(segment: ChannelSegment): number {
  return segment.video.scenes.reduce((total, scene) => total + (scene.timing.fixedDuration ?? 0), 0);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function AdaptiveChannelPage() {
  const [premise, setPremise] = useState(STARTER_PREMISE);
  const [sceneCount, setSceneCount] = useState(3);
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [overrides, setOverrides] = useState<Partial<Record<number, ManualMediaRoute>>>({});
  const [current, setCurrent] = useState<ChannelSegment>();
  const [next, setNext] = useState<ChannelSegment>();
  const [mode, setMode] = useState<ChannelResponse["mode"]>("fixture");
  const [status, setStatus] = useState("Ready for a story premise.");
  const [error, setError] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);
  const runId = useRef(0);
  const prefetchingRun = useRef<number | undefined>(undefined);
  const activeRequest = useRef<AbortController | undefined>(undefined);
  const previousSceneIndex = useRef(-1);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const prefetch = useCallback(async (
    continuation: ChannelContinuation,
    activeRun: number,
    activeSceneCount: number,
    activeOverrides: Partial<Record<number, ManualMediaRoute>>,
    bufferSeconds: number,
  ) => {
    if (prefetchingRun.current === activeRun) return;
    prefetchingRun.current = activeRun;
    const signal = activeRequest.current?.signal;
    if (!signal) return;
    try {
      const response = await requestSegment({
        continuation,
        sceneCount: activeSceneCount,
        overrides: activeOverrides,
        bufferSeconds,
      }, signal);
      if (runId.current !== activeRun) return;
      await warmFirstFrame(response.segment, signal);
      if (runId.current !== activeRun) return;
      setNext(response.segment);
      setMode(response.mode);
    } catch (caught) {
      if (runId.current === activeRun && !isAbortError(caught)) {
        setError(caught instanceof Error ? caught.message : "The next chapter could not be prefetched.");
      }
    } finally {
      if (prefetchingRun.current === activeRun) prefetchingRun.current = undefined;
    }
  }, []);

  const startChannel = async () => {
    if (premise.trim().length < 8 || isStarting) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const activeRun = runId.current + 1;
    runId.current = activeRun;
    prefetchingRun.current = undefined;
    previousSceneIndex.current = -1;
    setIsStarting(true);
    setCurrent(undefined);
    setNext(undefined);
    setError(undefined);
    setStatus("Planning and resolving chapter 1…");
    try {
      const response = await requestSegment({
        premise: premise.trim(),
        sceneCount,
        characterReferenceImageUrl: referenceImageUrl.trim() || undefined,
        overrides,
      }, controller.signal);
      if (runId.current !== activeRun) return;
      setCurrent(response.segment);
      setMode(response.mode);
      setStatus("Chapter 1 is playing · preparing chapter 2.");
      void prefetch(
        response.segment.continuation,
        activeRun,
        sceneCount,
        overrides,
        segmentDuration(response.segment),
      );
    } catch (caught) {
      if (runId.current === activeRun && !isAbortError(caught)) {
        setError(caught instanceof Error ? caught.message : "The channel could not start.");
        setStatus("The channel did not start.");
      }
    } finally {
      if (runId.current === activeRun) setIsStarting(false);
    }
  };

  const advance = useCallback(() => {
    if (!next) {
      setStatus(`Chapter ${(current?.sequence || 0) + 1} is looping while the next chapter finishes.`);
      return;
    }
    const activeRun = runId.current;
    previousSceneIndex.current = -1;
    setCurrent(next);
    setNext(undefined);
    setStatus(`Chapter ${next.sequence + 1} is playing · preparing chapter ${next.sequence + 2}.`);
    void prefetch(next.continuation, activeRun, sceneCount, overrides, segmentDuration(next));
  }, [current?.sequence, next, overrides, prefetch, sceneCount]);

  const onSceneChange = useCallback((_scene: unknown, index: number) => {
    if (!current) return;
    const previous = previousSceneIndex.current;
    previousSceneIndex.current = index;
    if (index === 0 && previous === current.video.scenes.length - 1) advance();
  }, [advance, current]);

  const setOverride = (index: number, value: ManualMediaRoute) => {
    setOverrides((existing) => {
      const nextOverrides = { ...existing };
      if (value === "auto") delete nextOverrides[index];
      else nextOverrides[index] = value;
      return nextOverrides;
    });
  };

  return <main className="app-shell channel-shell">
    <header className="masthead channel-masthead">
      <div>
        <p className="eyebrow">VANILLASKY · ADAPTIVE CHANNEL POC</p>
        <h1>An infinite story, made from finite scenes.</h1>
        <p className="intro">The planner expresses visual intent. A deterministic policy chooses stock, generated image, generated video, or a title card. The current chapter plays while the next one is made.</p>
      </div>
      <a href="/">Scene director ↩</a>
    </header>

    <section className="channel-grid">
      <aside className="panel channel-brief-panel">
        <div className="panel-heading">
          <div><span>Story bible</span><h2>Define the recurring world</h2></div>
          <i>one prompt · bounded scenes</i>
        </div>
        <label htmlFor="channel-premise">What is the channel about?</label>
        <textarea
          id="channel-premise"
          value={premise}
          rows={6}
          maxLength={800}
          onChange={(event) => setPremise(event.target.value)}
        />

        <div className="channel-field-row">
          <label htmlFor="scene-count">Scenes per chapter</label>
          <select id="scene-count" value={sceneCount} onChange={(event) => setSceneCount(Number(event.target.value))}>
            {[2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </div>

        <label htmlFor="reference-image">Character reference image <small>optional public URL</small></label>
        <input
          id="reference-image"
          type="url"
          placeholder="https://…/character-reference.webp"
          value={referenceImageUrl}
          onChange={(event) => setReferenceImageUrl(event.target.value)}
        />

        <fieldset className="route-overrides">
          <legend>Human override <small>Auto is the default</small></legend>
          {Array.from({ length: sceneCount }, (_, index) => <label key={index}>
            <span>Scene {index + 1}</span>
            <select
              aria-label={`Scene ${index + 1} media override`}
              value={overrides[index] || "auto"}
              onChange={(event) => setOverride(index, event.target.value as ManualMediaRoute)}
            >
              {ROUTE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>)}
        </fieldset>

        <button type="button" disabled={isStarting || premise.trim().length < 8} onClick={() => void startChannel()}>
          {isStarting ? "Building chapter 1…" : current ? "Restart the channel" : "Start the channel"}
        </button>
        <p className="status-line" data-testid="channel-status">{status}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="boundary">
          <span>Provider mode</span>
          <p>{mode === "fixture"
            ? "Local fixtures. No model spend."
            : mode === "live" ? "Live fal + Pexels. Failures stay visible." : "Live fal + Pexels, with fixture fallback."}</p>
        </div>
      </aside>

      <section className="panel channel-player-panel">
        <div className="panel-heading">
          <div><span>Continuous playback</span><h2>{current ? `Chapter ${current.sequence + 1}` : "Waiting for chapter 1"}</h2></div>
          <i>9:16 · current + next</i>
        </div>
        <div className="player-stage channel-stage">
          {current
            ? <VideoPlayer
                key={current.id}
                video={current.video}
                templates={templates}
                autoPlay
                startMuted
                loop
                onSceneChange={onSceneChange}
                ariaLabel="Adaptive generative story channel"
              />
            : <div className="channel-placeholder">
                <span>01</span>
                <strong>Start with a premise.</strong>
                <p>The first chapter resolves immediately from safe fixtures; live providers are opt-in.</p>
              </div>}
        </div>
        <div className="queue-strip" aria-label="Segment queue">
          <div><span>Now</span><b>{current ? `Chapter ${current.sequence + 1} playing` : "Empty"}</b></div>
          <div data-testid="queue-next"><span>Next</span><b>{next ? `Chapter ${next.sequence + 1} ready` : current ? "Generating…" : "Empty"}</b></div>
        </div>
      </section>

      <aside className="panel channel-decisions-panel">
        <div className="panel-heading">
          <div><span>Route decisions</span><h2>Why each scene got its media</h2></div>
          <i>planner → policy → resolver</i>
        </div>
        {current ? <ol className="route-list">
          {current.scenes.map((scene, index) => <li key={scene.plan.id} data-testid="route-card">
            <div className="route-card-top">
              <b>{String(index + 1).padStart(2, "0")}</b>
              <code>{scene.decision.route}{scene.resolvedRoute !== scene.decision.route ? ` → ${scene.resolvedRoute}` : ""}</code>
              <span>{scene.media.provider}</span>
            </div>
            <strong>{scene.plan.headline}</strong>
            <p>{scene.decision.reason}</p>
            <small>{scene.decision.route === "stock" ? `Query: “${scene.plan.stockQuery}”` : scene.plan.description}</small>
            {scene.fallbacks.length > 0 && <em>Fallback after: {scene.fallbacks.join(", ")}</em>}
            {scene.media.credit && <a href={scene.media.credit.url}>{scene.media.credit.label} ↗</a>}
          </li>)}
        </ol> : <div className="empty-decisions">
          <p>Auto is a collaboration:</p>
          <ol>
            <li>The planner describes the shot.</li>
            <li>Policy chooses a cost/latency route.</li>
            <li>The adapter compiles the provider prompt.</li>
            <li>A manual choice always wins.</li>
          </ol>
        </div>}
      </aside>
    </section>
  </main>;
}
