import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const registryDir = join(root, "registry", "items");

interface RegistryItem {
  files?: { path: string }[];
}

function distributedSourcePaths(): string[] {
  const paths = new Set<string>();
  for (const name of readdirSync(registryDir).filter((entry) => entry.endsWith(".json"))) {
    const item = JSON.parse(readFileSync(join(registryDir, name), "utf8")) as RegistryItem;
    for (const file of item.files ?? []) paths.add(file.path);
  }
  return [...paths].sort();
}

describe("source-owned template contexts", () => {
  // A copied template lives in the consumer's tree while the player comes from
  // the package. Two module instances then exist, so a plain createContext
  // gives each side its own context and the copied template silently reads the
  // default forever. Distributed files must share the context on globalThis.
  it("shares every React context a copied file creates", () => {
    const offenders: string[] = [];

    for (const path of distributedSourcePaths()) {
      const source = readFileSync(join(root, path), "utf8");
      if (!/\bcreateContext\s*</.test(source)) continue;

      const declaresSharedSlot = /globalThis as typeof globalThis &/.test(source)
        && /__vanillasky[A-Za-z]*\?:/.test(source);
      const assignsOnce = /__vanillasky[A-Za-z]*\s*\r?\n?\s*\?\?=/.test(source);

      if (!declaresSharedSlot || !assignsOnce) offenders.push(path);
    }

    expect(offenders, "distributed files creating an unshared React context").toEqual([]);
  });

  it("covers the backdrop context that establishes the convention", () => {
    const distributed = distributedSourcePaths();
    const backdrop = "src/visual-system/scene-templates/external-video-backdrop.tsx";

    expect(distributed).toContain(backdrop);
    expect(readFileSync(join(root, backdrop), "utf8")).toMatch(/\bcreateContext\s*</);
  });
});
