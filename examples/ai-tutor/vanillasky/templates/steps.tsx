import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * infographic-steps — vertical step-by-step process visualization.
 *
 * Two or three steps form a connected vertical timeline in portrait or a
 * horizontal row in landscape. Animation: the connector draws in reading order,
 * the circles pop in together, and the editable labels follow. Exit cascade
 * slides each step left and fades in reading order.
 *
 * Block structure (docs/blocks.md):
 *   background — brand atmosphere or supplied/stock media (SceneBackground)
 *   caption    — TemplateText headline in the top text area (subtle archetype)
 *   hero       — StepsList primitive (timeline + labels + cascade exit)
 */

import { parseList } from "../parse-list";
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { TemplateText } from "../scene-templates/template-text";
import { StepsList } from "../primitives/infographic/StepsList";
import { SceneBackground, getMediaBackgroundProps, hasSceneMedia } from "../scene-templates/scene-background";

export const InfographicStepsTemplate = ({
  variables,
  style,
  progress,
  motionProgress = progress,
  beatIntensity,
  width,
  height,
  textArchetype,
  safeZone,
  sceneDuration,
  backgroundEffect,
  isPlaying,
}: SceneTemplateProps) => {
  const { primary, foreground, font } = resolveTokens(style);
  const textColor = foreground;
  const textsRaw = String(variables.texts || "");

  const stepLabels = parseList(variables.steps, 3);
  const stepEmojis = parseList(variables.stepEmojis, 3);

  // textArchetype is intentionally unused — the headline always uses the
  // subtle archetype so the step cascade carries the motion.
  void textArchetype;

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
      {/* [slot: background] Brand atmosphere or cinematic supplied/stock media. */}
      <SceneBackground
        style={style}
        progress={progress}
        sceneDuration={sceneDuration}
        width={width}
        height={height}
        {...getMediaBackgroundProps(variables)}
        backgroundEffect={backgroundEffect}
        seed={textsRaw}
        isPlaying={isPlaying}
        beatIntensity={beatIntensity}
      />

      {/* [slot: caption] Headline — top text area */}
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

      {/* [slot: hero] Step circles + titles — shared primitive */}
      <StepsList
        progress={motionProgress}
        width={width}
        height={height}
        steps={stepLabels.map((title) => ({ title }))}
        stepEmojis={stepEmojis}
        accent={primary}
        textColor={textColor}
        font={font}
        beatIntensity={beatIntensity}
        safeZone={safeZone}
      />
    </div>
  );
};

export const stepsTemplate = defineTemplate({
  "id": "steps",
  "label": "Steps",
  "description": "Two or three ordered workflow steps reveal as a vertical sequence.",
  "family": "Explainers",
  "jobs": [
    "setup",
    "proof"
  ],
  "register": "card-led",
  "useWhen": "Two or three grounded actions form a real sequence, workflow, or how-it-works explanation.",
  "avoidWhen": "Order does not matter, fewer than two steps exist, or the content is a parallel feature list.",
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
        "default": "How it works.",
        "maxLength": 48
      },
      "steps": {
        "type": "array",
        "title": "Steps",
        "description": "JSON array of 2 or 3 step labels. Send only the steps the evidence supports — never pad the sequence to reach three. Keep each label to 1-2 words and at most 18 characters. Send as an array so labels with internal punctuation render correctly. Example: [\"Capture\", \"Detect\", \"Notify\"]",
        "items": {
          "type": "string"
        },
        "minItems": 2,
        "maxItems": 3,
        "default": [
          "Describe",
          "Preview",
          "Export"
        ]
      },
      "stepEmojis": {
        "type": "array",
        "title": "Step emojis",
        "description": "JSON array of emojis, one per step (optional). Leave empty for numbered circles. Example: [\"✍️\", \"👀\", \"🚀\"]",
        "examples": [
          [
            "✍️",
            "👀",
            "🚀"
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
        "description": "none leaves the picture untouched, for a scene carrying no type; subtle preserves a visual hero; cinematic adds balanced contrast; text-safe adds a stronger wash for copy-heavy scenes.",
        "enum": [
          "none",
          "subtle",
          "cinematic",
          "text-safe"
        ],
        "default": "cinematic"
      }
    },
    "required": [
      "texts",
      "steps"
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
      "steps"
    ],
    "contentUnit": "items"
  },
  component: InfographicStepsTemplate,
});
Object.defineProperty(InfographicStepsTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
