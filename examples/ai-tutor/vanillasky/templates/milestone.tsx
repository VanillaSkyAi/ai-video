import { defineTemplate } from "@vanillaskyai/video/templates";

/**
 * social-milestone — follower/subscriber count rolling up to a milestone with celebration.
 *
 * Converted from Remotion FollowerMilestone. Counter rolls up to target number,
 * glow intensifies, then confetti burst + celebration badge pop on hit.
 *
 * Block structure (docs/blocks.md):
 *   background — SceneBackground (brand gradient / Pexels media + scrims)
 *   hero       — MilestoneBadge primitive (rolling number + glow + confetti
 *                + celebration pill)
 *   caption    — the uppercase label inside MilestoneBadge (no TemplateText)
 */
import type { SceneTemplateProps } from "../scene-templates/types";
import { resolveTokens } from "../theme";
import { SceneBackground, getMediaBackgroundProps } from "../scene-templates/scene-background";
import { stripPipe } from "../typography";
import { MilestoneBadge } from "../primitives/social/MilestoneBadge";

export const SocialMilestoneTemplate = ({
  variables,
  style,
  progress,
  beatIntensity,
  width,
  height,
  sceneDuration,
  isPlaying = true,
  backgroundEffect,
}: SceneTemplateProps) => {
  // Use the canonical semantic accent token.
  const { primary, secondary, foreground, surfaceElevated, font } = resolveTokens(style);

  const label = stripPipe(String(variables.label || "Followers"));
  const gradSeed = label.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  const targetNumber = Number(variables.targetNumber) || 10000;
  const rawStart = variables.startNumber != null ? Number(variables.startNumber) : undefined;
  const badgeText = stripPipe(String(variables.badgeText || ""));
  const badgeEmoji = String(variables.badgeEmoji || "🎉");

  // Media-mode legibility: when a Pexels photo/video is behind, MilestoneBadge
  // forces the label to full white and stacks a stronger drop-shadow on
  // number + label so they punch through busy footage. SceneBackground
  // already adds a vignette + bottom scrim. Mirrors bigNumber's treatment.
  const hasMedia = !!String(variables.mediaUrl || "").trim() &&
    String(variables.mediaType || "auto") !== "gradient";

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "var(--vanillasky-template-surface, #000)",
        position: "relative",
        overflow: "hidden",
        fontFamily: font,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* [slot: background] Gradient background — supports Pexels media when mediaUrl is set */}
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
      {/* [slot: hero] Rolling counter + label + confetti + celebration pill —
          shared primitive (owns the milestone timing windows) */}
      <MilestoneBadge
        progress={progress}
        width={width}
        height={height}
        targetNumber={targetNumber}
        label={label}
        startNumber={rawStart}
        badgeText={badgeText}
        badgeEmoji={badgeEmoji}
        accent={primary}
        hasMedia={hasMedia}
        foreground={foreground}
        surfaceElevated={surfaceElevated}
        beatIntensity={beatIntensity}
        confettiBgColor={secondary}
      />
    </div>
  );
};

export const milestoneTemplate = defineTemplate({
  "id": "milestone",
  "label": "Milestone",
  "description": "A large count-up achievement with an optional celebratory badge.",
  "family": "Data & metrics",
  "jobs": [
    "proof",
    "payoff"
  ],
  "register": "typography-led",
  "useWhen": "An exact grounded achievement count marks users, revenue, years, installs, customers, or adoption.",
  "avoidWhen": "The value is a release number, price, unbounded percentage, or not an achievement count.",
  "usesGlobalTextEffect": false,
  "usesGlobalTransition": false,
  "usesGlobalBackgroundEffect": false,
  "textCanvas": "open",
  "schema": {
    "type": "object",
    "properties": {
      "label": {
        "type": "string",
        "title": "Label",
        "description": "Short label above the number (e.g. Followers, Subscribers, Downloads; 32 characters maximum).",
        "minLength": 1,
        "maxLength": 32,
        "default": "Followers"
      },
      "targetNumber": {
        "type": "number",
        "title": "Target number",
        "description": "The milestone number to reach",
        "default": 10000
      },
      "startNumber": {
        "type": "number",
        "title": "Start number",
        "description": "Number the counter starts rolling from. Defaults to 0.",
        "default": 0
      },
      "badgeText": {
        "type": "string",
        "title": "Badge text",
        "description": "Concise celebration badge text that pops in at the milestone (32 characters maximum).",
        "maxLength": 32,
        "examples": [
          "10K Followers!"
        ],
        "default": ""
      },
      "badgeEmoji": {
        "type": "string",
        "title": "Badge emoji",
        "description": "Emoji shown in the celebration badge",
        "format": "emoji",
        "maxLength": 16,
        "default": "🎉"
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
      "label",
      "targetNumber"
    ],
    "additionalProperties": false,
    "x-vanillasky": {
      "requiresStat": true,
      "allowsStockMedia": true
    }
  },
  "minDuration": 2.5,
  "preferredDuration": 4,
  "timing": {
    "contentFields": [
      "label",
      "badgeText"
    ],
    "contentUnit": "words"
  },
  component: SocialMilestoneTemplate,
});
Object.defineProperty(SocialMilestoneTemplate, "__vanillaskyExternalVideoBackdrop", { value: true });
