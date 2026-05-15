import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
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
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}

process.env.PORT ||= "5180";
process.env.HOST ||= "127.0.0.1";
process.env.IMAGE2_SHOW_DEV_CODES ||= "true";
process.env.RESEND_API_KEY = "dev-disabled";
process.env.MAIL_FROM = "dev-disabled";

await import("../server.js");
