const DB_NAME = "image2-local-history";
const DB_VERSION = 1;
const MAX_LOCAL_IMAGES = 300;
const GENERATION_POLL_INTERVAL_MS = 2500;
const GENERATION_POLL_TIMEOUT_MS = 5 * 60 * 1000;

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

const historyFeed = document.querySelector("#historyFeed");
const emptyState = document.querySelector("#emptyState");
const form = document.querySelector("#generateForm");
const promptInput = document.querySelector("#prompt");
const qualityInput = document.querySelector("#quality");
const countInput = document.querySelector("#countInput");
const referenceInput = document.querySelector("#referenceInput");
const referenceStrip = document.querySelector("#referenceStrip");
const clearReferenceButton = document.querySelector("#clearReference");
const ratioButton = document.querySelector("#ratioButton");
const ratioPanel = document.querySelector("#ratioPanel");
const ratioOptions = document.querySelector("#ratioOptions");
const ratioIcon = document.querySelector("#ratioIcon");
const ratioLabel = document.querySelector("#ratioLabel");
const themeToggle = document.querySelector("#themeToggle");
const themeLabel = document.querySelector("#themeLabel");
const accountButton = document.querySelector("#accountButton");
const accountButtonText = document.querySelector("#accountButtonText");
const accountPanel = document.querySelector("#accountPanel");
const closeAccountPanelButton = document.querySelector("#closeAccountPanel");
const accountPanelTitle = document.querySelector("#accountPanelTitle");
const loginFields = document.querySelector("#loginFields");
const accountFields = document.querySelector("#accountFields");
const accountEmail = document.querySelector("#accountEmail");
const accountCredits = document.querySelector("#accountCredits");
const emailInput = document.querySelector("#emailInput");
const codeControl = document.querySelector("#codeControl");
const codeInput = document.querySelector("#codeInput");
const sendCodeButton = document.querySelector("#sendCodeButton");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const giftControl = document.querySelector("#giftControl");
const giftKeyInput = document.querySelector("#giftKeyInput");
const redeemButton = document.querySelector("#redeemButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const generateButton = document.querySelector("#generateButton");
const imagePreview = document.querySelector("#imagePreview");
const previewImage = document.querySelector("#previewImage");
const closeImagePreviewButton = document.querySelector("#closeImagePreview");
const previewZoomOutButton = document.querySelector("#previewZoomOut");
const previewZoomResetButton = document.querySelector("#previewZoomReset");
const previewZoomInButton = document.querySelector("#previewZoomIn");
const generationInputs = [promptInput, qualityInput, countInput, referenceInput, clearReferenceButton, ratioButton];
const toast = document.querySelector("#toast");

let aspectRatio = "auto";
let referenceImages = [];
let selectedId = null;
let history = [];
let dbPromise = null;
let currentUser = null;
let loginCodeRequested = false;
let previewState = {
  isOpen: false,
  scale: 1,
  x: 0,
  y: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  originX: 0,
  originY: 0
};

window.addEventListener("error", event => {
  showToast(`页面脚本错误：${event.message || "未知错误"}`);
});

window.addEventListener("unhandledrejection", event => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || "未知错误");
  showToast(`页面异步错误：${reason}`);
});

init();

async function init() {
  renderRatioOptions();
  renderReferences();
  syncRatioButton();
  syncThemeLabel();
  await refreshCurrentUser();

  try {
    history = await loadHistory();
  } catch (error) {
    console.error(error);
    showToast("读取本地历史失败");
  }

  renderHistory();
}

function openHistoryDb() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
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

  return dbPromise;
}

function storeRequest(store, method, ...args) {
  return new Promise((resolve, reject) => {
    const request = store[method](...args);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function loadHistory() {
  const db = await openHistoryDb();
  const transaction = db.transaction(["tasks", "images"], "readonly");
  const done = transactionDone(transaction);
  const tasks = await storeRequest(transaction.objectStore("tasks"), "getAll");
  const images = await storeRequest(transaction.objectStore("images"), "getAll");
  const imagesByTask = new Map();

  images.forEach(image => {
    const url = image.blob ? URL.createObjectURL(image.blob) : "";
    const imageRecord = { ...image, url };
    imagesByTask.set(image.taskId, [...(imagesByTask.get(image.taskId) || []), imageRecord]);
  });

  await done;

  return tasks
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(task => ({
      ...task,
      images: (imagesByTask.get(task.id) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }));
}

async function saveTask(task) {
  const db = await openHistoryDb();
  const transaction = db.transaction("tasks", "readwrite");
  const done = transactionDone(transaction);
  const { referenceImages: _referenceImages, images: _images, ...storableTask } = task;
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

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function getCount() {
  const value = Number.parseInt(countInput.value, 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function createLoadingImages(count) {
  return Array.from({ length: count }, () => ({
    id: createLocalId(),
    status: "loading",
    url: "",
    createdAt: new Date().toISOString()
  }));
}

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

function getActiveGenerationMode() {
  return referenceImages.length > 0 ? "edit" : "generate";
}

function syncReferenceModeState() {
  referenceInput.closest(".upload-tile").classList.toggle("is-emphasized", referenceImages.length > 0);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2600);
}

function setCurrentUser(user) {
  currentUser = user;
  const isLoggedIn = Boolean(currentUser);

  accountButtonText.textContent = isLoggedIn ? `${currentUser.email} · ${currentUser.credits} 点` : "未登录";
  accountPanelTitle.textContent = isLoggedIn ? "账号与额度" : "邮箱登录";
  loginFields.classList.toggle("hidden", isLoggedIn);
  accountFields.classList.toggle("hidden", !isLoggedIn);

  emailInput.disabled = isLoggedIn;
  codeControl.classList.toggle("hidden", isLoggedIn || !loginCodeRequested);
  sendCodeButton.classList.toggle("hidden", isLoggedIn);
  loginButton.classList.toggle("hidden", isLoggedIn || !loginCodeRequested);

  form.classList.toggle("is-disabled", !isLoggedIn);
  generationInputs.forEach(input => {
    input.disabled = !isLoggedIn;
  });
  generateButton.disabled = false;
  generateButton.dataset.locked = String(!isLoggedIn);

  if (isLoggedIn) {
    emailInput.value = currentUser.email;
    accountEmail.textContent = currentUser.email;
    accountCredits.textContent = `${currentUser.credits} 点`;
  }
}

function openAccountPanel() {
  accountPanel.classList.remove("hidden");
  accountButton.setAttribute("aria-expanded", "true");
  window.setTimeout(() => {
    if (currentUser) {
      giftKeyInput.focus();
    } else {
      emailInput.focus();
    }
  }, 0);
}

function closeAccountPanel() {
  accountPanel.classList.add("hidden");
  accountButton.setAttribute("aria-expanded", "false");
}

async function refreshCurrentUser() {
  try {
    const response = await fetch("/api/auth/me");
    const payload = await response.json();
    setCurrentUser(payload.user || null);
  } catch (error) {
    console.error(error);
    setCurrentUser(null);
  }
}

async function sendLoginCode() {
  const email = emailInput.value.trim();
  if (!email) {
    showToast("请先输入邮箱");
    emailInput.focus();
    return;
  }

  sendCodeButton.disabled = true;
  try {
    const response = await fetch("/api/auth/request-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "验证码发送失败。");
    }

    codeControl.classList.remove("hidden");
    loginButton.classList.remove("hidden");
    loginCodeRequested = true;
    codeInput.focus();
    showToast(payload.devCode ? `开发验证码：${payload.devCode}` : "验证码已发送，请检查邮箱");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    sendCodeButton.disabled = false;
  }
}

async function loginWithCode() {
  const email = emailInput.value.trim();
  const code = codeInput.value.trim();
  if (!email || !code) {
    showToast("请输入邮箱和验证码");
    return;
  }

  loginButton.disabled = true;
  try {
    const response = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || payload.error || "登录失败。");
    }

    codeInput.value = "";
    loginCodeRequested = false;
    setCurrentUser(payload.user);
    closeAccountPanel();
    showToast("登录成功");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    loginButton.disabled = false;
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  currentUser = null;
  loginCodeRequested = false;
  emailInput.disabled = false;
  emailInput.value = "";
  codeInput.value = "";
  giftKeyInput.value = "";
  setCurrentUser(null);
  closeAccountPanel();
  showToast("已退出登录");
}

async function redeemGiftCard() {
  const key = giftKeyInput.value.trim();
  if (!key) {
    showToast("请输入礼品卡 Key");
    giftKeyInput.focus();
    return;
  }

  redeemButton.disabled = true;
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

    giftKeyInput.value = "";
    setCurrentUser(payload.user);
    showToast(`已兑换 ${payload.creditsAdded} 点，当前余额 ${payload.user.credits} 点`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    redeemButton.disabled = false;
  }
}

function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function syncThemeLabel() {
  const isDark = getTheme() === "dark";
  themeLabel.textContent = isDark ? "浅色模式" : "深色模式";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

function toggleTheme() {
  const nextTheme = getTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("image2-theme", nextTheme);
  syncThemeLabel();
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

  referenceImages = [...referenceImages, ...additions];
  referenceInput.value = "";
  renderReferences();
}

function clearReferences() {
  referenceImages = [];
  referenceInput.value = "";
  renderReferences();
}

function removeReference(id) {
  referenceImages = referenceImages.filter(image => image.id !== id);
  renderReferences();
}

function renderReferences() {
  referenceStrip.innerHTML = "";
  referenceStrip.classList.toggle("hidden", referenceImages.length === 0);
  clearReferenceButton.classList.toggle("hidden", referenceImages.length === 0);
  syncReferenceModeState();
  referenceStrip.style.setProperty("--reference-count", String(referenceImages.length));
  referenceStrip.style.setProperty("--reference-collapsed-width", `${88 + Math.max(0, referenceImages.length - 1) * 24}px`);
  referenceStrip.style.setProperty("--reference-expanded-width", `${88 + Math.max(0, referenceImages.length - 1) * 98}px`);

  referenceImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "reference-thumb";
    item.style.setProperty("--reference-index", String(index));
    item.style.zIndex = String(referenceImages.length - index);
    item.innerHTML = `
      <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name)}" />
      <button type="button" data-remove-ref="${image.id}" aria-label="移除参考图">x</button>
    `;
    referenceStrip.append(item);
  });
}

function renderRatioOptions() {
  ratioOptions.innerHTML = ratioChoices.map(choice => `
    <button class="ratio-option" type="button" data-ratio="${choice.value}">
      <span class="ratio-shape ${choice.shape}" aria-hidden="true"></span>
      <span>${choice.label}</span>
    </button>
  `).join("");
}

function setAspectRatio(value) {
  aspectRatio = ratioChoices.some(choice => choice.value === value) ? value : "auto";
  syncRatioButton();
}

function syncRatioButton() {
  const choice = ratioChoices.find(item => item.value === aspectRatio) || ratioChoices[0];
  ratioLabel.textContent = choice.value === "auto" ? "智能比例" : choice.value;
  ratioIcon.className = `ratio-icon ${choice.shape}`;
  ratioOptions.querySelectorAll(".ratio-option").forEach(option => {
    option.classList.toggle("selected", option.dataset.ratio === aspectRatio);
  });
}

function getTaskTitle(prompt) {
  const firstLine = prompt.split(/\n/).find(Boolean) || prompt;
  return firstLine.length > 34 ? `${firstLine.slice(0, 34)}...` : firstLine;
}

function getRatioLabel(value) {
  return value === "auto" ? "智能比例" : value;
}

function renderHistory() {
  historyFeed.innerHTML = "";
  emptyState.classList.toggle("hidden", history.length > 0);
  clearHistoryButton.classList.toggle("hidden", history.length === 0);

  history.forEach(task => {
    const article = document.createElement("article");
    article.className = `history-task${task.id === selectedId ? " selected" : ""}`;
    article.dataset.id = task.id;

    article.innerHTML = `
      <div class="task-head">
        <div>
          <h2>${escapeHtml(getTaskTitle(task.prompt))}</h2>
          <div class="tag-row">
            <span>${escapeHtml(task.model || "gpt-image-2")}</span>
            <span>${task.mode === "edit" ? "多图参考" : "图片生成"}</span>
            <span>${escapeHtml(getRatioLabel(task.aspectRatio || "auto"))}</span>
            <span>${escapeHtml(task.quality || "medium")}</span>
            <span>${task.count || task.images.length} 张</span>
            ${task.costCredits ? `<span>${task.costCredits} 点</span>` : ""}
            ${Number.isFinite(task.remainingCreditsSnapshot) ? `<span>余额 ${task.remainingCreditsSnapshot}</span>` : ""}
            <span>${formatTime(new Date(task.createdAt))}</span>
          </div>
        </div>
        ${renderReferenceChips(task)}
      </div>

      <div class="image-grid count-${Math.min(task.images.length, 4)}">
        ${task.images.map(image => renderImageCard(image)).join("")}
      </div>

      <div class="task-actions">
        <button type="button" data-action="edit" data-id="${task.id}"><span aria-hidden="true">↩</span>重新编辑</button>
        <button type="button" data-action="rerun" data-id="${task.id}"><span aria-hidden="true">↻</span>再次生成</button>
        <button type="button" data-action="copy" data-id="${task.id}"><span aria-hidden="true">⧉</span>复制提示词</button>
        <button type="button" data-action="delete" data-id="${task.id}" aria-label="删除"><span aria-hidden="true">⌫</span></button>
      </div>
    `;

    historyFeed.append(article);
  });
}

function renderReferenceChips(task) {
  const thumbs = task.referenceThumbs || [];
  if (thumbs.length === 0) {
    return "";
  }

  return `
    <div class="reference-chip-stack" title="${thumbs.length} 张参考图">
      ${thumbs.slice(0, 4).map(src => `<img class="reference-chip" src="${escapeHtml(src)}" alt="参考图" />`).join("")}
      ${thumbs.length > 4 ? `<span>+${thumbs.length - 4}</span>` : ""}
    </div>
  `;
}

function renderImageCard(image) {
  if (image.status === "streaming" && image.url) {
    return `
      <figure class="image-card is-streaming">
        <button class="image-preview-trigger" type="button" data-action="preview" data-image-url="${escapeHtml(image.url)}" aria-label="放大预览生成结果">
          <img src="${escapeHtml(image.url)}" alt="正在加载的生成结果" />
        </button>
        <figcaption>正在接收图片...</figcaption>
      </figure>
    `;
  }

  if (image.status === "loading" || image.status === "streaming") {
    return `
      <figure class="image-card is-loading">
        <div class="image-skeleton"><span></span></div>
        <figcaption>${image.status === "streaming" ? "正在接收图片..." : "正在生成..."}</figcaption>
      </figure>
    `;
  }

  if (image.status === "error") {
    return `
      <figure class="image-card is-error">
        <div class="image-error">生成失败</div>
        <figcaption>${escapeHtml(image.error || "请稍后重试")}</figcaption>
      </figure>
    `;
  }

  return `
    <figure class="image-card">
      <button class="image-preview-trigger" type="button" data-action="preview" data-image-url="${escapeHtml(image.url)}" aria-label="放大预览生成结果">
        <img src="${escapeHtml(image.url)}" alt="生成结果" />
      </button>
      <figcaption>已保存在当前浏览器本地</figcaption>
    </figure>
  `;
}

function openImagePreview(src) {
  if (!src) {
    return;
  }

  previewImage.src = src;
  previewState = {
    ...previewState,
    isOpen: true,
    scale: 1,
    x: 0,
    y: 0,
    isDragging: false
  };
  imagePreview.classList.remove("hidden");
  document.body.classList.add("preview-open");
  updatePreviewTransform();
  closeImagePreviewButton.focus();
}

function closeImagePreview() {
  if (!previewState.isOpen) {
    return;
  }

  imagePreview.classList.add("hidden");
  document.body.classList.remove("preview-open");
  previewImage.src = "";
  previewState.isOpen = false;
  previewState.isDragging = false;
}

function clampPreviewScale(value) {
  return Math.min(5, Math.max(0.4, value));
}

function updatePreviewTransform() {
  previewImage.style.transform = `translate(${previewState.x}px, ${previewState.y}px) scale(${previewState.scale})`;
  previewZoomResetButton.textContent = `${Math.round(previewState.scale * 100)}%`;
}

function zoomPreview(delta) {
  previewState.scale = clampPreviewScale(previewState.scale + delta);
  if (previewState.scale <= 1) {
    previewState.x = 0;
    previewState.y = 0;
  }
  updatePreviewTransform();
}

function resetPreviewZoom() {
  previewState.scale = 1;
  previewState.x = 0;
  previewState.y = 0;
  updatePreviewTransform();
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

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function revokeImageUrl(url) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
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

function updateStreamingImage(taskId, imageId, result) {
  if (!result?.imageBase64) {
    return;
  }

  const task = history.find(item => item.id === taskId);
  const image = task?.images.find(item => item.id === imageId);
  if (image?.streamedLength && image.streamedLength >= result.imageBase64.length) {
    return;
  }

  const url = createImageObjectUrl(result.imageBase64, result.mimeType || "image/png");
  if (!url) {
    return;
  }

  revokeImageUrl(image?.url);
  updateImage(taskId, imageId, {
    status: "streaming",
    url,
    mimeType: result.mimeType || "image/png",
    outputFormat: result.outputFormat || "png",
    requestId: result.requestId,
    streamedLength: result.imageBase64.length
  });
}

async function requestImage(task, imageId) {
  try {
    if (!currentUser) {
      throw new Error("请先使用邮箱验证码登录。");
    }

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    const previousImage = history.find(item => item.id === task.id)?.images.find(image => image.id === imageId);
    revokeImageUrl(previousImage?.url);
    const blob = base64ToBlob(result.imageBase64, result.mimeType || "image/png");
    const url = URL.createObjectURL(blob);
    const doneImage = {
      id: imageId,
      status: "done",
      url,
      blob,
      mimeType: result.mimeType || "image/png",
      outputFormat: result.outputFormat || "png",
      requestId: result.requestId,
      createdAt: new Date().toISOString()
    };

    updateTaskMeta(task.id, {
      model: result.model || task.model,
      remainingCreditsSnapshot: result.remainingCredits
    }, result.costCredits || 0);
    if (Number.isFinite(result.remainingCredits) && currentUser) {
      setCurrentUser({ ...currentUser, credits: result.remainingCredits });
    }
    updateImage(task.id, imageId, doneImage);
    saveImage(task.id, doneImage).catch(error => {
      console.error(error);
      showToast("图片已生成，但本地历史保存失败");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateImage(task.id, imageId, {
      status: "error",
      error: message
    });
    showToast(message);
  }
}

async function pollGenerationResult(requestId, taskId, imageId) {
  if (!requestId) {
    throw new Error("生成任务没有返回 requestId。");
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < GENERATION_POLL_TIMEOUT_MS) {
    await wait(GENERATION_POLL_INTERVAL_MS);
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

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function updateTaskMeta(taskId, patch, creditDelta = 0) {
  history = history.map(task => {
    if (task.id !== taskId) {
      return task;
    }

    const updatedTask = {
      ...task,
      ...patch,
      costCredits: (task.costCredits || 0) + creditDelta
    };
    saveTask(updatedTask).catch(error => {
      console.error(error);
      showToast("保存任务信息失败");
    });
    return updatedTask;
  });
}

function updateImage(taskId, imageId, patch) {
  history = history.map(task => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      images: task.images.map(image => image.id === imageId ? { ...image, ...patch } : image)
    };
  });
  renderHistory();
}

async function runTaskImages(task, images) {
  await Promise.allSettled(images.map(image => requestImage(task, image.id)));
  const updatedTask = history.find(item => item.id === task.id);
  const generatedCount = updatedTask?.images.filter(image => image.status === "done").length || 0;
  const failedCount = updatedTask?.images.filter(image => image.status === "error").length || 0;

  if (failedCount > 0) {
    showToast(`${failedCount} 张生成失败，${generatedCount} 张已保存到本地`);
  } else {
    showToast(`${generatedCount} 张图片已保存到当前浏览器`);
  }

  history = await loadHistory();
  renderHistory();
}

async function generateNewTask() {
  if (!currentUser) {
    showToast("请先登录后再生成");
    openAccountPanel();
    return;
  }

  const prompt = promptInput.value.trim();
  if (!prompt) {
    showToast("请先输入提示词");
    return;
  }

  const count = getCount();
  const mode = getActiveGenerationMode();
  const task = createTask({
    prompt,
    aspectRatio,
    quality: qualityInput.value,
    count,
    mode,
    referenceImages
  });

  selectedId = task.id;
  history = [task, ...history];
  saveTask(task).catch(error => {
    console.error(error);
    showToast("本地历史暂时不可用，仍会继续生成");
  });
  renderHistory();
  showToast("已提交生成请求");
  runTaskImages(task, task.images);
}

async function rerunTask(task) {
  if (task.mode === "edit" && (!task.referenceImages || task.referenceImages.length === 0)) {
    showToast("刷新后参考图原始数据已失效，请重新上传");
    return;
  }

  selectedId = task.id;
  const images = createLoadingImages(task.count || 1);
  history = history.map(item => item.id === task.id ? { ...item, images: [...images, ...item.images] } : item);
  renderHistory();
  runTaskImages(task, images);
}

function fillFromTask(task) {
  selectedId = task.id;
  promptInput.value = task.prompt;
  setAspectRatio(task.aspectRatio || "auto");
  qualityInput.value = task.quality || "medium";
  countInput.value = task.count || 1;

  if (task.referenceImages?.length) {
    referenceImages = task.referenceImages;
    renderReferences();
  } else {
    clearReferences();
  }

  renderHistory();
  promptInput.focus();
  showToast("已复用提示词和参数");
}

themeToggle.addEventListener("click", toggleTheme);
accountButton.addEventListener("click", () => {
  if (accountPanel.classList.contains("hidden")) {
    openAccountPanel();
  } else {
    closeAccountPanel();
  }
});
closeAccountPanelButton.addEventListener("click", closeAccountPanel);
accountPanel.addEventListener("click", event => {
  if (event.target.closest("[data-close-account]")) {
    closeAccountPanel();
  }
});
sendCodeButton.addEventListener("click", sendLoginCode);
loginButton.addEventListener("click", loginWithCode);
logoutButton.addEventListener("click", logout);
redeemButton.addEventListener("click", redeemGiftCard);
clearHistoryButton.addEventListener("click", async () => {
  await clearHistoryDb();
  history.forEach(task => task.images.forEach(image => {
    if (image.url) {
      URL.revokeObjectURL(image.url);
    }
  }));
  history = [];
  selectedId = null;
  renderHistory();
  showToast("已清空当前浏览器的本地历史");
});

ratioButton.addEventListener("click", () => {
  ratioPanel.classList.toggle("hidden");
  ratioButton.setAttribute("aria-expanded", String(!ratioPanel.classList.contains("hidden")));
});

ratioOptions.addEventListener("click", event => {
  const option = event.target.closest(".ratio-option");
  if (!option) {
    return;
  }

  setAspectRatio(option.dataset.ratio);
  ratioPanel.classList.add("hidden");
  ratioButton.setAttribute("aria-expanded", "false");
});

document.addEventListener("click", event => {
  if (!event.target.closest(".ratio-control")) {
    ratioPanel.classList.add("hidden");
    ratioButton.setAttribute("aria-expanded", "false");
  }

  if (!event.target.closest(".account-popover") && !event.target.closest("#accountButton")) {
    closeAccountPanel();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeImagePreview();
    closeAccountPanel();
  }
});

closeImagePreviewButton.addEventListener("click", closeImagePreview);
previewZoomOutButton.addEventListener("click", () => zoomPreview(-0.2));
previewZoomInButton.addEventListener("click", () => zoomPreview(0.2));
previewZoomResetButton.addEventListener("click", resetPreviewZoom);

imagePreview.addEventListener("click", event => {
  if (event.target === previewImage || event.target.closest(".preview-toolbar")) {
    return;
  }

  if (event.target === imagePreview || event.target.closest(".preview-stage") || event.target.closest("[data-close-preview]")) {
    closeImagePreview();
  }
});

imagePreview.addEventListener("wheel", event => {
  if (!previewState.isOpen) {
    return;
  }

  event.preventDefault();
  zoomPreview(event.deltaY > 0 ? -0.16 : 0.16);
}, { passive: false });

previewImage.addEventListener("pointerdown", event => {
  if (!previewState.isOpen) {
    return;
  }

  event.preventDefault();
  previewState.isDragging = true;
  previewState.dragStartX = event.clientX;
  previewState.dragStartY = event.clientY;
  previewState.originX = previewState.x;
  previewState.originY = previewState.y;
  previewImage.setPointerCapture(event.pointerId);
  previewImage.classList.add("is-dragging");
});

previewImage.addEventListener("pointermove", event => {
  if (!previewState.isDragging) {
    return;
  }

  previewState.x = previewState.originX + event.clientX - previewState.dragStartX;
  previewState.y = previewState.originY + event.clientY - previewState.dragStartY;
  updatePreviewTransform();
});

previewImage.addEventListener("pointerup", event => {
  previewState.isDragging = false;
  previewImage.classList.remove("is-dragging");
  if (previewImage.hasPointerCapture(event.pointerId)) {
    previewImage.releasePointerCapture(event.pointerId);
  }
});

previewImage.addEventListener("pointercancel", () => {
  previewState.isDragging = false;
  previewImage.classList.remove("is-dragging");
});

referenceInput.addEventListener("change", async () => {
  await addReferenceFiles(referenceInput.files || []);
});

referenceStrip.addEventListener("click", event => {
  const removeButton = event.target.closest("[data-remove-ref]");
  if (removeButton) {
    removeReference(removeButton.dataset.removeRef);
  }
});

clearReferenceButton.addEventListener("click", clearReferences);

form.addEventListener("submit", event => {
  event.preventDefault();
  generateNewTask();
});

promptInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    generateNewTask();
  }
});

emailInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendLoginCode();
  }
});

codeInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    loginWithCode();
  }
});

giftKeyInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    redeemGiftCard();
  }
});

historyFeed.addEventListener("click", async event => {
  const buttonEl = event.target.closest("button[data-action]");
  if (!buttonEl) {
    const taskEl = event.target.closest(".history-task");
    if (taskEl) {
      selectedId = taskEl.dataset.id;
      renderHistory();
    }
    return;
  }

  if (buttonEl.dataset.action === "preview") {
    openImagePreview(buttonEl.dataset.imageUrl);
    return;
  }

  const task = history.find(item => item.id === buttonEl.dataset.id);
  if (!task) {
    return;
  }

  if (buttonEl.dataset.action === "edit") {
    fillFromTask(task);
  }

  if (buttonEl.dataset.action === "rerun") {
    await rerunTask(task);
  }

  if (buttonEl.dataset.action === "copy") {
    await navigator.clipboard.writeText(task.prompt);
    showToast("提示词已复制");
  }

  if (buttonEl.dataset.action === "delete") {
    await deleteTaskFromDb(task.id);
    task.images.forEach(image => {
      if (image.url) {
        URL.revokeObjectURL(image.url);
      }
    });
    history = history.filter(item => item.id !== task.id);
    if (selectedId === task.id) {
      selectedId = history[0]?.id || null;
    }
    renderHistory();
    showToast("已删除本地历史记录");
  }
});
