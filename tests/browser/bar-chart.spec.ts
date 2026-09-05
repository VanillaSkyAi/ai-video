import { expect, test } from "@playwright/test";

for (const orientation of ["portrait", "landscape"]) {
  for (const text of ["wide", "cjk"]) {
    test(`comparison preserves long ${text} labels in ${orientation}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize(orientation === "portrait" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 });
      await page.goto(`http://127.0.0.1:4274/tests/browser/fixtures/bar-chart.html?orientation=${orientation}&text=${text}`);
      await expect(page.locator("[data-bar-chart-item]")).toHaveCount(6);
      const bounds = await page.evaluate(() => {
        const box = (selector: string, parent: ParentNode = document) => {
          const rect = parent.querySelector(selector)!.getBoundingClientRect();
          return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
        };
        return {
          topic: box("[data-bar-chart-topic]"),
          rows: [...document.querySelectorAll("[data-bar-chart-item]")].map((row) => ({
            label: box("[data-bar-chart-label]", row),
            value: box("[data-bar-chart-value]", row),
            fill: box("[data-bar-chart-fill]", row),
          })),
        };
      });
      expect(bounds.topic.bottom).toBeLessThanOrEqual(bounds.rows[0].label.top - 8);
      for (const row of bounds.rows) {
        expect(row.label.bottom).toBeLessThanOrEqual(row.fill.top - 8);
        expect(row.value.bottom).toBeLessThanOrEqual(row.fill.top - 8);
        expect(row.label.right).toBeLessThanOrEqual(row.value.left - 8);
      }
      expect(errors).toEqual([]);
    });
  }
}
