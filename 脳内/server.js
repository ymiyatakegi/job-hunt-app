const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const API_KEY = process.env.OPENAI_API_KEY;
const ROOT = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/agent") {
      await handleAgent(req, res);
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
});

server.listen(PORT, () => {
  console.log(`脳内メモ: http://localhost:${PORT}`);
});

async function handleAgent(req, res) {
  if (!API_KEY) {
    sendJson(res, 500, {
      error: "OPENAI_API_KEY が設定されていません。"
    });
    return;
  }

  const body = await readJson(req);
  const query = String(body.query || "").trim();
  if (!query) {
    sendJson(res, 400, { error: "query が空です。" });
    return;
  }

  const payload = buildPromptPayload(body);
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
                "あなたはユーザー専用の思考整理エージェントです。",
                "保存済みメモと現在の入力を見て、該当しそうなメモ、理由、次に使える回答案を日本語で簡潔に返してください。",
                "勝手に事実を作らず、メモに根拠がない場合は不足情報として明示してください。"
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(payload, null, 2)
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

function buildPromptPayload(body) {
  const memos = Array.isArray(body.memos) ? body.memos : [];
  return {
    currentInput: String(body.query || ""),
    activeMemo: sanitizeMemo(body.activeMemo),
    savedMemos: memos.slice(0, 80).map(sanitizeMemo)
  };
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
