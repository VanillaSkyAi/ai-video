/**
 * A whole response as text: the line said over the loading screen, then every
 * scene with what it shows and what is said over it.
 *
 * Runs the same endpoint actions the page does, in the same order, against the
 * dev server - so what it prints is what a viewer would hear. Judging a prompt
 * from one scene at a time is how we ended up with an opening line that
 * sharpens the prompt and a first scene that turns it in the same breath.
 */
const BASE = process.env.VIDEO_CHAT_BASE ?? "http://localhost:5199";
const MODE = process.env.VIDEO_CHAT_MODE ?? "templates";

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response;
}

async function plan(prompt) {
  const response = await post("/api/video-chat?action=response", {
    prompt,
    mode: MODE,
    orientation: "landscape",
    brand: BRAND,
  });

  const scenes = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const rows = buffer.split("\n");
    buffer = rows.pop() ?? "";
    for (const row of rows) {
      if (!row.startsWith("data: ") || row === "data: [DONE]") continue;
      const event = JSON.parse(row.slice(6));
      if (event.type === "scene.add" && event.data?.scene) scenes.push(event.data.scene);
    }
    if (done) break;
  }
  return scenes;
}

const BRAND = {
  font: "Inter",
  scriptFont: "Caveat",
  background: { colors: ["#5b21b6", "#2563eb"] },
  colors: {
    foreground: "#ffffff", surface: "#4a1a95", surfaceElevated: "#2f4fc4",
    muted: "#d7d3f0", primary: "#e04f8a", secondary: "#ec9a2c",
  },
};

function onScreen(scene) {
  const v = scene.variables ?? {};
  const parts = [];
  if (v.texts) parts.push(String(v.texts));
  for (const [name, value] of Object.entries(v)) {
    if (name === "texts" || name.startsWith("media")) continue;
    if (Array.isArray(value)) parts.push(`${name}=[${value.map((i) => typeof i === "object" ? JSON.stringify(i) : i).join(" | ")}]`);
    else if (typeof value === "string" && value) parts.push(`${name}=${value}`);
  }
  return parts.join("  ·  ");
}

export async function transcribe(prompt) {
  const opening = (await (await post("/api/video-chat?action=opening", { prompt })).json()).line;
  const scenes = await plan(prompt);

  const lines = [];
  for (const scene of scenes) {
    const { line } = await (await post("/api/video-chat?action=narration", { prompt, scene, earlier: [...lines] })).json();
    if (line) lines.push(line);
    scene.spoken = line;
  }
  return { prompt, opening, scenes };
}

export function render({ prompt, opening, scenes }) {
  const out = [`\nPrompt: ${prompt}`, `\n  [opening]  🔊 ${opening}`];
  scenes.forEach((scene, index) => {
    out.push(`\n  ${index + 1}. [${scene.templateId}]${scene.placement === "closer" ? " (closer)" : ""}`);
    out.push(`     screen: ${onScreen(scene)}`);
    out.push(`     🔊 ${scene.spoken ?? "—"}`);
  });
  return out.join("\n");
}
