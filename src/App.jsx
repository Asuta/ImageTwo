import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
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
const GIFT_CARD_SHOP_URL = "https://pay.ldxp.cn/shop/2C8QL88T";
const DEFAULT_LANGUAGE = "zh";
const SUPPORTED_LANGUAGES = ["zh", "en"];

const ratioChoices = [
  { value: "auto", labelKey: "ratio.autoShort", shape: "auto" },
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

const translations = {
  zh: {
    "language.toggle": "English",
    "language.label": "切换语言",
    "nav.main": "主导航",
    "nav.new": "新建生成",
    "nav.home": "首页",
    "nav.creations": "作品",
    "nav.models": "模型",
    "nav.styles": "风格",
    "nav.inspiration": "灵感",
    "nav.assets": "素材",
    "nav.collections": "收藏集",
    "collections.spring": "春季情绪板",
    "collections.brand": "品牌视觉",
    "collections.scifi": "科幻概念",
    "collections.architecture": "建筑",
    "upgrade.title": "升级 Pro",
    "upgrade.copy": "解锁高级模型、更快生成和更多额度。",
    "upgrade.button": "立即升级",
    "topbar.credits": "额度 {count}",
    "topbar.pro": "Pro",
    "topbar.notifications": "通知",
    "theme.toggle": "切换深色模式",
    "theme.light": "浅色模式",
    "theme.dark": "深色模式",
    "history.clear": "清空本地历史",
    "history.clearTitle": "清空本地历史？",
    "history.clearDescription": "此操作会删除当前浏览器中保存的全部生成历史和图片记录。清空之后不可恢复，请确认是否继续。",
    "common.cancel": "取消",
    "common.delete": "删除",
    "common.close": "关闭",
    "placeholder.title": "功能暂未开放",
    "placeholder.description": "这个按钮功能还没做呢，只是个摆设",
    "placeholder.confirm": "知道了",
    "history.confirmClear": "确认清空",
    "history.section": "生成历史",
    "history.eyebrow": "创作档案",
    "history.title": "最近生成",
    "history.gridView": "网格视图",
    "history.listView": "列表视图",
    "history.modelFilter": "筛选模型",
    "history.allModels": "全部模型",
    "history.filters": "历史筛选",
    "history.all": "全部",
    "history.drafts": "草稿",
    "history.upscaled": "放大",
    "history.favorites": "收藏",
    "history.loadingTitle": "正在整理创作空间",
    "history.loadingCopy": "正在读取当前浏览器里的本地生成记录。",
    "history.select": "选择生成记录",
    "history.selectExample": "选择示例生成记录",
    "history.editMode": "多图参考",
    "history.generateMode": "图片生成",
    "history.count": "{count} 张",
    "history.points": "{count} 点",
    "history.balance": "余额 {count}",
    "history.reedit": "重新编辑",
    "history.regenerate": "再次生成",
    "history.copyPrompt": "复制提示词",
    "history.delete": "删除",
    "history.deleteDialog": "确认删除历史记录",
    "history.deleteTitle": "删除这条记录？",
    "history.deleteCopy": "会移除该条目的所有图片。",
    "history.examples": "示例生成记录",
    "references.title": "参考图 ({count})",
    "references.none": "无参考图",
    "references.blockTitle": "{count} 张参考图",
    "references.alt": "参考图",
    "references.exampleAlt": "示例参考图",
    "references.exampleGeneratedAlt": "示例生成图",
    "references.saved": "已保存到本地",
    "references.preview": "预览",
    "preview.favoriteExample": "收藏示例",
    "preview.shareExample": "分享示例",
    "preview.moreExample": "更多示例",
    "generation.loading": "生成中...",
    "generation.receiving": "接收中...",
    "generation.receivingImage": "正在接收图片...",
    "generation.generatingImage": "正在生成...",
    "generation.failed": "生成失败",
    "generation.retry": "请稍后重试",
    "generation.savedLocal": "已保存在当前浏览器本地",
    "generation.previewResult": "放大预览生成结果",
    "generation.loadingAlt": "正在加载的生成结果",
    "generation.resultAlt": "生成结果",
    "generation.statusGenerating": "图片生成中",
    "generation.scrollImages": "左右滚动查看生成图片",
    "composer.section": "生成控制",
    "composer.uploadReference": "上传参考图",
    "composer.selectedReferences": "已选择 {count} 张参考图",
    "composer.collapseReferences": "收起参考图列表",
    "composer.expandReferences": "展开 {count} 张参考图",
    "composer.previewReference": "放大浏览参考图 {name}",
    "composer.removeReference": "移除参考图",
    "composer.addReference": "继续添加参考图",
    "composer.placeholder": "请输入你的创意，例如：雨后城市里的未来感产品海报，干净构图，高级广告摄影",
    "composer.clearReferences": "清空参考图",
    "composer.edit": "编辑",
    "composer.generate": "生成",
    "composer.advanced": "高级",
    "ratio.autoShort": "智能",
    "ratio.auto": "智能比例",
    "ratio.label": "图片比例",
    "quality.label": "图片质量",
    "count.label": "数量",
    "count.decrease": "减少生成数量",
    "count.increase": "增加生成数量",
    "account.section": "账号登录",
    "account.eyebrow": "账号",
    "account.titleLoggedIn": "账号与额度",
    "account.titleLoggedOut": "邮箱登录",
    "account.buyCode": "购买兑换码",
    "account.giftCard": "礼品卡",
    "account.redeem": "兑换",
    "account.logout": "退出",
    "account.email": "邮箱",
    "account.code": "验证码",
    "account.codePlaceholder": "6 位数字",
    "account.sendCode": "发送验证码",
    "account.login": "登录",
    "imagePreview.section": "图片预览",
    "imagePreview.alt": "放大的生成结果",
    "imagePreview.controls": "预览控制",
    "imagePreview.previous": "上一张",
    "imagePreview.next": "下一张",
    "imagePreview.zoomOut": "缩小",
    "imagePreview.zoomIn": "放大",
    "toast.scriptError": "页面脚本错误：{message}",
    "toast.asyncError": "页面异步错误：{message}",
    "toast.unknownError": "未知错误",
    "toast.historyUnavailable": "本地历史暂不可用，已进入空白创作状态",
    "toast.historyCleared": "已清空当前浏览器的本地历史",
    "toast.emailRequired": "请先输入邮箱",
    "toast.codeSendFailed": "验证码发送失败。",
    "toast.devCode": "开发验证码：{code}",
    "toast.codeSent": "验证码已发送，请检查邮箱",
    "toast.emailCodeRequired": "请输入邮箱和验证码",
    "toast.loginFailed": "登录失败。",
    "toast.loginSuccess": "登录成功",
    "toast.loggedOut": "已退出登录",
    "toast.giftRequired": "请输入礼品卡 Key",
    "toast.redeemFailed": "兑换失败。",
    "toast.redeemed": "已兑换 {added} 点，当前余额 {credits} 点",
    "toast.uploadImage": "请上传图片文件",
    "toast.pastedReferences": "已粘贴 {count} 张参考图",
    "toast.loginForGenerate": "请先登录后再生成",
    "toast.promptRequired": "请先输入提示词",
    "toast.historyStillGenerating": "本地历史暂时不可用，仍会继续生成",
    "toast.submitted": "已提交生成请求",
    "toast.referenceExpired": "刷新后参考图原始数据已失效，请重新上传",
    "toast.submittedFromHistory": "已按该历史记录再次提交生成",
    "toast.reused": "已复用提示词和参数",
    "toast.deleted": "已删除本地历史记录",
    "toast.promptCopied": "提示词已复制",
    "toast.someFailed": "{failed} 张生成失败，{generated} 张已保存到本地",
    "toast.savedImages": "{count} 张图片已保存到当前浏览器",
    "error.interrupted": "这次生成没有保存到浏览器本地，请重新生成。",
    "error.historyDbTimeout": "本地历史数据库响应超时",
    "error.historyReadTimeout": "本地历史读取超时",
    "error.historyTransactionTimeout": "本地历史事务超时",
    "error.loginRequired": "请先使用邮箱验证码登录。",
    "error.generateFailed": "生成失败。",
    "error.missingRequestId": "生成任务没有返回 requestId。",
    "error.generateTimeout": "生成超时，请稍后重试。"
  },
  en: {
    "language.toggle": "中文",
    "language.label": "Switch language",
    "nav.main": "Main navigation",
    "nav.new": "New Generation",
    "nav.home": "Home",
    "nav.creations": "Creations",
    "nav.models": "Models",
    "nav.styles": "Styles",
    "nav.inspiration": "Inspiration",
    "nav.assets": "Assets",
    "nav.collections": "Collections",
    "collections.spring": "Moodboard - Spring",
    "collections.brand": "Brand Visuals",
    "collections.scifi": "Concept - Sci-Fi",
    "collections.architecture": "Architecture",
    "upgrade.title": "Upgrade to Pro",
    "upgrade.copy": "Unlock premium models, faster generation, and more credits.",
    "upgrade.button": "Upgrade Now",
    "topbar.credits": "Credits {count}",
    "topbar.pro": "Pro",
    "topbar.notifications": "Notifications",
    "theme.toggle": "Toggle dark mode",
    "theme.light": "Light mode",
    "theme.dark": "Dark mode",
    "history.clear": "Clear local history",
    "history.clearTitle": "Clear local history?",
    "history.clearDescription": "This will delete all generation history and image records saved in this browser. This cannot be undone.",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.close": "Close",
    "placeholder.title": "Feature not available yet",
    "placeholder.description": "This button does not do anything yet. It is just a placeholder.",
    "placeholder.confirm": "Got it",
    "history.confirmClear": "Clear",
    "history.section": "Generation history",
    "history.eyebrow": "Creative archive",
    "history.title": "Recent Generations",
    "history.gridView": "Grid view",
    "history.listView": "List view",
    "history.modelFilter": "Filter models",
    "history.allModels": "All Models",
    "history.filters": "History filters",
    "history.all": "All",
    "history.drafts": "Drafts",
    "history.upscaled": "Upscaled",
    "history.favorites": "Favorites",
    "history.loadingTitle": "Preparing your creative space",
    "history.loadingCopy": "Reading local generation records from this browser.",
    "history.select": "Select generation record",
    "history.selectExample": "Select example generation record",
    "history.editMode": "Reference edit",
    "history.generateMode": "Image generation",
    "history.count": "{count} images",
    "history.points": "{count} credits",
    "history.balance": "Balance {count}",
    "history.reedit": "Edit again",
    "history.regenerate": "Generate again",
    "history.copyPrompt": "Copy prompt",
    "history.delete": "Delete",
    "history.deleteDialog": "Confirm history deletion",
    "history.deleteTitle": "Delete this record?",
    "history.deleteCopy": "All images in this item will be removed.",
    "history.examples": "Example generation records",
    "references.title": "References ({count})",
    "references.none": "No refs",
    "references.blockTitle": "{count} reference images",
    "references.alt": "Reference image",
    "references.exampleAlt": "Example reference image",
    "references.exampleGeneratedAlt": "Example generated image",
    "references.saved": "Saved locally",
    "references.preview": "Preview",
    "preview.favoriteExample": "Favorite example",
    "preview.shareExample": "Share example",
    "preview.moreExample": "More example actions",
    "generation.loading": "Generating...",
    "generation.receiving": "Receiving...",
    "generation.receivingImage": "Receiving image...",
    "generation.generatingImage": "Generating...",
    "generation.failed": "Generation failed",
    "generation.retry": "Please try again later",
    "generation.savedLocal": "Saved locally in this browser",
    "generation.previewResult": "Open generated image preview",
    "generation.loadingAlt": "Loading generated result",
    "generation.resultAlt": "Generated result",
    "generation.statusGenerating": "Image generation in progress",
    "generation.scrollImages": "Scroll horizontally through generated images",
    "composer.section": "Generation controls",
    "composer.uploadReference": "Upload reference image",
    "composer.selectedReferences": "{count} reference images selected",
    "composer.collapseReferences": "Collapse reference list",
    "composer.expandReferences": "Expand {count} reference images",
    "composer.previewReference": "Preview reference image {name}",
    "composer.removeReference": "Remove reference image",
    "composer.addReference": "Add more reference images",
    "composer.placeholder": "Describe your idea, for example: a futuristic product poster in a rain-washed city, clean composition, premium advertising photography",
    "composer.clearReferences": "Clear references",
    "composer.edit": "Edit",
    "composer.generate": "Generate",
    "composer.advanced": "Advanced",
    "ratio.autoShort": "Auto",
    "ratio.auto": "Auto ratio",
    "ratio.label": "Aspect ratio",
    "quality.label": "Image quality",
    "count.label": "Count",
    "count.decrease": "Decrease generation count",
    "count.increase": "Increase generation count",
    "account.section": "Account login",
    "account.eyebrow": "Account",
    "account.titleLoggedIn": "Account and credits",
    "account.titleLoggedOut": "Email login",
    "account.buyCode": "Buy redeem code",
    "account.giftCard": "Gift card",
    "account.redeem": "Redeem",
    "account.logout": "Log out",
    "account.email": "Email",
    "account.code": "Code",
    "account.codePlaceholder": "6 digits",
    "account.sendCode": "Send code",
    "account.login": "Log in",
    "imagePreview.section": "Image preview",
    "imagePreview.alt": "Enlarged generated result",
    "imagePreview.controls": "Preview controls",
    "imagePreview.previous": "Previous image",
    "imagePreview.next": "Next image",
    "imagePreview.zoomOut": "Zoom out",
    "imagePreview.zoomIn": "Zoom in",
    "toast.scriptError": "Page script error: {message}",
    "toast.asyncError": "Page async error: {message}",
    "toast.unknownError": "Unknown error",
    "toast.historyUnavailable": "Local history is unavailable. Starting with a blank workspace.",
    "toast.historyCleared": "Local history has been cleared in this browser",
    "toast.emailRequired": "Enter your email first",
    "toast.codeSendFailed": "Failed to send verification code.",
    "toast.devCode": "Development code: {code}",
    "toast.codeSent": "Code sent. Check your email.",
    "toast.emailCodeRequired": "Enter your email and verification code",
    "toast.loginFailed": "Login failed.",
    "toast.loginSuccess": "Logged in",
    "toast.loggedOut": "Logged out",
    "toast.giftRequired": "Enter a gift card key",
    "toast.redeemFailed": "Redeem failed.",
    "toast.redeemed": "Redeemed {added} credits. Current balance: {credits}",
    "toast.uploadImage": "Upload an image file",
    "toast.pastedReferences": "Pasted {count} reference images",
    "toast.loginForGenerate": "Log in before generating",
    "toast.promptRequired": "Enter a prompt first",
    "toast.historyStillGenerating": "Local history is unavailable, but generation will continue",
    "toast.submitted": "Generation request submitted",
    "toast.referenceExpired": "Original reference data expired after refresh. Please upload it again.",
    "toast.submittedFromHistory": "Generation submitted from this history record",
    "toast.reused": "Prompt and settings reused",
    "toast.deleted": "Local history record deleted",
    "toast.promptCopied": "Prompt copied",
    "toast.someFailed": "{failed} failed, {generated} saved locally",
    "toast.savedImages": "{count} images saved in this browser",
    "error.interrupted": "This generation was not saved locally. Please generate again.",
    "error.historyDbTimeout": "Local history database timed out",
    "error.historyReadTimeout": "Local history read timed out",
    "error.historyTransactionTimeout": "Local history transaction timed out",
    "error.loginRequired": "Please log in with an email verification code first.",
    "error.generateFailed": "Generation failed.",
    "error.missingRequestId": "Generation did not return a requestId.",
    "error.generateTimeout": "Generation timed out. Please try again later."
  }
};

function formatMessage(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function getStoredLanguage() {
  const storedLanguage = localStorage.getItem("image2-language");
  return SUPPORTED_LANGUAGES.includes(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
}

function saveLanguagePreference(language) {
  localStorage.setItem("image2-language", language);
}

function GeneratedImageGrid({ task, renderImageCard, scrollLabel }) {
  const gridRef = useRef(null);
  const scrollbarTrackRef = useRef(null);
  const [scrollState, setScrollState] = useState({ max: 0, value: 0, scrollWidth: 0, clientWidth: 0 });

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return undefined;
    }

    const updateScrollState = () => {
      const max = Math.max(0, grid.scrollWidth - grid.clientWidth);
      setScrollState({
        max,
        value: Math.min(grid.scrollLeft, max),
        scrollWidth: grid.scrollWidth,
        clientWidth: grid.clientWidth
      });
    };

    updateScrollState();
    grid.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(grid);
    Array.from(grid.children).forEach(child => resizeObserver?.observe(child));

    return () => {
      grid.removeEventListener("scroll", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [task.images]);

  const scrollGridToTrackPosition = clientX => {
    const grid = gridRef.current;
    const track = scrollbarTrackRef.current;
    if (!grid || !track) {
      return;
    }

    const max = Math.max(0, grid.scrollWidth - grid.clientWidth);
    if (max <= 0) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const nextValue = ratio * max;
    grid.scrollLeft = nextValue;
    setScrollState(prev => ({
      ...prev,
      max,
      value: nextValue,
      scrollWidth: grid.scrollWidth,
      clientWidth: grid.clientWidth
    }));
  };

  const handleScrollbarPointerDown = event => {
    event.preventDefault();
    scrollGridToTrackPosition(event.clientX);

    const handlePointerMove = moveEvent => {
      scrollGridToTrackPosition(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  };

  const handleScrollbarMouseDown = event => {
    event.preventDefault();
    scrollGridToTrackPosition(event.clientX);
  };

  const handleScrollbarKeyDown = event => {
    if (!["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const step = event.key === "PageUp" || event.key === "PageDown"
      ? grid.clientWidth * 0.8
      : 80;
    const nextValue = event.key === "Home"
      ? 0
      : event.key === "End"
        ? scrollState.max
        : event.key === "ArrowLeft" || event.key === "PageUp"
          ? Math.max(0, grid.scrollLeft - step)
          : Math.min(scrollState.max, grid.scrollLeft + step);

    grid.scrollLeft = nextValue;
    setScrollState(prev => ({ ...prev, value: nextValue }));
  };

  const gridClassName = `image-grid count-${Math.min(task.images.length, 4)}${
    task.images.length > 4 ? " is-overflowing" : ""
  }`;
  const showScrollbar = scrollState.max > 1 || task.images.length > 4;
  const thumbWidthPercent = scrollState.scrollWidth > 0
    ? Math.min(100, Math.max(16, (scrollState.clientWidth / scrollState.scrollWidth) * 100))
    : 100;
  const thumbLeftPercent = scrollState.max > 0
    ? (scrollState.value / scrollState.max) * (100 - thumbWidthPercent)
    : 0;

  return (
    <div className="image-grid-scroll-wrap">
      <div ref={gridRef} className={gridClassName}>
        {task.images.map(image => renderImageCard(image, task))}
      </div>
      {showScrollbar ? (
        <div
          ref={scrollbarTrackRef}
          className="image-grid-scrollbar"
          role="scrollbar"
          tabIndex={0}
          aria-label={scrollLabel}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={Math.round(scrollState.max)}
          aria-valuenow={Math.round(scrollState.value)}
          onPointerDown={handleScrollbarPointerDown}
          onMouseDown={handleScrollbarMouseDown}
          onClick={handleScrollbarMouseDown}
          onKeyDown={handleScrollbarKeyDown}
        >
          <span
            className="image-grid-scrollbar-thumb"
            style={{
              width: `${thumbWidthPercent}%`,
              left: `${thumbLeftPercent}%`
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

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

function formatTime(date = new Date(), language = DEFAULT_LANGUAGE) {
  return date.toLocaleTimeString(language === "en" ? "en-US" : "zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function getCountValue(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : 1;
}

function getRatioLabel(value, t) {
  return value === "auto" ? t("ratio.auto") : value;
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

function createInterruptedImages(count, errorMessage) {
  return Array.from({ length: Math.max(1, Number(count) || 1) }, () => ({
    id: createLocalId(),
    status: "error",
    error: errorMessage,
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
  const [language, setLanguage] = useState(getStoredLanguage());
  const [toast, setToast] = useState("");
  const [preview, setPreview] = useState({
    isOpen: false,
    src: "",
    items: [],
    index: 0,
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
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
  const [placeholderFeature, setPlaceholderFeature] = useState("");
  const historyRef = useRef([]);
  const previewImageRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onError = event => {
      showToast(t("toast.scriptError", { message: event.message || t("toast.unknownError") }));
    };
    const onRejection = event => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || t("toast.unknownError"));
      showToast(t("toast.asyncError", { message: reason }));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [language]);

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
        return;
      }

      if (!preview.isOpen || preview.items.length < 2) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigatePreview(-1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigatePreview(1);
      }
    };

    const onClick = event => {
      if (!event.target.closest(".ratio-control")) {
        setRatioOpen(false);
      }
      if (!event.target.closest(".account-popover") && !event.target.closest("[data-account-trigger]")) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, [preview.isOpen, preview.items.length]);

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
  const t = (key, values) => formatMessage(translations[language]?.[key] || translations[DEFAULT_LANGUAGE][key] || key, values);
  const visibleHistory = useMemo(() => history, [history]);
  const showPreviewRows = !historyLoading && history.length < previewRows.length;
  const supplementalPreviewRows = useMemo(() => (
    showPreviewRows ? previewRows.slice(0, previewRows.length - history.length) : []
  ), [showPreviewRows, history.length]);

  function promptLoginBeforeGeneration() {
    showToast(t("toast.loginForGenerate"));
    setAccountOpen(true);
  }

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  }, [language]);

  function toggleLanguage() {
    setLanguage(prev => {
      const nextLanguage = prev === "zh" ? "en" : "zh";
      saveLanguagePreference(nextLanguage);
      return nextLanguage;
    });
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const db = await withTimeout(openHistoryDb(), HISTORY_LOAD_TIMEOUT_MS, t("error.historyDbTimeout"));
      const transaction = db.transaction(["tasks", "images"], "readonly");
      const done = transactionDone(transaction);
      const [tasks, images] = await withTimeout(Promise.all([
        storeRequest(transaction.objectStore("tasks"), "getAll"),
        storeRequest(transaction.objectStore("images"), "getAll")
      ]), HISTORY_LOAD_TIMEOUT_MS, t("error.historyReadTimeout"));
      const imagesByTask = new Map();

      images.forEach(image => {
        const url = image.blob ? URL.createObjectURL(image.blob) : "";
        const imageRecord = { ...image, url };
        imagesByTask.set(image.taskId, [...(imagesByTask.get(image.taskId) || []), imageRecord]);
      });

      await withTimeout(done, HISTORY_LOAD_TIMEOUT_MS, t("error.historyTransactionTimeout"));

      const loadedHistory = tasks
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(task => ({
          ...task,
          images: (imagesByTask.get(task.id) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }));

      setHistory(loadedHistory.map(task => (
        task.images.length > 0 ? task : { ...task, images: createInterruptedImages(task.count, t("error.interrupted")) }
      )));
      setSelectedId(prev => prev || loadedHistory[0]?.id || null);
    } catch (error) {
      console.error(error);
      setHistory([]);
      setSelectedId(null);
      setHistoryError("");
      showToast(t("toast.historyUnavailable"));
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
    showToast(t("toast.historyCleared"));
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
      showToast(t("toast.emailRequired"));
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
        throw new Error(payload.detail || payload.error || t("toast.codeSendFailed"));
      }

      setLoginCodeRequested(true);
      if (payload.devCode) {
        setCode(payload.devCode);
      }
      showToast(payload.devCode ? t("toast.devCode", { code: payload.devCode }) : t("toast.codeSent"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  async function loginWithCode() {
    const nextEmail = email.trim();
    const nextCode = code.trim();
    if (!nextEmail || !nextCode) {
      showToast(t("toast.emailCodeRequired"));
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
        throw new Error(payload.detail || payload.error || t("toast.loginFailed"));
      }

      setCode("");
      setLoginCodeRequested(false);
      setCurrentUser(payload.user);
      setAccountOpen(false);
      showToast(t("toast.loginSuccess"));
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
    showToast(t("toast.loggedOut"));
  }

  async function redeemGiftCard() {
    const key = giftKey.trim();
    if (!key) {
      showToast(t("toast.giftRequired"));
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
        throw new Error(payload.detail || payload.error || t("toast.redeemFailed"));
      }

      setGiftKey("");
      setCurrentUser(payload.user);
      showToast(t("toast.redeemed", { added: payload.creditsAdded, credits: payload.user.credits }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  }

  function showToast(message) {
    setToast(message);
  }

  function showPlaceholderDialog(feature) {
    setPlaceholderFeature(feature);
    setPlaceholderDialogOpen(true);
    setAccountOpen(false);
    setRatioOpen(false);
    setDeleteConfirmId(null);
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
      showToast(t("toast.uploadImage"));
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
    showToast(t("toast.pastedReferences", { count: imageFiles.length }));
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

  function isPortraitPhoneViewport() {
    return window.matchMedia?.("(max-width: 720px) and (orientation: portrait)").matches;
  }

  function handleReferencePreview(image) {
    if (isPortraitPhoneViewport() && !referenceDockExpanded) {
      setReferenceDockExpanded(true);
      return;
    }

    const index = referenceImages.findIndex(item => item.id === image.id);
    openImagePreview(image.dataUrl, {
      items: referenceImages.map(item => item.dataUrl),
      index: Math.max(0, index)
    });
  }

  function stepCount(delta) {
    setCount(prev => String(Math.max(1, getCountValue(prev) + delta)));
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
        <span>{choice.labelKey ? t(choice.labelKey) : choice.label}</span>
      </button>
    ));
  }

  async function requestImage(task, imageId) {
    try {
      if (!currentUser) {
        throw new Error(t("error.loginRequired"));
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientTaskId: task.id,
          clientImageId: imageId,
          prompt: task.prompt,
          aspectRatio: task.aspectRatio || "auto",
          quality: task.quality || "medium",
          mode: task.mode,
          referenceImages: task.referenceImages || []
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || t("error.generateFailed"));
      }

      const result = payload.status === "pending"
        ? await pollGenerationResult(payload.requestId, task.id, imageId)
        : payload;

      if (result.status !== "succeeded" && result.status !== "completed") {
        throw new Error(result.detail || result.error || t("error.generateFailed"));
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
      throw new Error(t("error.missingRequestId"));
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
        throw new Error(payload.detail || payload.error || t("error.generateFailed"));
      }
    }

    throw new Error(t("error.generateTimeout"));
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
      showToast(t("toast.someFailed", { failed: failedCount, generated: generatedCount }));
    } else {
      showToast(t("toast.savedImages", { count: generatedCount }));
    }
  }

  async function generateNewTask() {
    if (!currentUser) {
      promptLoginBeforeGeneration();
      return;
    }

    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      showToast(t("toast.promptRequired"));
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
      showToast(t("toast.historyStillGenerating"));
    });
    setPrompt("");
    showToast(t("toast.submitted"));
    runTaskImages(task, task.images).catch(error => {
      console.error(error);
      showToast(error instanceof Error ? error.message : String(error));
    });
  }

  async function generateFromTask(task) {
    if (!currentUser) {
      promptLoginBeforeGeneration();
      return;
    }

    if (task.mode === "edit" && (!task.referenceImages || task.referenceImages.length === 0)) {
      showToast(t("toast.referenceExpired"));
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
      showToast(t("toast.historyStillGenerating"));
    });
    showToast(t("toast.submittedFromHistory"));
    runTaskImages(nextTask, nextTask.images).catch(error => {
      console.error(error);
      showToast(error instanceof Error ? error.message : String(error));
    });
  }

  function fillFromTask(task) {
    if (task.mode === "edit" && (!task.referenceImages || task.referenceImages.length === 0)) {
      showToast(t("toast.referenceExpired"));
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
    showToast(t("toast.reused"));
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
    showToast(t("toast.deleted"));
  }

  async function copyPromptFromTask(task) {
    setDeleteConfirmId(null);
    await navigator.clipboard.writeText(task.prompt);
    showToast(t("toast.promptCopied"));
  }

  function getPreviewImageSources(images = []) {
    return images
      .map(image => typeof image === "string" ? image : image?.url)
      .filter(Boolean);
  }

  function resetPreviewView(nextPreview) {
    setPreviewScaleLabel("100%");
    return {
      ...nextPreview,
      scale: 1,
      x: 0,
      y: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      originX: 0,
      originY: 0
    };
  }

  function openImagePreview(src, options = {}) {
    if (!src) {
      return;
    }

    const items = getPreviewImageSources(options.items);
    const galleryItems = items.length > 0 ? items : [src];
    const matchedIndex = galleryItems.findIndex(item => item === src);
    const index = Number.isInteger(options.index) ? options.index : matchedIndex;
    const normalizedIndex = Math.min(Math.max(index >= 0 ? index : 0, 0), galleryItems.length - 1);

    setPreview(resetPreviewView({
      isOpen: true,
      src: galleryItems[normalizedIndex],
      items: galleryItems,
      index: normalizedIndex
    }));
  }

  function closeImagePreview() {
    setPreview(prev => resetPreviewView({ ...prev, isOpen: false, src: "", items: [], index: 0 }));
    setPreviewScaleLabel("100%");
  }

  function navigatePreview(direction) {
    setPreview(prev => {
      if (!prev.items.length) {
        return prev;
      }

      const nextIndex = (prev.index + direction + prev.items.length) % prev.items.length;
      return resetPreviewView({
        ...prev,
        src: prev.items[nextIndex],
        index: nextIndex
      });
    });
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
      <div className="task-reference-block" title={t("references.blockTitle", { count: thumbs.length })}>
        <p>{t("references.title", { count: thumbs.length })}</p>
        <div className="reference-chip-stack">
          {thumbs.length > 0 ? thumbs.slice(0, 4).map((src, index) => (
            <img key={`${task.id}-${index}`} className="reference-chip" src={src} alt={t("references.alt")} />
          )) : (
            <span className="reference-empty">{t("references.none")}</span>
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
            <Input type="checkbox" aria-label={t("history.selectExample")} readOnly />
            <ChevronUp />
          </div>
          <div className="task-copy-area">
            <CardTitle>{row.title}</CardTitle>
            <div className="tag-row">
              <Badge variant="secondary">Flux Pro</Badge>
              <Badge variant="outline">{row.ratio}</Badge>
              <Badge variant="outline">{language === "en" ? "High Quality" : "高质量"}</Badge>
              <Badge variant="outline">{row.time}</Badge>
            </div>
          </div>
          <div className="task-more-actions">
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label={t("preview.favoriteExample")} onClick={() => showPlaceholderDialog(t("preview.favoriteExample"))}><Star /></Button>
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label={t("preview.shareExample")} onClick={() => showPlaceholderDialog(t("preview.shareExample"))}><Share2 /></Button>
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label={t("preview.moreExample")} onClick={() => showPlaceholderDialog(t("preview.moreExample"))}><Menu /></Button>
          </div>
        </CardHeader>

        <CardContent className="task-content">
          <div className="task-reference-block">
            <p>{t("references.title", { count: refs.length })}</p>
            <div className="reference-chip-stack">
              {refs.map((src, index) => (
                <img key={`${row.title}-ref-${index}`} className={`reference-sample ${row.theme}`} src={src} alt={t("references.exampleAlt")} />
              ))}
            </div>
          </div>
          <div className={`image-grid concept-grid count-${Math.min(images.length, 4)}`}>
            {images.map((src, index) => (
              <figure key={`${row.title}-image-${index}`} className={`image-card concept-image ${row.theme}${row.loading && index === 0 ? " concept-loading-image" : ""}`}>
                <button
                  className="image-preview-trigger"
                  type="button"
                  aria-label={t("generation.previewResult")}
                  onClick={() => openImagePreview(src, { items: images, index })}
                  disabled={row.loading}
                >
                  <img src={src} alt={t("references.exampleGeneratedAlt")} />
                </button>
                {row.loading && index === 0 ? (
                  <div className="concept-progress">
                    <span className="aurora-flow aurora-flow-a" aria-hidden="true" />
                    <span className="aurora-flow aurora-flow-b" aria-hidden="true" />
                    <span className="aurora-flow aurora-flow-c" aria-hidden="true" />
                    <span className="gradient-status">{t("generation.loading")}</span>
                  </div>
                ) : null}
                {!row.loading && rowIndex === 0 && index === images.length - 1 ? <div className="concept-more">+2</div> : null}
                <figcaption>{rowIndex === 0 ? t("references.saved") : t("references.preview")}</figcaption>
              </figure>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderImageCard(image, task) {
    const imageStyle = {
      "--history-image-scale": HISTORY_IMAGE_SCALE / 100
    };
    const failureReason = String(image.error || "").trim();
    const hasFailureReason = failureReason && !/^生成失败[。.]?$/.test(failureReason);

    if (image.status === "streaming" && image.url) {
      return (
        <figure key={image.id} className="image-card generated-image-card is-streaming">
          <button className="image-preview-trigger" type="button" onClick={() => openImagePreview(image.url, { items: task.images, index: task.images.findIndex(item => item.id === image.id) })} aria-label={t("generation.previewResult")}>
            <img src={image.url} alt={t("generation.loadingAlt")} style={imageStyle} />
          </button>
          <figcaption>{t("generation.receivingImage")}</figcaption>
        </figure>
      );
    }

    if (image.status === "loading" || image.status === "streaming") {
      return (
        <figure key={image.id} className="image-card is-loading concept-image concept-loading-image">
          <div className="image-skeleton" role="status" aria-label={t("generation.statusGenerating")}>
            <div className="concept-progress">
              <span className="aurora-flow aurora-flow-a" aria-hidden="true" />
              <span className="aurora-flow aurora-flow-b" aria-hidden="true" />
              <span className="aurora-flow aurora-flow-c" aria-hidden="true" />
              <span className="gradient-status">{image.status === "streaming" ? t("generation.receiving") : t("generation.loading")}</span>
            </div>
          </div>
          <figcaption>{image.status === "streaming" ? t("generation.receivingImage") : t("generation.generatingImage")}</figcaption>
        </figure>
      );
    }

    if (image.status === "error") {
      return (
        <figure key={image.id} className="image-card is-error">
          <div className="image-error">
            <strong>{t("generation.failed")}</strong>
            {hasFailureReason ? <span>{failureReason}</span> : null}
          </div>
          <figcaption>{hasFailureReason ? failureReason : t("generation.retry")}</figcaption>
        </figure>
      );
    }

    return (
      <figure key={image.id} className="image-card generated-image-card is-ratio-fit">
        <button className="image-preview-trigger" type="button" onClick={() => openImagePreview(image.url, { items: task.images, index: task.images.findIndex(item => item.id === image.id) })} aria-label={t("generation.previewResult")}>
          <img src={image.url} alt={t("generation.resultAlt")} style={imageStyle} />
        </button>
        <figcaption>{t("generation.savedLocal")}</figcaption>
      </figure>
    );
  }

  function handleHistoryTaskScrollbarPointerDown(event) {
    const track = event.currentTarget.querySelector(".image-grid-scrollbar");
    const grid = event.currentTarget.querySelector(".image-grid");
    if (!track || !grid) {
      return;
    }

    const trackRect = track.getBoundingClientRect();
    const isInsideTrack = event.clientX >= trackRect.left
      && event.clientX <= trackRect.right
      && event.clientY >= trackRect.top
      && event.clientY <= trackRect.bottom;
    if (!isInsideTrack) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const moveGrid = clientX => {
      const max = Math.max(0, grid.scrollWidth - grid.clientWidth);
      if (max <= 0) {
        return;
      }

      const ratio = Math.min(1, Math.max(0, (clientX - trackRect.left) / trackRect.width));
      grid.scrollLeft = ratio * max;
    };

    moveGrid(event.clientX);

    const handlePointerMove = moveEvent => {
      moveGrid(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  const referenceModeActive = syncReferenceModeState();

  return (
    <div className="studio-shell">
      <aside className="sidebar" aria-label={t("nav.main")}>
        <div className="logo">
          <span className="logo-mark"><Sparkles /></span>
          <span>Image2 Studio</span>
        </div>

        <Button className="new-generation-button" type="button" onClick={() => {
          setSelectedId(null);
          setPrompt("");
        }}>
          <Plus data-icon="inline-start" />
          {t("nav.new")}
        </Button>

        <nav className="nav-stack">
          <button className="nav-item active" type="button" title={t("nav.home")} onClick={() => showPlaceholderDialog(t("nav.home"))}>
            <span aria-hidden="true"><Home /></span>
            <span>{t("nav.home")}</span>
          </button>
          <button className="nav-item" type="button" title={t("nav.creations")} onClick={() => showPlaceholderDialog(t("nav.creations"))}>
            <span aria-hidden="true"><WandSparkles /></span>
            <span>{t("nav.creations")}</span>
          </button>
          <button className="nav-item" type="button" title={t("nav.models")} onClick={() => showPlaceholderDialog(t("nav.models"))}>
            <span aria-hidden="true"><Image /></span>
            <span>{t("nav.models")}</span>
          </button>
          <button className="nav-item" type="button" title={t("nav.styles")} onClick={() => showPlaceholderDialog(t("nav.styles"))}>
            <span aria-hidden="true"><Settings2 /></span>
            <span>{t("nav.styles")}</span>
          </button>
          <button className="nav-item" type="button" title={t("nav.inspiration")} onClick={() => showPlaceholderDialog(t("nav.inspiration"))}>
            <span aria-hidden="true"><History /></span>
            <span>{t("nav.inspiration")}</span>
          </button>
          <button className="nav-item" type="button" title={t("nav.assets")} onClick={() => showPlaceholderDialog(t("nav.assets"))}>
            <span aria-hidden="true"><Folder /></span>
            <span>{t("nav.assets")}</span>
          </button>
        </nav>

        <div className="collection-stack">
          <div className="collection-head">
            <span>{t("nav.collections")}</span>
            <Plus />
          </div>
          <button type="button" onClick={() => showPlaceholderDialog(t("collections.spring"))}><span>{t("collections.spring")}</span><em>24</em></button>
          <button type="button" onClick={() => showPlaceholderDialog(t("collections.brand"))}><span>{t("collections.brand")}</span><em>18</em></button>
          <button type="button" onClick={() => showPlaceholderDialog(t("collections.scifi"))}><span>{t("collections.scifi")}</span><em>32</em></button>
          <button type="button" onClick={() => showPlaceholderDialog(t("collections.architecture"))}><span>{t("collections.architecture")}</span><em>27</em></button>
        </div>

        <div className="nav-footer">
          <div className="upgrade-card">
            <Sparkles />
            <strong>{t("upgrade.title")}</strong>
            <span>{t("upgrade.copy")}</span>
            <Button type="button" size="sm" onClick={() => showPlaceholderDialog(t("upgrade.button"))}>{t("upgrade.button")}</Button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-actions">
            <Button
              className="credit-pill"
              variant="outline"
              type="button"
              data-account-trigger
              aria-expanded={accountOpen}
              aria-controls="accountPanel"
              onClick={() => setAccountOpen(true)}
            >
              <CreditCard data-icon="inline-start" />
              <span>{t("topbar.credits", { count: isLoggedIn ? currentUser.credits : "0" })}</span>
              <Plus data-icon="inline-end" />
            </Button>
            <Button className="premium-button" asChild>
              <a href={GIFT_CARD_SHOP_URL} target="_blank" rel="noreferrer">
                <Sparkles data-icon="inline-start" />
                {t("topbar.pro")}
              </a>
            </Button>
            <Button className="icon-button top-icon-button" variant="outline" size="icon" type="button" aria-label={t("topbar.notifications")} onClick={() => showPlaceholderDialog(t("topbar.notifications"))}>
              <Bell />
            </Button>
            <Button
              className="glass-button"
              variant="outline"
              type="button"
              aria-label={t("language.label")}
              onClick={toggleLanguage}
            >
              <span>{t("language.toggle")}</span>
            </Button>
            <Button
              className="glass-button top-icon-button"
              variant="outline"
              size="icon"
              type="button"
              aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}
              title={theme === "dark" ? t("theme.light") : t("theme.dark")}
              onClick={() => {
              const nextTheme = theme === "dark" ? "light" : "dark";
              setThemeState(nextTheme);
              }}
            >
              {theme === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
            </Button>
            <Dialog open={clearHistoryConfirmOpen} onOpenChange={setClearHistoryConfirmOpen}>
              <DialogTrigger asChild>
                <Button className={`glass-button${history.length === 0 ? " hidden" : ""}`} variant="outline" type="button">
                  <Eraser data-icon="inline-start" />
                  <span>{t("history.clear")}</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="clear-history-dialog" aria-describedby="clearHistoryDescription">
                <DialogHeader>
                  <DialogTitle>{t("history.clearTitle")}</DialogTitle>
                  <DialogDescription id="clearHistoryDescription">
                    {t("history.clearDescription")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">{t("common.cancel")}</Button>
                  </DialogClose>
                  <Button variant="destructive" type="button" onClick={clearAllLocalHistory}>{t("history.confirmClear")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button id="accountButton" className="account-button" variant="outline" type="button" data-account-trigger aria-expanded={accountOpen} aria-controls="accountPanel" onClick={() => setAccountOpen(prev => !prev)}>
              <span className="status-dot" />
              <span>{isLoggedIn ? currentUser.email : "Ava Chen"}</span>
            </Button>
          </div>
        </header>

        <section className="history-feed" aria-label={t("history.section")}>
          <div className="history-toolbar">
            <div>
              <p className="eyebrow">{t("history.eyebrow")}</p>
              <h1>{t("history.title")}</h1>
            </div>
            <div className="history-tools">
              <Button className="view-button active" variant="secondary" size="icon" type="button" aria-label={t("history.gridView")} onClick={() => showPlaceholderDialog(t("history.gridView"))}><Grid2X2 /></Button>
              <Button className="view-button" variant="ghost" size="icon" type="button" aria-label={t("history.listView")} onClick={() => showPlaceholderDialog(t("history.listView"))}><Menu /></Button>
              <select aria-label={t("history.modelFilter")}>
                <option>{t("history.allModels")}</option>
                <option>gpt-image-2</option>
              </select>
            </div>
          </div>
          <div className="filter-tabs" aria-label={t("history.filters")}>
            <button className="active" type="button" onClick={() => showPlaceholderDialog(t("history.all"))}><Home />{t("history.all")}</button>
            <button type="button" onClick={() => showPlaceholderDialog(t("history.drafts"))}><Folder />{t("history.drafts")}</button>
            <button type="button" onClick={() => showPlaceholderDialog(t("history.upscaled"))}><Image />{t("history.upscaled")}</button>
            <button type="button" onClick={() => showPlaceholderDialog(t("history.favorites"))}><Star />{t("history.favorites")}</button>
          </div>
          <div className="history-scroll">
            {historyLoading ? (
              <section className="empty-state is-loading">
                <div className="empty-card">
                  <span className="empty-icon">✦</span>
                  <h2>{t("history.loadingTitle")}</h2>
                  <p>{t("history.loadingCopy")}</p>
                </div>
              </section>
            ) : null}
            {historyError ? <div className="empty-inline">{historyError}</div> : null}
            {visibleHistory.map(task => (
              <Card key={task.id} className={`history-task${task.id === selectedId ? " selected" : ""}`} data-id={task.id} onPointerDownCapture={handleHistoryTaskScrollbarPointerDown} onClick={() => {
                setSelectedId(task.id);
              }}>
                <CardHeader className="task-head">
                  <div className="task-title-area">
                    <Input type="checkbox" aria-label={t("history.select")} onClick={event => event.stopPropagation()} />
                    <ChevronUp />
                  </div>
                  <div className="task-copy-area">
                    <CardTitle>{getTaskTitle(task.prompt)}</CardTitle>
                    <div className="tag-row">
                      <Badge variant="secondary">{task.model || "gpt-image-2"}</Badge>
                      <Badge variant="secondary">{task.mode === "edit" ? t("history.editMode") : t("history.generateMode")}</Badge>
                      <Badge variant="outline">{getRatioLabel(task.aspectRatio || "auto", t)}</Badge>
                      <Badge variant="outline">{task.quality || "medium"}</Badge>
                      <Badge variant="outline">{t("history.count", { count: task.count || task.images.length })}</Badge>
                      {task.costCredits ? <Badge variant="secondary">{t("history.points", { count: task.costCredits })}</Badge> : null}
                      {Number.isFinite(task.remainingCreditsSnapshot) ? <Badge variant="secondary">{t("history.balance", { count: task.remainingCreditsSnapshot })}</Badge> : null}
                      <Badge variant="outline">{formatTime(new Date(task.createdAt), language)}</Badge>
                    </div>
                  </div>
                  <div className="task-more-actions" onClick={event => event.stopPropagation()}>
                    <Button className="task-action-button" variant="ghost" type="button" title={t("history.reedit")} aria-label={t("history.reedit")} onClick={() => fillFromTask(task)}>
                      <WandSparkles data-icon="inline-start" />
                      <span>{t("history.reedit")}</span>
                    </Button>
                    <Button className="task-action-button" variant="ghost" type="button" title={t("history.regenerate")} aria-label={t("history.regenerate")} onClick={() => generateFromTask(task)}>
                      <RotateCcw data-icon="inline-start" />
                      <span>{t("history.regenerate")}</span>
                    </Button>
                    <Button className="task-action-button compact" variant="ghost" type="button" title={t("history.copyPrompt")} aria-label={t("history.copyPrompt")} onClick={() => copyPromptFromTask(task)}>
                      <Copy />
                    </Button>
                    <div className="delete-action-wrap">
                      <Button
                        className="task-delete-button"
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={t("history.delete")}
                        aria-expanded={deleteConfirmId === task.id}
                        onClick={() => setDeleteConfirmId(prev => prev === task.id ? null : task.id)}
                      >
                        <Trash2 />
                      </Button>
                      {deleteConfirmId === task.id ? (
                        <div className="delete-confirm-popover" role="dialog" aria-label={t("history.deleteDialog")}>
                          <strong>{t("history.deleteTitle")}</strong>
                          <span>{t("history.deleteCopy")}</span>
                          <div>
                            <Button variant="ghost" type="button" onClick={() => setDeleteConfirmId(null)}>{t("common.cancel")}</Button>
                            <Button variant="destructive" type="button" onClick={async () => {
                              await deleteTask(task);
                            }}>{t("common.delete")}</Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="task-content">
                  {renderReferenceChips(task)}
                  <GeneratedImageGrid task={task} renderImageCard={renderImageCard} scrollLabel={t("generation.scrollImages")} />
                </CardContent>
              </Card>
            ))}
            {showPreviewRows ? (
              <section className="concept-preview-list" aria-label={t("history.examples")}>
                {supplementalPreviewRows.map(renderPreviewRow)}
              </section>
            ) : null}
          </div>
        </section>
      </main>

      <section className="composer" aria-label={t("composer.section")}>
        <form className={`composer-card${isLoggedIn ? "" : " is-disabled"}`} noValidate onSubmit={async event => {
          event.preventDefault();
          await generateNewTask();
        }}>
          {referenceImages.length === 0 ? (
            <label className="upload-tile upload-tile-compact" title={t("composer.uploadReference")}>
              <input type="file" accept="image/*" multiple onChange={async event => {
                await addReferenceFiles(event.target.files || []);
                event.target.value = "";
              }} />
              <span aria-hidden="true"><Plus /></span>
            </label>
          ) : (
            <div
              className={`reference-dock${referenceDockExpanded ? " is-expanded" : ""}`}
              aria-label={t("composer.selectedReferences", { count: referenceImages.length })}
              onMouseLeave={() => {
                if (!isPortraitPhoneViewport()) {
                  setReferenceDockExpanded(false);
                }
              }}
              style={{
                ["--reference-count"]: referenceImages.length,
                ["--reference-expanded-width"]: `${referenceImages.length * 78 + 84}px`
              }}
            >
              <div className="reference-dock-hover-plate" aria-hidden="true" />
              <button
                className="reference-dock-toggle"
                type="button"
                aria-expanded={referenceDockExpanded}
                aria-label={referenceDockExpanded ? t("composer.collapseReferences") : t("composer.expandReferences", { count: referenceImages.length })}
                onClick={() => setReferenceDockExpanded(prev => !prev)}
              >
                <span>{referenceImages.length}</span>
                <ChevronUp />
              </button>
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
                      aria-label={t("composer.previewReference", { name: image.name || index + 1 })}
                      onClick={() => handleReferencePreview(image)}
                    >
                      <img src={image.dataUrl} alt={image.name} />
                    </button>
                    <button className="reference-dock-remove" type="button" aria-label={t("composer.removeReference")} onClick={() => removeReference(image.id)}>
                      <X />
                    </button>
                  </figure>
                ))}
                <label className="reference-dock-add reference-dock-add-expanded" title={t("composer.addReference")}>
                  <input type="file" accept="image/*" multiple onChange={async event => {
                    await addReferenceFiles(event.target.files || []);
                    event.target.value = "";
                  }} />
                  <Plus />
                </label>
              </div>
              <label className="reference-dock-add" title={t("composer.addReference")}>
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
                className="prompt-textarea"
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                onPaste={handlePromptPaste}
                rows={3}
                placeholder={t("composer.placeholder")}
                required
              />
            </div>

            <div className="control-row">
              <div className="ratio-control">
                <Button className="ratio-button" variant="outline" type="button" aria-expanded={ratioOpen} onClick={() => setRatioOpen(prev => !prev)}>
                  <span className={`ratio-icon ${ratioChoices.find(item => item.value === aspectRatio)?.shape || "auto"}`} aria-hidden="true" />
                  <span>{aspectRatio === "auto" ? t("ratio.auto") : aspectRatio}</span>
                  <ChevronUp />
                </Button>
                <div className={`ratio-panel desktop-ratio-panel${ratioOpen ? "" : " hidden"}`}>
                  <p>{t("ratio.label")}</p>
                  <div className="ratio-options" aria-label={t("ratio.label")}>
                    {renderRatioOptions()}
                  </div>
                </div>
              </div>

              <select value={quality} onChange={event => setQuality(event.target.value)} aria-label={t("quality.label")}>
                <option value="medium">medium</option>
                <option value="low">low</option>
                <option value="high">high</option>
              </select>

              <label className="count-control">
                <span>{t("count.label")}</span>
                <Button className="count-step count-step-minus" variant="ghost" type="button" aria-label={t("count.decrease")} onClick={() => stepCount(-1)}>
                  <span aria-hidden="true">-</span>
                </Button>
                <Input type="number" min="1" step="1" value={count} onChange={event => setCount(event.target.value)} />
                <Button className="count-step count-step-plus" variant="ghost" type="button" aria-label={t("count.increase")} onClick={() => stepCount(1)}>
                  <Plus aria-hidden="true" />
                </Button>
              </label>

              <Button className={`soft-button${referenceImages.length === 0 ? " hidden" : ""}`} variant="outline" type="button" onClick={clearReferences}>
                <X data-icon="inline-start" />
                <span>{t("composer.clearReferences")}</span>
              </Button>
            </div>
          </div>

          <Button className="generate-button" type="submit">
            <Sparkles data-icon="inline-start" />
            <span>{referenceModeActive ? t("composer.edit") : t("composer.generate")}</span>
          </Button>
          <label className="advanced-toggle">
            <span>{t("composer.advanced")}</span>
            <input type="checkbox" onChange={event => {
              event.currentTarget.checked = false;
              showPlaceholderDialog(t("composer.advanced"));
            }} />
          </label>
        </form>
      </section>

      {referenceImages.length > 0 ? (
        <section className={`mobile-reference-panel${referenceDockExpanded ? "" : " hidden"}`} aria-label={t("composer.selectedReferences", { count: referenceImages.length })}>
          <div className="mobile-reference-panel-head">
            <span>{t("references.title", { count: referenceImages.length })}</span>
            <button type="button" aria-label={t("composer.collapseReferences")} onClick={() => setReferenceDockExpanded(false)}>
              <ChevronUp />
            </button>
          </div>
          <div className="mobile-reference-strip">
            {referenceImages.map((image, index) => (
              <figure className="mobile-reference-card" key={`mobile-${image.id}`}>
                <button
                  className="mobile-reference-preview"
                  type="button"
                  aria-label={t("composer.previewReference", { name: image.name || index + 1 })}
                  onClick={() => openImagePreview(image.dataUrl, {
                    items: referenceImages.map(item => item.dataUrl),
                    index
                  })}
                >
                  <img src={image.dataUrl} alt={image.name} />
                </button>
                <button className="mobile-reference-remove" type="button" aria-label={t("composer.removeReference")} onClick={() => removeReference(image.id)}>
                  <X />
                </button>
              </figure>
            ))}
            <label className="mobile-reference-add" title={t("composer.addReference")}>
              <input type="file" accept="image/*" multiple onChange={async event => {
                await addReferenceFiles(event.target.files || []);
                event.target.value = "";
              }} />
              <Plus />
            </label>
          </div>
        </section>
      ) : null}

      <div className={`ratio-panel mobile-ratio-panel${ratioOpen ? "" : " hidden"}`}>
        <p>{t("ratio.label")}</p>
        <div className="ratio-options" aria-label={t("ratio.label")}>
          {renderRatioOptions()}
        </div>
      </div>

      <Dialog open={placeholderDialogOpen} onOpenChange={setPlaceholderDialogOpen}>
        <DialogContent className="clear-history-dialog" aria-describedby="placeholderFeatureDescription">
          <DialogHeader>
            <DialogTitle>{t("placeholder.title")}</DialogTitle>
            <DialogDescription id="placeholderFeatureDescription">
              {t("placeholder.description", { feature: placeholderFeature })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">{t("placeholder.confirm")}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section id="accountPanel" className={`account-panel${accountOpen ? "" : " hidden"}`} aria-label={t("account.section")}>
        <div className="panel-backdrop" onClick={() => setAccountOpen(false)} />
        <div className="account-popover">
          <div className="account-panel-head">
            <div>
              <p className="eyebrow">{t("account.eyebrow")}</p>
              <h2>{isLoggedIn ? t("account.titleLoggedIn") : t("account.titleLoggedOut")}</h2>
            </div>
            <Button className="icon-button" variant="ghost" size="icon" type="button" aria-label={t("common.close")} onClick={() => setAccountOpen(false)}><X /></Button>
          </div>

          {isLoggedIn ? (
            <div className="account-panel-body">
              <div className="account-summary">
                <span className="status-dot" />
                <div>
                  <strong>{currentUser.email}</strong>
                  <span>{t("history.points", { count: currentUser.credits })}</span>
                </div>
                <Button className="buy-gift-card-button" variant="outline" size="sm" asChild>
                  <a href={GIFT_CARD_SHOP_URL} target="_blank" rel="noreferrer">
                    {t("account.buyCode")}
                  </a>
                </Button>
              </div>
              <label className="account-control">
                <span>{t("account.giftCard")}</span>
                <Input value={giftKey} onChange={event => setGiftKey(event.target.value)} type="text" autoComplete="off" placeholder="gift_..." />
              </label>
              <div className="panel-actions">
                <Button className="soft-button" variant="secondary" type="button" onClick={redeemGiftCard}>
                  <CreditCard data-icon="inline-start" />
                  <span>{t("account.redeem")}</span>
                </Button>
                <Button className="soft-button" variant="outline" type="button" onClick={logout}>
                  <LogOut data-icon="inline-start" />
                  <span>{t("account.logout")}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="account-panel-body">
              <label className="account-control">
                <span>{t("account.email")}</span>
                <Input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" />
              </label>
              <label className={`account-control${loginCodeRequested ? "" : " hidden"}`}>
                <span>{t("account.code")}</span>
                <Input value={code} onChange={event => setCode(event.target.value)} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={t("account.codePlaceholder")} />
              </label>
              <div className="panel-actions">
                <Button className={`soft-button${loginCodeRequested ? " hidden" : ""}`} variant="secondary" type="button" onClick={sendLoginCode}>
                  <Send data-icon="inline-start" />
                  <span>{t("account.sendCode")}</span>
                </Button>
                <Button className={`soft-button${loginCodeRequested ? "" : " hidden"}`} type="button" onClick={loginWithCode}>
                  <Sparkles data-icon="inline-start" />
                  <span>{t("account.login")}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={`image-preview${preview.isOpen ? "" : " hidden"}`} aria-label={t("imagePreview.section")} aria-modal="true" role="dialog" onClick={event => {
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
              alt={t("imagePreview.alt")}
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
        {preview.items.length > 1 ? (
          <>
            <Button className="preview-nav preview-nav-prev" variant="secondary" size="icon" type="button" aria-label={t("imagePreview.previous")} onClick={event => {
              event.stopPropagation();
              navigatePreview(-1);
            }}>
              <ChevronLeft />
            </Button>
            <Button className="preview-nav preview-nav-next" variant="secondary" size="icon" type="button" aria-label={t("imagePreview.next")} onClick={event => {
              event.stopPropagation();
              navigatePreview(1);
            }}>
              <ChevronRight />
            </Button>
          </>
        ) : null}
        <div className="preview-toolbar" aria-label={t("imagePreview.controls")} onClick={event => event.stopPropagation()}>
          <Button className="preview-tool" variant="secondary" size="icon" type="button" aria-label={t("imagePreview.zoomOut")} onClick={() => zoomPreview(-0.2)}><ZoomOut /></Button>
          <button className="preview-tool preview-scale" type="button" onClick={resetPreviewZoom}>{previewScaleLabel}</button>
          <Button className="preview-tool" variant="secondary" size="icon" type="button" aria-label={t("imagePreview.zoomIn")} onClick={() => zoomPreview(0.2)}><ZoomIn /></Button>
        </div>
        <Button className="preview-close" variant="secondary" size="icon" type="button" aria-label={t("common.close")} onClick={closeImagePreview}><X /></Button>
      </section>

      <div className={`toast${toast ? "" : " hidden"}`} role="status">{toast}</div>
    </div>
  );
}

export default App;
