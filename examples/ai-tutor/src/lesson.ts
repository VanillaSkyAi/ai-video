import type { Video } from "@vanillaskyai/video";

/**
 * Lessons, exactly as a planner returns them.
 *
 * Checked in so this example runs with no key: what is demonstrated here is the
 * composition, the pacing and the narration, not the model that wrote them.
 *
 * There is one per starter question, because a demo that answers every question
 * with the same lesson is pretending - and pretending is worse than saying
 * plainly that it cannot plan a new one without a key.
 *
 * Each scene carries the line said while it is showing. That is the whole
 * reason `narration` belongs to a scene: the words and the picture stay
 * together through planning, playback, storage and replay, instead of being two
 * lists kept in step by index.
 */
const STYLE: Video["style"] = {
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
};

function lesson(scenes: Video["scenes"]): Video {
  return { schemaVersion: "0.1", orientation: "landscape", scenes, style: STYLE };
}

export const storedLessons: Record<string, Video> = {
  "Why does the Moon always show one face?": lesson([
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
  ]),

  "What makes ocean waves break?": lesson([
    {
      id: "question",
      templateId: "point",
      variables: { texts: "What makes ocean waves break?" },
      timing: { fixedDuration: 4 },
      narration: "A wave can cross an entire ocean without breaking, then fall over in the last few metres.",
    },
    {
      id: "mechanism",
      templateId: "steps",
      variables: {
        texts: "What happens near the shore",
        steps: ["The sea floor rises", "The base of the wave slows", "The crest keeps its speed"],
      },
      timing: { fixedDuration: 6 },
      narration: "As the sea floor rises it drags on the bottom of the wave, while the top carries on at speed.",
    },
    {
      id: "figure",
      templateId: "figure",
      variables: { texts: "It topples at roughly", value: "1.3", label: "times its height in depth" },
      timing: { fixedDuration: 4 },
      narration: "Once the water is about one and a third times the wave's height, the crest outruns its own base.",
    },
    {
      id: "payoff",
      templateId: "point",
      variables: { texts: "The wave was never moving water" },
      timing: { fixedDuration: 4 },
      narration: "What crossed the ocean was energy. The water only moves in circles, until the sea floor stops it.",
    },
  ]),

  "How does an atom hold itself together?": lesson([
    {
      id: "question",
      templateId: "point",
      variables: { texts: "How does an atom hold itself together?" },
      timing: { fixedDuration: 4 },
      narration: "A nucleus is a cluster of protons that all repel each other, packed impossibly close together.",
    },
    {
      id: "mechanism",
      templateId: "steps",
      variables: {
        texts: "Two forces, pulling opposite ways",
        steps: ["Charge pushes protons apart", "The strong force pulls them together", "It wins, but only up close"],
      },
      timing: { fixedDuration: 6 },
      narration: "A second force, far stronger than electricity, holds them - but it reaches almost no distance at all.",
    },
    {
      id: "figure",
      templateId: "figure",
      variables: { texts: "Its reach", value: "10⁻¹⁵", label: "metres, and then nothing" },
      timing: { fixedDuration: 4 },
      narration: "Beyond about a femtometre the strong force simply stops, which is why nuclei cannot grow without limit.",
    },
    {
      id: "payoff",
      templateId: "point",
      variables: { texts: "Big atoms run out of glue" },
      timing: { fixedDuration: 4 },
      narration: "Past a certain size the repulsion reaches further than the glue does, and the nucleus falls apart.",
    },
  ]),

  "Why do some animals walk on two legs?": lesson([
    {
      id: "question",
      templateId: "point",
      variables: { texts: "Why do some animals walk on two legs?" },
      timing: { fixedDuration: 4 },
      narration: "Standing upright is unstable, slow to learn and hard on the back. It keeps evolving anyway.",
    },
    {
      id: "mechanism",
      templateId: "steps",
      variables: {
        texts: "What two legs buy you",
        steps: ["Hands free to carry", "A longer view over tall grass", "Less energy over a long day"],
      },
      timing: { fixedDuration: 6 },
      narration: "It frees the hands, lifts the eyes above tall grass, and over long distances it costs less energy.",
    },
    {
      id: "figure",
      templateId: "figure",
      variables: { texts: "Walking upright uses about", value: "75%", label: "of the energy of knuckle-walking" },
      timing: { fixedDuration: 4 },
      narration: "Measured against knuckle-walking, upright walking uses roughly three quarters of the energy.",
    },
    {
      id: "payoff",
      templateId: "point",
      variables: { texts: "Slower, but further" },
      timing: { fixedDuration: 4 },
      narration: "Two legs trade speed for range. An animal that can keep going all day does not need to be fast.",
    },
  ]),
};

/** The starter questions are the ones a stored lesson can answer. */
export const storedQuestions = Object.keys(storedLessons);
