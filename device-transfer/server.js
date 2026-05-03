const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const HOST = "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const STORAGE_DIR = path.join(ROOT, "storage");
const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");
const DB_PATH = path.join(STORAGE_DIR, "items.json");
const TOKEN_PATH = path.join(STORAGE_DIR, "token.txt");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const token = loadToken();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/") {
      return serveFile(res, path.join(PUBLIC_DIR, "index.html"));
    }

    if (url.pathname.startsWith("/api/")) {
      if (!isAuthorized(req, url)) {
        return json(res, 401, { error: "unauthorized" });
      }
      return handleApi(req, res, url);
    }

    if (url.pathname.startsWith("/files/")) {
      if (!isAuthorized(req, url)) {
        return text(res, 401, "Unauthorized");
      }
      return serveUpload(req, res, url);
    }

    const filePath = safeJoin(PUBLIC_DIR, decodeURIComponent(url.pathname.slice(1)));
    if (!filePath) {
      return text(res, 403, "Forbidden");
    }
    return serveFile(res, filePath);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "server_error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log("Device Transfer is running.");
  console.log("Keep this window open while using the app.");
  getAccessUrls().forEach((url) => console.log(url));
});

function loadToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    return fs.readFileSync(TOKEN_PATH, "utf8").trim();
  }
  const value = crypto.randomBytes(12).toString("hex");
  fs.writeFileSync(TOKEN_PATH, value, "utf8");
  return value;
}

function getAccessUrls() {
  const urls = [`PC: http://localhost:${PORT}/?key=${token}`];
  const nets = os.networkInterfaces();
  Object.values(nets).flat().filter(Boolean).forEach((net) => {
    if (net.family === "IPv4" && !net.internal) {
      urls.push(`Phone: http://${net.address}:${PORT}/?key=${token}`);
    }
  });
  return urls;
}

function isAuthorized(req, url) {
  const headerToken = req.headers["x-transfer-key"];
  const queryToken = url.searchParams.get("key");
  return headerToken === token || queryToken === token;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/items") {
    return json(res, 200, loadItems());
  }

  if (req.method === "POST" && url.pathname === "/api/message") {
    const body = await readJson(req, 1024 * 1024);
    const textValue = String(body.text || "").trim();
    if (!textValue) return json(res, 400, { error: "empty_message" });
    const items = loadItems();
    const item = {
      id: crypto.randomUUID(),
      type: "message",
      text: textValue,
      createdAt: new Date().toISOString()
    };
    items.unshift(item);
    saveItems(items);
    return json(res, 200, item);
  }

  if (req.method === "POST" && url.pathname === "/api/upload") {
    const originalName = sanitizeFilename(decodeHeaderValue(req.headers["x-file-name"] || "file"));
    const size = Number(req.headers["content-length"] || 0);
    const ext = path.extname(originalName);
    const storedName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const target = path.join(UPLOAD_DIR, storedName);
    await writeRequestToFile(req, target);

    const items = loadItems();
    const item = {
      id: crypto.randomUUID(),
      type: "file",
      name: originalName,
      storedName,
      size,
      url: `/files/${encodeURIComponent(storedName)}`,
      createdAt: new Date().toISOString()
    };
    items.unshift(item);
    saveItems(items);
    return json(res, 200, item);
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/items/")) {
    const id = url.pathname.split("/").pop();
    const items = loadItems();
    const item = items.find((entry) => entry.id === id);
    const nextItems = items.filter((entry) => entry.id !== id);
    if (item && item.type === "file" && item.storedName) {
      const target = safeJoin(UPLOAD_DIR, item.storedName);
      if (target && fs.existsSync(target)) fs.unlinkSync(target);
    }
    saveItems(nextItems);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "not_found" });
}

function loadItems() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  fs.writeFileSync(DB_PATH, JSON.stringify(items, null, 2), "utf8");
}

function serveUpload(req, res, url) {
  const storedName = decodeURIComponent(url.pathname.replace("/files/", ""));
  const filePath = safeJoin(UPLOAD_DIR, storedName);
  if (!filePath || !fs.existsSync(filePath)) return text(res, 404, "Not found");
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
  fs.createReadStream(filePath).pipe(res);
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return text(res, 404, "Not found");
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  const root = path.resolve(base);
  return resolved.startsWith(root + path.sep) || resolved === root ? resolved : "";
}

function sanitizeFilename(value) {
  const name = path.basename(String(value)).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  return name || "file";
}

function decodeHeaderValue(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeRequestToFile(req, target) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(target);
    req.pipe(stream);
    req.on("error", reject);
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function text(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}
