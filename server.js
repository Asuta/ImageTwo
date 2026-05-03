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
const API_URL = "https://nowcoding.ai/v1/responses";
const MODEL = "gpt-5.4-mini";
const dataDir = process.env.IMAGE2_DATA_DIR || join(__dirname, "data");
const dataPath = join(dataDir, "image2-data.json");
const DEFAULT_SIGNUP_CREDITS = Number.parseInt(process.env.IMAGE2_SIGNUP_CREDITS || "100", 10);
const LOGIN_CODE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_COOLDOWN_MS = 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "image2_session";

const qualityOptions = new Set(["low", "medium", "high"]);
const aspectRatioOptions = new Set(["auto", "9:21", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"]);
const generationJobs = new Map();
const JOB_TTL_MS = 15 * 60 * 1000;

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

    const key = trimmed.slice(0, separatorIndex).trim();
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
    giftCards: [],
    creditLogs: [],
    usageLogs: []
  });
}

function readData() {
  try {
    const data = JSON.parse(readFileSync(dataPath, "utf8"));
    return {
      users: Array.isArray(data.users) ? data.users : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      emailCodes: Array.isArray(data.emailCodes) ? data.emailCodes : [],
      giftCards: Array.isArray(data.giftCards) ? data.giftCards : [],
      creditLogs: Array.isArray(data.creditLogs) ? data.creditLogs : [],
      usageLogs: Array.isArray(data.usageLogs) ? data.usageLogs : []
    };
  } catch {
    return {
      users: [],
      sessions: [],
      emailCodes: [],
      giftCards: [],
      creditLogs: [],
      usageLogs: []
    };
  }
}

function writeData(data) {
  const tmpPath = `${dataPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, dataPath);
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

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
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

function isAdminRequest(req) {
  const adminKey = process.env.IMAGE2_ADMIN_KEY || "";
  const token = getBearerToken(req);
  return Boolean(adminKey && token && safeEqual(hashSecret(token), hashSecret(adminKey)));
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
    sendJson(res, 200, {
      giftCards: data.giftCards.map(card => ({
        id: card.id,
        label: card.label,
        credits: card.credits,
        status: card.status,
        redeemedByUserId: card.redeemedByUserId || null,
        redeemedAt: card.redeemedAt || null,
        createdAt: card.createdAt
      }))
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/gift-cards") {
    const body = JSON.parse(await readBody(req) || "{}");
    const credits = Number.parseInt(body.credits, 10);
    const count = Math.max(1, Math.min(200, Number.parseInt(body.count, 10) || 1));
    if (!Number.isFinite(credits) || credits <= 0) {
      sendJson(res, 400, { error: "credits 必须是大于 0 的数字。" });
      return;
    }

    const now = new Date().toISOString();
    const data = readData();
    const createdCards = Array.from({ length: count }, () => {
      const key = createGiftCardKey();
      return {
        id: randomUUID(),
        key,
        keyHash: hashSecret(key),
        label: String(body.label || "").trim().slice(0, 80),
        credits,
        status: "active",
        redeemedByUserId: "",
        redeemedAt: "",
        createdAt: now,
        updatedAt: now
      };
    });

    data.giftCards.unshift(...createdCards);
    writeData(data);
    sendJson(res, 201, {
      giftCards: createdCards.map(card => ({
        id: card.id,
        key: card.key,
        label: card.label,
        credits: card.credits,
        status: card.status,
        createdAt: card.createdAt
      }))
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
        devCode: process.env.NODE_ENV === "production" ? undefined : delivery.devCode
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

  const data = readData();
  const user = data.users.find(item => item.id === sessionUser.user.id);
  const keyHash = hashSecret(key);
  const card = data.giftCards.find(item => safeEqual(item.keyHash, keyHash));
  if (!card || card.status !== "active") {
    sendJson(res, 404, { error: "礼品卡不存在或不可用。" });
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
  writeData(data);
  sendJson(res, 200, {
    creditsAdded: card.credits,
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

    if (!process.env.NOWCODING_API_KEY) {
      sendJson(res, 500, { error: "缺少 NOWCODING_API_KEY，请在本地 .env 中配置。" });
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
        ? `请参考用户上传的 ${referenceImages.length} 张图片并调用图片生成工具生成一张新图片，不要只回复文字。`
        : "请直接调用图片生成工具生成一张图片，不要只回复文字。",
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
              { type: "input_text", text: imagePrompt },
              ...referenceImages.map(image => ({ type: "input_image", image_url: image.dataUrl }))
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

    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOWCODING_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        tools: [
          {
            type: "image_generation",
            quality
          }
        ]
      })
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

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

    const imageCall = payload?.output?.find(item => item.type === "image_generation_call");
    const base64 = imageCall?.result;

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
    const outputFormat = imageCall.output_format || "png";
    updateJob(requestId, {
      status: "succeeded",
      id: payload.id,
      requestId,
      model: payload.model || MODEL,
      imageStatus: imageCall.status,
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
