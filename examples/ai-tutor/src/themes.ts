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
  // The brand's indigo into blue. Deeper than it looks like it wants to be:
  // the renderer holds captions to 4.5:1 against this ground, and the brand's
  // own bright blue (#00A5FF) measures 2.68:1 under white - so the light end
  // stays at a blue that clears the bar (5.17:1) and the bright one is spent
  // on accents instead, where it sits on the dark ground rather than under
  // white type.
  background: { colors: ["#1C0277", "#2563eb"] as [string, string] },
  foreground: "#ffffff",
  surface: "#1C0277",
  surfaceElevated: "#2f4fc4",
  // Not the brand's #7065A5: muted text still has to be read, and that violet
  // measures 3.66:1 on the dark end of this ground and worse on the light one.
  // The brand violet earns its place as a surface, not as type.
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
    brand: look("#FF3A71", "#FFB100"),
    generatedLook: "Natural daylight, documentary realism, shallow depth of field, fine 35mm grain, muted natural palette. Photoreal, no illustration.",
  },
  {
    id: "illustrated",
    label: "Illustrated",
    brand: look("#00A5FF", "#FF006F"),
    generatedLook: "Hand-drawn cel animation, rough ink contours, visible paper grain, flat cobalt, crimson and ochre against a deep ground. No photorealism.",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    brand: look("#00A5FF", "#FFB100"),
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
