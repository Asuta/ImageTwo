import { createServer } from "node:http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

loadLocalEnv();

const START_PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "0.0.0.0";
const API_URL = process.env.IMAGE2_API_URL || "https://api.bltcy.ai/v1/chat/completions";
const MODEL = process.env.IMAGE2_MODEL || "gpt-image-2";
const dataDir = process.env.IMAGE2_DATA_DIR || join(__dirname, "data");
const dataPath = join(dataDir, "image2-data.json");
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
  ".svg": "image/svg+xml; charset=utf-8"
};
mkdirSync(dataDir, { recursive: true });
ensureDataFile();

function loadLocalEnv() {
  const envPath = join(__dirname, ".env");
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
    const data = readData();
    writeData(data);
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
    usageLogs: []
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
      usageLogs: Array.isArray(data.usageLogs) ? data.usageLogs : []
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
      usageLogs: []
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
    usageLogs: Array.isArray(data.usageLogs) ? data.usageLogs : []
  };
  writeFileSync(tmpPath, JSON.stringify(storableData, null, 2));
  renameSync(tmpPath, dataPath);
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

async function sendLoginCodeEmail(email, code) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    console.log(`[dev] Image2 login code for ${email}: ${code}`);
    return { delivered: false, devCode: code };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "你的 Image2 登录验证码",
      text: `你的 Image2 登录验证码是：${code}\n\n验证码 10 分钟内有效，请勿转发给他人。`
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`邮件发送失败：${detail}`);
  }

  return { delivered: true };
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

  sendJson(res, 404, { error: "没有找到管理接口。" });
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

    if (!getImageApiKey()) {
      sendJson(res, 500, { error: "缺少 IMAGE2_API_KEY，请在本地 .env 中配置。" });
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
      error: ""
    });

    runGenerationJob({
      requestId: reservation.requestId,
      input,
      quality,
      costCredits: reservation.costCredits,
      remainingCredits: reservation.remainingCredits
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

async function runGenerationJob({ requestId, input, quality, costCredits, remainingCredits }) {
  try {
    updateJob(requestId, { status: "running" });

    const messages = Array.isArray(input)
      ? input
      : [{ role: "user", content: input }];

    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getImageApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        quality
      })
    });

    const { text, payload } = await readUpstreamImageResponse(upstream, requestId);

    if (!upstream.ok) {
      const detail = payload?.error?.message || text;
      const usage = finishUsage(requestId, "failed", detail);
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
    updateJob(requestId, {
      status: "succeeded",
      id: payload.id,
      requestId,
      model: payload.model || MODEL,
      imageStatus: imageResult.status,
      outputFormat,
      mimeType: `image/${outputFormat}`,
      imageBase64: base64,
      costCredits,
      remainingCredits: usage?.remainingCredits ?? remainingCredits
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const usage = finishUsage(requestId, "failed", detail);
    updateJob(requestId, {
      status: "failed",
      error: "生成失败。",
      detail,
      remainingCredits: usage?.remainingCredits ?? remainingCredits
    });
  }
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

  serveFile(res, safeStaticPath(publicDir, url.pathname));
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
