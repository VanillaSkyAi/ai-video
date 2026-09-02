import type { Video } from "@vanillaskyai/video";

/**
 * A lesson, exactly as a planner would return it.
 *
 * Checked in so this example runs with no key and no provider: the point is the
 * composition and the narration, not the model that wrote them. Point
 * `/api/video` at your own `createVideoHandler` route to plan a live one.
 *
 * Each scene carries the line said while it is showing. That is the whole
 * reason `narration` is part of a scene: the words and the picture stay
 * together through planning, playback and storage, instead of being two lists
 * kept in step by index.
 */
export const lesson: Video = {
  schemaVersion: "0.1",
  orientation: "landscape",
  scenes: [
    {
      id: "question",
      templateId: "point",
      variables: { texts: "Why does the Moon always show one face?" },
      timing: { fixedDuration: 4 },
      narration: "The Moon keeps the same face turned towards us, and it has done for billions of years.",
    },
    {
      id: "mechanism",
      templateId: "steps",
      variables: {
        texts: "How tidal locking works",
        steps: ["Earth's gravity pulls on the Moon", "The Moon's spin slows", "Its spin matches its orbit"],
      },
      timing: { fixedDuration: 6 },
      narration: "Earth's gravity dragged on the Moon until its spin slowed to exactly the speed of its orbit.",
    },
    {
      id: "figure",
      templateId: "figure",
      variables: { texts: "One rotation, one orbit", value: "27.3", label: "days, for both" },
      timing: { fixedDuration: 4 },
      narration: "Both now take twenty seven point three days, which is why one side never turns away.",
    },
    {
      id: "payoff",
      templateId: "point",
      variables: { texts: "The far side is not the dark side" },
      timing: { fixedDuration: 4 },
      narration: "The far side still gets sunlight. It is hidden from us, not from the Sun.",
    },
  ],
  style: {
    brand: {
      name: "VanillaSky",
      font: "Inter",
      scriptFont: "Caveat",
      background: { type: "gradient", colors: ["#0d0d2b", "#171741"] },
      colors: {
        primary: "#e04f8a",
        secondary: "#ec9a2c",
        foreground: "#ffffff",
        surface: "#0d0d2b",
        surfaceElevated: "#171741",
        muted: "#aaa5b8",
      },
    },
    density: "airy",
    motion: "calm",
    defaultTextArchetype: "cinematic",
    defaultBackgroundEffect: "static",
    defaultTransition: "crossfade",
  },
};
