import { DEFAULT_IMAGE_MODEL, normalizeImageModel } from "./image-models.js";

export const CANVAS_SCHEMA_VERSION = 3;
export const MAX_CANVAS_REFERENCES = 8;
export const GENERATION_NODE_SIZE = { width: 300, height: 200 };
export const isCanvasAsset = node => ["upload", "history-image", "text"].includes(node?.type);
export const assetIdentity = node => node?.contentHash || (node?.type === "history-image" ? `history:${node.imageId}` : node?.id);

export function createGenerationDraft({ id, title = "生成", defaults = {}, refs = [] }) {
  return {
    id, title, prompt: "", model: DEFAULT_IMAGE_MODEL, aspectRatio: "auto", quality: "medium", count: 1,
    ...defaults, refs: refs.map(ref => typeof ref === "string" ? { nodeId: ref } : { ...ref }), revision: 1
  };
}

export function addDraftReferences(draft, nodeIds, nodes) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const identities = new Set();
  const refs = draft.refs.filter(ref => {
    const identity = assetIdentity(nodeMap.get(ref.nodeId)) || ref.nodeId;
    if (identities.has(identity)) return false;
    identities.add(identity);
    return true;
  });
  for (const nodeId of nodeIds) {
    const node = nodeMap.get(nodeId);
    if (!isCanvasAsset(node)) continue;
    const identity = assetIdentity(node);
    if (identities.has(identity)) continue;
    refs.push({ nodeId });
    identities.add(identity);
  }
  return refs;
}

// 预览与提交共用此函数；选择、图形坐标和旧父子关系都不是输入。
export function resolveGenerationInput(draft, nodes, getAsset) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const inputs = [], images = [], texts = [], errors = [];
  const identities = new Set();
  for (const ref of draft?.refs || []) {
    const node = nodeMap.get(ref.nodeId);
    const identity = assetIdentity(node) || ref.nodeId;
    if (identities.has(identity)) continue;
    identities.add(identity);
    if (!node || !isCanvasAsset(node)) {
      errors.push({ nodeId: ref.nodeId, name: ref.name || "引用素材", reason: "missing" });
      continue;
    }
    const asset = getAsset(node);
    const entry = { nodeId: node.id, name: node.title || node.name || asset.name || "素材", hidden: Boolean(node.hidden) };
    if (node.type === "text") {
      const content = String(node.content || "").trim();
      if (!content) errors.push({ ...entry, reason: "empty-text" });
      texts.push({ ...entry, kind: "text", content });
      inputs.push({ ...entry, kind: "text", content });
    } else {
      if (!asset.blob || asset.status !== "done") errors.push({ ...entry, reason: "missing-image" });
      images.push({ ...entry, ...asset, nodeId: node.id, kind: "image" });
      inputs.push({ ...entry, kind: "image", mimeType: asset.mimeType });
    }
  }
  if (images.length > MAX_CANVAS_REFERENCES) errors.push({ reason: "too-many-images", name: "图片参考" });
  const inputPrompt = String(draft?.prompt || "").trim();
  const prompt = [...texts.map(item => item.content), inputPrompt].filter(Boolean).join("\n\n");
  return { prompt, inputPrompt, inputs, images, texts, errors, hasPrompt: Boolean(prompt) };
}

export function snapshotGenerationInput(draft, resolved) {
  return {
    inputPrompt: resolved.inputPrompt, prompt: resolved.prompt,
    inputs: resolved.inputs.map(input => ({ ...input })),
    model: normalizeImageModel(draft.model), aspectRatio: draft.aspectRatio, quality: draft.quality,
    count: Math.max(1, Math.min(8, Number(draft.count) || 1)), revision: draft.revision
  };
}

export function runFromTask(task) {
  const context = task.canvasContext || {};
  return {
    id: context.runId || `run-${task.id}`, taskId: task.id,
    draftId: context.draftId || "", draftNodeId: context.draftNodeId || "", createdAt: task.createdAt,
    snapshot: context.inputSnapshot || {
      inputPrompt: context.inputPrompt ?? task.prompt, prompt: task.prompt,
      inputs: (task.referenceImages || []).map(image => ({ kind: "image", name: image.name || "历史参考图", mimeType: image.type })),
      model: normalizeImageModel(task.model), aspectRatio: task.aspectRatio || "auto",
      quality: task.quality || "medium", count: task.count || task.images?.length || 1,
      revision: null, legacy: true
    }
  };
}

export function summarizeRun(run, history) {
  const task = history.find(item => item.id === run.taskId);
  const images = task?.images || [];
  const done = images.filter(image => image.status === "done").length;
  const recoverable = images.filter(image => image.recoverable && image.status === "error").length;
  const failed = images.filter(image => image.status === "error" && !image.recoverable).length;
  const pending = images.filter(image => ["loading", "streaming"].includes(image.status)).length;
  return { task, done, failed, pending, recoverable, total: images.length || run.snapshot.count,
    status: !task ? "missing" : pending ? "running" : recoverable ? "recoverable" : failed ? (done ? "partial" : "failed") : "done" };
}

export function migrateCanvasModel(snapshot) {
  if (snapshot.schemaVersion === CANVAS_SCHEMA_VERSION) return snapshot;
  const settings = snapshot.settings || {};
  const nodes = snapshot.nodes.map(node => ({ ...node, x: Number(node.x) || 0, y: Number(node.y) || 0,
    width: Number(node.width) || 300, height: Number(node.height) || 260 }));
  const drafts = [...(snapshot.drafts || [])];
  const defaults = { model: normalizeImageModel(settings.model), aspectRatio: settings.aspectRatio || "auto", quality: settings.quality || "medium", count: settings.count || 1 };
  const additions = [];
  const makeDraft = (node, refs, title) => {
    const id = `draft-${node.id}`;
    drafts.push(createGenerationDraft({ id, title, defaults, refs }));
    return id;
  };
  for (const node of nodes) {
    const explicitIds = [...(node.referenceNodeIds || [])];
    for (const reference of node.referenceAssets || []) {
      const id = `asset-${node.id}-${reference.id}`;
      additions.push({ id, type: "upload", name: reference.name || "旧参考图", mimeType: reference.mimeType,
        assetBlob: reference.blob, hidden: true, x: node.x, y: node.y, width: 300, height: 260, createdAt: node.createdAt });
      explicitIds.push(id);
    }
    if (node.type === "empty-image") {
      const draftId = makeDraft(node, [...new Set([...(node.parentIds || []), ...explicitIds])], "迁移的生成草稿");
      Object.assign(node, { type: "generation", draftId });
    } else if (explicitIds.length) {
      const id = `generation-${node.id}`;
      const draftId = makeDraft({ id }, [...new Set(explicitIds)], "旧参考草稿");
      additions.push({ id, type: "generation", draftId, x: node.x + node.width + 76, y: node.y,
        ...GENERATION_NODE_SIZE, hidden: node.hidden, createdAt: node.createdAt });
    }
    if (node.type !== "generation" && node.parentIds?.length) node.legacyParentIds = [...node.parentIds];
    delete node.parentIds;
    delete node.referenceNodeIds;
    delete node.referenceAssets;
  }
  if (String(settings.prompt || "").trim()) {
    const id = "generation-recovered-prompt";
    const draftId = makeDraft({ id }, [], "未归属草稿");
    // 旧 @ 是显式引用；其余上游关系不能当成实际输入。
    const draft = drafts.at(-1);
    const mentions = [...settings.prompt.matchAll(/@\[[^\]]+\]\(canvas:([^)]+)\)/g)].map(match => match[1]);
    draft.refs = mentions.map(nodeId => ({ nodeId }));
    draft.prompt = settings.prompt.replace(/@\[[^\]]+\]\(canvas:[^)]+\)/g, "").trim();
    additions.push({ id, type: "generation", draftId, ...GENERATION_NODE_SIZE,
      x: nodes.length ? Math.min(...nodes.map(n => n.x)) : 80,
      y: nodes.length ? Math.max(...nodes.map(n => n.y + n.height)) + 100 : 100, createdAt: new Date().toISOString() });
  }
  return { ...snapshot, schemaVersion: CANVAS_SCHEMA_VERSION, nodes: [...nodes, ...additions], drafts,
    runs: snapshot.runs || [], settings: { ...settings, prompt: "", activeDraftId: drafts[0]?.id || "" } };
}
