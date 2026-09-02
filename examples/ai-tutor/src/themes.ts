import type { VideoBrandInput } from "@vanillaskyai/video";

/**
 * A look, in both halves.
 *
 * The brand decides how captions are drawn; `generatedLook` decides what any
 * generated footage behind them looks like. They travel together because they
 * have to - pale illustrated ground under dark documentary footage is
 * unreadable - which is why the SDK carries the second half on the style rather
 * than leaving each application to thread it into provider calls by hand.
 */
export interface Theme {
  id: string;
  label: string;
  brand: VideoBrandInput;
  generatedLook: string;
}

export const themes: Theme[] = [
  {
    id: "illustrated",
    label: "Illustrated",
    brand: {
      font: "Inter",
      scriptFont: "Caveat",
      background: { color: "#f6f1e7" },
      colors: {
        primary: "#1f4fd8", secondary: "#d1495b", foreground: "#17150f",
        surface: "#f6f1e7", surfaceElevated: "#efe7d8", muted: "#6b6355",
      },
    },
    generatedLook: "Hand-drawn cel animation on a bright ivory ground, rough ink contours, visible paper grain, flat cobalt, crimson and ochre. No photorealism.",
  },
  {
    id: "documentary",
    label: "Documentary",
    brand: {
      font: "Inter",
      scriptFont: "Caveat",
      background: { colors: ["#0d0d2b", "#171741"] },
      colors: {
        primary: "#e04f8a", secondary: "#ec9a2c", foreground: "#ffffff",
        surface: "#0d0d2b", surfaceElevated: "#171741", muted: "#aaa5b8",
      },
    },
    generatedLook: "Natural daylight, documentary realism, shallow depth of field, fine 35mm grain, muted natural palette. Photoreal, no illustration.",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    brand: {
      font: "Inter",
      scriptFont: "Caveat",
      background: { color: "#0b2545" },
      colors: {
        primary: "#8ecae6", secondary: "#ffb703", foreground: "#eaf4fb",
        surface: "#0b2545", surfaceElevated: "#123a63", muted: "#8fa8c0",
      },
    },
    generatedLook: "Technical blueprint drawing, precise white linework on deep cyanotype blue, faint measurement grid, one warm accent. Schematic, no photorealism.",
  },
];

export const defaultTheme = themes[0];
export const themeById = (id: string): Theme => themes.find((theme) => theme.id === id) ?? defaultTheme;
