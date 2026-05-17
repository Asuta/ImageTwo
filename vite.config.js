import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

function adminPageFallback() {
  return {
    name: "image2-admin-page-fallback",
    configureServer(server) {
      const publicDir = fileURLToPath(new URL("./public", import.meta.url));

      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        if (req.method !== "GET" || url.pathname !== "/admin") {
          next();
          return;
        }

        const hasAdminCookie = /(?:^|;\s*)image2_admin=/.test(req.headers.cookie || "");
        const fileName = hasAdminCookie ? "admin.html" : "admin-login.html";
        const filePath = join(publicDir, fileName);
        if (!existsSync(filePath)) {
          next();
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(readFileSync(filePath));
      });
    }
  };
}

export default defineConfig({
  plugins: [adminPageFallback(), react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5180",
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
