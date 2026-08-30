import { expect, test } from "@playwright/test";

test("starts a mixed-media channel and prefetches the next finite segment", async ({ page }) => {
  const browserErrors: string[] = [];
  const channelRequests: Array<Record<string, unknown>> = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().endsWith("/api/channel") && request.method() === "POST") {
      channelRequests.push(request.postDataJSON() as Record<string, unknown>);
    }
  });

  await page.goto("/channel");
  await expect(page.getByRole("heading", { name: "An infinite story, made from finite scenes." })).toBeVisible();
  await page.getByRole("button", { name: "Start the channel" }).click();

  await expect(page.getByTestId("channel-status")).toContainText("Chapter 1 is playing", { timeout: 15_000 });
  await expect(page.getByTestId("route-card")).toHaveCount(3);
  await expect(page.getByTestId("route-card").nth(0)).toContainText("gradient");
  await expect(page.getByTestId("route-card").nth(1)).toContainText("generate-image");
  await expect(page.getByTestId("route-card").nth(2)).toContainText("generate-video");
  await expect(page.getByTestId("queue-next")).toContainText("Chapter 2 ready", { timeout: 15_000 });
  expect(channelRequests[1]?.bufferSeconds).toBeGreaterThan(0);
  await expect(page.locator("[data-layer-template-id=media]").first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});
