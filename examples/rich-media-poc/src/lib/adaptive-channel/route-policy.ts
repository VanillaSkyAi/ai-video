import type { PlannedChannelScene, RouteDecision } from "./types";

const MANUAL_ROUTES = {
  gradient: { route: "gradient", reason: "Manual gradient override." },
  stock: { route: "stock", reason: "Manual stock override." },
  image: { route: "generate-image", reason: "Manual image override." },
  video: { route: "generate-video", reason: "Manual video override." },
} as const satisfies Record<Exclude<PlannedChannelScene["manualRoute"], "auto">, RouteDecision>;

export function decideMediaRoute(
  scene: PlannedChannelScene,
  context: { bufferSeconds: number; videoP95LatencySec?: number },
): RouteDecision {
  if (scene.manualRoute !== "auto") return MANUAL_ROUTES[scene.manualRoute];
  if (scene.factuality === "factual") {
    return { route: "stock", reason: "Factual scenes prefer retrievable footage." };
  }
  if (scene.motion === "essential") {
    const requiredLeadTime = (context.videoP95LatencySec ?? 10) + 2;
    return context.bufferSeconds >= requiredLeadTime
      ? { route: "generate-video", reason: "Motion is essential and playback has enough buffer." }
      : { route: "generate-image", reason: "Low buffer converts the beat to a generated still." };
  }
  if (scene.novelty === "high") {
    return { route: "generate-image", reason: "A novel fictional beat benefits from an original frame." };
  }
  return { route: "stock", reason: "Retrievable media is sufficient for this establishing beat." };
}
