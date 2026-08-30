import { expect, test } from "@playwright/test";

test.skip(process.env.VANILLASKY_LIVE_TEST !== "1", "requires a local server with an OpenAI key");

test("plans, explains, and renders a fresh storyboard", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  await page.getByLabel("What should the video communicate?").fill(
    "Explain how a tiny team turns a rough customer insight into a polished launch: discover the problem, build the product, then celebrate shipping.",
  );
  await page.getByRole("button", { name: "Direct a new video" }).click();

  await expect(page.getByTestId("director-status")).toContainText("Ready", { timeout: 120_000 });
  const decisions = page.getByTestId("decision-card");
  expect(await decisions.count()).toBeGreaterThanOrEqual(2);
  await expect(decisions.first()).toContainText("Why:");
  await expect(page.locator("[data-layer-template-id]").first()).toBeVisible();
  expect(browserErrors).toEqual([]);
});
