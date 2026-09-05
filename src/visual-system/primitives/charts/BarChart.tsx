/** A quiet, zero-baseline comparison. Values are exact throughout the reveal. */
import type { SafeZone } from "../../template-context";
import { fitTextSize } from "../../typography";

export interface BarChartDatum {
  label: string;
  value: number;
}

export interface BarChartProps {
  progress: number;
  width: number;
  height: number;
  /** Labeled values. At most six are rendered to preserve readability. */
  data: readonly BarChartDatum[];
  /** Solid bar fill. */
  chartColor?: string;
  /** Value and category label color. */
  textColor?: string;
  /** Retained for callers; beats never change data geometry. */
  beatIntensity?: number;
  safeZone?: SafeZone;
  /** Short topic above the comparison, distinct from narration and captions. */
  topic?: string;
}

const MAX_BAR_ITEMS = 6;

export const BarChart: React.FC<BarChartProps> = ({
  progress,
  data,
  width,
  height,
  chartColor = "#ffffff",
  textColor = "#ffffff",
  safeZone = { top: 0, right: 0, bottom: 0, left: 0 },
  topic,
}) => {
  const values = data.filter(({ value }) => Number.isFinite(value)).slice(0, MAX_BAR_ITEMS);
  const s = Math.min(width, height) / 1080;
  const left = Math.max(safeZone.left, 80 * s);
  const right = Math.max(safeZone.right, 80 * s);
  const chartWidth = Math.max(0, Math.min(width - left - right, 1260 * s));
  // The topic has its own top band; captions have a separate bottom band.
  const contentTop = Math.max(safeZone.top, 64 * s) + 156 * s;
  const contentBottom = height - Math.max(safeZone.bottom, height * 0.18) - 48 * s;
  const availableHeight = Math.max(0, contentBottom - contentTop);
  const count = Math.max(values.length, 1);
  const gap = Math.min((count <= 2 ? 64 : 30) * s, availableHeight / (count * 4));
  const rowHeight = Math.max(0, Math.min((count <= 2 ? 160 : 120) * s, (availableHeight - gap * (count - 1)) / count));
  const chartHeight = rowHeight * count + gap * (count - 1);
  const barHeight = Math.min((count <= 2 ? 20 : 14) * s, rowHeight * 0.15);
  const labelSize = Math.min(40 * s, rowHeight * 0.42);
  const numberSize = Math.min((count <= 2 ? 84 : 54) * s, rowHeight * 0.56);
  const maxValue = Math.max(0, ...values.map(({ value }) => value)) || 1;
  // All bars share one clock: even during entrance, their ratios stay true.
  const reveal = Math.min(1, Math.max(0, (progress - 0.04) / 0.28));
  const easedReveal = 1 - Math.pow(1 - reveal, 3);

  return (
    <div
      role="img"
      aria-label={[topic, values.map(({ label, value }) => `${label || "Value"}: ${String(value)}`).join(", ")].filter(Boolean).join(". ")}
      data-bar-chart="true"
      style={{
        position: "absolute",
        left: left + Math.max(0, (width - left - right - chartWidth) / 2),
        top: contentTop + (availableHeight - chartHeight) / 2,
        width: chartWidth,
        height: chartHeight,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {topic && (
        <div
          data-bar-chart-topic="true"
          style={{
            position: "absolute", top: -120 * s, left: 0, width: "100%",
            color: textColor,
            fontSize: fitTextSize(topic, 40 * s, chartWidth, { minScale: 0.7, charWidthRatio: 1 }),
            fontWeight: 500, lineHeight: 1.3,
            overflowWrap: "anywhere", opacity: 1,
          }}
        >
          {topic}
        </div>
      )}
      {values.map(({ label, value }, index) => {
        const exactValue = String(value);
        // Reserve enough horizontal room for long exact numbers; never round data.
        const valueFontSize = Math.min(numberSize, chartWidth * 0.42 / Math.max(1, exactValue.length * 0.64));
        return (
          <div
            key={`${label}-${index}`}
            data-bar-chart-item="true"
            style={{ height: rowHeight, flexShrink: 0, minWidth: 0, position: "relative" }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 * s, opacity: easedReveal }}>
              <div
                data-bar-chart-label="true"
                style={{
                  color: textColor,
                  fontSize: fitTextSize(label, labelSize, chartWidth * 0.55, { minScale: 0.75, charWidthRatio: 1 }),
                  lineHeight: 1.25,
                  fontWeight: 500,
                  maxWidth: "55%",
                  overflowWrap: "anywhere",
                }}
              >
                {label}
              </div>
              <div
                data-bar-chart-value="true"
                style={{
                  color: textColor,
                  fontSize: valueFontSize,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: "-0.045em",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {exactValue}
              </div>
            </div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: barHeight }}>
              <div
                data-bar-chart-fill="true"
                style={{
                  width: `${Math.max(0, value) / maxValue * 100}%`,
                  height: "100%",
                  backgroundColor: chartColor,
                  borderRadius: 3 * s,
                  transform: `scaleX(${easedReveal})`,
                  transformOrigin: "left center",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
