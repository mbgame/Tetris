import { test, expect, type Page } from "@playwright/test";

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


test("rapid inputs never crash", async ({ page }) => {
  const errors = trackErrors(page);
  await startLevel1(page);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(["ArrowLeft", "ArrowRight", "ArrowUp", "Z", "C", "ArrowDown"][i % 6]);
  }
  const alive = await page.evaluate(() => (window as any).__PHASER_GAME__.scene.getScene("GameScene")["running"]);
  expect(alive).toBe(true);
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("hold cannot be used twice before a lock", async ({ page }) => {
  await startLevel1(page);
  const res = await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("GameScene");
    s["hold"]();
    const after1 = s["queue"].canHold;
    s["hold"]();
    return { after1, after2: s["queue"].canHold };
  });
  expect(res.after1).toBe(false);
  expect(res.after2).toBe(false);
});

test("simultaneous multi-mono clears remove all qualifying rows", async ({ page }) => {
  await startLevel1(page);
  const cleared = await page.evaluate(async () => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("GameScene");
    const board = s["board"];
    for (let x = 0; x < 10; x++) {
      board.set(x, 21, 1);
      board.set(x, 20, 1);
    }
    let before = 0;
    board.forEachCell(() => before++);
    s["startLineClear"]([20, 21]);
    await new Promise((r) => setTimeout(r, 900));
    let after = 0;
    board.forEachCell(() => after++);
    return { before, after };
  });
  expect(cleared.before).toBe(20);
  expect(cleared.after).toBe(0);
});

test("pause request during LINE_CLEAR is ignored (no crash)", async ({ page }) => {
  const errors = trackErrors(page);
  await startLevel1(page);
  const phase = await page.evaluate(async () => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("GameScene");
    for (let x = 0; x < 10; x++) s["board"].set(x, 21, 1);
    s["startLineClear"]([21]);
    s["pauseGame"](); // should be ignored while clearing
    const mid = s["fsm"].state;
    await new Promise((r) => setTimeout(r, 900));
    return { mid, end: s["fsm"].state };
  });
  expect(phase.mid).toBe("LINE_CLEAR");
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("route unmount mid-game leaves no leaked WebGL context / errors", async ({ page }) => {
  const errors = trackErrors(page);
  await startLevel1(page);
  await page.goto("/", { waitUntil: "networkidle" }); // unmount GameCanvas
  await page.waitForTimeout(300);
  const destroyed = await page.evaluate(() => !(window as any).__PHASER_GAME__?.isRunning);
  expect(destroyed).toBe(true);
  expect(errors, errors.join("\n")).toHaveLength(0);
});
