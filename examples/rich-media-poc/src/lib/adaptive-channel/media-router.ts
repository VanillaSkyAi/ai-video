import { compileImagePrompt, compileVideoPrompt } from "./prompt-compiler";
import { decideMediaRoute } from "./route-policy";
import type {
  ChannelWorld,
  MediaAdapter,
  MediaResolveRequest,
  MediaRoute,
  PlannedChannelScene,
  ResolvableMediaRoute,
  ResolvedChannelScene,
} from "./types";

const FICTIONAL_FALLBACKS: Record<ResolvableMediaRoute, ResolvableMediaRoute[]> = {
  "generate-video": ["generate-image", "stock"],
  "generate-image": ["stock"],
  stock: ["generate-image"],
};

function fallbackRoutes(scene: PlannedChannelScene, route: ResolvableMediaRoute): ResolvableMediaRoute[] {
  if (scene.factuality !== "factual") return FICTIONAL_FALLBACKS[route];
  if (route === "stock") return [];
  return ["stock"];
}

function cancellationError(signal: AbortSignal | undefined, error?: unknown): DOMException | undefined {
  if (error instanceof DOMException && error.name === "AbortError") return error;
  if (!signal?.aborted) return undefined;
  return signal.reason instanceof DOMException && signal.reason.name === "AbortError"
    ? signal.reason
    : new DOMException("Channel generation was cancelled.", "AbortError");
}

function promptFor(route: ResolvableMediaRoute, world: ChannelWorld, scene: PlannedChannelScene): string {
  if (route === "generate-video") return compileVideoPrompt(world, scene);
  if (route === "generate-image") return compileImagePrompt(world, scene);
  return scene.stockQuery;
}

export async function resolvePlannedScene(options: {
  world: ChannelWorld;
  scene: PlannedChannelScene;
  bufferSeconds: number;
  videoP95LatencySec?: number;
  adapters: readonly MediaAdapter[];
  orientation?: "portrait" | "landscape";
  characterReferenceImageUrl?: string;
  previousKeyframeImageUrl?: string;
  signal?: AbortSignal;
}): Promise<ResolvedChannelScene> {
  const decision = decideMediaRoute(options.scene, {
    bufferSeconds: options.bufferSeconds,
    videoP95LatencySec: options.videoP95LatencySec,
  });
  if (decision.route === "gradient") {
    return {
      plan: options.scene,
      decision,
      resolvedRoute: "gradient",
      media: { type: "gradient", url: "", provider: "vanillasky-brand" },
      fallbacks: [],
    };
  }

  const routes = [decision.route, ...fallbackRoutes(options.scene, decision.route)];
  const fallbacks: MediaRoute[] = [];
  for (const route of routes) {
    const cancelled = cancellationError(options.signal);
    if (cancelled) throw cancelled;
    const candidates = options.adapters.filter((candidate) => candidate.route === route);
    if (candidates.length === 0) {
      fallbacks.push(route);
      continue;
    }
    for (const adapter of candidates) {
      const request: MediaResolveRequest = {
        world: options.world,
        scene: options.scene,
        prompt: promptFor(route, options.world, options.scene),
        orientation: options.orientation || "portrait",
        characterReferenceImageUrl: options.characterReferenceImageUrl,
        previousKeyframeImageUrl: options.previousKeyframeImageUrl,
        signal: options.signal,
      };
      try {
        const media = await adapter.resolve(request);
        return { plan: options.scene, decision, resolvedRoute: route, media, fallbacks };
      } catch (error) {
        const cancelledAfterRequest = cancellationError(options.signal, error);
        if (cancelledAfterRequest) throw cancelledAfterRequest;
        // Try another provider for the same route before degrading media type.
      }
    }
    fallbacks.push(route);
  }

  return {
    plan: options.scene,
    decision,
    resolvedRoute: "gradient",
    media: { type: "gradient", url: "", provider: "vanillasky-fallback" },
    fallbacks,
  };
}
