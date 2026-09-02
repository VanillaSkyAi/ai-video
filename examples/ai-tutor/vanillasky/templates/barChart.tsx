import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * chart-bar — animated labeled values with a headline.
 */
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { TemplateText } from "../scene-templates/template-text";
import { TOP_TEXT_AREA_RATIO } from "../backgrounds";
import { BarChart, type BarChartDatum } from "../primitives/charts/BarChart";
import { SceneBackground, getMediaBackgroundProps, hasSceneMedia } from "../scene-templates/scene-background";

function parseBarDatum(value: unknown): BarChartDatum | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { label: "", value } : undefined;
  }
  if (typeof value === "object" && value !== null) {
    const datum = value as Record<string, unknown>;
    const numberValue = Number(datum.value);
    if (!Number.isFinite(numberValue)) return undefined;
    return { label: String(datum.label ?? "").trim(), value: numberValue };
  }
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const separator = trimmed.lastIndexOf(":");
  const label = separator >= 0 ? trimmed.slice(0, separator).trim() : "";
  const numberValue = Number(separator >= 0 ? trimmed.slice(separator + 1).trim() : trimmed);
  return Number.isFinite(numberValue) ? { label, value: numberValue } : undefined;
}

function parseBarData(value: unknown): BarChartDatum[] {
  let items: unknown[];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      items = Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      items = trimmed.split(",");
    }
  } else {
    items = [value];
  }
  return items.map(parseBarDatum).filter((datum): datum is BarChartDatum => datum !== undefined);
}

export const ChartBarTemplate = ({
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
  const { primary, foreground, font } = resolveTokens(style);
  const chartColor = primary;
  const textColor = foreground;
  const textsRaw = String(variables.texts || "");

  // Structured labeled data is canonical; numeric and Label:value strings
  // remain accepted for already-generated customer templates.
  const data = parseBarData(variables.bars);

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

      {/* [slot: hero] */}
      <BarChart
        progress={progress}
        data={data}
        width={width}
        height={height}
        chartColor={chartColor}
        textColor={textColor}
        beatIntensity={beatIntensity}
      />

      {/* [slot: caption] */}
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
    </div>
  );
};

export const barChartTemplate = defineTemplate({
  "id": "barChart",
  "label": "Bar chart",
  "description": "Animated labeled bars compare grounded values beneath a headline.",
  "family": "Data & metrics",
  "jobs": [
    "proof"
  ],
  "register": "motion-led",
  "useWhen": "Two or more grounded labeled values need a readable comparison, ranking, or relative-size view.",
  "avoidWhen": "Labels or exact values are missing, one metric is the hero, or the data represents progress toward a whole.",
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
        "description": "Title text shown above the chart",
        "default": "Revenue up 300%."
      },
      "bars": {
        "type": "array",
        "title": "Comparison values",
        "description": "Array of 2-6 grounded values with short category labels. Values are shown exactly and bar heights are scaled relative to the largest value. Use only facts supported by the input.",
        "examples": [
          [
            {
              "label": "Free",
              "value": 24
            },
            {
              "label": "Pro",
              "value": 61
            },
            {
              "label": "Business",
              "value": 88
            }
          ]
        ],
        "items": {
          "type": "object",
          "properties": {
            "label": {
              "type": "string",
              "description": "Short category label shown below the bar (18 characters or fewer).",
              "maxLength": 18
            },
            "value": {
              "type": "number",
              "description": "Exact grounded value shown above the bar.",
              "format": "grounded-stat",
              "minimum": 0
            }
          },
          "required": [
            "label",
            "value"
          ],
          "additionalProperties": false
        },
        "minItems": 2,
        "maxItems": 6,
        "default": [
          {
            "label": "Q1",
            "value": 42
          },
          {
            "label": "Q2",
            "value": 58
          },
          {
            "label": "Q3",
            "value": 76
          },
          {
            "label": "Q4",
            "value": 91
          }
        ]
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
      "bars"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "requiresStat": true,
      "allowsStockMedia": true
    }
  },
  "minDuration": 2,
  "preferredDuration": 4,
  "timing": {
    "contentFields": [
      "bars"
    ],
    "contentUnit": "items"
  },
  component: ChartBarTemplate,
});
Object.defineProperty(ChartBarTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
