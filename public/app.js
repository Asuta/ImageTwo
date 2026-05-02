const STORAGE_KEY = "image2-history-v3";
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
const button = document.querySelector("#generateButton");
const modeTabs = document.querySelectorAll(".mode-tab");
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
const toast = document.querySelector("#toast");

let mode = "generate";
let aspectRatio = "auto";
let referenceImages = [];
let selectedId = null;
let history = loadHistory();

renderRatioOptions();
renderReferences();
renderHistory();
syncRatioButton();
syncThemeLabel();

function loadHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory() {
  const storableHistory = history.map(({ referenceImages: _referenceImages, ...task }) => task);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storableHistory));
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
    id: crypto.randomUUID(),
    status: "loading",
    url: "",
    absolutePath: "",
    createdAt: new Date().toISOString()
  }));
}

function createTask({ prompt, aspectRatio, quality, count, mode, referenceImages }) {
  const id = crypto.randomUUID();
  return {
    id,
    prompt,
    aspectRatio,
    quality,
    count,
    mode,
    createdAt: new Date().toISOString(),
    referenceThumbs: referenceImages.map(image => image.dataUrl).filter(dataUrl => dataUrl.length < 600_000),
    referenceNames: referenceImages.map(image => image.name),
    referenceImages,
    images: createLoadingImages(count)
  };
}

function setMode(nextMode) {
  mode = nextMode;
  modeTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  referenceInput.closest(".upload-tile").classList.toggle("is-emphasized", mode === "edit");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2400);
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
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    dataUrl: await fileToDataUrl(file)
  })));

  referenceImages = [...referenceImages, ...additions];
  referenceInput.value = "";
  setMode("edit");
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

  referenceImages.forEach(image => {
    const item = document.createElement("div");
    item.className = "reference-thumb";
    item.innerHTML = `
      <img src="${escapeHtml(image.dataUrl)}" alt="${escapeHtml(image.name)}" />
      <button type="button" data-remove-ref="${image.id}" aria-label="移除参考图">×</button>
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

  history.forEach(task => {
    const article = document.createElement("article");
    article.className = `history-task${task.id === selectedId ? " selected" : ""}`;
    article.dataset.id = task.id;

    article.innerHTML = `
      <div class="task-head">
        <div>
          <h2>${escapeHtml(getTaskTitle(task.prompt))}</h2>
          <div class="tag-row">
            <span>gpt-5.4-mini</span>
            <span>${task.mode === "edit" ? "多图参考" : "图片生成"}</span>
            <span>${escapeHtml(getRatioLabel(task.aspectRatio || "auto"))}</span>
            <span>${escapeHtml(task.quality || "medium")}</span>
            <span>${task.count || task.images.length} 张</span>
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
  if (image.status === "loading") {
    return `
      <figure class="image-card is-loading">
        <div class="image-skeleton"><span></span></div>
        <figcaption>正在生成...</figcaption>
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
      <a href="${escapeHtml(image.url)}" target="_blank" rel="noreferrer">
        <img src="${escapeHtml(image.url)}" alt="生成结果" />
      </a>
      <figcaption title="${escapeHtml(image.absolutePath)}">${escapeHtml(image.absolutePath)}</figcaption>
    </figure>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function requestImage(task, imageId) {
  try {
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

    updateImage(task.id, imageId, {
      status: "done",
      url: payload.fileUrl,
      absolutePath: payload.absolutePath
    });
  } catch (error) {
    updateImage(task.id, imageId, {
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
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
  saveHistory();
  renderHistory();
}

async function runTaskImages(task, images) {
  const results = await Promise.allSettled(images.map(image => requestImage(task, image.id)));

  const failedCount = results.filter(result => result.status === "rejected").length;
  if (failedCount > 0) {
    showToast(`${failedCount} 张生成失败`);
  } else {
    showToast(`${images.length} 张图片已生成`);
  }
}

async function generateNewTask() {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    showToast("请先输入提示词");
    return;
  }

  if (mode === "edit" && referenceImages.length === 0) {
    showToast("参考图编辑需要先上传图片");
    return;
  }

  const count = getCount();
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
  saveHistory();
  renderHistory();
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
  saveHistory();
  renderHistory();
  runTaskImages(task, images);
}

function fillFromTask(task) {
  selectedId = task.id;
  promptInput.value = task.prompt;
  setAspectRatio(task.aspectRatio || "auto");
  qualityInput.value = task.quality || "medium";
  countInput.value = task.count || 1;
  setMode(task.mode);

  if (task.referenceImages?.length) {
    referenceImages = task.referenceImages;
    renderReferences();
  } else if (task.mode === "edit") {
    clearReferences();
    showToast("请重新上传参考图后再编辑");
  }

  renderHistory();
  promptInput.focus();
  showToast("已复用提示词和参数");
}

modeTabs.forEach(tab => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

themeToggle.addEventListener("click", toggleTheme);

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
    history = history.filter(item => item.id !== task.id);
    if (selectedId === task.id) {
      selectedId = history[0]?.id || null;
    }
    saveHistory();
    renderHistory();
    showToast("已删除历史记录");
  }
});
