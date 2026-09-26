#!/usr/bin/env node
// Foreground static server for the built Vite site.
//
// Serves website/dist/client over HTTP on PORT (default 3000) and reuses the
// site's own handlers for /api/catalog (live upstream with offline fallback)
// and /api/preview so the static deployment renders real content.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dist = join(websiteRoot, "dist", "client");
if (!existsSync(join(dist, "index.html"))) {
  console.error(`Static deployment output must contain index.html: ${dist}`);
  process.exit(1);
}

const { handleCatalog, loadCatalog } = await import("../server/catalog.js");
const { createPreviewHandler } = await import("../server/previews.js");
const previewHandler = createPreviewHandler({ loadCatalog });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

function sendFile(res, file) {
  res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/api/catalog") {
      const request = new Request("http://localhost/api/catalog", { method: req.method || "GET" });
      const response = await handleCatalog(request);
      const headers = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      res.writeHead(response.status, headers);
      if (req.method === "HEAD" || response.status === 204 || response.status === 304) {
        res.end();
      } else {
        res.end(Buffer.from(await response.arrayBuffer()));
      }
      return;
    }
    if (url.pathname === "/api/preview") {
      await previewHandler(req, res);
      return;
    }
    const decoded = decodeURIComponent(url.pathname);
    const candidate = resolve(dist, `.${decoded}`);
    if (candidate !== dist && !candidate.startsWith(`${dist}/`)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    let file = candidate;
    try {
      if (statSync(file).isDirectory()) file = join(file, "index.html");
    } catch {
      file = "";
    }
    if (file && existsSync(file)) {
      sendFile(res, file);
      return;
    }
    // SPA fallback for navigations; API-shaped misses stay 404.
    if (!extname(decoded)) {
      sendFile(res, join(dist, "index.html"));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    if (!res.headersSent) res.writeHead(500);
    if (!res.writableEnded) res.end("Server error");
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving ${dist} on http://0.0.0.0:${port}/`);
});
