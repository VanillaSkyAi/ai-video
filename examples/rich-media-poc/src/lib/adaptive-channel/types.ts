import type { Video } from "@vanillaskyai/ai-video";

export type ManualMediaRoute = "auto" | "gradient" | "stock" | "image" | "video";
export type MediaRoute = "gradient" | "stock" | "generate-image" | "generate-video";
export type ResolvableMediaRoute = Exclude<MediaRoute, "gradient">;

export interface ChannelWorld {
  premise: string;
  visualStyle: string;
  setting: string;
  characterBible: string;
  continuityRules: readonly string[];
}

export interface TemporalBeat {
  fromSec: number;
  toSec: number;
  action: string;
}

export interface ShotDirection {
  framing: string;
  camera: string;
  action: string;
  lighting: string;
  beats?: readonly TemporalBeat[];
  sound?: string;
}

export interface PlannedChannelScene {
  id: string;
  beatId?: string;
  headline: string;
  description: string;
  factuality: "factual" | "fictional";
  motion: "none" | "optional" | "essential";
  novelty: "low" | "high";
  continuityRole?: "character" | "scene" | "none";
  manualRoute: ManualMediaRoute;
  stockQuery: string;
  durationSec: number;
  shot: ShotDirection;
}

export interface RouteDecision {
  route: MediaRoute;
  reason: string;
}

export interface MediaCredit {
  label: string;
  url: string;
}

export interface ResolvedMedia {
  type: "gradient" | "image" | "video";
  url: string;
  posterUrl?: string;
  provider: string;
  credit?: MediaCredit;
  /** Canonical identity reference; only intentional character generation may update it. */
  characterReferenceImageUrl?: string;
  /** A generated first/last frame suitable for the immediately following shot. */
  keyframeImageUrl?: string;
}

export interface MediaResolveRequest {
  world: ChannelWorld;
  scene: PlannedChannelScene;
  prompt: string;
  orientation: "portrait" | "landscape";
  characterReferenceImageUrl?: string;
  previousKeyframeImageUrl?: string;
  signal?: AbortSignal;
}

export interface MediaAdapter {
  route: ResolvableMediaRoute;
  resolve(request: MediaResolveRequest): Promise<ResolvedMedia>;
}

export interface ResolvedChannelScene {
  plan: PlannedChannelScene;
  decision: RouteDecision;
  resolvedRoute: MediaRoute;
  media: ResolvedMedia;
  fallbacks: MediaRoute[];
}

export interface PlannedSegment {
  sequence: number;
  world: ChannelWorld;
  scenes: PlannedChannelScene[];
  summary: string;
  recentBeatIds: string[];
  openThreads: string[];
}

export interface ChannelContinuation {
  sequence: number;
  world: ChannelWorld;
  previousSummary: string;
  recentBeatIds: string[];
  openThreads: string[];
  characterReferenceImageUrl?: string;
  previousKeyframeImageUrl?: string;
}

export interface ChannelSegment {
  id: string;
  sequence: number;
  video: Video;
  scenes: ResolvedChannelScene[];
  continuation: ChannelContinuation;
}
