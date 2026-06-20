import { test, expect, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test("landing page offers both games", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByText("Tetromino Sand")).toBeVisible();
  await expect(page.getByText("Block Drop")).toBeVisible();
});

test("Block Drop boots, fills the tray, and reaches PLAYING with no errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });

  // through the blast main menu → level select → start level 1
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();

  // wait for the scene to begin play (banner clears after ~800ms)
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  const trayCount = await page.evaluate(
    () =>
      (window as any).__PHASER_GAME__.scene
        .getScene("BlastScene")
        ["tray"].filter((t: unknown) => t !== null).length,
  );
  expect(trayCount).toBe(3);

  await expect(page.getByText("pts to go")).toBeVisible();
  expect(errors, errors.join("\n")).toHaveLength(0);
});

test("real pointer drag places a piece on the board", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  // compute screen coords for the first tray piece and a target empty cell (3,3)
  const pts = await page.evaluate(() => {
    const g = (window as any).__PHASER_GAME__;
    const s = g.scene.getScene("BlastScene");
    const piece = s["tray"].find((t: any) => t);
    const rect = g.canvas.getBoundingClientRect();
    const sx = rect.width / g.scale.gameSize.width;
    const sy = rect.height / g.scale.gameSize.height;
    const cell = s["cell"];
    const ox = s["originX"];
    const oy = s["originY"];
    const board = s["board"];
    // find a valid empty origin for this piece (noise is random each run)
    let col = 0;
    let row = 0;
    outer: for (let r = 0; r < board.size; r++) {
      for (let c = 0; c < board.size; c++) {
        if (board.canPlace(piece.shape.cells, c, r)) {
          col = c;
          row = r;
          break outer;
        }
      }
    }
    const halfW = ((piece.shape.w - 1) * cell) / 2;
    // invert the drag offsets (halfW + 1.4·cell lift) so cell(0,0) lands at col,row
    const ptX = ox + col * cell + cell / 2 + halfW;
    const ptY = oy + row * cell + cell / 2 + cell * 1.4;
    return {
      src: { x: rect.left + piece.container.x * sx, y: rect.top + piece.container.y * sy },
      dst: { x: rect.left + ptX * sx, y: rect.top + ptY * sy },
    };
  });

  await page.mouse.move(pts.src.x, pts.src.y);
  await page.mouse.down();
  await page.mouse.move(pts.dst.x, pts.dst.y, { steps: 12 });
  await page.mouse.up();

  const filled = await page.evaluate(() =>
    (window as any).__PHASER_GAME__.scene.getScene("BlastScene")["board"].countFilled(),
  );
  // level 1 starts with 3 noise cells; a placed piece adds ≥1 more
  expect(filled).toBeGreaterThan(3);
});

test("placing a piece increases the score", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  // drive a placement directly through the scene to keep the test deterministic
  const scored = await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    const before = s["score"];
    const piece = s["tray"].find((t: unknown) => t !== null);
    s["commitPlacement"](piece, 0, 0);
    return { before, after: s["score"] };
  });
  expect(scored.after).toBeGreaterThan(scored.before);
});

test("power-ups: multiplier and refresh work", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  // grant coins so the bar enables, then verify the wallet reaches the HUD
  await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    s["coins"] = 50;
    s["emitCoins"]();
  });
  // buy the multiplier → badge appears, scene multiplier > 1
  await page.getByRole("button", { name: /Multiplier/ }).click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__.scene.getScene("BlastScene")["scoreMult"] > 1,
    { timeout: 5000 },
  );
  await expect(page.getByText(/× POINTS/)).toBeVisible();

  // refresh swaps the tray for a fresh set (containers differ)
  const changed = await page.evaluate(async () => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    const ids = s["tray"].map((t: any) => t?.container?.name ?? Math.random());
    // tag containers so we can tell if they were replaced
    s["tray"].forEach((t: any, i: number) => t && (t.container.name = `pre${i}`));
    (window as any).__refreshBus = true;
    return ids.length;
  });
  expect(changed).toBe(3);
  await page.getByRole("button", { name: /Refresh/ }).click();
  const replaced = await page.evaluate(
    () =>
      (window as any).__PHASER_GAME__.scene
        .getScene("BlastScene")
        ["tray"].every((t: any) => t && !String(t.container.name).startsWith("pre")),
  );
  expect(replaced).toBe(true);
});

test("idle for 5s shows a best-move hint, dismissed on activity", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  // do nothing → hint appears after the idle threshold
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__.scene.getScene("BlastScene")["hintActive"] === true,
    { timeout: 9000 },
  );

  // any pointer move over the canvas dismisses it
  const c = await page.evaluate(() => {
    const r = (window as any).__PHASER_GAME__.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.move(c.x + 10, c.y + 10);
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__.scene.getScene("BlastScene")["hintActive"] === false,
    { timeout: 3000 },
  );
});

test("rotate power-up arms and spins a tray piece", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );
  await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    s["coins"] = 40;
    s["emitCoins"]();
  });

  await page.getByRole("button", { name: /Rotate/ }).click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__.scene.getScene("BlastScene")["rotateArmed"] === true,
    { timeout: 5000 },
  );

  const res = await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    const piece = s["tray"].find((t: any) => t);
    const before = JSON.stringify(piece.shape.cells);
    const square = piece.shape.w === piece.shape.h;
    const r = piece.grabRect;
    s["useRotate"]({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    const after = JSON.stringify(s["tray"][piece.slot].shape.cells);
    return { square, changed: before !== after, armed: s["rotateArmed"] };
  });
  expect(res.armed).toBe(false); // arm consumed
  if (!res.square) expect(res.changed).toBe(true); // non-square pieces visibly rotate
});

test("settings can return to the main menu (landing)", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: /Main Menu/ }).click();
  await page.waitForURL("**/");
  await expect(page.getByText("Block Drop")).toBeVisible(); // landing game picker
});

test("levels are locked until the previous one is cleared", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  // level select: level 1 open, level 2 locked
  const lvl2 = page.getByRole("button", { name: /2\. Warming Up/ });
  await expect(lvl2).toBeDisabled();
  await expect(lvl2).toContainText("🔒");
});

test("clearing a level unlocks the next (persisted)", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  // jump the score to target, then place a valid piece → triggers level complete
  await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    const b = s["board"];
    const piece = s["tray"].find((t: any) => t);
    let col = 0;
    let row = 0;
    outer: for (let r = 0; r < b.size; r++)
      for (let c = 0; c < b.size; c++)
        if (b.canPlace(piece.shape.cells, c, r)) { col = c; row = r; break outer; }
    s["score"] = s["level"].targetPoints; // next placement pushes over the target
    s["commitPlacement"](piece, col, row);
  });

  // unlock is persisted to localStorage
  await page.waitForFunction(
    () => {
      try {
        const raw = localStorage.getItem("chromasand-progress");
        if (!raw) return false;
        return (JSON.parse(raw).state?.blastUnlocked ?? 1) >= 2;
      } catch {
        return false;
      }
    },
    { timeout: 5000 },
  );
});

test("no-move board defers the loss while a power-up can rescue", async ({ page }) => {
  await page.goto("/play?mode=blast", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByText("Calm Start").click();
  await page.waitForFunction(
    () => (window as any).__PHASER_GAME__?.scene.getScene("BlastScene")?.["running"] === true,
    { timeout: 12000 },
  );

  // fill the whole board so nothing can be placed; with coins, it must NOT lose
  const stuck = await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    const b = s["board"];
    for (let y = 0; y < b.size; y++) for (let x = 0; x < b.size; x++) b.set(x, y, 1);
    s["coins"] = 50;
    s["emitCoins"]();
    s["checkGameOver"]();
    return { phase: s["fsm"].state, hasNudge: !!s["stuckText"] };
  });
  expect(stuck.phase).toBe("PLAYING"); // deferred, not lost
  expect(stuck.hasNudge).toBe(true);

  // broke + still no move → now it's a real game over
  const lost = await page.evaluate(() => {
    const s = (window as any).__PHASER_GAME__.scene.getScene("BlastScene");
    s["coins"] = 0;
    s["emitCoins"]();
    s["checkGameOver"]();
    return s["fsm"].state;
  });
  expect(lost).toBe("GAME_OVER");
});
