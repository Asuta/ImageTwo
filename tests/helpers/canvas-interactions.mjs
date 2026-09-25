import assert from "node:assert/strict";
import { until, sleep } from "./fixture.mjs";

export async function checkCanvasInteractions(page, url, png) {
  await page.goto(`${url}/?mode=canvas`);
  await page.locator(".canvas-project-new-card").click();
  await page.locator(".canvas-project-card").first().waitFor();
  assert.equal(await page.locator(".canvas-stage").count(), 0);
  await page.locator(".canvas-project-more").first().click();
  await page.locator(".canvas-project-menu").getByRole("button", { name: "重命名", exact: true }).click();
  await page.locator(".canvas-project-card-copy input").fill("交互回归");
  await page.locator(".canvas-project-card-copy input").press("Enter");
  await page.locator(".canvas-project-search input").fill("交互回归");
  await until(async () => await page.locator(".canvas-project-card").count() === 1);
  await page.locator(".canvas-project-card-open").click();
  await page.locator(".canvas-stage").waitFor();
  const canvasUrl = page.url();
  const canvasId = new URL(canvasUrl).searchParams.get("canvas");
  await page.goBack();
  await page.locator(".canvas-projects-page.is-active").waitFor();
  await page.goForward();
  await page.locator(".canvas-stage").waitFor();

  const snapshot = () => page.evaluate(async id => {
    const { loadCanvasSnapshot } = await import("/src/lib/canvas-db.js");
    const saved = await loadCanvasSnapshot(id);
    return { nodes: saved.nodes.map(({ assetBlob, annotationBlob, ...node }) => node), viewport: saved.viewport };
  }, canvasId);
  const node = id => page.locator(`[data-node-id="${id}"]`);
  async function drag(locator, dx, dy) {
    const box = await locator.boundingBox();
    assert(box);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    await page.mouse.up();
  }
  async function settled() { await sleep(700); }
  async function focusStage() { await page.mouse.click(1350, 130); }

  await page.locator('.wuli-canvas-toolbar > button[title="添加图像节点"]').click();
  await page.locator(".wuli-add-menu").getByRole("button", { name: /添加文本节点/ }).click();
  const textNode = page.locator(".canvas-node.is-text-node");
  await textNode.waitFor();
  const textId = await textNode.getAttribute("data-node-id");
  await textNode.locator("textarea").dblclick();
  await textNode.locator("textarea").fill("上游文本上下文");
  await focusStage();
  await textNode.click();
  assert.equal(await textNode.locator(".canvas-resize-handle").count(), 8);
  await settled();
  const textBefore = (await snapshot()).nodes.find(item => item.id === textId);
  for (const [direction, dx, dy] of [
    ["nw", -8, -8], ["n", 0, -8], ["ne", 8, -8], ["e", 8, 0],
    ["se", 8, 8], ["s", 0, 8], ["sw", -8, 8], ["w", -8, 0]
  ]) await drag(textNode.locator(`.canvas-resize-handle.is-${direction}`), dx, dy);
  await drag(textNode.locator("textarea"), -150, -80);
  await settled();
  const textAfter = (await snapshot()).nodes.find(item => item.id === textId);
  assert(textAfter.width > textBefore.width);
  assert(textAfter.height > textBefore.height);
  assert.notEqual(textAfter.x, textBefore.x);

  await page.keyboard.press("Control+d");
  await until(async () => await page.locator("[data-node-id]").count() === 2);
  await page.keyboard.press("Control+z");
  await until(async () => await page.locator("[data-node-id]").count() === 1);
  await page.keyboard.press("Control+y");
  await until(async () => await page.locator("[data-node-id]").count() === 2);
  await page.locator('button[title="复制"]').click();
  await page.mouse.move(1080, 240);
  // 无头浏览器不保证空系统剪贴板触发原生 paste，直接派发标准粘贴事件。
  await page.evaluate(() => window.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: new DataTransfer() })));
  await until(async () => await page.locator("[data-node-id]").count() === 3);
  const pasted = await page.locator(".canvas-node.is-selected").boundingBox();
  assert(Math.abs(pasted.x + pasted.width / 2 - 1080) < 3);
  assert(Math.abs(pasted.y + pasted.height / 2 - 240) < 3);

  await focusStage();
  await page.mouse.move(1100, 700);
  const planeBefore = await page.locator(".canvas-plane").getAttribute("style");
  await page.mouse.wheel(35, 90);
  await until(async () => await page.locator(".canvas-plane").getAttribute("style") !== planeBefore);
  const zoomBefore = await page.locator(".canvas-zoom-value").innerText();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await until(async () => await page.locator(".canvas-zoom-value").innerText() !== zoomBefore);
  assert.equal(await page.evaluate(() => visualViewport.scale), 1);
  await page.mouse.move(1300, 120);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(1330, 150, { steps: 4 });
  await page.mouse.up({ button: "right" });
  assert.equal(await page.locator(".canvas-context-menu").count(), 0);
  await page.locator('[title="适应内容"]').click();
  await page.locator('[title="切换导航地图"]').click();
  await page.locator('[title="切换导航地图"]').click();

  // 用独立且已保存的布局测连线，以免前面的复制/平移影响几何断言。
  await page.goto(`${url}/?mode=canvas`);
  await page.evaluate(async id => {
    const { saveCanvasSnapshot } = await import("/src/lib/canvas-db.js");
    await saveCanvasSnapshot({ canvasId: id, nodes: [
      { id: "source", type: "text", content: "上游文字", x: 280, y: 230, width: 250, height: 180 },
      { id: "target", type: "empty-image", x: 800, y: 230, width: 250, height: 180 }
    ], viewport: { x: 0, y: 0, zoom: 1 }, settings: { prompt: "" } });
  }, canvasId);
  await page.goto(canvasUrl);
  await node("target").waitFor();
  const sourceBall = node("source").locator(".is-output");
  const targetBall = node("target").locator(".is-input");
  await sourceBall.dragTo(targetBall);
  await until(async () => await page.locator(".canvas-connector-line").count() === 1);
  await node("target").click();
  assert.match(await page.locator(".canvas-composer").innerText(), /上游文字/);
  await page.locator(".wuli-reference-card").click();
  await until(async () => await page.locator(".canvas-connector-line").count() === 0);
  await targetBall.dragTo(sourceBall);
  await until(async () => await page.locator(".canvas-connector-line").count() === 1);
  const edge = page.locator(".canvas-connector-hit");
  const midpoint = await edge.evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
    return { x: screenPoint.x, y: screenPoint.y };
  });
  await page.mouse.click(midpoint.x, midpoint.y);
  await page.locator('.canvas-edge-toolbar [title="断开连线"]').click();
  await until(async () => await page.locator(".canvas-connector-line").count() === 0);

  for (const [origin, side, dropX, dropY] of [["source", "is-input", 150, 600], ["target", "is-output", 1200, 600]]) {
    const handle = node(origin).locator(`.${side}`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(dropX, dropY, { steps: 5 });
    await page.mouse.up();
    await page.locator(".canvas-connection-menu").waitFor();
    assert.equal(await page.locator(".canvas-connector-draft").count(), 1);
    await page.locator(".canvas-connection-menu").getByRole("button", { name: /文本/ }).click();
    await settled();
    assert.equal(await page.locator(".canvas-connector-draft").count(), 0);
  }
  await node("target").click();
  await page.locator('[title="添加参考"]').click();
  await page.locator(".wuli-reference-add-menu").getByRole("button", { name: "上传", exact: true }).click();
  await page.locator(".canvas-hidden-upload").nth(2).setInputFiles({ name: "direct.png", mimeType: "image/png", buffer: png });
  await until(async () => await page.locator(".wuli-reference-card").filter({ hasText: "direct.png" }).count() === 1);
  assert.equal(await page.locator("[data-node-id]").count(), 4);
  await settled();
  const saved = await snapshot();
  assert.equal(saved.nodes.find(item => item.id === "target").referenceAssets.length, 1);
  const planeBeforeGeneration = await page.locator(".canvas-plane").getAttribute("style");
  await page.locator(".canvas-composer textarea").fill("原地替换回归");
  await page.locator(".canvas-composer button[type=submit]").click();
  await until(async () => await page.locator('[data-node-id^="history-"] img').count() === 1);
  assert.equal(await node("target").count(), 0);
  assert.equal(await page.locator("[data-node-id]").count(), 4);
  assert.equal(await page.locator(".canvas-plane").getAttribute("style"), planeBeforeGeneration);
  await settled();
  const generatedNode = (await snapshot()).nodes.find(item => item.type === "history-image");
  assert.equal(generatedNode.x, 800);
  assert.equal(generatedNode.y, 230);
  await page.reload();
  await until(async () => await page.locator("[data-node-id]").count() === 4);
  assert.deepEqual((await snapshot()).viewport, saved.viewport);

  // 框选保留多节点；聚焦所选是明确的用户操作。
  await page.mouse.move(230, 190);
  await page.mouse.down();
  await page.mouse.move(1100, 450, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.locator(".canvas-node.is-selected").count(), 2);
  await page.keyboard.press("f");
  await page.locator('[data-testid="canvas-history-trigger"]').click();
  await page.locator(".canvas-history-scroll").waitFor();
  await focusStage();
  await until(async () => await page.locator(".canvas-history-scroll").count() === 0);

  await page.goto(`${url}/?mode=canvas`);
  await page.locator(".canvas-project-search input").fill("交互回归");
  await page.locator(".canvas-project-more").click();
  await page.locator(".canvas-project-menu .is-danger").click();
  await page.locator(".canvas-project-delete-dialog .is-danger").click();
  await until(async () => await page.locator(".canvas-project-card").count() === 0);
  await page.evaluate(async () => {
    const { createCanvasProject } = await import("/src/lib/canvas-db.js");
    for (let i = 0; i < 18; i++) await createCanvasProject({ title: `滚动测试 ${i}` });
  });
  await page.reload();
  await until(async () => await page.locator(".canvas-project-card").count() >= 18);
  const lastCard = page.locator(".canvas-project-card").last();
  await lastCard.scrollIntoViewIfNeeded();
  const lastBox = await lastCard.boundingBox();
  assert(lastBox.y >= 0 && lastBox.y < 1000);
  console.log("PASS Canvas 项目导航/搜索/重命名/删除、节点编辑/八方向缩放、复制粘贴、撤销重做、平移缩放、双向连线、参考上传、刷新隔离");
}
