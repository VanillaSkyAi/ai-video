import { defineTemplate } from "@vanillaskyai/video/templates";

export const template = defineTemplate({
  id: "generatedScene",
  label: "Generated scene",
  description: "A generated portrait image with grounded launch copy.",
  family: "Media & motion",
  jobs: ["setup", "atmosphere", "claim", "payoff"],
  register: "motion-led",
  useWhen: "Use when a unique scene image makes the idea concrete or emotionally memorable.",
  avoidWhen: "Avoid when supplied evidence, product UI, or exact data should remain the focus.",
  schema: {
    type: "object",
    properties: {
      imageBrief: { type: "string", minLength: 12, maxLength: 240, title: "Image generation brief" },
      imageUrl: { type: "string", format: "uri", title: "Host-resolved image" },
      decisionReason: { type: "string", minLength: 8, maxLength: 140, title: "Why this treatment fits" },
      eyebrow: { type: "string", maxLength: 40, default: "AI-GENERATED SCENE" },
      headline: { type: "string", minLength: 1, maxLength: 72, default: "Turn one idea into a world." },
    },
    required: ["imageBrief", "decisionReason", "eyebrow", "headline"],
    additionalProperties: false,
  } as const,
  examples: [{
    name: "Launch world",
    variables: {
      imageUrl: "https://example.com/generated-launch-scene.webp",
      imageBrief: "A glass portal opening into a colorful creative night sky with room for a headline",
      decisionReason: "A unique visual world makes the abstract launch promise memorable.",
      eyebrow: "AI-GENERATED SCENE",
      headline: "Turn one idea into a world.",
    },
  }],
  minDuration: 4,
  preferredDuration: 6,
  component: ({ variables, progress, width, height, safeZone }) => {
    const reveal = Math.max(0, Math.min(1, progress * 1.8));
    const isPortrait = height >= width;
    return <section style={{
      position: "relative",
      boxSizing: "border-box",
      width,
      height,
      overflow: "hidden",
      color: "white",
      background: "#03040d",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    }}>
      <img
        src={variables.imageUrl || "/ai-scene.webp"}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.08 - reveal * 0.08})`,
          filter: "saturate(1.08) contrast(1.04)",
        }}
      />
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(180deg, rgba(2,3,12,.14) 28%, rgba(2,3,12,.9) 91%)",
      }} />
      <div style={{
        position: "absolute",
        left: safeZone.left,
        right: safeZone.right,
        bottom: safeZone.bottom + (isPortrait ? 44 : 22),
        opacity: reveal,
        transform: `translateY(${Math.round((1 - reveal) * 30)}px)`,
      }}>
        <p style={{ margin: "0 0 14px", color: "#b8b1ff", fontSize: isPortrait ? 21 : 18, fontWeight: 800, letterSpacing: ".15em" }}>
          {variables.eyebrow}
        </p>
        <h1 style={{ margin: 0, maxWidth: isPortrait ? 720 : 920, fontSize: isPortrait ? 66 : 72, lineHeight: .95, letterSpacing: "-.055em" }}>
          {variables.headline}
        </h1>
      </div>
    </section>;
  },
});
