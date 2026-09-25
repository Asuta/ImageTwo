import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  CopyPlus,
  Download,
  Focus,
  GitBranch,
  Grid3X3,
  Hand,
  HelpCircle,
  History as HistoryIcon,
  Image,
  ImagePlus,
  Link2,
  LoaderCircle,
  MapPin,
  Maximize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Paintbrush,
  Plus,
  Redo2,
  Sparkles,
  Trash2,
  Type,
  Unlink,
  Undo2,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CanvasInspector, { CanvasRunDetails } from "@/components/canvas/CanvasInspector";
import { CANVAS_SCHEMA_VERSION, GENERATION_NODE_SIZE, isCanvasAsset, createGenerationDraft, addDraftReferences, resolveGenerationInput, snapshotGenerationInput, runFromTask, summarizeRun } from "@/lib/canvas-model";
import AnnotationEditor from "@/components/canvas/AnnotationEditor";
import { LEGACY_CANVAS_ID, loadCanvasSnapshot, saveCanvasSnapshot } from "@/lib/canvas-db";
import { formatCreditAmount, formatCreditBalance } from "@/lib/utils";
import { DEFAULT_IMAGE_MODEL } from "@/lib/image-models";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const MAX_REFERENCE_IMAGES = 8;
const MAX_GENERATION_COUNT = 8;
const SAVE_DEBOUNCE_MS = 500;
const MAX_UNDO_STEPS = 40;
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CONNECTION_HANDLE_OFFSET = 26;
const CONNECTION_SNAP_RADIUS_PX = 34;


const canvasCopy = {
  zh: {
    title: "无限画布",
    saved: "已自动保存",
    saving: "正在保存…",
    loading: "正在恢复画布…",
    select: "选择",
    hand: "抓手",
    upload: "上传图片",
    fit: "适应内容",
    focusSelected: "聚焦所选",
    continueFromNode: "基于此图修改",
    compareBranch: "查看来源与当前版本",
    rootNode: "起点",
    versionLabel: "版本 {count}",
    branchReady: "已选择续作起点，请输入修改要求。",
    branchReferences: "基于 {count} 个节点继续创作",
    undo: "撤销",
    redo: "重做",
    delete: "从画布移除",
    download: "下载所选图片",
    zoomOut: "缩小",
    zoomIn: "放大",
    emptyTitle: "在这里展开你的创意",
    emptyCopy: "新建生成草稿，添加参考素材，再逐步探索更多结果。",
    emptyAction: "添加图片",
    referenceHint: "选中的图片会作为下一次生成的参考",
    references: "已选 {count} 张参考图",
    removeReference: "取消参考",
    prompt: "描述你想生成或修改的画面…",
    promptHint: "Ctrl/⌘ + Enter 生成",
    ratio: "比例",
    quality: "质量",
    count: "数量",
    generate: "生成",
    loginGenerate: "登录后生成",
    generationCost: "预计消耗 {cost} 点",
    promptRequired: "请输入提示词或引用一个有内容的文本节点。",
    uploadOnlyImages: "请选择图片文件。",
    uploadFailed: "图片添加失败。",
    uploadPartial: "部分图片无法读取，其他图片已添加。",
    referenceLimit: "最多使用 {count} 张参考图。",
    missingReference: "所选图片还没有生成完成。",
    missingAsset: "本地图片已删除或暂时无法读取，节点和连线已保留。",
    taskFailed: "生成任务未能创建。",
    submitted: "已在画布中创建生成任务。",
    localAsset: "本地素材",
    generating: "生成中",
    receiving: "接收中",
    failed: "生成失败",
    interrupted: "上次生成被中断",
    preview: "双击预览",
    clear: "清空画布",
    clearConfirm: "清空画布布局？生成历史不会被删除，但上传到画布的本地素材会被移除。",
    hiddenHistory: "已从画布移除，经典模式中的历史仍会保留。",
    dragDrop: "松开即可添加到画布",
    nodeCount: "{count} 个画面",
    selectedCount: "已选择 {count} 项",
    exitClassic: "返回画布项目",
    projectTitle: "Image2 创意画布",
    share: "复制画布链接",
    shareDone: "画布链接已复制",
    addImageNode: "新建生成",
    addTextNode: "添加文本节点",
    addLocalImage: "添加本地图片",
    addUpstreamNode: "添加前置节点",
    addDownstreamNode: "添加后续节点",
    connectUpstream: "拖出前置输入",
    connectDownstream: "拖出后续输出",
    textNodeTitle: "文本节点",
    textNodePlaceholder: "输入创意、描述或分镜内容…",
    emptyImageTitle: "图片节点",
    emptyImageCopy: "选择此节点后描述画面，生成结果会从这里延展",
    close: "关闭",
    generatedHistory: "历史生成图片",
    generatedHistoryHint: "拖拽图片到画布中使用",
    generatedHistoryEmpty: "还没有可用的历史图片",
    generatedHistoryLoading: "正在读取历史图片…",
    generatedHistoryCount: "{count} 张",
    defaultMode: "默认模式",
    addReference: "添加参考",
    selectFromCanvas: "画布选择",
    uploadReference: "上传",
    referencePickerHint: "请在画布上选择要连接的节点",
    exitReferencePicker: "退出",
    selectSingleReferenceTarget: "请先选择一个目标节点。",
    invalidReferenceTarget: "不能把节点自身设为参考。",
    referenceAdded: "已添加 {count} 张参考图。",
    invalidReferenceSource: "请选择图片或文本节点作为参考。",
    imageModel: "图片模型",
    annotate: "标注"
  },
  en: {
    missingAsset: "The local image was removed or cannot be read. Its node and connections are preserved.",
    title: "Infinite Canvas",
    saved: "Saved locally",
    saving: "Saving…",
    loading: "Restoring canvas…",
    select: "Select",
    hand: "Hand",
    upload: "Upload images",
    fit: "Fit content",
    focusSelected: "Focus selected",
    continueFromNode: "Edit from this image",
    compareBranch: "View source and current version",
    rootNode: "Source",
    versionLabel: "Version {count}",
    branchReady: "Starting point selected. Describe the change you want.",
    branchReferences: "Continue from {count} selected node(s)",
    undo: "Undo",
    redo: "Redo",
    delete: "Remove from canvas",
    download: "Download selected",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    emptyTitle: "Build your ideas here",
    emptyCopy: "Create a draft, add references, and explore the results.",
    emptyAction: "Add images",
    referenceHint: "Selected images become references for the next generation",
    references: "{count} reference image(s) selected",
    removeReference: "Remove reference",
    prompt: "Describe what you want to generate or change…",
    promptHint: "Ctrl/⌘ + Enter to generate",
    ratio: "Ratio",
    quality: "Quality",
    count: "Count",
    generate: "Generate",
    loginGenerate: "Sign in to generate",
    generationCost: "Estimated cost: {cost} credits",
    promptRequired: "Enter a prompt or reference a text node with content.",
    uploadOnlyImages: "Choose image files.",
    uploadFailed: "Could not add the image.",
    uploadPartial: "Some images could not be read. The others were added.",
    referenceLimit: "Use up to {count} reference images.",
    missingReference: "The selected image has not finished generating.",
    taskFailed: "The generation task could not be created.",
    submitted: "Generation tasks were added to the canvas.",
    localAsset: "Local asset",
    generating: "Generating",
    receiving: "Receiving",
    failed: "Generation failed",
    interrupted: "Previous generation was interrupted",
    preview: "Double-click to preview",
    clear: "Clear canvas",
    clearConfirm: "Clear the canvas layout? Generation history stays intact, but local canvas uploads will be removed.",
    hiddenHistory: "Removed from canvas. The classic history is unchanged.",
    dragDrop: "Drop to add to canvas",
    nodeCount: "{count} visual(s)",
    selectedCount: "{count} selected",
    exitClassic: "Back to Canvas projects",
    projectTitle: "Image2 Creative Canvas",
    share: "Copy canvas link",
    shareDone: "Canvas link copied",
    addImageNode: "New generation",
    addTextNode: "Add text node",
    addLocalImage: "Add local image",
    addUpstreamNode: "Add upstream node",
    addDownstreamNode: "Add downstream node",
    connectUpstream: "Drag an upstream input",
    connectDownstream: "Drag a downstream output",
    textNodeTitle: "Text node",
    textNodePlaceholder: "Write an idea, description, or storyboard…",
    emptyImageTitle: "Image node",
    emptyImageCopy: "Select this node and describe the visual to branch from here",
    close: "Close",
    generatedHistory: "Generated history",
    generatedHistoryHint: "Drag an image onto the canvas",
    generatedHistoryEmpty: "No generated images yet",
    generatedHistoryLoading: "Loading generated images…",
    generatedHistoryCount: "{count} images",
    defaultMode: "Default mode",
    addReference: "Add reference",
    selectFromCanvas: "Select from canvas",
    uploadReference: "Upload",
    referencePickerHint: "Select a node on the canvas to use as a reference",
    exitReferencePicker: "Exit",
    selectSingleReferenceTarget: "Select one target node first.",
    invalidReferenceTarget: "A node cannot reference itself.",
    referenceAdded: "Added {count} reference image(s).",
    invalidReferenceSource: "Choose an image or text node as the reference.",
    imageModel: "Image model",
    annotate: "Annotate"
  }
};

function formatCopy(template, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function createLocalId(prefix = "canvas") {
  return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function revokeRuntimeUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function revokeNodeRuntimeUrls(node) {
  if (node.type === "upload") {
    revokeRuntimeUrl(node.url);
  }
  revokeRuntimeUrl(node.annotationUrl);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function readImageDimensions(blob) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new window.Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error("Unable to read image dimensions."));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

async function hashAsset(blob) {
  if (!blob) return "";
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function fitNodeSize(width, height, maximumWidth = 340, maximumHeight = 300) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const scale = Math.min(maximumWidth / safeWidth, maximumHeight / safeHeight, 1);
  const fittedWidth = Math.max(140, Math.round(safeWidth * scale));
  const fittedHeight = Math.max(120, Math.round(safeHeight * scale));
  return { width: fittedWidth, height: fittedHeight };
}

function sizeFromAspectRatio(aspectRatio) {
  if (aspectRatio === "auto") {
    return { width: 320, height: 320 };
  }

  const [widthPart, heightPart] = String(aspectRatio).split(":").map(Number);
  if (!widthPart || !heightPart) {
    return { width: 320, height: 320 };
  }

  const ratio = widthPart / heightPart;
  if (ratio >= 1) {
    return {
      width: 340,
      height: clamp(Math.round(340 / ratio), 120, 420)
    };
  }

  return {
    width: clamp(Math.round(340 * ratio), 120, 320),
    height: 340
  };
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog']"));
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CanvasWorkspace({
  active,
  canvasId,
  language = "zh",
  currentUser,
  generationCostCredits,
  history,
  historyLoading,
  onGenerate,
  onRecoverTask,
  onRequireLogin,
  onToast,
  onPreview,
  onExit
}) {
  const copy = canvasCopy[language] || canvasCopy.zh;
  const text = (key, values) => formatCopy(copy[key] || key, values);
  const [nodes, setNodes] = useState([]);
  const [viewport, setViewport] = useState({ x: 32, y: 32, zoom: 1 });
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingTextNodeId, setEditingTextNodeId] = useState("");
  const [tool, setTool] = useState("select");
  const [drafts, setDrafts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [activeDraftId, setActiveDraftId] = useState("");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [libraryTab, setLibraryTab] = useState("assets");
  const activeDraft = drafts.find(draft => draft.id === activeDraftId);
  const prompt = activeDraft?.prompt || "";
  const aspectRatio = activeDraft?.aspectRatio || "auto";
  const quality = activeDraft?.quality || "medium";
  const model = activeDraft?.model || DEFAULT_IMAGE_MODEL;
  const count = activeDraft?.count || 1;

  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [interactionType, setInteractionType] = useState("");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [nodeMoreOpen, setNodeMoreOpen] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [selectionBox, setSelectionBox] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const [connectionMenu, setConnectionMenu] = useState(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [linksVisible, setLinksVisible] = useState(true);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [annotationNodeId, setAnnotationNodeId] = useState("");
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [referencePicker, setReferencePicker] = useState(null);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyDragPreview, setHistoryDragPreview] = useState(null);
  const [pointerContextMenu, setPointerContextMenu] = useState(null);
  const [projectTitle, setProjectTitle] = useState(text("projectTitle"));
  const estimatedGenerationCost = Number.isFinite(generationCostCredits)
    ? formatCreditAmount(clamp(Number(count) || 1, 1, MAX_GENERATION_COUNT) * generationCostCredits)
    : "—";

  const stageRef = useRef(null);
  const promptRef = useRef(null);
  const canvasUploadInputRef = useRef(null);
  const pendingUploadPointRef = useRef(null);
  const connectionUploadInputRef = useRef(null);
  const pendingConnectionUploadRef = useRef(null);
  const referenceUploadInputRef = useRef(null);
  const referenceUploadTargetRef = useRef("");
  const textEditSnapshotRef = useRef(null);
  const textNodeInputRefs = useRef(new Map());
  const nodesRef = useRef(nodes);
  const viewportRef = useRef(viewport);
  const selectedIdsRef = useRef(selectedIds);
  const settingsRef = useRef({ aspectRatio, quality, count, model, activeDraftId });
  const draftsRef = useRef(drafts);
  const runsRef = useRef(runs);
  const submittingRef = useRef(false);
  const draftEditSnapshotRef = useRef(null);
  const interactionRef = useRef(null);
  const suppressContextMenuRef = useRef(false);
  const wheelEndTimerRef = useRef(0);
  const didInitialFitRef = useRef(false);
  const clipboardRef = useRef([]);
  const stagePointerClientRef = useRef(null);

  function commitNodes(nextValue) {
    const nextNodes = typeof nextValue === "function" ? nextValue(nodesRef.current) : nextValue;
    nodesRef.current = nextNodes;
    setNodes(nextNodes);
    return nextNodes;
  }

  function commitViewport(nextValue) {
    const nextViewport = typeof nextValue === "function" ? nextValue(viewportRef.current) : nextValue;
    viewportRef.current = nextViewport;
    setViewport(nextViewport);
    return nextViewport;
  }

  function commitDrafts(value) {
    const next = typeof value === "function" ? value(draftsRef.current) : value;
    draftsRef.current = next;
    setDrafts(next);
  }

  function commitRuns(value) {
    const next = typeof value === "function" ? value(runsRef.current) : value;
    runsRef.current = next;
    setRuns(next);
  }

  function updateDraft(id, patch, undo = false) {
    if (undo) recordUndoSnapshot();
    commitDrafts(previous => previous.map(draft => draft.id === id
      ? { ...draft, ...patch, revision: draft.revision + 1 } : draft));
  }

  function activateDraft(id, select = true) {
    settingsRef.current = { ...settingsRef.current, activeDraftId: id };
    setActiveDraftId(id);
    setPanelCollapsed(false);
    if (select) {
      const node = nodesRef.current.find(item => item.draftId === id);
      if (node) { selectedIdsRef.current = [node.id]; setSelectedIds([node.id]); }
    }
    setMentionMenuOpen(false);
  }

  function commitSetting(key, value) {
    const id = settingsRef.current.activeDraftId;
    updateDraft(id, { [key]: value }, !["prompt", "title"].includes(key));
    if (key !== "prompt") settingsRef.current = { ...settingsRef.current, [key]: value };
  }

  function persistCurrentSnapshot() {
    if (!hydrated) {
      return Promise.resolve();
    }
    return saveCanvasSnapshot({
      canvasId,
      nodes: nodesRef.current,
      viewport: viewportRef.current,
      settings: settingsRef.current,
      drafts: draftsRef.current, runs: runsRef.current, schemaVersion: CANVAS_SCHEMA_VERSION
    });
  }

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);



  useEffect(() => {
    let cancelled = false;

    loadCanvasSnapshot(canvasId)
      .then(async snapshot => {
        if (cancelled) {
          return;
        }

        setProjectTitle(snapshot.project?.title || text("projectTitle"));
        const restoredNodes = await Promise.all(snapshot.nodes.map(async node => ({
          ...node,
          contentHash: node.contentHash || (node.type === "upload" ? await hashAsset(node.annotationBlob || node.assetBlob) : ""),
          status: node.type === "upload" ? "done" : node.status,
          url: node.type === "upload" && node.assetBlob ? URL.createObjectURL(node.assetBlob) : "",
          annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : "",
        })));
        if (cancelled) { restoredNodes.forEach(revokeNodeRuntimeUrls); return; }
        commitNodes(restoredNodes);

        if (snapshot.viewport && Number.isFinite(snapshot.viewport.zoom)) {
          didInitialFitRef.current = true;
          commitViewport({
            x: Number(snapshot.viewport.x) || 0,
            y: Number(snapshot.viewport.y) || 0,
            zoom: clamp(Number(snapshot.viewport.zoom) || 1, MIN_ZOOM, MAX_ZOOM)
          });
        }

        commitDrafts((snapshot.drafts || []).map(draft => ({ ...draft, refs: addDraftReferences(draft, [], restoredNodes) })));
        commitRuns(snapshot.runs || []);
        settingsRef.current = { ...settingsRef.current, ...snapshot.settings };
        setActiveDraftId(snapshot.settings?.activeDraftId || "");
        setHydrated(true);

      })
      .catch(error => {
        console.error(error);
        if (!cancelled) setStorageError(language === "en" ? "Canvas storage could not be loaded. Reload to retry." : "画布数据未能读取，请刷新重试。原数据尚未改动。");
        onToast?.(language === "en" ? "Canvas storage is unavailable." : "画布本地存储不可用。");
      });

    return () => {
      cancelled = true;
      nodesRef.current.forEach(revokeNodeRuntimeUrls);
    };
  }, [canvasId]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    setSaving(true);
    const timer = window.setTimeout(() => {
      saveCanvasSnapshot({
        canvasId,
        nodes,
        viewport,
        settings: settingsRef.current, drafts, runs, schemaVersion: CANVAS_SCHEMA_VERSION
      })
        .catch(error => {
          console.error(error);
          onToast?.(language === "en" ? "Canvas changes could not be saved." : "画布更改未能保存。");
        })
        .finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [canvasId, nodes, viewport, drafts, runs, activeDraftId, hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    const flushSnapshot = () => {
      persistCurrentSnapshot().catch(console.error);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushSnapshot();
      }
    };

    window.addEventListener("pagehide", flushSnapshot);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushSnapshot);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }
    return () => {
      saveCanvasSnapshot({
        canvasId,
        nodes: nodesRef.current,
        viewport: viewportRef.current,
        settings: settingsRef.current,
      drafts: draftsRef.current, runs: runsRef.current, schemaVersion: CANVAS_SCHEMA_VERSION
      }).catch(console.error);
    };
  }, [canvasId, hydrated]);

  const historyImageMap = useMemo(() => {
    const imageMap = new Map();
    history.forEach(task => {
      task.images?.forEach(image => {
        imageMap.set(image.id, { task, image });
      });
    });
    return imageMap;
  }, [history]);

  const historyImageGroups = useMemo(() => {
    const grouped = new Map();
    history.forEach(task => {
      task.images?.forEach(image => {
        if ((!image.url && !image.blob) || image.status === "error") {
          return;
        }
        const date = formatHistoryDate(task.createdAt || image.createdAt || Date.now());
        const group = grouped.get(date) || [];
        group.push({ task, image });
        grouped.set(date, group);
      });
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, items]) => ({ date, items }));
  }, [history]);

  const historyImageCount = useMemo(
    () => historyImageGroups.reduce((total, group) => total + group.items.length, 0),
    [historyImageGroups]
  );

  function getVisibleNodes(sourceNodes = nodesRef.current) {
    return sourceNodes.filter(node => !node.hidden);
  }

  function getNodeAsset(node) {
    if (node.type === "text") {
      return {
        url: "",
        blob: null,
        mimeType: "text/plain",
        name: node.title || text("textNodeTitle"),
        status: "done",
        error: ""
      };
    }

    if (node.type === "generation") {
      return {
        url: "",
        blob: null,
        mimeType: "image/png",
        name: text("emptyImageTitle"),
        status: "empty",
        error: ""
      };
    }

    if (node.type === "upload") {
      return {
        url: node.annotationUrl || node.url,
        blob: node.annotationBlob || node.assetBlob,
        mimeType: node.annotationBlob?.type || node.mimeType || node.assetBlob?.type || "image/png",
        name: node.name || text("localAsset"),
        status: node.annotationBlob || node.assetBlob ? "done" : "error",
        error: node.annotationBlob || node.assetBlob ? "" : text("missingAsset")
      };
    }

    const linked = historyImageMap.get(node.imageId);
    return node.annotationBlob
      ? {
          url: node.annotationUrl,
          blob: node.annotationBlob,
          mimeType: node.annotationBlob.type || "image/png",
          name: linked?.task?.prompt || `image2-${node.imageId}`,
          status: "done",
          error: "",
          task: linked?.task,
          image: linked?.image
        }
      : linked
      ? {
          url: linked.image.url,
          blob: linked.image.blob,
          mimeType: linked.image.mimeType || linked.image.blob?.type || "image/png",
          name: linked.task.prompt || `image2-${node.imageId}`,
          status: linked.image.status || "loading",
          error: linked.image.error || "",
          task: linked.task,
          image: linked.image
        }
      : {
          url: "",
          blob: null,
          mimeType: "image/png",
          name: "",
          status: historyLoading ? "loading" : "error",
          error: historyLoading ? "" : text("missingAsset")
        };
  }

  function syncImageNodeToDisplaySize(nodeId, displaySize) {
    if (!displaySize) {
      return;
    }

    commitNodes(previousNodes => {
      const currentNode = previousNodes.find(node => node.id === nodeId);
      if (
        !currentNode
        || currentNode.type === "text"
        || currentNode.type === "generation"
        || (
          currentNode.width === displaySize.width
          && currentNode.height === displaySize.height
        )
      ) {
        return previousNodes;
      }

      const centerX = currentNode.x + currentNode.width / 2;
      const centerY = currentNode.y + currentNode.height / 2;
      return previousNodes.map(node => (
        node.id === nodeId
          ? {
              ...node,
              x: centerX - displaySize.width / 2,
              y: centerY - displaySize.height / 2,
              width: displaySize.width,
              height: displaySize.height,
              updatedAt: new Date().toISOString()
            }
          : node
      ));
    });
  }

  function captureCanvasSnapshot() {
    return {
      nodes: nodesRef.current.map(node => ({ ...node })),
      drafts: draftsRef.current.map(draft => ({ ...draft, refs: draft.refs.map(ref => ({ ...ref })) })),
      activeDraftId: settingsRef.current.activeDraftId,
      selectedIds: [...selectedIdsRef.current]
    };
  }

  function recordUndoSnapshot(snapshot = captureCanvasSnapshot()) {
    setUndoStack(previous => [...previous, snapshot].slice(-MAX_UNDO_STEPS));
    setRedoStack([]);
  }

  function restoreCanvasSnapshot(snapshot) {
    if (!snapshot) {
      return;
    }

    nodesRef.current.forEach(revokeNodeRuntimeUrls);

    const restoreNode = node => ({ ...node,
      url: node.type === "upload" && node.assetBlob ? URL.createObjectURL(node.assetBlob) : "",
      annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : ""
    });
    const restoredNodes = snapshot.nodes.map(restoreNode);
    const restoredIds = new Set(restoredNodes.map(node => node.id));
    const retained = nodesRef.current.filter(node => !restoredIds.has(node.id))
      .map(node => restoreNode({ ...node, hidden: true }));
    const nextNodes = [...restoredNodes, ...retained];
    const restoredDraftIds = new Set((snapshot.drafts || []).map(draft => draft.id));
    commitDrafts([...(snapshot.drafts || []), ...draftsRef.current.filter(draft => !restoredDraftIds.has(draft.id))]);

    const nextSelectedIds = snapshot.selectedIds.filter(id => nextNodes.some(node => node.id === id && !node.hidden));

    commitNodes(nextNodes);
    const restoredActive = nextNodes.find(node => !node.hidden && node.draftId === snapshot.activeDraftId)?.draftId
      || nextNodes.find(node => !node.hidden && node.type === "generation")?.draftId || "";
    activateDraft(restoredActive, false);
    selectedIdsRef.current = nextSelectedIds;
    setSelectedIds(nextSelectedIds);
    persistCurrentSnapshot().catch(console.error);
  }

  function undoCanvasChange() {
    if (undoStack.length === 0) {
      return;
    }
    const targetSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot = captureCanvasSnapshot();
    setUndoStack(previous => previous.slice(0, -1));
    setRedoStack(previous => [...previous, currentSnapshot].slice(-MAX_UNDO_STEPS));
    restoreCanvasSnapshot(targetSnapshot);
  }

  function redoCanvasChange() {
    if (redoStack.length === 0) {
      return;
    }
    const targetSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot = captureCanvasSnapshot();
    setRedoStack(previous => previous.slice(0, -1));
    setUndoStack(previous => [...previous, currentSnapshot].slice(-MAX_UNDO_STEPS));
    restoreCanvasSnapshot(targetSnapshot);
  }

  function getWorldCenter() {
    const rect = stageRef.current?.getBoundingClientRect();
    const currentViewport = viewportRef.current;
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: (rect.width / 2 - currentViewport.x) / currentViewport.zoom,
      y: (rect.height / 2 - currentViewport.y) / currentViewport.zoom
    };
  }

  function vacantCenter(size) {
    const center = getWorldCenter();
    const occupied = getVisibleNodes();
    for (let ring = 0; ring < 30; ring += 1) {
      for (const [column, row] of ring ? [[-ring, 0], [ring, 0], [0, ring], [0, -ring], [-ring, ring], [ring, ring]] : [[0, 0]]) {
        const point = { x: center.x + column * (size.width + 80), y: center.y + row * (size.height + 80) };
        if (!occupied.some(node => point.x + size.width / 2 + 30 > node.x && point.x - size.width / 2 - 30 < node.x + node.width
          && point.y + size.height / 2 + 30 > node.y && point.y - size.height / 2 - 30 < node.y + node.height)) return point;
      }
    }
    return center;
  }

  function vacantBelow(anchor, size) {
    let y = anchor.y;
    const occupied = getVisibleNodes();
    for (let attempt = 0; attempt <= occupied.length; attempt += 1) {
      const hits = occupied.filter(node => anchor.x + size.width + 40 > node.x && anchor.x - 40 < node.x + node.width
        && y + size.height + 60 > node.y && y - 60 < node.y + node.height);
      if (!hits.length) break;
      y = Math.max(...hits.map(node => node.y + node.height)) + 100;
    }
    return { x: anchor.x, y };
  }

  function fitToContent(sourceNodes = getVisibleNodes()) {
    const visibleNodes = sourceNodes.filter(node => !node.hidden);
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    if (visibleNodes.length === 0) {
      commitViewport({ x: 32, y: 32, zoom: 1 });
      return;
    }

    const minimumX = Math.min(...visibleNodes.map(node => node.x));
    const minimumY = Math.min(...visibleNodes.map(node => node.y));
    const maximumX = Math.max(...visibleNodes.map(node => node.x + node.width));
    const maximumY = Math.max(...visibleNodes.map(node => node.y + node.height));
    const contentWidth = Math.max(1, maximumX - minimumX);
    const contentHeight = Math.max(1, maximumY - minimumY);
    const horizontalPadding = 96;
    const verticalPadding = 54;
    const composerReserve = 80;
    const availableHeight = Math.max(220, rect.height - composerReserve);
    const nextZoom = clamp(
      Math.min(
        (rect.width - horizontalPadding * 2) / contentWidth,
        (availableHeight - verticalPadding * 2) / contentHeight,
        1.2
      ),
      MIN_ZOOM,
      MAX_ZOOM
    );

    commitViewport({
      x: (rect.width - contentWidth * nextZoom) / 2 - minimumX * nextZoom,
      y: (availableHeight - contentHeight * nextZoom) / 2 - minimumY * nextZoom,
      zoom: nextZoom
    });
  }

  useEffect(() => {
    if (!hydrated || historyLoading) {
      return;
    }

    const tasks = history.filter(task => task.canvasContext &&
      (task.canvasContext.canvasId || (task.canvasContext.projectId && task.canvasContext.projectId !== "default"
        ? task.canvasContext.projectId : LEGACY_CANVAS_ID)) === canvasId);
    const knownRuns = new Set(runsRef.current.map(run => run.taskId));
    const newRuns = tasks.filter(task => !knownRuns.has(task.id)).map(runFromTask);
    if (newRuns.length) commitRuns(previous => [...previous, ...newRuns]);
    commitNodes(previous => {
      const imageIds = new Set(previous.filter(node => node.type === "history-image").map(node => node.imageId));
      const additions = [];
      let baseY = previous.length ? Math.max(...previous.map(node => node.y + node.height)) + 100 : 100;
      for (const task of tasks) {
        const size = sizeFromAspectRatio(task.aspectRatio || "auto");
        const anchor = task.canvasContext.anchor || { x: 80, y: baseY };
        task.images?.forEach((image, index) => {
          if (imageIds.has(image.id)) return;
          additions.push({ id: `history-${canvasId}-${image.id}`, type: "history-image",
            taskId: task.id, imageId: image.id, runId: task.canvasContext.runId || `run-${task.id}`,
            x: anchor.x + (index % 4) * (size.width + 42), y: anchor.y + Math.floor(index / 4) * (size.height + 42),
            ...size, hidden: false, createdAt: task.createdAt });
        });
        baseY += Math.ceil((task.images?.length || 1) / 4) * (size.height + 42) + 100;
      }
      return additions.length ? [...previous, ...additions] : previous;
    });
  }, [canvasId, history, historyLoading, hydrated]);


  const visibleNodes = useMemo(() => nodes.filter(node => !node.hidden), [nodes]);
  const selectedNodes = useMemo(
    () => visibleNodes.filter(node => selectedIds.includes(node.id)),
    [visibleNodes, selectedIds]
  );
  const resolvedInput = resolveGenerationInput(activeDraft, nodes, getNodeAsset);

  useEffect(() => {
    setSelectedIds(previous => previous.filter(id => visibleNodes.some(node => node.id === id)));
  }, [visibleNodes]);

  useEffect(() => {
    if (!active || !hydrated || didInitialFitRef.current || visibleNodes.length === 0) {
      return;
    }
    didInitialFitRef.current = true;
    window.requestAnimationFrame(() => fitToContent(visibleNodes));
  }, [active, hydrated, visibleNodes.length]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!active || !stage) {
      return undefined;
    }

    // Ctrl/⌘ + wheel must cancel the browser's page zoom before updating only
    // the canvas viewport. React's delegated wheel event can be passive.
    const handleNativeWheel = event => {
      const target = event.target instanceof Element ? event.target : null;
      const floatingUi = target?.closest(".canvas-floating-ui");
      if (floatingUi) {
        const historyScroll = floatingUi.matches(".canvas-history-panel")
          ? floatingUi.querySelector(".canvas-history-scroll")
          : null;
        if (historyScroll) {
          const deltaScale = event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? historyScroll.clientHeight || 600
              : 1;
          event.preventDefault();
          historyScroll.scrollTop += event.deltaY * deltaScale;
        }
        return;
      }
      handleWheel(event);
    };
    stage.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleNativeWheel);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      setSpaceHeld(false);
      interactionRef.current = null;
      window.clearTimeout(wheelEndTimerRef.current);
      setInteractionType("");
      setReferencePicker(null);
      setPointerContextMenu(null);
      return undefined;
    }

    const handleKeyDown = event => {
      if (isTypingTarget(event.target)) {
        return;
      }
      if (referencePicker && event.key !== "Escape") {
        return;
      }

      const modifierPressed = event.ctrlKey || event.metaKey;
      if (modifierPressed && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoCanvasChange();
        } else {
          undoCanvasChange();
        }
      } else if (modifierPressed && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoCanvasChange();
      } else if (modifierPressed && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedNodes();
      } else if (modifierPressed && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedNodes();
      } else if (event.code === "Space") {
        event.preventDefault();
        setSpaceHeld(true);
      } else if (!modifierPressed && event.key.toLowerCase() === "v") {
        setTool("select");
      } else if (event.key.toLowerCase() === "h") {
        setTool("hand");
      } else if (event.key.toLowerCase() === "f" && selectedNodes.length > 0) {
        event.preventDefault();
        fitToContent(selectedNodes);
      } else if (event.key === "Escape") {
        if (referencePicker) {
          setReferencePicker(null);
          return;
        }
        setAddMenuOpen(false);
        setContextMenu(null);
        setNodeMoreOpen(false);
        setHelpOpen(false);
        setMentionMenuOpen(false);
        clearPendingConnection();
        setPointerContextMenu(null);
        setSelectedEdgeId("");
        setSelectedIds([]);
      } else if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        addEmptyImageNode();
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        addTextNode();
      } else if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        openUploadPicker();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selectedEdgeId) {
          disconnectEdge(selectedEdgeId);
        } else {
          removeSelectedNodes();
        }
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    const handleKeyUp = event => {
      if (event.code === "Space") {
        setSpaceHeld(false);
      }
    };
    const handlePaste = event => {
      if (
        isTypingTarget(event.target)
        || referencePicker
        || clipboardRef.current.length === 0
      ) {
        return;
      }
      event.preventDefault();
      pasteCopiedNodes();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("paste", handlePaste);
    };
  }, [active, undoStack.length, redoStack.length, selectedNodes, selectedEdgeId, referencePicker]);

  async function addCanvasFiles(files, worldPoint, connectionContext = null) {
    const imageFiles = [...files].filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      onToast?.(text("uploadOnlyImages"));
      return;
    }

    if (
      connectionContext &&
      !nodesRef.current.some(node => node.id === connectionContext.originNodeId)
    ) {
      clearPendingConnection();
      return;
    }

    const center = connectionContext?.point || worldPoint || vacantCenter({ width: 340, height: 300 });
    const additions = [];
    let failedCount = 0;
    for (let index = 0; index < imageFiles.length; index += 1) {
      try {
        const file = imageFiles[index];
        const dimensions = await readImageDimensions(file);
        const contentHash = await hashAsset(file);
        const fitted = fitNodeSize(dimensions.width, dimensions.height);
        const cascadeOffset = index * 36;
        const connectedFromRight = connectionContext?.startHandleType === "source";
        additions.push({
          id: createLocalId("upload"),
          type: "upload",
          name: file.name,
          mimeType: file.type || "image/png",
          assetBlob: file,
          contentHash,
          url: URL.createObjectURL(file),
          x: connectionContext
            ? connectedFromRight
              ? center.x + CONNECTION_HANDLE_OFFSET + cascadeOffset
              : center.x - fitted.width - CONNECTION_HANDLE_OFFSET - cascadeOffset
            : center.x - fitted.width / 2 + cascadeOffset,
          y: center.y - fitted.height / 2 + cascadeOffset,
          width: fitted.width,
          height: fitted.height,

          hidden: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        failedCount += 1;
        console.error(error);
      }
    }

    if (additions.length === 0) {
      onToast?.(text("uploadFailed"));
      return;
    }

    recordUndoSnapshot();
    commitNodes(previous => [...previous, ...additions]);
    if (connectionContext?.startHandleType === "target") {
      const target = nodesRef.current.find(node => node.id === connectionContext.originNodeId);
      addReferences(target?.draftId, additions.map(node => node.id), false);
      activateDraft(target.draftId);
    } else setSelectedIds(additions.map(node => node.id));
    await persistCurrentSnapshot().catch(() => onToast?.(text("uploadFailed")));

    clearPendingConnection();
    didInitialFitRef.current = true;
    if (failedCount > 0) {
      onToast?.(text("uploadPartial"));
    }
  }

  function openUploadPicker(worldPoint = null) {
    pendingUploadPointRef.current = worldPoint;
    canvasUploadInputRef.current?.click();
  }

  function addReferences(draftId, nodeIds, undo = true) {
    const draft = draftsRef.current.find(item => item.id === draftId);
    if (!draft) return false;
    const refs = addDraftReferences(draft, nodeIds, nodesRef.current);
    const imageCount = refs.filter(ref => nodesRef.current.find(node => node.id === ref.nodeId)?.type !== "text").length;
    if (imageCount > MAX_REFERENCE_IMAGES) {
      onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES })); return false;
    }
    if (refs.length !== draft.refs.length) updateDraft(draft.id, { refs }, undo);
    return true;
  }

  function requestReferenceUpload() {
    referenceUploadTargetRef.current = settingsRef.current.activeDraftId;
    referenceUploadInputRef.current?.click();
  }

  async function makeUploadAsset(file, hidden = true) {
    const dimensions = await readImageDimensions(file);
    const contentHash = await hashAsset(file);
    return { id: createLocalId("asset"), type: "upload", name: file.name || "标注素材", mimeType: file.type,
      assetBlob: file, url: URL.createObjectURL(file), contentHash, hidden, x: 0, y: 0,
      ...fitNodeSize(dimensions.width, dimensions.height), createdAt: new Date().toISOString() };
  }

  async function addReferenceFiles(files, draftId) {
    if (!draftsRef.current.some(draft => draft.id === draftId)) return;
    const results = await Promise.allSettled([...files].filter(file => file.type.startsWith("image/")).map(file => makeUploadAsset(file)));
    const additions = results.filter(result => result.status === "fulfilled").map(result => result.value);
    if (!additions.length) { onToast?.(text("uploadFailed")); return; }
    recordUndoSnapshot();
    commitNodes(previous => [...previous, ...additions]);
    addReferences(draftId, additions.map(node => node.id), false);
    await persistCurrentSnapshot().catch(() => onToast?.(text("uploadFailed")));
    if (results.some(result => result.status === "rejected")) onToast?.(text("uploadPartial"));
  }

  function startCanvasReferencePicker() {
    if (!activeDraft) return;
    setSelectedEdgeId("");
    setReferencePicker({ draftId: activeDraft.id, candidateIds: [] });
  }

  function finishCanvasReferencePicker(nodeId) {
    const node = nodesRef.current.find(item => item.id === nodeId);
    if (!isCanvasAsset(node)) { onToast?.(text("invalidReferenceSource")); return; }
    setReferencePicker(previous => ({ ...previous, candidateIds: previous.candidateIds.includes(nodeId)
      ? previous.candidateIds.filter(id => id !== nodeId) : [...previous.candidateIds, nodeId] }));
  }

  function confirmReferencePicker() {
    if (addReferences(referencePicker.draftId, referencePicker.candidateIds)) {
      activateDraft(referencePicker.draftId);
      setReferencePicker(null);
    }
  }

  function createDraftNode({ point, refs = [], defaults = {}, title = "生成", undo = true, exactPosition = false } = {}) {
    if (undo) recordUndoSnapshot();
    const center = point || vacantCenter(GENERATION_NODE_SIZE);
    const origin = { x: center.x - GENERATION_NODE_SIZE.width / 2, y: center.y - GENERATION_NODE_SIZE.height / 2 };
    const position = exactPosition ? origin : vacantBelow(origin, GENERATION_NODE_SIZE);
    const draft = createGenerationDraft({ id: createLocalId("draft"), title,
      defaults: { model: settingsRef.current.model, aspectRatio: settingsRef.current.aspectRatio,
        quality: settingsRef.current.quality, count: settingsRef.current.count, ...defaults }, refs });
    draft.refs = addDraftReferences({ ...draft, refs: [] }, refs.map(ref => typeof ref === "string" ? ref : ref.nodeId), nodesRef.current);
    const node = { id: createLocalId("generation"), type: "generation", draftId: draft.id,
      ...position,
      ...GENERATION_NODE_SIZE, createdAt: new Date().toISOString() };
    commitDrafts(previous => [...previous, draft]);
    commitNodes(previous => [...previous, node]);
    activateDraft(draft.id);
    didInitialFitRef.current = true;
    setAddMenuOpen(false); setContextMenu(null); setHistoryPanelOpen(false);
    window.requestAnimationFrame(() => promptRef.current?.focus());
    return node;
  }

  function addEmptyImageNode(worldPoint) { return createDraftNode({ point: worldPoint }); }


  function addTextNode(worldPoint) {
    const center = worldPoint || vacantCenter({ width: 300, height: 340 });
    const node = {
      id: createLocalId("text-node"),
      type: "text",
      title: text("textNodeTitle"),
      content: "",
      x: center.x - 150,
      y: center.y - 170,
      width: 300,
      height: 340,
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    recordUndoSnapshot();
    commitNodes(previous => [...previous, node]);
    setSelectedIds([node.id]);
    setAddMenuOpen(false);
    setContextMenu(null);
    return node;
  }

  function clearPendingConnection() {
    pendingConnectionUploadRef.current = null;
    setConnectionMenu(null);
    setConnectionDraft(null);
  }

  function addConnectedNode(type) {
    const context = connectionMenu;
    const origin = nodesRef.current.find(node => node.id === context?.originNodeId);
    if (!context || !origin) {
      clearPendingConnection();
      return;
    }

    if (context.startHandleType === "source") {
      createDraftNode({ point: { x: context.point.x + CONNECTION_HANDLE_OFFSET + GENERATION_NODE_SIZE.width / 2,
        y: context.point.y }, refs: [origin.id], exactPosition: true });
    } else {
      const node = addTextNode({ x: context.point.x - CONNECTION_HANDLE_OFFSET - 150, y: context.point.y });
      addReferences(origin.draftId, [node.id], false);
    }
    clearPendingConnection();
    persistCurrentSnapshot().catch(console.error);
  }


  function openConnectionUpload() {
    if (!connectionMenu) return;
    pendingConnectionUploadRef.current = connectionMenu;
    connectionUploadInputRef.current?.click();
  }

  function copySelectedNodes() {
    const selection = nodesRef.current.filter(node => selectedIdsRef.current.includes(node.id));
    clipboardRef.current = selection.map(node => ({ ...node, copiedDraft: draftsRef.current.find(draft => draft.id === node.draftId) }));
    if (selection.length > 0) {
      onToast?.(language === "en" ? `${selection.length} node(s) copied.` : `已复制 ${selection.length} 个节点。`);
    }
  }

  function getPointerPasteTarget() {
    const pointer = stagePointerClientRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (
      !pointer
      || !rect
      || pointer.x < rect.left
      || pointer.x > rect.right
      || pointer.y < rect.top
      || pointer.y > rect.bottom
    ) {
      return null;
    }
    return clientPointToWorld(pointer.x, pointer.y);
  }

  function pasteCopiedNodes({ atPointer = true, offset = 36 } = {}) {
    if (clipboardRef.current.length === 0) return;
    const pasteTarget = atPointer ? getPointerPasteTarget() : null;
    const minimumX = Math.min(...clipboardRef.current.map(node => node.x));
    const minimumY = Math.min(...clipboardRef.current.map(node => node.y));
    const maximumX = Math.max(...clipboardRef.current.map(node => node.x + node.width));
    const maximumY = Math.max(...clipboardRef.current.map(node => node.y + node.height));
    const translateX = pasteTarget
      ? pasteTarget.x - (minimumX + maximumX) / 2
      : offset;
    const translateY = pasteTarget
      ? pasteTarget.y - (minimumY + maximumY) / 2
      : offset;
    const idMap = new Map(clipboardRef.current.map(node => [node.id, createLocalId("clone")]));
    const clonedDrafts = [];
    const additions = clipboardRef.current.map(node => {
      const nextId = idMap.get(node.id);
      let draftId = node.draftId;
      if (node.type === "generation" && node.copiedDraft) {
        draftId = createLocalId("draft");
        clonedDrafts.push({ ...node.copiedDraft, id: draftId, revision: 1,
          refs: node.copiedDraft.refs.map(ref => ({ ...ref, nodeId: idMap.get(ref.nodeId) || ref.nodeId })) });
      }
      return {
        ...node,
        id: nextId, draftId, copiedDraft: undefined, runId: undefined,
        x: node.x + translateX,
        y: node.y + translateY,
        hidden: false,
        url: node.type === "upload" && node.assetBlob ? URL.createObjectURL(node.assetBlob) : "",
        annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    recordUndoSnapshot();
    commitDrafts(previous => [...previous, ...clonedDrafts]);
    commitNodes(previous => [...previous, ...additions]);
    setSelectedIds(additions.map(node => node.id));
    if (additions.length === 1 && additions[0].type === "generation") activateDraft(additions[0].draftId);
    clipboardRef.current = additions.map(node => ({ ...node, copiedDraft: draftsRef.current.find(draft => draft.id === node.draftId) }));
  }

  function duplicateSelectedNodes() {
    copySelectedNodes();
    pasteCopiedNodes({ atPointer: false });
  }

  function edgeId(parentId, childId) {
    return `${parentId}::${childId}`;
  }

  function disconnectEdge(id) {
    const [parentId, childId] = String(id).split("::");
    const child = nodesRef.current.find(node => node.id === childId && node.type === "generation");
    const draft = draftsRef.current.find(item => item.id === child?.draftId);
    if (!draft?.refs.some(ref => ref.nodeId === parentId)) return;
    updateDraft(draft.id, { refs: draft.refs.filter(ref => ref.nodeId !== parentId) }, true);
    setSelectedEdgeId("");
  }

  function connectNodes(parentId, childId) {
    const parent = nodesRef.current.find(node => node.id === parentId);
    const child = nodesRef.current.find(node => node.id === childId);
    if (!isCanvasAsset(parent) || child?.type !== "generation") return;
    if (addReferences(child.draftId, [parentId])) activateDraft(child.draftId);
  }


  function nodeDisplayName(node) {
    if (node.type === "generation") return draftsRef.current.find(draft => draft.id === node.draftId)?.title || "生成";
    if (node.type === "text") {
      return (node.title || node.content || text("textNodeTitle")).trim().slice(0, 24);
    }
    return (node.name || getNodeAsset(node).name || text("emptyImageTitle")).trim().slice(0, 24);
  }

  function insertMention(node) {
    if (addReferences(activeDraftId, [node.id])) commitSetting("prompt", prompt.replace(/@[^@\n]*$/, "").trimEnd());
    setMentionMenuOpen(false);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  function handlePromptChange(value) {
    commitSetting("prompt", value);
    setMentionMenuOpen(/@[^@\n]*$/.test(value));
  }

  function removeGenerationReference(nodeId) {
    if (activeDraft) updateDraft(activeDraft.id, { refs: activeDraft.refs.filter(ref => ref.nodeId !== nodeId) }, true);
  }


  function updateTextNode(nodeId, content) {
    commitNodes(previous => previous.map(node => (
      node.id === nodeId
        ? { ...node, content, updatedAt: new Date().toISOString() }
        : node
    )));
  }

  function finishTextEdit() {
    if (textEditSnapshotRef.current) {
      recordUndoSnapshot(textEditSnapshotRef.current);
      textEditSnapshotRef.current = null;
      persistCurrentSnapshot().catch(console.error);
    }
  }

  function stopTextNodeEditing(nodeId = editingTextNodeId) {
    if (!nodeId) return;
    const input = textNodeInputRefs.current.get(nodeId);
    if (document.activeElement === input) {
      input.blur();
      return;
    }
    setEditingTextNodeId(current => current === nodeId ? "" : current);
    finishTextEdit();
  }



  function clientPointToWorld(clientX, clientY) {
    const rect = stageRef.current?.getBoundingClientRect();
    const currentViewport = viewportRef.current;
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: (clientX - rect.left - currentViewport.x) / currentViewport.zoom,
      y: (clientY - rect.top - currentViewport.y) / currentViewport.zoom
    };
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDraggingFiles(false);
    const point = clientPointToWorld(event.clientX, event.clientY);
    await addCanvasFiles(event.dataTransfer.files || [], point);
  }

  function openCanvasContextMenu(event) {
    if (event.target.closest(".canvas-floating-ui") || event.target.closest(".canvas-node")) {
      return;
    }
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const menuWidth = 196;
    const menuHeight = 132;
    setAddMenuOpen(false);
    setNodeMoreOpen(false);
    setPointerContextMenu(null);
    setContextMenu({
      left: clamp(event.clientX - rect.left, 8, Math.max(8, rect.width - menuWidth - 8)),
      top: clamp(event.clientY - rect.top, 8, Math.max(8, rect.height - menuHeight - 8)),
      worldPoint: clientPointToWorld(event.clientX, event.clientY)
    });
  }

  function addHistoryImageAtPoint(taskId, imageId, point) {
    const linked = historyImageMap.get(imageId);
    if (!linked || linked.task.id !== taskId) {
      return;
    }

    const nodeSize = sizeFromAspectRatio(linked.task.aspectRatio || "auto");
    const hiddenMatch = nodesRef.current.find(node => (
      node.type === "history-image" && node.imageId === imageId && node.hidden
    ));
    const now = new Date().toISOString();
    const nextNode = hiddenMatch
      ? {
          ...hiddenMatch,
          taskId,
          x: point.x - nodeSize.width / 2,
          y: point.y - nodeSize.height / 2,
          width: nodeSize.width,
          height: nodeSize.height,
          hidden: false,
          updatedAt: now
        }
      : {
          id: createLocalId(`history-${imageId}`),
          type: "history-image",
          taskId,
          imageId,
          x: point.x - nodeSize.width / 2,
          y: point.y - nodeSize.height / 2,
          width: nodeSize.width,
          height: nodeSize.height,
          hidden: false,
          createdAt: linked.task.createdAt || now,
          updatedAt: now
        };

    recordUndoSnapshot();
    commitNodes(previous => hiddenMatch
      ? previous.map(node => node.id === hiddenMatch.id ? nextNode : node)
      : [...previous, nextNode]
    );
    selectedIdsRef.current = [nextNode.id];
    setSelectedIds([nextNode.id]);
    didInitialFitRef.current = true;
    persistCurrentSnapshot().catch(console.error);
  }

  function beginHistoryPointerDrag(event, task, image) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: "history-image",
      pointerId: event.pointerId,
      taskId: task.id,
      imageId: image.id,
      imageUrl: image.url,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
  }

  function moveHistoryPointerDrag(event) {
    const interaction = interactionRef.current;
    if (interaction?.type !== "history-image" || interaction.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const moved = interaction.moved
      || Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY) > 5;
    interactionRef.current = { ...interaction, moved };
    if (moved) {
      setHistoryDragPreview({
        url: interaction.imageUrl,
        x: event.clientX,
        y: event.clientY
      });
    }
  }

  function finishHistoryPointerDragAt(clientX, clientY, pointerId) {
    const interaction = interactionRef.current;
    if (interaction?.type !== "history-image" || interaction.pointerId !== pointerId) {
      return;
    }
    const stageRect = stageRef.current?.getBoundingClientRect();
    const panelRect = stageRef.current?.querySelector(".canvas-history-panel")?.getBoundingClientRect();
    const pointInside = (rect) => Boolean(rect
      && clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom);

    if (interaction.moved && pointInside(stageRect) && !pointInside(panelRect)) {
      addHistoryImageAtPoint(
        interaction.taskId,
        interaction.imageId,
        clientPointToWorld(clientX, clientY)
      );
    }
    interactionRef.current = null;
    setHistoryDragPreview(null);
  }

  function endHistoryPointerDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    finishHistoryPointerDragAt(event.clientX, event.clientY, event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  useEffect(() => {
    const finishHistoryDrag = event => {
      finishHistoryPointerDragAt(event.clientX, event.clientY, event.pointerId);
    };
    window.addEventListener("pointerup", finishHistoryDrag, true);
    window.addEventListener("pointercancel", finishHistoryDrag, true);
    return () => {
      window.removeEventListener("pointerup", finishHistoryDrag, true);
      window.removeEventListener("pointercancel", finishHistoryDrag, true);
    };
  }, [historyImageMap]);

  function removeNodesByIds(nodeIds) {
    const targets = new Set(nodeIds);
    if (targets.size === 0) {
      return;
    }

    recordUndoSnapshot();
    commitNodes(previous => previous.map(node => targets.has(node.id) ? { ...node, hidden: true } : node));
    setSelectedIds([]);
    persistCurrentSnapshot().catch(console.error);
    onToast?.(language === "en" ? "Removed from canvas. Draft inputs and runs are preserved." : "已从画布移除，草稿引用和运行记录仍保留。");
  }

  function removeSelectedNodes() { removeNodesByIds(selectedIdsRef.current); }

  function downloadNodes(targetNodes) {
    targetNodes.forEach((node, index) => {
      const asset = getNodeAsset(node);
      if (!asset.url || asset.status !== "done") {
        return;
      }
      window.setTimeout(() => {
        const anchor = document.createElement("a");
        anchor.href = asset.url;
        const extension = asset.mimeType.split("/").pop()?.replace("jpeg", "jpg") || "png";
        anchor.download = `${asset.name || "image2-canvas"}-${node.imageId || node.id}.${extension}`;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }, index * 80);
    });
  }

  function prepareNodeContinuation(node) {
    createDraftNode({ point: { x: node.x + node.width + 100 + GENERATION_NODE_SIZE.width / 2,
      y: node.y + GENERATION_NODE_SIZE.height / 2 }, refs: [node.id], title: "基于图片修改", defaults: { count: 1 } });
  }

  function captureStagePointerDown(event) {
    if (!historyPanelOpen) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest(".canvas-history-panel")
      || target?.closest('[data-testid="canvas-history-trigger"]')
    ) {
      return;
    }
    setHistoryPanelOpen(false);
  }

  function beginStageInteraction(event) {
    if (event.target.closest(".canvas-floating-ui")) {
      if (!event.target.closest(".canvas-connection-menu")) {
        clearPendingConnection();
      }
      return;
    }
    clearPendingConnection();
    if (referencePicker) {
      event.preventDefault();
      return;
    }
    setAddMenuOpen(false);
    setContextMenu(null);
    setNodeMoreOpen(false);
    setPointerContextMenu(null);
    const targetNode = event.target.closest(".canvas-node");
    if (!targetNode) {
      stopTextNodeEditing();
    }
    if (targetNode && tool === "select" && !spaceHeld) {
      return;
    }
    if (event.button !== 0 && event.button !== 1 && event.button !== 2) {
      return;
    }

    event.preventDefault();
    setSelectedEdgeId("");
    if (tool === "select" && !spaceHeld && event.button === 0) {
      const world = clientPointToWorld(event.clientX, event.clientY);
      const initialSelection = event.shiftKey ? [...selectedIdsRef.current] : [];
      if (!event.shiftKey) setSelectedIds([]);
      interactionRef.current = {
        type: "box-select",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWorld: world,
        initialSelection
      };
      setSelectionBox({ left: event.clientX, top: event.clientY, width: 0, height: 0 });
      setInteractionType("box-select");
    } else {
      interactionRef.current = {
        type: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewport: viewportRef.current,
        button: event.button,
        hasMoved: false
      };
      setInteractionType("pan");
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginNodeMove(event, node) {
    if (referencePicker) {
      event.preventDefault();
      event.stopPropagation();
      finishCanvasReferencePicker(node.id);
      return;
    }
    if (tool === "hand" || spaceHeld) {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    if (editingTextNodeId && editingTextNodeId !== node.id) {
      stopTextNodeEditing();
    }

    event.preventDefault();
    event.stopPropagation();
    setNodeMoreOpen(false);
    if (node.type === "generation" && !event.shiftKey) activateDraft(node.draftId, false);
    const currentSelection = selectedIdsRef.current;

    if (event.shiftKey) {
      const nextSelection = currentSelection.includes(node.id)
        ? currentSelection.filter(id => id !== node.id)
        : [...currentSelection, node.id];
      setSelectedIds(nextSelection);
      return;
    }

    const moveIds = currentSelection.includes(node.id) ? currentSelection : [node.id];
    if (!currentSelection.includes(node.id)) {
      setSelectedIds(moveIds);
    }
    const positions = new Map(
      nodesRef.current
        .filter(item => moveIds.includes(item.id))
        .map(item => [item.id, { x: item.x, y: item.y }])
    );
    interactionRef.current = {
      type: "move",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ids: moveIds,
      positions,
      beforeSnapshot: captureCanvasSnapshot(),
      hasChanged: false
    };
    setInteractionType("move");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginTextNodeEdit(event, node) {
    event.stopPropagation();
    if (referencePicker) return;
    if (editingTextNodeId === node.id) {
      return;
    }

    setSelectedIds([node.id]);
    setEditingTextNodeId(node.id);
    window.requestAnimationFrame(() => {
      const input = textNodeInputRefs.current.get(node.id);
      input?.focus({ preventScroll: true });
      const caretPosition = input?.value?.length || 0;
      input?.setSelectionRange(caretPosition, caretPosition);
    });
  }

  function beginNodeResize(event, node, direction) {
    if (node.type !== "text") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([node.id]);
    interactionRef.current = {
      type: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      direction,
      beforeSnapshot: captureCanvasSnapshot(),
      hasChanged: false
    };
    setInteractionType("resize");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginConnection(event, node, startHandleType = "source") {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientPointToWorld(event.clientX, event.clientY);
    const start = {
      x: startHandleType === "target"
        ? node.x - CONNECTION_HANDLE_OFFSET
        : node.x + node.width + CONNECTION_HANDLE_OFFSET,
      y: node.y + node.height / 2
    };
    setSelectedIds([node.id]);
    setSelectedEdgeId("");
    setNodeMoreOpen(false);
    clearPendingConnection();
    interactionRef.current = {
      type: "connect",
      pointerId: event.pointerId,
      originNodeId: node.id,
      startHandleType,
      start,
      current: point,
      rawCurrent: point,
      snapTargetId: "",
      hasMoved: false
    };
    setConnectionDraft(interactionRef.current);
    setInteractionType("connect");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function findConnectionSnapTarget(point, originNodeId, startHandleType) {
    const radius = CONNECTION_SNAP_RADIUS_PX / viewportRef.current.zoom;
    let closest = null;
    for (const node of nodesRef.current) {
      if (node.hidden || node.id === originNodeId) continue;
      if (startHandleType === "target" ? !isCanvasAsset(node) : node.type !== "generation") continue;
      const anchor = {
        x: startHandleType === "target"
          ? node.x + node.width + CONNECTION_HANDLE_OFFSET
          : node.x - CONNECTION_HANDLE_OFFSET,
        y: node.y + node.height / 2
      };
      const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (distance <= radius && (!closest || distance < closest.distance)) {
        closest = { node, anchor, distance };
      }
    }
    return closest;
  }

  function handleStagePointerMove(event) {
    stagePointerClientRef.current = {
      x: event.clientX,
      y: event.clientY
    };
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    if (interaction.type === "pan") {
      interaction.hasMoved ||= Math.hypot(
        event.clientX - interaction.startX,
        event.clientY - interaction.startY
      ) > 3;
      commitViewport({
        ...interaction.viewport,
        x: interaction.viewport.x + event.clientX - interaction.startX,
        y: interaction.viewport.y + event.clientY - interaction.startY
      });
      return;
    }

    if (interaction.type === "box-select") {
      const left = Math.min(interaction.startX, event.clientX);
      const top = Math.min(interaction.startY, event.clientY);
      const right = Math.max(interaction.startX, event.clientX);
      const bottom = Math.max(interaction.startY, event.clientY);
      setSelectionBox({ left, top, width: right - left, height: bottom - top });
      const startWorld = clientPointToWorld(left, top);
      const endWorld = clientPointToWorld(right, bottom);
      const hitIds = getVisibleNodes().filter(node => (
        node.x < endWorld.x &&
        node.x + node.width > startWorld.x &&
        node.y < endWorld.y &&
        node.y + node.height > startWorld.y
      )).map(node => node.id);
      setSelectedIds([...new Set([...interaction.initialSelection, ...hitIds])]);
      return;
    }

    if (interaction.type === "connect") {
      const rawCurrent = clientPointToWorld(event.clientX, event.clientY);
      const snapTarget = findConnectionSnapTarget(
        rawCurrent,
        interaction.originNodeId,
        interaction.startHandleType
      );
      interaction.rawCurrent = rawCurrent;
      interaction.current = snapTarget?.anchor || rawCurrent;
      interaction.snapTargetId = snapTarget?.node.id || "";
      interaction.hasMoved ||= Math.hypot(
        rawCurrent.x - interaction.start.x,
        rawCurrent.y - interaction.start.y
      ) > 2;
      setConnectionDraft({ ...interaction });
      return;
    }

    const deltaX = (event.clientX - interaction.startX) / viewportRef.current.zoom;
    const deltaY = (event.clientY - interaction.startY) / viewportRef.current.zoom;

    if (interaction.type === "move") {
      interaction.hasChanged ||= Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
      commitNodes(previous => previous.map(node => {
        const origin = interaction.positions.get(node.id);
        return origin
          ? { ...node, x: origin.x + deltaX, y: origin.y + deltaY, updatedAt: new Date().toISOString() }
          : node;
      }));
      return;
    }

    if (interaction.type === "resize") {
      interaction.hasChanged ||= Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;
      const direction = interaction.direction;
      const movesWest = direction.includes("w");
      const movesEast = direction.includes("e");
      const movesNorth = direction.includes("n");
      const movesSouth = direction.includes("s");
      const nextWidth = movesWest
        ? clamp(interaction.width - deltaX, 120, 1600)
        : movesEast
          ? clamp(interaction.width + deltaX, 120, 1600)
          : interaction.width;
      const nextHeight = movesNorth
        ? clamp(interaction.height - deltaY, 100, 1400)
        : movesSouth
          ? clamp(interaction.height + deltaY, 100, 1400)
          : interaction.height;
      const nextX = movesWest ? interaction.x + interaction.width - nextWidth : interaction.x;
      const nextY = movesNorth ? interaction.y + interaction.height - nextHeight : interaction.y;
      commitNodes(previous => previous.map(node => (
        node.id === interaction.id
          ? { ...node, x: nextX, y: nextY, width: nextWidth, height: nextHeight, updatedAt: new Date().toISOString() }
          : node
      )));
    }
  }

  function endStageInteraction(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }
    if (interaction.type === "connect") {
      let keepPendingConnection = false;
      const targetAttribute = interaction.startHandleType === "target"
        ? "data-connection-output"
        : "data-connection-input";
      const dropTarget = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest?.(`[${targetAttribute}]`);
      const otherNodeId = interaction.snapTargetId || dropTarget?.getAttribute(targetAttribute);
      if (otherNodeId) {
        connectNodes(
          interaction.startHandleType === "target" ? otherNodeId : interaction.originNodeId,
          interaction.startHandleType === "target" ? interaction.originNodeId : otherNodeId
        );
      } else {
        const point = interaction.rawCurrent || clientPointToWorld(event.clientX, event.clientY);
        const origin = nodesRef.current.find(node => node.id === interaction.originNodeId);
        const farEnough = Math.hypot(point.x - interaction.start.x, point.y - interaction.start.y) > 48;
        if (origin && farEnough && stageRef.current) {
          keepPendingConnection = true;
          setConnectionDraft({
            ...interaction,
            current: point,
            rawCurrent: point,
            snapTargetId: "",
            pending: true
          });
          setConnectionMenu({
            originNodeId: origin.id,
            startHandleType: interaction.startHandleType,
            point
          });
        }
      }
      if (!keepPendingConnection) {
        setConnectionDraft(null);
      }
    } else if (interaction.hasChanged && interaction.beforeSnapshot) {
      recordUndoSnapshot(interaction.beforeSnapshot);
    }
    if (interaction.type === "pan" && interaction.button === 2 && interaction.hasMoved) {
      suppressContextMenuRef.current = true;
      window.setTimeout(() => {
        suppressContextMenuRef.current = false;
      }, 100);
    }
    setSelectionBox(null);
    interactionRef.current = null;
    setInteractionType("");
    persistCurrentSnapshot().catch(console.error);
  }

  function zoomAroundPoint(nextZoom, clientX, clientY) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const current = viewportRef.current;
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - current.x) / current.zoom;
    const worldY = (localY - current.y) / current.zoom;
    commitViewport({
      x: localX - worldX * zoom,
      y: localY - worldY * zoom,
      zoom
    });
  }

  function zoomFromCenter(delta) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    zoomAroundPoint(
      viewportRef.current.zoom + delta,
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
  }

  function handleWheel(event) {
    event.preventDefault();
    setContextMenu(null);
    setPointerContextMenu(null);
    window.clearTimeout(wheelEndTimerRef.current);
    setInteractionType("wheel");
    wheelEndTimerRef.current = window.setTimeout(() => {
      if (!interactionRef.current) setInteractionType("");
    }, 120);
    const deltaScale = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? stageRef.current?.clientHeight || 800
        : 1;
    const deltaX = event.deltaX * deltaScale;
    const deltaY = event.deltaY * deltaScale;

    if (event.ctrlKey || event.metaKey) {
      const multiplier = 2 ** (-deltaY * 0.002);
      zoomAroundPoint(
        viewportRef.current.zoom * multiplier,
        event.clientX,
        event.clientY
      );
      return;
    }

    const horizontalDelta = event.shiftKey && Math.abs(deltaX) < 0.01 ? deltaY : deltaX;
    const verticalDelta = event.shiftKey && Math.abs(deltaX) < 0.01 ? 0 : deltaY;
    commitViewport(current => ({
      ...current,
      x: current.x - horizontalDelta,
      y: current.y - verticalDelta
    }));
  }

  function handleStageContextMenu(event) {
    if (event.target.closest(".canvas-floating-ui")) {
      return;
    }
    event.preventDefault();
    if (suppressContextMenuRef.current) {
      suppressContextMenuRef.current = false;
      return;
    }

    const nodeId = event.target.closest(".canvas-node")?.dataset.nodeId || "";
    const targetIds = nodeId
      ? (selectedIdsRef.current.includes(nodeId) ? selectedIdsRef.current : [nodeId])
      : selectedIdsRef.current;
    if (targetIds.length === 0) {
      openCanvasContextMenu(event);
      return;
    }

    setContextMenu(null);
    if (nodeId && !selectedIdsRef.current.includes(nodeId)) {
      setSelectedIds([nodeId]);
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPointerContextMenu({
      left: event.clientX - rect.left,
      top: event.clientY - rect.top
    });
  }

  async function submitRun(draft, resolved, referenceOverride = null, previousRun = null) {
    if (submittingRef.current) return;
    if (!currentUser) { onRequireLogin?.(); return; }
    if (!resolved.hasPrompt) { onToast?.(text("promptRequired")); return; }
    if (!referenceOverride && resolved.errors.length) { onToast?.("请先处理参考素材中标出的错误。"); return; }
    submittingRef.current = true; setSubmitting(true);
    try {
      const snapshot = snapshotGenerationInput(draft, resolved);
      const sourceNode = nodesRef.current.find(node => node.draftId === draft.id);
      const existingOutputs = nodesRef.current.filter(node => runsRef.current.some(run => run.draftId === draft.id && run.id === node.runId));
      const size = sizeFromAspectRatio(snapshot.aspectRatio);
      const anchor = vacantBelow({ x: sourceNode ? sourceNode.x + sourceNode.width + 130 : getWorldCenter().x,
        y: existingOutputs.length ? Math.max(...existingOutputs.map(node => node.y + node.height)) + 100 : sourceNode?.y ?? getWorldCenter().y },
        { width: Math.min(4, snapshot.count) * (size.width + 42) - 42, height: Math.ceil(snapshot.count / 4) * (size.height + 42) - 42 });
      // 按下生成时冻结快照；异步读取图片期间继续编辑也不改变本轮请求。
      const references = referenceOverride || await Promise.all(resolved.images.map(async asset => ({
        id: createLocalId("reference"), name: asset.name, type: asset.mimeType, dataUrl: await blobToDataUrl(asset.blob)
      })));
      await persistCurrentSnapshot();
      const context = { canvasId, runId: createLocalId("run"), draftId: draft.id,
        draftNodeId: sourceNode?.id || previousRun?.draftNodeId || "", anchor,
        inputPrompt: snapshot.inputPrompt, inputSnapshot: snapshot };
      const task = onGenerate?.({ prompt: snapshot.prompt, model: snapshot.model, aspectRatio: snapshot.aspectRatio,
        quality: snapshot.quality, count: snapshot.count, referenceImages: references, canvasContext: context });
      if (!task) { onToast?.(text("taskFailed")); return; }
      commitRuns(previous => [...previous, runFromTask(task)]);
      commitNodes(previous => [...previous, ...task.images.map((image, index) => ({
        id: `history-${canvasId}-${image.id}`, type: "history-image", taskId: task.id,
        imageId: image.id, runId: context.runId, ...size,
        x: anchor.x + (index % 4) * (size.width + 42), y: anchor.y + Math.floor(index / 4) * (size.height + 42),
        createdAt: task.createdAt
      }))]);
      await persistCurrentSnapshot();
      onToast?.(text("submitted"));
    } catch (error) { console.error(error); onToast?.(error.message || text("taskFailed")); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }

  function generateOnCanvas() {
    const draft = draftsRef.current.find(item => item.id === settingsRef.current.activeDraftId);
    if (draft) submitRun(draft, resolveGenerationInput(draft, nodesRef.current, getNodeAsset));
  }

  function repeatRun(run, failedOnly = false) {
    const summary = summarizeRun(run, history);
    if (!summary.task) return;
    const snapshot = run.snapshot;
    const count = failedOnly ? summary.failed : snapshot.count;
    if (!count) return;
    const draft = { ...snapshot, id: run.draftId, count, prompt: snapshot.inputPrompt };
    submitRun(draft, { ...snapshot, hasPrompt: Boolean(snapshot.prompt), images: [], errors: [] },
      summary.task.referenceImages || [], run);
  }

  async function reuseRun(run) {
    const task = history.find(item => item.id === run.taskId);
    if (!task) { onToast?.("原始生成记录不可用，无法复用参数。"); return; }
    try {
      const assets = await Promise.all((task.referenceImages || []).map(async reference => {
        const response = await fetch(reference.dataUrl);
        const blob = await response.blob();
        return makeUploadAsset(new File([blob], reference.name || "历史参考图", { type: blob.type }));
      }));
      recordUndoSnapshot();
      commitNodes(previous => [...previous, ...assets]);
      // 使用任务的实际请求正文及图片快照，避免重新读取已变化的文本节点。
      createDraftNode({ refs: assets.map(asset => asset.id), title: "复用生成参数", undo: false,
        defaults: { ...run.snapshot, prompt: run.snapshot.prompt, refs: undefined } });
    } catch (error) { onToast?.("原始参考图无法读取。"); }
  }

  function revealRun(run) {
    commitNodes(previous => previous.map(node => node.taskId === run.taskId ? { ...node, hidden: false } : node));
    const outputs = nodesRef.current.filter(node => node.taskId === run.taskId);
    if (outputs.length) { setSelectedIds(outputs.map(node => node.id)); fitToContent(outputs); }
  }

  const connectorPaths = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map(node => [node.id, node]));
    const edges = [];
    const append = (parentId, childId, readOnly = false, suffix = "") => {
      const parent = nodeMap.get(parentId), child = nodeMap.get(childId);
      if (!parent || !child) return;
      const startX = parent.x + parent.width + CONNECTION_HANDLE_OFFSET, startY = parent.y + parent.height / 2;
      const endX = child.x - CONNECTION_HANDLE_OFFSET, endY = child.y + child.height / 2;
      const bend = Math.max(48, Math.abs(endX - startX) * .45);
      const id = suffix + edgeId(parentId, childId);
      edges.push({ id, parentId, childId, readOnly, d: `M ${startX} ${startY} C ${startX+bend} ${startY}, ${endX-bend} ${endY}, ${endX} ${endY}`,
        endX, endY, midX: (startX + endX) / 2, midY: (startY + endY) / 2,
        active: selectedEdgeId === id });
    };
    const generation = visibleNodes.find(node => node.draftId === activeDraftId);
    const selectedResult = visibleNodes.find(node => node.type === "history-image" && selectedIds.length === 1 && selectedIds[0] === node.id);
    if (generation && !selectedResult) activeDraft?.refs.forEach(ref => append(ref.nodeId, generation.id));
    for (const run of runs.filter(run => selectedResult ? run.taskId === selectedResult.taskId : run.draftId === activeDraftId)) {
      const outputs = visibleNodes.filter(node => node.runId === run.id);
      if (outputs.length) append(run.draftNodeId, outputs[0].id, true, "run:");
      if (outputs.some(node => selectedIds.includes(node.id)))
        run.snapshot.inputs.forEach(input => append(input.nodeId, outputs[0].id, true, "snapshot:"));
    }
    return edges;
  }, [visibleNodes, activeDraft, activeDraftId, runs, selectedIds, selectedEdgeId]);


  const selectedEdge = connectorPaths.find(path => path.id === selectedEdgeId);
  const minimap = useMemo(() => {
    if (visibleNodes.length === 0) return null;
    const minX = Math.min(...visibleNodes.map(node => node.x)) - 80;
    const minY = Math.min(...visibleNodes.map(node => node.y)) - 80;
    const maxX = Math.max(...visibleNodes.map(node => node.x + node.width)) + 80;
    const maxY = Math.max(...visibleNodes.map(node => node.y + node.height)) + 80;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = Math.min(180 / width, 108 / height);
    return { minX, minY, width, height, scale };
  }, [visibleNodes]);

  function centerViewportAt(worldX, worldY) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    commitViewport(current => ({
      ...current,
      x: rect.width / 2 - worldX * current.zoom,
      y: rect.height / 2 - worldY * current.zoom
    }));
  }

  const stageClassName = [
    "canvas-stage",
    tool === "hand" || spaceHeld ? "is-hand-tool" : "is-select-tool",
    gridVisible ? "is-grid-visible" : "is-grid-hidden",
    interactionType ? `is-${interactionType}` : "",
    draggingFiles ? "is-dragging-files" : "",
    referencePicker ? "is-reference-picking" : ""
  ].filter(Boolean).join(" ");

  const primarySelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const primarySelectedAsset = primarySelectedNode ? getNodeAsset(primarySelectedNode) : null;
  const inspectedRun = primarySelectedNode?.type === "history-image"
    ? runs.find(run => run.taskId === primarySelectedNode.taskId) || (primarySelectedAsset?.task ? runFromTask(primarySelectedAsset.task) : null) : null;

  const stageWidth = stageRef.current?.clientWidth || 1440;
  const stageHeight = stageRef.current?.clientHeight || 900;
  const connectionMenuStyle = connectionMenu
    ? {
        left: clamp(
          viewport.x + connectionMenu.point.x * viewport.zoom,
          12,
          Math.max(12, stageWidth - 208)
        ),
        top: clamp(
          viewport.y + connectionMenu.point.y * viewport.zoom,
          12,
          Math.max(12, stageHeight - 178)
        )
      }
    : undefined;
  const selectionBounds = selectedNodes.length > 0
    ? {
        minimumX: Math.min(...selectedNodes.map(node => node.x)),
        minimumY: Math.min(...selectedNodes.map(node => node.y)),
        maximumX: Math.max(...selectedNodes.map(node => node.x + node.width)),
        maximumY: Math.max(...selectedNodes.map(node => node.y + node.height))
      }
    : null;
  const selectionScreenCenterX = selectionBounds
    ? viewport.x + ((selectionBounds.minimumX + selectionBounds.maximumX) / 2) * viewport.zoom
    : stageWidth / 2;
  const selectionScreenTop = selectionBounds
    ? viewport.y + selectionBounds.minimumY * viewport.zoom
    : 120;
  const toolbarHalfWidth = 86;
  const contextualToolbarStyle = primarySelectedNode
    ? {
        left: clamp(selectionScreenCenterX, toolbarHalfWidth + 12, stageWidth - toolbarHalfWidth - 12),
        top: Math.max(12, selectionScreenTop - 41)
      }
    : undefined;
  async function saveAnnotation(blob) {
    const target = nodesRef.current.find(node => node.id === annotationNodeId);
    if (!target) return;
    try {
      const asset = await makeUploadAsset(new File([blob], `${nodeDisplayName(target)}-标注.png`, { type: blob.type }));
      asset.sourceNodeId = target.id;
      recordUndoSnapshot(); commitNodes(previous => [...previous, asset]);
      setAnnotationNodeId("");
      createDraftNode({ refs: [asset.id], title: "标注修改", undo: false,
        point: { x: target.x + target.width + 250, y: target.y + 100 },
        defaults: { prompt: language === "en" ? "Modify only the marked region while preserving the rest." : "仅修改标注区域，保持画面其他部分不变。", count: 1 } });
    } catch (error) { onToast?.(text("uploadFailed")); }
  }


  function revealAsset(node) {
    if (!node) return;
    if (node.hidden) {
      recordUndoSnapshot();
      const center = getWorldCenter();
      commitNodes(previous => previous.map(item => item.id === node.id ? { ...item, hidden: false,
        x: center.x - item.width / 2, y: center.y - item.height / 2 } : item));
    }
    const current = nodesRef.current.find(item => item.id === node.id);
    setSelectedIds([node.id]); fitToContent([current]); setHistoryPanelOpen(false);
  }

    const runProps = { history, cost: generationCostCredits, onReuse: reuseRun, onRepeat: repeatRun,
    onRecover: onRecoverTask, onReveal: revealRun, busy: submitting, language };

  function renderMentionMenu() {
    if (!mentionMenuOpen) return null;
    const query = prompt.match(/@([^@\n]*)$/)?.[1]?.trim().toLowerCase() || "";
    const candidates = visibleNodes.filter(isCanvasAsset).filter(node => (
      nodeDisplayName(node).toLowerCase().includes(query) ||
      node.type.includes(query)
    )).slice(0, 8);
    return (
      <div className="canvas-mention-menu">
        <strong>{language === "en" ? "Reference a canvas node" : "引用画布节点"}</strong>
        {candidates.length > 0 ? candidates.map(node => {
          const asset = getNodeAsset(node);
          return (
            <button key={node.id} type="button" onClick={() => insertMention(node)} disabled={Boolean(referencePicker)}>
              <span>{node.type === "text" ? <Type /> : asset.url ? <img src={asset.url} alt="" /> : <Image />}</span>
              <i>
                <b>{nodeDisplayName(node)}</b>
                <small>{node.type === "text" ? (language === "en" ? "Text node" : "文本节点") : (language === "en" ? "Image node" : "图片节点")}</small>
              </i>
            </button>
          );
        }) : <p>{language === "en" ? "No matching nodes" : "没有匹配的节点"}</p>}
      </div>
    );
  }

  return (
    <section className={`canvas-workspace wuli-canvas canvas-redesign${panelCollapsed ? " is-panel-collapsed" : ""}${active ? " is-active" : " mode-hidden"}`} aria-label={text("title")} onPointerDownCapture={captureStagePointerDown}>
      <header className="wuli-canvas-header canvas-floating-ui">
        <div className="wuli-project-switcher">
          <button className="wuli-home-button" type="button" onClick={onExit} title={text("exitClassic")}>
            <span><ArrowLeft /></span>
          </button>
          <div className="wuli-project-title"><strong>{projectTitle}</strong><small>{saving ? text("saving") : (language === "en" ? "Saved in this browser" : "保存在当前浏览器")}</small></div>
        </div>
        <div className="wuli-header-actions">
          <span className="wuli-credit-pill" title={language === "en" ? "Available credits" : "可用额度"}><Sparkles /><span>{formatCreditBalance(currentUser?.credits ?? 0)}</span></span>
          <button type="button" onClick={() => setHelpOpen(true)} title={language === "en" ? "Canvas help" : "画布帮助"}><HelpCircle /></button>

        </div>
      </header>
      <div
        ref={stageRef}
        className={stageClassName}
        style={{
          "--canvas-grid-size": `${24 * viewport.zoom}px`,
          "--canvas-grid-x": `${viewport.x % (24 * viewport.zoom)}px`,
          "--canvas-grid-y": `${viewport.y % (24 * viewport.zoom)}px`
        }}
        onPointerDown={beginStageInteraction}
        onPointerEnter={event => {
          stagePointerClientRef.current = {
            x: event.clientX,
            y: event.clientY
          };
        }}
        onPointerLeave={() => {
          stagePointerClientRef.current = null;
        }}
        onPointerMove={handleStagePointerMove}
        onPointerUp={endStageInteraction}
        onPointerCancel={endStageInteraction}
        onContextMenu={handleStageContextMenu}
        onDragEnter={event => {
          event.preventDefault();
          setDraggingFiles(true);
        }}
        onDragOver={event => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setDraggingFiles(false);
          }
        }}
        onDrop={handleDrop}
      >
        <input
          ref={canvasUploadInputRef}
          className="canvas-hidden-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={async event => {
            const worldPoint = pendingUploadPointRef.current;
            pendingUploadPointRef.current = null;
            await addCanvasFiles(event.target.files || [], worldPoint);
            event.target.value = "";
          }}
        />
        <input
          ref={connectionUploadInputRef}
          className="canvas-hidden-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={async event => {
            const context = pendingConnectionUploadRef.current;
            pendingConnectionUploadRef.current = null;
            await addCanvasFiles(event.target.files || [], context?.point, context);
            event.target.value = "";
          }}
        />
        <input
          ref={referenceUploadInputRef}
          className="canvas-hidden-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={async event => {
            await addReferenceFiles(
              event.target.files || [],
              referenceUploadTargetRef.current
            );
            event.target.value = "";
            referenceUploadTargetRef.current = "";
          }}
        />
        {referencePicker ? (
          <div className="canvas-reference-picker-banner canvas-floating-ui">
            <span>{language === "en" ? "Choose inputs for the locked draft" : "为当前草稿选择参考"} · {referencePicker.candidateIds.length}</span>
            <button type="button" onClick={confirmReferencePicker}>{language === "en" ? "Done" : "完成选择"}</button>
            <button type="button" onClick={() => setReferencePicker(null)}>
              {language === "en" ? "Cancel" : "取消"}
            </button>
          </div>
        ) : null}

        <div
          className="canvas-plane"
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`
          }}
        >
          {runs.map((run, index) => {
            const outputs = visibleNodes.filter(node => node.runId === run.id);
            if (!outputs.length) return null;
            const left = Math.min(...outputs.map(node => node.x)) - 18, top = Math.min(...outputs.map(node => node.y)) - 46;
            const width = Math.max(...outputs.map(node => node.x + node.width)) - left + 18;
            const height = Math.max(...outputs.map(node => node.y + node.height)) - top + 28;
            const state = summarizeRun(run, history);
            return <div key={run.id} className="canvas-result-group" style={{ left, top, width, height }} data-result-group={run.id}>
              <button type="button" onPointerDown={event => {
                selectedIdsRef.current = outputs.map(node => node.id); setSelectedIds(selectedIdsRef.current);
                beginNodeMove(event, outputs[0]);
              }}><Sparkles />{language === "en" ? "Batch" : "结果组"} {index + 1}<span>{state.done}/{state.total} · {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></button>
            </div>;
          })}
          <svg className={`canvas-connectors${linksVisible ? "" : " is-hidden"}`} aria-hidden="true">
            {connectorPaths.map(path => (
              <g key={path.id} className={`${path.active ? "is-active" : ""}${path.readOnly ? " is-provenance" : ""}`}>
                <path className="canvas-connector-line" d={path.d} />
                <path
                  className="canvas-connector-hit"
                  d={path.d}
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIds([]);
                    setSelectedEdgeId(path.id);
                  }}
                />
                <circle cx={path.endX} cy={path.endY} r="5" />
              </g>
            ))}
            {connectionDraft ? (
              <path
                className={`canvas-connector-draft${connectionDraft.snapTargetId ? " is-snapped" : ""}`}
                d={`M ${connectionDraft.start.x} ${connectionDraft.start.y} C ${
                  connectionDraft.start.x + (connectionDraft.startHandleType === "target" ? -72 : 72)
                } ${connectionDraft.start.y}, ${
                  connectionDraft.current.x + (connectionDraft.startHandleType === "target" ? 72 : -72)
                } ${connectionDraft.current.y}, ${connectionDraft.current.x} ${connectionDraft.current.y}`}
              />
            ) : null}
          </svg>

          {connectionDraft && !connectionMenu ? (
            <div
              className={`canvas-connection-cursor${connectionDraft.snapTargetId ? " is-snapped" : ""}`}
              style={{
                left: connectionDraft.current.x,
                top: connectionDraft.current.y
              }}
              aria-hidden="true"
            >
              <Sparkles />
            </div>
          ) : null}

          {visibleNodes.map((node, nodeIndex) => {
            const asset = getNodeAsset(node);
            const selected = selectedIds.includes(node.id);
            const referenceIndex = activeDraft?.refs.findIndex(ref => ref.nodeId === node.id) ?? -1;
            const nodeUiScale = clamp(1 / viewport.zoom, 1, 2.4);
            const isTextNode = node.type === "text";
            const isEditingTextNode = isTextNode && editingTextNodeId === node.id;
            const isEmptyImageNode = node.type === "generation";
            const nodeDraft = drafts.find(draft => draft.id === node.draftId);
            const latestRun = [...runs].reverse().find(run => run.draftId === node.draftId);
            const draftChanged = nodeDraft && latestRun && (nodeDraft.revision !== latestRun.snapshot.revision
              || resolveGenerationInput(nodeDraft, nodes, getNodeAsset).prompt !== latestRun.snapshot.prompt);
            const statusLabel = asset.status === "streaming"
              ? text("receiving")
              : asset.status === "error"
                ? text("failed")
                : text("generating");
            return (
              <article
                key={node.id}
                data-node-id={node.id}
                data-node-type={node.type}
                data-run-id={node.runId || undefined}
                className={`canvas-node${selected ? " is-selected" : ""}${asset.status === "error" ? " is-error" : ""}${isTextNode ? " is-text-node" : ""}${isEditingTextNode ? " is-editing" : ""}${isEmptyImageNode ? " is-generation-node" : ""}${referencePicker?.candidateIds.includes(node.id) ? " is-reference-candidate" : ""}`}
                style={{
                  width: node.width,
                  height: node.height,
                  transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                  zIndex: selected ? 100 + nodeIndex : nodeIndex + 2,
                  "--canvas-node-ui-scale": nodeUiScale
                }}
                title={asset.url ? text("preview") : statusLabel}
                onPointerDown={event => beginNodeMove(event, node)}
                onDoubleClick={event => {
                  if (referencePicker) return;
                  if (isTextNode) {
                    beginTextNodeEdit(event, node);
                    return;
                  }
                  if (asset.url) {
                    const previewAssets = visibleNodes
                      .map(item => getNodeAsset(item))
                      .filter(item => item.url)
                      .map(item => item.url);
                    onPreview?.(asset.url, previewAssets);
                  }
                }}
              >
                <div className="canvas-node-label">
                  {isTextNode ? <Type /> : isEmptyImageNode ? <Sparkles /> : <Image />}
                  <span>{isTextNode ? (node.title || text("textNodeTitle")) : (nodeDraft?.title || node.name || asset.task?.prompt || text("emptyImageTitle"))}</span>
                </div>
                {isTextNode ? (
                  <textarea
                    ref={element => {
                      if (element) {
                        textNodeInputRefs.current.set(node.id, element);
                      } else {
                        textNodeInputRefs.current.delete(node.id);
                      }
                    }}
                    value={node.content || ""}
                    placeholder={text("textNodePlaceholder")}
                    readOnly={!isEditingTextNode}
                    tabIndex={isEditingTextNode ? 0 : -1}
                    onPointerDown={event => {
                      if (isEditingTextNode) {
                        event.currentTarget.classList.remove("is-keyboard-input-active");
                        event.stopPropagation();
                        setSelectedIds([node.id]);
                      } else {
                        beginNodeMove(event, node);
                      }
                    }}
                    onPointerMove={event => {
                      if (isEditingTextNode) {
                        event.currentTarget.classList.remove("is-keyboard-input-active");
                      }
                    }}
                    onDoubleClick={event => beginTextNodeEdit(event, node)}
                    onFocus={() => {
                      textEditSnapshotRef.current ||= captureCanvasSnapshot();
                    }}
                    onKeyDown={event => {
                      event.currentTarget.classList.add("is-keyboard-input-active");
                    }}
                    onChange={event => {
                      event.currentTarget.classList.add("is-keyboard-input-active");
                      updateTextNode(node.id, event.target.value);
                    }}
                    onBlur={event => {
                      event.currentTarget.classList.remove("is-keyboard-input-active");
                      setEditingTextNodeId(current => current === node.id ? "" : current);
                      finishTextEdit();
                    }}
                  />
                ) : asset.url ? (
                  <img
                    src={asset.url}
                    alt={asset.name || text("localAsset")}
                    draggable="false"
                    onLoad={event => syncImageNodeToDisplaySize(
                      node.id,
                      node.type === "history-image"
                        ? sizeFromAspectRatio(asset.task?.aspectRatio || "auto")
                        : fitNodeSize(
                            event.currentTarget.naturalWidth,
                            event.currentTarget.naturalHeight
                          )
                    )}
                  />
                ) : isEmptyImageNode ? (
                  <div className="canvas-generation-card">
                    <span><Sparkles />{language === "en" ? "GENERATION" : "生成草稿"}<i>{!latestRun ? (language === "en" ? "Not run" : "未运行") : draftChanged ? (language === "en" ? "Modified" : "有未运行修改") : (language === "en" ? "Submitted" : "已运行")}</i></span>
                    <strong>{nodeDraft?.title || "生成"}</strong>
                    <p>{nodeDraft?.prompt || (language === "en" ? "Describe a new image in the panel" : "在右侧面板中描述想要的画面")}</p>
                    <small>{nodeDraft?.refs.length || 0} {language === "en" ? "inputs" : "项参考"} · {nodeDraft?.count || 1} {language === "en" ? "images" : "张"} · {nodeDraft?.aspectRatio || "auto"}</small>
                  </div>
                ) : (
                  <div className={`canvas-node-placeholder is-${asset.status}`}>
                    {asset.status === "error" ? <X /> : <LoaderCircle className="is-spinning" />}
                    <strong>{statusLabel}</strong>{asset.error ? <span>{asset.error}</span> : null}
                  </div>
                )}

                {referenceIndex >= 0 ? <b className="canvas-reference-index">{referenceIndex + 1}</b> : null}
                {isEmptyImageNode && <button
                  className="canvas-connection-handle is-input"
                  type="button"
                  data-connection-input={node.id}
                  aria-label={text("connectUpstream")}
                  onPointerDown={event => beginConnection(event, node, "target")}
                >
                  <Sparkles />
                </button>}
                {isCanvasAsset(node) && <button
                  className="canvas-connection-handle is-output"
                  type="button"
                  data-connection-output={node.id}
                  aria-label={text("connectDownstream")}
                  onPointerDown={event => beginConnection(event, node, "source")}
                >
                  <Sparkles />
                </button>}
                {selected && selectedIds.length === 1 ? (
                  <>
                    {isTextNode ? RESIZE_HANDLES.map(direction => (
                      <button
                        key={direction}
                        className={`canvas-resize-handle is-${direction}`}
                        type="button"
                        aria-label={language === "en" ? `Resize ${direction}` : `${direction} 方向缩放`}
                        onPointerDown={event => beginNodeResize(event, node, direction)}
                      />
                    )) : null}
                    <span className="canvas-node-dimensions">{Math.round(node.width)} × {Math.round(node.height)}</span>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>

        {selectionBox ? (
          <div
            className="canvas-selection-box canvas-floating-ui"
            style={{
              left: selectionBox.left - (stageRef.current?.getBoundingClientRect().left || 0),
              top: selectionBox.top - (stageRef.current?.getBoundingClientRect().top || 0),
              width: selectionBox.width,
              height: selectionBox.height
            }}
          />
        ) : null}

        {connectionMenu ? (
          <div
            className="canvas-connection-menu canvas-floating-ui"
            data-connection-menu={connectionMenu.startHandleType}
            style={connectionMenuStyle}
          >
            <strong>
              {connectionMenu.startHandleType === "target"
                ? text("addUpstreamNode")
                : text("addDownstreamNode")}
            </strong>
            {connectionMenu.startHandleType === "source" ? <button type="button" onClick={() => addConnectedNode("generation")}><Sparkles /><span>{text("addImageNode")}</span></button> : <>
              <button type="button" onClick={() => addConnectedNode("text")}><Type /><span>{text("addTextNode")}</span></button>
              <button type="button" onClick={openConnectionUpload}><Upload /><span>{text("upload")}</span></button>
            </>}

          </div>
        ) : null}

        {pointerContextMenu && selectedNodes.length > 0 ? (
          <div
            className="canvas-pointer-context-menu canvas-floating-ui"
            style={{
              left: clamp(pointerContextMenu.left, 12, Math.max(12, stageWidth - 216)),
              top: clamp(pointerContextMenu.top, 12, Math.max(12, stageHeight - 196))
            }}
          >
            <button type="button" onClick={() => {
              copySelectedNodes();
              setPointerContextMenu(null);
            }}><Copy /><span>{language === "en" ? "Copy" : "复制节点"}</span><kbd>Ctrl+C</kbd></button>
            <button type="button" onClick={() => {
              duplicateSelectedNodes();
              setPointerContextMenu(null);
            }}><CopyPlus /><span>{language === "en" ? "Duplicate" : "复制并粘贴"}</span><kbd>Ctrl+D</kbd></button>
            <button type="button" onClick={() => {
              fitToContent(selectedNodes);
              setPointerContextMenu(null);
            }}><Focus /><span>{text("focusSelected")}</span><kbd>F</kbd></button>
            <button className="is-danger" type="button" onClick={() => {
              setPointerContextMenu(null);
              removeSelectedNodes();
            }}><Trash2 /><span>{text("delete")}</span><kbd>Delete</kbd></button>
          </div>
        ) : null}

        {primarySelectedNode && !referencePicker ? (
          <div className="canvas-context-toolbar canvas-floating-ui" style={contextualToolbarStyle}>
            <button className="canvas-toolbar-more-trigger" type="button" title="More" onClick={() => setNodeMoreOpen(value => !value)}><MoreHorizontal /></button>
            <i />
            <button type="button" title={language === "en" ? "Copy" : "复制"} onClick={copySelectedNodes}><Copy /></button>
            <button
              type="button"
              title={text("download")}
              onClick={() => downloadNodes([primarySelectedNode])}
              disabled={!primarySelectedAsset?.url || primarySelectedAsset?.status !== "done"}
            ><Download /></button>
            <button
              type="button"
              title={language === "en" ? "Fullscreen" : "全屏"}
              disabled={!primarySelectedAsset?.url}
              onClick={() => primarySelectedAsset?.url && onPreview?.(primarySelectedAsset.url, [primarySelectedAsset.url])}
            ><Maximize2 /></button>
            {nodeMoreOpen ? (
              <div className="canvas-node-more-menu">
                {primarySelectedNode.type !== "text" && primarySelectedAsset?.url ? (
                  <button type="button" onClick={() => {
                    setNodeMoreOpen(false);
                    setAnnotationNodeId(primarySelectedNode.id);
                  }}><Paintbrush /><span>{text("annotate")}</span></button>
                ) : null}
                {isCanvasAsset(primarySelectedNode) && primarySelectedNode.type !== "text" ? (
                  <button type="button" onClick={() => {
                    setNodeMoreOpen(false);
                    prepareNodeContinuation(primarySelectedNode);
                  }}><Sparkles /><span>{text("continueFromNode")}</span></button>
                ) : null}
                <button type="button" onClick={() => {
                  setNodeMoreOpen(false);
                  fitToContent([primarySelectedNode]);
                }}><Focus /><span>{text("focusSelected")}</span></button>
                <button type="button" onClick={() => {
                  setNodeMoreOpen(false);
                  duplicateSelectedNodes();
                }}><CopyPlus /><span>{language === "en" ? "Quick duplicate" : "快速克隆"}</span></button>
                <button className="is-danger" type="button" onClick={() => {
                  setNodeMoreOpen(false);
                  removeNodesByIds([primarySelectedNode.id]);
                }}><Trash2 /><span>{text("delete")}</span></button>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedEdge && linksVisible ? (
          <div
            className="canvas-edge-toolbar canvas-floating-ui"
            style={{
              left: viewport.x + selectedEdge.midX * viewport.zoom,
              top: viewport.y + selectedEdge.midY * viewport.zoom
            }}
          >
            <span><Link2 />{selectedEdge.readOnly ? (language === "en" ? "Submitted provenance" : "运行时来源 · 只读") : (language === "en" ? "Draft reference" : "草稿参考")}</span>
            {!selectedEdge.readOnly && <button type="button" onClick={() => disconnectEdge(selectedEdge.id)} title={language === "en" ? "Remove reference" : "移除参考"}><Unlink /></button>}

          </div>
        ) : null}

        {!hydrated ? (
          <div className="canvas-loading canvas-floating-ui">
            <LoaderCircle className="is-spinning" />
            <span>{storageError || text("loading")}</span>
            {storageError && <button type="button" onClick={() => window.location.reload()}>{language === "en" ? "Reload" : "重新加载"}</button>}
          </div>
        ) : null}

        {hydrated && visibleNodes.length === 0 ? (
          <div className="canvas-empty canvas-floating-ui">
            <span><ImagePlus /></span>
            <h2>{text("emptyTitle")}</h2>
            <p>{text("emptyCopy")}</p>
            <Button type="button" onClick={() => addEmptyImageNode()}><Sparkles />{text("addImageNode")}</Button>
            <Button type="button" variant="secondary" onClick={() => addTextNode()}><Type />{text("addTextNode")}</Button>
            <Button type="button" variant="secondary" onClick={() => openUploadPicker()}>
              <Plus data-icon="inline-start" />
              {text("emptyAction")}
            </Button>
          </div>
        ) : null}

        {draggingFiles ? (
          <div className="canvas-drop-overlay canvas-floating-ui">
            <Upload />
            <strong>{text("dragDrop")}</strong>
          </div>
        ) : null}

        {contextMenu ? (
          <div
            className="canvas-context-menu canvas-floating-ui"
            style={{ left: contextMenu.left, top: contextMenu.top }}
            role="menu"
          >
            <button type="button" role="menuitem" onClick={() => addEmptyImageNode(contextMenu.worldPoint)}>
              <Image /><span>{text("addImageNode")}</span><kbd>I</kbd>
            </button>
            <button type="button" role="menuitem" onClick={() => addTextNode(contextMenu.worldPoint)}>
              <Type /><span>{text("addTextNode")}</span><kbd>T</kbd>
            </button>
            <button type="button" role="menuitem" onClick={() => {
              const worldPoint = contextMenu.worldPoint;
              setContextMenu(null);
              openUploadPicker(worldPoint);
            }}>
              <Upload /><span>{text("addLocalImage")}</span><kbd>U</kbd>
            </button>
          </div>
        ) : null}

        <div className="wuli-canvas-toolbar canvas-floating-ui" inert={referencePicker ? true : undefined}>
          {addMenuOpen ? (
            <div className="wuli-add-menu is-open">
              <button type="button" onClick={() => addEmptyImageNode()}><Image /><span>{text("addImageNode")}</span><kbd>I</kbd></button>
              <button type="button" onClick={() => addTextNode()}><Type /><span>{text("addTextNode")}</span><kbd>T</kbd></button>
              <button type="button" onClick={() => {
                setAddMenuOpen(false);
                openUploadPicker();
              }}><Upload /><span>{text("upload")}</span><kbd>U</kbd></button>
            </div>
          ) : null}
          <button className={addMenuOpen ? "active" : ""} type="button" onClick={() => setAddMenuOpen(value => !value)} title={text("addImageNode")}><Plus /></button>
          <button
            className={historyPanelOpen ? "active history" : "history"}
            type="button"
            onClick={() => setHistoryPanelOpen(value => !value)}
            title={text("generatedHistory")}
            aria-label={text("generatedHistory")}
            aria-expanded={historyPanelOpen}
            data-testid="canvas-history-trigger"
          ><HistoryIcon /></button>

          <i className="wuli-toolbar-divider" />
          <button className={tool === "select" ? "active light" : ""} type="button" onClick={() => setTool("select")} title={`${text("select")} (V)`}><MousePointer2 /></button>
          <button type="button" onClick={undoCanvasChange} disabled={undoStack.length === 0} title={text("undo")}><Undo2 /></button>
          <button type="button" onClick={redoCanvasChange} disabled={redoStack.length === 0} title={text("redo")}><Redo2 /></button>
          <button type="button" className={tool === "hand" ? "active light" : ""} onClick={() => setTool("hand")} title={`${text("hand")} (H)`}><Hand /></button>
        </div>

        {historyPanelOpen ? (
          <aside
            className="canvas-history-panel canvas-floating-ui"
            aria-label={text("generatedHistory")}
            data-testid="canvas-history-panel"
            onPointerDown={event => event.stopPropagation()}
            onWheel={event => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>{language === "en" ? "Project library" : "素材与运行"}</strong>
                <span>{text("generatedHistoryHint")}</span>
              </div>
              <b>{text("generatedHistoryCount", { count: historyImageCount })}</b>
              <button type="button" onClick={() => setHistoryPanelOpen(false)} title={text("close")}><X /></button>
            </header>
            <nav className="canvas-library-tabs">{[["assets", "项目素材", "Assets"], ["history", "经典历史", "History"], ["runs", "运行记录", "Runs"]].map(([id, zh, en]) => <button type="button" key={id} className={libraryTab === id ? "active" : ""} onClick={() => setLibraryTab(id)}>{language === "en" ? en : zh}</button>)}</nav>
            <div className="canvas-history-scroll">
              {libraryTab === "assets" ? <div className="canvas-library-assets">{nodes.filter(isCanvasAsset).map(node => {
                const asset = getNodeAsset(node);
                return <article key={node.id}>
                  {asset.url ? <img src={asset.url} alt="" /> : <Type />}<strong>{nodeDisplayName(node)}</strong>
                  <button type="button" onClick={() => revealAsset(node)}>{language === "en" ? "Show" : "查看"}</button>
                  <button type="button" disabled={!activeDraft || Boolean(referencePicker)} onClick={() => addReferences(activeDraftId, [node.id])}>{language === "en" ? "Reference" : "加入参考"}</button>
                </article>;
              })}{nodes.filter(isCanvasAsset).length === 0 && <p>{language === "en" ? "No project assets yet" : "项目中还没有素材"}</p>}</div> : libraryTab === "runs" ? <div className="canvas-library-runs">{[...runs].reverse().map(run => <CanvasRunDetails key={run.id} run={run} {...runProps} />)}{!runs.length && <p>{language === "en" ? "No runs yet" : "还没有运行记录"}</p>}</div> : historyLoading ? (
                <div className="canvas-history-empty"><LoaderCircle className="is-spinning" /><span>{text("generatedHistoryLoading")}</span></div>
              ) : historyImageGroups.length === 0 ? (
                <div className="canvas-history-empty"><ImagePlus /><span>{text("generatedHistoryEmpty")}</span></div>
              ) : historyImageGroups.map(group => (
                <section key={group.date} className="canvas-history-group">
                  <h3>{group.date}</h3>
                  <div>
                    {group.items.map(({ task, image }) => (
                      <article
                        key={`${task.id}-${image.id}`}
                        onPointerDown={event => beginHistoryPointerDrag(event, task, image)}
                        onPointerMove={moveHistoryPointerDrag}
                        onPointerUp={endHistoryPointerDrag}
                        onPointerCancel={endHistoryPointerDrag}
                        onLostPointerCapture={endHistoryPointerDrag}
                        title={text("generatedHistoryHint")}
                        data-testid="canvas-history-image"
                      >
                        <img src={image.url} alt={task.prompt || text("generatedHistory")} draggable="false" />
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </aside>
        ) : null}

        {historyDragPreview ? (
          <div
            className="canvas-history-drag-preview"
            style={{ left: historyDragPreview.x, top: historyDragPreview.y }}
            aria-hidden="true"
          >
            <img src={historyDragPreview.url} alt="" />
          </div>
        ) : null}

        <div className="canvas-zoom-controls wuli-zoom-controls canvas-floating-ui">
          <button type="button" onClick={() => zoomFromCenter(-0.15)} title={text("zoomOut")}><Minus /></button>
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            value={Math.round(viewport.zoom * 100)}
            onChange={event => {
              const rect = stageRef.current?.getBoundingClientRect();
              if (rect) {
                zoomAroundPoint(Number(event.target.value) / 100, rect.left + rect.width / 2, rect.top + rect.height / 2);
              }
            }}
            aria-label={text("title")}
          />
          <button type="button" onClick={() => zoomFromCenter(0.15)} title={text("zoomIn")}><Plus /></button>
          <button className="canvas-zoom-value" type="button" onClick={() => commitViewport(current => ({ ...current, zoom: 1 }))}>{Math.round(viewport.zoom * 100)}%</button>
          <button type="button" onClick={() => fitToContent()} title={text("fit")}><Focus /></button>
          <button className={linksVisible ? "active" : ""} type="button" title={language === "en" ? "Show connections" : "显示连线"} onClick={() => setLinksVisible(value => !value)}>
            {linksVisible ? <Link2 /> : <Unlink />}
          </button>
          <button className={gridVisible ? "active" : ""} type="button" title={language === "en" ? "Toggle grid" : "切换网格"} onClick={() => setGridVisible(value => !value)}><Grid3X3 /></button>
          <button className={minimapVisible ? "active" : ""} type="button" onClick={() => setMinimapVisible(value => !value)} title={language === "en" ? "Toggle minimap" : "切换导航地图"}><MapPin /></button>
        </div>

        {minimapVisible && minimap ? (
          <div
            className="canvas-minimap canvas-floating-ui"
            onPointerDown={event => {
              const rect = event.currentTarget.getBoundingClientRect();
              centerViewportAt(
                minimap.minX + (event.clientX - rect.left) / minimap.scale,
                minimap.minY + (event.clientY - rect.top) / minimap.scale
              );
            }}
          >
            {visibleNodes.map(node => (
              <i
                key={node.id}
                className={`${selectedIds.includes(node.id) ? "is-selected" : ""}${node.type === "text" ? " is-text" : ""}`}
                style={{
                  left: (node.x - minimap.minX) * minimap.scale,
                  top: (node.y - minimap.minY) * minimap.scale,
                  width: Math.max(3, node.width * minimap.scale),
                  height: Math.max(3, node.height * minimap.scale)
                }}
              />
            ))}
            <b
              style={{
                left: (-viewport.x / viewport.zoom - minimap.minX) * minimap.scale,
                top: (-viewport.y / viewport.zoom - minimap.minY) * minimap.scale,
                width: ((stageRef.current?.clientWidth || 0) / viewport.zoom) * minimap.scale,
                height: ((stageRef.current?.clientHeight || 0) / viewport.zoom) * minimap.scale
              }}
            />
          </div>
        ) : null}



        {helpOpen ? (
          <div className="canvas-help-backdrop canvas-floating-ui" role="dialog" aria-modal="true">
            <section className="canvas-help-dialog">
              <header>
                <div><HelpCircle /><strong>{language === "en" ? "Canvas shortcuts" : "画布快捷操作"}</strong></div>
                <button type="button" onClick={() => setHelpOpen(false)}><X /></button>
              </header>
              <div className="canvas-help-grid">
                {[
                  ["V", language === "en" ? "Select / box select" : "选择 / 框选"],
                  ["H / Space", language === "en" ? "Pan canvas" : "平移画布"],
                  ["Wheel", language === "en" ? "Pan canvas in two dimensions" : "二维平移画布"],
                  ["Ctrl/⌘ + Wheel", language === "en" ? "Zoom around the pointer" : "以鼠标位置为中心缩放"],
                  ["Middle / Right drag", language === "en" ? "Pan from empty canvas" : "从空白处拖动平移"],
                  ["Right click", language === "en" ? "Open node actions" : "打开节点操作菜单"],
                  ["Ctrl C / V", language === "en" ? "Copy / paste nodes at pointer" : "复制 / 粘贴到鼠标位置"],
                  ["Ctrl D", language === "en" ? "Quick duplicate" : "快速克隆"],
                  ["Delete", language === "en" ? "Delete node or connection" : "删除节点或连线"],
                  ["F", language === "en" ? "Focus selection" : "聚焦所选"],
                  ["I / T / U", language === "en" ? "Generation / text / upload" : "生成 / 文本 / 上传"],
                  ["Ctrl Z / Y", language === "en" ? "Undo / redo" : "撤销 / 重做"],
                  ["@", language === "en" ? "Reference image or text node" : "引用图片或文本节点"]
                ].map(([shortcut, label]) => (
                  <div key={shortcut}><kbd>{shortcut}</kbd><span>{label}</span></div>
                ))}
              </div>
              <p>
                {language === "en"
                  ? "Drag from the left dot to add an upstream input, or from the right dot to add a downstream output. Releasing on empty canvas opens the node type menu."
                  : "从左侧圆点拖出可添加前置输入，从右侧圆点拖出可添加后续输出；在空白处松开会打开节点类型菜单。"}
              </p>
            </section>
          </div>
        ) : null}

        {annotationNodeId ? (
          <AnnotationEditor
            imageUrl={getNodeAsset(nodesRef.current.find(node => node.id === annotationNodeId) || {}).url}
            title={nodeDisplayName(nodesRef.current.find(node => node.id === annotationNodeId) || {})}
            language={language}
            onCancel={() => setAnnotationNodeId("")}
            onSave={saveAnnotation}
          />
        ) : null}
      </div>
      {hydrated && <CanvasInspector language={language} collapsed={panelCollapsed} onCollapse={() => setPanelCollapsed(value => !value)}
        draft={activeDraft} selection={primarySelectedNode} selectedAsset={primarySelectedAsset} run={inspectedRun}
        onFocusDraft={() => {
          const node = nodesRef.current.find(item => item.draftId === activeDraftId && !item.hidden);
          if (node) fitToContent([node]);
        }}
        selectedNodes={selectedNodes} onDuplicate={duplicateSelectedNodes} onRemove={removeSelectedNodes}
        onFocus={() => fitToContent(selectedNodes)} onMultiGenerate={() => {
          const images = selectedNodes.filter(node => node.type !== "text" && isCanvasAsset(node) && getNodeAsset(node).blob && getNodeAsset(node).status === "done");
          if (images.length > MAX_REFERENCE_IMAGES) { onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES })); return; }
          createDraftNode({ refs: images.map(node => node.id), title: "多图创作" });
        }} onAlign={() => {
          recordUndoSnapshot(); const left = Math.min(...selectedNodes.map(node => node.x));
          commitNodes(previous => previous.map(node => selectedIds.includes(node.id) ? { ...node, x: left } : node));
        }} onEditStart={() => { draftEditSnapshotRef.current ||= captureCanvasSnapshot(); }} onEditEnd={() => {
          const before = draftEditSnapshotRef.current; draftEditSnapshotRef.current = null;
          if (before && JSON.stringify(before.drafts) !== JSON.stringify(draftsRef.current)) recordUndoSnapshot(before);
        }}
        nodes={nodes} getAsset={getNodeAsset} resolved={resolvedInput} promptRef={promptRef}
        onPrompt={handlePromptChange} onChange={commitSetting} onGenerate={generateOnCanvas}
        onNew={() => createDraftNode()} onReturn={() => activateDraft(activeDraftId)}
        onContinue={() => prepareNodeContinuation(primarySelectedNode)}
        onAddSelected={() => { addReferences(activeDraftId, [primarySelectedNode.id]); activateDraft(activeDraftId); }}
        onAnnotate={() => setAnnotationNodeId(primarySelectedNode.id)} onPicker={startCanvasReferencePicker}
        onUpload={requestReferenceUpload} onRemoveRef={removeGenerationReference}
        onReorderRef={(index, direction) => { const refs = [...activeDraft.refs]; [refs[index], refs[index + direction]] = [refs[index + direction], refs[index]]; updateDraft(activeDraft.id, { refs }, true); }}
        onRevealAsset={revealAsset} mentionMenu={renderMentionMenu()} busy={submitting} currentUser={currentUser}
        estimatedCost={estimatedGenerationCost} runProps={runProps} picking={Boolean(referencePicker)} />}
    </section>
  );
}

export default CanvasWorkspace;
