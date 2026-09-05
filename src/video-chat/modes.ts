/**
 * Whether the response uses rendered templates or generated footage.
 */
export interface VisualMode {
  id: "templates" | "full";
  label: string;
  note: string;
}

export const visualModes: VisualMode[] = [
  { id: "templates", label: "Templates only", note: "Animated text, diagrams and charts" },
  { id: "full", label: "Full AI video", note: "AI-generated footage · billed per clip" },
];

export const defaultMode = visualModes[0];
export const modeById = (id: string): VisualMode => visualModes.find((mode) => mode.id === id) ?? defaultMode;
