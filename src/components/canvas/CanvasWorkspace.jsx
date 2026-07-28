import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  CirclePlus,
  Copy,
  Download,
  Focus,
  GitBranch,
  Grid3X3,
  Hand,
  Image,
  ImagePlus,
  Link2,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PanelLeftClose,
  Plus,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadCanvasSnapshot, saveCanvasSnapshot } from "@/lib/canvas-db";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const MAX_REFERENCE_IMAGES = 8;
const MAX_GENERATION_COUNT = 8;
const SAVE_DEBOUNCE_MS = 500;
const MAX_UNDO_STEPS = 40;

const ratioOptions = ["auto", "9:21", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"];

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
    continueFromNode: "从这里继续创作",
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
    emptyCopy: "拖入图片，或在下方输入提示词生成第一组画面。",
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
    promptRequired: "请输入提示词。",
    uploadOnlyImages: "请选择图片文件。",
    uploadFailed: "图片添加失败。",
    uploadPartial: "部分图片无法读取，其他图片已添加。",
    referenceLimit: "最多使用 {count} 张参考图。",
    missingReference: "所选图片还没有生成完成。",
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
    exitClassic: "经典模式",
    projectTitle: "Image2 创意画布",
    share: "复制画布链接",
    shareDone: "画布链接已复制",
    addImageNode: "添加图像节点",
    addTextNode: "添加文本节点",
    textNodeTitle: "文本节点",
    textNodePlaceholder: "输入创意、描述或分镜内容…",
    emptyImageTitle: "图片节点",
    emptyImageCopy: "选择此节点后描述画面，生成结果会从这里延展",
    openAgent: "打开 AI 创作助手",
    closeAgent: "关闭",
    agentGreeting: "hi~ 今天想创作点什么？",
    newChat: "新对话",
    historyChat: "历史对话",
    defaultMode: "默认模式",
    addReference: "添加参考",
    imageModel: "Image2",
    enhance: "高清",
    panorama: "全景图",
    relight: "重打光",
    upscale: "智能放大",
    crop: "裁剪",
    annotate: "标注"
  },
  en: {
    title: "Infinite Canvas",
    saved: "Saved locally",
    saving: "Saving…",
    loading: "Restoring canvas…",
    select: "Select",
    hand: "Hand",
    upload: "Upload images",
    fit: "Fit content",
    focusSelected: "Focus selected",
    continueFromNode: "Continue from here",
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
    emptyCopy: "Drop in images, or describe your first visual below.",
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
    promptRequired: "Enter a prompt first.",
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
    exitClassic: "Classic mode",
    projectTitle: "Image2 Creative Canvas",
    share: "Copy canvas link",
    shareDone: "Canvas link copied",
    addImageNode: "Add image node",
    addTextNode: "Add text node",
    textNodeTitle: "Text node",
    textNodePlaceholder: "Write an idea, description, or storyboard…",
    emptyImageTitle: "Image node",
    emptyImageCopy: "Select this node and describe the visual to branch from here",
    openAgent: "Open AI creator",
    closeAgent: "Close",
    agentGreeting: "Hi~ What would you like to create today?",
    newChat: "New chat",
    historyChat: "History",
    defaultMode: "Default mode",
    addReference: "Add reference",
    imageModel: "Image2",
    enhance: "HD",
    panorama: "Panorama",
    relight: "Relight",
    upscale: "Upscale",
    crop: "Crop",
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

function CanvasWorkspace({
  active,
  language = "zh",
  currentUser,
  history,
  historyLoading,
  focusSignal,
  onGenerate,
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
  const [tool, setTool] = useState("select");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [quality, setQuality] = useState("medium");
  const [count, setCount] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [interactionType, setInteractionType] = useState("");
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const stageRef = useRef(null);
  const promptRef = useRef(null);
  const uploadInputRef = useRef(null);
  const textEditSnapshotRef = useRef(null);
  const nodesRef = useRef(nodes);
  const viewportRef = useRef(viewport);
  const selectedIdsRef = useRef(selectedIds);
  const settingsRef = useRef({ prompt, aspectRatio, quality, count });
  const interactionRef = useRef(null);
  const didInitialFitRef = useRef(false);

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

  function commitSetting(key, value, setter) {
    settingsRef.current = { ...settingsRef.current, [key]: value };
    setter(value);
  }

  function persistCurrentSnapshot() {
    if (!hydrated) {
      return Promise.resolve();
    }
    return saveCanvasSnapshot({
      nodes: nodesRef.current,
      viewport: viewportRef.current,
      settings: settingsRef.current
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
    settingsRef.current = { prompt, aspectRatio, quality, count };
  }, [prompt, aspectRatio, quality, count]);

  useEffect(() => {
    let cancelled = false;

    loadCanvasSnapshot()
      .then(snapshot => {
        if (cancelled) {
          return;
        }

        const restoredNodes = snapshot.nodes.map(node => ({
          ...node,
          status: node.type === "upload" ? "done" : node.status,
          url: node.type === "upload" && node.assetBlob ? URL.createObjectURL(node.assetBlob) : ""
        }));
        commitNodes(restoredNodes);

        if (snapshot.viewport && Number.isFinite(snapshot.viewport.zoom)) {
          didInitialFitRef.current = true;
          commitViewport({
            x: Number(snapshot.viewport.x) || 0,
            y: Number(snapshot.viewport.y) || 0,
            zoom: clamp(Number(snapshot.viewport.zoom) || 1, MIN_ZOOM, MAX_ZOOM)
          });
        }

        if (snapshot.settings) {
          const restoredSettings = {
            prompt: String(snapshot.settings.prompt || ""),
            aspectRatio: ratioOptions.includes(snapshot.settings.aspectRatio) ? snapshot.settings.aspectRatio : "auto",
            quality: ["low", "medium", "high"].includes(snapshot.settings.quality) ? snapshot.settings.quality : "medium",
            count: clamp(Number(snapshot.settings.count) || 1, 1, MAX_GENERATION_COUNT)
          };
          settingsRef.current = restoredSettings;
          setPrompt(restoredSettings.prompt);
          setAspectRatio(restoredSettings.aspectRatio);
          setQuality(restoredSettings.quality);
          setCount(restoredSettings.count);
        }
      })
      .catch(error => {
        console.error(error);
        onToast?.(language === "en" ? "Canvas storage is unavailable." : "画布本地存储不可用。");
      })
      .finally(() => {
        if (!cancelled) {
          setHydrated(true);
        }
      });

    return () => {
      cancelled = true;
      nodesRef.current.forEach(node => {
        if (node.type === "upload") {
          revokeRuntimeUrl(node.url);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }

    setSaving(true);
    const timer = window.setTimeout(() => {
      saveCanvasSnapshot({
        nodes,
        viewport,
        settings: { prompt, aspectRatio, quality, count }
      })
        .catch(error => {
          console.error(error);
          onToast?.(language === "en" ? "Canvas changes could not be saved." : "画布更改未能保存。");
        })
        .finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [nodes, viewport, prompt, aspectRatio, quality, count, hydrated]);

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

  const historyImageMap = useMemo(() => {
    const imageMap = new Map();
    history.forEach(task => {
      task.images?.forEach(image => {
        imageMap.set(image.id, { task, image });
      });
    });
    return imageMap;
  }, [history]);

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

    if (node.type === "empty-image") {
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
        url: node.url,
        blob: node.assetBlob,
        mimeType: node.mimeType || node.assetBlob?.type || "image/png",
        name: node.name || text("localAsset"),
        status: "done",
        error: ""
      };
    }

    const linked = historyImageMap.get(node.imageId);
    return linked
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
          status: "loading",
          error: ""
        };
  }

  function captureCanvasSnapshot() {
    return {
      nodes: nodesRef.current.map(node => ({ ...node })),
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

    nodesRef.current.forEach(node => {
      if (node.type === "upload") {
        revokeRuntimeUrl(node.url);
      }
    });

    const availableHistoryIds = new Set(historyImageMap.keys());
    const restoredNodes = snapshot.nodes.flatMap(node => {
      if (node.type === "history-image" && !availableHistoryIds.has(node.imageId)) {
        return [];
      }
      if (node.type === "upload") {
        if (!node.assetBlob) {
          return [];
        }
        return [{ ...node, url: URL.createObjectURL(node.assetBlob) }];
      }
      return [{ ...node }];
    });
    const restoredIds = new Set(restoredNodes.map(node => node.id));
    const newlyCreatedHistoryNodes = nodesRef.current
      .filter(node => (
        node.type === "history-image"
        && availableHistoryIds.has(node.imageId)
        && !restoredIds.has(node.id)
      ))
      .map(node => ({ ...node, hidden: true, updatedAt: new Date().toISOString() }));
    const nextNodes = [...restoredNodes, ...newlyCreatedHistoryNodes];
    const nextSelectedIds = snapshot.selectedIds.filter(id => nextNodes.some(node => node.id === id && !node.hidden));

    commitNodes(nextNodes);
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

  function createPlacementPositions(amount, nodeSize, anchor, existingNodes = nodesRef.current) {
    const gap = 42;
    const columns = amount > 4 ? 4 : amount;
    const rows = Math.ceil(amount / Math.max(1, columns));
    const totalWidth = columns * nodeSize.width + Math.max(0, columns - 1) * gap;
    const totalHeight = rows * nodeSize.height + Math.max(0, rows - 1) * gap;
    const selectedNodes = existingNodes.filter(node => selectedIdsRef.current.includes(node.id) && !node.hidden);
    let startX = anchor?.x ?? getWorldCenter().x - totalWidth / 2;
    let startY = anchor?.y ?? getWorldCenter().y - totalHeight / 2;

    if (!anchor && selectedNodes.length > 0) {
      startX = Math.max(...selectedNodes.map(node => node.x + node.width)) + 76;
      startY = Math.min(...selectedNodes.map(node => node.y));
    }

    return Array.from({ length: amount }, (_, index) => ({
      x: startX + (index % columns) * (nodeSize.width + gap),
      y: startY + Math.floor(index / columns) * (nodeSize.height + gap)
    }));
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
    const composerReserve = rect.width < 760 ? 164 : 178;
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

    const availableImages = [];
    history.forEach(task => {
      task.images?.forEach(image => {
        availableImages.push({ task, image });
      });
    });
    const availableImageIds = new Set(availableImages.map(item => item.image.id));

    commitNodes(previousNodes => {
      let changed = false;
      const reconciledNodes = previousNodes.filter(node => {
        const keep = node.type !== "history-image" || availableImageIds.has(node.imageId);
        changed ||= !keep;
        return keep;
      });
      const existingImageIds = new Set(
        reconciledNodes.filter(node => node.type === "history-image").map(node => node.imageId)
      );
      const additions = availableImages.filter(item => !existingImageIds.has(item.image.id));

      if (additions.length === 0) {
        return changed ? reconciledNodes : previousNodes;
      }

      changed = true;
      const baseSize = { width: 300, height: 260 };
      const visibleExisting = reconciledNodes.filter(node => !node.hidden);
      const baseX = visibleExisting.length
        ? Math.min(...visibleExisting.map(node => node.x))
        : 0;
      const baseY = visibleExisting.length
        ? Math.max(...visibleExisting.map(node => node.y + node.height)) + 72
        : 0;

      const newNodes = additions.map((item, index) => {
        const taskCanvas = item.task.canvasContext;
        const requestedSize = sizeFromAspectRatio(item.task.aspectRatio || "auto");
        const column = index % 4;
        const row = Math.floor(index / 4);
        const anchor = taskCanvas?.anchor;
        const anchorX = Number(anchor?.x);
        const anchorY = Number(anchor?.y);
        return {
          id: `history-${item.image.id}`,
          type: "history-image",
          taskId: item.task.id,
          imageId: item.image.id,
          parentIds: Array.isArray(taskCanvas?.parentIds) ? taskCanvas.parentIds : [],
          x: Number.isFinite(anchorX)
            ? anchorX + column * (requestedSize.width + 42)
            : baseX + column * (baseSize.width + 42),
          y: Number.isFinite(anchorY)
            ? anchorY + row * (requestedSize.height + 42)
            : baseY + row * (baseSize.height + 42),
          width: requestedSize.width,
          height: requestedSize.height,
          hidden: false,
          createdAt: item.task.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });
      const nextNodes = [...reconciledNodes, ...newNodes];

      if (active && !didInitialFitRef.current && nextNodes.some(node => !node.hidden)) {
        didInitialFitRef.current = true;
        window.requestAnimationFrame(() => fitToContent(nextNodes));
      }

      return nextNodes;
    });
  }, [history, historyLoading, hydrated, active]);

  const visibleNodes = useMemo(() => nodes.filter(node => !node.hidden), [nodes]);
  const selectedNodes = useMemo(
    () => visibleNodes.filter(node => selectedIds.includes(node.id)),
    [visibleNodes, selectedIds]
  );
  const referenceNodes = useMemo(
    () => selectedNodes.filter(node => node.type === "upload" || node.type === "history-image").filter(node => {
      const asset = getNodeAsset(node);
      return asset.status === "done" && Boolean(asset.blob);
    }).slice(0, MAX_REFERENCE_IMAGES),
    [selectedNodes, historyImageMap]
  );
  const branchDepthMap = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map(node => [node.id, node]));
    const depths = new Map();
    const findDepth = (node, visiting = new Set()) => {
      if (depths.has(node.id)) {
        return depths.get(node.id);
      }
      if (visiting.has(node.id)) {
        return 0;
      }
      const nextVisiting = new Set(visiting).add(node.id);
      const parentDepths = (node.parentIds || [])
        .map(parentId => nodeMap.get(parentId))
        .filter(Boolean)
        .map(parent => findDepth(parent, nextVisiting));
      const depth = parentDepths.length > 0 ? Math.max(...parentDepths) + 1 : 0;
      depths.set(node.id, depth);
      return depth;
    };
    visibleNodes.forEach(node => findDepth(node));
    return depths;
  }, [visibleNodes]);

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
    if (active && focusSignal) {
      window.requestAnimationFrame(() => promptRef.current?.focus());
    }
  }, [active, focusSignal]);

  useEffect(() => {
    if (!active) {
      setSpaceHeld(false);
      interactionRef.current = null;
      setInteractionType("");
      return undefined;
    }

    const handleKeyDown = event => {
      if (isTypingTarget(event.target)) {
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
      } else if (event.code === "Space") {
        event.preventDefault();
        setSpaceHeld(true);
      } else if (event.key.toLowerCase() === "v") {
        setTool("select");
      } else if (event.key.toLowerCase() === "h") {
        setTool("hand");
      } else if (event.key.toLowerCase() === "f" && selectedNodes.length > 0) {
        event.preventDefault();
        fitToContent(selectedNodes);
      } else if (event.key === "Escape") {
        setAddMenuOpen(false);
        setAssistantOpen(false);
        setSelectedIds([]);
      } else if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        addEmptyImageNode();
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        addTextNode();
      } else if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        uploadInputRef.current?.click();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeSelectedNodes();
      }
    };
    const handleKeyUp = event => {
      if (event.code === "Space") {
        setSpaceHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [active, undoStack.length, redoStack.length, selectedNodes]);

  async function addFiles(files, worldPoint) {
    const imageFiles = [...files].filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      onToast?.(text("uploadOnlyImages"));
      return;
    }

    const center = worldPoint || getWorldCenter();
    const additions = [];
    let failedCount = 0;
    for (let index = 0; index < imageFiles.length; index += 1) {
      try {
        const file = imageFiles[index];
        const dimensions = await readImageDimensions(file);
        const fitted = fitNodeSize(dimensions.width, dimensions.height);
        additions.push({
          id: createLocalId("upload"),
          type: "upload",
          name: file.name,
          mimeType: file.type || "image/png",
          assetBlob: file,
          url: URL.createObjectURL(file),
          x: center.x - fitted.width / 2 + index * 36,
          y: center.y - fitted.height / 2 + index * 36,
          width: fitted.width,
          height: fitted.height,
          parentIds: [],
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

    const nextNodes = [...nodesRef.current, ...additions];
    try {
      await saveCanvasSnapshot({
        nodes: nextNodes,
        viewport: viewportRef.current,
        settings: settingsRef.current
      });
    } catch (error) {
      additions.forEach(node => revokeRuntimeUrl(node.url));
      console.error(error);
      onToast?.(text("uploadFailed"));
      return;
    }
    recordUndoSnapshot();
    commitNodes(nextNodes);
    setSelectedIds(additions.map(node => node.id));
    didInitialFitRef.current = true;
    if (failedCount > 0) {
      onToast?.(text("uploadPartial"));
    }
  }

  function addEmptyImageNode() {
    const center = getWorldCenter();
    const node = {
      id: createLocalId("image-node"),
      type: "empty-image",
      x: center.x - 170,
      y: center.y - 130,
      width: 340,
      height: 260,
      parentIds: [],
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    recordUndoSnapshot();
    commitNodes(previous => [...previous, node]);
    setSelectedIds([node.id]);
    setAddMenuOpen(false);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  function addTextNode() {
    const center = getWorldCenter();
    const node = {
      id: createLocalId("text-node"),
      type: "text",
      title: text("textNodeTitle"),
      content: "",
      x: center.x - 150,
      y: center.y - 170,
      width: 300,
      height: 340,
      parentIds: [],
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    recordUndoSnapshot();
    commitNodes(previous => [...previous, node]);
    setSelectedIds([node.id]);
    setAddMenuOpen(false);
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

  async function shareCanvas() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onToast?.(text("shareDone"));
    } catch (error) {
      console.error(error);
      onToast?.(window.location.href);
    }
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
    await addFiles(event.dataTransfer.files || [], point);
  }

  function removeNodesByIds(nodeIds) {
    const targets = new Set(nodeIds);
    if (targets.size === 0) {
      return;
    }

    recordUndoSnapshot();
    commitNodes(previous => previous.flatMap(node => {
      if (!targets.has(node.id)) {
        return [node];
      }
      if (node.type !== "history-image") {
        revokeRuntimeUrl(node.url);
        return [];
      }
      return [{ ...node, hidden: true, updatedAt: new Date().toISOString() }];
    }));
    setSelectedIds([]);
    persistCurrentSnapshot().catch(console.error);
    onToast?.(text("hiddenHistory"));
  }

  function removeSelectedNodes() {
    removeNodesByIds(selectedIdsRef.current);
  }

  async function clearCanvas() {
    if (!window.confirm(text("clearConfirm"))) {
      return;
    }

    recordUndoSnapshot();
    nodesRef.current.forEach(node => {
      if (node.type === "upload") {
        revokeRuntimeUrl(node.url);
      }
    });
    const hiddenHistoryNodes = nodesRef.current
      .filter(node => node.type === "history-image")
      .map(node => ({ ...node, hidden: true, updatedAt: new Date().toISOString() }));
    const resetViewport = { x: 32, y: 32, zoom: 1 };
    commitNodes(hiddenHistoryNodes);
    setSelectedIds([]);
    commitViewport(resetViewport);
    await saveCanvasSnapshot({
      nodes: hiddenHistoryNodes,
      viewport: resetViewport,
      settings: settingsRef.current
    }).catch(console.error);
  }

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

  function downloadSelectedNodes() {
    downloadNodes(selectedNodes);
  }

  function prepareNodeContinuation(node) {
    const asset = getNodeAsset(node);
    const nextSelectedIds = [node.id];
    selectedIdsRef.current = nextSelectedIds;
    setSelectedIds(nextSelectedIds);
    if (asset.task?.aspectRatio && ratioOptions.includes(asset.task.aspectRatio)) {
      commitSetting("aspectRatio", asset.task.aspectRatio, setAspectRatio);
    }
    if (asset.task?.quality && ["low", "medium", "high"].includes(asset.task.quality)) {
      commitSetting("quality", asset.task.quality, setQuality);
    }
    onToast?.(text("branchReady"));
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  function compareNodeBranch(node) {
    const nodeMap = new Map(visibleNodes.map(item => [item.id, item]));
    const parentUrls = (node.parentIds || [])
      .map(parentId => nodeMap.get(parentId))
      .filter(Boolean)
      .map(parent => getNodeAsset(parent).url)
      .filter(Boolean);
    const currentUrl = getNodeAsset(node).url;
    if (!currentUrl) {
      return;
    }
    onPreview?.(currentUrl, [...new Set([...parentUrls, currentUrl])]);
  }

  function beginStageInteraction(event) {
    if (event.target.closest(".canvas-floating-ui")) {
      return;
    }
    setAddMenuOpen(false);
    if (event.target.closest(".canvas-node") && tool === "select" && !spaceHeld) {
      return;
    }
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    event.preventDefault();
    if (tool === "select" && !spaceHeld && event.button === 0) {
      setSelectedIds([]);
    }
    interactionRef.current = {
      type: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewport: viewportRef.current
    };
    setInteractionType("pan");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginNodeMove(event, node) {
    if (tool === "hand" || spaceHeld) {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
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

  function beginNodeResize(event, node) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([node.id]);
    interactionRef.current = {
      type: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      id: node.id,
      width: node.width,
      height: node.height,
      ratio: node.width / Math.max(1, node.height),
      beforeSnapshot: captureCanvasSnapshot(),
      hasChanged: false
    };
    setInteractionType("resize");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStagePointerMove(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    if (interaction.type === "pan") {
      commitViewport({
        ...interaction.viewport,
        x: interaction.viewport.x + event.clientX - interaction.startX,
        y: interaction.viewport.y + event.clientY - interaction.startY
      });
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
      const widthDelta = Math.abs(deltaX) > Math.abs(deltaY * interaction.ratio)
        ? deltaX
        : deltaY * interaction.ratio;
      const nextWidth = clamp(interaction.width + widthDelta, 120, 1200);
      const nextHeight = nextWidth / interaction.ratio;
      commitNodes(previous => previous.map(node => (
        node.id === interaction.id
          ? { ...node, width: nextWidth, height: nextHeight, updatedAt: new Date().toISOString() }
          : node
      )));
    }
  }

  function endStageInteraction(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }
    if (interaction.hasChanged && interaction.beforeSnapshot) {
      recordUndoSnapshot(interaction.beforeSnapshot);
    }
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
    const multiplier = event.deltaY > 0 ? 0.9 : 1.1;
    zoomAroundPoint(viewportRef.current.zoom * multiplier, event.clientX, event.clientY);
  }

  async function generateOnCanvas() {
    const nextPrompt = prompt.trim();
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    if (!nextPrompt) {
      onToast?.(text("promptRequired"));
      promptRef.current?.focus();
      return;
    }
    const imageReferenceCandidates = selectedNodes.filter(
      node => node.type === "upload" || node.type === "history-image"
    );
    if (imageReferenceCandidates.length > MAX_REFERENCE_IMAGES) {
      onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES }));
      return;
    }
    if (imageReferenceCandidates.length > 0 && referenceNodes.length !== imageReferenceCandidates.length) {
      onToast?.(text("missingReference"));
      return;
    }

    try {
      const selectedTextContext = selectedNodes
        .filter(node => node.type === "text" && node.content?.trim())
        .map(node => node.content.trim())
        .join("\n\n");
      const generationPrompt = selectedTextContext
        ? `${selectedTextContext}\n\n${nextPrompt}`
        : nextPrompt;
      const references = await Promise.all(referenceNodes.map(async node => {
        const asset = getNodeAsset(node);
        return {
          id: createLocalId("reference"),
          name: asset.name || `${node.id}.png`,
          type: asset.mimeType,
          dataUrl: await blobToDataUrl(asset.blob)
        };
      }));
      const generationCount = clamp(Number(count) || 1, 1, MAX_GENERATION_COUNT);
      const nodeSize = sizeFromAspectRatio(aspectRatio);
      const positions = createPlacementPositions(generationCount, nodeSize);
      const canvasContext = {
        projectId: "default",
        parentIds: selectedNodes.map(node => node.id),
        anchor: positions[0]
      };
      const task = onGenerate?.({
        prompt: generationPrompt,
        aspectRatio,
        quality,
        count: generationCount,
        referenceImages: references,
        canvasContext
      });

      if (!task) {
        onToast?.(text("taskFailed"));
        return;
      }

      const canvasNodes = task.images.map((image, index) => ({
        id: `history-${image.id}`,
        type: "history-image",
        taskId: task.id,
        imageId: image.id,
        parentIds: canvasContext.parentIds,
        x: positions[index].x,
        y: positions[index].y,
        width: nodeSize.width,
        height: nodeSize.height,
        hidden: false,
        createdAt: task.createdAt,
        updatedAt: task.createdAt
      }));
      recordUndoSnapshot();
      commitNodes(previous => [...previous, ...canvasNodes]);
      setSelectedIds(canvasNodes.map(node => node.id));
      commitSetting("prompt", "", setPrompt);
      persistCurrentSnapshot().catch(console.error);
      window.requestAnimationFrame(() => fitToContent([...selectedNodes, ...canvasNodes]));
    } catch (error) {
      console.error(error);
      onToast?.(error instanceof Error ? error.message : text("taskFailed"));
    }
  }

  const connectorPaths = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map(node => [node.id, node]));
    const selectedIdSet = new Set(selectedIds);
    return visibleNodes.flatMap(node => (node.parentIds || []).map(parentId => {
      const parent = nodeMap.get(parentId);
      if (!parent) {
        return null;
      }
      const startX = parent.x + parent.width;
      const startY = parent.y + parent.height / 2;
      const endX = node.x;
      const endY = node.y + node.height / 2;
      const bend = Math.max(48, Math.abs(endX - startX) * 0.45);
      return {
        id: `${parent.id}-${node.id}`,
        d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
        endX,
        endY,
        active: selectedIdSet.has(parent.id) || selectedIdSet.has(node.id)
      };
    }).filter(Boolean));
  }, [visibleNodes, selectedIds]);

  const stageClassName = [
    "canvas-stage",
    tool === "hand" || spaceHeld ? "is-hand-tool" : "is-select-tool",
    interactionType ? `is-${interactionType}` : "",
    draggingFiles ? "is-dragging-files" : ""
  ].filter(Boolean).join(" ");

  const primarySelectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const primarySelectedAsset = primarySelectedNode ? getNodeAsset(primarySelectedNode) : null;
  const primarySelectionIsVisual = Boolean(
    primarySelectedNode && primarySelectedNode.type !== "text"
  );
  const contextualToolbarStyle = primarySelectedNode
    ? {
        left: viewport.x + (primarySelectedNode.x + primarySelectedNode.width / 2) * viewport.zoom,
        top: Math.max(76, viewport.y + primarySelectedNode.y * viewport.zoom - 54)
      }
    : undefined;

  function applyQuickAction(action) {
    const prompts = {
      enhance: language === "en" ? "Enhance details and clarity while preserving the composition." : "提升画面清晰度与细节，保持原有构图。",
      panorama: language === "en" ? "Expand this into a cinematic panoramic composition." : "将画面扩展为更具电影感的全景构图。",
      relight: language === "en" ? "Relight the scene with more dimensional, cinematic lighting." : "重新设计光影，让画面更有层次与电影感。",
      upscale: language === "en" ? "Upscale and refine the visual with natural detail." : "智能放大并补充自然、精细的画面细节。",
      crop: language === "en" ? "Recompose the subject with a stronger crop and visual focus." : "重新裁切构图，强化主体与视觉焦点。",
      annotate: language === "en" ? "Apply the following directed changes: " : "按照以下标注修改画面："
    };
    commitSetting("prompt", prompts[action] || "", setPrompt);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  return (
    <section className={`canvas-workspace wuli-canvas${active ? " is-active" : " mode-hidden"}${assistantOpen ? " is-assistant-open" : ""}`} aria-label={text("title")}>
      <header className="wuli-canvas-header canvas-floating-ui">
        <div className="wuli-project-switcher">
          <button className="wuli-home-button" type="button" onClick={onExit} title={text("exitClassic")}>
            <span><Sparkles /></span>
          </button>
          <button className="wuli-project-title" type="button" onClick={() => fitToContent()}>
            <strong>{text("projectTitle")}</strong>
            <small>{saving ? text("saving") : text("saved")}</small>
            <ChevronDown />
          </button>
        </div>
        <div className="wuli-header-actions">
          <button className="wuli-credit-pill" type="button">
            <Sparkles />
            <span>{currentUser?.credits ?? 0}</span>
          </button>
          <button className="wuli-share-button" type="button" onClick={shareCanvas} title={text("share")}>
            <Link2 />
          </button>
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
        onPointerMove={handleStagePointerMove}
        onPointerUp={endStageInteraction}
        onPointerCancel={endStageInteraction}
        onWheel={handleWheel}
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
          ref={uploadInputRef}
          className="canvas-hidden-upload"
          type="file"
          accept="image/*"
          multiple
          onChange={async event => {
            await addFiles(event.target.files || []);
            event.target.value = "";
          }}
        />

        <div
          className="canvas-plane"
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`
          }}
        >
          <svg className="canvas-connectors" aria-hidden="true">
            {connectorPaths.map(path => (
              <g key={path.id} className={path.active ? "is-active" : ""}>
                <path d={path.d} />
                <circle cx={path.endX} cy={path.endY} r="5" />
              </g>
            ))}
          </svg>

          {visibleNodes.map((node, nodeIndex) => {
            const asset = getNodeAsset(node);
            const selected = selectedIds.includes(node.id);
            const referenceIndex = referenceNodes.findIndex(item => item.id === node.id);
            const branchDepth = branchDepthMap.get(node.id) || 0;
            const hasParents = (node.parentIds || []).some(parentId => visibleNodes.some(item => item.id === parentId));
            const nodeUiScale = clamp(1 / viewport.zoom, 1, 2.4);
            const isTextNode = node.type === "text";
            const isEmptyImageNode = node.type === "empty-image";
            const statusLabel = asset.status === "streaming"
              ? text("receiving")
              : asset.status === "error"
                ? text("failed")
                : text("generating");
            return (
              <article
                key={node.id}
                className={`canvas-node${selected ? " is-selected" : ""}${asset.status === "error" ? " is-error" : ""}${isTextNode ? " is-text-node" : ""}${isEmptyImageNode ? " is-empty-image-node" : ""}`}
                style={{
                  width: node.width,
                  height: node.height,
                  transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                  zIndex: selected ? 100 + nodeIndex : nodeIndex + 2,
                  "--canvas-node-ui-scale": nodeUiScale
                }}
                title={asset.url ? text("preview") : statusLabel}
                onPointerDown={event => beginNodeMove(event, node)}
                onDoubleClick={() => {
                  if (isTextNode) {
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
                  {isTextNode ? <Type /> : <Image />}
                  <span>{isTextNode ? (node.title || text("textNodeTitle")) : (node.name || asset.task?.prompt || text("emptyImageTitle"))}</span>
                </div>
                {isTextNode ? (
                  <textarea
                    value={node.content || ""}
                    placeholder={text("textNodePlaceholder")}
                    onPointerDown={event => {
                      event.stopPropagation();
                      setSelectedIds([node.id]);
                    }}
                    onFocus={() => {
                      textEditSnapshotRef.current ||= captureCanvasSnapshot();
                    }}
                    onChange={event => updateTextNode(node.id, event.target.value)}
                    onBlur={finishTextEdit}
                  />
                ) : asset.url ? (
                  <img src={asset.url} alt={asset.name || text("localAsset")} draggable="false" />
                ) : isEmptyImageNode ? (
                  <div className="canvas-empty-image">
                    <ImagePlus />
                    <strong>{text("emptyImageTitle")}</strong>
                    <span>{text("emptyImageCopy")}</span>
                  </div>
                ) : (
                  <div className={`canvas-node-placeholder is-${asset.status}`}>
                    {asset.status === "error" ? <X /> : <LoaderCircle className="is-spinning" />}
                    <strong>{statusLabel}</strong>
                    {asset.error ? <span>{asset.error}</span> : null}
                  </div>
                )}
                {!isTextNode && !isEmptyImageNode ? (
                  <div className="canvas-node-version">
                    <GitBranch />
                    <span>{branchDepth === 0 ? text("rootNode") : text("versionLabel", { count: branchDepth })}</span>
                  </div>
                ) : null}
                {referenceIndex >= 0 ? <b className="canvas-reference-index">{referenceIndex + 1}</b> : null}
                {selected && selectedIds.length === 1 ? (
                  <button
                    className="canvas-resize-handle"
                    type="button"
                    aria-label={language === "en" ? "Resize image" : "缩放图片"}
                    onPointerDown={event => beginNodeResize(event, node)}
                  />
                ) : null}
              </article>
            );
          })}
        </div>

        {primarySelectedNode && !assistantOpen ? (
          <div className="canvas-context-toolbar canvas-floating-ui" style={contextualToolbarStyle}>
            {primarySelectionIsVisual ? (
              <>
                <button type="button" onClick={() => applyQuickAction("enhance")}><Maximize2 /><span>{text("enhance")}</span></button>
                <button type="button" onClick={() => applyQuickAction("panorama")}><Grid3X3 /><span>{text("panorama")}</span></button>
                <button type="button" onClick={() => applyQuickAction("relight")}><Sparkles /><span>{text("relight")}</span></button>
                <button type="button" onClick={() => applyQuickAction("upscale")}><ImagePlus /><span>{text("upscale")}</span></button>
                <button type="button" onClick={() => applyQuickAction("crop")}><Focus /><span>{text("crop")}</span></button>
                <button type="button" onClick={() => applyQuickAction("annotate")}><MousePointer2 /><span>{text("annotate")}</span></button>
                <i />
              </>
            ) : null}
            {primarySelectedNode.type !== "empty-image" ? (
              <button type="button" title={text("continueFromNode")} onClick={() => prepareNodeContinuation(primarySelectedNode)}><Sparkles /></button>
            ) : null}
            {primarySelectedNode.type === "history-image" && (primarySelectedNode.parentIds || []).length > 0 ? (
              <button type="button" title={text("compareBranch")} onClick={() => compareNodeBranch(primarySelectedNode)}><GitBranch /></button>
            ) : null}
            <button type="button" title={text("focusSelected")} onClick={() => fitToContent([primarySelectedNode])}><Focus /></button>
            <button
              type="button"
              title={text("download")}
              onClick={() => downloadNodes([primarySelectedNode])}
              disabled={!primarySelectedAsset?.url || primarySelectedAsset?.status !== "done"}
            ><Download /></button>
            <button type="button" title={text("delete")} onClick={() => removeNodesByIds([primarySelectedNode.id])}><Trash2 /></button>
            <button type="button" title="More"><MoreHorizontal /></button>
          </div>
        ) : null}

        {!hydrated ? (
          <div className="canvas-loading canvas-floating-ui">
            <LoaderCircle className="is-spinning" />
            <span>{text("loading")}</span>
          </div>
        ) : null}

        {hydrated && visibleNodes.length === 0 && !assistantOpen ? (
          <div className="canvas-empty canvas-floating-ui">
            <span><ImagePlus /></span>
            <h2>{text("emptyTitle")}</h2>
            <p>{text("emptyCopy")}</p>
            <Button type="button" variant="secondary" onClick={() => uploadInputRef.current?.click()}>
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

        <div className="wuli-canvas-toolbar canvas-floating-ui">
          {addMenuOpen ? (
            <div className="wuli-add-menu is-open">
              <button type="button" onClick={addEmptyImageNode}><Image /><span>{text("addImageNode")}</span><kbd>I</kbd></button>
              <button type="button" onClick={addTextNode}><Type /><span>{text("addTextNode")}</span><kbd>T</kbd></button>
              <button type="button" onClick={() => {
                setAddMenuOpen(false);
                uploadInputRef.current?.click();
              }}><Upload /><span>{text("upload")}</span><kbd>U</kbd></button>
            </div>
          ) : null}
          <button className={addMenuOpen ? "active" : ""} type="button" onClick={() => setAddMenuOpen(value => !value)} title={text("addImageNode")}><Plus /></button>
          <button type="button" onClick={undoCanvasChange} disabled={undoStack.length === 0} title={text("undo")}><RotateCcw /></button>
          <button className={tool === "select" ? "active light" : ""} type="button" onClick={() => setTool("select")} title={`${text("select")} (V)`}><MousePointer2 /></button>
          <button type="button" onClick={undoCanvasChange} disabled={undoStack.length === 0} title={text("undo")}><Undo2 /></button>
          <button type="button" onClick={redoCanvasChange} disabled={redoStack.length === 0} title={text("redo")}><Redo2 /></button>
        </div>

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
          <button type="button" title="Link"><Link2 /></button>
          <button type="button" title="Grid"><Grid3X3 /></button>
          <button type="button" onClick={() => fitToContent()} title={text("fit")}><MapPin /></button>
        </div>

        <button className="wuli-agent-trigger canvas-floating-ui" type="button" onClick={() => setAssistantOpen(true)} title={text("openAgent")}>
          <MessageCircle />
          <Sparkles />
        </button>

        <aside
          className={`wuli-agent-drawer canvas-floating-ui${assistantOpen ? " is-open" : ""}`}
          aria-hidden={!assistantOpen}
          inert={!assistantOpen}
        >
          <div className="wuli-agent-head">
            <div><span><Bot /></span><strong>{text("projectTitle")}</strong><ChevronDown /></div>
            <nav>
              <button type="button" title={text("historyChat")}><RotateCcw /></button>
              <button type="button" title={text("newChat")}><CirclePlus /></button>
              <button type="button" title={text("closeAgent")} onClick={() => setAssistantOpen(false)}><X /></button>
            </nav>
          </div>
          <div className="wuli-agent-empty">
            <span><Sparkles /></span>
            <p>{text("agentGreeting")}</p>
          </div>
          <form className="wuli-agent-composer" onSubmit={event => {
            event.preventDefault();
            generateOnCanvas();
          }}>
            <textarea
              ref={promptRef}
              value={prompt}
              placeholder={text("prompt")}
              onChange={event => commitSetting("prompt", event.target.value, setPrompt)}
              onKeyDown={event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  generateOnCanvas();
                }
              }}
            />
            <div>
              <button type="button" onClick={() => uploadInputRef.current?.click()}><Plus /></button>
              <button className="wuli-mode-pill" type="button"><Link2 />{text("defaultMode")}<ChevronDown /></button>
              <button className="wuli-agent-send" type="submit"><Send /></button>
            </div>
          </form>
        </aside>

        {selectedNodes.length > 0 && !assistantOpen ? (
          <form className="canvas-composer wuli-context-composer canvas-floating-ui" onSubmit={event => {
            event.preventDefault();
            generateOnCanvas();
          }}>
            <div className="wuli-reference-strip">
              <button type="button" onClick={() => uploadInputRef.current?.click()} title={text("addReference")}><Plus /></button>
              {selectedNodes.slice(0, MAX_REFERENCE_IMAGES).map(node => {
                const asset = getNodeAsset(node);
                return (
                  <button className="wuli-reference-card" key={node.id} type="button" title={text("removeReference")} onClick={() => setSelectedIds(previous => previous.filter(id => id !== node.id))}>
                    {node.type === "text" ? <Type /> : asset.url ? <img src={asset.url} alt="" /> : <Image />}
                    <span>{node.type === "text" ? (node.content || text("textNodeTitle")) : (asset.name || text("emptyImageTitle"))}</span>
                    <X />
                  </button>
                );
              })}
            </div>
            <textarea
              ref={promptRef}
              value={prompt}
              placeholder={text("prompt")}
              onChange={event => commitSetting("prompt", event.target.value, setPrompt)}
              onKeyDown={event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  generateOnCanvas();
                }
              }}
            />
            <div className="wuli-context-controls">
              <button className="wuli-model-pill" type="button"><Sparkles />{text("imageModel")}<ChevronDown /></button>
              <label>
                <select value={aspectRatio} onChange={event => commitSetting("aspectRatio", event.target.value, setAspectRatio)}>
                  {ratioOptions.map(value => <option key={value} value={value}>{value === "auto" ? (language === "en" ? "Auto" : "智能") : value}</option>)}
                </select>
              </label>
              <label>
                <select value={quality} onChange={event => commitSetting("quality", event.target.value, setQuality)}>
                  <option value="low">{language === "en" ? "Low" : "低"}</option>
                  <option value="medium">{language === "en" ? "Medium" : "中"}</option>
                  <option value="high">{language === "en" ? "High" : "高"}</option>
                </select>
              </label>
              <label>
                <input
                  type="number"
                  min="1"
                  max={MAX_GENERATION_COUNT}
                  value={count}
                  onChange={event => commitSetting("count", clamp(Number(event.target.value) || 1, 1, MAX_GENERATION_COUNT), setCount)}
                />
              </label>
              <Button className="wuli-generate-cost" type="submit">
                <Sparkles />
                <span>{currentUser ? count : text("loginGenerate")}</span>
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  );
}

export default CanvasWorkspace;
