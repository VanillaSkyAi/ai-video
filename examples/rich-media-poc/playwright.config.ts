import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3027",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3027",
    url: "http://127.0.0.1:3027",
    env: {
      OPENAI_API_KEY: "",
      ADAPTIVE_CHANNEL_LIVE_MEDIA: "0",
      ADAPTIVE_CHANNEL_ALLOW_FIXTURE_FALLBACK: "0",
    },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
