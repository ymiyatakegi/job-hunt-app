const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const API_KEY = process.env.OPENAI_API_KEY;
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/agent") {
      await processSiteMemos(req, res);
      return;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
}).listen(PORT, () => {
  console.log(`脳内メモ: http://localhost:${PORT}`);
});

async function processSiteMemos(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, { error: "OPENAI_API_KEY が設定されていません。" });
    return;
  }

  const body = await readJson(req);
  const memos = Array.isArray(body.memos) ? body.memos : [];
  if (!memos.length) {
    sendJson(res, 400, { error: "送信するメモがありません。" });
    return;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "あなたは日本語のメモ整理担当です。",
                "ユーザーのサイト内に保存されたメモ内容を読み取り、重要点、使えるプロンプト、重複や整理すべき点を返してください。",
                "メモにない事実は作らず、不足情報は不足情報として書いてください。"
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                request: body.query || "サイト内メモ全体を整理してください。",
                activeMemo: sanitizeMemo(body.activeMemo),
                savedMemos: memos.slice(0, 100).map(sanitizeMemo)
              }, null, 2)
            }
          ]
        }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    sendJson(res, response.status, {
      error: data.error?.message || "OpenAI API request failed"
    });
    return;
  }

  sendJson(res, 200, {
    model: data.model || MODEL,
    result: extractText(data)
  });
}

function sanitizeMemo(memo) {
  if (!memo || typeof memo !== "object") return null;
  return {
    title: String(memo.title || "").slice(0, 200),
    category: String(memo.category || memo.categoryId || "").slice(0, 80),
    description: String(memo.description || "").slice(0, 1200),
    body: String(memo.body || "").slice(0, 6000),
    updatedAt: String(memo.updatedAt || ""),
    updateCount: Number(memo.updateCount || 0)
  };
}

function extractText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim() || "結果テキストを取得できませんでした。";
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(ROOT, `.${requested}`);
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}
