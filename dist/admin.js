const refreshAdminButton = document.querySelector("#refreshAdminButton");
const providerReloadButton = document.querySelector("#providerReloadButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const providerForm = document.querySelector("#providerForm");
const providerId = document.querySelector("#providerId");
const providerLabel = document.querySelector("#providerLabel");
const providerApiUrl = document.querySelector("#providerApiUrl");
const providerApiKey = document.querySelector("#providerApiKey");
const providerModel = document.querySelector("#providerModel");
const providerApiFormat = document.querySelector("#providerApiFormat");
const providerEnabled = document.querySelector("#providerEnabled");
const providerNote = document.querySelector("#providerNote");
const providerSaveButton = document.querySelector("#providerSaveButton");
const providerResetButton = document.querySelector("#providerResetButton");
const providerTestButton = document.querySelector("#providerTestButton");
const providerList = document.querySelector("#providerList");
const providerSummary = document.querySelector("#providerSummary");
const giftBatchForm = document.querySelector("#giftBatchForm");
const giftBatchLabel = document.querySelector("#giftBatchLabel");
const giftBatchCredits = document.querySelector("#giftBatchCredits");
const giftBatchCount = document.querySelector("#giftBatchCount");
const giftBatchExpiresAt = document.querySelector("#giftBatchExpiresAt");
const giftBatchNote = document.querySelector("#giftBatchNote");
const createdGiftCards = document.querySelector("#createdGiftCards");
const giftBatchList = document.querySelector("#giftBatchList");
const giftCardTable = document.querySelector("#giftCardTable");
const giftSearchInput = document.querySelector("#giftSearchInput");
const giftStatusFilter = document.querySelector("#giftStatusFilter");
const auditLogList = document.querySelector("#auditLogList");
const toast = document.querySelector("#toast");

let adminState = {
  providers: [],
  activeProvider: null,
  batches: [],
  giftCards: [],
  adminLogs: [],
  creditLogs: [],
  usageLogs: []
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2600);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("复制失败，请手动复制导出的 Key。");
  }
}

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign("/admin");
    throw new Error("请重新登录后台");
  }
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || "管理接口请求失败");
  }
  return payload;
}

async function loadAdminData() {
  refreshAdminButton.disabled = true;
  providerReloadButton.disabled = true;
  try {
    const params = new URLSearchParams();
    const query = giftSearchInput.value.trim();
    const status = giftStatusFilter.value;
    if (query) {
      params.set("q", query);
    }
    if (status) {
      params.set("status", status);
    }

    const [providerPayload, giftPayload, auditPayload] = await Promise.all([
      adminFetch("/api/admin/providers"),
      adminFetch(`/api/admin/gift-cards${params.toString() ? `?${params}` : ""}`),
      adminFetch("/api/admin/audit-logs")
    ]);
    adminState = {
      providers: providerPayload.providers || [],
      activeProvider: providerPayload.activeProvider || null,
      batches: giftPayload.batches || [],
      giftCards: giftPayload.giftCards || [],
      adminLogs: auditPayload.adminLogs || [],
      creditLogs: auditPayload.creditLogs || [],
      usageLogs: auditPayload.usageLogs || []
    };
    renderAdmin();
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    refreshAdminButton.disabled = false;
    providerReloadButton.disabled = false;
  }
}

function renderAdmin() {
  renderProviderSummary();
  renderProviderList();
  renderGiftBatches();
  renderGiftCards();
  renderAuditLogs();
}

function renderProviderSummary() {
  const active = adminState.activeProvider;
  providerSummary.innerHTML = active
    ? `<strong>当前启用：${escapeHtml(active.label || active.id)}</strong><span>${escapeHtml(active.apiFormat || "-")} · ${escapeHtml(active.model || "-")} · ${escapeHtml(active.apiUrl || "")}</span>`
    : `<strong>当前启用：-</strong><span>请先配置至少一个供应商。</span>`;
}

function renderProviderList() {
  if (!adminState.providers.length) {
    providerList.innerHTML = `<div class="provider-empty">暂无供应商，先创建一条吧。</div>`;
    return;
  }

  providerList.innerHTML = adminState.providers.map(provider => `
    <div class="provider-row${provider.isActive ? " is-active" : ""}" data-provider-id="${escapeHtml(provider.id)}">
      <div class="provider-main">
        <div class="provider-main-head">
          <strong>${escapeHtml(provider.label || "未命名供应商")}</strong>
          ${provider.isActive ? `<span class="provider-badge">当前启用</span>` : ""}
          <span class="provider-badge ${provider.enabled ? "enabled" : "disabled"}">${provider.enabled ? "启用" : "停用"}</span>
        </div>
        <div class="provider-meta">
          <span>${escapeHtml(provider.apiFormat || "-")}</span>
          <span>${escapeHtml(provider.model || "-")}</span>
          <span>${escapeHtml(provider.apiUrl || "")}</span>
          ${provider.note ? `<span>${escapeHtml(provider.note)}</span>` : ""}
        </div>
      </div>
      <div class="provider-actions">
        <button class="soft-button" type="button" data-provider-action="edit" data-id="${escapeHtml(provider.id)}">编辑</button>
        <button class="soft-button" type="button" data-provider-action="test" data-id="${escapeHtml(provider.id)}">测试</button>
        ${provider.enabled ? `<button class="soft-button" type="button" data-provider-action="disable" data-id="${escapeHtml(provider.id)}">停用</button>` : `<button class="soft-button" type="button" data-provider-action="enable" data-id="${escapeHtml(provider.id)}">启用</button>`}
        ${provider.isActive ? "" : `<button class="soft-button" type="button" data-provider-action="activate" data-id="${escapeHtml(provider.id)}">设为当前</button>`}
        <button class="soft-button danger" type="button" data-provider-action="delete" data-id="${escapeHtml(provider.id)}">删除</button>
      </div>
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) {
    return "不限";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "不限";
  }
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function renderGiftBatches() {
  if (!adminState.batches.length) {
    giftBatchList.innerHTML = `<div class="audit-row"><div class="audit-main"><strong>暂无批次</strong><span class="audit-meta"><span>创建后会显示在这里</span></span></div></div>`;
    return;
  }

  giftBatchList.innerHTML = adminState.batches.map(batch => {
    const counts = batch.counts || {};
    return `
      <div class="batch-row" data-batch-id="${escapeHtml(batch.id)}">
        <div class="batch-title">
          <strong>${escapeHtml(batch.label || "未命名批次")}</strong>
          <div class="batch-meta">
            <span>${escapeHtml(batch.credits)} 点/张</span>
            <span>${escapeHtml(batch.count)} 张</span>
            <span>过期 ${escapeHtml(formatDateTime(batch.expiresAt))}</span>
          </div>
          <div class="status-counts">
            <span>active ${counts.active || 0}</span>
            <span>redeemed ${counts.redeemed || 0}</span>
            <span>expired ${counts.expired || 0}</span>
            <span>disabled ${counts.disabled || 0}</span>
            <span>revoked ${counts.revoked || 0}</span>
          </div>
        </div>
        <div class="batch-actions">
          <button class="soft-button" type="button" data-admin-action="export-batch" data-id="${escapeHtml(batch.id)}">导出</button>
          <button class="soft-button" type="button" data-admin-action="disable-batch" data-id="${escapeHtml(batch.id)}">作废未用</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderGiftCards() {
  if (!adminState.giftCards.length) {
    giftCardTable.innerHTML = `<div class="audit-row"><div class="audit-main"><strong>暂无卡密</strong><span class="audit-meta"><span>调整筛选或创建新批次</span></span></div></div>`;
    return;
  }

  giftCardTable.innerHTML = adminState.giftCards.map(card => `
    <div class="gift-card-row" data-card-id="${escapeHtml(card.id)}">
      <div class="gift-main">
        <strong>${escapeHtml(card.keyPreview || card.id)}</strong>
        <div class="gift-meta">
          <span class="gift-status ${escapeHtml(card.status)}">${escapeHtml(card.status)}</span>
          <span>${escapeHtml(card.credits)} 点</span>
          <span>${escapeHtml(card.batchLabel || "未分批")}</span>
          <span>过期 ${escapeHtml(formatDateTime(card.expiresAt))}</span>
          ${card.redeemedByUserId ? `<span>用户 ${escapeHtml(card.redeemedByUserId)}</span>` : ""}
        </div>
      </div>
      <div class="gift-actions">
        ${card.status === "active" ? `<button class="soft-button" type="button" data-admin-action="disable-card" data-id="${escapeHtml(card.id)}">作废</button>` : ""}
        ${card.status === "disabled" ? `<button class="soft-button" type="button" data-admin-action="enable-card" data-id="${escapeHtml(card.id)}">启用</button>` : ""}
        ${card.status === "redeemed" ? `<button class="soft-button" type="button" data-admin-action="revoke-card" data-id="${escapeHtml(card.id)}">撤销</button>` : ""}
      </div>
    </div>
  `).join("");
}

function renderAuditLogs() {
  const logs = [
    ...adminState.adminLogs.map(log => ({ ...log, kind: "admin" })),
    ...adminState.creditLogs.map(log => ({ ...log, kind: "credit" }))
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);

  if (!logs.length) {
    auditLogList.innerHTML = `<div class="audit-row"><div class="audit-main"><strong>暂无审计记录</strong><span class="audit-meta"><span>创建或兑换卡密后会显示</span></span></div></div>`;
    return;
  }

  auditLogList.innerHTML = logs.map(log => {
    const title = log.kind === "credit"
      ? `${log.source || "credit"} ${Number(log.delta) > 0 ? "+" : ""}${log.delta || 0}`
      : log.action || "admin";
    const detail = log.detail ? Object.entries(log.detail).map(([key, value]) => `${key}: ${value}`).join(" · ") : (log.note || log.userId || "");
    return `
      <div class="audit-row">
        <div class="audit-main">
          <strong>${escapeHtml(title)}</strong>
          <div class="audit-meta">
            <span>${escapeHtml(formatDateTime(log.createdAt))}</span>
            ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function resetProviderForm() {
  providerId.value = "";
  providerLabel.value = "";
  providerApiUrl.value = "";
  providerApiKey.value = "";
  providerModel.value = "gpt-image-2";
  providerApiFormat.value = "compilation";
  providerEnabled.checked = true;
  providerNote.value = "";
  providerSaveButton.querySelector("span:last-child").textContent = "创建供应商";
}

function fillProviderForm(provider) {
  providerId.value = provider.id || "";
  providerLabel.value = provider.label || "";
  providerApiUrl.value = provider.apiUrl || "";
  providerApiKey.value = provider.apiKey || "";
  providerModel.value = provider.model || "gpt-image-2";
  providerApiFormat.value = provider.apiFormat || "compilation";
  providerEnabled.checked = Boolean(provider.enabled);
  providerNote.value = provider.note || "";
  providerSaveButton.querySelector("span:last-child").textContent = "保存供应商";
}

function getProviderFormBody() {
  return {
    label: providerLabel.value.trim(),
    apiUrl: providerApiUrl.value.trim(),
    apiKey: providerApiKey.value.trim(),
    model: providerModel.value.trim(),
    apiFormat: providerApiFormat.value,
    enabled: providerEnabled.checked,
    note: providerNote.value.trim()
  };
}

async function saveProvider(event) {
  event.preventDefault();
  const body = getProviderFormBody();
  const editingId = providerId.value.trim();
  const isEditing = Boolean(editingId);

  try {
    const payload = await adminFetch(isEditing ? `/api/admin/providers/${encodeURIComponent(editingId)}` : "/api/admin/providers", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(body)
    });
    if (payload.provider) {
      fillProviderForm(payload.provider);
    }
    await loadAdminData();
    showToast(isEditing ? "供应商已保存" : "供应商已创建");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function testProvider() {
  const editingId = providerId.value.trim();
  if (!editingId) {
    showToast("请先选择一个供应商再测试");
    return;
  }

  try {
    const payload = await adminFetch(`/api/admin/providers/${encodeURIComponent(editingId)}/test`, {
      method: "POST"
    });
    showToast(payload.detail || "连接测试完成");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function handleProviderAction(action, id) {
  if (action === "edit") {
    const provider = adminState.providers.find(item => item.id === id);
    if (provider) {
      fillProviderForm(provider);
    }
    return;
  }

  const routes = {
    enable: `/api/admin/providers/${encodeURIComponent(id)}/enable`,
    disable: `/api/admin/providers/${encodeURIComponent(id)}/disable`,
    activate: `/api/admin/providers/${encodeURIComponent(id)}/activate`,
    test: `/api/admin/providers/${encodeURIComponent(id)}/test`
  };

  if (action === "delete") {
    if (!window.confirm("确认删除这个供应商吗？")) {
      return;
    }
    try {
      await adminFetch(`/api/admin/providers/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (providerId.value === id) {
        resetProviderForm();
      }
      await loadAdminData();
      showToast("供应商已删除");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
    return;
  }

  if (!routes[action]) {
    return;
  }

  try {
    const payload = await adminFetch(routes[action], { method: "POST" });
    if (action === "test") {
      showToast(payload.detail || "测试完成");
      return;
    }
    await loadAdminData();
    showToast("操作已完成");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function createGiftBatch(event) {
  event.preventDefault();
  const body = {
    label: giftBatchLabel.value.trim(),
    credits: Number.parseInt(giftBatchCredits.value, 10),
    count: Number.parseInt(giftBatchCount.value, 10),
    expiresAt: giftBatchExpiresAt.value ? new Date(`${giftBatchExpiresAt.value}T23:59:59`).toISOString() : "",
    note: giftBatchNote.value.trim()
  };

  try {
    const payload = await adminFetch("/api/admin/gift-cards", {
      method: "POST",
      body: JSON.stringify(body)
    });
    renderCreatedGiftCards(payload.giftCards || []);
    giftBatchForm.reset();
    giftBatchCredits.value = "10";
    giftBatchCount.value = "5";
    await loadAdminData();
    showToast(`已生成 ${payload.giftCards?.length || 0} 张卡密`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

function renderCreatedGiftCards(cards) {
  createdGiftCards.classList.toggle("hidden", cards.length === 0);
  createdGiftCards.innerHTML = cards.map(card => `
    <div class="created-card-row">
      <code>${escapeHtml(card.key)}</code>
      <span>${escapeHtml(card.credits)} 点</span>
      <button class="soft-button" type="button" data-admin-action="copy-created-key" data-key="${escapeHtml(card.key)}">复制</button>
    </div>
  `).join("");
}

async function handleAdminAction(action, id) {
  if (action === "export-batch") {
    await exportBatchKeys(id);
    return;
  }

  const paths = {
    "disable-card": `/api/admin/gift-cards/${encodeURIComponent(id)}/disable`,
    "enable-card": `/api/admin/gift-cards/${encodeURIComponent(id)}/enable`,
    "revoke-card": `/api/admin/gift-cards/${encodeURIComponent(id)}/revoke`,
    "disable-batch": `/api/admin/gift-card-batches/${encodeURIComponent(id)}/disable`
  };
  if (!paths[action]) {
    return;
  }

  try {
    await adminFetch(paths[action], { method: "POST" });
    await loadAdminData();
    showToast("操作已完成");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function exportBatchKeys(id) {
  try {
    const payload = await adminFetch(`/api/admin/gift-card-batches/${encodeURIComponent(id)}/export`);
    const text = (payload.keys || []).join("\n");
    if (!text) {
      showToast("这个批次没有可导出的 Key");
      return;
    }

    await copyText(text);
    showToast(`已复制 ${payload.keys.length} 个 Key`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function logoutAdmin() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.assign("/admin");
}

refreshAdminButton.addEventListener("click", loadAdminData);
providerReloadButton.addEventListener("click", loadAdminData);
adminLogoutButton.addEventListener("click", logoutAdmin);
providerForm.addEventListener("submit", saveProvider);
providerResetButton.addEventListener("click", resetProviderForm);
providerTestButton.addEventListener("click", testProvider);
giftBatchForm.addEventListener("submit", createGiftBatch);
giftSearchInput.addEventListener("input", () => {
  window.clearTimeout(giftSearchInput.searchTimer);
  giftSearchInput.searchTimer = window.setTimeout(loadAdminData, 250);
});
giftStatusFilter.addEventListener("change", loadAdminData);
createdGiftCards.addEventListener("click", async event => {
  const button = event.target.closest("[data-admin-action='copy-created-key']");
  if (!button) {
    return;
  }

  await copyText(button.dataset.key || "");
  showToast("卡密已复制");
});
giftBatchList.addEventListener("click", event => {
  const button = event.target.closest("[data-admin-action]");
  if (button) {
    handleAdminAction(button.dataset.adminAction, button.dataset.id);
  }
});
giftCardTable.addEventListener("click", event => {
  const button = event.target.closest("[data-admin-action]");
  if (button) {
    handleAdminAction(button.dataset.adminAction, button.dataset.id);
  }
});
providerList.addEventListener("click", event => {
  const button = event.target.closest("[data-provider-action]");
  if (button) {
    handleProviderAction(button.dataset.providerAction, button.dataset.id);
  }
});

loadAdminData();
