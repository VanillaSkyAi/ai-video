import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * bg-media template — atmospheric scene backed by a photo, video, or
 * brand-color gradient. Title sits centered over the backdrop.
 *
 * The "media template" identity is just a positioning convention: title
 * is centered, full-frame, and there's no other UI competing for the
 * stage. The backdrop logic itself lives in SceneBackground, getMediaBackgroundProps, which any
 * template can compose to opt into media support.
 *
 * mediaType modes:
 *   - "auto" (default) — detect photo/video from URL extension (.mp4/.webm/.mov = video)
 *   - "photo"          — force CSS background-image
 *   - "video"          — force <video> element with playback sync
 *   - "gradient"       — deliberate atmospheric brand-color scene; mediaUrl ignored
 */
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { TemplateText } from "../scene-templates/template-text";
import type { TextArchetype } from "../typography";
import { SceneBackground, getMediaBackgroundProps, hasSceneMedia } from "../scene-templates/scene-background";
import { ConfettiLayer } from "../scene-templates/confetti-layer";

// ─── Component ──────────────────────────────────────────────────

export const BgMediaTemplate = ({
  variables,
  style,
  progress,
  motionProgress = progress,
  beatIntensity,
  width,
  height,
  textArchetype,
  backgroundEffect,
  safeZone,
  sceneDuration,
  isPlaying = true,
}: SceneTemplateProps) => {
  const { font, foreground, background } = resolveTokens(style);
  const text = foreground;

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
      {/* [slot: background] */}
      <SceneBackground
        style={style}
        progress={progress}
        sceneDuration={sceneDuration}
        width={width}
        height={height}
        {...getMediaBackgroundProps(variables)}
        // Title is centered and full-frame, so the lower-third scrim would
        // darken picture no type ever touches. Scrim the middle only.
        textAnchor="center"
        backgroundEffect={backgroundEffect}
        seed={String(variables.texts || "")}
        isPlaying={isPlaying}
        beatIntensity={beatIntensity}
      />

      {/* [slot: badge] Optional celebration layer on top of the backdrop.
          Toggle via the `confetti` variable. Hue-filtered against the brand
          gradient when no media is set; full palette over photos/videos. */}
      {variables.confetti === true && (
        <ConfettiLayer
          progress={motionProgress}
          width={width}
          height={height}
          beatIntensity={beatIntensity}
          bgColor={String(variables.mediaUrl || "").trim() === ""
            ? (background.type === "solid" ? background.color : background.colors[1])
            : undefined}
        />
      )}

      {/* [slot: caption] Centered title — bg-media's distinguishing positioning.
          `|` = hard line break; the conversion is centralized in
          TemplateText so every texts-canvas template honors it. */}
      <TemplateText
        overMedia={hasSceneMedia(variables)}
        motionProgress={motionProgress}
        typeTreatment={resolveTokens(style).preset.type}
        archetype={(textArchetype as TextArchetype) ?? "subtle"}
        text={String(variables.texts ?? "")}
        progress={progress}
        sceneDuration={sceneDuration ?? 3}
        width={width}
        height={height}
        position="center"
        sizeRole="headline"
        safeZone={safeZone}
        font={font}
        color={text}
        beatIntensity={beatIntensity}
      />
    </div>
  );
};

export const mediaTemplate = defineTemplate({
  "id": "media",
  "label": "Full-bleed media",
  "description": "Full-bleed photo, video, or brand gradient with a centered headline.",
  "family": "Media & motion",
  "jobs": [
    "setup",
    "atmosphere",
    "payoff"
  ],
  "register": "motion-led",
  "useWhen": "A visual hook, scenic beat, or concrete product-context line benefits from immersive media.",
  "avoidWhen": "The scene needs structured facts, exact comparisons, a device frame, or attributed proof.",
  "usesGlobalTextEffect": true,
  "usesGlobalTransition": true,
  "transitionTiming": {
    "entryReadyProgress": 0.2,
    "holdProgress": 0.7
  },
  "usesGlobalBackgroundEffect": true,
  "textCanvas": "open",
  "schema": {
    "type": "object",
    "properties": {
      "texts": {
        "type": "string",
        "title": "Text",
        "description": "Title text shown on the scene",
        "default": "Make an impact."
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
      },
      "confetti": {
        "type": "boolean",
        "title": "Confetti",
        "description": "Layer falling confetti particles over the backdrop. Set true when the copy is celebratory (launch, milestone, win, anniversary, achievement). Works on top of any mediaType — photo, video, or gradient.",
        "default": false
      }
    },
    "required": [
      "texts"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "allowsStockMedia": true
    }
  },
  "minDuration": 1,
  "preferredDuration": 2,
  "timing": {
    "contentFields": [
      "texts"
    ],
    "contentUnit": "words"
  },
  component: BgMediaTemplate,
});
Object.defineProperty(BgMediaTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
