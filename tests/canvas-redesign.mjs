import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { fixture, until, sleep } from "./helpers/fixture.mjs";

export async function checkRedesignedCanvas(page, url, f) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const sent = [];
  page.on("request", request => {
    if (request.method() === "POST" && request.url().endsWith("/api/generate")) sent.push(request.postDataJSON());
  });
  const snapshot = () => page.evaluate(async () => {
    const m = await import("/src/lib/canvas-db.js");
    return m.loadCanvasSnapshot(new URL(location.href).searchParams.get("canvas"));
  });
  const prompt = page.getByTestId("canvas-draft-prompt");
  const generate = page.getByTestId("canvas-generate");
  // Read via the service so Windows tests do not hold the live ledger file open during atomic rename.
  const serverRecords = async () => (await f.request("/api/admin/generation-history?pageSize=100", { admin: true })).body.records;
  const inspect = page.locator(".canvas-inspector");
  const node = id => page.locator(`[data-node-id="${id}"]`);
  async function saved() { await sleep(750); return snapshot(); }
  async function complete(count = 1) {
    await until(async () => (await page.locator('.canvas-node[data-node-type="history-image"] > img').count()) >= count, 20000);
  }
  await page.goto(`${url}/?mode=canvas`);
  await page.locator(".canvas-project-new-card").click();
  await page.locator(".canvas-project-card-open").first().waitFor();
  assert.equal(await page.locator(".canvas-stage").count(), 0);
  await page.locator(".canvas-project-card-open").first().click();
  await inspect.getByRole("button", { name: "新建生成", exact: true }).click();
  await prompt.fill("第一张草稿尚未提交");
  await inspect.getByLabel("图片模型", { exact: true }).selectOption("gpt-image-2.5-sunburst");
  const first = (await saved()).drafts[0];
  assert.equal(first.prompt, "第一张草稿尚未提交");
  await page.locator(".canvas-hidden-upload").first().setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: f.png });
  await inspect.getByRole("button", { name: "基于此图修改", exact: true }).waitFor();
  const uploaded = (await saved()).nodes.find(item => item.type === "upload");
  assert.equal((await snapshot()).drafts[0].refs.length, 0);
  await inspect.getByRole("button", { name: "返回正在编辑的草稿" }).click();
  assert.equal(await prompt.inputValue(), first.prompt);
  await inspect.getByRole("button", { name: "画布选择", exact: true }).click();
  await node(uploaded.id).click();
  assert.equal((await saved()).drafts[0].refs.length, 0, "picker does not mutate before Done");
  await page.locator(".canvas-reference-picker-banner").getByRole("button", { name: "取消", exact: true }).click();
  assert.equal((await snapshot()).drafts[0].refs.length, 0);
  await inspect.getByRole("button", { name: "画布选择", exact: true }).click();
  await node(uploaded.id).click();
  await page.getByRole("button", { name: "完成选择", exact: true }).click();
  assert.equal(await inspect.locator(".canvas-reference-item").count(), 1);
  await prompt.fill("第一轮真实输入");
  await inspect.getByLabel("数量", { exact: true }).fill("2");
  const viewBefore = (await saved()).viewport;
  f.hold();
  await generate.click();
  await until(() => f.pending.length === 2);
  assert.equal(sent.at(-1).referenceImages.length, 1);
  assert.equal(sent.at(-1).model, "gpt-image-2.5-sunburst");
  await prompt.fill("正在写下一轮，不应被覆盖");
  f.release();
  await complete(2);
  const completed = await saved();
  assert.equal(completed.runs.length, 1);
  assert.equal(completed.runs[0].snapshot.inputPrompt, "第一轮真实输入");
  assert.equal(completed.drafts[0].prompt, "正在写下一轮，不应被覆盖");
  assert.deepEqual(completed.viewport, viewBefore);
  assert.equal(await page.locator('[data-node-type="generation"]').count(), 1);
  assert.equal(await page.locator(".canvas-result-group").count(), 1);
  const output = completed.nodes.find(item => item.type === "history-image");
  await page.getByTitle("适应内容", { exact: true }).click();
  await node(output.id).click();
  await inspect.getByRole("button", { name: "返回正在编辑的草稿" }).click();
  assert.equal(await prompt.inputValue(), "正在写下一轮，不应被覆盖");
  await node(output.id).click();
  await inspect.getByRole("button", { name: "基于此图修改", exact: true }).click();
  assert.equal(await prompt.inputValue(), "");
  const second = (await saved()).drafts.at(-1);
  assert.deepEqual(second.refs.map(ref => ref.nodeId), [output.id]);
  assert.equal(second.count, 1);
  await prompt.fill("只修改这张结果图");
  await page.reload();
  await prompt.waitFor();
  assert.equal(await prompt.inputValue(), "只修改这张结果图");
  assert.equal(await inspect.locator(".canvas-reference-item").count(), 1);
  console.log("PASS 草稿独立、选择不改输入、选图原子确认、不可变运行快照、生成不移动视口、续作只引用当前图片、刷新恢复");

  // Removing a node hides its geometry, never silently drops draft input or the retained blob.
  await page.getByTitle("适应内容", { exact: true }).click();
  await node(output.id).click();
  await page.keyboard.press("Delete");
  await inspect.getByRole("button", { name: "返回正在编辑的草稿" }).click().catch(() => {});
  const hidden = await saved();
  assert(hidden.nodes.find(item => item.id === output.id).hidden);
  assert.deepEqual(hidden.drafts.at(-1).refs.map(ref => ref.nodeId), [output.id]);
  await generate.click();
  await until(() => sent.length === 3);
  assert.equal(sent.at(-1).referenceImages.length, 1);
  await complete(2);
  await inspect.getByTitle("移除参考", { exact: true }).click();
  assert.equal(await inspect.locator(".canvas-reference-item").count(), 0);
  await prompt.fill("@");
  await page.locator(".canvas-mention-menu button").filter({ hasText: "reference.png" }).click();
  assert(!((await prompt.inputValue()).includes("canvas:")));
  assert.equal(await inspect.locator(".canvas-reference-item").count(), 1);
  await prompt.fill("仅图片不允许空提示词");
  await prompt.fill("");
  assert.equal(await generate.isEnabled(), false);
  console.log("PASS 隐藏节点仍保留明确引用、移除参考同步输入、@ 统一加入参考列表、只有图片时不能空提示词提交");

  // Annotation creates a new asset; the source image and all submitted inputs stay intact.
  await node(uploaded.id).click();
  await inspect.getByRole("button", { name: "标注修改", exact: true }).click();
  await until(() => page.getByRole("button", { name: "使用标注图", exact: true }).isEnabled());
  const annotation = await page.locator(".canvas-annotation-surface canvas").boundingBox();
  await page.mouse.move(annotation.x + annotation.width * .3, annotation.y + annotation.height * .3);
  await page.mouse.down();
  await page.mouse.move(annotation.x + annotation.width * .6, annotation.y + annotation.height * .6, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "使用标注图", exact: true }).click();
  await until(async () => (await saved()).drafts.length === 3);
  const annotated = await snapshot();
  assert(!annotated.nodes.find(item => item.id === uploaded.id).annotationBlob);
  assert(annotated.nodes.some(item => item.sourceNodeId === uploaded.id && item.hidden && item.assetBlob));
  assert(!((await prompt.inputValue()).includes("@[")));
  await generate.click();
  await until(() => sent.length === 4);
  assert.notEqual(sent.at(-1).referenceImages[0].dataUrl.split(",")[1], f.png.toString("base64"));
  await complete(3);
  console.log("PASS 标注另存新素材及独立草稿、原图不变、实际编辑请求使用标注版本");

  await inspect.getByRole("button", { name: "另建一个草稿", exact: true }).click();
  await prompt.fill("部分失败运行快照");
  await inspect.getByLabel("数量", { exact: true }).fill("2");
  f.hold();
  const batchStart = sent.length;
  await generate.click();
  await until(() => f.pending.length === 2);
  f.pending.shift()();
  await until(async () => (await serverRecords()).some(item => item.prompt === "部分失败运行快照" && item.status === "succeeded"));
  f.setResponseStatus(400);
  f.release();
  await until(async () => (await serverRecords()).some(item => item.prompt === "部分失败运行快照" && item.status === "failed"));
  f.setResponseStatus(200);
  await prompt.fill("已编辑的草稿不应影响重试");
  await page.getByTestId("canvas-history-trigger").click();
  await page.locator(".canvas-library-tabs").getByRole("button", { name: "运行记录", exact: true }).click();
  const originalRun = page.locator(".canvas-library-runs .canvas-run-details").first();
  await originalRun.getByRole("button", { name: /重试失败 1 张/ }).click();
  await until(() => sent.length === batchStart + 3);
  assert.equal(sent.at(-1).prompt, "部分失败运行快照");
  await until(async () => (await serverRecords()).filter(item => item.prompt === "部分失败运行快照" && item.status === "succeeded").length === 2);
  assert.equal(sent.filter(item => item.prompt === "部分失败运行快照").length, 3);
  // Locate the original two-image batch after the new retry batch was prepended.
  const originalBatch = page.locator(".canvas-library-runs .canvas-run-details").nth(1);
  await originalBatch.getByRole("button", { name: /再生成一组/ }).click();
  await until(() => sent.length === batchStart + 5);
  assert(sent.slice(-2).every(item => item.prompt === "部分失败运行快照"));
  await until(async () => (await serverRecords()).filter(item => item.prompt === "部分失败运行快照" && item.status === "succeeded").length === 4);
  await page.locator(".canvas-library-runs .canvas-run-details").first().getByRole("button", { name: "复用生成参数", exact: true }).click();
  assert.equal(await prompt.inputValue(), "部分失败运行快照");
  assert.equal(await inspect.getByLabel("数量", { exact: true }).inputValue(), "2");
  console.log("PASS 部分失败只重试失败项、再次生成使用原始快照和数量、复用参数创建独立草稿");

  await prompt.fill("画布任务断线恢复");
  await inspect.getByLabel("数量", { exact: true }).fill("1");
  f.hold();
  await page.route("**/api/generate", async route => { await route.fetch(); await route.abort("connectionfailed"); });
  await generate.click();
  await until(() => f.pending.length === 1);
  await page.getByTestId("canvas-history-trigger").click();
  await page.locator(".canvas-library-tabs").getByRole("button", { name: "运行记录", exact: true }).click();
  const recovery = page.locator(".canvas-library-runs .canvas-run-details").first();
  await recovery.getByRole("button", { name: /恢复任务/ }).waitFor();
  await page.unroute("**/api/generate");
  await recovery.getByRole("button", { name: /恢复任务/ }).click();
  f.release();
  await until(async () => /已完成/.test(await recovery.innerText()), 20000);
  assert.equal(f.requests.filter(item => item.body.includes("画布任务断线恢复")).length, 1);
  assert.equal((await serverRecords()).filter(item => item.prompt === "画布任务断线恢复").length, 1);
  await page.getByTestId("canvas-history-panel").getByTitle("关闭").click();
  console.log("PASS Canvas 恢复原任务沿用请求 ID，不重复调用上游或重复扣费");

  // Consecutive pastes must each own their draft, and undo must restore the active editor.
  const originalDraftCount = (await saved()).drafts.length;
  await page.getByTitle("复制", { exact: true }).click();
  const paste = async (x, y) => {
    await page.mouse.move(x, y);
    await page.evaluate(() => window.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: new DataTransfer() })));
    await sleep(100);
  };
  await paste(180, 150);
  await paste(180, 400);
  const pasted = await saved();
  assert.equal(pasted.drafts.length, originalDraftCount + 2);
  const visibleDraftIds = pasted.nodes.filter(item => item.type === "generation" && !item.hidden).map(item => item.draftId);
  assert.equal(new Set(visibleDraftIds).size, visibleDraftIds.length);
  assert.equal(await prompt.inputValue(), "画布任务断线恢复");
  const activeBeforeUndo = pasted.settings.activeDraftId;
  await page.getByTitle("撤销", { exact: true }).click();
  const undone = await saved();
  assert.notEqual(undone.settings.activeDraftId, activeBeforeUndo);
  assert(undone.nodes.some(item => item.draftId === undone.settings.activeDraftId && !item.hidden));
  assert.equal(undone.runs.length, pasted.runs.length);
  await page.getByTitle("重做", { exact: true }).click();
  assert.equal((await saved()).settings.activeDraftId, activeBeforeUndo);
  console.log("PASS 连续粘贴生成卡拥有独立草稿、撤销重做恢复编辑目标且不撤销运行");

  mkdirSync("tmp/canvas-redesign", { recursive: true });
  await page.getByTitle("适应内容", { exact: true }).click();
  await page.screenshot({ path: "tmp/canvas-redesign/workspace.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  const toolbarBox = await page.locator(".wuli-canvas-toolbar").boundingBox();
  const zoomBox = await page.locator(".wuli-zoom-controls").boundingBox();
  assert(toolbarBox.x + toolbarBox.width <= zoomBox.x || toolbarBox.y >= zoomBox.y + zoomBox.height);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1024);
  await inspect.getByTitle("收起面板", { exact: true }).click();
  await page.getByTitle("展开面板", { exact: true }).click();
  assert.equal(await prompt.inputValue(), "画布任务断线恢复");
  await page.screenshot({ path: "tmp/canvas-redesign/workspace-1024.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.deepEqual(errors, []);
  return { snapshot, sent };
}

if (process.argv[1]?.endsWith("canvas-redesign.mjs")) {
  const f = await fixture(`redesign-${Date.now()}`);
  let vite, browser;
  try {
    vite = await createServer({ server: { host: "127.0.0.1", port: 0, proxy: { "/api": { target: f.api } } } });
    await vite.listen();
    const url = `http://127.0.0.1:${vite.httpServer.address().port}`;
    browser = await chromium.launch({ headless: true, channel: process.platform === "win32" ? "msedge" : "chromium" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const login = await f.login("canvas-redesign@example.invalid");
    await page.context().addCookies([{ name: "image2_session", value: login.cookie.split("=")[1], url }]);
    await checkRedesignedCanvas(page, url, f);
  } finally { await browser?.close(); await vite?.close(); await f.close(); }
}
