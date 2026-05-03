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

const qualityOptions = new Set(["low", "medium", "high"]);
const aspectRatioOptions = new Set(["auto", "9:21", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"]);
const creditCostByQuality = {
  low: 1,
  medium: 2,
  high: 4
};
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

function createUserKey() {
  return `img2_${randomBytes(24).toString("base64url")}`;
}

function createRequestId() {
  return `image2_req_${randomUUID()}`;
}

function ensureDataFile() {
  if (existsSync(dataPath)) {
    return;
  }

  writeData({
    apiKeys: [],
    usageLogs: []
  });
}

function readData() {
  try {
    const data = JSON.parse(readFileSync(dataPath, "utf8"));
    return {
      apiKeys: Array.isArray(data.apiKeys) ? data.apiKeys : [],
      usageLogs: Array.isArray(data.usageLogs) ? data.usageLogs : []
    };
  } catch {
    return {
      apiKeys: [],
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

function isAdminRequest(req) {
  const adminKey = process.env.IMAGE2_ADMIN_KEY || "";
  const token = getBearerToken(req);
  return Boolean(adminKey && token && safeEqual(hashSecret(token), hashSecret(adminKey)));
}

function findApiKey(data, token) {
  if (!token) {
    return null;
  }

  const tokenHash = hashSecret(token);
  return data.apiKeys.find(apiKey => safeEqual(apiKey.keyHash, tokenHash)) || null;
}

function publicApiKey(apiKey) {
  return {
    id: apiKey.id,
    label: apiKey.label,
    status: apiKey.status,
    remainingCredits: apiKey.remainingCredits,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt
  };
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

function reserveCredits({ token, prompt, quality, mode, imageCount }) {
  const data = readData();
  const apiKey = findApiKey(data, token);
  const requestId = createRequestId();
  const now = new Date().toISOString();
  const costCredits = creditCostByQuality[quality] * imageCount;

  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      payload: { error: "用户 key 无效，请检查 Image2 Key。" }
    };
  }

  if (apiKey.status !== "active") {
    return {
      ok: false,
      status: 403,
      payload: { error: "用户 key 已被禁用。" }
    };
  }

  if (apiKey.remainingCredits < costCredits) {
    return {
      ok: false,
      status: 402,
      payload: {
        error: "额度不足，请联系服务提供方充值。",
        costCredits,
        remainingCredits: apiKey.remainingCredits
      }
    };
  }

  apiKey.remainingCredits -= costCredits;
  apiKey.updatedAt = now;
  data.usageLogs.unshift({
    id: randomUUID(),
    keyId: apiKey.id,
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
    apiKeyId: apiKey.id,
    requestId,
    costCredits,
    remainingCredits: apiKey.remainingCredits
  };
}

function finishUsage(requestId, status, errorMessage = "") {
  const data = readData();
  const log = data.usageLogs.find(item => item.requestId === requestId);
  if (!log) {
    return null;
  }

  const apiKey = data.apiKeys.find(item => item.id === log.keyId);
  const now = new Date().toISOString();

  if (status === "failed" && log.status === "reserved" && apiKey) {
    apiKey.remainingCredits += log.costCredits;
    apiKey.updatedAt = now;
    log.status = "refunded";
  } else {
    log.status = status;
  }

  log.errorMessage = errorMessage;
  log.updatedAt = now;
  writeData(data);

  return {
    remainingCredits: apiKey?.remainingCredits ?? null
  };
}

async function handleAdmin(req, res, url) {
  if (!isAdminRequest(req)) {
    sendJson(res, 401, { error: "管理 key 无效或未配置。" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/keys") {
    const data = readData();
    sendJson(res, 200, {
      keys: data.apiKeys.map(publicApiKey)
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/keys") {
    const body = JSON.parse(await readBody(req) || "{}");
    const now = new Date().toISOString();
    const userKey = createUserKey();
    const data = readData();
    const apiKey = {
      id: randomUUID(),
      keyHash: hashSecret(userKey),
      label: String(body.label || "未命名用户").trim().slice(0, 80) || "未命名用户",
      status: "active",
      remainingCredits: Math.max(0, Number.parseInt(body.initialCredits, 10) || 0),
      createdAt: now,
      updatedAt: now
    };

    data.apiKeys.unshift(apiKey);
    writeData(data);
    sendJson(res, 201, {
      key: userKey,
      apiKey: publicApiKey(apiKey)
    });
    return;
  }

  const creditMatch = /^\/api\/admin\/keys\/([^/]+)\/credits$/.exec(url.pathname);
  if (req.method === "POST" && creditMatch) {
    const body = JSON.parse(await readBody(req) || "{}");
    const delta = Number.parseInt(body.delta, 10);
    if (!Number.isFinite(delta)) {
      sendJson(res, 400, { error: "delta 必须是数字。" });
      return;
    }

    const data = readData();
    const apiKey = data.apiKeys.find(item => item.id === creditMatch[1]);
    if (!apiKey) {
      sendJson(res, 404, { error: "没有找到用户 key。" });
      return;
    }

    apiKey.remainingCredits = Math.max(0, apiKey.remainingCredits + delta);
    apiKey.updatedAt = new Date().toISOString();
    writeData(data);
    sendJson(res, 200, { apiKey: publicApiKey(apiKey) });
    return;
  }

  const disableMatch = /^\/api\/admin\/keys\/([^/]+)\/disable$/.exec(url.pathname);
  if (req.method === "POST" && disableMatch) {
    const data = readData();
    const apiKey = data.apiKeys.find(item => item.id === disableMatch[1]);
    if (!apiKey) {
      sendJson(res, 404, { error: "没有找到用户 key。" });
      return;
    }

    apiKey.status = "disabled";
    apiKey.updatedAt = new Date().toISOString();
    writeData(data);
    sendJson(res, 200, { apiKey: publicApiKey(apiKey) });
    return;
  }

  sendJson(res, 404, { error: "没有找到管理接口。" });
}

async function handleGenerate(req, res) {
  let reservation = null;
  try {
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
      token: getBearerToken(req),
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

  if (url.pathname.startsWith("/api/admin/")) {
    handleAdmin(req, res, url);
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
