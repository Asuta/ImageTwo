import test from "node:test";
import assert from "node:assert/strict";
import { createGenerationDraft, addDraftReferences, resolveGenerationInput, snapshotGenerationInput, migrateCanvasModel, runFromTask, summarizeRun } from "../src/lib/canvas-model.js";

const nodes = [
  { id: "a", type: "upload", name: "A", contentHash: "same" },
  { id: "duplicate", type: "upload", name: "A copy", contentHash: "same" },
  { id: "b", type: "history-image", imageId: "result", parentIds: ["a"], hidden: true },
  { id: "text1", type: "text", content: "第一段" },
  { id: "text2", type: "text", content: "第二段" }
];
const getAsset = node => ({ blob: new Blob([node.id]), status: "done", mimeType: "image/png", name: node.id });

test("explicit inputs deduplicate and preserve order; parents, visibility and geometry never imply references", () => {
  const draft = createGenerationDraft({ id: "draft", refs: ["b"], defaults: { prompt: "修改" } });
  draft.refs = addDraftReferences(draft, ["text2", "a", "duplicate", "text1", "b"], nodes);
  assert.deepEqual(draft.refs.map(ref => ref.nodeId), ["b", "text2", "a", "text1"]);
  const input = resolveGenerationInput(draft, nodes, getAsset);
  assert.equal(input.prompt, "第二段\n\n第一段\n\n修改");
  assert.deepEqual(input.images.map(image => image.nodeId), ["b", "a"]);
  const continuation = resolveGenerationInput({ ...draft, refs: [{ nodeId: "b" }] }, nodes, getAsset);
  assert.deepEqual(continuation.images.map(image => image.nodeId), ["b"]);
});

test("preview and request snapshot are identical and frozen against later draft and asset edits", () => {
  const draft = createGenerationDraft({ id: "draft", refs: ["text1", "a"], defaults: { prompt: "本轮要求" } });
  const input = resolveGenerationInput(draft, nodes, getAsset);
  const snapshot = snapshotGenerationInput(draft, input);
  draft.prompt = "修改后的草稿";
  input.inputs[0].content = "后来改变";
  assert.equal(snapshot.prompt, "第一段\n\n本轮要求");
  assert.equal(snapshot.inputs[0].content, "第一段");
  assert.equal(snapshot.inputPrompt, "本轮要求");
});

test("missing inputs and image-only prompts are not silently accepted", () => {
  let input = resolveGenerationInput({ refs: [{ nodeId: "a" }] }, nodes, getAsset);
  assert.equal(input.hasPrompt, false);
  input = resolveGenerationInput({ prompt: "yes", refs: [{ nodeId: "missing" }, { nodeId: "a" }] }, nodes, () => ({ status: "loading" }));
  assert.deepEqual(input.errors.map(error => error.reason), ["missing", "missing-image"]);
});

test("migration preserves layout and separates ambiguous legacy links from explicit inputs", () => {
  const old = { nodes: [
    { id: "image", type: "history-image", parentIds: ["old-parent"], x: 120, y: 230, width: 320, height: 260 },
    { id: "placeholder", type: "empty-image", x: 480, y: 230, width: 300, height: 260, parentIds: ["image"],
      referenceAssets: [{ id: "direct", blob: new Blob(["x"]), name: "Direct" }] }
  ], settings: { prompt: "旧草稿 @[result](canvas:image)", model: "gpt-image-2.5-sunburst" }, viewport: { x: 10, y: 20, zoom: .7 } };
  const migrated = migrateCanvasModel(old);
  assert.equal(old.nodes[1].type, "empty-image");
  assert.deepEqual(migrated.nodes[0].legacyParentIds, ["old-parent"]);
  assert.equal(migrated.nodes[0].parentIds, undefined);
  assert.equal(migrated.nodes[1].type, "generation");
  assert.deepEqual(migrated.drafts[0].refs.map(ref => ref.nodeId), ["image", "asset-placeholder-direct"]);
  assert.equal(migrated.drafts[0].prompt, "");
  assert.equal(migrated.drafts[1].prompt, "旧草稿");
  assert.deepEqual(migrated.drafts[1].refs, [{ nodeId: "image" }]);
  assert.deepEqual(migrated.viewport, old.viewport);
  assert.strictEqual(migrateCanvasModel(migrated), migrated);
});

test("runs distinguish terminal failure, recoverable interruption and completed outputs", () => {
  const task = { id: "task", prompt: "old", images: [
    { id: "a", status: "done" }, { id: "b", status: "error", recoverable: false },
    { id: "c", status: "error", recoverable: true }
  ] };
  const run = runFromTask(task);
  const result = summarizeRun(run, [task]);
  assert.equal(result.done, 1); assert.equal(result.failed, 1); assert.equal(result.recoverable, 1);
  assert.equal(result.status, "recoverable");
  assert.equal(run.snapshot.legacy, true);
});
