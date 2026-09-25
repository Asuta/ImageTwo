import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fixture, until, sleep } from "./helpers/fixture.mjs";
import { checkRedesignedCanvas } from "./canvas-redesign.mjs";
import { checkCanvasInteractions } from "./helpers/canvas-interactions.mjs";

const f = await fixture(`browser-${Date.now()}`);
let vite, browser;
try {
  vite = await createServer({ server: { host: "127.0.0.1", port: 0, proxy: { "/api": { target: f.api } } } });
  await vite.listen();
  const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, channel: process.env.IMAGE2_TEST_BROWSER || (process.platform === "win32" ? "msedge" : "chromium") });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const sent = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/generate") && request.method() === "POST") sent.push(request.postDataJSON());
  });
  const history = () => page.evaluate(async () => {
    const db = await new Promise((ok, fail) => {
      const request = indexedDB.open("image2-local-history");
      request.onsuccess = () => ok(request.result);
      request.onerror = () => fail(request.error);
    });
    const transaction = db.transaction(["tasks", "images"], "readonly");
    const [tasks, images] = await Promise.all(["tasks", "images"].map(name => new Promise(ok => {
      const request = transaction.objectStore(name).getAll();
      request.onsuccess = () => ok(request.result);
    })));
    db.close();
    return { tasks, images: images.map(({ blob, ...image }) => ({ ...image, hasBlob: Boolean(blob) })) };
  });
  async function waitCompleted(prompt, count = 1) {
    await until(async () => {
      const data = await history();
      const task = data.tasks.find(task => task.prompt === prompt);
      return task && data.images.filter(image => image.taskId === task.id && image.status === "done" && image.hasBlob).length === count;
    }, 20000);
  }
  async function submit(prompt, count = 1) {
    await page.locator(".composer textarea").fill(prompt);
    await page.locator(".count-control input").fill(String(count));
    await page.locator(".generate-button").click();
  }

  await page.goto(url);
  await page.locator("#accountButton").click();
  await page.locator("#accountPanel input[type=email]").fill("browser@example.invalid");
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await until(async () => (await page.locator("#accountPanel input[autocomplete=one-time-code]").inputValue()).length === 6);
  await page.locator("#accountPanel").getByRole("button", { name: "登录", exact: true }).click();
  await page.locator("#accountButton").filter({ hasText: "browser@" }).waitFor();
  console.log("PASS 开发验证码浏览器登录");

  await submit("completed");
  await waitCompleted("completed");
  const before = (await history()).tasks.find(task => task.prompt === "completed");
  assert.equal(before.costCredits, 0.05);
  assert.equal(before.remainingCreditsSnapshot, 4.95);
  await page.reload();
  await page.locator(".history-task").first().waitFor();
  assert.match(await page.locator(".history-task").first().innerText(), /0.05 点/);
  assert.match(await page.locator(".history-task").first().innerText(), /余额 4.95/);
  console.log("PASS 历史扣点和余额刷新保留");

  f.hold();
  await submit("refresh-pending");
  await until(() => f.pending.length === 1);
  await page.reload();
  await page.locator(".history-task").first().waitFor();
  f.release();
  await waitCompleted("refresh-pending");
  assert.equal(f.data().generationHistory.filter(item => item.prompt === "refresh-pending").length, 1);
  console.log("PASS 生成中刷新自动恢复且不重复提交");

  f.hold();
  await page.route("**/api/generate", async route => {
    await route.fetch();
    await route.abort("connectionfailed");
  });
  await submit("lost-response");
  await until(() => f.pending.length === 1);
  await until(async () => (await history()).images.some(image => image.status === "error" && image.recoverable));
  await page.unroute("**/api/generate");
  await page.reload();
  f.release();
  await waitCompleted("lost-response");
  assert.equal(f.data().generationHistory.filter(item => item.prompt === "lost-response").length, 1);
  assert.equal(f.requests.filter(item => JSON.parse(item.body).prompt?.includes("lost-response")).length, 1);
  console.log("PASS 202 响应丢失后按客户端 ID 恢复、不重复扣费");

  f.hold();
  await submit("partial-eight", 8);
  await until(() => f.pending.length === 8);
  f.pending.splice(0, 3).forEach(reply => reply());
  await waitCompleted("partial-eight", 3);
  await page.reload();
  f.release();
  await waitCompleted("partial-eight", 8);
  await page.reload();
  await page.locator(".history-task").first().waitFor();
  const multi = (await history()).tasks.find(task => task.prompt === "partial-eight");
  assert.equal(multi.costCredits, 0.4);
  assert.equal(f.data().generationHistory.filter(item => item.prompt === "partial-eight").length, 8);
  console.log("PASS 多图部分完成后刷新，8 张全部保存，累计扣点 0.40");

  const balanceBeforeRestart = f.data().users[0].credits;
  f.hold();
  await submit("browser-restart");
  await until(() => f.pending.length === 1);
  await f.stop();
  f.release();
  await f.start();
  await page.reload();
  await until(async () => (await history()).images.some(image => image.status === "error" && image.error.includes("返还")));
  assert.equal(f.data().users[0].credits, balanceBeforeRestart);
  console.log("PASS 服务重启后浏览器显示退款结果");

  const ownerCookie = (await page.context().cookies()).find(cookie => cookie.name === "image2_session");
  f.hold();
  await submit("account-isolation");
  await until(() => f.pending.length === 1);
  const other = await f.login("second-browser@example.invalid");
  await page.context().addCookies([{ ...ownerCookie, value: other.cookie.split("=")[1] }]);
  await page.reload();
  await page.locator("#accountButton").filter({ hasText: "second-browser@" }).waitFor();
  f.release();
  await until(() => f.data().generationHistory.some(record => record.prompt === "account-isolation" && record.status === "succeeded"));
  await sleep(3000);
  const switchedData = await history();
  const ownedTask = switchedData.tasks.find(task => task.prompt === "account-isolation");
  assert(switchedData.images.filter(image => image.taskId === ownedTask.id).every(image => image.status !== "done"));
  assert.equal(f.data().users.find(user => user.id === other.body.user.id).credits, 5);
  await page.context().addCookies([ownerCookie]);
  await page.reload();
  await waitCompleted("account-isolation");
  assert.equal(f.data().generationHistory.filter(record => record.prompt === "account-isolation").length, 1);
  console.log("PASS 账号切换不会恢复或扣费到其他账号，切回后可恢复");

  await checkRedesignedCanvas(page, url, f);

  await checkCanvasInteractions(page, url, f.png);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.locator(".composer textarea").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.equal(new URL(page.url()).searchParams.get("mode"), null);
  assert.deepEqual(errors, []);
  console.log("PASS 经典模式 390px 烟测和浏览器异常检查");
} finally {
  await browser?.close();
  await vite?.close();
  await f.close();
}

await import("./canvas-regressions.mjs");
