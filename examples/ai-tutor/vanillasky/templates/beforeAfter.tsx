import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * infographic-before-after — emoji-driven before/after contrast.
 *
 * Layout: a centered "BEFORE" / "AFTER" pill label sits above the
 * centered headline text; emojis distribute across the FULL frame
 * around the central text zone (top band, sides, bottom band). Pill
 * styling matches problemSolution — same shape, scale-pop entry, just
 * BEFORE/AFTER wording with a red→green color shift.
 *
 * Two phases on a brand-color gradient:
 *  1. Before phase: red BEFORE pill + problem headline + scattered
 *     problem emojis with chaos jitter.
 *  2. Transition: problem emojis fall off-screen with gravity (confetti-
 *     style drop) while the pill + headline crossfade.
 *  3. After phase: green AFTER pill + solution headline + solution
 *     emojis pop in with a happy bounce in the same slots.
 *
 * Pick this for symbolic before/after content where the emojis tell the
 * story; `problemSolution` for full-statement text contrast.
 *
 * Block structure (docs/blocks.md):
 *   background — brand gradient (gradientBackground)
 *   hero       — BeforeAfterSplit primitive (both phases: pills, headlines,
 *                emoji scatter/fall/pop — text integral, no caption slot)
 */

import { parseList } from "../parse-list";
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { gradientBackground } from "../backgrounds";
import { BeforeAfterSplit } from "../primitives/infographic/BeforeAfterSplit";

export const InfographicBeforeAfterTemplate = ({
  variables,
  style,
  progress,
  beatIntensity,
  width,
  height,
  textArchetype,
  safeZone,
  sceneDuration,
}: SceneTemplateProps) => {
  const { background, foreground, font } = resolveTokens(style);
  const textColor = foreground;

  const problemHeadline = String(variables.problemHeadline || "");
  const solutionHeadline = String(variables.solutionHeadline || "");
  const problemTypes = parseList(variables.problemEmojis);
  const solutionTypes = parseList(variables.solutionEmojis);
  const showEmojis = variables.showEmojis !== false && String(variables.showEmojis ?? "true").toLowerCase() !== "false";

  const gradSeed = (problemHeadline + solutionHeadline)
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);

  // textArchetype is intentionally unused — this template uses the
  // problemSolution-style direct text rendering instead of TemplateText.
  void textArchetype;
  void safeZone;

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
      {/* [slot: background] Brand-color gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: gradientBackground({
            colorA: background.type === "solid" ? background.color : background.colors[0],
            colorB: background.type === "solid" ? background.color : background.colors[1],
            solidBg: background.type === "solid" ? background.color : undefined,
            progress,
            sceneDuration,
            seed: gradSeed,
            family: resolveTokens(style).preset.background,
          }),
          pointerEvents: "none",
        }}
      />

      {/* [slot: hero] Two-phase before/after reveal — shared primitive */}
      <BeforeAfterSplit
        progress={progress}
        width={width}
        height={height}
        problemHeadline={problemHeadline}
        solutionHeadline={solutionHeadline}
        problemEmojis={problemTypes}
        solutionEmojis={solutionTypes}
        showEmojis={showEmojis}
        beforeLabel={String(variables.problemLabel || "")}
        afterLabel={String(variables.solutionLabel || "")}
        textColor={textColor}
        font={font}
        beatIntensity={beatIntensity}
      />
    </div>
  );
};

export const beforeAfterTemplate = defineTemplate({
  "id": "beforeAfter",
  "label": "Before and after",
  "description": "Two contrasting states trade places in a split transformation layout.",
  "family": "Explainers",
  "jobs": [
    "setup",
    "proof"
  ],
  "register": "motion-led",
  "useWhen": "A grounded transformation contrasts an old and new state, manual and automated, or chaos and order.",
  "avoidWhen": "The source lacks two distinct states or the comparison depends on exact labeled quantities.",
  "usesGlobalTextEffect": true,
  "usesGlobalTransition": false,
  "usesGlobalBackgroundEffect": false,
  "textCanvas": "open",
  "schema": {
    "type": "object",
    "properties": {
      "problemLabel": {
        "type": "string",
        "title": "Before label",
        "description": "Short uppercase pill label shown above the before headline (12 characters maximum).",
        "maxLength": 12,
        "default": "BEFORE"
      },
      "problemHeadline": {
        "type": "string",
        "title": "Before headline",
        "description": "Headline shown during the before phase. Use 2-5 words and at most 48 characters. Sits centered beneath the BEFORE pill.",
        "minLength": 1,
        "maxLength": 48,
        "default": "Your calendar today."
      },
      "solutionLabel": {
        "type": "string",
        "title": "After label",
        "description": "Short uppercase pill label shown above the after headline (12 characters maximum).",
        "maxLength": 12,
        "default": "AFTER"
      },
      "solutionHeadline": {
        "type": "string",
        "title": "After headline",
        "description": "Headline shown during the after phase. Use 2-5 words and at most 48 characters. Sits centered beneath the AFTER pill.",
        "minLength": 1,
        "maxLength": 48,
        "default": "Calmly organized."
      },
      "problemEmojis": {
        "type": "array",
        "title": "Before emojis",
        "description": "JSON array of emojis for the chaos / before state (5-8 types, cycled to fill 16 slots distributed around the central text). Example: [\"📅\", \"😰\", \"💼\", \"📊\", \"⏰\", \"💬\", \"📞\", \"🔔\"]",
        "items": {
          "type": "string",
          "format": "emoji",
          "minLength": 1,
          "maxLength": 16
        },
        "minItems": 5,
        "maxItems": 8,
        "default": [
          "📅",
          "😰",
          "💼",
          "📊",
          "⏰",
          "💬",
          "📞",
          "🔔"
        ]
      },
      "solutionEmojis": {
        "type": "array",
        "title": "After emojis",
        "description": "JSON array of emojis for the calm / after state (3-5 types, cycled to fill 16 slots distributed around the central text). Example: [\"✨\", \"📋\", \"✅\", \"🎯\"]",
        "items": {
          "type": "string",
          "format": "emoji",
          "minLength": 1,
          "maxLength": 16
        },
        "minItems": 3,
        "maxItems": 5,
        "default": [
          "✨",
          "📋",
          "✅",
          "🎯"
        ]
      },
      "showEmojis": {
        "type": "boolean",
        "title": "Show decorative emojis",
        "description": "Show the animated emoji scatter. Disable for sober financial or editorial comparisons.",
        "default": true
      }
    },
    "required": [
      "problemHeadline",
      "solutionHeadline",
      "problemEmojis",
      "solutionEmojis"
    ],
    "additionalProperties": false
  },
  "minDuration": 3,
  "preferredDuration": 4.5,
  "timing": {
    "contentFields": [
      "problemHeadline",
      "solutionHeadline"
    ],
    "contentUnit": "words"
  },
  component: InfographicBeforeAfterTemplate,
});
