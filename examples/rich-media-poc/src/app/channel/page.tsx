"use client";

import type { VideoScene } from "@vanillaskyai/video";
import { VideoPlayer } from "@vanillaskyai/video/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { templates } from "../../../vanillasky";
import {
  createChannelPlayerStream,
  type ChannelPlayerStream,
  type ChannelStreamMessage,
} from "../../lib/adaptive-channel/channel-stream";
import type { ResolvedChannelScene } from "../../lib/adaptive-channel/types";

const STARTER_PREMISE = "A late-night radio operator receives tomorrow's weather report from space—and the final forecast mentions her name.";

interface StreamedScene {
  chapterSequence: number;
  resolved: ResolvedChannelScene;
  scheduling: { queuedMs: number; generationMs: number; clientWarmMs?: number };
}

function seconds(milliseconds: number): string {
  return `${(milliseconds / 1_000).toFixed(2)}s`;
}

export default function AdaptiveChannelPage() {
  const [premise, setPremise] = useState(STARTER_PREMISE);
  const [stream, setStream] = useState<ChannelPlayerStream>();
  const [scenes, setScenes] = useState<StreamedScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [mode, setMode] = useState<"fixture" | "live" | "live-with-fixture-fallback">("fixture");
  const [status, setStatus] = useState("Ready for a story premise.");
  const [error, setError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const [bufferSeconds, setBufferSeconds] = useState(0);
  const [peakConcurrency, setPeakConcurrency] = useState(0);
  const [targetBufferSeconds, setTargetBufferSeconds] = useState(15);
  const streamRef = useRef<ChannelPlayerStream | undefined>(undefined);

  useEffect(() => () => streamRef.current?.cancel("Page closed"), []);

  const handleMessage = useCallback((message: ChannelStreamMessage) => {
    if (message.kind === "mode") {
      setMode(message.mode);
      setTargetBufferSeconds(message.targetBufferSeconds);
      setStatus("The progressive stream is open · resolving the first playable scene.");
      return;
    }
    if (message.kind === "chapter-start") {
      setStatus(`Producing ${message.sceneCount} independent text-to-video scenes in parallel.`);
      return;
    }
    if (message.kind === "scene") {
      setScenes((existing) => [...existing, {
        chapterSequence: message.chapterSequence,
        resolved: message.resolved,
        scheduling: message.scheduling,
      }].slice(-24));
      setBufferSeconds(message.bufferSeconds);
      setStatus(`Playback is live · ${message.bufferSeconds.toFixed(1)}s currently buffered.`);
      return;
    }
    if (message.kind === "buffer") {
      setBufferSeconds(message.bufferSeconds);
      setStatus(`Buffer healthy at ${message.bufferSeconds.toFixed(1)}s · producer is pacing new work.`);
      return;
    }
    if (message.kind === "chapter") {
      setPeakConcurrency((current) => Math.max(current, message.peakConcurrency));
      setBufferSeconds(message.bufferSeconds);
      setStatus(`Chapter ${message.sequence + 1} resolved · peak ${message.peakConcurrency} concurrent scene jobs.`);
      return;
    }
    if (message.kind === "playback-ready") {
      setStatus(`Playback opened with ${message.startupBufferSeconds}s of browser-ready media.`);
      return;
    }
    if (message.kind === "complete") {
      setIsRunning(false);
      setStatus("Five scenes generated · the finished POC now loops.");
      return;
    }
    if (message.kind === "error") {
      setError(message.error);
      setIsRunning(false);
      setStatus("The channel stream stopped.");
    }
  }, []);

  const startChannel = () => {
    if (premise.trim().length < 8) return;
    streamRef.current?.cancel("Channel restarted");
    setScenes([]);
    setActiveSceneId(undefined);
    setBufferSeconds(0);
    setPeakConcurrency(0);
    setError(undefined);
    setIsRunning(true);
    setStatus("Opening the progressive scene stream…");
    const nextStream = createChannelPlayerStream({
      prompt: premise.trim(),
    }, handleMessage);
    streamRef.current = nextStream;
    setStream(nextStream);
  };

  const stopChannel = () => {
    streamRef.current?.cancel("Channel stopped by the user");
    streamRef.current = undefined;
    setStream(undefined);
    setIsRunning(false);
    setStatus("Channel stopped. Pending provider work was cancelled.");
  };

  const onSceneChange = useCallback((scene: VideoScene) => {
    setActiveSceneId(scene.id);
  }, []);

  const activeIndex = scenes.findIndex(({ resolved }) => resolved.plan.id === activeSceneId);
  const activeScene = activeIndex >= 0 ? scenes[activeIndex] : scenes[0];
  const readyAhead = activeIndex >= 0 ? Math.max(0, scenes.length - activeIndex - 1) : Math.max(0, scenes.length - 1);
  const visibleScenes = useMemo(() => scenes.slice(-12), [scenes]);

  return <main className="app-shell channel-shell">
    <header className="masthead channel-masthead">
      <div>
        <p className="eyebrow">VANILLASKY · GENERATIVE VIDEO POC</p>
        <h1>Prompt in. Five videos out.</h1>
        <p className="intro">One story prompt becomes five independently generated H3 clips. No image generation or reference frames—VanillaSky streams each browser-ready scene into one continuous player.</p>
      </div>
      <a href="/">Scene director ↩</a>
    </header>

    <section className="channel-grid">
      <aside className="panel channel-brief-panel">
        <div className="panel-heading">
          <div><span>Video prompt</span><h2>What should happen?</h2></div>
          <i>one prompt · five text-to-video jobs</i>
        </div>
        <label htmlFor="channel-premise">Describe a short visual story</label>
        <textarea
          id="channel-premise"
          value={premise}
          rows={6}
          maxLength={800}
          placeholder="Write a prompt…"
          onChange={(event) => setPremise(event.target.value)}
        />

        <div className="boundary">
          <span>Five-scene recipe</span>
          <p>01 AI video · 02 AI video · 03 AI video · 04 AI video · 05 AI video</p>
        </div>

        <div className="channel-actions">
          <button type="button" disabled={premise.trim().length < 8} onClick={startChannel}>
            {stream ? "Create another video" : "Create video"}
          </button>
          {isRunning && <button type="button" className="secondary-button" onClick={stopChannel}>Stop and cancel</button>}
        </div>
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
          <div><span>Progressive playback</span><h2>{activeScene ? `Scene ${Math.max(1, activeIndex + 1)} of 5` : "Waiting for scene 1"}</h2></div>
          <i>9:16 · one SDK stream</i>
        </div>
        <div className="player-stage channel-stage">
          {stream
            ? <VideoPlayer
                stream={stream}
                templates={templates}
                autoPlay
                startMuted
                nativeMediaAudio={{ volume: 0.85 }}
                loop
                onSceneChange={onSceneChange}
                onError={(caught) => {
                  if (caught.name === "AbortError") return;
                  setError(caught.message);
                  setIsRunning(false);
                }}
                ariaLabel="Adaptive generative story channel"
              />
            : <div className="channel-placeholder">
                <span>01</span>
                <strong>Start with one prompt.</strong>
                <p>Five text-to-video jobs launch together. Playback opens when the startup buffer is ready.</p>
              </div>}
        </div>
        <div className="queue-strip" aria-label="Rolling scene queue">
          <div><span>Now</span><b>{activeScene?.resolved.plan.headline || "Empty"}</b></div>
          <div data-testid="queue-ready"><span>Ready ahead</span><b>{readyAhead} scene{readyAhead === 1 ? "" : "s"} · {bufferSeconds.toFixed(1)}s</b></div>
          <div data-testid="parallelism"><span>Producer</span><b>peak {peakConcurrency} parallel · target {targetBufferSeconds}s</b></div>
        </div>
      </section>

      <aside className="panel channel-decisions-panel">
        <div className="panel-heading">
          <div><span>Live production log</span><h2>Why each scene got its media</h2></div>
          <i>prompt → planner → provider</i>
        </div>
        {visibleScenes.length > 0 ? <ol className="route-list">
          {visibleScenes.map(({ resolved, scheduling }, index) => <li
            key={resolved.plan.id}
            data-testid="route-card"
            data-active={resolved.plan.id === activeSceneId ? "true" : "false"}
          >
            <div className="route-card-top">
              <b>{String(Math.max(1, scenes.length - visibleScenes.length + index + 1)).padStart(2, "0")}</b>
              <code>{resolved.decision.route}{resolved.resolvedRoute !== resolved.decision.route ? ` → ${resolved.resolvedRoute}` : ""}</code>
              <span>{resolved.media.provider}</span>
            </div>
            <strong>{resolved.plan.headline}</strong>
            <p>{resolved.decision.reason}</p>
            <small>{resolved.decision.route === "stock" ? `Query: “${resolved.plan.stockQuery}”` : resolved.plan.description}</small>
            <small>
              available after {seconds(scheduling.queuedMs + scheduling.generationMs + (scheduling.clientWarmMs || 0))}
              {resolved.media.generationTiming?.inferenceMs != null
                ? ` · model inference ${seconds(resolved.media.generationTiming.inferenceMs)}`
                : resolved.media.generationTiming ? ` · provider ${seconds(resolved.media.generationTiming.requestMs)}` : ""}
            </small>
            {resolved.fallbacks.length > 0 && <em>Fallback after: {resolved.fallbacks.join(", ")}</em>}
            {resolved.media.credit && <a href={resolved.media.credit.url}>{resolved.media.credit.label} ↗</a>}
          </li>)}
        </ol> : <div className="empty-decisions">
          <p>On start:</p>
          <ol>
            <li>Five text-to-video jobs launch together.</li>
            <li>Every scene gets its own cinematic prompt.</li>
            <li>No image reference is sent to the video model.</li>
            <li>Resolved scenes enter the player in story order.</li>
          </ol>
        </div>}
      </aside>
    </section>
  </main>;
}
