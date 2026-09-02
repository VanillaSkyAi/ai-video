/**
 * How much of the answer is filmed.
 *
 * Every beat gets a scene either way; the mode only decides whether that scene
 * is generated footage or a rendered card. It is expressed as a ceiling rather
 * than a flag because that is what it costs: the planner decides how many
 * scenes a lesson has, and each filmed one is billed.
 */
export interface VisualMode {
  id: "templates" | "some" | "full";
  label: string;
  note: string;
  /** Passed to the handler as `maxResolvedMedia`. */
  filmedScenes: number;
}

export const visualModes: VisualMode[] = [
  { id: "templates", label: "Templates only", filmedScenes: 0, note: "Rendered scenes · free and instant" },
  { id: "some", label: "Some AI video", filmedScenes: 1, note: "The opening beat is filmed" },
  { id: "full", label: "Full AI video", filmedScenes: 5, note: "Every beat filmed · billed per clip" },
];

export const defaultMode = visualModes[0];
export const modeById = (id: string): VisualMode => visualModes.find((mode) => mode.id === id) ?? defaultMode;
