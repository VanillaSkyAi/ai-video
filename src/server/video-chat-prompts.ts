import type { VideoScene } from "../protocol/types.js";

const RESPONSE_SCENES = 5;

export function createVideoChatResponseInstructions(
  fullAiVideo: boolean,
  openingAlreadyProvided = false,
): string {
  return [
    "The input is a prompt from a user. Respond as a short, coherent video.",
    "Honor the requested purpose and tone. A story should feel like a story, a recommendation should be useful, an explanation should be clear, and a creative request should not be turned into a lecture.",
    fullAiVideo
      ? 'Your first output line must be exactly one host-consumed JSON object: {"type":"video-chat.opening","spokenHook":"6-9 words","mediaKeyword":"2-4 concrete words","firstShot":{"text":"2-7 words","narration":"10-16 spoken words","mediaKeyword":"2-8 concrete words"}}. This leading object is the one explicit exception to the standard plan-part list and is consumed before plan validation.'
      : openingAlreadyProvided
        ? "The host has already started the supplied OPENING ALREADY SPOKEN. Start directly with scene.add plan parts; do not emit a video-chat.opening object."
        : 'Your first output line must be exactly one host-consumed JSON object: {"type":"video-chat.opening","spokenHook":"6-9 words","mediaKeyword":"2-4 concrete words"}. This leading object is the one explicit exception to the standard plan-part list and is consumed before plan validation.',
    fullAiVideo && openingAlreadyProvided
      ? "Copy the supplied OPENING ALREADY SPOKEN exactly into spokenHook; do not replace or paraphrase it."
      : undefined,
    fullAiVideo
      ? "The host inserts firstShot as the first body scene and begins generating it immediately. After the opening object, emit exactly four additional scenes that continue it. Never emit, repeat, paraphrase, or replace firstShot as a scene."
      : `After the opening instruction above, use exactly ${RESPONSE_SCENES} scenes and build a progression that fits the request:`,
    fullAiVideo ? undefined : "1. Open directly on the strongest image, action, claim, or idea.",
    "2. Develop it with new information or movement.",
    "3. Deepen, complicate, or advance the response.",
    "4. Deliver the turn, consequence, recommendation, or emotional peak.",
    "5. Close on the payoff or the one thing worth carrying forward, never a recap.",
    "No scene may repeat another scene's job. If a scene could be deleted without weakening the response, replace it.",
    "The prompt is already on screen, so never spend the opening scene restating it.",
    "If the input includes an OPENING ALREADY SPOKEN transcript, continue directly from that exact hook. Never repeat, paraphrase, contradict, or render it as the first scene's copy.",
    "For factual requests, distinguish supplied facts from stable general knowledge and never invent statistics, quotations, sources, or personal experience.",
    "For creative requests, create the requested material directly rather than explaining how one might create it.",
    fullAiVideo
      ? "Use the media template for every scene you emit. Every scene must set mediaType to video and carry a mediaKeyword: a concrete, filmable subject, a real object doing a real thing, never a diagram or an abstraction. Never use mediaType gradient and never omit mediaKeyword - a scene without one has nothing to film. If a beat seems too abstract to film, film the closest real thing that shows it."
      : "Choose the template that fits each beat honestly - a figure belongs in a number scene, an ordered process in steps, a comparison in a chart - rather than repeating one shape. Give any scene that would be stronger over real footage a mediaKeyword: a concrete, filmable subject, a real object doing a real thing, never a diagram or an abstraction. Use the media template for the one or two beats most worth watching happen.",
    fullAiVideo
      ? 'Mark the final scene placement:"closer". Use the media template for it, as for every other beat.'
      : 'Mark the final scene placement:"closer" and use either the milestone or the media template for it. Those are the only two here that may close, so the response must end on one.',
    "Every scene must carry a timing object, even an empty one. A scene without it fails the whole response.",
    "Never mention the video, the scenes, or yourself.",
  ].filter((line): line is string => line != null).join("\n");
}
export const VIDEO_CHAT_NARRATION_PROMPT = [
  "You narrate a short video response, one scene at a time.",
  "You are given the scene about to be shown, and the lines already said before it.",
  "",
  "Return only the line to say over this scene. No JSON, no quotes, no preamble.",
  "One sentence, 10-16 words, plain spoken English.",
  "Say only what this scene contributes. Preserve the requested form: narrate a story as a story, give recommendations directly, and explain only when the user asked for an explanation.",
  "Never jump ahead to a later scene or repeat a line already said.",
  "Never read the on-screen text back word for word - the viewer can already see it.",
  "Continue naturally from the lines before it. Never mention scenes, videos or slides.",
].join("\n");

export const VIDEO_CHAT_SUGGESTIONS_PROMPT = [
  "You suggest what a user might prompt next after receiving a video response.",
  'Return JSON only: {"suggestions": [{"prompt": string, "keyword": string}]} with exactly four entries.',
  "prompt: short and specific to what was created or discussed. Suggestions may continue, remix, deepen, compare, or apply it.",
  "keyword: two to four words naming something filmable that stands for the prompt, for stock footage search. Concrete subjects only - no abstractions, no text on screen.",
].join("\n");

export function createNarrationUserPrompt(
  prompt: string,
  scene: Pick<VideoScene, "templateId" | "variables">,
  earlier: readonly string[],
): string {
  return [
    `USER PROMPT: ${prompt}`,
    earlier.length > 0 ? `\nSAID SO FAR:\n${earlier.map((line) => `- ${line}`).join("\n")}` : "",
    `\nTHIS SCENE: [${scene.templateId}] ${JSON.stringify(scene.variables).slice(0, 4_000)}`,
  ].join("\n");
}
