import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  ChevronDown,
  CirclePlus,
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
  LocateFixed,
  MapPin,
  Maximize2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MousePointer2,
  PanelLeftClose,
  Paintbrush,
  Plus,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Type,
  Unlink,
  Undo2,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AnnotationEditor from "@/components/canvas/AnnotationEditor";
import { loadCanvasSnapshot, saveCanvasSnapshot } from "@/lib/canvas-db";

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 4;
const MAX_REFERENCE_IMAGES = 8;
const MAX_GENERATION_COUNT = 8;
const SAVE_DEBOUNCE_MS = 500;
const MAX_UNDO_STEPS = 40;
const MENTION_PATTERN = /@\[[^\]]+\]\(canvas:([^)]+)\)/g;
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CONNECTION_HANDLE_OFFSET = 26;
const CONNECTION_SNAP_RADIUS_PX = 34;

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
    promptRequired: "请输入提示词或引用一个有内容的文本节点。",
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
    exitClassic: "返回画布项目",
    projectTitle: "Image2 创意画布",
    share: "复制画布链接",
    shareDone: "画布链接已复制",
    addImageNode: "添加图像节点",
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
    openAgent: "打开 AI 创作助手",
    closeAgent: "关闭",
    agentGreeting: "hi~ 今天想创作点什么？",
    newChat: "新对话",
    historyChat: "历史对话",
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
    imageModel: "Image2",
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
    addImageNode: "Add image node",
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
    openAgent: "Open AI creator",
    closeAgent: "Close",
    agentGreeting: "Hi~ What would you like to create today?",
    newChat: "New chat",
    historyChat: "History",
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
    imageModel: "Image2",
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

function hydrateReferenceAssets(referenceAssets) {
  if (!Array.isArray(referenceAssets)) {
    return [];
  }
  return referenceAssets.flatMap(reference => (
    reference?.blob
      ? [{
          ...reference,
          url: URL.createObjectURL(reference.blob)
        }]
      : []
  ));
}

function revokeReferenceAssetUrls(referenceAssets) {
  (referenceAssets || []).forEach(reference => revokeRuntimeUrl(reference.url));
}

function cloneReferenceAssets(referenceAssets) {
  return (referenceAssets || []).flatMap(reference => (
    reference?.blob
      ? [{
          ...reference,
          id: createLocalId("reference"),
          url: URL.createObjectURL(reference.blob),
          createdAt: new Date().toISOString()
        }]
      : []
  ));
}

function revokeNodeRuntimeUrls(node) {
  if (node.type === "upload") {
    revokeRuntimeUrl(node.url);
  }
  revokeRuntimeUrl(node.annotationUrl);
  revokeReferenceAssetUrls(node.referenceAssets);
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
  const [editingTextNodeId, setEditingTextNodeId] = useState("");
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
  const [contextMenu, setContextMenu] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
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
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false);
  const [referencePicker, setReferencePicker] = useState(null);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historyDragPreview, setHistoryDragPreview] = useState(null);
  const [pointerContextMenu, setPointerContextMenu] = useState(null);
  const [projectTitle, setProjectTitle] = useState(text("projectTitle"));

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
  const settingsRef = useRef({ prompt, aspectRatio, quality, count });
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

  function commitSetting(key, value, setter) {
    settingsRef.current = { ...settingsRef.current, [key]: value };
    setter(value);
  }

  function persistCurrentSnapshot() {
    if (!hydrated) {
      return Promise.resolve();
    }
    return saveCanvasSnapshot({
      canvasId,
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

    loadCanvasSnapshot(canvasId)
      .then(snapshot => {
        if (cancelled) {
          return;
        }

        setProjectTitle(snapshot.project?.title || text("projectTitle"));
        const restoredNodes = snapshot.nodes.map(node => ({
          ...node,
          status: node.type === "upload" ? "done" : node.status,
          url: node.type === "upload" && node.assetBlob ? URL.createObjectURL(node.assetBlob) : "",
          annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : "",
          referenceAssets: hydrateReferenceAssets(node.referenceAssets)
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
        settings: { prompt, aspectRatio, quality, count }
      })
        .catch(error => {
          console.error(error);
          onToast?.(language === "en" ? "Canvas changes could not be saved." : "画布更改未能保存。");
        })
        .finally(() => setSaving(false));
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [canvasId, nodes, viewport, prompt, aspectRatio, quality, count, hydrated]);

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
        settings: settingsRef.current
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
        url: node.annotationUrl || node.url,
        blob: node.annotationBlob || node.assetBlob,
        mimeType: node.annotationBlob?.type || node.mimeType || node.assetBlob?.type || "image/png",
        name: node.name || text("localAsset"),
        status: "done",
        error: ""
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

    nodesRef.current.forEach(revokeNodeRuntimeUrls);

    const availableHistoryIds = new Set(historyImageMap.keys());
    const restoredNodes = snapshot.nodes.flatMap(node => {
      if (node.type === "history-image" && !availableHistoryIds.has(node.imageId)) {
        return [];
      }
      if (node.type === "upload") {
        if (!node.assetBlob) {
          return [];
        }
        return [{
          ...node,
          url: URL.createObjectURL(node.assetBlob),
          annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : "",
          referenceAssets: hydrateReferenceAssets(node.referenceAssets)
        }];
      }
      return [{
        ...node,
        annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : "",
        referenceAssets: hydrateReferenceAssets(node.referenceAssets)
      }];
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
    const replacedNodeIds = new Set(
      availableImages
        .map(item => item.task.canvasContext?.replacedNodeId)
        .filter(Boolean)
    );

    commitNodes(previousNodes => {
      let changed = false;
      const reconciledNodes = previousNodes.filter(node => {
        const keep = !replacedNodeIds.has(node.id)
          && (node.type !== "history-image" || availableImageIds.has(node.imageId));
        changed ||= !keep;
        return keep;
      });
      const existingImageIds = new Set(
        reconciledNodes.filter(node => node.type === "history-image").map(node => node.imageId)
      );
      const additions = availableImages.filter(item => (
        item.task.canvasContext && !existingImageIds.has(item.image.id)
      ));

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
  const mentionedNodeIds = useMemo(() => {
    const ids = [];
    for (const match of prompt.matchAll(MENTION_PATTERN)) {
      if (!ids.includes(match[1])) ids.push(match[1]);
    }
    return ids;
  }, [prompt]);
  const generationNodes = useMemo(() => {
    const ids = new Set([...selectedIds, ...mentionedNodeIds]);
    return visibleNodes.filter(node => ids.has(node.id));
  }, [visibleNodes, selectedIds, mentionedNodeIds]);
  const generationInputNodes = useMemo(() => {
    const nodeMap = new Map(visibleNodes.map(node => [node.id, node]));
    const resolved = [];
    const resolvedIds = new Set();
    const appendNode = node => {
      if (!node || resolvedIds.has(node.id)) return;
      resolvedIds.add(node.id);
      resolved.push(node);
    };

    generationNodes.forEach(node => {
      const explicitlyMentioned = mentionedNodeIds.includes(node.id);
      const selectedImageOutput = selectedIds.includes(node.id)
        && (node.type === "upload" || node.type === "history-image");
      if (node.type !== "empty-image" && (!selectedImageOutput || explicitlyMentioned)) {
        appendNode(node);
      }
      const linkedReferenceIds = [
        ...(node.parentIds || []),
        ...(node.referenceNodeIds || [])
      ];
      linkedReferenceIds.forEach(referenceId => appendNode(nodeMap.get(referenceId)));
    });
    return resolved;
  }, [visibleNodes, generationNodes, selectedIds, mentionedNodeIds]);
  const referenceNodes = useMemo(
    () => generationInputNodes.filter(node => node.type === "upload" || node.type === "history-image").filter(node => {
      const asset = getNodeAsset(node);
      return asset.status === "done" && Boolean(asset.blob);
    }).slice(0, MAX_REFERENCE_IMAGES),
    [generationInputNodes, historyImageMap]
  );
  const directReferenceAssets = useMemo(() => {
    const seenIds = new Set();
    return generationNodes.flatMap(node => (node.referenceAssets || []).flatMap(reference => {
      if (!reference?.blob || seenIds.has(reference.id)) {
        return [];
      }
      seenIds.add(reference.id);
      return [{
        ...reference,
        ownerNodeId: node.id
      }];
    }));
  }, [generationNodes]);
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
    if (active && focusSignal) {
      window.requestAnimationFrame(() => promptRef.current?.focus());
    }
  }, [active, focusSignal]);

  useEffect(() => {
    if (!active) {
      setSpaceHeld(false);
      interactionRef.current = null;
      window.clearTimeout(wheelEndTimerRef.current);
      setInteractionType("");
      setReferenceMenuOpen(false);
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
          setReferenceMenuOpen(false);
          return;
        }
        setAddMenuOpen(false);
        setContextMenu(null);
        setAssistantOpen(false);
        setNodeMoreOpen(false);
        setHelpOpen(false);
        setMentionMenuOpen(false);
        clearPendingConnection();
        setReferenceMenuOpen(false);
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

    const center = connectionContext?.point || worldPoint || getWorldCenter();
    const additions = [];
    let failedCount = 0;
    for (let index = 0; index < imageFiles.length; index += 1) {
      try {
        const file = imageFiles[index];
        const dimensions = await readImageDimensions(file);
        const fitted = fitNodeSize(dimensions.width, dimensions.height);
        const cascadeOffset = index * 36;
        const connectedFromRight = connectionContext?.startHandleType === "source";
        additions.push({
          id: createLocalId("upload"),
          type: "upload",
          name: file.name,
          mimeType: file.type || "image/png",
          assetBlob: file,
          url: URL.createObjectURL(file),
          x: connectionContext
            ? connectedFromRight
              ? center.x + CONNECTION_HANDLE_OFFSET + cascadeOffset
              : center.x - fitted.width - CONNECTION_HANDLE_OFFSET - cascadeOffset
            : center.x - fitted.width / 2 + cascadeOffset,
          y: center.y - fitted.height / 2 + cascadeOffset,
          width: fitted.width,
          height: fitted.height,
          parentIds: connectedFromRight ? [connectionContext.originNodeId] : [],
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

    const incomingIds = connectionContext?.startHandleType === "target"
      ? additions.map(node => node.id)
      : [];
    const nextNodes = [
      ...nodesRef.current.map(node => (
        node.id === connectionContext?.originNodeId && incomingIds.length > 0
          ? {
              ...node,
              parentIds: [...new Set([...(node.parentIds || []), ...incomingIds])],
              updatedAt: new Date().toISOString()
            }
          : node
      )),
      ...additions
    ];
    try {
      await saveCanvasSnapshot({
        canvasId,
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

  function getReferenceTarget() {
    const selected = nodesRef.current.filter(node => (
      selectedIdsRef.current.includes(node.id) && !node.hidden
    ));
    return selected.length === 1 ? selected[0] : null;
  }

  function getTargetImageReferenceCount(targetNode) {
    if (!targetNode) {
      return 0;
    }
    const nodeMap = new Map(nodesRef.current.map(node => [node.id, node]));
    const linkedIds = [
      ...(targetNode.parentIds || []),
      ...(targetNode.referenceNodeIds || [])
    ];
    const linkedImageCount = new Set(linkedIds).size === 0
      ? 0
      : [...new Set(linkedIds)].filter(id => {
          const node = nodeMap.get(id);
          return node?.type === "upload" || node?.type === "history-image";
        }).length;
    return linkedImageCount + (targetNode.referenceAssets || []).length;
  }

  function toggleReferenceMenu() {
    if (!getReferenceTarget()) {
      onToast?.(text("selectSingleReferenceTarget"));
      return;
    }
    setReferenceMenuOpen(value => !value);
  }

  function requestReferenceUpload(targetNodeId) {
    const target = nodesRef.current.find(node => node.id === targetNodeId && !node.hidden);
    if (!target) {
      onToast?.(text("selectSingleReferenceTarget"));
      return;
    }
    referenceUploadTargetRef.current = target.id;
    setReferenceMenuOpen(false);
    referenceUploadInputRef.current?.click();
  }

  async function addReferenceFiles(files, targetNodeId) {
    const imageFiles = [...files].filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      onToast?.(text("uploadOnlyImages"));
      return;
    }

    const target = nodesRef.current.find(node => node.id === targetNodeId && !node.hidden);
    if (!target) {
      onToast?.(text("selectSingleReferenceTarget"));
      return;
    }
    const availableSlots = Math.max(0, MAX_REFERENCE_IMAGES - getTargetImageReferenceCount(target));
    if (availableSlots === 0) {
      onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES }));
      return;
    }

    const additions = [];
    let failedCount = 0;
    for (const file of imageFiles.slice(0, availableSlots)) {
      try {
        await readImageDimensions(file);
        additions.push({
          id: createLocalId("reference"),
          name: file.name,
          mimeType: file.type || "image/png",
          blob: file,
          url: URL.createObjectURL(file),
          createdAt: new Date().toISOString()
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
    commitNodes(previous => previous.map(node => (
      node.id === target.id
        ? {
            ...node,
            referenceAssets: [...(node.referenceAssets || []), ...additions],
            updatedAt: new Date().toISOString()
          }
        : node
    )));
    setSelectedIds([target.id]);
    persistCurrentSnapshot().catch(console.error);
    if (imageFiles.length > availableSlots) {
      onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES }));
    } else if (failedCount > 0) {
      onToast?.(text("uploadPartial"));
    } else {
      onToast?.(text("referenceAdded", { count: additions.length }));
    }
  }

  function startCanvasReferencePicker() {
    const target = getReferenceTarget();
    if (!target) {
      onToast?.(text("selectSingleReferenceTarget"));
      return;
    }
    setReferenceMenuOpen(false);
    setSelectedEdgeId("");
    setReferencePicker({ targetNodeId: target.id });
  }

  function finishCanvasReferencePicker(referenceNodeId) {
    const targetNodeId = referencePicker?.targetNodeId;
    const target = nodesRef.current.find(node => node.id === targetNodeId && !node.hidden);
    const reference = nodesRef.current.find(node => node.id === referenceNodeId && !node.hidden);
    if (!target || !reference) {
      setReferencePicker(null);
      return;
    }
    if (target.id === reference.id) {
      onToast?.(text("invalidReferenceTarget"));
      return;
    }
    if (!["upload", "history-image", "text"].includes(reference.type)) {
      onToast?.(text("invalidReferenceSource"));
      return;
    }
    if (wouldCreateCycle(reference.id, target.id)) {
      onToast?.(language === "en" ? "This connection would create a loop." : "不能创建循环连线。");
      return;
    }

    const referenceKey = target.type === "empty-image" ? "parentIds" : "referenceNodeIds";
    if ((target[referenceKey] || []).includes(reference.id)) {
      setSelectedIds([target.id]);
      setReferencePicker(null);
      return;
    }
    if (
      reference.type !== "text"
      && getTargetImageReferenceCount(target) >= MAX_REFERENCE_IMAGES
    ) {
      onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES }));
      return;
    }
    recordUndoSnapshot();
    commitNodes(previous => previous.map(node => (
      node.id === target.id
        ? {
            ...node,
            [referenceKey]: [...(node[referenceKey] || []), reference.id],
            updatedAt: new Date().toISOString()
          }
        : node
    )));
    setSelectedIds([target.id]);
    setSelectedEdgeId("");
    setReferencePicker(null);
    persistCurrentSnapshot().catch(console.error);
  }

  function addEmptyImageNode(worldPoint) {
    const center = worldPoint || getWorldCenter();
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
    setContextMenu(null);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  function addTextNode(worldPoint) {
    const center = worldPoint || getWorldCenter();
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
    setContextMenu(null);
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

    const isTextNode = type === "text";
    const width = isTextNode ? 300 : 340;
    const height = isTextNode ? 340 : 260;
    const connectedFromRight = context.startHandleType === "source";
    const node = {
      id: createLocalId(isTextNode ? "text-node" : "image-node"),
      type: isTextNode ? "text" : "empty-image",
      ...(isTextNode
        ? { title: text("textNodeTitle"), content: "" }
        : {}),
      x: connectedFromRight
        ? context.point.x + CONNECTION_HANDLE_OFFSET
        : context.point.x - width - CONNECTION_HANDLE_OFFSET,
      y: context.point.y - height / 2,
      width,
      height,
      parentIds: connectedFromRight ? [origin.id] : [],
      hidden: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    recordUndoSnapshot();
    commitNodes(previous => [
      ...previous.map(item => (
        !connectedFromRight && item.id === origin.id
          ? {
              ...item,
              parentIds: [...new Set([...(item.parentIds || []), node.id])],
              updatedAt: new Date().toISOString()
            }
          : item
      )),
      node
    ]);
    setSelectedIds([node.id]);
    setSelectedEdgeId(edgeId(
      connectedFromRight ? origin.id : node.id,
      connectedFromRight ? node.id : origin.id
    ));
    clearPendingConnection();
    persistCurrentSnapshot().catch(console.error);
    if (!isTextNode) {
      window.requestAnimationFrame(() => promptRef.current?.focus());
    }
  }

  function openConnectionUpload() {
    if (!connectionMenu) return;
    pendingConnectionUploadRef.current = connectionMenu;
    connectionUploadInputRef.current?.click();
  }

  function copySelectedNodes() {
    const selection = nodesRef.current.filter(node => selectedIdsRef.current.includes(node.id));
    clipboardRef.current = selection.map(node => ({ ...node }));
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
    const additions = clipboardRef.current.map(node => {
      const nextId = idMap.get(node.id);
      return {
        ...node,
        id: nextId,
        x: node.x + translateX,
        y: node.y + translateY,
        parentIds: (node.parentIds || []).map(id => idMap.get(id) || id),
        referenceNodeIds: (node.referenceNodeIds || []).map(id => idMap.get(id) || id),
        referenceAssets: cloneReferenceAssets(node.referenceAssets),
        hidden: false,
        url: node.type === "upload" && node.assetBlob ? URL.createObjectURL(node.assetBlob) : "",
        annotationUrl: node.annotationBlob ? URL.createObjectURL(node.annotationBlob) : "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
    recordUndoSnapshot();
    commitNodes(previous => [...previous, ...additions]);
    setSelectedIds(additions.map(node => node.id));
    clipboardRef.current = additions.map(node => ({ ...node }));
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
    if (!parentId || !childId) return;
    const child = nodesRef.current.find(node => node.id === childId);
    if (!child?.parentIds?.includes(parentId)) return;
    recordUndoSnapshot();
    commitNodes(previous => previous.map(node => (
      node.id === childId
        ? { ...node, parentIds: node.parentIds.filter(value => value !== parentId), updatedAt: new Date().toISOString() }
        : node
    )));
    setSelectedEdgeId("");
  }

  function wouldCreateCycle(parentId, childId) {
    if (parentId === childId) return true;
    const nodeMap = new Map(nodesRef.current.map(node => [node.id, node]));
    const visited = new Set();
    const visit = id => {
      if (id === childId) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      const node = nodeMap.get(id);
      return (node?.parentIds || []).some(visit);
    };
    return visit(parentId);
  }

  function connectNodes(parentId, childId) {
    if (!parentId || !childId || wouldCreateCycle(parentId, childId)) {
      onToast?.(language === "en" ? "This connection would create a loop." : "不能创建循环连线。");
      return;
    }
    const child = nodesRef.current.find(node => node.id === childId);
    if (!child || child.parentIds?.includes(parentId)) return;
    recordUndoSnapshot();
    commitNodes(previous => previous.map(node => (
      node.id === childId
        ? { ...node, parentIds: [...(node.parentIds || []), parentId], updatedAt: new Date().toISOString() }
        : node
    )));
    setSelectedEdgeId(edgeId(parentId, childId));
  }

  function nodeDisplayName(node) {
    if (node.type === "text") {
      return (node.title || node.content || text("textNodeTitle")).trim().slice(0, 24);
    }
    return (node.name || getNodeAsset(node).name || text("emptyImageTitle")).trim().slice(0, 24);
  }

  function insertMention(node) {
    const token = `@[${nodeDisplayName(node)}](canvas:${node.id})`;
    const nextPrompt = `${prompt.replace(/@\s*$/, "").trimEnd()}${prompt.trim() ? " " : ""}${token} `;
    commitSetting("prompt", nextPrompt, setPrompt);
    setMentionMenuOpen(false);
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  function handlePromptChange(value) {
    commitSetting("prompt", value, setPrompt);
    setMentionMenuOpen(/@[^@\n]*$/.test(value));
  }

  function stripMentionTokens(value) {
    return value.replace(MENTION_PATTERN, "").replace(/\s{2,}/g, " ").trim();
  }

  function removeGenerationReference(nodeId) {
    if (mentionedNodeIds.includes(nodeId)) {
      const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      handlePromptChange(prompt.replace(new RegExp(`@\\[[^\\]]+\\]\\(canvas:${escaped}\\)\\s*`, "g"), ""));
    }
    setSelectedIds(previous => previous.filter(id => id !== nodeId));
    const inheritedChildren = generationNodes.filter(node => (
      (node.parentIds || []).includes(nodeId)
    ));
    const linkedReferenceOwners = generationNodes.filter(node => (
      (node.referenceNodeIds || []).includes(nodeId)
    ));
    if (inheritedChildren.length > 0 || linkedReferenceOwners.length > 0) {
      const childIds = new Set(inheritedChildren.map(node => node.id));
      const ownerIds = new Set(linkedReferenceOwners.map(node => node.id));
      recordUndoSnapshot();
      commitNodes(previous => previous.map(node => (
        childIds.has(node.id) || ownerIds.has(node.id)
          ? {
              ...node,
              ...(childIds.has(node.id)
                ? { parentIds: (node.parentIds || []).filter(parentId => parentId !== nodeId) }
                : {}),
              ...(ownerIds.has(node.id)
                ? { referenceNodeIds: (node.referenceNodeIds || []).filter(referenceId => referenceId !== nodeId) }
                : {}),
              updatedAt: new Date().toISOString()
            }
          : node
      )));
      persistCurrentSnapshot().catch(console.error);
    }
  }

  function removeDirectReference(ownerNodeId, referenceId) {
    const owner = nodesRef.current.find(node => node.id === ownerNodeId);
    const reference = owner?.referenceAssets?.find(item => item.id === referenceId);
    if (!owner || !reference) {
      return;
    }
    recordUndoSnapshot();
    revokeRuntimeUrl(reference.url);
    commitNodes(previous => previous.map(node => (
      node.id === owner.id
        ? {
            ...node,
            referenceAssets: (node.referenceAssets || []).filter(item => item.id !== reference.id),
            updatedAt: new Date().toISOString()
          }
        : node
    )));
    persistCurrentSnapshot().catch(console.error);
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
          parentIds: [],
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
    commitNodes(previous => previous.flatMap(node => {
      if (!targets.has(node.id)) {
        const parentIds = (node.parentIds || []).filter(id => !targets.has(id));
        const referenceNodeIds = (node.referenceNodeIds || []).filter(id => !targets.has(id));
        if (
          parentIds.length !== (node.parentIds || []).length
          || referenceNodeIds.length !== (node.referenceNodeIds || []).length
        ) {
          return [{
            ...node,
            parentIds,
            referenceNodeIds,
            updatedAt: new Date().toISOString()
          }];
        }
        return [node];
      }
      if (node.type !== "history-image") {
        revokeNodeRuntimeUrls(node);
        return [];
      }
      revokeReferenceAssetUrls(node.referenceAssets);
      return [{
        ...node,
        referenceAssets: [],
        hidden: true,
        updatedAt: new Date().toISOString()
      }];
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
    nodesRef.current.forEach(revokeNodeRuntimeUrls);
    const hiddenHistoryNodes = nodesRef.current
      .filter(node => node.type === "history-image")
      .map(node => ({
        ...node,
        referenceAssets: [],
        hidden: true,
        updatedAt: new Date().toISOString()
      }));
    const resetViewport = { x: 32, y: 32, zoom: 1 };
    commitNodes(hiddenHistoryNodes);
    setSelectedIds([]);
    commitViewport(resetViewport);
    await saveCanvasSnapshot({
      canvasId,
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
    setReferenceMenuOpen(false);
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
    setReferenceMenuOpen(false);
    setNodeMoreOpen(false);
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

  async function generateOnCanvas() {
    const nextPrompt = stripMentionTokens(prompt);
    const selectedTextContext = generationInputNodes
      .filter(node => node.type === "text" && node.content?.trim())
      .map(node => node.content.trim())
      .join("\n\n");
    const generationPrompt = [selectedTextContext, nextPrompt].filter(Boolean).join("\n\n");
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    if (!generationPrompt) {
      onToast?.(text("promptRequired"));
      promptRef.current?.focus();
      return;
    }
    const imageReferenceCandidates = generationInputNodes.filter(
      node => node.type === "upload" || node.type === "history-image"
    );
    const totalReferenceCount = imageReferenceCandidates.length + directReferenceAssets.length;
    if (totalReferenceCount > MAX_REFERENCE_IMAGES) {
      onToast?.(text("referenceLimit", { count: MAX_REFERENCE_IMAGES }));
      return;
    }
    if (imageReferenceCandidates.length > 0 && referenceNodes.length !== imageReferenceCandidates.length) {
      onToast?.(text("missingReference"));
      return;
    }

    try {
      const references = await Promise.all([
        ...referenceNodes.map(async node => {
          const asset = getNodeAsset(node);
          return {
            id: createLocalId("reference"),
            name: asset.name || `${node.id}.png`,
            type: asset.mimeType,
            dataUrl: await blobToDataUrl(asset.blob)
          };
        }),
        ...directReferenceAssets.map(async reference => ({
          id: createLocalId("reference"),
          name: reference.name || `${reference.id}.png`,
          type: reference.mimeType || reference.blob.type || "image/png",
          dataUrl: await blobToDataUrl(reference.blob)
        }))
      ]);
      const generationCount = clamp(Number(count) || 1, 1, MAX_GENERATION_COUNT);
      const nodeSize = sizeFromAspectRatio(aspectRatio);
      const replaceTarget = generationNodes.length === 1 && generationNodes[0].type === "empty-image"
        ? generationNodes[0]
        : null;
      const outputParentIds = replaceTarget
        ? [...(replaceTarget.parentIds || [])]
        : generationNodes.map(node => node.id);
      const positions = createPlacementPositions(
        generationCount,
        nodeSize,
        replaceTarget ? { x: replaceTarget.x, y: replaceTarget.y } : undefined
      );
      const canvasContext = {
        projectId: "default",
        parentIds: outputParentIds,
        anchor: positions[0],
        replacedNodeId: replaceTarget?.id || ""
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
      commitNodes(previous => {
        if (!replaceTarget || canvasNodes.length === 0) {
          return [...previous, ...canvasNodes];
        }

        const replacement = canvasNodes[0];
        const replaced = previous.map(node => {
          if (node.id === replaceTarget.id) {
            return replacement;
          }
          const hasParentReference = (node.parentIds || []).includes(replaceTarget.id);
          const hasDraftReference = (node.referenceNodeIds || []).includes(replaceTarget.id);
          if (!hasParentReference && !hasDraftReference) {
            return node;
          }
          return {
            ...node,
            parentIds: (node.parentIds || []).map(parentId => (
              parentId === replaceTarget.id ? replacement.id : parentId
            )),
            referenceNodeIds: (node.referenceNodeIds || []).map(referenceId => (
              referenceId === replaceTarget.id ? replacement.id : referenceId
            )),
            updatedAt: new Date().toISOString()
          };
        });
        return [...replaced, ...canvasNodes.slice(1)];
      });
      if (replaceTarget && canvasNodes.length > 0) {
        revokeReferenceAssetUrls(replaceTarget.referenceAssets);
      }
      setSelectedIds(canvasNodes.map(node => node.id));
      commitSetting("prompt", "", setPrompt);
      persistCurrentSnapshot().catch(console.error);
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
      const startX = parent.x + parent.width + CONNECTION_HANDLE_OFFSET;
      const startY = parent.y + parent.height / 2;
      const endX = node.x - CONNECTION_HANDLE_OFFSET;
      const endY = node.y + node.height / 2;
      const bend = Math.max(48, Math.abs(endX - startX) * 0.45);
      return {
        id: edgeId(parent.id, node.id),
        parentId: parent.id,
        childId: node.id,
        d: `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`,
        endX,
        endY,
        midX: (startX + endX) / 2,
        midY: (startY + endY) / 2,
        active: selectedEdgeId === edgeId(parent.id, node.id) || selectedIdSet.has(parent.id) || selectedIdSet.has(node.id)
      };
    }).filter(Boolean));
  }, [visibleNodes, selectedIds, selectedEdgeId]);

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
  const selectionScreenBottom = selectionBounds
    ? viewport.y + selectionBounds.maximumY * viewport.zoom
    : stageHeight / 2;
  const toolbarHalfWidth = 86;
  const contextualToolbarStyle = primarySelectedNode
    ? {
        left: clamp(selectionScreenCenterX, toolbarHalfWidth + 12, stageWidth - toolbarHalfWidth - 12),
        top: Math.max(12, selectionScreenTop - 41)
      }
    : undefined;
  const contextualComposerStyle = selectionBounds
    ? {
        left: clamp(selectionScreenCenterX, 336, stageWidth - 336),
        top: clamp(selectionScreenBottom + 12, 66, Math.max(66, stageHeight - 350))
      }
    : undefined;

  function saveAnnotation(blob) {
    const nodeId = annotationNodeId;
    const target = nodesRef.current.find(node => node.id === nodeId);
    if (!target) return;
    recordUndoSnapshot();
    revokeRuntimeUrl(target.annotationUrl);
    const annotationUrl = URL.createObjectURL(blob);
    commitNodes(previous => previous.map(node => (
      node.id === nodeId
        ? { ...node, annotationBlob: blob, annotationUrl, updatedAt: new Date().toISOString() }
        : node
    )));
    setAnnotationNodeId("");
    setSelectedIds([nodeId]);
    commitSetting(
      "prompt",
      language === "en"
        ? "Modify only the marked region while preserving the rest of the image."
        : "仅修改标注区域，保持画面其他部分不变。",
      setPrompt
    );
    window.requestAnimationFrame(() => promptRef.current?.focus());
  }

  function renderMentionMenu() {
    if (!mentionMenuOpen) return null;
    const query = prompt.match(/@([^@\n]*)$/)?.[1]?.trim().toLowerCase() || "";
    const candidates = visibleNodes.filter(node => (
      nodeDisplayName(node).toLowerCase().includes(query) ||
      node.type.includes(query)
    )).slice(0, 8);
    return (
      <div className="canvas-mention-menu">
        <strong>{language === "en" ? "Reference a canvas node" : "引用画布节点"}</strong>
        {candidates.length > 0 ? candidates.map(node => {
          const asset = getNodeAsset(node);
          return (
            <button key={node.id} type="button" onClick={() => insertMention(node)}>
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
    <section className={`canvas-workspace wuli-canvas${active ? " is-active" : " mode-hidden"}${assistantOpen ? " is-assistant-open" : ""}`} aria-label={text("title")}>
      <header className="wuli-canvas-header canvas-floating-ui">
        <div className="wuli-project-switcher">
          <button className="wuli-home-button" type="button" onClick={onExit} title={text("exitClassic")}>
            <span><Sparkles /></span>
          </button>
          <button className="wuli-project-title" type="button" onClick={() => fitToContent()}>
            <strong>{projectTitle}</strong>
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
        onPointerDownCapture={captureStagePointerDown}
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
            <span>{text("referencePickerHint")}</span>
            <button type="button" onClick={() => setReferencePicker(null)}>
              {text("exitReferencePicker")}
            </button>
          </div>
        ) : null}

        <div
          className="canvas-plane"
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`
          }}
        >
          <svg className={`canvas-connectors${linksVisible ? "" : " is-hidden"}`} aria-hidden="true">
            {connectorPaths.map(path => (
              <g key={path.id} className={path.active ? "is-active" : ""}>
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
            const referenceIndex = referenceNodes.findIndex(item => item.id === node.id);
            const branchDepth = branchDepthMap.get(node.id) || 0;
            const hasParents = (node.parentIds || []).some(parentId => visibleNodes.some(item => item.id === parentId));
            const nodeUiScale = clamp(1 / viewport.zoom, 1, 2.4);
            const isTextNode = node.type === "text";
            const isEditingTextNode = isTextNode && editingTextNodeId === node.id;
            const isEmptyImageNode = node.type === "empty-image";
            const statusLabel = asset.status === "streaming"
              ? text("receiving")
              : asset.status === "error"
                ? text("failed")
                : text("generating");
            return (
              <article
                key={node.id}
                data-node-id={node.id}
                className={`canvas-node${selected ? " is-selected" : ""}${asset.status === "error" ? " is-error" : ""}${isTextNode ? " is-text-node" : ""}${isEditingTextNode ? " is-editing" : ""}${isEmptyImageNode ? " is-empty-image-node" : ""}`}
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
                  {isTextNode ? <Type /> : <Image />}
                  <span>{isTextNode ? (node.title || text("textNodeTitle")) : (node.name || asset.task?.prompt || text("emptyImageTitle"))}</span>
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
                <button
                  className="canvas-connection-handle is-input"
                  type="button"
                  data-connection-input={node.id}
                  aria-label={text("connectUpstream")}
                  onPointerDown={event => beginConnection(event, node, "target")}
                >
                  <Sparkles />
                </button>
                <button
                  className="canvas-connection-handle is-output"
                  type="button"
                  data-connection-output={node.id}
                  aria-label={text("connectDownstream")}
                  onPointerDown={event => beginConnection(event, node, "source")}
                >
                  <Sparkles />
                </button>
                {selected && selectedIds.length === 1 ? (
                  <>
                    {RESIZE_HANDLES.map(direction => (
                      <button
                        key={direction}
                        className={`canvas-resize-handle is-${direction}`}
                        type="button"
                        aria-label={language === "en" ? `Resize ${direction}` : `${direction} 方向缩放`}
                        onPointerDown={event => beginNodeResize(event, node, direction)}
                      />
                    ))}
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
            <button type="button" onClick={() => addConnectedNode("empty-image")}>
              <Image />
              <span>{text("addImageNode")}</span>
            </button>
            <button type="button" onClick={() => addConnectedNode("text")}>
              <Type />
              <span>{text("addTextNode")}</span>
            </button>
            <button type="button" onClick={openConnectionUpload}>
              <Upload />
              <span>{text("upload")}</span>
            </button>
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

        {primarySelectedNode && !assistantOpen && !referencePicker ? (
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
                {primarySelectedNode.type !== "empty-image" ? (
                  <button type="button" onClick={() => {
                    setNodeMoreOpen(false);
                    prepareNodeContinuation(primarySelectedNode);
                  }}><Sparkles /><span>{text("continueFromNode")}</span></button>
                ) : null}
                {primarySelectedNode.type === "history-image" && (primarySelectedNode.parentIds || []).length > 0 ? (
                  <button type="button" onClick={() => {
                    setNodeMoreOpen(false);
                    compareNodeBranch(primarySelectedNode);
                  }}><GitBranch /><span>{text("compareBranch")}</span></button>
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
            <span><Link2 />{language === "en" ? "Connection" : "节点连线"}</span>
            <button type="button" onClick={() => disconnectEdge(selectedEdge.id)} title={language === "en" ? "Disconnect" : "断开连线"}><Unlink /></button>
            <button type="button" onClick={() => disconnectEdge(selectedEdge.id)} title={text("delete")}><Trash2 /></button>
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

        <div className="wuli-canvas-toolbar canvas-floating-ui">
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
          <button type="button" onClick={undoCanvasChange} disabled={undoStack.length === 0} title={text("undo")}><RotateCcw /></button>
          <i className="wuli-toolbar-divider" />
          <button className={tool === "select" ? "active light" : ""} type="button" onClick={() => setTool("select")} title={`${text("select")} (V)`}><MousePointer2 /></button>
          <button type="button" onClick={undoCanvasChange} disabled={undoStack.length === 0} title={text("undo")}><Undo2 /></button>
          <button type="button" onClick={redoCanvasChange} disabled={redoStack.length === 0} title={text("redo")}><Redo2 /></button>
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
                <strong>{text("generatedHistory")}</strong>
                <span>{text("generatedHistoryHint")}</span>
              </div>
              <b>{text("generatedHistoryCount", { count: historyImageCount })}</b>
              <button type="button" onClick={() => setHistoryPanelOpen(false)} title={text("closeAgent")}><X /></button>
            </header>
            <div className="canvas-history-scroll">
              {historyLoading ? (
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
            <div><span><Bot /></span><strong>{projectTitle}</strong><ChevronDown /></div>
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
            {generationInputNodes.length > 0 || directReferenceAssets.length > 0 ? (
              <div className="wuli-agent-reference-strip">
                {generationInputNodes.map(node => {
                  const asset = getNodeAsset(node);
                  return (
                    <button className="wuli-reference-card" key={node.id} type="button" title={text("removeReference")} onClick={() => removeGenerationReference(node.id)}>
                      {node.type === "text" ? <Type /> : asset.url ? <img src={asset.url} alt="" /> : <Image />}
                      <span>{node.type === "text" ? (node.content || text("textNodeTitle")) : (asset.name || text("emptyImageTitle"))}</span>
                      <X />
                    </button>
                  );
                })}
                {directReferenceAssets.map(reference => (
                  <button
                    className="wuli-reference-card"
                    key={`${reference.ownerNodeId}-${reference.id}`}
                    type="button"
                    title={text("removeReference")}
                    onClick={() => removeDirectReference(reference.ownerNodeId, reference.id)}
                  >
                    <img src={reference.url} alt="" />
                    <span>{reference.name || text("localAsset")}</span>
                    <X />
                  </button>
                ))}
              </div>
            ) : null}
            <textarea
              ref={promptRef}
              value={prompt}
              placeholder={text("prompt")}
              onChange={event => handlePromptChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  generateOnCanvas();
                }
              }}
            />
            {renderMentionMenu()}
            <div>
              <button type="button" title={text("addReference")} onClick={() => {
                const target = getReferenceTarget();
                if (target) {
                  requestReferenceUpload(target.id);
                } else {
                  onToast?.(text("selectSingleReferenceTarget"));
                }
              }}><Plus /></button>
              <button className="wuli-mode-pill" type="button"><Link2 />{text("defaultMode")}<ChevronDown /></button>
              <button className="wuli-agent-send" type="submit"><Send /></button>
            </div>
          </form>
        </aside>

        {selectedNodes.length > 0 && !assistantOpen && !referencePicker ? (
          <form className="canvas-composer wuli-context-composer canvas-floating-ui" style={contextualComposerStyle} onSubmit={event => {
            event.preventDefault();
            generateOnCanvas();
          }}>
            <div className="wuli-reference-strip">
              <button className={referenceMenuOpen ? "is-active" : ""} type="button" onClick={toggleReferenceMenu} title={text("addReference")}><Plus /></button>
              {referenceMenuOpen && primarySelectedNode ? (
                <div className="wuli-reference-add-menu">
                  <button type="button" onClick={startCanvasReferencePicker}>
                    <MousePointer2 />
                    <span>{text("selectFromCanvas")}</span>
                  </button>
                  <button type="button" onClick={() => requestReferenceUpload(primarySelectedNode.id)}>
                    <Upload />
                    <span>{text("uploadReference")}</span>
                  </button>
                </div>
              ) : null}
              {generationInputNodes.map(node => {
                const asset = getNodeAsset(node);
                return (
                  <button className="wuli-reference-card" key={node.id} type="button" title={text("removeReference")} onClick={() => removeGenerationReference(node.id)}>
                    {node.type === "text" ? <Type /> : asset.url ? <img src={asset.url} alt="" /> : <Image />}
                    <span>{node.type === "text" ? (node.content || text("textNodeTitle")) : (asset.name || text("emptyImageTitle"))}</span>
                    <X />
                  </button>
                );
              })}
              {directReferenceAssets.map(reference => (
                <button
                  className="wuli-reference-card"
                  key={`${reference.ownerNodeId}-${reference.id}`}
                  type="button"
                  title={text("removeReference")}
                  onClick={() => removeDirectReference(reference.ownerNodeId, reference.id)}
                >
                  <img src={reference.url} alt="" />
                  <span>{reference.name || text("localAsset")}</span>
                  <X />
                </button>
              ))}
            </div>
            <textarea
              ref={promptRef}
              value={prompt}
              placeholder={text("prompt")}
              onChange={event => handlePromptChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  generateOnCanvas();
                }
              }}
            />
            {renderMentionMenu()}
            <div className="wuli-context-controls">
              <button className="wuli-model-pill" type="button"><Sparkles />{text("imageModel")}<ChevronDown /></button>
              <div className="wuli-generation-settings">
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
              </div>
              <Button className="wuli-generate-cost" type="submit">
                <Sparkles />
                <span>{currentUser ? count : text("loginGenerate")}</span>
              </Button>
            </div>
          </form>
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
                  ["I / T / U", language === "en" ? "Image / text / upload" : "图片 / 文本 / 上传"],
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
    </section>
  );
}

export default CanvasWorkspace;
