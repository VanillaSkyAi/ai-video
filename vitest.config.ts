import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@vanillaskyai/video/server": fileURLToPath(
        new URL("./src/server.ts", import.meta.url),
      ),
      "@vanillaskyai/video/templates": fileURLToPath(
        new URL("./src/templates.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Several integration files launch their own TypeScript and renderer
    // subprocesses. Two file workers fit both contributor machines and the
    // two-core hosted runner without turning fixed test budgets into load races.
    maxWorkers: 2,
  },
});
