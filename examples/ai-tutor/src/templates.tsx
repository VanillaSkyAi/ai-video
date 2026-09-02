import { defineTemplate } from "@vanillaskyai/video/templates";
import type { SceneTemplateProps } from "@vanillaskyai/video/templates";

/**
 * Every scene paints itself from the brand, so a theme change repaints all of
 * them - and sizes itself from the frame it is given rather than from the page.
 * A template renders at the video's own resolution and is scaled to fit, so
 * anything measured in rem comes out the size of a caption in a thumbnail.
 */
function frame(style: SceneTemplateProps["style"], width: number) {
  return {
    background: style.brand.background.type === "gradient"
      ? `linear-gradient(160deg, ${style.brand.background.colors.join(", ")})`
      : style.brand.background.color,
    color: style.brand.colors.foreground,
    // A brand names one family; a page still needs somewhere to fall back to.
    fontFamily: `${style.brand.font}, Inter, system-ui, sans-serif`,
    fontSize: `${width * 0.032}px`,
    padding: `${width * 0.07}px`,
    gap: `${width * 0.02}px`,
  };
}

/**
 * Three small templates, so this example needs nothing but the SDK.
 *
 * They read their colours from the style rather than hard-coding any, which is
 * what makes the theme picker work: choosing a look repaints the scenes and the
 * captions together. A real tutor would use the built-in catalog instead, where
 * every template also declares how long its content needs to be read.
 */
const point = defineTemplate({
  id: "point",
  useWhen: "One line carries the beat",
  schema: {
    type: "object",
    properties: { texts: { type: "string" } },
    required: ["texts"],
  } as const,
  component: ({ variables, style, width }) => <section className="scene point" style={frame(style, width)}>
    <h1 style={{ fontSize: "2.4em" }}>{variables.texts}</h1>
  </section>,
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
  component: ({ variables, style, width }) => <section className="scene steps" style={frame(style, width)}>
    <h2 style={{ fontSize: "1.1em" }}>{variables.texts}</h2>
    <ol style={{ fontSize: "1.5em" }}>{variables.steps.map((step) => <li key={step}>{step}</li>)}</ol>
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
  component: ({ variables, style, width }) => <section className="scene figure" style={frame(style, width)}>
    <h2>{variables.texts}</h2>
    <strong style={{ color: style.brand.colors.primary }}>{variables.value}</strong>
    {variables.label && <span>{variables.label}</span>}
  </section>,
});

export const definitions = [point, steps, figure];
