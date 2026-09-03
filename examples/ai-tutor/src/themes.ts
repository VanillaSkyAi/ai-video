import type { VideoBrandInput } from "@vanillaskyai/video";

/**
 * A look for the footage, not for the captions.
 *
 * The three names describe what generated video should look like, and that is
 * all they vary. Captions are dark ground and white type in every theme,
 * because that is the only pairing that reads over anything the picture might
 * turn out to be - a bright ivory card was unreadable the moment a photograph
 * arrived behind it, and stock footage arrives in every mode now.
 *
 * What is left per theme is the accent pair, which echoes the footage palette
 * without ever being asked to carry a word.
 */
const GROUND = {
  font: "Inter",
  scriptFont: "Caveat",
  // Violet into blue, one step deeper than it looks like it wants to be:
  // white over the lighter pair measured 3.73:1 and the renderer holds
  // captions to 4.5:1. The warm-up used to wear the lighter version because
  // decoration is never contrast-checked - and then the first scene cut to
  // something else entirely.
  background: { colors: ["#5b21b6", "#2563eb"] as [string, string] },
  foreground: "#ffffff",
  surface: "#4a1a95",
  surfaceElevated: "#2f4fc4",
  muted: "#d7d3f0",
};

function look(primary: string, secondary: string): VideoBrandInput {
  const { font, scriptFont, background, ...colors } = GROUND;
  return { font, scriptFont, background, colors: { ...colors, primary, secondary } };
}
export interface Theme {
  id: string;
  label: string;
  brand: VideoBrandInput;
  generatedLook: string;
}

export const themes: Theme[] = [
  {
    id: "documentary",
    label: "Documentary",
    brand: look("#e04f8a", "#ec9a2c"),
    generatedLook: "Natural daylight, documentary realism, shallow depth of field, fine 35mm grain, muted natural palette. Photoreal, no illustration.",
  },
  {
    id: "illustrated",
    label: "Illustrated",
    brand: look("#5b7cfa", "#d1495b"),
    generatedLook: "Hand-drawn cel animation, rough ink contours, visible paper grain, flat cobalt, crimson and ochre against a deep ground. No photorealism.",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    brand: look("#8ecae6", "#ffb703"),
    generatedLook: "Technical blueprint drawing, precise white linework on deep cyanotype blue, faint measurement grid, one warm accent. Schematic, no photorealism.",
  },
];

/**
 * The stage's ground, in CSS, so the wait can wear it too.
 *
 * The wait used to be a fixed purple that belonged to no theme, and the lesson
 * then cut to a different colour entirely - the one moment the page most needs
 * to look like one thing. This is the same background the scenes are composed
 * on.
 */
export function themeBackground(theme: Theme): string {
  const background = theme.brand.background as { color?: string; colors?: readonly string[] } | undefined;
  // 175deg, because that is the angle the renderer uses for a brand gradient.
  // A warm-up at a different angle is a different picture, and the cut to the
  // first scene is exactly where that shows.
  if (background?.colors && background.colors.length >= 2) {
    return `linear-gradient(175deg, ${background.colors[0]} 0%, ${background.colors[1]} 100%)`;
  }
  return background?.color ?? "#4c2ba8";
}

export const defaultTheme = themes[0];
export const themeById = (id: string): Theme => themes.find((theme) => theme.id === id) ?? defaultTheme;
