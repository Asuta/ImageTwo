const refreshAdminButton = document.querySelector("#refreshAdminButton");
const providerReloadButton = document.querySelector("#providerReloadButton");
const adminLogoutButton = document.querySelector("#adminLogoutButton");
const adminTabs = [...document.querySelectorAll("[data-admin-tab]")];
const adminPanels = [...document.querySelectorAll("[data-admin-panel]")];
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
const historyReloadButton = document.querySelector("#historyReloadButton");
const historyTrimButton = document.querySelector("#historyTrimButton");
const historyExportCsvButton = document.querySelector("#historyExportCsvButton");
const historyExportJsonButton = document.querySelector("#historyExportJsonButton");
const historySummary = document.querySelector("#historySummary");
const historySearchInput = document.querySelector("#historySearchInput");
const historyEmailInput = document.querySelector("#historyEmailInput");
const historyRangeFilter = document.querySelector("#historyRangeFilter");
const historyFromInput = document.querySelector("#historyFromInput");
const historyToInput = document.querySelector("#historyToInput");
const historyStatusFilter = document.querySelector("#historyStatusFilter");
const historyModeFilter = document.querySelector("#historyModeFilter");
const historyQualityFilter = document.querySelector("#historyQualityFilter");
const historyProviderFilter = document.querySelector("#historyProviderFilter");
const historyDailyChart = document.querySelector("#historyDailyChart");
const historyStatusChart = document.querySelector("#historyStatusChart");
const historyTopUsers = document.querySelector("#historyTopUsers");
const historyModeQuality = document.querySelector("#historyModeQuality");
const generationHistoryList = document.querySelector("#generationHistoryList");
const historyPrevButton = document.querySelector("#historyPrevButton");
const historyNextButton = document.querySelector("#historyNextButton");
const historyPageInfo = document.querySelector("#historyPageInfo");
const historyDetailPanel = document.querySelector("#historyDetailPanel");
const toast = document.querySelector("#toast");

let adminState = {
  providers: [],
  activeProvider: null,
  batches: [],
  giftCards: [],
  adminLogs: [],
  creditLogs: [],
  usageLogs: [],
  generationHistory: [],
  historyAnalytics: null,
  historyTotal: 0,
  historyPage: 1,
  historyPageSize: 18,
  historyProviders: []
};

const adminTabTitles = {
  history: "生成历史",
  keys: "卡密管理",
  providers: "供应商配置"
};

function getInitialAdminTab() {
  const hash = window.location.hash.replace(/^#/, "");
  return adminTabTitles[hash] ? hash : "history";
}

function setActiveAdminTab(tabName, { updateHash = true } = {}) {
  const nextTab = adminTabTitles[tabName] ? tabName : "history";
  adminTabs.forEach(tab => {
    const active = tab.dataset.adminTab === nextTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  adminPanels.forEach(panel => {
    panel.classList.toggle("active", panel.dataset.adminPanel === nextTab);
  });
  document.querySelector(".admin-header h1").textContent = adminTabTitles[nextTab];
  if (updateHash && window.location.hash !== `#${nextTab}`) {
    history.replaceState(null, "", `#${nextTab}`);
  }
}

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

function getHistoryParams({ includePage = true, exportFormat = "" } = {}) {
  const params = new URLSearchParams();
  const query = historySearchInput.value.trim();
  const email = historyEmailInput.value.trim();
  const status = historyStatusFilter.value;
  const mode = historyModeFilter.value;
  const quality = historyQualityFilter.value;
  const providerId = historyProviderFilter.value;
  const range = getHistoryDateRange();

  if (query) {
    params.set("q", query);
  }
  if (email) {
    params.set("email", email);
  }
  if (status) {
    params.set("status", status);
  }
  if (mode) {
    params.set("mode", mode);
  }
  if (quality) {
    params.set("quality", quality);
  }
  if (providerId) {
    params.set("providerId", providerId);
  }
  if (range.from) {
    params.set("from", range.from);
  }
  if (range.to) {
    params.set("to", range.to);
  }
  if (includePage) {
    params.set("page", String(adminState.historyPage));
    params.set("pageSize", String(adminState.historyPageSize));
  }
  if (exportFormat) {
    params.set("format", exportFormat);
  }
  return params;
}

function getHistoryDateRange() {
  const value = historyRangeFilter.value;
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (value === "today") {
    return { from: toDateInput(today), to: toDateInput(now) };
  }
  if (value === "7d" || value === "30d") {
    const days = value === "7d" ? 6 : 29;
    const from = new Date(today);
    from.setDate(from.getDate() - days);
    return { from: toDateInput(from), to: toDateInput(now) };
  }
  if (value === "custom") {
    return { from: historyFromInput.value, to: historyToInput.value };
  }
  return { from: "", to: "" };
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function loadAdminData() {
  refreshAdminButton.disabled = true;
  providerReloadButton.disabled = true;
  historyReloadButton.disabled = true;
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
      usageLogs: auditPayload.usageLogs || [],
      generationHistory: adminState.generationHistory,
      historyAnalytics: adminState.historyAnalytics,
      historyTotal: adminState.historyTotal,
      historyPage: adminState.historyPage,
      historyPageSize: adminState.historyPageSize,
      historyProviders: adminState.historyProviders
    };
    await loadGenerationHistory(false);
    renderAdmin();
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    refreshAdminButton.disabled = false;
    providerReloadButton.disabled = false;
    historyReloadButton.disabled = false;
  }
}

async function loadGenerationHistory(shouldRender = true) {
  historyReloadButton.disabled = true;
  try {
    const params = getHistoryParams();
    const payload = await adminFetch(`/api/admin/generation-history?${params}`);
    adminState.generationHistory = payload.records || [];
    adminState.historyAnalytics = payload.analytics || null;
    adminState.historyTotal = payload.total || 0;
    adminState.historyPage = payload.page || adminState.historyPage;
    adminState.historyPageSize = payload.pageSize || adminState.historyPageSize;
    adminState.historyProviders = payload.providers || [];
    if (shouldRender) {
      renderHistoryDashboard();
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    historyReloadButton.disabled = false;
  }
}

function renderAdmin() {
  renderProviderSummary();
  renderProviderList();
  renderGiftBatches();
  renderGiftCards();
  renderAuditLogs();
  renderHistoryDashboard();
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

function formatFullDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDuration(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) {
    return "-";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }
  return `${bytes}B`;
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
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

function renderHistoryDashboard() {
  renderHistoryProviderFilter();
  renderHistorySummary();
  renderHistoryCharts();
  renderGenerationHistoryList();
  renderHistoryPagination();
  historyFromInput.classList.toggle("hidden", historyRangeFilter.value !== "custom");
  historyToInput.classList.toggle("hidden", historyRangeFilter.value !== "custom");
}

function renderHistoryProviderFilter() {
  const currentValue = historyProviderFilter.value;
  historyProviderFilter.innerHTML = [
    `<option value="">全部供应商</option>`,
    ...adminState.historyProviders.map(provider => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.label || provider.id)}</option>`)
  ].join("");
  historyProviderFilter.value = currentValue;
}

function renderHistorySummary() {
  const summary = adminState.historyAnalytics?.summary || {};
  const assetBytes = summary.assetBytes || 0;
  const assetMaxBytes = summary.assetMaxBytes || 0;
  historySummary.innerHTML = [
    ["今日生成", summary.todayTotal || 0, "本日请求数"],
    ["成功率", formatPercent(summary.successRate), `${summary.succeeded || 0} 成功 / ${summary.failed || 0} 失败`],
    ["平均耗时", formatDuration(summary.avgDurationMs), "筛选范围内"],
    ["活跃用户", summary.activeUsersToday || 0, "今日不同用户"],
    ["今日额度", summary.creditsToday || 0, "今日消耗点数"],
    ["历史容量", `${formatBytes(assetBytes)} / ${formatBytes(assetMaxBytes)}`, `已用 ${formatPercent(summary.assetPercent)}`]
  ].map(([label, value, hint]) => `
    <div class="history-summary-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <em>${escapeHtml(hint)}</em>
    </div>
  `).join("");
}

function renderHistoryCharts() {
  const analytics = adminState.historyAnalytics || {};
  const daily = analytics.daily || [];
  const maxDaily = Math.max(1, ...daily.map(item => item.count || 0));
  historyDailyChart.innerHTML = daily.length ? daily.map(item => `
    <div class="bar-chart-item" title="${escapeHtml(item.date)} ${escapeHtml(item.count)} 次">
      <span style="height:${Math.max(8, (item.count / maxDaily) * 100)}%"></span>
      <em>${escapeHtml(item.date.slice(5))}</em>
    </div>
  `).join("") : `<div class="history-empty">暂无趋势数据</div>`;

  const statuses = analytics.status || [];
  const totalStatus = Math.max(1, statuses.reduce((sum, item) => sum + item.count, 0));
  historyStatusChart.innerHTML = statuses.length ? statuses.map(item => `
    <div class="donut-row">
      <span>${escapeHtml(statusLabel(item.key))}</span>
      <strong>${escapeHtml(item.count)}</strong>
      <em style="width:${Math.max(4, (item.count / totalStatus) * 100)}%"></em>
    </div>
  `).join("") : `<div class="history-empty">暂无状态数据</div>`;

  const topUsers = analytics.topUsers || [];
  historyTopUsers.innerHTML = topUsers.length ? topUsers.map(user => `
    <div class="rank-row">
      <span>${escapeHtml(user.email || user.userId || "unknown")}</span>
      <strong>${escapeHtml(user.count)} 次</strong>
      <em>${escapeHtml(user.credits)} 点</em>
    </div>
  `).join("") : `<div class="history-empty">暂无用户数据</div>`;

  const modes = analytics.modes || [];
  const qualities = analytics.qualities || [];
  historyModeQuality.innerHTML = [
    ...modes.map(item => ["模式", modeLabel(item.key), item.count]),
    ...qualities.map(item => ["质量", item.key, item.count])
  ].map(([group, label, count]) => `
    <div class="mini-metric-row">
      <span>${escapeHtml(group)}</span>
      <strong>${escapeHtml(label)}</strong>
      <em>${escapeHtml(count)}</em>
    </div>
  `).join("") || `<div class="history-empty">暂无分布数据</div>`;
}

function renderGenerationHistoryList() {
  if (!adminState.generationHistory.length) {
    generationHistoryList.innerHTML = `<div class="history-empty large">暂无生成历史，或当前筛选条件没有结果。</div>`;
    return;
  }

  generationHistoryList.innerHTML = adminState.generationHistory.map(record => {
    const generated = record.assets?.generated || [];
    const references = record.assets?.references || [];
    return `
      <article class="generation-history-row" data-request-id="${escapeHtml(record.requestId)}">
        <div class="history-row-main">
          <div class="history-row-title">
            <strong>${escapeHtml(record.email || record.userId || "未知用户")}</strong>
            <span class="history-status ${escapeHtml(record.assetsPruned ? "pruned" : record.status || "")}">${escapeHtml(record.assetsPruned ? "图片已清理" : statusLabel(record.status))}</span>
          </div>
          <p>${escapeHtml(record.prompt || "")}</p>
          <div class="history-row-meta">
            <span>${escapeHtml(formatFullDateTime(record.createdAt))}</span>
            <span>${escapeHtml(formatDuration(record.durationMs))}</span>
            <span>${escapeHtml(modeLabel(record.mode))}</span>
            <span>${escapeHtml(record.quality || "-")}</span>
            <span>${escapeHtml(record.aspectRatio || "-")}</span>
            <span>${escapeHtml(record.providerLabel || "-")}</span>
            <span>${escapeHtml(record.costCredits || 0)} 点</span>
          </div>
        </div>
        <div class="history-assets-preview">
          ${renderAssetThumbs(references, "参考图", record.assetsPruned)}
          ${renderAssetThumbs(generated, "生成图", record.assetsPruned)}
        </div>
        <div class="history-row-actions">
          <button class="soft-button" type="button" data-history-detail="${escapeHtml(record.requestId)}">详情</button>
          <button class="soft-button danger" type="button" data-history-delete="${escapeHtml(record.requestId)}">删除</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderAssetThumbs(assets, label, pruned) {
  if (pruned) {
    return `<div class="history-thumb-placeholder">${escapeHtml(label)}已清理</div>`;
  }
  if (!assets.length) {
    return `<div class="history-thumb-placeholder">无${escapeHtml(label)}</div>`;
  }
  return assets.slice(0, 4).map(asset => `
    <img class="history-thumb" src="${escapeHtml(asset.thumbUrl || asset.url)}" alt="${escapeHtml(label)}" loading="lazy" />
  `).join("");
}

function renderHistoryPagination() {
  const totalPages = Math.max(1, Math.ceil(adminState.historyTotal / adminState.historyPageSize));
  historyPageInfo.textContent = `第 ${adminState.historyPage} / ${totalPages} 页 · ${adminState.historyTotal} 条`;
  historyPrevButton.disabled = adminState.historyPage <= 1;
  historyNextButton.disabled = adminState.historyPage >= totalPages;
}

function statusLabel(status) {
  const labels = {
    succeeded: "成功",
    failed: "失败",
    running: "运行中",
    pending: "等待中",
    pruned: "图片已清理",
    refunded: "已退款"
  };
  return labels[status] || status || "-";
}

function modeLabel(mode) {
  if (mode === "edit") {
    return "参考图编辑";
  }
  if (mode === "generate") {
    return "文生图";
  }
  return mode || "-";
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

async function showHistoryDetail(requestId) {
  try {
    const payload = await adminFetch(`/api/admin/generation-history/${encodeURIComponent(requestId)}`);
    const record = payload.record;
    if (!record) {
      return;
    }
    historyDetailPanel.classList.remove("hidden");
    historyDetailPanel.dataset.requestId = requestId;
    historyDetailPanel.innerHTML = `
      <div class="history-detail-head">
        <div>
          <strong>${escapeHtml(record.email || record.userId || "未知用户")}</strong>
          <span>${escapeHtml(record.requestId)}</span>
        </div>
        <button class="soft-button" type="button" data-history-close>关闭</button>
      </div>
      <div class="history-detail-grid">
        <div><span>状态</span><strong>${escapeHtml(record.assetsPruned ? "图片已清理" : statusLabel(record.status))}</strong></div>
        <div><span>生成时间</span><strong>${escapeHtml(formatFullDateTime(record.createdAt))}</strong></div>
        <div><span>耗时</span><strong>${escapeHtml(formatDuration(record.durationMs))}</strong></div>
        <div><span>模式</span><strong>${escapeHtml(modeLabel(record.mode))}</strong></div>
        <div><span>质量 / 比例</span><strong>${escapeHtml(`${record.quality || "-"} / ${record.aspectRatio || "-"}`)}</strong></div>
        <div><span>供应商</span><strong>${escapeHtml(record.providerLabel || "-")}</strong></div>
        <div><span>模型</span><strong>${escapeHtml(record.model || "-")}</strong></div>
        <div><span>额度</span><strong>${escapeHtml(record.costCredits || 0)} 点，余额 ${escapeHtml(record.remainingCredits ?? "-")}</strong></div>
      </div>
      ${record.errorMessage ? `<div class="history-detail-error">${escapeHtml(record.errorMessage)}</div>` : ""}
      ${record.assetSaveFailed ? `<div class="history-detail-error">图片保存失败：${escapeHtml(record.assetSaveError || "")}</div>` : ""}
      <div class="history-detail-section">
        <span>用户提示词</span>
        <pre>${escapeHtml(record.prompt || "")}</pre>
      </div>
      <div class="history-detail-section">
        <span>服务端提示词</span>
        <pre>${escapeHtml(record.imagePrompt || "")}</pre>
      </div>
      <div class="history-detail-section">
        <span>参考图</span>
        <div class="history-detail-assets">${renderDetailAssets(record.assets?.references || [], record.assetsPruned, "参考图")}</div>
      </div>
      <div class="history-detail-section">
        <span>生成图</span>
        <div class="history-detail-assets">${renderDetailAssets(record.assets?.generated || [], record.assetsPruned, "生成图")}</div>
      </div>
    `;
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

async function deleteHistoryRecord(requestId, button) {
  const record = adminState.generationHistory.find(item => item.requestId === requestId);
  const label = record?.email || record?.userId || requestId;
  if (!window.confirm(`确认删除这条生成历史吗？\n${label}\n${requestId}\n\n对应的参考图和生成图文件也会一起删除。`)) {
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "删除中";
    }
    await adminFetch(`/api/admin/generation-history/${encodeURIComponent(requestId)}`, { method: "DELETE" });
    if (historyDetailPanel.dataset.requestId === requestId) {
      historyDetailPanel.classList.add("hidden");
      historyDetailPanel.innerHTML = "";
      historyDetailPanel.dataset.requestId = "";
    }
    const currentPageCount = adminState.generationHistory.length;
    if (currentPageCount <= 1 && adminState.historyPage > 1) {
      adminState.historyPage -= 1;
    }
    await loadGenerationHistory();
    showToast("生成历史已删除");
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "删除";
    }
  }
}

function renderDetailAssets(assets, pruned, label) {
  if (pruned) {
    return `<div class="history-thumb-placeholder large">${escapeHtml(label)}已被容量清理</div>`;
  }
  if (!assets.length) {
    return `<div class="history-thumb-placeholder large">无${escapeHtml(label)}</div>`;
  }
  return assets.map(asset => `
    <a href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer">
      <img src="${escapeHtml(asset.thumbUrl || asset.url)}" alt="${escapeHtml(asset.name || label)}" loading="lazy" />
      <span>${escapeHtml(asset.name || asset.id)} · ${escapeHtml(formatBytes(asset.bytes))}</span>
    </a>
  `).join("");
}

async function trimHistoryAssets() {
  try {
    const result = await adminFetch("/api/admin/generation-history/trim", { method: "POST" });
    adminState.historyPage = 1;
    await loadGenerationHistory();
    showToast(`已清理 ${result.prunedRecords || 0} 条，当前占用 ${formatBytes(result.usedBytes || 0)}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error));
  }
}

function exportGenerationHistory(format) {
  const params = getHistoryParams({ includePage: false, exportFormat: format });
  window.open(`/api/admin/generation-history/export?${params}`, "_blank", "noopener,noreferrer");
}

function scheduleHistoryReload() {
  adminState.historyPage = 1;
  window.clearTimeout(scheduleHistoryReload.timer);
  scheduleHistoryReload.timer = window.setTimeout(() => loadGenerationHistory(), 250);
}

async function logoutAdmin() {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.assign("/admin");
}

refreshAdminButton.addEventListener("click", loadAdminData);
providerReloadButton.addEventListener("click", loadAdminData);
adminLogoutButton.addEventListener("click", logoutAdmin);
adminTabs.forEach(tab => {
  tab.addEventListener("click", () => setActiveAdminTab(tab.dataset.adminTab));
});
window.addEventListener("hashchange", () => setActiveAdminTab(getInitialAdminTab(), { updateHash: false }));
providerForm.addEventListener("submit", saveProvider);
providerResetButton.addEventListener("click", resetProviderForm);
providerTestButton.addEventListener("click", testProvider);
giftBatchForm.addEventListener("submit", createGiftBatch);
giftSearchInput.addEventListener("input", () => {
  window.clearTimeout(giftSearchInput.searchTimer);
  giftSearchInput.searchTimer = window.setTimeout(loadAdminData, 250);
});
giftStatusFilter.addEventListener("change", loadAdminData);
historyReloadButton.addEventListener("click", () => loadGenerationHistory());
historyTrimButton.addEventListener("click", trimHistoryAssets);
historyExportCsvButton.addEventListener("click", () => exportGenerationHistory("csv"));
historyExportJsonButton.addEventListener("click", () => exportGenerationHistory("json"));
[historySearchInput, historyEmailInput].forEach(input => {
  input.addEventListener("input", scheduleHistoryReload);
});
[historyRangeFilter, historyFromInput, historyToInput, historyStatusFilter, historyModeFilter, historyQualityFilter, historyProviderFilter].forEach(input => {
  input.addEventListener("change", scheduleHistoryReload);
});
historyPrevButton.addEventListener("click", () => {
  if (adminState.historyPage > 1) {
    adminState.historyPage -= 1;
    loadGenerationHistory();
  }
});
historyNextButton.addEventListener("click", () => {
  const totalPages = Math.max(1, Math.ceil(adminState.historyTotal / adminState.historyPageSize));
  if (adminState.historyPage < totalPages) {
    adminState.historyPage += 1;
    loadGenerationHistory();
  }
});
generationHistoryList.addEventListener("click", event => {
  const detailButton = event.target.closest("[data-history-detail]");
  if (detailButton) {
    showHistoryDetail(detailButton.dataset.historyDetail);
    return;
  }

  const deleteButton = event.target.closest("[data-history-delete]");
  if (deleteButton) {
    deleteHistoryRecord(deleteButton.dataset.historyDelete, deleteButton);
  }
});
historyDetailPanel.addEventListener("click", event => {
  if (event.target.closest("[data-history-close]")) {
    historyDetailPanel.classList.add("hidden");
    historyDetailPanel.innerHTML = "";
    historyDetailPanel.dataset.requestId = "";
  }
});
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

setActiveAdminTab(getInitialAdminTab(), { updateHash: false });
loadAdminData();
