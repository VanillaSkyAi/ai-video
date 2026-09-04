import { createTemplateSystemPrompt } from "./prompt.js";
import {
  BUILTIN_TEMPLATE_CATALOG,
} from "./builtin-metadata.js";
import type {
  SceneTemplateMetadata,
  TemplateMetadataCatalog,
} from "./catalog-types.js";

const catalogPromptKit = {
  listTemplateMetadata: () => [...BUILTIN_TEMPLATE_CATALOG],
} satisfies TemplateMetadataCatalog;

export function createBuiltinTemplateSystemPrompt(options: {
  basePrompt?: string;
} = {}): string {
  // This catalog helper intentionally describes every built-in. Request-time
  // handlers use createTemplateSystemPrompt directly and remove entries whose
  // required media cannot be supplied for that request.
  return createTemplateSystemPrompt({ kit: catalogPromptKit, suppliedMediaAvailable: true, ...options });
}

export {
  BUILTIN_TEMPLATE_CAPABILITIES,
  BUILTIN_TEMPLATE_CATALOG,
  getBuiltinTemplateMetadata,
  listBuiltinTemplateMetadata,
} from "./builtin-metadata.js";
export type { BuiltinTemplateId, TemplateVariables } from "./builtin-metadata.js";
export type {
  SceneTemplateMetadata,
  TemplateJob,
  TemplateRegister,
} from "./catalog-types.js";
