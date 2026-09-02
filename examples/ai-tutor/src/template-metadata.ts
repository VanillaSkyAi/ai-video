import type { ServerTemplateMetadata } from "@vanillaskyai/video/server";

/**
 * What the planner is allowed to choose from.
 *
 * The server needs to know the templates this application actually renders. Set
 * up without it, the planner picks from the built-in catalog and returns scenes
 * the page has no component for - a lesson that plans and narrates perfectly
 * and then shows nothing.
 *
 * Only the shape is shared: the schema, when to use it, and how long it needs.
 * The components stay in the browser, where they belong.
 */
export const templateMetadata: ServerTemplateMetadata[] = [
  {
    id: "point",
    label: "Point",
    description: "One line, on the brand background.",
    family: "Explainers",
    jobs: ["ask", "payoff"],
    register: "typography-led",
    useWhen: "Only for the opening question and the closing point. One sentence, no explanation.",
    avoidWhen: "Avoid for anything in the middle of a lesson: a mechanism belongs in steps, a figure in a number scene, something physical in a filmed beat.",
    usesGlobalTextEffect: true,
    usesGlobalTransition: false,
    usesGlobalBackgroundEffect: true,
    minDuration: 2,
    preferredDuration: 4,
    timing: { contentFields: ["texts"], contentUnit: "words" },
    schema: {
      type: "object",
      properties: {
        texts: { type: "string", title: "The line", minLength: 3, maxLength: 90 },
      },
      required: ["texts"],
    },
  },
  {
    id: "steps",
    label: "Steps",
    description: "An ordered process, two to four steps.",
    family: "Explainers",
    jobs: ["proof"],
    register: "typography-led",
    useWhen: "Any mechanism, cause and effect, or sequence. This is the workhorse of an explanation and most middle beats belong here.",
    avoidWhen: "Avoid when a single figure carries the beat, or when nothing happens in an order.",
    usesGlobalTextEffect: true,
    usesGlobalTransition: false,
    usesGlobalBackgroundEffect: true,
    minDuration: 3,
    preferredDuration: 6,
    timing: { contentFields: ["steps"], contentUnit: "items" },
    schema: {
      type: "object",
      properties: {
        texts: { type: "string", title: "Heading", minLength: 3, maxLength: 60 },
        steps: {
          type: "array",
          title: "The steps in order",
          items: { type: "string", minLength: 3, maxLength: 60 },
          minItems: 2,
          maxItems: 4,
        },
      },
      required: ["texts", "steps"],
    },
  },
  {
    id: "figure",
    label: "Figure",
    description: "One number, given room.",
    family: "Data & metrics",
    jobs: ["proof"],
    register: "typography-led",
    useWhen: "A real figure from the answer - a temperature, a distance, a duration, a proportion - deserves the whole frame.",
    avoidWhen: "Avoid when there is no real number. Never invent one to use this template.",
    usesGlobalTextEffect: true,
    usesGlobalTransition: false,
    usesGlobalBackgroundEffect: true,
    minDuration: 2,
    preferredDuration: 4,
    timing: { contentFields: ["texts", "label"], contentUnit: "words" },
    schema: {
      type: "object",
      properties: {
        texts: { type: "string", title: "What the figure is", minLength: 3, maxLength: 60 },
        value: { type: "string", title: "The figure itself", minLength: 1, maxLength: 12 },
        label: { type: "string", title: "Its unit or qualifier", maxLength: 40 },
      },
      required: ["texts", "value"],
    },
  },
  {
    id: "media",
    label: "Filmed beat",
    description: "Generated footage with the line over it.",
    family: "Media & motion",
    jobs: ["proof", "payoff"],
    register: "motion-led",
    useWhen: "The beat is a physical thing doing a physical thing, worth showing rather than describing.",
    avoidWhen: "Avoid for abstractions, diagrams, or anything with a number in it.",
    usesGlobalTextEffect: true,
    usesGlobalTransition: false,
    usesGlobalBackgroundEffect: false,
    minDuration: 3,
    preferredDuration: 5,
    timing: { contentFields: ["texts"], contentUnit: "words" },
    schema: {
      type: "object",
      properties: {
        texts: { type: "string", title: "The line over the footage", minLength: 3, maxLength: 70 },
        mediaKeyword: {
          type: "string",
          title: "What to film",
          description: "A concrete, filmable subject: a real object doing a real thing, never a diagram or an abstraction.",
          minLength: 3,
          maxLength: 90,
        },
      },
      required: ["texts", "mediaKeyword"],
    },
  },
];
