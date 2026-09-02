import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * problemSolution — a two-phase pain-to-fix story.
 *
 * The template only composes the scene slots. ProblemSolution owns the
 * complete pill, statement, transition, and celebration lifecycle so the
 * same hero can be used by built-in and custom scenes without drift.
 */

import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { ProblemSolution } from "../primitives/infographic/ProblemSolution";
import { SceneBackground, getMediaBackgroundProps } from "../scene-templates/scene-background";

export const InfographicProblemSolutionTemplate = ({
  variables,
  style,
  progress,
  beatIntensity,
  width,
  height,
  sceneDuration,
  backgroundEffect,
  isPlaying = true,
}: SceneTemplateProps) => {
  const { foreground, font } = resolveTokens(style);
  const textColor = foreground;
  const problemText = String(variables.problemText || "");
  const solutionText = String(variables.solutionText || "");

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
        seed={`${problemText}${solutionText}`}
        isPlaying={isPlaying}
        beatIntensity={beatIntensity}
      />

      {/* [slot: hero] */}
      <ProblemSolution
        progress={progress}
        width={width}
        height={height}
        problemLabel={String(variables.problemLabel || "THE PROBLEM")}
        problemText={problemText}
        solutionLabel={String(variables.solutionLabel || "THE SOLUTION")}
        solutionText={solutionText}
        textColor={textColor}
        font={font}
        beatIntensity={beatIntensity}
      />
    </div>
  );
};

export const problemSolutionTemplate = defineTemplate({
  "id": "problemSolution",
  "label": "Problem and solution",
  "description": "A problem card transitions into a paired solution card.",
  "family": "Explainers",
  "jobs": [
    "setup",
    "proof"
  ],
  "register": "card-led",
  "useWhen": "The story contains one crisp, literal pain statement and one corresponding solution statement.",
  "avoidWhen": "The source is a broad announcement or lacks a specific pain-and-fix pair.",
  "usesGlobalTextEffect": false,
  "usesGlobalTransition": false,
  "usesGlobalBackgroundEffect": true,
  "textCanvas": "open",
  "schema": {
    "type": "object",
    "properties": {
      "problemLabel": {
        "type": "string",
        "title": "Problem label",
        "description": "Short uppercase label shown above the problem text (16 characters maximum).",
        "maxLength": 16,
        "default": "THE PROBLEM"
      },
      "problemText": {
        "type": "string",
        "title": "Problem",
        "description": "The problem statement — keep it punchy, 1 sentence",
        "default": "Teams waste 40% of time in meetings"
      },
      "solutionLabel": {
        "type": "string",
        "title": "Solution label",
        "description": "Short uppercase label shown above the solution text (16 characters maximum).",
        "maxLength": 16,
        "default": "THE SOLUTION"
      },
      "solutionText": {
        "type": "string",
        "title": "Solution",
        "description": "The solution statement — your value prop in 1 sentence",
        "default": "AI that summarizes in seconds"
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
      "problemText",
      "solutionText"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "allowsStockMedia": true
    }
  },
  "minDuration": 3,
  "preferredDuration": 5.5,
  "timing": {
    "contentFields": [
      "problemText",
      "solutionText"
    ],
    "contentUnit": "words"
  },
  component: InfographicProblemSolutionTemplate,
});
Object.defineProperty(InfographicProblemSolutionTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
