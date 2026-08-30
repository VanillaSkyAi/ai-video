import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@vanillaskyai/ai-video/server": fileURLToPath(
        new URL("./src/server.ts", import.meta.url),
      ),
      "@vanillaskyai/ai-video/templates": fileURLToPath(
        new URL("./src/templates.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // Several integration files launch their own TypeScript and renderer
    // subprocesses. More file workers oversubscribe contributor machines and
    // make the default five-second test budget less reliable, not faster.
    maxWorkers: 4,
  },
});
