import { expect, test } from "@playwright/test";

test("turns one prompt into five text-to-video scenes", async ({ page }) => {
  const isLiveRun = process.env.EXPECT_LIVE_CHANNEL === "1";
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
  await expect(page.getByRole("heading", { name: "Prompt in. Five videos out." })).toBeVisible();
  await page.getByRole("button", { name: "Create video" }).click();

  await expect(page.getByTestId("channel-status")).toContainText("Five scenes generated", {
    timeout: isLiveRun ? 90_000 : 15_000,
  });
  const routeCards = page.getByTestId("route-card");
  await expect(routeCards).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await expect(routeCards.nth(index)).toContainText("generate-video");
  }
  if (isLiveRun) {
    for (let index = 0; index < 5; index += 1) {
      await expect(routeCards.nth(index)).toContainText("minimax/h3-max/text-to-video");
    }
  }
  await expect(page.getByTestId("queue-ready")).toContainText("scene");
  await expect(page.getByTestId("parallelism")).toContainText("peak 5 parallel");
  await expect(page.getByTestId("video-player")).toHaveAttribute("data-scenes", "5");
  const unmute = page.getByRole("button", { name: "Unmute video response" });
  await expect(unmute).toBeVisible();
  await unmute.click();
  const audibleVideo = page.locator('[data-scene-layer="active"] video');
  await expect.poll(() => audibleVideo.evaluate((element) => ({
    muted: (element as HTMLVideoElement).muted,
    volume: (element as HTMLVideoElement).volume,
  }))).toEqual({ muted: false, volume: 0.85 });
  expect(channelRequests).toHaveLength(1);
  expect(channelRequests[0]).toEqual({ prompt: expect.any(String) });
  await expect(page.locator("[data-layer-template-id=media]").first()).toBeVisible();

  const expectActiveVideoToMove = async (sceneName: string) => {
    await expect(page.getByRole("heading", { name: sceneName })).toBeVisible({ timeout: 15_000 });
    const video = page.locator('[data-scene-layer="active"] video');
    await expect(video).toHaveAttribute("src", /\.mp4$/);
    await expect.poll(
      () => video.evaluate((element) => (element as HTMLVideoElement).currentTime),
      { timeout: 3_000 },
    ).toBeGreaterThan(0);
  };
  await expectActiveVideoToMove("Scene 3 of 5");
  await expectActiveVideoToMove("Scene 5 of 5");

  expect(browserErrors).toEqual([]);
});
