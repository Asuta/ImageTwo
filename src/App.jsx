import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronUp,
  Copy,
  CreditCard,
  Eraser,
  Bell,
  Folder,
  Grid2X2,
  History,
  Home,
  Image,
  LogOut,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const DB_NAME = "image2-local-history";
const DB_VERSION = 1;
const MAX_LOCAL_IMAGES = 300;
const GENERATION_POLL_INTERVAL_MS = 2500;
const GENERATION_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const HISTORY_LOAD_TIMEOUT_MS = 3500;
const HISTORY_IMAGE_SCALE = 100;

const ratioChoices = [
  { value: "auto", label: "智能", shape: "auto" },
  { value: "9:21", label: "9:21", shape: "r-9-21" },
  { value: "9:16", label: "9:16", shape: "r-9-16" },
  { value: "2:3", label: "2:3", shape: "r-2-3" },
  { value: "3:4", label: "3:4", shape: "r-3-4" },
  { value: "1:1", label: "1:1", shape: "r-1-1" },
  { value: "4:3", label: "4:3", shape: "r-4-3" },
  { value: "3:2", label: "3:2", shape: "r-3-2" },
  { value: "16:9", label: "16:9", shape: "r-16-9" },
  { value: "21:9", label: "21:9", shape: "r-21-9" }
];

function openHistoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tasks")) {
        db.createObjectStore("tasks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("images")) {
        const imageStore = db.createObjectStore("images", { keyPath: "id" });
        imageStore.createIndex("taskId", "taskId", { unique: false });
        imageStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const request = store[method](...args);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function createImageObjectUrl(base64, mimeType) {
  const normalizedBase64 = normalizeRenderableBase64(base64);
  if (!normalizedBase64) {
    return "";
  }

  try {
    return URL.createObjectURL(base64ToBlob(normalizedBase64, mimeType));
  } catch {
    return "";
  }
}

function normalizeRenderableBase64(base64) {
  const cleanBase64 = String(base64 || "").replace(/\s/g, "");
  const renderableLength = cleanBase64.length - (cleanBase64.length % 4);
  return renderableLength > 0 ? cleanBase64.slice(0, renderableLength) : "";
}

function normalizePartialBase64(base64) {
  const cleanBase64 = String(base64 || "").replace(/\s/g, "");
  const alignedLength = cleanBase64.length - (cleanBase64.length % 4);
  return alignedLength > 0 ? cleanBase64.slice(0, alignedLength) : "";
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:image\/[^;]+;base64,/i, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createLocalId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function getCountValue(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : 1;
}

function getRatioLabel(value) {
  return value === "auto" ? "智能比例" : value;
}

function getTaskTitle(prompt) {
  const firstLine = String(prompt || "").split(/\n/).find(Boolean) || String(prompt || "");
  return firstLine.length > 82 ? `${firstLine.slice(0, 82)}...` : firstLine;
}

function createLoadingImages(count) {
  return Array.from({ length: count }, () => ({
    id: createLocalId(),
    status: "loading",
    url: "",
    createdAt: new Date().toISOString()
  }));
}

const previewRows = [
  {
    title: "Cinematic mountain retreat above the clouds at sunrise, minimalist architecture, warm light, ultra realistic",
    refs: ["/demo/ref-1.png", "/demo/ref-2.png"],
    images: ["/demo/mountain-1.png", "/demo/mountain-2.png", "/demo/mountain-3.png", "/demo/mountain-4.png"],
    ratio: "16:9",
    time: "2 minutes ago",
    theme: "warm"
  },
  {
    title: "Cyberpunk city street at night, rain reflections, neon lights, moody atmosphere",
    refs: ["/demo/ref-3.png", "/demo/ref-4.png", "/demo/ref-5.png"],
    images: ["/demo/cyber-1.png", "/demo/cyber-2.png", "/demo/cyber-3.png"],
    ratio: "21:9",
    time: "1 hour ago",
    theme: "neon",
    loading: true
  },
  {
    title: "Ethereal portrait of a woman, soft lighting, floral elements, dreamy and elegant",
    refs: ["/demo/ref-1.png"],
    ratio: "4:5",
    time: "3 hours ago",
    images: ["/demo/portrait-1.png", "/demo/portrait-2.png", "/demo/portrait-3.png", "/demo/portrait-4.png"],
    theme: "portrait"
  }
];

function createTask({ prompt, aspectRatio, quality, count, mode, referenceImages }) {
  const id = createLocalId();
  return {
    id,
    prompt,
    aspectRatio,
    quality,
    count,
    mode,
    model: "gpt-image-2",
    createdAt: new Date().toISOString(),
    costCredits: 0,
    remainingCreditsSnapshot: null,
    referenceThumbs: referenceImages.map(image => image.dataUrl).filter(dataUrl => dataUrl.length < 600_000),
    referenceNames: referenceImages.map(image => image.name),
    referenceImages,
    images: createLoadingImages(count)
  };
}

function createInterruptedImages(count) {
  return Array.from({ length: Math.max(1, Number(count) || 1) }, () => ({
    id: createLocalId(),
    status: "error",
    error: "这次生成没有保存到浏览器本地，请重新生成。",
    createdAt: new Date().toISOString()
  }));
}

function getTaskReferenceThumbs(task) {
  const savedThumbs = Array.isArray(task.referenceThumbs) ? task.referenceThumbs : [];
  if (savedThumbs.length > 0) {
    return savedThumbs;
  }

  return (Array.isArray(task.referenceImages) ? task.referenceImages : [])
    .map(image => image?.dataUrl)
    .filter(Boolean);
}

function getThemeFromStorage() {
  return localStorage.getItem("image2-theme") || document.documentElement.dataset.theme || "light";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("image2-theme", theme);
}

function App() {
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState("medium");
  const [count, setCount] = useState("1");
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [referenceImages, setReferenceImages] = useState([]);
  const [referenceDockExpanded, setReferenceDockExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginCodeRequested, setLoginCodeRequested] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [theme, setThemeState] = useState(getThemeFromStorage());
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState({
    isOpen: false,
    src: "",
    scale: 1,
    x: 0,
    y: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    originX: 0,
    originY: 0
  });
  const [previewScaleLabel, setPreviewScaleLabel] = useState("100%");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [giftKey, setGiftKey] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState(false);
  const historyRef = useRef([]);
  const previewImageRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onError = event => {
      showToast(`页面脚本错误：${event.message || "未知错误"}`);
    };
    const onRejection = event => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "未知错误");
      showToast(`页面异步错误：${reason}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    refreshCurrentUser();
    loadHistory();
  }, []);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === "Escape") {
        closeImagePreview();
        setAccountOpen(false);
        setRatioOpen(false);
        setHistoryOpen(false);
      }
    };

    const onClick = event => {
      if (!event.target.closest(".ratio-control")) {
        setRatioOpen(false);
      }
      if (!event.target.closest(".account-popover") && !event.target.closest("#accountButton")) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, []);

  useEffect(() => {
    return () => {
      historyRef.current.forEach(task => {
        task.images?.forEach(image => {
          if (image.url?.startsWith("blob:")) {
            URL.revokeObjectURL(image.url);
          }
        });
      });
      if (previewImageRef.current?.src?.startsWith("blob:")) {
        URL.revokeObjectURL(previewImageRef.current.src);
      }
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    document.body.classList.toggle("preview-open", preview.isOpen);
    return () => {
      document.body.classList.remove("preview-open");
    };
  }, [preview.isOpen]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2600);
  }, [toast]);

  const isLoggedIn = Boolean(currentUser);
  const visibleHistory = useMemo(() => history, [history]);
  const showPreviewRows = !historyLoading && history.length < previewRows.length;
  const supplementalPreviewRows = useMemo(() => (
    showPreviewRows ? previewRows.slice(0, previewRows.length - history.length) : []
  ), [showPreviewRows, history.length]);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const db = await withTimeout(openHistoryDb(), HISTORY_LOAD_TIMEOUT_MS, "本地历史数据库响应超时");
      const transaction = db.transaction(["tasks", "images"], "readonly");
      const done = transactionDone(transaction);
      const [tasks, images] = await withTimeout(Promise.all([
        storeRequest(transaction.objectStore("tasks"), "getAll"),
        storeRequest(transaction.objectStore("images"), "getAll")
      ]), HISTORY_LOAD_TIMEOUT_MS, "本地历史读取超时");
      const imagesByTask = new Map();

      images.forEach(image => {
        const url = image.blob ? URL.createObjectURL(image.blob) : "";
        const imageRecord = { ...image, url };
        imagesByTask.set(image.taskId, [...(imagesByTask.get(image.taskId) || []), imageRecord]);
      });

      await withTimeout(done, HISTORY_LOAD_TIMEOUT_MS, "本地历史事务超时");

      const loadedHistory = tasks
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(task => ({
          ...task,
          images: (imagesByTask.get(task.id) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }));

      setHistory(loadedHistory.map(task => (
        task.images.length > 0 ? task : { ...task, images: createInterruptedImages(task.count) }
      )));
      setSelectedId(prev => prev || loadedHistory[0]?.id || null);
    } catch (error) {
      console.error(error);
      setHistory([]);
      setSelectedId(null);
      setHistoryError("");
      showToast("本地历史暂不可用，已进入空白创作状态");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveTask(task) {
    const db = await openHistoryDb();
    const transaction = db.transaction("tasks", "readwrite");
    const done = transactionDone(transaction);
    const { images: _images, ...storableTask } = task;
    transaction.objectStore("tasks").put(storableTask);
    await done;
  }

  async function saveImage(taskId, image) {
    const db = await openHistoryDb();
    const transaction = db.transaction("images", "readwrite");
    const done = transactionDone(transaction);
    const { url: _url, ...storableImage } = image;
    transaction.objectStore("images").put({ ...storableImage, taskId });
    await done;
    await trimLocalHistory();
  }

  async function deleteTaskFromDb(taskId) {
    const db = await openHistoryDb();
    const readTransaction = db.transaction("images", "readonly");
    const readDone = transactionDone(readTransaction);
    const images = await storeRequest(readTransaction.objectStore("images").index("taskId"), "getAll", taskId);
    await readDone;

    const transaction = db.transaction(["tasks", "images"], "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore("tasks").delete(taskId);
    const imageStore = transaction.objectStore("images");
    images.forEach(image => imageStore.delete(image.id));
    await done;
  }

  async function clearHistoryDb() {
    const db = await openHistoryDb();
    const transaction = db.transaction(["tasks", "images"], "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore("tasks").clear();
    transaction.objectStore("images").clear();
    await done;
  }

  async function clearAllLocalHistory() {
    await clearHistoryDb();
    history.forEach(task => task.images.forEach(image => {
      if (image.url?.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
    }));
    setHistory([]);
    setSelectedId(null);
    setClearHistoryConfirmOpen(false);
    showToast("已清空当前浏览器的本地历史");
  }

  async function trimLocalHistory() {
    const db = await openHistoryDb();
    const readTransaction = db.transaction(["tasks", "images"], "readonly");
    const readDone = transactionDone(readTransaction);
    const images = await storeRequest(readTransaction.objectStore("images"), "getAll");
    await readDone;

    if (images.length <= MAX_LOCAL_IMAGES) {
      return;
    }

    const removable = images
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, images.length - MAX_LOCAL_IMAGES);
    const removableTaskIds = new Set(removable.map(image => image.taskId));
    const removableImageIds = new Set(removable.map(image => image.id));
    const remainingTaskIds = new Set(
      images
        .filter(image => !removableImageIds.has(image.id))
        .map(image => image.taskId)
    );
    const writeTransaction = db.transaction(["tasks", "images"], "readwrite");
    const writeDone = transactionDone(writeTransaction);
    const imageStore = writeTransaction.objectStore("images");
    const taskStore = writeTransaction.objectStore("tasks");

    removable.forEach(image => imageStore.delete(image.id));
    for (const taskId of removableTaskIds) {
      if (!remainingTaskIds.has(taskId)) {
        taskStore.delete(taskId);
      }
    }

    await writeDone;
  }

  async function refreshCurrentUser() {
    setAccountLoading(true);
    try {
      const response = await fetch("/api/auth/me");
      const payload = await response.json();
      setCurrentUser(payload.user || null);
      if (payload.user?.email) {
        setEmail(payload.user.email);
      }
    } catch (error) {
      console.error(error);
      setCurrentUser(null);
    } finally {
      setAccountLoading(false);
    }
  }

  async function sendLoginCode() {
    const nextEmail = email.trim();
    if (!nextEmail) {
      showToast("请先输入邮箱");
      return;
    }

    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "验证码发送失败。");
      }

      setLoginCodeRequested(true);
      if (payload.devCode) {
        setCode(payload.devCode);
      }
      showToast(payload.devCode ? `开发验证码：${payload.devCode}` : "验证码已发送，请检查邮箱");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function loginWithCode() {
    const nextEmail = email.trim();
    const nextCode = code.trim();
    if (!nextEmail || !nextCode) {
      showToast("请输入邮箱和验证码");
      return;
    }

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail, code: nextCode })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "登录失败。");
      }

      setCode("");
      setLoginCodeRequested(false);
      setCurrentUser(payload.user);
      setAccountOpen(false);
      showToast("登录成功");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setLoginCodeRequested(false);
    setEmail("");
    setCode("");
    setGiftKey("");
    setAccountOpen(false);
    showToast("已退出登录");
  }

  async function redeemGiftCard() {
    const key = giftKey.trim();
    if (!key) {
      showToast("请输入礼品卡 Key");
      return;
    }

    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "兑换失败。");
      }

      setGiftKey("");
      setCurrentUser(payload.user);
      showToast(`已兑换 ${payload.creditsAdded} 点，当前余额 ${payload.user.credits} 点`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  function showToast(message) {
    setToast(message);
  }

  function syncReferenceModeState(images = referenceImages) {
    return images.length > 0;
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addReferenceFiles(files) {
    const imageFiles = [...files].filter(file => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showToast("请上传图片文件");
      return;
    }

    const additions = await Promise.all(imageFiles.map(async file => ({
      id: createLocalId(),
      name: file.name,
      type: file.type,
      dataUrl: await fileToDataUrl(file)
    })));

    setReferenceImages(prev => [...prev, ...additions]);
  }

  async function handlePromptPaste(event) {
    const clipboardFiles = [...(event.clipboardData?.files || [])];
    const itemFiles = [...(event.clipboardData?.items || [])]
      .filter(item => item.kind === "file")
      .map(item => item.getAsFile())
      .filter(Boolean);
    const imageFiles = (itemFiles.length > 0 ? itemFiles : clipboardFiles)
      .filter(file => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    await addReferenceFiles(imageFiles);
    showToast(`已粘贴 ${imageFiles.length} 张参考图`);
  }

  function clearReferences() {
    setReferenceImages([]);
    setReferenceDockExpanded(false);
  }

  function removeReference(id) {
    setReferenceImages(prev => {
      const next = prev.filter(image => image.id !== id);
      if (next.length === 0) {
        setReferenceDockExpanded(false);
      }
      return next;
    });
  }

  function renderRatioOptions() {
    return ratioChoices.map(choice => (
      <button
        key={choice.value}
        className={`ratio-option${choice.value === aspectRatio ? " selected" : ""}`}
        type="button"
        data-ratio={choice.value}
        onClick={() => {
          setAspectRatio(choice.value);
          setRatioOpen(false);
        }}
      >
        <span className={`ratio-shape ${choice.shape}`} aria-hidden="true" />
        <span>{choice.label}</span>
      </button>
    ));
  }

  async function requestImage(task, imageId) {
    try {
      if (!currentUser) {
        throw new Error("请先使用邮箱验证码登录。");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: task.prompt,
          aspectRatio: task.aspectRatio || "auto",
          quality: task.quality || "medium",
          mode: task.mode,
          referenceImages: task.referenceImages || []
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "生成失败。");
      }

      const result = payload.status === "pending"
        ? await pollGenerationResult(payload.requestId, task.id, imageId)
        : payload;

      if (result.status !== "succeeded" && result.status !== "completed") {
        throw new Error(result.detail || result.error || "生成失败。");
      }

      if (Number.isFinite(result.remainingCredits)) {
        setCurrentUser(prev => prev ? { ...prev, credits: result.remainingCredits } : prev);
      }

      const blob = base64ToBlob(result.imageBase64, result.mimeType || "image/png");
      const doneImage = {
        id: imageId,
        status: "done",
        url: URL.createObjectURL(blob),
        blob,
        mimeType: result.mimeType || "image/png",
        outputFormat: result.outputFormat || "png",
        requestId: result.requestId,
        createdAt: new Date().toISOString()
      };

      setHistory(prev => prev.map(item => {
        if (item.id !== task.id) {
          return item;
        }

        return {
          ...item,
          model: result.model || item.model,
          costCredits: (item.costCredits || 0) + (result.costCredits || 0),
          remainingCreditsSnapshot: result.remainingCredits,
          images: item.images.map(image => image.id === imageId ? doneImage : image)
        };
      }));
      await saveImage(task.id, doneImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHistory(prev => prev.map(item => {
        if (item.id !== task.id) {
          return item;
        }

        return {
          ...item,
          images: item.images.map(image => image.id === imageId ? { ...image, status: "error", error: message } : image)
        };
      }));
      showToast(message);
    }
  }

  async function pollGenerationResult(requestId, taskId, imageId) {
    if (!requestId) {
      throw new Error("生成任务没有返回 requestId。");
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < GENERATION_POLL_TIMEOUT_MS) {
      await new Promise(resolve => window.setTimeout(resolve, GENERATION_POLL_INTERVAL_MS));
      const response = await fetch(`/api/generate/${encodeURIComponent(requestId)}`);
      const payload = await response.json();

      if (response.ok && payload.status === "streaming") {
        updateStreamingImage(taskId, imageId, payload);
        continue;
      }

      if (response.ok && payload.status === "succeeded") {
        return payload;
      }

      if (!response.ok || payload.status === "failed") {
        throw new Error(payload.detail || payload.error || "生成失败。");
      }
    }

    throw new Error("生成超时，请稍后重试。");
  }

  function updateStreamingImage(taskId, imageId, result) {
    if (!result?.imageBase64) {
      return;
    }

    const base64 = normalizePartialBase64(stripDataUrlPrefix(result.imageBase64));
    if (!base64) {
      return;
    }

    setHistory(prev => prev.map(task => {
      if (task.id !== taskId) {
        return task;
      }

      return {
        ...task,
        images: task.images.map(image => {
          if (image.id !== imageId) {
            return image;
          }

          if (image.streamedLength && image.streamedLength >= base64.length) {
            return image;
          }

          if (image.url?.startsWith("blob:")) {
            URL.revokeObjectURL(image.url);
          }

          const url = createImageObjectUrl(base64, result.mimeType || "image/png");
          if (!url) {
            return image;
          }

          return {
            ...image,
            status: "streaming",
            url,
            mimeType: result.mimeType || "image/png",
            outputFormat: result.outputFormat || "png",
            requestId: result.requestId,
            streamedLength: base64.length
          };
        })
      };
    }));
  }

  async function runTaskImages(task, images) {
    await Promise.allSettled(images.map(image => requestImage(task, image.id)));
    const updatedTask = historyRef.current.find(item => item.id === task.id);
    const generatedCount = updatedTask?.images.filter(image => image.status === "done").length || 0;
    const failedCount = updatedTask?.images.filter(image => image.status === "error").length || 0;

    if (failedCount > 0) {
      showToast(`${failedCount} 张生成失败，${generatedCount} 张已保存到本地`);
    } else {
      showToast(`${generatedCount} 张图片已保存到当前浏览器`);
    }
  }

  async function generateNewTask() {
    if (!currentUser) {
      showToast("请先登录后再生成");
      setAccountOpen(true);
      return;
    }

    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      showToast("请先输入提示词");
      return;
    }

    const nextCount = getCountValue(count);
    const mode = referenceImages.length > 0 ? "edit" : "generate";
    const task = createTask({
      prompt: nextPrompt,
      aspectRatio,
      quality,
      count: nextCount,
      mode,
      referenceImages
    });

    setSelectedId(task.id);
    setHistory(prev => [task, ...prev]);
    saveTask(task).catch(error => {
      console.error(error);
      showToast("本地历史暂时不可用，仍会继续生成");
    });
    setPrompt("");
    showToast("已提交生成请求");
    runTaskImages(task, task.images).catch(error => {
      console.error(error);
      showToast(error instanceof Error ? error.message : String(error));
    });
  }

  async function generateFromTask(task) {
    if (!currentUser) {
      showToast("请先登录后再生成");
      setAccountOpen(true);
      return;
    }

    if (task.mode === "edit" && (!task.referenceImages || task.referenceImages.length === 0)) {
      showToast("刷新后参考图原始数据已失效，请重新上传");
      return;
    }

    const nextTask = createTask({
      prompt: task.prompt,
      aspectRatio: task.aspectRatio || "auto",
      quality: task.quality || "medium",
      count: getCountValue(task.count || task.images.length || 1),
      mode: task.referenceImages?.length ? "edit" : "generate",
      referenceImages: task.referenceImages || []
    });

    setDeleteConfirmId(null);
    setSelectedId(nextTask.id);
    setHistory(prev => [nextTask, ...prev]);
    saveTask(nextTask).catch(error => {
      console.error(error);
      showToast("本地历史暂时不可用，仍会继续生成");
    });
    showToast("已按该历史记录再次提交生成");
    runTaskImages(nextTask, nextTask.images).catch(error => {
      console.error(error);
      showToast(error instanceof Error ? error.message : String(error));
    });
  }

  function fillFromTask(task) {
    if (task.mode === "edit" && (!task.referenceImages || task.referenceImages.length === 0)) {
      showToast("刷新后参考图原始数据已失效，请重新上传");
    }

    setDeleteConfirmId(null);
    setSelectedId(task.id);
    setPrompt(task.prompt);
    setAspectRatio(task.aspectRatio || "auto");
    setQuality(task.quality || "medium");
    setCount(String(task.count || 1));
    if (task.referenceImages?.length) {
      setReferenceImages(task.referenceImages);
    } else {
      clearReferences();
    }
    showToast("已复用提示词和参数");
  }

  async function deleteTask(task) {
    await deleteTaskFromDb(task.id);
    task.images.forEach(image => {
      if (image.url?.startsWith("blob:")) {
        URL.revokeObjectURL(image.url);
      }
    });
    setDeleteConfirmId(null);
    setHistory(prev => {
      const nextHistory = prev.filter(item => item.id !== task.id);
      setSelectedId(selected => (selected === task.id ? nextHistory[0]?.id || null : selected));
      return nextHistory;
    });
    showToast("已删除本地历史记录");
  }

  async function copyPromptFromTask(task) {
    setDeleteConfirmId(null);
    await navigator.clipboard.writeText(task.prompt);
    showToast("提示词已复制");
  }

  function openImagePreview(src) {
    if (!src) {
      return;
    }

    setPreview({
      isOpen: true,
      src,
      scale: 1,
      x: 0,
      y: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      originX: 0,
      originY: 0
    });
    setPreviewScaleLabel("100%");
  }

  function closeImagePreview() {
    setPreview(prev => ({ ...prev, isOpen: false, src: "", isDragging: false, scale: 1, x: 0, y: 0 }));
    setPreviewScaleLabel("100%");
  }

  function clampPreviewScale(value) {
    return Math.min(5, Math.max(0.4, value));
  }

  function updatePreviewTransform(nextPreview) {
    setPreviewScaleLabel(`${Math.round(nextPreview.scale * 100)}%`);
  }

  function zoomPreview(delta) {
    setPreview(prev => {
      const scale = clampPreviewScale(prev.scale + delta);
      const nextPreview = scale <= 1 ? { ...prev, scale, x: 0, y: 0 } : { ...prev, scale };
      updatePreviewTransform(nextPreview);
      return nextPreview;
    });
  }

  function resetPreviewZoom() {
    setPreview(prev => {
      const nextPreview = { ...prev, scale: 1, x: 0, y: 0 };
      updatePreviewTransform(nextPreview);
      return nextPreview;
    });
  }

  function handlePreviewStageClick(event) {
    if (event.target === event.currentTarget) {
      closeImagePreview();
    }
  }

  function handlePreviewWheel(event) {
    if (!preview.isOpen) {
      return;
    }

    event.preventDefault();
    zoomPreview(event.deltaY > 0 ? -0.12 : 0.12);
  }

  function renderReferenceChips(task) {
    const thumbs = getTaskReferenceThumbs(task);

    return (
      <div className="task-reference-block" title={`${thumbs.length} 张参考图`}>
        <p>References ({thumbs.length})</p>
        <div className="reference-chip-stack">
          {thumbs.length > 0 ? thumbs.slice(0, 4).map((src, index) => (
            <img key={`${task.id}-${index}`} className="reference-chip" src={src} alt="参考图" />
          )) : (
            <span className="reference-empty">No refs</span>
          )}
          {thumbs.length > 4 ? <span className="reference-more">+{thumbs.length - 4}</span> : null}
        </div>
      </div>
    );
  }

  function renderPreviewRow(row, rowIndex) {
    const refs = row.refs || [];
    const images = row.images || [];

    return (
      <Card key={row.title} className={`history-task concept-task ${row.loading ? "is-preview-loading" : ""}`}>
        <CardHeader className="task-head">
          <div className="task-title-area">
            <Input type="checkbox" aria-label="选择示例生成记录" readOnly />
            <ChevronUp />
          </div>
          <div className="task-copy-area">
            <CardTitle>{row.title}</CardTitle>
            <div className="tag-row">
              <Badge variant="secondary">Flux Pro</Badge>
              <Badge variant="outline">{row.ratio}</Badge>
              <Badge variant="outline">High Quality</Badge>
              <Badge variant="outline">{row.time}</Badge>
            </div>
          </div>
          <div className="task-more-actions">
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label="收藏示例"><Star /></Button>
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label="分享示例"><Share2 /></Button>
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label="更多示例"><Menu /></Button>
          </div>
        </CardHeader>

        <CardContent className="task-content">
          <div className="task-reference-block">
            <p>References ({refs.length})</p>
            <div className="reference-chip-stack">
              {refs.map((src, index) => (
                <img key={`${row.title}-ref-${index}`} className={`reference-sample ${row.theme}`} src={src} alt="示例参考图" />
              ))}
            </div>
          </div>
          <div className={`image-grid concept-grid count-${Math.min(images.length, 4)}`}>
            {images.map((src, index) => (
              <figure key={`${row.title}-image-${index}`} className={`image-card concept-image ${row.theme}${row.loading && index === 0 ? " concept-loading-image" : ""}`}>
                <img src={src} alt="示例生成图" />
                {row.loading && index === 0 ? (
                  <div className="concept-progress">
                    <span className="aurora-flow aurora-flow-a" aria-hidden="true" />
                    <span className="aurora-flow aurora-flow-b" aria-hidden="true" />
                    <span className="aurora-flow aurora-flow-c" aria-hidden="true" />
                    <span className="gradient-status">生成中...</span>
                  </div>
                ) : null}
                {!row.loading && rowIndex === 0 && index === images.length - 1 ? <div className="concept-more">+2</div> : null}
                <figcaption>{rowIndex === 0 ? "Saved locally" : "Preview"}</figcaption>
              </figure>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderImageCard(image) {
    const imageStyle = {
      "--history-image-scale": HISTORY_IMAGE_SCALE / 100
    };

    if (image.status === "streaming" && image.url) {
      return (
        <figure key={image.id} className="image-card generated-image-card is-streaming">
          <button className="image-preview-trigger" type="button" onClick={() => openImagePreview(image.url)} aria-label="放大预览生成结果">
            <img src={image.url} alt="正在加载的生成结果" style={imageStyle} />
          </button>
          <figcaption>正在接收图片...</figcaption>
        </figure>
      );
    }

    if (image.status === "loading" || image.status === "streaming") {
      return (
        <figure key={image.id} className="image-card is-loading concept-image concept-loading-image">
          <div className="image-skeleton" role="status" aria-label="图片生成中">
            <div className="concept-progress">
              <span className="aurora-flow aurora-flow-a" aria-hidden="true" />
              <span className="aurora-flow aurora-flow-b" aria-hidden="true" />
              <span className="aurora-flow aurora-flow-c" aria-hidden="true" />
              <span className="gradient-status">{image.status === "streaming" ? "接收中..." : "生成中..."}</span>
            </div>
          </div>
          <figcaption>{image.status === "streaming" ? "正在接收图片..." : "正在生成..."}</figcaption>
        </figure>
      );
    }

    if (image.status === "error") {
      return (
        <figure key={image.id} className="image-card is-error">
          <div className="image-error">生成失败</div>
          <figcaption>{image.error || "请稍后重试"}</figcaption>
        </figure>
      );
    }

    return (
      <figure key={image.id} className="image-card generated-image-card">
        <button className="image-preview-trigger" type="button" onClick={() => openImagePreview(image.url)} aria-label="放大预览生成结果">
          <img src={image.url} alt="生成结果" style={imageStyle} />
        </button>
        <figcaption>已保存在当前浏览器本地</figcaption>
      </figure>
    );
  }

  const referenceModeActive = syncReferenceModeState();

  return (
    <div className="studio-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="logo">
          <span className="logo-mark"><Sparkles /></span>
          <span>Image2 Studio</span>
        </div>

        <Button className="new-generation-button" type="button" onClick={() => {
          setSelectedId(null);
          setPrompt("");
        }}>
          <Plus data-icon="inline-start" />
          New Generation
        </Button>

        <nav className="nav-stack">
          <button className="nav-item active" type="button" title="Home">
            <span aria-hidden="true"><Home /></span>
            <span>Home</span>
          </button>
          <button className="nav-item" type="button" title="Creations">
            <span aria-hidden="true"><WandSparkles /></span>
            <span>Creations</span>
          </button>
          <button className="nav-item" type="button" title="Models">
            <span aria-hidden="true"><Image /></span>
            <span>Models</span>
          </button>
          <button className="nav-item" type="button" title="Styles">
            <span aria-hidden="true"><Settings2 /></span>
            <span>Styles</span>
          </button>
          <button className="nav-item" type="button" title="Inspiration">
            <span aria-hidden="true"><History /></span>
            <span>Inspiration</span>
          </button>
          <button className="nav-item" type="button" title="Assets">
            <span aria-hidden="true"><Folder /></span>
            <span>Assets</span>
          </button>
        </nav>

        <div className="collection-stack">
          <div className="collection-head">
            <span>Collections</span>
            <Plus />
          </div>
          <button type="button"><span>Moodboard - Spring</span><em>24</em></button>
          <button type="button"><span>Brand Visuals</span><em>18</em></button>
          <button type="button"><span>Concept - Sci-Fi</span><em>32</em></button>
          <button type="button"><span>Architecture</span><em>27</em></button>
        </div>

        <div className="nav-footer">
          <div className="upgrade-card">
            <Sparkles />
            <strong>Upgrade to Pro</strong>
            <span>Unlock premium models, faster generation and more credits.</span>
            <Button type="button" size="sm">Upgrade Now</Button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-actions">
            <Button className="credit-pill" variant="outline" type="button">
              <CreditCard data-icon="inline-start" />
              <span>Credits {isLoggedIn ? currentUser.credits : "0"}</span>
              <Plus data-icon="inline-end" />
            </Button>
            <Button className="premium-button" asChild>
              <a href="https://pay.ldxp.cn/shop/2C8QL88T" target="_blank" rel="noreferrer">
                <Sparkles data-icon="inline-start" />
                Pro
              </a>
            </Button>
            <Button className="icon-button top-icon-button" variant="outline" size="icon" type="button" aria-label="通知">
              <Bell />
            </Button>
            <Button className="glass-button" variant="outline" type="button" aria-label="切换深色模式" onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setThemeState(nextTheme);
            }}>
              {theme === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
              <span>{theme === "dark" ? "浅色模式" : "深色模式"}</span>
            </Button>
            <Dialog open={clearHistoryConfirmOpen} onOpenChange={setClearHistoryConfirmOpen}>
              <DialogTrigger asChild>
                <Button className={`glass-button${history.length === 0 ? " hidden" : ""}`} variant="outline" type="button">
                  <Eraser data-icon="inline-start" />
                  <span>清空本地历史</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="clear-history-dialog" aria-describedby="clearHistoryDescription">
                <DialogHeader>
                  <DialogTitle>清空本地历史？</DialogTitle>
                  <DialogDescription id="clearHistoryDescription">
                    此操作会删除当前浏览器中保存的全部生成历史和图片记录。清空之后不可恢复，请确认是否继续。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">取消</Button>
                  </DialogClose>
                  <Button variant="destructive" type="button" onClick={clearAllLocalHistory}>确认清空</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button id="accountButton" className="account-button" variant="outline" type="button" aria-expanded={accountOpen} aria-controls="accountPanel" onClick={() => setAccountOpen(prev => !prev)}>
              <span className="status-dot" />
              <span>{isLoggedIn ? currentUser.email : "Ava Chen"}</span>
            </Button>
          </div>
        </header>

        <section className="history-feed" aria-label="生成历史">
          <div className="history-toolbar">
            <div>
              <p className="eyebrow">Creative archive</p>
              <h1>Recent Generations</h1>
            </div>
            <div className="history-tools">
              <Button className="view-button active" variant="secondary" size="icon" type="button" aria-label="网格视图"><Grid2X2 /></Button>
              <Button className="view-button" variant="ghost" size="icon" type="button" aria-label="列表视图"><Menu /></Button>
              <select aria-label="筛选模型">
                <option>All Models</option>
                <option>gpt-image-2</option>
              </select>
            </div>
          </div>
          <div className="filter-tabs" aria-label="历史筛选">
            <button className="active" type="button"><Home />All</button>
            <button type="button"><Folder />Drafts</button>
            <button type="button"><Image />Upscaled</button>
            <button type="button"><Star />Favorites</button>
          </div>
          <div className="history-scroll">
            {historyLoading ? (
              <section className="empty-state is-loading">
                <div className="empty-card">
                  <span className="empty-icon">✦</span>
                  <h2>正在整理创作空间</h2>
                  <p>正在读取当前浏览器里的本地生成记录。</p>
                </div>
              </section>
            ) : null}
            {historyError ? <div className="empty-inline">{historyError}</div> : null}
            {visibleHistory.map(task => (
              <Card key={task.id} className={`history-task${task.id === selectedId ? " selected" : ""}`} data-id={task.id} onClick={() => {
                setSelectedId(task.id);
              }}>
                <CardHeader className="task-head">
                  <div className="task-title-area">
                    <Input type="checkbox" aria-label="选择生成记录" onClick={event => event.stopPropagation()} />
                    <ChevronUp />
                  </div>
                  <div className="task-copy-area">
                    <CardTitle>{getTaskTitle(task.prompt)}</CardTitle>
                    <div className="tag-row">
                      <Badge variant="secondary">{task.model || "gpt-image-2"}</Badge>
                      <Badge variant="secondary">{task.mode === "edit" ? "多图参考" : "图片生成"}</Badge>
                      <Badge variant="outline">{getRatioLabel(task.aspectRatio || "auto")}</Badge>
                      <Badge variant="outline">{task.quality || "medium"}</Badge>
                      <Badge variant="outline">{task.count || task.images.length} 张</Badge>
                      {task.costCredits ? <Badge variant="secondary">{task.costCredits} 点</Badge> : null}
                      {Number.isFinite(task.remainingCreditsSnapshot) ? <Badge variant="secondary">余额 {task.remainingCreditsSnapshot}</Badge> : null}
                      <Badge variant="outline">{formatTime(new Date(task.createdAt))}</Badge>
                    </div>
                  </div>
                  <div className="task-more-actions" onClick={event => event.stopPropagation()}>
                    <Button className="task-action-button" variant="ghost" type="button" title="重新编辑" aria-label="重新编辑" onClick={() => fillFromTask(task)}>
                      <WandSparkles data-icon="inline-start" />
                      <span>重新编辑</span>
                    </Button>
                    <Button className="task-action-button" variant="ghost" type="button" title="再次生成" aria-label="再次生成" onClick={() => generateFromTask(task)}>
                      <RotateCcw data-icon="inline-start" />
                      <span>再次生成</span>
                    </Button>
                    <Button className="task-action-button compact" variant="ghost" type="button" title="复制提示词" aria-label="复制提示词" onClick={() => copyPromptFromTask(task)}>
                      <Copy />
                    </Button>
                    <div className="delete-action-wrap">
                      <Button
                        className="task-delete-button"
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label="删除"
                        aria-expanded={deleteConfirmId === task.id}
                        onClick={() => setDeleteConfirmId(prev => prev === task.id ? null : task.id)}
                      >
                        <Trash2 />
                      </Button>
                      {deleteConfirmId === task.id ? (
                        <div className="delete-confirm-popover" role="dialog" aria-label="确认删除历史记录">
                          <strong>删除这条记录？</strong>
                          <span>会移除该条目的所有图片。</span>
                          <div>
                            <Button variant="ghost" type="button" onClick={() => setDeleteConfirmId(null)}>取消</Button>
                            <Button variant="destructive" type="button" onClick={async () => {
                              await deleteTask(task);
                            }}>删除</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="task-content">
                  {renderReferenceChips(task)}
                  <div className={`image-grid count-${Math.min(task.images.length, 4)}`}>
                    {task.images.slice(0, 4).map(renderImageCard)}
                  </div>
                </CardContent>
              </Card>
            ))}
            {showPreviewRows ? (
              <section className="concept-preview-list" aria-label="示例生成记录">
                {supplementalPreviewRows.map(renderPreviewRow)}
              </section>
            ) : null}
          </div>
        </section>
      </main>

      <section className="composer" aria-label="生成控制">
        <form className={`composer-card${isLoggedIn ? "" : " is-disabled"}`} onSubmit={async event => {
          event.preventDefault();
          await generateNewTask();
        }}>
          {referenceImages.length === 0 ? (
            <label className="upload-tile upload-tile-compact" title="上传参考图">
              <input type="file" accept="image/*" multiple onChange={async event => {
                await addReferenceFiles(event.target.files || []);
                event.target.value = "";
              }} />
              <span aria-hidden="true"><Plus /></span>
            </label>
          ) : (
            <div
              className={`reference-dock${referenceDockExpanded ? " is-expanded" : ""}`}
              aria-label={`已选择 ${referenceImages.length} 张参考图`}
              onMouseLeave={() => setReferenceDockExpanded(false)}
              style={{
                ["--reference-count"]: referenceImages.length,
                ["--reference-expanded-width"]: `${referenceImages.length * 78 + 84}px`
              }}
            >
              <div className="reference-dock-hover-plate" aria-hidden="true" />
              <div className="reference-dock-stack">
                {referenceImages.map((image, index) => (
                  <figure
                    className="reference-dock-card"
                    key={image.id}
                    style={{ ["--reference-index"]: index }}
                    onMouseEnter={() => setReferenceDockExpanded(true)}
                    onFocus={() => setReferenceDockExpanded(true)}
                  >
                    <button
                      className="reference-dock-preview"
                      type="button"
                      aria-label={`放大浏览参考图 ${image.name || index + 1}`}
                      onClick={() => openImagePreview(image.dataUrl)}
                    >
                      <img src={image.dataUrl} alt={image.name} />
                    </button>
                    <button className="reference-dock-remove" type="button" aria-label="移除参考图" onClick={() => removeReference(image.id)}>
                      <X />
                    </button>
                  </figure>
                ))}
                <label className="reference-dock-add reference-dock-add-expanded" title="继续添加参考图">
                  <input type="file" accept="image/*" multiple onChange={async event => {
                    await addReferenceFiles(event.target.files || []);
                    event.target.value = "";
                  }} />
                  <Plus />
                </label>
              </div>
              <label className="reference-dock-add" title="继续添加参考图">
                <input type="file" accept="image/*" multiple onChange={async event => {
                  await addReferenceFiles(event.target.files || []);
                  event.target.value = "";
                }} />
                <Plus />
              </label>
            </div>
          )}

          <div className="prompt-zone">
            <div className="prompt-top">
              <Textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                onPaste={handlePromptPaste}
                rows={3}
                placeholder="请输入你的创意，例如：雨后城市里的未来感产品海报，干净构图，高级广告摄影"
                required
              />
            </div>

            <div className="control-row">
              <div className="ratio-control">
                <Button className="ratio-button" variant="outline" type="button" aria-expanded={ratioOpen} onClick={() => setRatioOpen(prev => !prev)}>
                  <span className={`ratio-icon ${ratioChoices.find(item => item.value === aspectRatio)?.shape || "auto"}`} aria-hidden="true" />
                  <span>{aspectRatio === "auto" ? "智能比例" : aspectRatio}</span>
                  <ChevronUp />
                </Button>
                <div className={`ratio-panel${ratioOpen ? "" : " hidden"}`}>
                  <p>图片比例</p>
                  <div className="ratio-options" aria-label="图片比例">
                    {renderRatioOptions()}
                  </div>
                </div>
              </div>

              <select value={quality} onChange={event => setQuality(event.target.value)} aria-label="图片质量">
                <option value="medium">medium</option>
                <option value="low">low</option>
                <option value="high">high</option>
              </select>

              <label className="count-control">
                <span>数量</span>
                <Input type="number" min="1" step="1" value={count} onChange={event => setCount(event.target.value)} />
              </label>

              <Button className={`soft-button${referenceImages.length === 0 ? " hidden" : ""}`} variant="outline" type="button" onClick={clearReferences}>
                <X data-icon="inline-start" />
                <span>清空参考图</span>
              </Button>
            </div>
          </div>

          <Button className="generate-button" type="submit">
            <Sparkles data-icon="inline-start" />
            <span>{referenceModeActive ? "编辑" : "生成"}</span>
          </Button>
          <label className="advanced-toggle">
            <span>Advanced</span>
            <input type="checkbox" />
          </label>
        </form>
      </section>

      <section id="accountPanel" className={`account-panel${accountOpen ? "" : " hidden"}`} aria-label="账号登录">
        <div className="panel-backdrop" onClick={() => setAccountOpen(false)} />
        <div className="account-popover">
          <div className="account-panel-head">
            <div>
              <p className="eyebrow">账号</p>
              <h2>{isLoggedIn ? "账号与额度" : "邮箱登录"}</h2>
            </div>
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label="关闭" onClick={() => setAccountOpen(false)}><X /></Button>
          </div>

          {isLoggedIn ? (
            <div className="account-panel-body">
              <div className="account-summary">
                <span className="status-dot" />
                <div>
                  <strong>{currentUser.email}</strong>
                  <span>{currentUser.credits} 点</span>
                </div>
              </div>
              <label className="account-control">
                <span>礼品卡</span>
                <Input value={giftKey} onChange={event => setGiftKey(event.target.value)} type="text" autoComplete="off" placeholder="gift_..." />
              </label>
              <div className="panel-actions">
                <Button className="soft-button" variant="secondary" type="button" onClick={redeemGiftCard}>
                  <CreditCard data-icon="inline-start" />
                  <span>兑换</span>
                </Button>
                <Button className="soft-button" variant="outline" type="button" onClick={logout}>
                  <LogOut data-icon="inline-start" />
                  <span>退出</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="account-panel-body">
              <label className="account-control">
                <span>邮箱</span>
                <Input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" />
              </label>
              <label className={`account-control${loginCodeRequested ? "" : " hidden"}`}>
                <span>验证码</span>
                <Input value={code} onChange={event => setCode(event.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 位数字" />
              </label>
              <div className="panel-actions">
                <Button className={`soft-button${loginCodeRequested ? " hidden" : ""}`} variant="secondary" type="button" onClick={sendLoginCode}>
                  <Send data-icon="inline-start" />
                  <span>发送验证码</span>
                </Button>
                <Button className={`soft-button${loginCodeRequested ? "" : " hidden"}`} type="button" onClick={loginWithCode}>
                  <Sparkles data-icon="inline-start" />
                  <span>登录</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={`image-preview${preview.isOpen ? "" : " hidden"}`} aria-label="图片预览" aria-modal="true" role="dialog" onClick={event => {
        if (event.target === event.currentTarget || event.target.closest("[data-close-preview]")) {
          closeImagePreview();
        }
      }}>
        <div className="preview-backdrop" data-close-preview />
        <div className="preview-stage" onClick={handlePreviewStageClick} onWheel={handlePreviewWheel}>
          {preview.src ? (
            <img
              ref={previewImageRef}
              src={preview.src}
              alt="放大的生成结果"
              draggable="false"
              style={{ transform: `translate(${preview.x}px, ${preview.y}px) scale(${preview.scale})` }}
              onPointerDown={event => {
                if (!preview.isOpen) {
                  return;
                }

                event.preventDefault();
                setPreview(prev => ({
                  ...prev,
                  isDragging: true,
                  dragStartX: event.clientX,
                  dragStartY: event.clientY,
                  originX: prev.x,
                  originY: prev.y
                }));
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.classList.add("is-dragging");
              }}
              onPointerMove={event => {
                if (!preview.isDragging) {
                  return;
                }

                setPreview(prev => ({
                  ...prev,
                  x: prev.originX + event.clientX - prev.dragStartX,
                  y: prev.originY + event.clientY - prev.dragStartY
                }));
              }}
              onPointerUp={event => {
                setPreview(prev => ({ ...prev, isDragging: false }));
                event.currentTarget.classList.remove("is-dragging");
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={event => {
                setPreview(prev => ({ ...prev, isDragging: false }));
                event.currentTarget.classList.remove("is-dragging");
              }}
            />
          ) : null}
        </div>
        <div className="preview-toolbar" aria-label="预览控制" onClick={event => event.stopPropagation()}>
          <Button className="preview-tool" variant="secondary" size="icon" type="button" aria-label="缩小" onClick={() => zoomPreview(-0.2)}><ZoomOut /></Button>
          <button className="preview-tool preview-scale" type="button" onClick={resetPreviewZoom}>{previewScaleLabel}</button>
          <Button className="preview-tool" variant="secondary" size="icon" type="button" aria-label="放大" onClick={() => zoomPreview(0.2)}><ZoomIn /></Button>
        </div>
        <Button className="preview-close" variant="secondary" size="icon" type="button" aria-label="关闭预览" onClick={closeImagePreview}><X /></Button>
      </section>

      <div className={`toast${toast ? "" : " hidden"}`} role="status">{toast}</div>
    </div>
  );
}

export default App;
