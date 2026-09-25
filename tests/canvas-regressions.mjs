import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fixture, until, sleep } from "./helpers/fixture.mjs";

const f = await fixture(`persistence-${Date.now()}`);
let vite, browser;
try {
  vite = await createServer({ server: { host: "127.0.0.1", port: 0, proxy: { "/api": { target: f.api } } } });
  await vite.listen();
  const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, channel: process.env.IMAGE2_TEST_BROWSER || (process.platform === "win32" ? "msedge" : "chromium") });
  const migration = await browser.newPage();
  await migration.goto(`${url}/favicon.svg`);
  await migration.evaluate(async () => {
    const db = await new Promise((ok, fail) => {
      const request = indexedDB.open("image2-canvas-workspace", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("nodes", { keyPath: "id" }).createIndex("createdAt", "createdAt");
        request.result.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => ok(request.result);
      request.onerror = () => fail(request.error);
    });
    const transaction = db.transaction(["nodes", "meta"], "readwrite");
    transaction.objectStore("nodes").put({ id: "legacy-text", type: "text", content: "legacy retained" });
    transaction.objectStore("meta").put({ key: "default-workspace", viewport: { x: 100, y: 200, zoom: 0.7 }, settings: { prompt: "legacy prompt" } });
    await new Promise(ok => transaction.oncomplete = ok);
    db.close();
  });
  const migrated = await migration.evaluate(async () => {
    const m = await import("/src/lib/canvas-db.js");
    const projects = await m.loadCanvasProjects();
    return { projects, snapshot: await m.loadCanvasSnapshot("default-workspace") };
  });
  assert.equal(migrated.projects.length, 1);
  assert.deepEqual(migrated.snapshot.nodes.map(node => node.id), ["legacy-text"]);
  assert.deepEqual(migrated.snapshot.viewport, { x: 100, y: 200, zoom: 0.7 });
  assert.equal(migrated.snapshot.settings.prompt, "legacy prompt");
  console.log("PASS 旧单画布数据库迁移");

  const isolated = await migration.evaluate(async () => {
    const m = await import("/src/lib/canvas-db.js");
    const a = await m.createCanvasProject({ title: "A" });
    const b = await m.createCanvasProject({ title: "B" });
    await m.saveCanvasSnapshot({ canvasId: a.id, nodes: [{ id: "node-a", type: "text", content: "A" }], viewport: { x: 10, y: 20, zoom: 1 }, settings: { model: "gpt-image-2.5-sunburst" } });
    await m.saveCanvasSnapshot({ canvasId: b.id, nodes: [{ id: "node-b", type: "text", content: "B" }], viewport: { x: 30, y: 40, zoom: 2 }, settings: { model: "gpt-image-2.5-flare" } });
    await m.renameCanvasProject(a.id, "Renamed A");
    const first = await m.loadCanvasSnapshot(a.id);
    await m.deleteCanvasProject(a.id);
    return { first, second: await m.loadCanvasSnapshot(b.id) };
  });
  assert.equal(isolated.first.project.title, "Renamed A");
  assert.deepEqual(isolated.first.nodes.map(node => node.id), ["node-a"]);
  assert.deepEqual(isolated.second.nodes.map(node => node.id), ["node-b"]);
  assert.deepEqual(isolated.second.viewport, { x: 30, y: 40, zoom: 2 });
  assert.equal(isolated.first.settings.model, "gpt-image-2.5-sunburst");
  assert.equal(isolated.second.settings.model, "gpt-image-2.5-flare");
  console.log("PASS 多项目节点、模型、视口及删除隔离");

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const login = await f.login("retention@example.invalid");
  await context.addCookies([{ name: "image2_session", value: login.cookie.split("=")[1], url }]);
  const page = await context.newPage();
  await page.goto(`${url}/favicon.svg`);
  const canvasId = await page.evaluate(async () => {
    const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    canvas.width = canvas.height = 16;
    canvas.getContext("2d").fillRect(0, 0, 16, 16);
    const blob = await new Promise(ok => canvas.toBlob(ok));
    const db = await new Promise((ok, fail) => {
      const request = indexedDB.open("image2-local-history", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("tasks", { keyPath: "id" });
        const images = request.result.createObjectStore("images", { keyPath: "id" });
        images.createIndex("taskId", "taskId");
        images.createIndex("createdAt", "createdAt");
      };
      request.onsuccess = () => ok(request.result);
      request.onerror = () => fail(request.error);
    });
    const transaction = db.transaction(["tasks", "images"], "readwrite");
    for (let index = 0; index < 306; index++) {
      const taskId = `old-task-${Math.floor(index / 8)}`;
      const createdAt = new Date(1700000000000 + index * 1000).toISOString();
      transaction.objectStore("tasks").put({ id: taskId, prompt: taskId, count: 8, mode: "generate", model: "gpt-image-2.5-flare", createdAt, referenceImages: [] });
      transaction.objectStore("images").put({ id: `old-image-${index}`, taskId, status: "done", mimeType: "image/png", blob, createdAt });
    }
    await new Promise(ok => transaction.oncomplete = ok);
    db.close();
    const m = await import("/src/lib/canvas-db.js");
    const first = await m.createCanvasProject({ title: "Saved old image" });
    const second = await m.createCanvasProject({ title: "Unopened hidden image" });
    const node = { id: "retained-node", type: "history-image", taskId: "old-task-0", imageId: "old-image-0", x: 100, y: 100, width: 300, height: 300, createdAt: new Date().toISOString() };
    await m.saveCanvasSnapshot({ canvasId: first.id, nodes: [node], viewport: { x: 100, y: 100, zoom: 1 }, settings: { prompt: "" } });
    await m.saveCanvasSnapshot({ canvasId: second.id, nodes: [{ ...node, id: "hidden-reference", imageId: "old-image-1", hidden: true }], viewport: { x: 0, y: 0, zoom: 1 }, settings: {} });
    // 模拟另一个项目尚未提交 IndexedDB 的 fallback 引用。
    const key = `image2-canvas-workspace-fallback:${second.id}`;
    const fallback = JSON.parse(localStorage.getItem(key));
    fallback.nodes.push({ ...node, id: "fallback-reference", imageId: "old-image-2" });
    localStorage.setItem(key, JSON.stringify(fallback));
    return first.id;
  });
  const imageIds = () => page.evaluate(async () => {
    const db = await new Promise(ok => {
      const request = indexedDB.open("image2-local-history");
      request.onsuccess = () => ok(request.result);
    });
    const ids = await new Promise(ok => {
      const request = db.transaction("images", "readonly").objectStore("images").getAllKeys();
      request.onsuccess = () => ok(request.result);
    });
    db.close();
    return ids;
  });
  await page.goto(`${url}/?mode=canvas&canvas=${canvasId}`);
  await page.locator('[data-node-id="retained-node"]').waitFor();
  await page.goto(url);
  await page.locator("#accountButton").filter({ hasText: "retention@" }).waitFor();
  await page.locator(".composer textarea").fill("retention-limit");
  await page.locator(".generate-button").click();
  await until(async () => (await imageIds()).length === 303, 20000);
  const retained = await imageIds();
  for (const index of [0, 1, 2]) assert(retained.includes(`old-image-${index}`));
  for (const index of [3, 4, 5, 6]) assert(!retained.includes(`old-image-${index}`));
  await page.goto(`${url}/?mode=canvas&canvas=${canvasId}`);
  await page.locator('[data-node-id="retained-node"] img').waitFor();
  assert.equal(await page.locator("[data-node-id]").count(), 1);
  console.log("PASS 自动清理保留已打开/未打开项目、隐藏节点和 fallback 引用，其余图片限制为 300 张");

  await page.evaluate(async () => {
    const db = await new Promise(ok => {
      const request = indexedDB.open("image2-local-history");
      request.onsuccess = () => ok(request.result);
    });
    const transaction = db.transaction("images", "readwrite");
    transaction.objectStore("images").delete("old-image-0");
    await new Promise(ok => transaction.oncomplete = ok);
    db.close();
  });
  await page.reload();
  const missing = page.locator('[data-node-id="retained-node"]');
  await missing.waitFor();
  assert.match(await missing.innerText(), /节点和连线已保留/);
  await missing.click();
  await page.keyboard.press("Control+d");
  await until(async () => await page.locator("[data-node-id]").count() === 2);
  await page.keyboard.press("Control+z");
  await until(async () => await page.locator("[data-node-id]").count() === 1);
  await sleep(700);
  assert.equal(await page.evaluate(async id => {
    const { loadCanvasSnapshot } = await import("/src/lib/canvas-db.js");
    return (await loadCanvasSnapshot(id)).nodes.length;
  }, canvasId), 1);
  console.log("PASS 素材缺失时保留节点，撤销后也不丢失布局");
} finally {
  await browser?.close();
  await vite?.close();
  await f.close();
}
