/** Real service-worker update lifecycle against a production build; simulated deployment metadata. */
import next from "next";
import { VERSION } from "../lib/types";
const NEXT_TEST_VERSION = VERSION.split(".")
  .map((part, i) => (i === 2 ? Number(part) + 1 : part))
  .join(".");
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
async function main() {
  const app = next({ dev: false, dir: process.cwd() });
  await app.prepare();
  const handle = app.getRequestHandler();
  let revision = 0,
    remoteVersion = VERSION,
    navigationAfterApply = false;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/api/version") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ version: remoteVersion }));
      return;
    }
    if (url.pathname === "/sw.js") {
      const source = await readFile("public/sw.js", "utf8");
      res.writeHead(200, {
        "Content-Type": "application/javascript",
        "Cache-Control": "no-store",
        "Service-Worker-Allowed": "/",
      });
      res.end(
        source.replace(
          JSON.stringify(VERSION),
          JSON.stringify(revision ? NEXT_TEST_VERSION : VERSION),
        ) + `\n// deploy ${revision}`,
      );
      return;
    }
    if (
      navigationAfterApply &&
      url.pathname === "/" &&
      req.headers["sec-fetch-mode"] === "navigate"
    )
      remoteVersion = VERSION;
    await handle(req, res);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    bypassCSP: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((r) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => r(),
            { once: true },
          ),
        );
    });
    await expect(page.getByRole("dialog")).toHaveCount(0); // No unwanted reload/popup on first install.
    await page.getByLabel("Email", { exact: true }).fill("draft@example.com");
    await page.evaluate(async () => {
      sessionStorage.setItem("update-keep-view", "money");
      localStorage.setItem("tripflow:theme", "dark");
      const request = indexedDB.open("tripflow-v020", 2);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("queue"))
            request.result.createObjectStore("queue", {
              keyPath: "operationId",
            });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("queue", "readwrite");
        tx.objectStore("queue").put({
          operationId: "unsent-safe-operation",
          userId: "test-user",
          state: "pending",
          mutation: { data: { amount: 123000 } },
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    // Existing offline queue and another tab must survive activation.
    const other = await context.newPage();
    await other.goto(`http://127.0.0.1:${port}`);
    await expect(other.getByLabel("Email", { exact: true })).toBeVisible();
    let otherNavigations = 0;
    other.on("request", (request) => {
      if (
        request.isNavigationRequest() &&
        request.frame() === other.mainFrame()
      )
        otherNavigations++;
    });
    revision = 1;
    remoteVersion = NEXT_TEST_VERSION;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    const dialog = page.getByRole("dialog", {
      name: "TripFlow có phiên bản mới",
    });
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await expect(dialog).toHaveAttribute("data-presentation", "compact");
    const popup = (await dialog.boundingBox())!;
    expect(popup.height).toBeLessThan(700);
    expect(Math.abs(popup.y + popup.height / 2 - 422)).toBeLessThan(2);
    expect(popup.x).toBeGreaterThan(10);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(100);
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.width).toBeLessThan(width);
      expect(Math.abs(bounds.y + bounds.height / 2 - 422)).toBeLessThan(2);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      dialog.getByRole("button", { name: "Cập nhật", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Để sau", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Có phiên bản mới", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Cập nhật", exact: true }),
    ).toBeEnabled();
    await mkdir("test-results", { recursive: true });
    await page.screenshot({
      path: "test-results/v250-update-dialog.png",
      fullPage: true,
    });
    await context.setOffline(true);
    await dialog.getByRole("button", { name: "Cập nhật", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Cần kết nối mạng");
    await context.setOffline(false);
    navigationAfterApply = true;
    await Promise.all([
      page.waitForEvent("framenavigated", (f) => f === page.mainFrame()),
      dialog.getByRole("button", { name: "Cập nhật", exact: true }).click(),
    ]);
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    const persisted = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("tripflow-v020", 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const row = await new Promise<any>((resolve, reject) => {
        const req = db
          .transaction("queue")
          .objectStore("queue")
          .get("unsent-safe-operation");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return {
        view: sessionStorage.getItem("update-keep-view"),
        theme: localStorage.getItem("tripflow:theme"),
        amount: row?.mutation?.data?.amount,
      };
    });
    expect(persisted).toEqual({ view: "money", theme: "dark", amount: 123000 });
    expect(otherNavigations).toBe(0);
    expect(failures).toEqual([]);
    await other.close();
    console.log(
      "PASS app update: first install safe, waiting-worker popup, unsaved draft blocks update, one-click activation+normal reload, offline queue/theme/view preserved, other tab not reloaded.",
    );
  } finally {
    await context.close();
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    await app.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
