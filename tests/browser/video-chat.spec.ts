import { expect, test } from "@playwright/test";
import { createVideoChatHandler } from "../../src/server";

test("plays an answer, keeps follow-up context, and recovers from optional media failures", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: Array<{ prompt: string; conversation: Array<{ prompt: string; response: string }> }> = [];
  let turn = 0;
  const handler = createVideoChatHandler({
    authorize: "none", heartbeatMs: false,
    welcome: { prompts: [{ prompt: "Explain the Moon" }] },
    generateText: async () => "[]",
    generateVideo: async () => { throw new Error("private-provider-detail"); },
    searchMedia: async () => { throw new Error("private-provider-detail"); },
    streamText: () => (async function* () {
      turn += 1;
      yield JSON.stringify({ type: "video-chat.opening", spokenHook: "The Moon turns once around its orbit.", mediaKeyword: "moon" }) + "\n";
      for (const [index, text] of (turn === 1 ? ["The Moon rotates once per orbit.", "One face stays toward Earth."] : ["Walk around a friend while facing them.", "You turn once during the trip."]).entries()) {
        yield JSON.stringify({ type: "scene.add", ...(index === 1 ? { placement: "closer" } : {}), scene: {
          id: `turn-${turn}-${index}`, templateId: "media", variables: { texts: text, mediaKeyword: "moon", mediaType: "video" }, narration: text, timing: { fixedDuration: 4 },
        } }) + "\n";
      }
      yield '{"type":"plan.complete"}\n';
    })(),
  });
  await page.route("**/api/video-chat?*", async (route) => {
    const request = route.request();
    const body = request.postData();
    if (new URL(request.url()).searchParams.get("action") === "response") requests.push(JSON.parse(body!));
    const response = await handler(new Request(request.url(), { method: request.method(), ...(body ? { body, headers: { "content-type": "application/json" } } : {}) }));
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.goto("http://127.0.0.1:4274/tests/browser/fixtures/video-chat.html");
  await page.getByRole("textbox", { name: "Prompt" }).fill("Why does the Moon show one face?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.locator('[data-video-frame="ready"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Full response" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Some parts were simplified so the response could continue.");
  await page.getByRole("button", { name: "Full response" }).click();
  await expect(page.getByRole("dialog")).toContainText("The Moon rotates once per orbit.");
  await expect(page.getByRole("dialog")).toContainText("One face stays toward Earth.");
  await page.getByRole("button", { name: "Close the full response" }).click();
  await page.getByRole("textbox", { name: "Prompt" }).fill("Explain that with an analogy.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].conversation).toEqual([expect.objectContaining({ prompt: requests[0].prompt, response: expect.stringContaining("The Moon rotates once per orbit.") })]);
  await expect(page.locator('[data-video-frame="ready"]')).toHaveAttribute("data-scene-id", /^turn-2-/);
  await expect(page.getByRole("button", { name: "Play again", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Full response" }).click();
  await expect(page.getByRole("dialog")).toContainText("Walk around a friend while facing them.");
  await expect(page.getByRole("dialog")).toContainText("You turn once during the trip.");
  expect(await page.locator("body").innerText()).not.toContain("private-provider-detail");
  expect(errors).toEqual([]);
});
