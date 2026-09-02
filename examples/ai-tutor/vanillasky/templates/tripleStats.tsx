import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * infographic-stat-row — 3 big stats side by side (portrait: stacked).
 *
 * Each stat has a large number, a short label below, and an optional
 * prefix/unit. Numbers count up from 0. Stats stagger in with bouncy
 * spring. TextOverlay title on top.
 */

import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { TemplateText } from "../scene-templates/template-text";
import { StatBadgeRow } from "../primitives/typography/StatBadgeRow";
import { SceneBackground, getMediaBackgroundProps, hasSceneMedia } from "../scene-templates/scene-background";

export const InfographicStatRowTemplate = ({
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
  const textsRaw = String(variables.texts || "");

  const stats = [
    { value: String(variables.stat1Value || ""), label: String(variables.stat1Label || "") },
    { value: String(variables.stat2Value || ""), label: String(variables.stat2Label || "") },
    { value: String(variables.stat3Value || ""), label: String(variables.stat3Label || "") },
  ];

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
        backgroundEffect={backgroundEffect}
        seed={textsRaw}
        isPlaying={isPlaying}
        beatIntensity={beatIntensity}
      />

      {/* [slot: caption] */}
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

      {/* [slot: hero] */}
      <StatBadgeRow
        progress={motionProgress}
        stats={stats}
        width={width}
        height={height}
        font={font}
        textColor={textColor}
      />
    </div>
  );
};

export const tripleStatsTemplate = defineTemplate({
  "id": "tripleStats",
  "label": "Triple stats",
  "description": "Exactly three peer values and labels appear as a balanced metric row.",
  "family": "Data & metrics",
  "jobs": [
    "claim",
    "proof"
  ],
  "register": "typography-led",
  "useWhen": "Exactly three grounded peer metrics or compact specs carry comparable importance.",
  "avoidWhen": "One value is the hero, the values are not comparable, or fewer than three grounded facts exist.",
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
        "description": "Concise title above the three metrics (48 characters maximum).",
        "minLength": 1,
        "maxLength": 48,
        "default": "By the numbers."
      },
      "stat1Value": {
        "type": "string",
        "title": "Stat 1 value",
        "description": "First compact stat value (e.g. 10K, 99.9%, $2M; 12 characters maximum).",
        "minLength": 1,
        "maxLength": 12,
        "default": "10K"
      },
      "stat1Label": {
        "type": "string",
        "title": "Stat 1 label",
        "description": "Short label below the first number (24 characters maximum).",
        "minLength": 1,
        "maxLength": 24,
        "default": "Users"
      },
      "stat2Value": {
        "type": "string",
        "title": "Stat 2 value",
        "description": "Second compact stat value (12 characters maximum).",
        "minLength": 1,
        "maxLength": 12,
        "default": "99.9%"
      },
      "stat2Label": {
        "type": "string",
        "title": "Stat 2 label",
        "description": "Short label below the second number (24 characters maximum).",
        "minLength": 1,
        "maxLength": 24,
        "default": "Uptime"
      },
      "stat3Value": {
        "type": "string",
        "title": "Stat 3 value",
        "description": "Third compact stat value (12 characters maximum).",
        "minLength": 1,
        "maxLength": 12,
        "default": "<50ms"
      },
      "stat3Label": {
        "type": "string",
        "title": "Stat 3 label",
        "description": "Short label below the third number (24 characters maximum).",
        "minLength": 1,
        "maxLength": 24,
        "default": "Latency"
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
      "stat1Value",
      "stat1Label",
      "stat2Value",
      "stat2Label",
      "stat3Value",
      "stat3Label"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "requiresStat": true,
      "allowsStockMedia": true
    }
  },
  "minDuration": 2,
  "preferredDuration": 3,
  "timing": {
    "contentFields": [
      "texts",
      "stat1Label",
      "stat2Label",
      "stat3Label"
    ],
    "contentUnit": "words"
  },
  component: InfographicStatRowTemplate,
});
Object.defineProperty(InfographicStatRowTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
