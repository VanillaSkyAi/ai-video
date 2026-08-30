import { expect, test } from "@playwright/test";

test("shows an explainable scene-director storyboard without browser errors", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  const externalRuntimeRequests: string[] = [];
  let localWasmLoaded = false;
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      externalRuntimeRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.url().endsWith("/dotlottie-player.wasm") && response.ok()) {
      localWasmLoaded = true;
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Let the AI direct every scene." })).toBeVisible();
  await expect(page.getByLabel("What should the video communicate?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Direct a new video" })).toBeEnabled();
  await expect(page.getByTestId("decision-card")).toHaveCount(3);
  await expect(page.getByTestId("decision-card").nth(0)).toContainText("AI image");
  await expect(page.getByTestId("decision-card").nth(1)).toContainText("Sticker · Confetti");
  await expect(page.getByTestId("decision-card").nth(2)).toContainText("Lottie · Steps");

  await expect(page.locator('[data-layer-template-id="generatedScene"] img')).toBeVisible();
  await expect(page.locator('[data-layer-template-id="animatedSticker"] canvas[data-gif-frame]'))
    .toBeVisible({ timeout: 9_000 });
  await expect(page.locator('[data-layer-template-id="lottieMotion"] canvas'))
    .toBeVisible({ timeout: 9_000 });
  await page.screenshot({
    path: testInfo.outputPath("scene-director.png"),
    fullPage: true,
  });

  const imageResponse = await page.request.post("/api/generate-image", {
    data: { prompt: "A bright product launch portal" },
  });
  expect(imageResponse.status()).toBe(503);

  expect(browserErrors).toEqual([]);
  expect(externalRuntimeRequests).toEqual([]);
  expect(localWasmLoaded).toBe(true);
});
