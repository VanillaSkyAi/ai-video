import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defaultInstall, locateStarterRoot } from "./init.js";
import { safeProjectPath } from "./safe-path.js";

const PROVIDERS = {
  speech: { dependency: "@ai-sdk/xai", version: "^4.0.52", key: "XAI_API_KEY", export: "speechProvider" },
  video: { dependency: "@fal-ai/client", version: "1.10.1", key: "FAL_KEY", export: "videoProvider" },
} as const;
type Provider = keyof typeof PROVIDERS;

function registry(enabled: Provider[]): string {
  const imports = enabled.map((name) => `import { ${PROVIDERS[name].export} } from "./providers/${name}";`).join("\n");
  const value = enabled.length ? `{\n${enabled.map((name) => `  ...${PROVIDERS[name].export},`).join("\n")}\n}` : "{}";
  return `import type { VideoChatHandlerOptions } from "@vanillaskyai/video/server";\n${imports ? `${imports}\n` : ""}\nexport const providers: Pick<VideoChatHandlerOptions, "generateSpeech" | "generateVideo" | "transcribe"> = ${value};\n`;
}

export async function addVideoChatProvider(name: string, options: {
  cwd: string;
  starterRoot?: string;
  installDependencies?: (cwd: string) => void | Promise<void>;
}): Promise<string> {
  if (name !== "speech" && name !== "video") throw new Error("Choose a provider capability: speech or video.");
  const manifestPath = safeProjectPath(options.cwd, "package.json");
  const registryPath = safeProjectPath(options.cwd, "providers.ts");
  if (!existsSync(manifestPath) || !existsSync(registryPath)) throw new Error("Run vanillasky init before adding providers.");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("Expected an application package.json object.");
  const config = manifest.vanillasky ?? {};
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Expected vanillasky configuration to be an object.");
  const previous = (config as Record<string, unknown>).providers ?? [];
  if (!Array.isArray(previous) || previous.some((value) => value !== "speech" && value !== "video") || new Set(previous).size !== previous.length) {
    throw new Error("Invalid vanillasky.providers configuration.");
  }
  const enabled = [...previous].sort() as Provider[];
  if (readFileSync(registryPath, "utf8") !== registry(enabled)) {
    throw new Error("providers.ts has custom wiring. Preserve it and add the provider manually, or restore the generated wiring before using this command.");
  }
  const adapterPath = safeProjectPath(options.cwd, `providers/${name}.ts`);
  const adapter = readFileSync(join(options.starterRoot ?? locateStarterRoot(), "providers", `${name}.ts`), "utf8");
  if (!enabled.includes(name) && existsSync(adapterPath) && readFileSync(adapterPath, "utf8") !== adapter) {
    throw new Error(`providers/${name}.ts already contains customer source; no files were changed.`);
  }
  const dependencies = manifest.dependencies ?? {};
  if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) throw new Error("Expected dependencies to be an object.");
  if (!enabled.includes(name)) enabled.push(name);
  enabled.sort();
  const provider = PROVIDERS[name];
  manifest.dependencies = { ...dependencies, [provider.dependency]: (dependencies as Record<string, unknown>)[provider.dependency] ?? provider.version };
  manifest.vanillasky = { ...config, providers: enabled };
  const writes = new Map<string, string>([
    [manifestPath, `${JSON.stringify(manifest, null, 2)}\n`],
    [registryPath, registry(enabled)],
  ]);
  if (!existsSync(adapterPath)) writes.set(adapterPath, adapter);
  // Resolve every target before writing; never follow project symlinks.
  const staged = [...writes].map(([path, contents]) => ({ path, contents, temporary: safeProjectPath(options.cwd, `${path.slice(options.cwd.length + 1)}.${randomUUID()}.tmp`) }));
  for (const { path, contents, temporary } of staged) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, contents, { flag: "wx" });
    try { renameSync(temporary, path); } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
  try {
    await (options.installDependencies ?? defaultInstall)(options.cwd);
  } catch {
    throw new Error(`Provider files are ready. Rerun npx vanillasky providers add ${name} to finish installation.`);
  }
  return `Enabled ${name}. Add ${provider.key} to .env.local, then restart npm run dev.`;
}
