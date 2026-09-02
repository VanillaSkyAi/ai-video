import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * cardList — headline plus reusable feature-card hero.
 *
 * FeatureList owns orientation, two- or three-card layout, emoji rendering,
 * and exit behavior. This template supplies only the background and caption.
 */

import { parseList } from "../parse-list";
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { TemplateText } from "../scene-templates/template-text";
import { FeatureList } from "../primitives/infographic/FeatureList";
import { SceneBackground, getMediaBackgroundProps, hasSceneMedia } from "../scene-templates/scene-background";

export const InfographicFeatureListTemplate = ({
  variables,
  style,
  progress,
  motionProgress = progress,
  beatIntensity,
  width,
  height,
  safeZone,
  sceneDuration,
  backgroundEffect,
  isPlaying = true,
}: SceneTemplateProps) => {
  const { foreground, font } = resolveTokens(style);
  const textColor = foreground;
  const text = String(variables.texts || "");
  const labels = parseList(variables.items, 3);
  const emojis = parseList(variables.itemEmojis);
  const features = labels.map((title, index) => ({ title, icon: emojis[index] || "✦" }));

  return (
    <div style={{ width, height, backgroundColor: "var(--vanillasky-template-surface, #000)", position: "relative", overflow: "hidden", fontFamily: font }}>
      {/* [slot: background] */}
      <SceneBackground
        style={style}
        progress={progress}
        sceneDuration={sceneDuration}
        width={width}
        height={height}
        {...getMediaBackgroundProps(variables)}
        backgroundEffect={backgroundEffect}
        seed={text}
        isPlaying={isPlaying}
        beatIntensity={beatIntensity}
      />

      {/* [slot: caption] */}
      <TemplateText
        overMedia={hasSceneMedia(variables)}
        motionProgress={motionProgress}
        typeTreatment={resolveTokens(style).preset.type}
        archetype="subtle"
        text={text}
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

      {/* [slot: hero] */}
      <FeatureList
        progress={motionProgress}
        width={width}
        height={height}
        features={features}
        textColor={textColor}
        font={font}
        beatIntensity={beatIntensity}
      />
    </div>
  );
};

export const cardListTemplate = defineTemplate({
  "id": "cardList",
  "label": "Card list",
  "description": "Two or three parallel facts appear as stacked icon cards beneath a headline.",
  "family": "Explainers",
  "jobs": [
    "proof"
  ],
  "register": "card-led",
  "useWhen": "Two or three grounded features, benefits, use cases, integrations, or parallel facts need structure.",
  "avoidWhen": "The facts are sequential, fewer than two exist, or one idea deserves the whole scene.",
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
        "description": "Title text",
        "default": "What you get."
      },
      "items": {
        "type": "array",
        "title": "Features",
        "description": "JSON array of 2 or 3 feature descriptions. Send only the facts the evidence supports — never pad the list to reach three. Items often contain commas, so send an array rather than comma-joined text.",
        "items": {
          "type": "string"
        },
        "minItems": 2,
        "maxItems": 3,
        "default": [
          "Automate your savings on energy bills",
          "Cleaner energy without raising your bill",
          "Same account and service guaranteed"
        ]
      },
      "itemEmojis": {
        "type": "array",
        "title": "Feature emojis",
        "description": "JSON array of emojis, one per feature row (optional). Rows without an emoji fall back to ✦.",
        "examples": [
          [
            "💰",
            "⚡",
            "🔒"
          ]
        ],
        "items": {
          "type": "string"
        },
        "maxItems": 3,
        "default": []
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
      "items"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "allowsStockMedia": true
    }
  },
  "minDuration": 2,
  "preferredDuration": 3.5,
  "timing": {
    "contentFields": [
      "items"
    ],
    "contentUnit": "items"
  },
  component: InfographicFeatureListTemplate,
});
Object.defineProperty(InfographicFeatureListTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
