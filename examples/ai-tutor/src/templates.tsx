import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * Three small templates, so this example needs nothing but the SDK.
 *
 * A real tutor would use the built-in catalog, where every template also
 * declares how long its content needs to be read. These do not, which makes the
 * point plainly: with no template metadata, the narration alone decides how
 * long a scene is held.
 */
const point = defineTemplate({
  id: "point",
  useWhen: "One line carries the beat",
  schema: {
    type: "object",
    properties: { texts: { type: "string" } },
    required: ["texts"],
  } as const,
  component: ({ variables }) => <section className="scene point"><h1>{variables.texts}</h1></section>,
});

const steps = defineTemplate({
  id: "steps",
  useWhen: "An ordered process, two to four steps",
  schema: {
    type: "object",
    properties: {
      texts: { type: "string" },
      steps: { type: "array", items: { type: "string" } },
    },
    required: ["texts", "steps"],
  } as const,
  component: ({ variables }) => <section className="scene steps">
    <h2>{variables.texts}</h2>
    <ol>{variables.steps.map((step) => <li key={step}>{step}</li>)}</ol>
  </section>,
});

const figure = defineTemplate({
  id: "figure",
  useWhen: "One number carries the beat",
  schema: {
    type: "object",
    properties: {
      texts: { type: "string" },
      value: { type: "string" },
      label: { type: "string" },
    },
    required: ["texts", "value"],
  } as const,
  component: ({ variables }) => <section className="scene figure">
    <h2>{variables.texts}</h2>
    <strong>{variables.value}</strong>
    {variables.label && <span>{variables.label}</span>}
  </section>,
});

export const definitions = [point, steps, figure];
