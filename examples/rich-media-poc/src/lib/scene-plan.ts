import type { Video } from "@vanillaskyai/ai-video";
import { resolveLottieAsset, resolveStickerAsset } from "./asset-catalog";

export interface SceneDecision {
  sceneId: string;
  templateId: string;
  treatment: string;
  asset: string;
  reason: string;
}

export interface HydratedScenePlan {
  video: Video;
  generatedCount: number;
  failures: string[];
}

function stringVariable(variables: Record<string, unknown>, key: string): string {
  const value = variables[key];
  return typeof value === "string" ? value : "";
}

export async function hydrateGeneratedScenes(
  video: Video,
  generate: (brief: string) => Promise<{ imageUrl: string; model: string }>,
): Promise<HydratedScenePlan> {
  let generatedCount = 0;
  const failures: string[] = [];
  const scenes = await Promise.all(video.scenes.map(async (scene) => {
    if (scene.templateId !== "generatedScene") return scene;
    const brief = stringVariable(scene.variables, "imageBrief").trim();
    if (!brief) return scene;

    try {
      const generated = await generate(brief);
      generatedCount += 1;
      return {
        ...scene,
        variables: { ...scene.variables, imageUrl: generated.imageUrl },
      };
    } catch {
      failures.push(scene.id);
      return scene;
    }
  }));

  return {
    video: { ...video, scenes },
    generatedCount,
    failures,
  };
}

export function describeScenePlan(video: Video): SceneDecision[] {
  return video.scenes.map((scene) => {
    const reason = stringVariable(scene.variables, "decisionReason")
      || "Selected as the clearest treatment for this beat.";

    if (scene.templateId === "generatedScene") {
      return {
        sceneId: scene.id,
        templateId: scene.templateId,
        treatment: "AI image",
        asset: stringVariable(scene.variables, "imageBrief"),
        reason,
      };
    }
    if (scene.templateId === "animatedSticker") {
      const asset = resolveStickerAsset(stringVariable(scene.variables, "stickerKey"));
      return {
        sceneId: scene.id,
        templateId: scene.templateId,
        treatment: `Sticker · ${asset.label}`,
        asset: asset.url,
        reason,
      };
    }
    if (scene.templateId === "lottieMotion") {
      const asset = resolveLottieAsset(stringVariable(scene.variables, "motionKey"));
      return {
        sceneId: scene.id,
        templateId: scene.templateId,
        treatment: `Lottie · ${asset.label}`,
        asset: asset.url,
        reason,
      };
    }
    return {
      sceneId: scene.id,
      templateId: scene.templateId,
      treatment: scene.templateId,
      asset: "No external asset",
      reason,
    };
  });
}
