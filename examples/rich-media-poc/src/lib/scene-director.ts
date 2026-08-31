import {
  createVideoHandler,
  type VideoHandlerOptions,
} from "@vanillaskyai/video/server";
import { templates } from "../../vanillasky/server";

export { DIRECTOR_TEMPLATE_IDS } from "./scene-director-contract";

export const DIRECTOR_BASE_PROMPT = `
Act as a visual scene director, not a generic slide writer.
Use only the templates requested by the client. Create two to four concise scenes and use at least two different treatments when the source supports them.
Choose each treatment for a semantic reason: generatedScene for a unique visual world or emotional metaphor, animatedSticker for a reaction or punchline, and lottieMotion for a process, system, progress state, or reusable graphic idea.
Never force all treatments into every video. Do not repeat a stickerKey or motionKey inside one plan. Use at most one generatedScene to bound cost and latency.
For every scene, write a short decisionReason that explains why the treatment fits that exact beat. For generatedScene, write a concrete imageBrief describing composition, subject, mood, and useful negative space; never put visible text, logos, or UI in the image.
Never invent or fill imageUrl. The host application resolves generated images after the plan is complete.
`.trim();

export function createSceneDirectorHandler(options: VideoHandlerOptions) {
  const { basePrompt, templates: _ignoredTemplates, ...handlerOptions } = options;
  return createVideoHandler({
    ...handlerOptions,
    templates,
    basePrompt: [DIRECTOR_BASE_PROMPT, basePrompt].filter(Boolean).join("\n\n"),
  });
}
