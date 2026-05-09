const siteGrid = document.querySelector("#siteGrid");
const categoryGrid = document.querySelector("#categoryGrid");
const siteTemplate = document.querySelector("#siteTemplate");
const addSiteTemplate = document.querySelector("#addSiteTemplate");
const categoryTemplate = document.querySelector("#categoryTemplate");
const fileTemplate = document.querySelector("#fileTemplate");
const exportButton = document.querySelector("#exportButton");

const SITE_STORAGE_KEY = "job-management-sites-v1";
const DB_NAME = "job-management-files";
const DB_VERSION = 1;
const CATEGORIES = ["企業情報", "適性検査", "企業攻略", "その他"];

let sites = loadSites();
let dbPromise = openDatabase();

function loadSites() {
  const saved = localStorage.getItem(SITE_STORAGE_KEY);
  if (!saved) {
    return [
      { id: crypto.randomUUID(), name: "サイトA", url: "" },
      { id: crypto.randomUUID(), name: "サイトB", url: "" },
      { id: crypto.randomUUID(), name: "サイトC", url: "" },
      { id: crypto.randomUUID(), name: "サイトD", url: "" }
    ];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSites() {
  localStorage.setItem(SITE_STORAGE_KEY, JSON.stringify(sites));
}

function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function renderSites() {
  siteGrid.replaceChildren();

  sites.forEach((site) => {
    const card = siteTemplate.content.firstElementChild.cloneNode(true);
    const nameInput = card.querySelector(".site-name");
    const urlInput = card.querySelector(".site-url");
    const openLink = card.querySelector(".open-link");
    const deleteButton = card.querySelector(".delete-site");

    nameInput.value = site.name;
    urlInput.value = site.url;
    updateOpenLink(openLink, site.url);

    nameInput.addEventListener("input", () => {
      site.name = nameInput.value;
      saveSites();
    });

    urlInput.addEventListener("input", () => {
      site.url = urlInput.value;
      updateOpenLink(openLink, site.url);
      saveSites();
    });

    deleteButton.addEventListener("click", () => {
      sites = sites.filter((item) => item.id !== site.id);
      saveSites();
      renderSites();
    });

    siteGrid.append(card);
  });

  for (let index = 0; index < 2; index += 1) {
    const button = addSiteTemplate.content.firstElementChild.cloneNode(true);
    button.addEventListener("click", () => {
      sites.push({ id: crypto.randomUUID(), name: "", url: "" });
      saveSites();
      renderSites();
      const inputs = siteGrid.querySelectorAll(".site-name");
      inputs[inputs.length - 1]?.focus();
    });
    siteGrid.append(button);
  }
}

function updateOpenLink(link, url) {
  const normalized = normalizeUrl(url);
  link.href = normalized || "#";
  link.setAttribute("aria-disabled", normalized ? "false" : "true");
  link.onclick = (event) => {
    if (!normalized) event.preventDefault();
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("files")) {
        const store = db.createObjectStore("files", { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFiles(category) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readonly");
    const store = transaction.objectStore("files");
    const index = store.index("category");
    const request = index.getAll(category);

    request.onsuccess = () => {
      const files = request.result.sort((a, b) => b.createdAt - a.createdAt);
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

async function addFiles(category, fileList) {
  const db = await dbPromise;
  const files = Array.from(fileList);
  if (!files.length) return;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    const store = transaction.objectStore("files");

    files.forEach((file) => {
      store.add({
        id: crypto.randomUUID(),
        category,
        name: file.name,
        originalName: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        blob: file,
        createdAt: Date.now()
      });
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function updateFileName(id, name) {
  const db = await dbPromise;
  const existing = await getFileById(id);
  if (!existing) return;
  existing.name = name;

  await new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    transaction.objectStore("files").put(existing);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getFileById(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readonly");
    const request = transaction.objectStore("files").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteFile(id) {
  const db = await dbPromise;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    transaction.objectStore("files").delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function renderCategories() {
  categoryGrid.replaceChildren();

  for (const category of CATEGORIES) {
    const card = categoryTemplate.content.firstElementChild.cloneNode(true);
    const title = card.querySelector("h3");
    const count = card.querySelector(".file-count");
    const dropZone = card.querySelector(".drop-zone");
    const fileInput = card.querySelector(".file-input");
    const fileList = card.querySelector(".file-list");

    title.textContent = category;

    const files = await getFiles(category);
    count.textContent = `${files.length}件`;
    fileList.replaceChildren(...files.map((file) => createFileItem(file, category)));

    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("is-dragging");
    });

    dropZone.addEventListener("drop", async (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
      await addFiles(category, event.dataTransfer.files);
      renderCategories();
    });

    fileInput.addEventListener("change", async () => {
      await addFiles(category, fileInput.files);
      fileInput.value = "";
      renderCategories();
    });

    categoryGrid.append(card);
  }
}

function createFileItem(file, category) {
  const item = fileTemplate.content.firstElementChild.cloneNode(true);
  const nameInput = item.querySelector(".file-name");
  const meta = item.querySelector(".file-meta");
  const openButton = item.querySelector(".open-file");
  const deleteButton = item.querySelector(".delete-file");

  nameInput.value = file.name;
  meta.textContent = `${file.originalName} / ${formatSize(file.size)} / ${formatDate(file.createdAt)}`;

  nameInput.addEventListener("change", async () => {
    await updateFileName(file.id, nameInput.value.trim() || file.originalName);
    renderCategories();
  });

  openButton.addEventListener("click", async () => {
    const latest = await getFileById(file.id);
    if (!latest) return;
    const objectUrl = URL.createObjectURL(latest.blob);
    window.open(objectUrl, "_blank", "noreferrer");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  });

  deleteButton.addEventListener("click", async () => {
    await deleteFile(file.id);
    renderCategories();
  });

  return item;
}

exportButton.addEventListener("click", async () => {
  const allFiles = [];
  for (const category of CATEGORIES) {
    allFiles.push(...await getFiles(category));
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    sites,
    files: await Promise.all(allFiles.map(async ({ blob, ...file }) => ({
      ...file,
      dataUrl: await blobToDataUrl(blob)
    })))
  };

  const objectUrl = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `就職管理-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(objectUrl);
});

renderSites();
renderCategories().catch((error) => {
  console.error(error);
  alert("データ管理欄の読み込みに失敗しました。ブラウザの保存機能を確認してください。");
});
