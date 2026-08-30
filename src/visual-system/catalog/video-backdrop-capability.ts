const EXTERNAL_VIDEO_BACKDROP_CAPABILITY = "__vanillaskyExternalVideoBackdrop";

/** Mark a current SDK-owned source template as safe to render over the player video plane. */
export function markExternalVideoBackdropTemplate<Template extends { component: unknown }>(
  template: Template,
): Template {
  const component = template.component;
  if ((typeof component !== "object" || component === null) && typeof component !== "function") {
    throw new Error("External video backdrop templates require a component");
  }
  Object.defineProperty(component, EXTERNAL_VIDEO_BACKDROP_CAPABILITY, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return template;
}

export function supportsExternalVideoBackdrop(template: unknown): boolean {
  if (typeof template !== "object" || template === null) return false;
  const component = (template as { component?: unknown }).component;
  return ((typeof component === "object" && component !== null) || typeof component === "function") &&
    (component as Record<string, unknown>)[EXTERNAL_VIDEO_BACKDROP_CAPABILITY] === true;
}

export function externalVideoBackdropCapabilitySource(): string {
  return JSON.stringify(EXTERNAL_VIDEO_BACKDROP_CAPABILITY);
}
