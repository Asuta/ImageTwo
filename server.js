import { createServer } from "node:http";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const distDir = join(__dirname, "dist");

loadLocalEnv();

const START_PORT = Number(process.env.PORT || 5180);
const HOST = process.env.HOST || "0.0.0.0";
const DEFAULT_API_URL = process.env.IMAGE2_API_URL || "https://api.bltcy.ai/v1/chat/completions";
const DEFAULT_MODEL = process.env.IMAGE2_MODEL || "gpt-image-2";
const dataDir = process.env.IMAGE2_DATA_DIR || join(__dirname, "data");
const dataPath = join(dataDir, "image2-data.json");
const historyAssetsDir = join(dataDir, "history-assets");
const DEFAULT_HISTORY_MAX_BYTES = 3 * 1024 * 1024 * 1024;
const HISTORY_MAX_BYTES = Math.max(0, Number.parseInt(process.env.IMAGE2_HISTORY_MAX_BYTES || String(DEFAULT_HISTORY_MAX_BYTES), 10));
const HISTORY_THUMB_SIZE = Math.max(64, Number.parseInt(process.env.IMAGE2_HISTORY_THUMB_SIZE || "256", 10));
const DEFAULT_SIGNUP_CREDITS = Number.parseInt(process.env.IMAGE2_SIGNUP_CREDITS || "100", 10);
const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_COOLDOWN_MS = 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "image2_session";
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_COOKIE_NAME = "image2_admin";

const qualityOptions = new Set(["low", "medium", "high"]);
const aspectRatioOptions = new Set(["auto", "9:21", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"]);
const giftCardStatuses = new Set(["active", "disabled", "redeemed", "revoked"]);
const providerFormats = new Set(["responses", "responses-edits", "compilation"]);
const generationJobs = new Map();
const JOB_TTL_MS = 15 * 60 * 1000;
const PARTIAL_IMAGE_MIN_BASE64_CHARS = 1600;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8"
};
mkdirSync(dataDir, { recursive: true });
mkdirSync(historyAssetsDir, { recursive: true });
ensureDataFile();

function loadLocalEnv() {
  const envPaths = [
    getSharedEnvPath(),
    join(__dirname, ".env")
  ];

  for (const envPath of envPaths) {
    loadEnvFile(envPath);
  }
}

function getSharedEnvPath() {
  return resolve(process.env.IMAGE2_ENV_FILE || join(homedir(), ".image2.env"));
}

function loadEnvFile(envPath) {
  if (!existsSync(envPath)) {
    return;
  }

  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).replace(/^\uFEFF/, "").trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(text);
}

function getImageApiKey() {
  return process.env.IMAGE2_API_KEY || process.env.NOWCODING_API_KEY || "";
}

function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createRequestId() {
  return `image2_req_${randomUUID()}`;
}

function createGiftCardKey() {
  return `gift_${randomBytes(18).toString("base64url")}`;
}

function createLoginCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function ensureDataFile() {
  if (existsSync(dataPath)) {
    migrateProviderConfigToEnv();
    const data = readData();
    if (!Array.isArray(data.providers) || data.providers.length === 0) {
      data.providers = [createDefaultProvider()];
      data.activeProviderId = data.providers[0].id;
      writeData(data);
      return;
    }

    if (!data.activeProviderId || !data.providers.some(provider => provider.id === data.activeProviderId && provider.enabled)) {
      data.activeProviderId = data.providers.find(provider => provider.enabled)?.id || data.providers[0]?.id || "";
      writeData(data);
    }
    return;
  }

  writeData({
    users: [],
    sessions: [],
    emailCodes: [],
    giftCardBatches: [],
    giftCards: [],
    creditLogs: [],
    adminLogs: [],
    usageLogs: [],
    generationHistory: [],
    providers: [createDefaultProvider()],
    activeProviderId: "default-provider"
  });
}

function readData() {
  try {
    const data = JSON.parse(readFileSync(dataPath, "utf8").replace(/^\uFEFF/, ""));
    return {
      users: Array.isArray(data.users) ? data.users : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      emailCodes: Array.isArray(data.emailCodes) ? data.emailCodes : [],
      giftCardBatches: Array.isArray(data.giftCardBatches) ? data.giftCardBatches : [],
      giftCards: normalizeGiftCards(Array.isArray(data.giftCards) ? data.giftCards : []),
      creditLogs: Array.isArray(data.creditLogs) ? data.creditLogs : [],
      adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : [],
      usageLogs: Array.isArray(data.usageLogs) ? data.usageLogs : [],
      generationHistory: Array.isArray(data.generationHistory) ? data.generationHistory : [],
      ...readProviderStore(data)
    };
  } catch {
    return {
      users: [],
      sessions: [],
      emailCodes: [],
      giftCardBatches: [],
      giftCards: [],
      creditLogs: [],
      adminLogs: [],
      usageLogs: [],
      generationHistory: [],
      ...readProviderStore({})
    };
  }
}

function writeData(data) {
  const tmpPath = `${dataPath}.tmp`;
  const storableData = {
    users: Array.isArray(data.users) ? data.users : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    emailCodes: Array.isArray(data.emailCodes) ? data.emailCodes : [],
    giftCardBatches: Array.isArray(data.giftCardBatches) ? data.giftCardBatches : [],
    giftCards: normalizeGiftCards(Array.isArray(data.giftCards) ? data.giftCards : []),
    creditLogs: Array.isArray(data.creditLogs) ? data.creditLogs : [],
    adminLogs: Array.isArray(data.adminLogs) ? data.adminLogs : [],
    usageLogs: Array.isArray(data.usageLogs) ? data.usageLogs : [],
    generationHistory: Array.isArray(data.generationHistory) ? data.generationHistory : []
  };
  writeProviderStore(data);
  writeFileSync(tmpPath, JSON.stringify(storableData, null, 2));
  renameSync(tmpPath, dataPath);
}

function readProviderStore(data = {}) {
  const envStore = readProviderStoreFromEnv();
  if (envStore) {
    return envStore;
  }

  return normalizeProviderStore(
    Array.isArray(data.providers) ? data.providers : [],
    typeof data.activeProviderId === "string" ? data.activeProviderId : ""
  );
}

function readProviderStoreFromEnv() {
  const rawProviders = String(process.env.IMAGE2_PROVIDERS_JSON || "").trim();
  if (!rawProviders) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawProviders);
    const providerList = Array.isArray(parsed) ? parsed : parsed.providers;
    return normalizeProviderStore(
      Array.isArray(providerList) ? providerList : [],
      process.env.IMAGE2_ACTIVE_PROVIDER_ID || parsed.activeProviderId || ""
    );
  } catch {
    return null;
  }
}

function normalizeProviderStore(providers, activeProviderId = "") {
  const normalizedProviders = normalizeProviders(Array.isArray(providers) ? providers : []);
  if (!normalizedProviders.length) {
    normalizedProviders.push(createDefaultProvider());
  }

  let normalizedActiveProviderId = String(activeProviderId || "");
  if (!normalizedProviders.some(provider => provider.id === normalizedActiveProviderId && provider.enabled)) {
    normalizedActiveProviderId = normalizedProviders.find(provider => provider.enabled)?.id || normalizedProviders[0]?.id || "";
  }

  return {
    providers: normalizedProviders,
    activeProviderId: normalizedActiveProviderId
  };
}

function writeProviderStore(data) {
  const providerStore = normalizeProviderStore(data.providers, data.activeProviderId);
  updateSharedEnvFile({
    IMAGE2_PROVIDERS_JSON: JSON.stringify(providerStore.providers),
    IMAGE2_ACTIVE_PROVIDER_ID: providerStore.activeProviderId
  });
}

function migrateProviderConfigToEnv() {
  if (readProviderStoreFromEnv()) {
    return;
  }

  try {
    const rawData = JSON.parse(readFileSync(dataPath, "utf8").replace(/^\uFEFF/, ""));
    if (Array.isArray(rawData.providers) && rawData.providers.length) {
      writeProviderStore(rawData);
    }
  } catch {
    // Ignore migration failures; readData will fall back to the default provider.
  }
}

function updateSharedEnvFile(values) {
  const envPath = getSharedEnvPath();
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values).map(([key, value]) => [key, String(value ?? "")]));
  const nextLines = lines.map(line => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match || !pending.has(match[1])) {
      return line;
    }

    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of pending) {
    nextLines.push(`${key}=${value}`);
  }

  mkdirSync(resolve(envPath, ".."), { recursive: true });
  writeFileSync(envPath, nextLines.join("\n").replace(/\n*$/, "\n"));
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = String(value ?? "");
  }
}

function createDefaultProvider() {
  const now = new Date().toISOString();
  return normalizeProvider({
    id: "default-provider",
    label: "默认百拉图",
    apiUrl: DEFAULT_API_URL,
    apiKey: getImageApiKey(),
    model: DEFAULT_MODEL,
    apiFormat: detectProviderFormat(DEFAULT_API_URL),
    enabled: true,
    note: "系统默认配置",
    createdAt: now,
    updatedAt: now
  }, now);
}

function normalizeProvider(provider, now = new Date().toISOString()) {
  const apiUrl = String(provider?.apiUrl || provider?.endpoint || DEFAULT_API_URL).trim();
  const apiFormat = normalizeProviderFormat(provider?.apiFormat || provider?.format || detectProviderFormat(apiUrl));
  return {
    id: String(provider?.id || randomUUID()),
    label: String(provider?.label || provider?.name || "未命名供应商").trim().slice(0, 80),
    apiUrl,
    apiKey: String(provider?.apiKey || "").trim(),
    model: String(provider?.model || DEFAULT_MODEL).trim().slice(0, 120),
    apiFormat,
    enabled: provider?.enabled !== false,
    note: String(provider?.note || "").trim().slice(0, 200),
    createdAt: provider?.createdAt || now,
    updatedAt: provider?.updatedAt || provider?.createdAt || now
  };
}

function normalizeProviders(providers) {
  return providers.map(provider => normalizeProvider(provider));
}

function normalizeProviderFormat(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "responses" || normalized === "response" || normalized === "openai-responses") {
    return "responses";
  }

  if (
    normalized === "responses-edits" ||
    normalized === "response-edits" ||
    normalized === "openai-responses-edits" ||
    normalized === "aihub-responses" ||
    normalized === "aihub"
  ) {
    return "responses-edits";
  }

  if (
    normalized === "compilation" ||
    normalized === "completions" ||
    normalized === "completion" ||
    normalized === "chat" ||
    normalized === "chat-completions"
  ) {
    return "compilation";
  }

  return providerFormats.has(normalized) ? normalized : "compilation";
}

function detectProviderFormat(apiUrl) {
  return /\/v1\/responses(\?|$)/i.test(String(apiUrl || "")) ? "responses" : "compilation";
}

function getProviderFormatLabel(value) {
  const format = normalizeProviderFormat(value);
  if (format === "responses") {
    return "OpenAI Response";
  }
  if (format === "responses-edits") {
    return "Response + Image Edit";
  }
  return "Compilation";
}

function getProviderSecret(provider) {
  return String(provider?.apiKey || "").trim() || getImageApiKey();
}

function getActiveProvider(data) {
  const providers = Array.isArray(data.providers) ? data.providers : [];
  const activeById = providers.find(provider => provider.id === data.activeProviderId && provider.enabled);
  if (activeById) {
    return activeById;
  }

  return providers.find(provider => provider.enabled) || null;
}

function applyProviderSelection(data) {
  const activeProvider = getActiveProvider(data);
  data.activeProviderId = activeProvider?.id || "";
  return activeProvider;
}

function publicProvider(provider, activeProviderId) {
  return {
    id: provider.id,
    label: provider.label,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    model: provider.model,
    apiFormat: provider.apiFormat,
    enabled: provider.enabled,
    note: provider.note,
    hasApiKey: Boolean(provider.apiKey),
    isActive: provider.id === activeProviderId,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  };
}

function publicProviderSummary(provider) {
  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    label: provider.label,
    apiUrl: provider.apiUrl,
    model: provider.model,
    apiFormat: provider.apiFormat,
    enabled: provider.enabled,
    note: provider.note,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt
  };
}

function normalizeGiftCards(cards) {
  return cards.map(card => {
    const key = typeof card.key === "string" ? card.key : "";
    const keyHash = card.keyHash || (key ? hashSecret(key) : "");
    const status = giftCardStatuses.has(card.status) ? card.status : "active";
    return {
      id: card.id || randomUUID(),
      key,
      keyHash,
      keyPreview: card.keyPreview || (key ? `${key.slice(0, 9)}...${key.slice(-4)}` : ""),
      batchId: card.batchId || "",
      batchLabel: card.batchLabel || card.label || "",
      label: card.label || card.batchLabel || "",
      credits: Number.isFinite(Number(card.credits)) ? Number(card.credits) : 0,
      status,
      expiresAt: card.expiresAt || "",
      redeemLimit: Math.max(1, Number.parseInt(card.redeemLimit, 10) || 1),
      redeemedByUserId: card.redeemedByUserId || "",
      redeemedAt: card.redeemedAt || "",
      revokedAt: card.revokedAt || "",
      revokedBy: card.revokedBy || "",
      disabledAt: card.disabledAt || "",
      createdAt: card.createdAt || new Date().toISOString(),
      updatedAt: card.updatedAt || card.createdAt || new Date().toISOString()
    };
  });
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

function getCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) {
          return [cookie, ""];
        }

        return [
          decodeURIComponent(cookie.slice(0, separatorIndex)),
          decodeURIComponent(cookie.slice(separatorIndex + 1))
        ];
      })
  );
}

function setSessionCookie(req, res, token, expiresAt) {
  const secure = process.env.IMAGE2_SECURE_COOKIES === "true" || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    `Max-Age=${Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)}`
  ];

  if (secure) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

function setAdminCookie(req, res, token, expiresAt) {
  const secure = process.env.IMAGE2_SECURE_COOKIES === "true" || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    `Max-Age=${Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)}`
  ];

  if (secure) {
    parts.push("Secure");
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", [
    `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${ADMIN_COOKIE_NAME}=; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=0`
  ]);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    credits: user.credits,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function publicGiftCard(card) {
  const expired = isGiftCardExpired(card);
  return {
    id: card.id,
    keyPreview: card.keyPreview,
    batchId: card.batchId,
    batchLabel: card.batchLabel || card.label,
    label: card.label,
    credits: card.credits,
    status: expired && card.status === "active" ? "expired" : card.status,
    expiresAt: card.expiresAt || null,
    redeemedByUserId: card.redeemedByUserId || null,
    redeemedAt: card.redeemedAt || null,
    disabledAt: card.disabledAt || null,
    revokedAt: card.revokedAt || null,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt
  };
}

function publicGiftCardBatch(batch, cards) {
  const batchCards = cards.filter(card => card.batchId === batch.id);
  const counts = batchCards.reduce((acc, card) => {
    const status = isGiftCardExpired(card) && card.status === "active" ? "expired" : card.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return {
    id: batch.id,
    label: batch.label,
    credits: batch.credits,
    count: batch.count,
    expiresAt: batch.expiresAt || null,
    note: batch.note || "",
    createdAt: batch.createdAt,
    counts
  };
}

function isGiftCardExpired(card) {
  return Boolean(card.expiresAt && new Date(card.expiresAt).getTime() <= Date.now());
}

function parseOptionalDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function addAdminLog(data, action, detail = {}) {
  data.adminLogs.unshift({
    id: randomUUID(),
    action,
    detail,
    createdAt: new Date().toISOString()
  });
  data.adminLogs = data.adminLogs.slice(0, 1000);
}

function getHistoryMaxBytes() {
  return HISTORY_MAX_BYTES;
}

function createHistoryRecord({
  requestId,
  user,
  mode,
  prompt,
  imagePrompt,
  quality,
  aspectRatio,
  provider,
  costCredits,
  remainingCredits,
  referenceImages,
  clientTaskId,
  clientImageId
}) {
  const now = new Date().toISOString();
  const data = readData();
  const existingIndex = data.generationHistory.findIndex(record => record.requestId === requestId);
  const record = {
    id: requestId,
    requestId,
    clientTaskId: String(clientTaskId || ""),
    clientImageId: String(clientImageId || ""),
    userId: user.id,
    email: user.email,
    createdAt: now,
    startedAt: now,
    completedAt: "",
    durationMs: null,
    status: "running",
    errorMessage: "",
    mode,
    prompt,
    imagePrompt,
    quality,
    aspectRatio,
    model: provider.model || DEFAULT_MODEL,
    providerId: provider.id || "",
    providerLabel: provider.label || provider.id || "",
    costCredits,
    remainingCredits,
    referenceCount: referenceImages.length,
    generatedCount: 0,
    totalAssetBytes: 0,
    assetsPruned: false,
    prunedAt: "",
    assetSaveFailed: false,
    assetSaveError: "",
    assets: {
      references: [],
      generated: []
    }
  };

  if (existingIndex >= 0) {
    data.generationHistory[existingIndex] = { ...data.generationHistory[existingIndex], ...record };
  } else {
    data.generationHistory.unshift(record);
  }

  writeData(data);
  return record;
}

function updateHistoryRecord(requestId, patch) {
  const data = readData();
  const record = data.generationHistory.find(item => item.requestId === requestId);
  if (!record) {
    return null;
  }

  Object.assign(record, patch);
  if (patch.assets) {
    record.assets = patch.assets;
  }
  writeData(data);
  return record;
}

function completeHistoryRecord(requestId, patch = {}) {
  const data = readData();
  const record = data.generationHistory.find(item => item.requestId === requestId);
  if (!record) {
    return null;
  }

  const completedAt = new Date().toISOString();
  Object.assign(record, patch, {
    completedAt,
    durationMs: record.startedAt ? Math.max(0, new Date(completedAt).getTime() - new Date(record.startedAt).getTime()) : null
  });
  writeData(data);
  return record;
}

function failHistoryRecord(requestId, errorMessage) {
  return completeHistoryRecord(requestId, {
    status: "failed",
    errorMessage: String(errorMessage || "生成失败。")
  });
}

function getHistoryAssetFolder(createdAt, requestId) {
  const date = new Date(createdAt || Date.now());
  const year = Number.isFinite(date.getTime()) ? String(date.getFullYear()) : "unknown";
  const month = Number.isFinite(date.getTime()) ? String(date.getMonth() + 1).padStart(2, "0") : "00";
  return join(historyAssetsDir, year, month, requestId);
}

function getHistoryAssetRelativePath(createdAt, requestId, fileName) {
  const date = new Date(createdAt || Date.now());
  const year = Number.isFinite(date.getTime()) ? String(date.getFullYear()) : "unknown";
  const month = Number.isFinite(date.getTime()) ? String(date.getMonth() + 1).padStart(2, "0") : "00";
  return `${year}/${month}/${requestId}/${fileName}`;
}

async function writeHistoryImageAsset({ record, kind, index, base64, mimeType, name }) {
  const cleanBase64 = stripDataUrlPrefix(base64);
  const bytes = Buffer.from(cleanBase64, "base64");
  const extension = imageExtensionFromMimeType(mimeType || "image/png");
  const prefix = kind === "reference" ? "reference" : "generated";
  const fileName = `${prefix}-${index + 1}.${extension}`;
  const thumbName = `${prefix}-${index + 1}-thumb.webp`;
  const folder = getHistoryAssetFolder(record.createdAt, record.requestId);
  mkdirSync(folder, { recursive: true });

  writeFileSync(join(folder, fileName), bytes);
  const thumbBytes = await createHistoryThumbnail(bytes);
  writeFileSync(join(folder, thumbName), thumbBytes);

  return {
    id: `${prefix}-${index + 1}`,
    kind,
    name: name || fileName,
    mimeType: mimeType || `image/${extension}`,
    bytes: bytes.length,
    thumbBytes: thumbBytes.length,
    thumbMimeType: "image/webp",
    path: getHistoryAssetRelativePath(record.createdAt, record.requestId, fileName),
    thumbPath: getHistoryAssetRelativePath(record.createdAt, record.requestId, thumbName),
    createdAt: new Date().toISOString()
  };
}

async function createHistoryThumbnail(bytes) {
  try {
    return await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({
        width: HISTORY_THUMB_SIZE,
        height: HISTORY_THUMB_SIZE,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: 72, effort: 4 })
      .toBuffer();
  } catch {
    return bytes;
  }
}

async function saveHistoryAssets(requestId, { referenceImages = [], generatedBase64, generatedMimeType }) {
  const data = readData();
  const record = data.generationHistory.find(item => item.requestId === requestId);
  if (!record) {
    return null;
  }

  try {
    const references = [];
    for (const [index, image] of referenceImages.entries()) {
      const parsed = parseDataImageUrl(image.dataUrl);
      references.push(await writeHistoryImageAsset({
        record,
        kind: "reference",
        index,
        base64: parsed?.base64 || image.dataUrl,
        mimeType: parsed ? `image/${parsed.outputFormat}` : image.type || "image/png",
        name: image.name || `reference-${index + 1}`
      }));
    }

    const generated = generatedBase64 ? [await writeHistoryImageAsset({
      record,
      kind: "generated",
      index: 0,
      base64: generatedBase64,
      mimeType: generatedMimeType || "image/png",
      name: "generated-1"
    })] : [];

    record.assets = { references, generated };
    record.generatedCount = generated.length;
    record.totalAssetBytes = calculateRecordAssetBytes(record);
    record.assetsPruned = false;
    record.prunedAt = "";
    record.assetSaveFailed = false;
    record.assetSaveError = "";
    writeData(data);
    return record;
  } catch (error) {
    record.assetSaveFailed = true;
    record.assetSaveError = error instanceof Error ? error.message : String(error);
    writeData(data);
    return record;
  }
}

function calculateRecordAssetBytes(record) {
  const assets = [
    ...(record.assets?.references || []),
    ...(record.assets?.generated || [])
  ];
  return assets.reduce((total, asset) => (
    total + Number(asset.bytes || 0) + Number(asset.thumbBytes || asset.bytes || 0)
  ), 0);
}

function getHistoryAssetUsage() {
  return getDirectorySize(historyAssetsDir);
}

function getDirectorySize(directory) {
  if (!existsSync(directory)) {
    return 0;
  }

  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(path);
    } else if (entry.isFile()) {
      total += statSync(path).size;
    }
  }
  return total;
}

function removeHistoryRecordAssets(record) {
  const folder = getHistoryAssetFolder(record.createdAt, record.requestId);
  if (existsSync(folder)) {
    rmSync(folder, { recursive: true, force: true });
  }
}

function trimGenerationHistoryAssets() {
  const maxBytes = getHistoryMaxBytes();
  const data = readData();
  let usedBytes = getHistoryAssetUsage();
  let prunedRecords = 0;

  if (!maxBytes || usedBytes <= maxBytes) {
    return { usedBytes, maxBytes, prunedRecords };
  }

  const candidates = [...data.generationHistory]
    .filter(record => !record.assetsPruned && hasHistoryAssets(record))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  for (const record of candidates) {
    if (usedBytes <= maxBytes) {
      break;
    }

    removeHistoryRecordAssets(record);
    const stored = data.generationHistory.find(item => item.requestId === record.requestId);
    if (stored) {
      stored.assets = { references: [], generated: [] };
      stored.totalAssetBytes = 0;
      stored.assetsPruned = true;
      stored.prunedAt = new Date().toISOString();
      prunedRecords += 1;
    }
    usedBytes = getHistoryAssetUsage();
  }

  writeData(data);
  return { usedBytes, maxBytes, prunedRecords };
}

function hasHistoryAssets(record) {
  return Boolean((record.assets?.references || []).length || (record.assets?.generated || []).length);
}

function getHistoryAssetById(record, assetId) {
  const assets = [
    ...(record.assets?.references || []),
    ...(record.assets?.generated || [])
  ];
  const [id, variant] = String(assetId || "").endsWith("-thumb")
    ? [String(assetId).replace(/-thumb$/, ""), "thumb"]
    : [String(assetId || ""), "original"];
  const asset = assets.find(item => item.id === id);
  if (!asset) {
    return null;
  }
  const relativePath = variant === "thumb" ? asset.thumbPath : asset.path;
  return {
    asset,
    filePath: resolve(historyAssetsDir, relativePath || "")
  };
}

function publicHistoryRecord(record) {
  const referenceAssets = record.assets?.references || [];
  const generatedAssets = record.assets?.generated || [];
  return {
    id: record.id || record.requestId,
    requestId: record.requestId,
    clientTaskId: record.clientTaskId || "",
    clientImageId: record.clientImageId || "",
    userId: record.userId,
    email: record.email,
    createdAt: record.createdAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    status: record.status,
    errorMessage: record.errorMessage,
    mode: record.mode,
    prompt: record.prompt,
    imagePrompt: record.imagePrompt,
    quality: record.quality,
    aspectRatio: record.aspectRatio,
    model: record.model,
    providerId: record.providerId,
    providerLabel: record.providerLabel,
    costCredits: record.costCredits,
    remainingCredits: record.remainingCredits,
    referenceCount: record.referenceCount || referenceAssets.length,
    generatedCount: record.generatedCount || generatedAssets.length,
    totalAssetBytes: record.totalAssetBytes || 0,
    assetsPruned: Boolean(record.assetsPruned),
    prunedAt: record.prunedAt || "",
    assetSaveFailed: Boolean(record.assetSaveFailed),
    assetSaveError: record.assetSaveError || "",
    assets: {
      references: referenceAssets.map(asset => publicHistoryAsset(record, asset)),
      generated: generatedAssets.map(asset => publicHistoryAsset(record, asset))
    }
  };
}

function publicHistoryAsset(record, asset) {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    mimeType: asset.mimeType,
    bytes: asset.bytes,
    thumbBytes: asset.thumbBytes || 0,
    thumbMimeType: asset.thumbMimeType || "image/webp",
    url: `/api/admin/generation-history/${encodeURIComponent(record.requestId)}/assets/${encodeURIComponent(asset.id)}`,
    thumbUrl: `/api/admin/generation-history/${encodeURIComponent(record.requestId)}/assets/${encodeURIComponent(`${asset.id}-thumb`)}`
  };
}

function filterGenerationHistory(records, url) {
  const params = url.searchParams;
  const q = params.get("q")?.trim().toLowerCase() || "";
  const userId = params.get("userId")?.trim() || "";
  const email = params.get("email")?.trim().toLowerCase() || "";
  const status = params.get("status")?.trim() || "";
  const mode = params.get("mode")?.trim() || "";
  const quality = params.get("quality")?.trim() || "";
  const providerId = params.get("providerId")?.trim() || "";
  const from = parseFilterDate(params.get("from"));
  const to = parseFilterDate(params.get("to"), true);

  return records.filter(record => {
    const createdAt = new Date(record.createdAt).getTime();
    if (q) {
      const haystack = [
        record.prompt,
        record.imagePrompt,
        record.email,
        record.userId,
        record.requestId,
        record.providerLabel
      ].join(" ").toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    if (userId && record.userId !== userId) {
      return false;
    }
    if (email && !String(record.email || "").toLowerCase().includes(email)) {
      return false;
    }
    if (status === "pruned" && !record.assetsPruned) {
      return false;
    }
    if (status && status !== "pruned" && record.status !== status) {
      return false;
    }
    if (mode && record.mode !== mode) {
      return false;
    }
    if (quality && record.quality !== quality) {
      return false;
    }
    if (providerId && record.providerId !== providerId) {
      return false;
    }
    if (from && createdAt < from) {
      return false;
    }
    if (to && createdAt > to) {
      return false;
    }
    return true;
  });
}

function parseFilterDate(value, endOfDay = false) {
  if (!value) {
    return null;
  }
  const raw = String(value);
  const date = raw.includes("T") ? new Date(raw) : new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getHistoryAnalytics(records) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayRecords = records.filter(record => new Date(record.createdAt).getTime() >= todayStart.getTime());
  const succeeded = records.filter(record => record.status === "succeeded").length;
  const failed = records.filter(record => record.status === "failed").length;
  const durations = records.map(record => Number(record.durationMs)).filter(Number.isFinite);
  const todayUsers = new Set(todayRecords.map(record => record.userId).filter(Boolean));
  const usageBytes = getHistoryAssetUsage();
  const maxBytes = getHistoryMaxBytes();

  return {
    summary: {
      total: records.length,
      todayTotal: todayRecords.length,
      successRate: records.length ? succeeded / records.length : 0,
      avgDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      activeUsersToday: todayUsers.size,
      creditsToday: todayRecords.reduce((sum, record) => sum + Number(record.costCredits || 0), 0),
      assetBytes: usageBytes,
      assetMaxBytes: maxBytes,
      assetPercent: maxBytes ? Math.min(1, usageBytes / maxBytes) : 0,
      pruned: records.filter(record => record.assetsPruned).length,
      succeeded,
      failed
    },
    daily: buildDailyChart(records),
    status: countBy(records, record => record.assetsPruned ? "pruned" : record.status || "unknown"),
    topUsers: getTopUsers(records),
    modes: countBy(records, record => record.mode || "unknown"),
    qualities: countBy(records, record => record.quality || "unknown"),
    avgDurationDaily: buildDailyAverage(records)
  };
}

function buildDailyChart(records) {
  const counts = new Map();
  for (const record of records) {
    const day = String(record.createdAt || "").slice(0, 10) || "unknown";
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({ date, count }));
}

function buildDailyAverage(records) {
  const buckets = new Map();
  for (const record of records) {
    const duration = Number(record.durationMs);
    if (!Number.isFinite(duration)) {
      continue;
    }
    const day = String(record.createdAt || "").slice(0, 10) || "unknown";
    const bucket = buckets.get(day) || { total: 0, count: 0 };
    bucket.total += duration;
    bucket.count += 1;
    buckets.set(day, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, bucket]) => ({ date, avgDurationMs: Math.round(bucket.total / bucket.count) }));
}

function countBy(records, getKey) {
  const counts = new Map();
  for (const record of records) {
    const key = getKey(record);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => ({ key, count }));
}

function getTopUsers(records) {
  const users = new Map();
  for (const record of records) {
    const key = record.email || record.userId || "unknown";
    const existing = users.get(key) || { email: record.email || "", userId: record.userId || "", count: 0, credits: 0 };
    existing.count += 1;
    existing.credits += Number(record.costCredits || 0);
    users.set(key, existing);
  }
  return [...users.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

function getPagination(url) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "24", 10)));
  return { page, pageSize };
}

function buildGenerationHistoryCsv(records) {
  const headers = [
    "requestId",
    "email",
    "userId",
    "createdAt",
    "completedAt",
    "durationMs",
    "status",
    "mode",
    "quality",
    "aspectRatio",
    "model",
    "providerLabel",
    "costCredits",
    "remainingCredits",
    "referenceCount",
    "generatedCount",
    "totalAssetBytes",
    "assetsPruned",
    "prompt",
    "errorMessage"
  ];
  const rows = records.map(record => headers.map(header => csvCell(record[header])));
  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function isAdminRequest(req) {
  if (process.env.IMAGE2_ADMIN_OPEN === "true") {
    return true;
  }

  const adminKey = process.env.IMAGE2_ADMIN_KEY || "";
  const token = getBearerToken(req);
  const cookieToken = getCookies(req)[ADMIN_COOKIE_NAME] || "";
  return Boolean(adminKey && (
    (token && safeEqual(hashSecret(token), hashSecret(adminKey))) ||
    (cookieToken && safeEqual(hashSecret(cookieToken), hashSecret(adminKey)))
  ));
}

function getSessionUser(req) {
  const token = getCookies(req)[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  const tokenHash = hashSecret(token);
  const data = readData();
  const now = Date.now();
  const session = data.sessions.find(item => safeEqual(item.tokenHash, tokenHash));
  if (!session || new Date(session.expiresAt).getTime() <= now) {
    return null;
  }

  const user = data.users.find(item => item.id === session.userId);
  return user ? { data, session, user } : null;
}

function requireSession(req, res) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    sendJson(res, 401, { error: "请先使用邮箱验证码登录。" });
    return null;
  }

  return sessionUser;
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 80_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolveBody(body));
    req.on("error", reject);
  });
}

function safeStaticPath(baseDir, urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const filePath = resolve(baseDir, relativePath);
  return filePath.startsWith(resolve(baseDir)) ? filePath : null;
}

function rememberJob(requestId, job) {
  generationJobs.set(requestId, {
    ...job,
    updatedAt: new Date().toISOString()
  });
  setTimeout(() => generationJobs.delete(requestId), JOB_TTL_MS).unref?.();
}

function updateJob(requestId, patch) {
  const existing = generationJobs.get(requestId);
  if (!existing) {
    return;
  }

  generationJobs.set(requestId, {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

function updatePartialImageJob(requestId, patch) {
  const imageBase64 = normalizePartialBase64(stripDataUrlPrefix(patch.imageBase64));
  if (imageBase64.length < PARTIAL_IMAGE_MIN_BASE64_CHARS) {
    return;
  }

  updateJob(requestId, {
    status: "streaming",
    partial: true,
    ...patch,
    imageBase64
  });
}

function normalizePartialBase64(base64) {
  const cleanBase64 = String(base64 || "").replace(/\s/g, "");
  const alignedLength = cleanBase64.length - (cleanBase64.length % 4);
  return alignedLength > 0 ? cleanBase64.slice(0, alignedLength) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLoginCodeEmail({ code }) {
  const safeCode = escapeHtml(code);
  const plain = [
    `你的 Image2 登录验证码是：${code}`,
    "",
    "验证码将在 10 分钟后失效。为保障账号与作品安全，请勿将验证码转发或透露给他人。",
    "",
    "如果这不是你本人发起的登录请求，可以忽略这封邮件。"
  ].join("\n");

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Image2 登录验证码</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f1eb;color:#1d1a16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">你的 Image2 登录验证码是 ${safeCode}，10 分钟内有效。</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1eb;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border:1px solid #e6dccf;border-radius:20px;overflow:hidden;box-shadow:0 18px 48px rgba(55,45,31,0.10);">
            <tr>
              <td style="padding:34px 34px 18px 34px;background:#16221c;">
                <div style="font-size:13px;line-height:1.4;letter-spacing:0.16em;text-transform:uppercase;color:#b9d8c0;font-weight:700;">Image2</div>
                <h1 style="margin:14px 0 0 0;font-size:26px;line-height:1.35;color:#fffaf0;font-weight:700;letter-spacing:0;">登录验证码</h1>
                <p style="margin:10px 0 0 0;font-size:15px;line-height:1.7;color:#d7e4d8;">请使用以下验证码完成本次登录验证。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:34px;">
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.8;color:#3a332a;">你好，</p>
                <p style="margin:0 0 24px 0;font-size:16px;line-height:1.8;color:#3a332a;">你正在登录 Image2。请在页面中输入下方验证码完成验证：</p>
                <div style="margin:0 0 26px 0;padding:24px 18px;background:#f7f2e8;border:1px solid #e8dac6;border-radius:16px;text-align:center;">
                  <div style="font-size:12px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#806c54;font-weight:700;">Verification Code</div>
                  <div style="margin-top:10px;font-size:38px;line-height:1.1;letter-spacing:0.18em;color:#1f2f26;font-weight:800;font-family:'SFMono-Regular','Cascadia Code','Roboto Mono',Consolas,monospace;">${safeCode}</div>
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px 0;background:#fbf8f1;border-radius:14px;border:1px solid #eee5d6;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.8;color:#665847;">
                      <strong style="color:#312a22;">有效时间：</strong>10 分钟<br>
                      <strong style="color:#312a22;">安全提示：</strong>请勿将验证码转发或透露给任何人。
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:14px;line-height:1.8;color:#746657;">如果这不是你本人发起的登录请求，可以忽略这封邮件；你的账号不会因此产生变更。</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 34px 30px 34px;border-top:1px solid #eee5d6;background:#fffaf1;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#948675;">这是一封系统自动发送的邮件，请勿直接回复。</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { plain, html };
}

async function sendLoginCodeEmail(email, code) {
  const provider = getMailProvider();
  if (provider === "tencent-ses") {
    return sendTencentSesLoginCodeEmail(email, code);
  }

  if (provider === "sendcloud") {
    return sendSendCloudLoginCodeEmail(email, code);
  }

  console.log(`[dev] Image2 login code for ${email}: ${code}`);
  return { delivered: false, devCode: code };
}

function getMailProvider() {
  const requestedProvider = String(process.env.IMAGE2_MAIL_PROVIDER || "auto").trim().toLowerCase();
  const providerAliases = new Map([
    ["auto", "auto"],
    ["dev", "dev"],
    ["local", "dev"],
    ["disabled", "dev"],
    ["sendcloud", "sendcloud"],
    ["tencent", "tencent-ses"],
    ["tencent-ses", "tencent-ses"],
    ["tencent_ses", "tencent-ses"],
    ["ses", "tencent-ses"]
  ]);
  const provider = providerAliases.get(requestedProvider);
  if (!provider) {
    throw new Error(`未知邮件发送平台：${requestedProvider}`);
  }

  if (provider === "auto") {
    if (hasTencentSesConfig()) {
      return "tencent-ses";
    }
    if (hasAnyTencentSesConfig()) {
      throw new Error("腾讯云邮件推送配置不完整，请检查 TENCENT_SES_SECRET_ID、TENCENT_SES_SECRET_KEY、TENCENT_SES_REGION、TENCENT_SES_FROM 和 TENCENT_SES_TEMPLATE_ID。");
    }
    if (hasSendCloudConfig()) {
      return "sendcloud";
    }
    return "dev";
  }

  if (provider === "tencent-ses" && !hasTencentSesConfig()) {
    throw new Error("腾讯云邮件推送配置不完整，请检查 TENCENT_SES_SECRET_ID、TENCENT_SES_SECRET_KEY、TENCENT_SES_REGION、TENCENT_SES_FROM 和 TENCENT_SES_TEMPLATE_ID。");
  }

  if (provider === "sendcloud" && !hasSendCloudConfig()) {
    throw new Error("SendCloud 配置不完整，请检查 SENDCLOUD_API_USER、SENDCLOUD_API_KEY 和 MAIL_FROM。");
  }

  return provider;
}

function hasTencentSesConfig() {
  return Boolean(
    process.env.TENCENT_SES_SECRET_ID &&
    process.env.TENCENT_SES_SECRET_KEY &&
    process.env.TENCENT_SES_REGION &&
    process.env.TENCENT_SES_FROM &&
    process.env.TENCENT_SES_TEMPLATE_ID
  );
}

function hasAnyTencentSesConfig() {
  return Boolean(
    process.env.TENCENT_SES_SECRET_ID ||
    process.env.TENCENT_SES_SECRET_KEY ||
    process.env.TENCENT_SES_REGION ||
    process.env.TENCENT_SES_FROM ||
    process.env.TENCENT_SES_TEMPLATE_ID ||
    process.env.TENCENT_SES_REPLY_TO ||
    process.env.TENCENT_SES_ENDPOINT
  );
}

function hasSendCloudConfig() {
  const sendCloudApiUser = process.env.SENDCLOUD_API_USER;
  const sendCloudApiKey = process.env.SENDCLOUD_API_KEY;
  const mailFrom = process.env.MAIL_FROM;

  return !(
    sendCloudApiUser === "dev-disabled" ||
    sendCloudApiKey === "dev-disabled" ||
    mailFrom === "dev-disabled" ||
    !sendCloudApiUser ||
    !sendCloudApiKey ||
    !mailFrom
  );
}

async function sendSendCloudLoginCodeEmail(email, code) {
  const sendCloudApiUser = process.env.SENDCLOUD_API_USER;
  const sendCloudApiKey = process.env.SENDCLOUD_API_KEY;
  const mailFrom = process.env.MAIL_FROM;

  const emailContent = buildLoginCodeEmail({ code });
  const params = new URLSearchParams({
    apiUser: sendCloudApiUser,
    apiKey: sendCloudApiKey,
    from: mailFrom,
    fromName: "Image2",
    to: email,
    subject: "你的 Image2 登录验证码",
    plain: emailContent.plain,
    html: emailContent.html
  });

  const response = await fetch("https://api.sendcloud.net/apiv2/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`邮件发送失败：${responseBody}`);
  }

  let result = null;
  try {
    result = JSON.parse(responseBody);
  } catch {
    throw new Error(`邮件发送失败：SendCloud 返回了无法解析的响应：${responseBody}`);
  }

  if (result?.result === false) {
    throw new Error(`邮件发送失败：${result.message || responseBody}`);
  }

  return { delivered: true };
}

async function sendTencentSesLoginCodeEmail(email, code) {
  const endpoint = process.env.TENCENT_SES_ENDPOINT || "ses.tencentcloudapi.com";
  const region = process.env.TENCENT_SES_REGION;
  const secretId = process.env.TENCENT_SES_SECRET_ID;
  const secretKey = process.env.TENCENT_SES_SECRET_KEY;
  const templateDataKey = process.env.TENCENT_SES_TEMPLATE_DATA_KEY || "code";
  const templateId = Number(process.env.TENCENT_SES_TEMPLATE_ID);
  if (!Number.isSafeInteger(templateId) || templateId <= 0) {
    throw new Error("TENCENT_SES_TEMPLATE_ID 必须是腾讯云邮件推送模板的数字 ID。");
  }

  const payload = {
    FromEmailAddress: process.env.TENCENT_SES_FROM,
    Destination: [email],
    Subject: "你的 Image2 登录验证码",
    Template: {
      TemplateID: templateId,
      TemplateData: JSON.stringify({
        [templateDataKey]: code,
        code,
        productName: "Image2",
        ttlMinutes: String(Math.round(LOGIN_CODE_TTL_MS / 60 / 1000))
      })
    },
    TriggerType: 1
  };

  if (process.env.TENCENT_SES_REPLY_TO) {
    payload.ReplyToAddresses = process.env.TENCENT_SES_REPLY_TO;
  }

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = createTencentCloudApiHeaders({
    action: "SendEmail",
    body,
    endpoint,
    region,
    secretId,
    secretKey,
    service: "ses",
    timestamp,
    version: "2020-10-02"
  });

  const response = await fetch(`https://${endpoint}`, {
    method: "POST",
    headers,
    body
  });
  const responseBody = await response.text();
  let result = null;
  try {
    result = JSON.parse(responseBody);
  } catch {
    throw new Error(`腾讯云邮件推送返回了无法解析的响应：${responseBody}`);
  }

  if (!response.ok || result?.Response?.Error) {
    const error = result?.Response?.Error;
    const message = error ? `${error.Code}: ${error.Message}` : responseBody;
    throw new Error(`腾讯云邮件推送发送失败：${message}`);
  }

  return { delivered: true, messageId: result?.Response?.MessageId };
}

function createTencentCloudApiHeaders({ action, body, endpoint, region, secretId, secretKey, service, timestamp, version }) {
  const algorithm = "TC3-HMAC-SHA256";
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = "application/json; charset=utf-8";
  const signedHeaders = "content-type;host";
  const canonicalHeaders = `content-type:${contentType}\nhost:${endpoint}\n`;
  const hashedRequestPayload = sha256Hex(body);
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload
  ].join("\n");
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = hmacSha256Hex(secretSigning, stringToSign);
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "Content-Type": contentType,
    Host: endpoint,
    "X-TC-Action": action,
    "X-TC-Region": region,
    "X-TC-Timestamp": String(timestamp),
    "X-TC-Version": version
  };
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacSha256Hex(key, value) {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function reserveCredits({ userId, prompt, quality, mode, imageCount }) {
  const data = readData();
  const user = data.users.find(item => item.id === userId);
  const requestId = createRequestId();
  const now = new Date().toISOString();
  const costCredits = imageCount;

  if (!user) {
    return {
      ok: false,
      status: 401,
      payload: { error: "请先使用邮箱验证码登录。" }
    };
  }

  if (user.credits < costCredits) {
    return {
      ok: false,
      status: 402,
      payload: {
        error: "额度不足，请兑换礼品卡后再生成。",
        costCredits,
        remainingCredits: user.credits
      }
    };
  }

  user.credits -= costCredits;
  user.updatedAt = now;
  data.usageLogs.unshift({
    id: randomUUID(),
    userId: user.id,
    requestId,
    promptPreview: prompt.slice(0, 120),
    mode,
    quality,
    imageCount,
    costCredits,
    status: "reserved",
    errorMessage: "",
    createdAt: now,
    updatedAt: now
  });
  writeData(data);

  return {
    ok: true,
    userId: user.id,
    requestId,
    costCredits,
    remainingCredits: user.credits
  };
}

function finishUsage(requestId, status, errorMessage = "") {
  const data = readData();
  const log = data.usageLogs.find(item => item.requestId === requestId);
  if (!log) {
    return null;
  }

  const user = data.users.find(item => item.id === log.userId);
  const now = new Date().toISOString();

  if (status === "failed" && log.status === "reserved" && user) {
    user.credits += log.costCredits;
    user.updatedAt = now;
    log.status = "refunded";
  } else {
    log.status = status;
  }

  log.errorMessage = errorMessage;
  log.updatedAt = now;
  writeData(data);

  return {
    remainingCredits: user?.credits ?? null
  };
}

async function handleAdmin(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = JSON.parse(await readBody(req) || "{}");
    const adminKey = process.env.IMAGE2_ADMIN_KEY || "";
    const key = String(body.key || "").trim();
    if (!adminKey || !key || !safeEqual(hashSecret(key), hashSecret(adminKey))) {
      sendJson(res, 401, { error: "管理 Key 无效或未配置。" });
      return;
    }

    setAdminCookie(req, res, key, new Date(Date.now() + ADMIN_SESSION_TTL_MS).toISOString());
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    clearAdminCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!isAdminRequest(req)) {
    sendJson(res, 401, { error: "管理 key 无效或未配置。" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const data = readData();
    sendJson(res, 200, {
      users: data.users.map(publicUser)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/providers") {
    const data = readData();
    const previousActiveProviderId = data.activeProviderId;
    const activeProvider = applyProviderSelection(data);
    if (activeProvider?.id !== previousActiveProviderId) {
      writeData(data);
    }

    sendJson(res, 200, {
      providers: data.providers.map(provider => publicProvider(provider, data.activeProviderId)),
      activeProvider: publicProviderSummary(activeProvider)
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/providers") {
    const body = JSON.parse(await readBody(req) || "{}");
    const apiUrl = String(body.apiUrl || "").trim();
    const label = String(body.label || "").trim();
    if (!apiUrl) {
      sendJson(res, 400, { error: "apiUrl 不能为空。" });
      return;
    }

    const now = new Date().toISOString();
    const data = readData();
    const provider = normalizeProvider({
      id: randomUUID(),
      label: label || "未命名供应商",
      apiUrl,
      apiKey: String(body.apiKey || "").trim(),
      model: String(body.model || DEFAULT_MODEL).trim(),
      apiFormat: body.apiFormat,
      enabled: body.enabled !== false,
      note: String(body.note || "").trim(),
      createdAt: now,
      updatedAt: now
    }, now);
    data.providers.unshift(provider);
    if (!data.activeProviderId && provider.enabled) {
      data.activeProviderId = provider.id;
    }
    addAdminLog(data, "provider-created", {
      providerId: provider.id,
      label: provider.label,
      apiFormat: provider.apiFormat
    });
    writeData(data);
    sendJson(res, 201, {
      provider: publicProvider(provider, data.activeProviderId)
    });
    return;
  }

  const providerMatch = /^\/api\/admin\/providers\/([^/]+)$/.exec(url.pathname);
  if (providerMatch && req.method === "PATCH") {
    const body = JSON.parse(await readBody(req) || "{}");
    const data = readData();
    const provider = data.providers.find(item => item.id === providerMatch[1]);
    if (!provider) {
      sendJson(res, 404, { error: "没有找到供应商。" });
      return;
    }

    const nextProvider = normalizeProvider({
      ...provider,
      label: body.label !== undefined ? String(body.label || "").trim() : provider.label,
      apiUrl: body.apiUrl !== undefined ? String(body.apiUrl || "").trim() : provider.apiUrl,
      apiKey: body.apiKey !== undefined ? String(body.apiKey || "").trim() || provider.apiKey : provider.apiKey,
      model: body.model !== undefined ? String(body.model || "").trim() : provider.model,
      apiFormat: body.apiFormat !== undefined ? body.apiFormat : provider.apiFormat,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : provider.enabled,
      note: body.note !== undefined ? String(body.note || "").trim() : provider.note,
      updatedAt: new Date().toISOString()
    });
    Object.assign(provider, nextProvider);
    if (provider.enabled && !data.activeProviderId) {
      data.activeProviderId = provider.id;
    }
    if (!provider.enabled && data.activeProviderId === provider.id) {
      data.activeProviderId = "";
    }
    addAdminLog(data, "provider-updated", {
      providerId: provider.id,
      label: provider.label,
      enabled: provider.enabled
    });
    writeData(data);
    sendJson(res, 200, {
      provider: publicProvider(provider, data.activeProviderId)
    });
    return;
  }

  const providerActionMatch = /^\/api\/admin\/providers\/([^/]+)\/(enable|disable|activate|test)$/.exec(url.pathname);
  if (providerActionMatch && req.method === "POST") {
    const [, providerId, action] = providerActionMatch;
    const data = readData();
    const provider = data.providers.find(item => item.id === providerId);
    if (!provider) {
      sendJson(res, 404, { error: "没有找到供应商。" });
      return;
    }

    const now = new Date().toISOString();
    if (action === "enable") {
      provider.enabled = true;
      provider.updatedAt = now;
    } else if (action === "disable") {
      provider.enabled = false;
      provider.updatedAt = now;
      if (data.activeProviderId === provider.id) {
        data.activeProviderId = "";
      }
    } else if (action === "activate") {
      if (!provider.enabled) {
        sendJson(res, 409, { error: "禁用状态的供应商不能直接设为当前启用项，请先启用。" });
        return;
      }
      data.activeProviderId = provider.id;
      provider.updatedAt = now;
    } else if (action === "test") {
      try {
        const probe = await testProviderConnection(provider);
        addAdminLog(data, "provider-tested", {
          providerId: provider.id,
          label: provider.label,
          ok: probe.ok
        });
        writeData(data);
        sendJson(res, 200, probe);
        return;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        addAdminLog(data, "provider-tested", {
          providerId: provider.id,
          label: provider.label,
          ok: false,
          detail
        });
        writeData(data);
        sendJson(res, 500, {
          ok: false,
          error: "连接测试失败。",
          detail
        });
        return;
      }
    }

    if (action !== "test") {
      addAdminLog(data, `provider-${action}`, {
        providerId: provider.id,
        label: provider.label
      });
      applyProviderSelection(data);
      writeData(data);
      sendJson(res, 200, {
        provider: publicProvider(provider, data.activeProviderId),
        activeProviderId: data.activeProviderId
      });
      return;
    }
  }

  const providerDeleteMatch = /^\/api\/admin\/providers\/([^/]+)$/.exec(url.pathname);
  if (providerDeleteMatch && req.method === "DELETE") {
    const data = readData();
    const index = data.providers.findIndex(item => item.id === providerDeleteMatch[1]);
    if (index === -1) {
      sendJson(res, 404, { error: "没有找到供应商。" });
      return;
    }

    const [provider] = data.providers.splice(index, 1);
    if (data.activeProviderId === provider.id) {
      applyProviderSelection(data);
    }
    addAdminLog(data, "provider-deleted", {
      providerId: provider.id,
      label: provider.label
    });
    writeData(data);
    sendJson(res, 200, {
      ok: true,
      activeProviderId: data.activeProviderId
    });
    return;
  }

  const userCreditsMatch = /^\/api\/admin\/users\/([^/]+)\/credits$/.exec(url.pathname);
  if (req.method === "POST" && userCreditsMatch) {
    const body = JSON.parse(await readBody(req) || "{}");
    const delta = Number.parseInt(body.delta, 10);
    if (!Number.isFinite(delta)) {
      sendJson(res, 400, { error: "delta 必须是数字。" });
      return;
    }

    const data = readData();
    const user = data.users.find(item => item.id === userCreditsMatch[1]);
    if (!user) {
      sendJson(res, 404, { error: "没有找到用户。" });
      return;
    }

    const now = new Date().toISOString();
    user.credits = Math.max(0, user.credits + delta);
    user.updatedAt = now;
    data.creditLogs.unshift({
      id: randomUUID(),
      userId: user.id,
      delta,
      source: "admin",
      note: String(body.note || "").slice(0, 120),
      createdAt: now
    });

    writeData(data);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/gift-cards") {
    const data = readData();
    const batchId = url.searchParams.get("batchId") || "";
    const status = url.searchParams.get("status") || "";
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const giftCards = data.giftCards
      .filter(card => !batchId || card.batchId === batchId)
      .filter(card => !status || publicGiftCard(card).status === status)
      .filter(card => !query || [
        card.id,
        card.keyPreview,
        card.batchLabel,
        card.label,
        card.redeemedByUserId
      ].some(value => String(value || "").toLowerCase().includes(query)))
      .slice(0, 500);

    sendJson(res, 200, {
      giftCards: giftCards.map(publicGiftCard),
      batches: data.giftCardBatches.map(batch => publicGiftCardBatch(batch, data.giftCards))
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/gift-cards") {
    const body = JSON.parse(await readBody(req) || "{}");
    const credits = Number.parseInt(body.credits, 10);
    const count = Math.max(1, Math.min(200, Number.parseInt(body.count, 10) || 1));
    const expiresAt = parseOptionalDate(body.expiresAt);
    if (!Number.isFinite(credits) || credits <= 0) {
      sendJson(res, 400, { error: "credits 必须是大于 0 的数字。" });
      return;
    }

    if (expiresAt === null) {
      sendJson(res, 400, { error: "expiresAt 不是有效日期。" });
      return;
    }

    const now = new Date().toISOString();
    const data = readData();
    const batchId = randomUUID();
    const label = String(body.label || "").trim().slice(0, 80) || `batch-${now.slice(0, 10)}`;
    const batch = {
      id: batchId,
      label,
      credits,
      count,
      expiresAt,
      note: String(body.note || "").trim().slice(0, 200),
      createdAt: now,
      updatedAt: now
    };
    const createdCards = Array.from({ length: count }, () => {
      const key = createGiftCardKey();
      return {
        id: randomUUID(),
        keyHash: hashSecret(key),
        keyPreview: `${key.slice(0, 9)}...${key.slice(-4)}`,
        batchId,
        batchLabel: label,
        label,
        credits,
        status: "active",
        expiresAt,
        redeemLimit: 1,
        redeemedByUserId: "",
        redeemedAt: "",
        createdAt: now,
        updatedAt: now,
        plainKey: key
      };
    });

    data.giftCardBatches.unshift(batch);
    data.giftCards.unshift(...createdCards.map(({ plainKey, ...card }) => ({ ...card, key: plainKey })));
    addAdminLog(data, "gift-card-batch-created", {
      batchId,
      label,
      credits,
      count,
      expiresAt
    });
    writeData(data);
    sendJson(res, 201, {
      batch: publicGiftCardBatch(batch, data.giftCards),
      giftCards: createdCards.map(card => ({
        id: card.id,
        key: card.plainKey,
        keyPreview: card.keyPreview,
        batchId: card.batchId,
        label: card.label,
        credits: card.credits,
        status: card.status,
        expiresAt: card.expiresAt || null,
        createdAt: card.createdAt
      }))
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/gift-card-batches") {
    const data = readData();
    sendJson(res, 200, {
      batches: data.giftCardBatches.map(batch => publicGiftCardBatch(batch, data.giftCards))
    });
    return;
  }

  const batchExportMatch = /^\/api\/admin\/gift-card-batches\/([^/]+)\/export$/.exec(url.pathname);
  if (req.method === "GET" && batchExportMatch) {
    const data = readData();
    const batch = data.giftCardBatches.find(item => item.id === batchExportMatch[1]);
    if (!batch) {
      sendJson(res, 404, { error: "没有找到礼品卡批次。" });
      return;
    }

    const cards = data.giftCards.filter(card => card.batchId === batch.id);
    const keys = cards.map(card => card.key).filter(Boolean);
    const missingCount = cards.length - keys.length;
    if (missingCount > 0) {
      sendJson(res, 409, {
        error: "这个批次里有卡密缺少明文 Key，无法完整导出。旧版本创建的卡只保存了 hash，不能反推出原始 Key。",
        exportedCount: keys.length,
        missingCount
      });
      return;
    }

    sendJson(res, 200, {
      batch: publicGiftCardBatch(batch, data.giftCards),
      keys
    });
    return;
  }

  const giftCardActionMatch = /^\/api\/admin\/gift-cards\/([^/]+)\/(disable|enable|revoke)$/.exec(url.pathname);
  if (req.method === "POST" && giftCardActionMatch) {
    const [, cardId, action] = giftCardActionMatch;
    const data = readData();
    const card = data.giftCards.find(item => item.id === cardId);
    if (!card) {
      sendJson(res, 404, { error: "没有找到礼品卡。" });
      return;
    }

    const now = new Date().toISOString();
    if (action === "disable") {
      if (card.status !== "active") {
        sendJson(res, 409, { error: "只有 active 礼品卡可以作废。" });
        return;
      }
      card.status = "disabled";
      card.disabledAt = now;
    }

    if (action === "enable") {
      if (card.status !== "disabled") {
        sendJson(res, 409, { error: "只有 disabled 礼品卡可以重新启用。" });
        return;
      }
      card.status = "active";
      card.disabledAt = "";
    }

    if (action === "revoke") {
      if (card.status !== "redeemed") {
        sendJson(res, 409, { error: "只有已兑换礼品卡可以撤销。" });
        return;
      }

      const user = data.users.find(item => item.id === card.redeemedByUserId);
      if (user) {
        user.credits = Math.max(0, user.credits - card.credits);
        user.updatedAt = now;
        data.creditLogs.unshift({
          id: randomUUID(),
          userId: user.id,
          delta: -card.credits,
          source: "gift-card-revoke",
          giftCardId: card.id,
          note: card.label || "",
          createdAt: now
        });
      }

      card.status = "revoked";
      card.revokedAt = now;
      card.revokedBy = "admin";
    }

    card.updatedAt = now;
    addAdminLog(data, `gift-card-${action}`, {
      cardId: card.id,
      batchId: card.batchId,
      credits: card.credits
    });
    writeData(data);
    sendJson(res, 200, { giftCard: publicGiftCard(card) });
    return;
  }

  const batchDisableMatch = /^\/api\/admin\/gift-card-batches\/([^/]+)\/disable$/.exec(url.pathname);
  if (req.method === "POST" && batchDisableMatch) {
    const data = readData();
    const batch = data.giftCardBatches.find(item => item.id === batchDisableMatch[1]);
    if (!batch) {
      sendJson(res, 404, { error: "没有找到礼品卡批次。" });
      return;
    }

    const now = new Date().toISOString();
    let changedCount = 0;
    data.giftCards.forEach(card => {
      if (card.batchId === batch.id && card.status === "active") {
        card.status = "disabled";
        card.disabledAt = now;
        card.updatedAt = now;
        changedCount += 1;
      }
    });
    batch.updatedAt = now;
    addAdminLog(data, "gift-card-batch-disabled", {
      batchId: batch.id,
      changedCount
    });
    writeData(data);
    sendJson(res, 200, {
      batch: publicGiftCardBatch(batch, data.giftCards),
      changedCount
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/audit-logs") {
    const data = readData();
    sendJson(res, 200, {
      adminLogs: data.adminLogs.slice(0, 200),
      creditLogs: data.creditLogs.slice(0, 200),
      usageLogs: data.usageLogs.slice(0, 200)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/generation-history") {
    const data = readData();
    const filtered = filterGenerationHistory(data.generationHistory, url)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const { page, pageSize } = getPagination(url);
    const offset = (page - 1) * pageSize;
    sendJson(res, 200, {
      records: filtered.slice(offset, offset + pageSize).map(publicHistoryRecord),
      total: filtered.length,
      page,
      pageSize,
      analytics: getHistoryAnalytics(filtered),
      providers: data.providers.map(publicProviderSummary)
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/generation-history/trim") {
    const result = trimGenerationHistoryAssets();
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/generation-history/export") {
    const data = readData();
    const filtered = filterGenerationHistory(data.generationHistory, url)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    if (format === "csv") {
      sendText(res, 200, buildGenerationHistoryCsv(filtered), "text/csv; charset=utf-8");
      return;
    }
    sendText(res, 200, JSON.stringify(filtered.map(publicHistoryRecord), null, 2), "application/json; charset=utf-8");
    return;
  }

  const historyAssetMatch = /^\/api\/admin\/generation-history\/([^/]+)\/assets\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && historyAssetMatch) {
    const requestId = decodeURIComponent(historyAssetMatch[1]);
    const assetId = decodeURIComponent(historyAssetMatch[2]);
    const data = readData();
    const record = data.generationHistory.find(item => item.requestId === requestId);
    const assetFile = record ? getHistoryAssetById(record, assetId) : null;
    if (!record || !assetFile || !assetFile.filePath.startsWith(resolve(historyAssetsDir)) || !existsSync(assetFile.filePath)) {
      sendJson(res, 404, { error: "历史图片不存在或已被清理。" });
      return;
    }
    serveFile(res, assetFile.filePath);
    return;
  }

  const historyDetailMatch = /^\/api\/admin\/generation-history\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && historyDetailMatch) {
    const requestId = decodeURIComponent(historyDetailMatch[1]);
    const data = readData();
    const record = data.generationHistory.find(item => item.requestId === requestId);
    if (!record) {
      sendJson(res, 404, { error: "生成历史不存在。" });
      return;
    }
    sendJson(res, 200, { record: publicHistoryRecord(record) });
    return;
  }

  sendJson(res, 404, { error: "没有找到管理接口。" });
}

async function testProviderConnection(provider) {
  const apiUrl = String(provider.apiUrl || "").trim();
  const apiKey = getProviderSecret(provider);
  if (!apiUrl) {
    throw new Error("供应商 API 地址不能为空。");
  }
  if (!apiKey) {
    throw new Error("供应商 API Key 不能为空。");
  }

  const format = normalizeProviderFormat(provider.apiFormat);
  if (format === "responses" || format === "responses-edits") {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: provider.model || DEFAULT_MODEL,
        input: "Generate a minimal image test response. Return only the image."
      })
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      detail: response.ok ? `${getProviderFormatLabel(format)} 格式测试成功。` : text.slice(0, 400)
    };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model || DEFAULT_MODEL,
      messages: [{ role: "user", content: "Generate a minimal image test response. Return only the image." }],
      quality: "medium"
    })
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    detail: response.ok ? "Compilation 格式测试成功。" : text.slice(0, 400)
  };
}

async function handleAuth(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const sessionUser = getSessionUser(req);
    sendJson(res, 200, {
      user: sessionUser ? publicUser(sessionUser.user) : null
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/request-code") {
    const body = JSON.parse(await readBody(req) || "{}");
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      sendJson(res, 400, { error: "请输入有效邮箱。" });
      return;
    }

    const data = readData();
    const nowMs = Date.now();
    const recentCode = data.emailCodes.find(item =>
      item.email === email &&
      !item.consumedAt &&
      nowMs - new Date(item.createdAt).getTime() < LOGIN_CODE_COOLDOWN_MS
    );

    if (recentCode) {
      sendJson(res, 429, { error: "验证码发送太频繁，请稍后再试。" });
      return;
    }

    const now = new Date().toISOString();
    const code = createLoginCode();
    data.emailCodes.unshift({
      id: randomUUID(),
      email,
      codeHash: hashSecret(code),
      expiresAt: new Date(nowMs + LOGIN_CODE_TTL_MS).toISOString(),
      attempts: 0,
      consumedAt: "",
      createdAt: now
    });
    data.emailCodes = data.emailCodes
      .filter(item => !item.consumedAt && new Date(item.expiresAt).getTime() > nowMs)
      .slice(0, 1000);
    writeData(data);

    try {
      const delivery = await sendLoginCodeEmail(email, code);
      sendJson(res, 200, {
        ok: true,
        message: delivery.delivered ? "验证码已发送，请检查邮箱。" : "开发模式验证码已输出到服务器日志。",
        devCode: process.env.IMAGE2_SHOW_DEV_CODES === "true" ? delivery.devCode : undefined
      });
    } catch (error) {
      sendJson(res, 500, {
        error: "验证码邮件发送失败。",
        detail: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/verify-code") {
    const body = JSON.parse(await readBody(req) || "{}");
    const email = normalizeEmail(body.email);
    const code = String(body.code || "").trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      sendJson(res, 400, { error: "邮箱或验证码格式不正确。" });
      return;
    }

    const data = readData();
    const nowMs = Date.now();
    const loginCode = data.emailCodes.find(item =>
      item.email === email &&
      !item.consumedAt &&
      new Date(item.expiresAt).getTime() > nowMs
    );

    if (!loginCode) {
      sendJson(res, 400, { error: "验证码不存在或已过期。" });
      return;
    }

    loginCode.attempts += 1;
    if (loginCode.attempts > 5) {
      loginCode.consumedAt = new Date().toISOString();
      writeData(data);
      sendJson(res, 429, { error: "验证码错误次数过多，请重新获取。" });
      return;
    }

    if (!safeEqual(loginCode.codeHash, hashSecret(code))) {
      writeData(data);
      sendJson(res, 400, { error: "验证码不正确。" });
      return;
    }

    const now = new Date().toISOString();
    let user = data.users.find(item => item.email === email);
    if (!user) {
      user = {
        id: randomUUID(),
        email,
        credits: Math.max(0, DEFAULT_SIGNUP_CREDITS || 100),
        createdAt: now,
        updatedAt: now
      };
      data.users.unshift(user);
      data.creditLogs.unshift({
        id: randomUUID(),
        userId: user.id,
        delta: user.credits,
        source: "signup",
        note: "新账号默认额度",
        createdAt: now
      });
    }

    loginCode.consumedAt = now;
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(nowMs + SESSION_TTL_MS).toISOString();
    data.sessions.unshift({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashSecret(sessionToken),
      expiresAt,
      createdAt: now
    });
    data.sessions = data.sessions.filter(item => new Date(item.expiresAt).getTime() > nowMs).slice(0, 2000);
    writeData(data);
    setSessionCookie(req, res, sessionToken, expiresAt);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = getCookies(req)[SESSION_COOKIE_NAME];
    if (token) {
      const tokenHash = hashSecret(token);
      const data = readData();
      data.sessions = data.sessions.filter(item => !safeEqual(item.tokenHash, tokenHash));
      writeData(data);
    }

    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "没有找到登录接口。" });
}

async function handleRedeem(req, res) {
  const sessionUser = requireSession(req, res);
  if (!sessionUser) {
    return;
  }

  const body = JSON.parse(await readBody(req) || "{}");
  const key = String(body.key || "").trim();
  if (!key) {
    sendJson(res, 400, { error: "请输入礼品卡 Key。" });
    return;
  }

  if (!/^gift_[A-Za-z0-9_-]{16,}$/.test(key)) {
    sendJson(res, 400, { error: "礼品卡 Key 格式不正确，请检查是否完整复制。" });
    return;
  }

  const data = readData();
  const user = data.users.find(item => item.id === sessionUser.user.id);
  const keyHash = hashSecret(key);
  const card = data.giftCards.find(item => safeEqual(item.keyHash, keyHash));
  if (!card) {
    sendJson(res, 404, { error: "礼品卡不存在，请检查 Key 是否正确。" });
    return;
  }

  if (card.status === "redeemed") {
    sendJson(res, 409, { error: "这张礼品卡已经被兑换过。", giftCard: publicGiftCard(card) });
    return;
  }

  if (card.status === "disabled") {
    sendJson(res, 409, { error: "这张礼品卡已被管理员作废。", giftCard: publicGiftCard(card) });
    return;
  }

  if (card.status === "revoked") {
    sendJson(res, 409, { error: "这张礼品卡已被撤销，无法再次兑换。", giftCard: publicGiftCard(card) });
    return;
  }

  if (isGiftCardExpired(card)) {
    sendJson(res, 410, { error: "这张礼品卡已过期。", giftCard: publicGiftCard(card) });
    return;
  }

  const now = new Date().toISOString();
  card.status = "redeemed";
  card.redeemedByUserId = user.id;
  card.redeemedAt = now;
  card.updatedAt = now;
  user.credits += card.credits;
  user.updatedAt = now;
  data.creditLogs.unshift({
    id: randomUUID(),
    userId: user.id,
    delta: card.credits,
    source: "gift-card",
    giftCardId: card.id,
    note: card.label || "",
    createdAt: now
  });
  addAdminLog(data, "gift-card-redeemed", {
    cardId: card.id,
    batchId: card.batchId,
    userId: user.id,
    credits: card.credits
  });
  writeData(data);
  sendJson(res, 200, {
    creditsAdded: card.credits,
    giftCard: publicGiftCard(card),
    user: publicUser(user)
  });
}

async function handleGenerate(req, res) {
  let reservation = null;
  try {
    const sessionUser = requireSession(req, res);
    if (!sessionUser) {
      return;
    }

    const body = JSON.parse(await readBody(req) || "{}");
    const prompt = String(body.prompt || "").trim();
    const clientTaskId = String(body.clientTaskId || "").trim();
    const clientImageId = String(body.clientImageId || "").trim();
    const quality = qualityOptions.has(body.quality) ? body.quality : "medium";
    const aspectRatio = aspectRatioOptions.has(body.aspectRatio) ? body.aspectRatio : "auto";
    const mode = body.mode === "edit" ? "edit" : "generate";
    const referenceImages = Array.isArray(body.referenceImages)
      ? body.referenceImages.filter(image => typeof image?.dataUrl === "string")
      : [];

    if (!prompt) {
      sendJson(res, 400, { error: "请输入提示词。" });
      return;
    }

    const data = readData();
    const provider = getActiveProvider(data);
    if (!provider) {
      sendJson(res, 500, { error: "没有可用的供应商配置，请先在后台启用一个供应商。" });
      return;
    }

    reservation = reserveCredits({
      userId: sessionUser.user.id,
      prompt,
      quality,
      mode,
      imageCount: 1
    });

    if (!reservation.ok) {
      sendJson(res, reservation.status, reservation.payload);
      return;
    }

    const imagePrompt = [
      mode === "edit" && referenceImages.length > 0
        ? `Generate exactly one image based on the ${referenceImages.length} reference image(s). Do not ask follow-up questions. Return only the generated image.`
        : "Generate exactly one image from the prompt. Do not ask follow-up questions. Return only the generated image.",
      aspectRatio === "auto" ? "" : `图片比例：${aspectRatio}`,
      "",
      "用户提示词：",
      prompt
    ].filter(Boolean).join("\n");

    const input = referenceImages.length > 0
      ? [
          {
            role: "user",
            content: [
              { type: "text", text: imagePrompt },
              ...referenceImages.map(image => ({ type: "image_url", image_url: { url: image.dataUrl } }))
            ]
          }
        ]
      : imagePrompt;

    rememberJob(reservation.requestId, {
      status: "pending",
      requestId: reservation.requestId,
      costCredits: reservation.costCredits,
      remainingCredits: reservation.remainingCredits,
      provider: publicProviderSummary(provider),
      error: ""
    });

    createHistoryRecord({
      requestId: reservation.requestId,
      user: sessionUser.user,
      mode,
      prompt,
      imagePrompt,
      quality,
      aspectRatio,
      provider,
      costCredits: reservation.costCredits,
      remainingCredits: reservation.remainingCredits,
      referenceImages,
      clientTaskId,
      clientImageId
    });

    runGenerationJob({
      requestId: reservation.requestId,
      input,
      prompt: imagePrompt,
      aspectRatio,
      referenceImages,
      quality,
      costCredits: reservation.costCredits,
      remainingCredits: reservation.remainingCredits,
      providerId: provider.id
    });

    sendJson(res, 202, {
      requestId: reservation.requestId,
      status: "pending",
      costCredits: reservation.costCredits,
      remainingCredits: reservation.remainingCredits
    });
  } catch (error) {
    if (reservation?.ok) {
      finishUsage(
        reservation.requestId,
        "failed",
        error instanceof Error ? error.message : String(error)
      );
      failHistoryRecord(reservation.requestId, error instanceof Error ? error.message : String(error));
      updateJob(reservation.requestId, {
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }

    sendJson(res, 500, {
      error: "生成失败。",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function runGenerationJob({ requestId, input, prompt, aspectRatio, referenceImages = [], quality, costCredits, remainingCredits }) {
  try {
    const currentJob = generationJobs.get(requestId);
    const providerId = currentJob?.provider?.id || "";
    const data = readData();
    const provider = data.providers.find(item => item.id === providerId && item.enabled) || getActiveProvider(data);
    if (!provider) {
      throw new Error("没有可用的供应商配置。");
    }

    updateJob(requestId, { status: "running", provider: publicProviderSummary(provider) });

    const messages = Array.isArray(input)
      ? input
      : [{ role: "user", content: input }];

    const upstreamRequest = buildUpstreamRequest(provider, {
      messages,
      prompt: prompt || (Array.isArray(input) ? "" : input),
      aspectRatio,
      referenceImages,
      quality
    });

    const upstream = await fetch(upstreamRequest.url, {
      method: "POST",
      headers: upstreamRequest.headers,
      body: upstreamRequest.body
    });

    const { text, payload } = await readUpstreamImageResponse(upstream, requestId);

    if (!upstream.ok) {
      const detail = payload?.error?.message || text;
      const usage = finishUsage(requestId, "failed", detail);
      failHistoryRecord(requestId, detail);
      updateJob(requestId, {
        status: "failed",
        error: "图片接口返回错误。",
        detail,
        remainingCredits: usage?.remainingCredits ?? remainingCredits
      });
      return;
    }

    const imageResult = await extractImageResult(payload);
    const base64 = imageResult?.base64;

    if (!base64) {
      const detail = "接口返回成功，但没有找到图片结果。";
      const usage = finishUsage(requestId, "failed", detail);
      failHistoryRecord(requestId, detail);
      updateJob(requestId, {
        status: "failed",
        error: "接口返回成功，但没有找到图片结果。",
        detail: payload,
        remainingCredits: usage?.remainingCredits ?? remainingCredits
      });
      return;
    }

    const usage = finishUsage(requestId, "succeeded");
    const outputFormat = imageResult.outputFormat || "png";
    const mimeType = `image/${outputFormat}`;
    const savedRecord = await saveHistoryAssets(requestId, {
      referenceImages,
      generatedBase64: base64,
      generatedMimeType: mimeType
    });
    completeHistoryRecord(requestId, {
      status: "succeeded",
      errorMessage: "",
      model: payload.model || provider.model || DEFAULT_MODEL,
      providerId: provider.id || "",
      providerLabel: provider.label || provider.id || "",
      remainingCredits: usage?.remainingCredits ?? remainingCredits,
      generatedCount: savedRecord?.generatedCount ?? 1,
      totalAssetBytes: savedRecord?.totalAssetBytes ?? 0
    });
    trimGenerationHistoryAssets();
    updateJob(requestId, {
      status: "succeeded",
      id: payload.id,
      requestId,
      model: payload.model || provider.model || DEFAULT_MODEL,
      imageStatus: imageResult.status,
      outputFormat,
      mimeType,
      imageBase64: base64,
      costCredits,
      remainingCredits: usage?.remainingCredits ?? remainingCredits
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const usage = finishUsage(requestId, "failed", detail);
    failHistoryRecord(requestId, detail);
    updateJob(requestId, {
      status: "failed",
      error: "生成失败。",
      detail,
      remainingCredits: usage?.remainingCredits ?? remainingCredits
    });
  }
}

function buildUpstreamRequest(provider, { messages, prompt, aspectRatio, referenceImages = [], quality }) {
  const model = provider.model || DEFAULT_MODEL;
  const format = normalizeProviderFormat(provider.apiFormat);
  const apiUrl = provider.apiUrl || DEFAULT_API_URL;
  const apiKey = getProviderSecret(provider);

  if (format === "responses" || (format === "responses-edits" && referenceImages.length === 0)) {
    return {
      url: apiUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: messages
      })
    };
  }

  if (referenceImages.length > 0) {
    return buildImageEditRequest({
      apiUrl,
      apiKey,
      model,
      prompt,
      aspectRatio,
      referenceImages,
      quality,
      imageFieldName: format === "responses-edits" ? "image" : "image[]"
    });
  }

  return buildImageGenerationRequest({
    apiUrl,
    apiKey,
    model,
    prompt,
    aspectRatio,
    quality
  });
}

function buildImageEditRequest({ apiUrl, apiKey, model, prompt, aspectRatio, referenceImages, quality, imageFieldName = "image[]" }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("n", "1");
  form.append("thinking", quality);
  form.append("response_format", "b64_json");

  form.append("size", mapAspectRatioToImageEditSize(aspectRatio) || "auto");

  referenceImages.forEach((image, index) => {
    const parsed = parseDataImageUrl(image.dataUrl);
    if (!parsed?.base64) {
      throw new Error(`第 ${index + 1} 张参考图不是有效的 data URL。`);
    }

    const mimeType = `image/${parsed.outputFormat}`;
    const extension = imageExtensionFromMimeType(mimeType);
    const bytes = Buffer.from(parsed.base64, "base64");
    form.append(imageFieldName, new Blob([bytes], { type: mimeType }), `reference-${index + 1}.${extension}`);
  });

  return {
    url: deriveImageEditApiUrl(apiUrl),
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  };
}

function buildImageGenerationRequest({ apiUrl, apiKey, model, prompt, aspectRatio, quality }) {
  return {
    url: deriveImageGenerationApiUrl(apiUrl),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: mapAspectRatioToImageEditSize(aspectRatio) || "auto",
      thinking: quality,
      response_format: "b64_json"
    })
  };
}

function deriveImageGenerationApiUrl(apiUrl) {
  const value = String(apiUrl || DEFAULT_API_URL).trim();
  return value
    .replace(/\/v1\/chat\/completions(\?.*)?$/i, "/v1/images/generations$1")
    .replace(/\/v1\/responses(\?.*)?$/i, "/v1/images/generations$1")
    .replace(/\/v1\/images\/edits(\?.*)?$/i, "/v1/images/generations$1");
}

function deriveImageEditApiUrl(apiUrl) {
  const value = String(apiUrl || DEFAULT_API_URL).trim();
  return value
    .replace(/\/v1\/chat\/completions(\?.*)?$/i, "/v1/images/edits$1")
    .replace(/\/v1\/responses(\?.*)?$/i, "/v1/images/edits$1");
}

function mapAspectRatioToImageEditSize(aspectRatio) {
  if (aspectRatio === "1:1") {
    return "1024x1024";
  }
  if (aspectRatio === "3:2" || aspectRatio === "4:3" || aspectRatio === "16:9" || aspectRatio === "21:9") {
    return "1536x1024";
  }
  if (aspectRatio === "2:3" || aspectRatio === "3:4" || aspectRatio === "9:16" || aspectRatio === "9:21") {
    return "1024x1536";
  }
  return "";
}

function imageExtensionFromMimeType(mimeType) {
  const format = getImageFormatFromContentType(mimeType);
  if (format === "jpeg") {
    return "jpg";
  }
  return format || "png";
}

async function extractImageResult(payload) {
  const responseItem = payload?.output?.find?.(item => item.type === "image_generation_call");
  if (responseItem?.result) {
    return {
      base64: responseItem.result,
      outputFormat: responseItem.output_format || "png",
      status: responseItem.status || ""
    };
  }

  const imageItem = payload?.data?.find?.(item => item?.b64_json || item?.url);
  if (imageItem?.b64_json) {
    return {
      base64: stripDataUrlPrefix(imageItem.b64_json),
      outputFormat: guessImageFormat(imageItem.b64_json),
      status: "succeeded"
    };
  }

  if (imageItem?.url) {
    const parsed = parseDataImageUrl(imageItem.url);
    if (parsed) {
      return {
        base64: parsed.base64,
        outputFormat: parsed.outputFormat,
        status: "succeeded"
      };
    }
  }

  const choiceContent = payload?.choices?.[0]?.message?.content;
  const contentItems = Array.isArray(choiceContent) ? choiceContent : [];
  const choiceImage = contentItems.find(item => item?.image_url?.url || item?.image_url || item?.b64_json);
  const choiceUrl = typeof choiceImage?.image_url === "string" ? choiceImage.image_url : choiceImage?.image_url?.url;
  if (choiceImage?.b64_json || choiceUrl) {
    const rawImage = choiceImage.b64_json || choiceUrl;
    const parsed = parseDataImageUrl(rawImage);
    return {
      base64: parsed?.base64 || stripDataUrlPrefix(rawImage),
      outputFormat: parsed?.outputFormat || guessImageFormat(rawImage),
      status: "succeeded"
    };
  }

  if (typeof choiceContent === "string") {
    const markdownUrl = extractMarkdownImageUrl(choiceContent);
    if (markdownUrl) {
      const parsed = parseDataImageUrl(markdownUrl);
      if (parsed) {
        return {
          base64: parsed.base64,
          outputFormat: parsed.outputFormat,
          status: "succeeded"
        };
      }

      return fetchImageAsBase64(markdownUrl);
    }
  }

  return null;
}

async function readUpstreamImageResponse(upstream, requestId) {
  if (!upstream.body?.getReader) {
    const text = await upstream.text();
    return { text, payload: parseJsonSafely(text) };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let lastPartialBase64 = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    text += decoder.decode(value, { stream: true });
    const partial = extractPartialImageResult(text);
    if (partial?.base64 && partial.base64.length > lastPartialBase64.length) {
      lastPartialBase64 = partial.base64;
      updatePartialImageJob(requestId, {
        imageBase64: partial.base64,
        mimeType: `image/${partial.outputFormat || "png"}`,
        outputFormat: partial.outputFormat || "png",
        imageStatus: "streaming"
      });
    }
  }

  text += decoder.decode();
  return { text, payload: parseJsonSafely(text) };
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractPartialImageResult(text) {
  const resultMatch = /"result"\s*:\s*"((?:\\.|[^"\\])*)/.exec(text);
  if (resultMatch?.[1]) {
    return {
      base64: decodeJsonStringFragment(resultMatch[1]),
      outputFormat: extractJsonStringField(text, "output_format") || "png"
    };
  }

  const b64Match = /"b64_json"\s*:\s*"((?:\\.|[^"\\])*)/.exec(text);
  if (b64Match?.[1]) {
    return {
      base64: decodeJsonStringFragment(b64Match[1]),
      outputFormat: "png"
    };
  }

  const dataUrlMatch = /data:image\/([^;"]+);base64,([A-Za-z0-9+/=_-]{1600,})/.exec(text);
  if (dataUrlMatch) {
    return {
      base64: dataUrlMatch[2],
      outputFormat: dataUrlMatch[1].toLowerCase()
    };
  }

  return null;
}

function extractJsonStringField(text, fieldName) {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = pattern.exec(text);
  return match?.[1] ? decodeJsonStringFragment(match[1]) : "";
}

function decodeJsonStringFragment(value) {
  const closedFragment = value.replace(/\\$/, "");
  try {
    return JSON.parse(`"${closedFragment}"`);
  } catch {
    return closedFragment
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\\//g, "/");
  }
}

function extractMarkdownImageUrl(content) {
  const match = /!\[[^\]]*]\(([^)\s]+)\)/.exec(content);
  return match?.[1] || "";
}

async function fetchImageAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载生成图片失败：${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return {
    base64,
    outputFormat: getImageFormatFromContentType(contentType),
    status: "succeeded"
  };
}

function getImageFormatFromContentType(contentType) {
  const match = /^image\/([^;\s]+)/i.exec(contentType);
  return match?.[1]?.toLowerCase() || "png";
}

function parseDataImageUrl(value) {
  const match = /^data:image\/([^;]+);base64,(.+)$/i.exec(String(value || ""));
  if (!match) {
    return null;
  }

  return {
    outputFormat: match[1].toLowerCase(),
    base64: match[2]
  };
}

function stripDataUrlPrefix(value) {
  return String(value || "").replace(/^data:image\/[^;]+;base64,/i, "");
}

function guessImageFormat(value) {
  return parseDataImageUrl(value)?.outputFormat || "png";
}

function handleGenerateStatus(req, res, requestId) {
  const job = generationJobs.get(requestId);
  if (!job) {
    sendJson(res, 404, { error: "生成任务不存在或已过期。" });
    return;
  }

  if (job.status === "failed") {
    sendJson(res, 500, job);
    return;
  }

  sendJson(res, 200, job);
}

function serveFile(res, filePath) {
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const contentType = mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  res.end(readFileSync(filePath));
}

function serveAdmin(req, res) {
  const fileName = isAdminRequest(req) ? "admin.html" : "admin-login.html";
  serveFile(res, join(publicDir, fileName));
}

function serveClient(req, res, url) {
  const hasReactBuild = existsSync(join(distDir, "index.html"));
  const clientDir = hasReactBuild ? distDir : publicDir;
  const clientPath = safeStaticPath(clientDir, url.pathname);

  if (clientPath && existsSync(clientPath)) {
    serveFile(res, clientPath);
    return;
  }

  const publicPath = safeStaticPath(publicDir, url.pathname);
  if (publicPath && existsSync(publicPath)) {
    serveFile(res, publicPath);
    return;
  }

  if (hasReactBuild && !extname(url.pathname)) {
    serveFile(res, join(distDir, "index.html"));
    return;
  }

  serveFile(res, clientPath);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/auth/")) {
    handleAuth(req, res, url);
    return;
  }

  if (url.pathname.startsWith("/api/admin/")) {
    handleAdmin(req, res, url);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/redeem") {
    handleRedeem(req, res);
    return;
  }

  const statusMatch = /^\/api\/generate\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && statusMatch) {
    handleGenerateStatus(req, res, statusMatch[1]);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    handleGenerate(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/admin") {
    serveAdmin(req, res);
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  serveClient(req, res, url);
});

function listen(port) {
  server.once("error", error => {
    if (error.code === "EADDRINUSE") {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, HOST, () => {
    const localHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
    console.log(`Image2 server is listening on ${HOST}:${port}`);
    console.log(`Open locally at http://${localHost}:${port}`);
    console.log(`Image2 data will be saved in ${dataDir}`);
  });
}

listen(START_PORT);
