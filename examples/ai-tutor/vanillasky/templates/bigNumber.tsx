import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * chart-counter — animated counting number with label + text overlay.
 *
 * Big number counts up from 0 to target value driven by scene progress.
 * Optional prefix/suffix, label below, accent underline, beat-reactive pulse.
 * TextOverlay in the top 30% carries a message above the counter.
 */
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { TemplateText } from "../scene-templates/template-text";
import { withOpacity } from "../theme";
import { TOP_TEXT_AREA_RATIO } from "../backgrounds";
import { SceneBackground, getMediaBackgroundProps, hasSceneMedia } from "../scene-templates/scene-background";
import { ConfettiLayer } from "../scene-templates/confetti-layer";
import { getResponsiveFontSize } from "../typography";
import { CountUpNumber } from "../primitives/typography/CountUpNumber";

export const ChartCounterTemplate = ({
  variables,
  style,
  progress,
  motionProgress = progress,
  beatIntensity,
  width,
  height,
  safeZone,
  sceneDuration,
  isPlaying = true,
  backgroundEffect,
}: SceneTemplateProps) => {
  const s = Math.min(width, height) / 1080;
  const { primary, foreground, font, background } = resolveTokens(style);
  const chartColor = primary;
  const textColor = foreground;
  const textsRaw = String(variables.texts || "");
  const gradSeed = textsRaw.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const parsedValue = Number(variables.value);
  const targetValue = Number.isFinite(parsedValue) ? parsedValue : 1000;
  const parsedDecimalPlaces = Number(variables.decimalPlaces);
  const decimalPlaces = Number.isFinite(parsedDecimalPlaces)
    ? Math.max(0, Math.min(6, Math.trunc(parsedDecimalPlaces)))
    : undefined;
  const label = String(variables.label || "Total users");
  const prefix = String(variables.prefix || "");
  const unit = String(variables.unit || "");

  // Media-mode legibility: when a Pexels photo/video is behind, force the
  // label to white at full opacity (not the 60% brand-text dim that works
  // on a flat gradient) and stack a stronger drop-shadow on number + label
  // so they punch through busy footage. Mirrors how bg-media handles text
  // contrast over photos. SceneBackground already adds a vignette + bottom
  // scrim — these are the per-text reinforcements.
  const hasMedia = !!String(variables.mediaUrl || "").trim() &&
    String(variables.mediaType || "auto") !== "gradient";
  const numberColor = hasMedia ? "#ffffff" : textColor;
  const labelColor = hasMedia ? "#ffffff" : withOpacity(textColor, 0.6);
  // Confetti burst — fires when the count-up completes. Reuses the shared
  // ConfettiLayer (the 200-particle falling-confetti physics also used by
  // bg-confetti and bg-media's `confetti: true`) instead of an inline
  // bespoke burst, so the celebration feel is consistent across templates.
  // The layer's progress runs 0→1 internally; we remap scene [0.55, 1.0]
  // onto that so particles burst on count completion and fall through the
  // held state.
  const confettiActive = variables.confetti === true && motionProgress >= 0.55;
  const confettiProgress = confettiActive ? (motionProgress - 0.55) / 0.45 : 0;

  const labelFontSize = getResponsiveFontSize(label, width, "subtitle", height) * 1.3;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "var(--vanillasky-template-surface, #000)",
        position: "relative",
        overflow: "hidden",
        fontFamily: font,
      }}
    >
      {/* [slot: background] Gradient by default, optionally a Pexels photo/video when mediaUrl is set */}
      <SceneBackground
        style={style}
        progress={progress}
        sceneDuration={sceneDuration}
        width={width}
        height={height}
        {...getMediaBackgroundProps(variables)}
        backgroundEffect={backgroundEffect}
        seed={gradSeed}
        isPlaying={isPlaying}
        beatIntensity={beatIntensity}
      />

      {/* [slot: background] Subtle radial glow behind number — accent atmospheric */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -55%)",
          width: 500 * s,
          height: 500 * s,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${withOpacity(primary, 0.15)} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* [slot: badge] Confetti — shared 200-particle layer, fires when count completes */}
      {confettiActive && (
        <ConfettiLayer
          progress={confettiProgress}
          width={width}
          height={height}
          beatIntensity={beatIntensity}
          bgColor={hasMedia ? undefined : background.type === "solid" ? background.color : background.colors[1]}
        />
      )}

      {/* [slot: caption] Headline — top text area (TemplateText) */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * TOP_TEXT_AREA_RATIO, overflow: "visible" }}>
        <TemplateText
        overMedia={hasSceneMedia(variables)}
          motionProgress={motionProgress}
          typeTreatment={resolveTokens(style).preset.type}
          archetype="subtle"
          text={String(variables.texts ?? "")}
          progress={progress}
          sceneDuration={sceneDuration ?? 3}
          width={width}
          height={height}
          position="top"
          sizeRole="headline"
          safeZone={safeZone}
          font={font}
          color={textColor}
          beatIntensity={beatIntensity}
        />
      </div>

      {/* [slot: hero] Counter — CountUpNumber primitive. The primitive
          provides its own positioned wrapper (the same one chart-counter used
          inline pre-refactor), so we render it bare here. */}
      <CountUpNumber
        progress={progress}
        motionProgress={motionProgress}
        target={targetValue}
        decimalPlaces={decimalPlaces}
        prefix={prefix}
        unit={unit}
        label={label}
        width={width}
        height={height}
        numberColor={numberColor}
        labelColor={labelColor}
        chartColor={chartColor}
        font={font}
        hasMediaShadow={hasMedia}
        beatIntensity={beatIntensity}
        labelFontSize={labelFontSize}
      />

    </div>
  );
};

export const bigNumberTemplate = defineTemplate({
  "id": "bigNumber",
  "label": "Big number",
  "description": "A single animated count-up metric with headline and label.",
  "family": "Data & metrics",
  "jobs": [
    "claim",
    "proof"
  ],
  "register": "typography-led",
  "useWhen": "One exact grounded number is the hero: growth, speed, rank, customer count, or reduction.",
  "avoidWhen": "No exact number is supplied, three peer values matter equally, or the value means completion progress.",
  "usesGlobalTextEffect": false,
  "usesGlobalTransition": true,
  "transitionTiming": {
    "entryReadyProgress": 0.2,
    "holdProgress": 0.7
  },
  "usesGlobalBackgroundEffect": true,
  "textCanvas": "tight",
  "schema": {
    "type": "object",
    "properties": {
      "texts": {
        "type": "string",
        "title": "Text",
        "description": "Concise title shown above the metric (48 characters maximum).",
        "minLength": 1,
        "maxLength": 48,
        "default": "Our biggest milestone yet."
      },
      "value": {
        "type": "number",
        "title": "Target number",
        "description": "The number to count up to",
        "default": 1000
      },
      "decimalPlaces": {
        "type": "number",
        "title": "Decimal places",
        "description": "Optional display precision; when omitted, precision is inferred from the value"
      },
      "confetti": {
        "type": "boolean",
        "title": "Celebrate with confetti",
        "description": "Add a confetti burst when the metric is explicitly celebratory",
        "default": false
      },
      "label": {
        "type": "string",
        "title": "Label",
        "description": "Short label displayed below the number (32 characters maximum).",
        "minLength": 1,
        "maxLength": 32,
        "default": "Total users"
      },
      "prefix": {
        "type": "string",
        "title": "Prefix",
        "description": "Compact prefix before the number (e.g. $, €; 2 characters maximum).",
        "maxLength": 2,
        "default": ""
      },
      "unit": {
        "type": "string",
        "title": "Unit suffix",
        "description": "Compact suffix after the number (e.g. %, +, k, M; 4 characters maximum).",
        "maxLength": 4,
        "default": ""
      },
      "mediaUrl": {
        "type": "string",
        "title": "Background media",
        "description": "Optional photo or video URL behind this scene. When set, replaces the brand gradient.",
        "format": "uri",
        "default": ""
      },
      "mediaKeyword": {
        "type": "string",
        "title": "Background search keyword",
        "description": "2-4 word English term for Pexels stock-footage search (auto-fills mediaUrl).",
        "format": "stock-media-keyword",
        "default": ""
      },
      "mediaType": {
        "type": "string",
        "title": "Background media type",
        "description": "auto detects photo/video from URL. 'gradient' is a deliberate mode — atmospheric brand-color scene with no stock footage.",
        "enum": [
          "auto",
          "photo",
          "video",
          "gradient"
        ],
        "default": "auto"
      },
      "mediaPoster": {
        "type": "string",
        "title": "Background poster image",
        "description": "Still image URL shown while a video backdrop is decoding its first frame. Auto-filled from Pexels' thumbnail when fillPexelsUrls sets a video mediaUrl. Hides the gradient flash that would otherwise appear in the ~50–400ms gap between a <video> mounting and decoding its first frame.",
        "format": "uri",
        "default": ""
      },
      "mediaPosition": {
        "type": "string",
        "title": "Background focal position",
        "description": "Controls which part of a photo or video stays visible when cover-cropped. Pick the subject's side or vertical anchor after inspecting the frame.",
        "enum": [
          "center",
          "top",
          "bottom",
          "left",
          "right"
        ],
        "default": "center"
      },
      "mediaTreatment": {
        "type": "string",
        "title": "Background contrast treatment",
        "description": "subtle preserves a visual hero; cinematic adds balanced contrast; text-safe adds a stronger wash for copy-heavy scenes.",
        "enum": [
          "subtle",
          "cinematic",
          "text-safe"
        ],
        "default": "cinematic"
      }
    },
    "required": [
      "texts",
      "value",
      "label"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "requiresStat": true,
      "allowsStockMedia": true
    }
  },
  "minDuration": 1.5,
  "preferredDuration": 4,
  "timing": {
    "contentFields": [
      "texts",
      "label"
    ],
    "contentUnit": "words"
  },
  component: ChartCounterTemplate,
});
Object.defineProperty(ChartCounterTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
