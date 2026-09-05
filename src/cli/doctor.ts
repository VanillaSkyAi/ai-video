import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { effectivelyIgnoresLocalEnvironment } from "./gitignore.js";

const REQUIRED_FILES = [
  ".env.local",
  "index.html",
  "server.ts",
  "providers.ts",
  "src/main.tsx",
  "stock.ts",
  "tsconfig.json",
  "vite.config.ts",
] as const;

const REQUIRED_DEPENDENCIES = [
  "@vanillaskyai/video",
  "@ai-sdk/anthropic",
  "ai",
  "react",
  "react-dom",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "@vitejs/plugin-react",
  "typescript",
  "vite",
] as const;

const PROVIDER_KEYS = new Set(["ANTHROPIC_API_KEY", "XAI_API_KEY", "FAL_KEY", "PEXELS_API_KEY"]);
const CLIENT_ENV_PREFIXES = ["VITE", "NEXT_PUBLIC"].map((prefix) => `${prefix}_`);

export interface VideoChatDoctorResult {
  ok: boolean;
  lines: readonly string[];
}

function parseEnvironment(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of source.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    result.set(match[1], value);
  }
  return result;
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** Inspect the generated app without running source, builds, providers, or network requests. */
export function doctorVideoChatApp(cwdInput: string): VideoChatDoctorResult {
  const cwd = resolve(cwdInput);
  const lines: string[] = [];
  let ok = true;
  for (const path of REQUIRED_FILES) {
    if (!existsSync(join(cwd, path))) {
      ok = false;
      lines.push(`MISSING  ${path}`);
    }
  }

  let manifest: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as unknown;
    if (!isJsonObject(parsed)) throw new Error("expected an object");
    manifest = parsed;
  } catch {
    ok = false;
    lines.push("MISSING  valid package.json");
  }
  const dependencies = { ...stringMap(manifest.dependencies), ...stringMap(manifest.devDependencies) };
  const missingDependencies = REQUIRED_DEPENDENCIES.filter((name) => !dependencies[name]);
  for (const name of missingDependencies) {
    ok = false;
    lines.push(`MISSING  dependency ${name}`);
  }
  const installed = (name: string) => existsSync(join(cwd, "node_modules", name, "package.json"));
  for (const name of REQUIRED_DEPENDENCIES.filter((name) => dependencies[name] && !installed(name))) {
    ok = false;
    lines.push(`NOT INSTALLED  ${name} — run npm install`);
  }
  const scripts = stringMap(manifest.scripts);
  if (scripts.dev !== "vite" || scripts.build !== "tsc && vite build") {
    ok = false;
    lines.push("MISSING  video-chat dev/build scripts");
  }

  const ignore = existsSync(join(cwd, ".gitignore")) ? readFileSync(join(cwd, ".gitignore"), "utf8") : "";
  if (!effectivelyIgnoresLocalEnvironment(ignore)) {
    ok = false;
    lines.push("UNSAFE   .env.local is not ignored");
  }

  const environment = existsSync(join(cwd, ".env.local"))
    ? parseEnvironment(readFileSync(join(cwd, ".env.local"), "utf8"))
    : new Map<string, string>();
  for (const name of environment.keys()) {
    if (CLIENT_ENV_PREFIXES.some((prefix) => name.startsWith(prefix) && PROVIDER_KEYS.has(name.slice(prefix.length)))) {
      ok = false;
      lines.push(`UNSAFE   ${name} exposes a provider key to the browser`);
    }
  }

  lines.push("READY    templates + browser voice");
  if (environment.get("ANTHROPIC_API_KEY")) lines.push("READY    ANTHROPIC_API_KEY");
  else {
    ok = false;
    lines.push("MISSING  ANTHROPIC_API_KEY in .env.local");
  }
  const configuration = isJsonObject(manifest.vanillasky) ? manifest.vanillasky : {};
  const enabled = Array.isArray(configuration.providers) ? configuration.providers : [];
  for (const provider of [
    { id: "speech", label: "generated speech", dependency: "@ai-sdk/xai", key: "XAI_API_KEY" },
    { id: "video", label: "generated video + transcription", dependency: "@fal-ai/client", key: "FAL_KEY" },
  ]) {
    const configured = enabled.includes(provider.id)
      && existsSync(join(cwd, "providers.ts"))
      && existsSync(join(cwd, "providers", `${provider.id}.ts`))
      && dependencies[provider.dependency]
      && installed(provider.dependency);
    if (!configured) {
      lines.push(`OPTIONAL ${provider.label} — run npx vanillasky providers add ${provider.id}`);
    } else if (!environment.get(provider.key)) {
      lines.push(`OPTIONAL ${provider.label} — add ${provider.key} to .env.local`);
    } else {
      lines.push(`READY    ${provider.label}`);
    }
  }
  lines.push(environment.get("PEXELS_API_KEY")
    ? "READY    stock media"
    : "OPTIONAL stock media — add PEXELS_API_KEY");
  if (existsSync(join(cwd, "vanillasky", "templates"))) {
    lines.push("CHECK    custom templates with npx vanillasky templates check");
  }
  return { ok, lines };
}
