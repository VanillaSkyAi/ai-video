import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputDirectory = new URL("../public/", import.meta.url);
const colors = ["#8B7CFF", "#FF5C8A", "#FFCB45", "#56E0C5", "#5EA1FF"];

function shell(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">${content}</svg>`;
}

function starPoints(cx, cy, outer, inner, points = 8) {
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / points;
    const radius = index % 2 === 0 ? outer : inner;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(" ");
}

function spark(frame) {
  const wave = Math.sin((frame / 8) * Math.PI * 2);
  const radius = 118 + wave * 18;
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    const start = 156 + wave * 8;
    const end = 192 + wave * 14;
    return `<line x1="${240 + Math.cos(angle) * start}" y1="${240 + Math.sin(angle) * start}" x2="${240 + Math.cos(angle) * end}" y2="${240 + Math.sin(angle) * end}" stroke="${colors[index % colors.length]}" stroke-width="18" stroke-linecap="round"/>`;
  }).join("");
  return shell(`${rays}<polygon points="${starPoints(240, 240, radius, radius * .48)}" fill="#FFCB45" stroke="#FFFFFF" stroke-width="16" stroke-linejoin="round"/><circle cx="204" cy="215" r="12" fill="#241640"/><circle cx="276" cy="215" r="12" fill="#241640"/><path d="M195 270 Q240 310 285 270" fill="none" stroke="#241640" stroke-width="14" stroke-linecap="round"/>`);
}

function rocket(frame) {
  const lift = frame * 15;
  const x = 205 + lift * .33;
  const y = 330 - lift;
  const flame = 42 + (frame % 2) * 24;
  return shell(`<g opacity=".85">${Array.from({ length: 10 }, (_, index) => `<circle cx="${45 + ((index * 47) % 390)}" cy="${55 + ((index * 79) % 350)}" r="${4 + (index % 3) * 3}" fill="${colors[index % colors.length]}"/>`).join("")}</g><g transform="translate(${x} ${y}) rotate(38)"><path d="M0 -105 C62 -70 72 20 0 92 C-72 20 -62 -70 0 -105Z" fill="#F8F7FF" stroke="#6D4AFF" stroke-width="14"/><circle cx="0" cy="-28" r="26" fill="#5EA1FF" stroke="#241640" stroke-width="10"/><path d="M-45 46 L-88 88 L-18 72Z" fill="#FF5C8A"/><path d="M45 46 L88 88 L18 72Z" fill="#FF5C8A"/><path d="M-24 88 Q0 ${88 + flame} 24 88Z" fill="#FFCB45"/><path d="M-14 88 Q0 ${80 + flame * 1.35} 14 88Z" fill="#FF5C8A"/></g>`);
}

function confetti(frame) {
  const pieces = Array.from({ length: 22 }, (_, index) => {
    const angle = ((index * 47) % 360) * Math.PI / 180;
    const distance = 80 + frame * (12 + index % 5) + (index % 4) * 12;
    const x = 240 + Math.cos(angle) * distance;
    const y = 225 + Math.sin(angle) * distance + frame * frame * 1.5;
    const rotation = frame * 34 + index * 21;
    return `<rect x="${x - 8}" y="${y - 16}" width="16" height="32" rx="4" fill="${colors[index % colors.length]}" transform="rotate(${rotation} ${x} ${y})"/>`;
  }).join("");
  const scale = .88 + Math.sin((frame / 8) * Math.PI) * .2;
  return shell(`${pieces}<g transform="translate(240 270) scale(${scale})"><path d="M-92 -38 L32 -104 L80 82 L-54 102Z" fill="#8B7CFF" stroke="#FFFFFF" stroke-width="15" stroke-linejoin="round"/><path d="M-50 -18 L49 -70" stroke="#FFCB45" stroke-width="18" stroke-linecap="round"/><ellipse cx="-7" cy="-60" rx="94" ry="32" transform="rotate(-27)" fill="#FF5C8A" stroke="#FFFFFF" stroke-width="13"/></g>`);
}

const renderers = { spark, rocket, confetti };
for (const [name, render] of Object.entries(renderers)) {
  const directory = mkdtempSync(join(tmpdir(), `vanillasky-${name}-`));
  try {
    for (let frame = 0; frame < 8; frame += 1) {
      const basename = `frame-${String(frame).padStart(2, "0")}`;
      const svgPath = join(directory, `${basename}.svg`);
      writeFileSync(svgPath, render(frame));
      execFileSync("sips", [
        "-s", "format", "png",
        svgPath,
        "--out", join(directory, `${basename}.png`),
      ], { stdio: "ignore" });
    }
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-framerate", "8",
      "-i", join(directory, "frame-%02d.png"),
      "-vf", "scale=480:480:flags=lanczos,split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse=dither=sierra2_4a",
      "-loop", "0",
      new URL(`${name}-sticker.gif`, outputDirectory).pathname,
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
