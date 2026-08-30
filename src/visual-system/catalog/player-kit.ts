import type { VideoCapabilities } from "../../protocol/types.js";
import type { TemplateRegistry } from "./kit.js";
import { assertTemplateTransitionMetadata } from "./transition-contract.js";
import type {
  SceneTemplate,
  TemplateJsonSchema,
  TemplateTransitionTiming,
} from "./types.js";

export interface PlayerTemplateData {
  readonly id: string;
  readonly defaults: Readonly<Record<string, unknown>>;
  readonly usesGlobalTransition: boolean;
  readonly transitionTiming?: TemplateTransitionTiming;
}

export interface PlayerTemplate extends Omit<PlayerTemplateData, "defaults"> {
  readonly component: SceneTemplate["component"];
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly schema?: TemplateJsonSchema;
}

export interface PlayerTemplateRegistry {
  readonly templates: readonly PlayerTemplate[];
  readonly capabilities: VideoCapabilities;
  getTemplate(id: string): PlayerTemplate | undefined;
}

export function createPlayerTemplateRegistry(
  templates: readonly PlayerTemplate[],
): PlayerTemplateRegistry {
  const byId = new Map<string, PlayerTemplate>();
  for (const template of templates) {
    assertTemplateTransitionMetadata(template);
    if (!template.defaults && !template.schema) {
      throw new Error(`${template.id} requires defaults or a schema`);
    }
    if (byId.has(template.id)) throw new Error(`Duplicate template id: ${template.id}`);
    byId.set(template.id, template);
  }
  const frozenTemplates = Object.freeze([...templates]);
  return Object.freeze({
    templates: frozenTemplates,
    capabilities: { templates: frozenTemplates.map(({ id }) => id) },
    getTemplate: (id: string) => byId.get(id),
  });
}

/** Customer renderers replace matching built-ins and add new template IDs. */
export function overlayPlayerTemplateRegistry(
  defaults: PlayerTemplateRegistry,
  customer?: TemplateRegistry,
): PlayerTemplateRegistry {
  if (!customer) return defaults;
  const customerTemplates = new Map(customer.templates.map((template) => [template.id, template]));
  const defaultIds = new Set(defaults.templates.map(({ id }) => id));
  return createPlayerTemplateRegistry([
    ...defaults.templates.map((template) => customerTemplates.get(template.id) ?? template),
    ...customer.templates.filter(({ id }) => !defaultIds.has(id)),
  ]);
}
