/**
 * chart-bar — exact comparisons with a quiet topic label.
 */
import type { SceneTemplateProps } from "./types";
import { resolveTokens } from "../theme";
import { BarChart, type BarChartDatum } from "../primitives/charts/BarChart";
import { SceneBackground, getMediaBackgroundProps } from "./scene-background";

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

export const ChartBarTemplate: React.FC<SceneTemplateProps> = ({
  variables,
  style,
  progress,
  beatIntensity,
  width,
  height,
  safeZone,
  sceneDuration,
  backgroundEffect,
  isPlaying = true,
}) => {
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
        safeZone={safeZone}
        topic={textsRaw}
      />

    </div>
  );
};
