import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const generatedDir = join(__dirname, "generated");

const START_PORT = Number(process.env.PORT || 5173);
const API_URL = "https://nowcoding.ai/v1/responses";
const MODEL = "gpt-5.4-mini";

const qualityOptions = new Set(["low", "medium", "high"]);
const aspectRatioOptions = new Set(["auto", "9:21", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"]);

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

mkdirSync(generatedDir, { recursive: true });
loadLocalEnv();

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

async function handleGenerate(req, res) {
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
      sendJson(res, upstream.status, {
        error: "图片接口返回错误。",
        detail: payload?.error?.message || text
      });
      return;
    }

    const imageCall = payload?.output?.find(item => item.type === "image_generation_call");
    const base64 = imageCall?.result;

    if (!base64) {
      sendJson(res, 502, {
        error: "接口返回成功，但没有找到图片结果。",
        detail: payload
      });
      return;
    }

    const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.png`;
    const filePath = join(generatedDir, fileName);
    writeFileSync(filePath, Buffer.from(base64, "base64"));

    sendJson(res, 200, {
      id: payload.id,
      model: payload.model || MODEL,
      status: imageCall.status,
      outputFormat: imageCall.output_format || "png",
      fileUrl: `/generated/${fileName}`,
      absolutePath: filePath.replaceAll("\\", "/")
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "生成失败。",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
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

  if (req.method === "POST" && url.pathname === "/api/generate") {
    handleGenerate(req, res);
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method not allowed");
    return;
  }

  if (url.pathname.startsWith("/generated/")) {
    serveFile(res, safeStaticPath(__dirname, url.pathname));
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

  server.listen(port, () => {
    console.log(`Image2 web generator is running at http://localhost:${port}`);
    console.log(`Generated images will be saved in ${generatedDir}`);
  });
}

listen(START_PORT);
