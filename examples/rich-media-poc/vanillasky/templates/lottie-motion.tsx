import { defineTemplate } from "@vanillaskyai/video/templates";
import { ProgressLottie } from "../../src/components/progress-lottie";
import { resolveLottieAsset } from "../../src/lib/asset-catalog";

export const template = defineTemplate({
  id: "lottieMotion",
  label: "Lottie motion",
  description: "A small vector motion asset whose frame follows scene progress.",
  family: "Media & motion",
  jobs: ["setup", "punctuation", "payoff"],
  register: "motion-led",
  useWhen: "Use for branded loops, icons, explainers, progress states, and lightweight reusable motion.",
  avoidWhen: "Avoid for photographic storytelling or when a static icon communicates the same idea.",
  schema: {
    type: "object",
    properties: {
      motionKey: { type: "string", enum: ["orbit", "pulse", "steps"], title: "Motion choice" },
      decisionReason: { type: "string", minLength: 8, maxLength: 140, title: "Why this treatment fits" },
      kicker: { type: "string", minLength: 1, maxLength: 36, default: "VECTOR MOTION" },
      headline: { type: "string", minLength: 1, maxLength: 64, default: "Tiny asset. Big energy." },
    },
    required: ["motionKey", "decisionReason", "kicker", "headline"],
    additionalProperties: false,
  } as const,
  examples: [{
    name: "Motion system",
    variables: {
      motionKey: "orbit",
      decisionReason: "Orbiting elements make an interconnected system easy to grasp.",
      kicker: "VECTOR MOTION",
      headline: "Tiny asset. Big energy.",
    },
  }],
  minDuration: 3,
  preferredDuration: 5,
  component: ({ variables, progress, width, height, safeZone }) => {
    const motion = resolveLottieAsset(variables.motionKey);
    const isPortrait = height >= width;
    const reveal = Math.max(0, Math.min(1, progress * 1.7));
    return <section style={{
      boxSizing: "border-box",
      width,
      height,
      padding: `${safeZone.top}px ${safeZone.right}px ${safeZone.bottom}px ${safeZone.left}px`,
      display: "grid",
      gridTemplateRows: isPortrait ? "minmax(0, 1fr) auto" : "1fr",
      gridTemplateColumns: isPortrait ? "1fr" : "minmax(0, .95fr) minmax(0, 1.05fr)",
      alignItems: "center",
      overflow: "hidden",
      color: "#131020",
      background: "linear-gradient(150deg, #fff6e7 0%, #f5d4ff 48%, #b8c8ff 100%)",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: isPortrait ? 650 : 520,
        aspectRatio: "1",
        justifySelf: "center",
        opacity: reveal,
        transform: `scale(${.9 + reveal * .1})`,
      }}>
        <ProgressLottie src={motion.url} progress={progress} label={`${motion.label} vector motion`} />
      </div>
      <div style={{ alignSelf: isPortrait ? "end" : "center", opacity: reveal }}>
        <p style={{ margin: "0 0 15px", color: "#6b2be0", fontSize: isPortrait ? 21 : 18, fontWeight: 850, letterSpacing: ".15em" }}>
          {variables.kicker}
        </p>
        <h1 style={{ margin: 0, fontSize: isPortrait ? 63 : 66, lineHeight: .94, letterSpacing: "-.055em" }}>
          {variables.headline}
        </h1>
      </div>
    </section>;
  },
});
