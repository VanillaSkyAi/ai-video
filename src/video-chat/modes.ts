/**
 * Whether the response uses rendered templates or generated footage.
 */
export interface VisualMode {
  id: "templates" | "full";
  label: string;
  note: string;
}

export const visualModes: VisualMode[] = [
  { id: "templates", label: "Templates only", note: "Rendered scenes · free and instant" },
  { id: "full", label: "Full AI video", note: "Every beat filmed · billed per clip" },
];

export const defaultMode = visualModes[0];
export const modeById = (id: string): VisualMode => visualModes.find((mode) => mode.id === id) ?? defaultMode;
