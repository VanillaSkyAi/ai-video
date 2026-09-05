import { createRoot } from "react-dom/client";
import { ChartBarTemplate } from "../../../src/visual-system/scene-templates/chart-bar";
import { getDimensions, getSafeZone } from "../../../src/visual-system/layout";
import { TEST_VIDEO_STYLE } from "../../semantic-brand-fixture";

const query = new URLSearchParams(location.search);
const orientation = query.get("orientation") === "landscape" ? "landscape" : "portrait";
const wide = query.get("text") === "wide";
const topic = wide ? "W".repeat(48) : "比較".repeat(24);
const label = wide ? "W".repeat(18) : "比較".repeat(9);
const { width, height } = getDimensions(orientation);

createRoot(document.getElementById("root")!).render(<ChartBarTemplate
  variables={{ texts: topic, bars: Array.from({ length: 6 }, (_, i) => ({ label, value: (i + 1) * 10 })) }}
  style={{ ...TEST_VIDEO_STYLE, brand: { ...TEST_VIDEO_STYLE.brand, background: { type: "solid", color: "#111114" } } }}
  progress={Number(query.get("progress") ?? 0.7)} beatIntensity={0}
  width={width} height={height} safeZone={getSafeZone(orientation)} sceneDuration={4} isPlaying={false}
/>);
