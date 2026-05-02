const STORAGE_KEY = "job-hunt-company-sheet-v1";

const columns = [
  { key: "companyName", label: "企業名", size: "small" },
  { key: "recruitPage", label: "採用ページ", size: "medium", isUrl: true },
  { key: "userName", label: "ユーザー名", size: "small" },
  { key: "motivation", label: "志望動機", size: "large" },
  { key: "homePage", label: "ホームページ", size: "medium", isUrl: true },
  { key: "salary", label: "年収", size: "small" },
  { key: "averageTenure", label: "平均勤続年数", size: "small" },
  { key: "companySize", label: "企業規模", size: "small" },
  { key: "business", label: "事業内容", size: "large" },
  { key: "internDeadline", label: "インターン締め切り", size: "small" },
  { key: "jobSite", label: "就活サイトホームページ", size: "medium", isUrl: true },
  { key: "internFlow", label: "インターン選考フロー", size: "medium" },
  { key: "postInternFlow", label: "インターン後選考フロー", size: "medium" },
  { key: "mainFlow", label: "本選考フロー", size: "medium" }
];

const tableHeadRow = document.querySelector("#table-head-row");
const tableBody = document.querySelector("#table-body");
const addRowButton = document.querySelector("#add-row-button");
const resetButton = document.querySelector("#reset-button");
const saveStatus = document.querySelector("#save-status");
const cellTemplate = document.querySelector("#cell-template");

let rows = loadRows();
renderTable();
setStatus("保存済み");

addRowButton.addEventListener("click", () => {
  rows.push(createEmptyRow());
  renderTable();
  persistRows();
});

resetButton.addEventListener("click", () => {
  if (!window.confirm("入力済みの企業情報をすべて削除します。よろしいですか？")) {
    return;
  }

  rows = [createEmptyRow()];
  renderTable();
  persistRows();
});

function renderTable() {
  renderHeader();
  tableBody.innerHTML = "";

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");

    columns.forEach((column) => {
      const cell = cellTemplate.content.firstElementChild.cloneNode(true);
      const textarea = cell.querySelector(".cell-input");
      const wrap = cell.querySelector(".cell-wrap");

      cell.classList.add(`col-${column.size}`);
      textarea.value = row[column.key] ?? "";
      textarea.setAttribute("aria-label", `${column.label} ${rowIndex + 1}行目`);
      textarea.addEventListener("input", (event) => {
        rows[rowIndex][column.key] = event.target.value;
        autoResize(event.target);
        updateLink(wrap, column, event.target.value);
        persistRows();
      });

      autoResize(textarea);
      updateLink(wrap, column, textarea.value);
      tr.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    actionCell.className = "col-action action-cell";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      rows.splice(rowIndex, 1);
      if (rows.length === 0) {
        rows.push(createEmptyRow());
      }
      renderTable();
      persistRows();
    });
    actionCell.appendChild(deleteButton);
    tr.appendChild(actionCell);

    tableBody.appendChild(tr);
  });
}

function renderHeader() {
  tableHeadRow.innerHTML = "";

  columns.forEach((column) => {
    const th = document.createElement("th");
    th.classList.add(`col-${column.size}`);
    th.textContent = column.label;
    tableHeadRow.appendChild(th);
  });

  const actionHeader = document.createElement("th");
  actionHeader.className = "col-action";
  actionHeader.textContent = "操作";
  tableHeadRow.appendChild(actionHeader);
}

function updateLink(wrap, column, value) {
  const existingLink = wrap.querySelector(".cell-link");
  if (existingLink) {
    existingLink.remove();
  }

  if (!column.isUrl) {
    return;
  }

  const normalizedUrl = normalizeUrl(value);
  const link = document.createElement("a");
  link.className = "cell-link";
  link.target = "_blank";
  link.rel = "noreferrer noopener";

  if (normalizedUrl) {
    link.href = normalizedUrl;
    link.dataset.visible = "true";
    link.textContent = "リンクを開く";
  } else {
    link.href = "#";
    link.dataset.visible = "false";
    link.textContent = "";
  }

  wrap.appendChild(link);
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).href;
  } catch {
    return "";
  }
}

function autoResize(textarea) {
  textarea.style.height = "0px";
  textarea.style.height = `${Math.max(textarea.scrollHeight, 98)}px`;
}

function persistRows() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  setStatus(`保存済み ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`);
}

function loadRows() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((row) => ({
        ...createEmptyRow(),
        ...row
      }));
    }
  } catch {
    // Ignore broken local data and fall back to a clean sheet.
  }

  return [createEmptyRow()];
}

function createEmptyRow() {
  return Object.fromEntries(columns.map((column) => [column.key, ""]));
}

function setStatus(message) {
  saveStatus.textContent = message;
}
