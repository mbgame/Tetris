import { test, expect, type Page } from "@playwright/test";

/** Collect console errors for the lifetime of a page. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

async function startLevel1(page: Page) {
  await page.goto("/play", { waitUntil: "networkidle" });
  await page.getByText("Play").click();
  await page.getByText("Dawn Meadow").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("GameScene")?.["running"] === true,
    { timeout: 10000 },
  );
}

test("/play boots a Phaser canvas with no console errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/play", { waitUntil: "networkidle" });
  const canvas = await page.waitForSelector("#game-root canvas", { timeout: 10000 });
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("basic input moves a piece", async ({ page }) => {
  await startLevel1(page);
  const xBefore = await page.evaluate(
    () => (window as any).__PHASER_GAME__.scene.getScene("GameScene")["active"].x,
  );
  await page.keyboard.press("ArrowRight");
  const xAfter = await page.evaluate(
    () => (window as any).__PHASER_GAME__.scene.getScene("GameScene")["active"].x,
  );
  expect(xAfter).toBe(xBefore + 1);
});

test("HUD shows score and level during play", async ({ page }) => {
  await startLevel1(page);
  await expect(page.getByText("SCORE")).toBeVisible();
  await expect(page.getByText("Dawn Meadow")).toBeVisible();
});
