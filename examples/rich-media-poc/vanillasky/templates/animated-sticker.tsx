import { defineTemplate } from "@vanillaskyai/ai-video/templates";
import { ProgressGif } from "../../src/components/progress-gif";
import { resolveStickerAsset } from "../../src/lib/asset-catalog";

export const template = defineTemplate({
  id: "animatedSticker",
  label: "Animated sticker",
  description: "A transparent GIF accent decoded into seekable frames.",
  family: "Media & motion",
  jobs: ["punctuation", "payoff"],
  register: "motion-led",
  useWhen: "Use as a short reaction, celebration, transition accent, or shareable visual punchline.",
  avoidWhen: "Avoid when the animation would compete with evidence or needs photoreal detail.",
  schema: {
    type: "object",
    properties: {
      stickerKey: { type: "string", enum: ["spark", "rocket", "confetti", "launch"], title: "Sticker choice" },
      decisionReason: { type: "string", minLength: 8, maxLength: 140, title: "Why this treatment fits" },
      headline: { type: "string", minLength: 1, maxLength: 56, default: "Make the payoff pop." },
      caption: { type: "string", minLength: 1, maxLength: 100, default: "Transparent reactions without losing deterministic playback." },
    },
    required: ["stickerKey", "decisionReason", "headline", "caption"],
    additionalProperties: false,
  } as const,
  examples: [{
    name: "Sticker payoff",
    variables: {
      stickerKey: "launch",
      decisionReason: "A launch burst gives the payoff a shareable reaction beat.",
      headline: "Make the payoff pop.",
      caption: "Transparent reactions without losing deterministic playback.",
    },
  }],
  minDuration: 3,
  preferredDuration: 5,
  component: ({ variables, progress, width, height, safeZone }) => {
    const sticker = resolveStickerAsset(variables.stickerKey);
    const isPortrait = height >= width;
    const reveal = Math.max(0, Math.min(1, progress * 2));
    const bounce = 1 + Math.sin(progress * Math.PI * 4) * .035;
    return <section style={{
      boxSizing: "border-box",
      width,
      height,
      padding: `${safeZone.top}px ${safeZone.right}px ${safeZone.bottom}px ${safeZone.left}px`,
      display: "grid",
      alignContent: "center",
      justifyItems: "center",
      gap: isPortrait ? 30 : 18,
      overflow: "hidden",
      textAlign: "center",
      color: "#fff",
      background: "radial-gradient(circle at 50% 38%, #5033bf 0, #17102f 48%, #070611 82%)",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    }}>
      <div style={{
        width: isPortrait ? "72%" : "38%",
        aspectRatio: "1",
        opacity: reveal,
        transform: `scale(${(.78 + reveal * .22) * bounce}) rotate(${(1 - reveal) * -8}deg)`,
        filter: "drop-shadow(0 28px 46px rgba(4, 0, 20, .42))",
      }}>
        <ProgressGif src={sticker.url} progress={progress} label={`${sticker.label} animated sticker`} />
      </div>
      <div style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 22}px)` }}>
        <h1 style={{ margin: 0, fontSize: isPortrait ? 61 : 52, lineHeight: .95, letterSpacing: "-.05em" }}>
          {variables.headline}
        </h1>
        <p style={{ margin: "18px auto 0", maxWidth: 680, color: "#c9c2e8", fontSize: isPortrait ? 23 : 20, lineHeight: 1.4 }}>
          {variables.caption}
        </p>
      </div>
    </section>;
  },
});
