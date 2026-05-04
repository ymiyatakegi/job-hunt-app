const STORAGE_KEY = "schedule-app-fresh-mobile-v1";
const START_HOUR = 8;
const END_HOUR = 23;
const DAY_COUNT = 14;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
const CATEGORY_META = {
  travel: { label: "移動", color: "#5aa9e6" },
  play: { label: "遊び", color: "#f4a261" },
  partTime: { label: "バイト", color: "#7c5cff" },
  work: { label: "作業", color: "#2a9d8f" },
  sleep: { label: "睡眠", color: "#355070" },
};

const state = loadState();
const ui = {
  modalOpen: false,
  editingId: null,
  baseDate: alignBaseDate(state.baseDate || todayDateString()),
};

const app = document.getElementById("app");
render();

function fallbackState() {
  return {
    baseDate: alignBaseDate(todayDateString()),
    events: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallbackState();
    }
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return fallbackState();
  }
}

function normalizeState(input) {
  const base = fallbackState();
  return {
    baseDate: alignBaseDate(input && input.baseDate ? String(input.baseDate) : base.baseDate),
    events: Array.isArray(input && input.events)
      ? input.events.map((event) => ({
          id: event && event.id ? String(event.id) : cryptoId(),
          date: event && event.date ? String(event.date) : base.baseDate,
          startHour: clampHour(event && event.startHour),
          endHour: clampHour(event && event.endHour),
          category: CATEGORY_META[event && event.category] ? event.category : "work",
          title: event && event.title ? String(event.title) : "",
          note: event && event.note ? String(event.note) : "",
        })).map((event) => ({
          ...event,
          startHour: Math.min(event.startHour, event.endHour),
          endHour: Math.max(event.startHour, event.endHour),
        }))
      : [],
  };
}

function saveState() {
  state.baseDate = ui.baseDate;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  const days = plannerDays(ui.baseDate);
  const events = state.events.filter((item) => days.includes(item.date));
  app.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">TWO WEEK SCHEDULE</p>
        <h1>2週間スケジュール</h1>
        <p>スマホ用に、2週間を横に並べた時間割です。8:00から23:00までを1時間ごとに見られます。</p>
      </section>

      <section class="toolbar">
        <div>
          <div class="current-range">${rangeLabel(days[0], days[days.length - 1])}</div>
          <p class="toolbar-copy">セルをタップすると予定を追加できます。予定をタップすると編集できます。</p>
        </div>
        <div class="toolbar-actions">
          <div class="nav-actions">
            <button class="secondary" data-action="prev">前の2週間</button>
            <button class="ghost" data-action="today">今日へ</button>
            <button class="secondary" data-action="next">次の2週間</button>
          </div>
        </div>
      </section>

      <section class="legend">
        <div>
          <h2>色分け</h2>
          <p class="legend-copy">移動 / 遊び / バイト / 作業 / 睡眠</p>
        </div>
        <div class="legend-list">
          ${Object.entries(CATEGORY_META).map(([key, meta]) => `
            <span class="legend-item"><span class="legend-swatch" style="background:${meta.color}"></span>${meta.label}</span>
          `).join("")}
        </div>
      </section>

      <section class="grid-panel">
        <div class="grid-scroll">
          ${renderGrid(days, events)}
        </div>
      </section>
    </main>

    ${renderModal()}
  `;

  bindToolbar();
  bindGridInteractions();
  bindModalInteractions();
}

function renderGrid(days, events) {
  const gridChildren = [];
  gridChildren.push('<div class="corner"></div>');
  days.forEach((dateString) => {
    const date = dateOf(dateString);
    const isToday = dateString === todayDateString();
    gridChildren.push(`
      <div class="day-header ${isToday ? "is-today" : ""}">
        <div class="day-date">${date.getMonth() + 1}/${date.getDate()}</div>
        <div class="day-week">${WEEKDAY[date.getDay()]}</div>
      </div>
    `);
  });

  HOURS.forEach((hour) => {
    gridChildren.push(`<div class="time-label">${hourLabel(hour)}</div>`);
    days.forEach((dateString) => {
      const isToday = dateString === todayDateString();
      gridChildren.push(`<button class="cell ${isToday ? "is-today" : ""}" data-date="${dateString}" data-hour="${hour}" aria-label="${dateString} ${hourLabel(hour)} に予定追加"></button>`);
    });
  });

  return `
    <div class="schedule-wrap">
      <div class="schedule-grid">${gridChildren.join("")}</div>
      <div class="event-layer">${events.map(renderEventBlock).join("")}</div>
    </div>
  `;
}

function renderEventBlock(event) {
  const dayIndex = dayOffset(ui.baseDate, event.date);
  const top = 56 + (event.startHour - START_HOUR) * 58 + 4;
  const left = 68 + dayIndex * 108;
  const height = (event.endHour - event.startHour + 1) * 58 - 8;
  const meta = CATEGORY_META[event.category];
  return `
    <button
      class="event-block"
      data-event-id="${esc(event.id)}"
      style="top:${top}px;left:${left}px;height:${height}px;background:${meta.color};"
      aria-label="${esc(event.title || meta.label)} を編集"
    >
      <div class="event-title">${esc(event.title || meta.label)}</div>
      <div class="event-time">${hourLabel(event.startHour)} - ${hourLabel(event.endHour)}</div>
    </button>
  `;
}

function renderModal() {
  const event = ui.editingId ? state.events.find((item) => item.id === ui.editingId) : null;
  const draftDate = event ? event.date : todayWithinRange();
  const startHour = event ? event.startHour : 8;
  const endHour = event ? event.endHour : 8;
  const category = event ? event.category : "work";
  const title = event ? event.title : "";
  const note = event ? event.note : "";
  const preview = CATEGORY_META[category];
  return `
    <div class="modal ${ui.modalOpen ? "is-open" : ""}" id="eventModal">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <h2>${event ? "予定を編集" : "予定を追加"}</h2>
            <p class="event-meta">色分けカテゴリ付きで保存します。</p>
          </div>
          <button class="close-button" data-modal-action="close" aria-label="閉じる">×</button>
        </div>
        <form id="eventForm" class="form-grid">
          <label class="field">
            <span>日付</span>
            <input name="date" type="date" value="${draftDate}" required />
          </label>
          <div class="range-row">
            <label class="field">
              <span>開始</span>
              <select name="startHour">${hourOptions(startHour)}</select>
            </label>
            <label class="field">
              <span>終了</span>
              <select name="endHour">${hourOptions(endHour)}</select>
            </label>
          </div>
          <label class="field">
            <span>種類</span>
            <select class="category-select" name="category">${categoryOptions(category)}</select>
            <div class="category-preview"><span class="dot" style="background:${preview.color}"></span>${preview.label}</div>
          </label>
          <label class="field">
            <span>タイトル</span>
            <input name="title" type="text" value="${escAttr(title)}" placeholder="例: 出勤 / 移動 / 課題" />
          </label>
          <label class="field">
            <span>メモ</span>
            <textarea name="note" placeholder="補足があれば入力">${esc(note)}</textarea>
          </label>
          <div class="modal-actions">
            ${event ? '<button type="button" class="danger" data-modal-action="delete">削除</button>' : ""}
            <button type="button" class="secondary" data-modal-action="close">キャンセル</button>
            <button type="submit" class="primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function bindToolbar() {
  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "prev") {
        ui.baseDate = addDaysString(ui.baseDate, -DAY_COUNT);
      }
      if (action === "next") {
        ui.baseDate = addDaysString(ui.baseDate, DAY_COUNT);
      }
      if (action === "today") {
        ui.baseDate = alignBaseDate(todayDateString());
      }
      saveState();
      render();
    });
  });
}

function bindGridInteractions() {
  app.querySelectorAll(".cell[data-date][data-hour]").forEach((cell) => {
    cell.addEventListener("click", () => {
      ui.editingId = null;
      ui.modalOpen = true;
      ui.modalSeed = { date: cell.dataset.date, hour: Number(cell.dataset.hour) };
      render();
      const modal = document.getElementById("eventModal");
      const form = modal.querySelector("#eventForm");
      form.elements.date.value = cell.dataset.date;
      form.elements.startHour.value = cell.dataset.hour;
      form.elements.endHour.value = cell.dataset.hour;
    });
  });

  app.querySelectorAll(".event-block[data-event-id]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.editingId = button.dataset.eventId;
      ui.modalOpen = true;
      render();
    });
  });
}

function bindModalInteractions() {
  const modal = document.getElementById("eventModal");
  if (!modal) return;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  modal.querySelectorAll("[data-modal-action='close']").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  const deleteButton = modal.querySelector("[data-modal-action='delete']");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      state.events = state.events.filter((item) => item.id !== ui.editingId);
      saveState();
      closeModal();
      render();
    });
  }

  const form = modal.querySelector("#eventForm");
  const categorySelect = form.elements.category;
  const preview = modal.querySelector(".category-preview");
  categorySelect.addEventListener("change", () => {
    const meta = CATEGORY_META[categorySelect.value];
    preview.innerHTML = `<span class="dot" style="background:${meta.color}"></span>${meta.label}`;
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const entry = {
      id: ui.editingId || cryptoId(),
      date: String(data.get("date") || ui.baseDate),
      startHour: clampHour(data.get("startHour")),
      endHour: clampHour(data.get("endHour")),
      category: CATEGORY_META[data.get("category")] ? String(data.get("category")) : "work",
      title: String(data.get("title") || "").trim(),
      note: String(data.get("note") || "").trim(),
    };
    if (entry.endHour < entry.startHour) {
      [entry.startHour, entry.endHour] = [entry.endHour, entry.startHour];
    }

    const existingIndex = state.events.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
      state.events[existingIndex] = entry;
    } else {
      state.events.push(entry);
    }

    state.events.sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour);
    saveState();
    closeModal();
    render();
  });

  if (!ui.editingId && ui.modalSeed) {
    form.elements.date.value = ui.modalSeed.date;
    form.elements.startHour.value = String(ui.modalSeed.hour);
    form.elements.endHour.value = String(ui.modalSeed.hour);
  }
}

function closeModal() {
  ui.modalOpen = false;
  ui.editingId = null;
  ui.modalSeed = null;
  render();
}

function plannerDays(baseDate) {
  return Array.from({ length: DAY_COUNT }, (_, index) => addDaysString(baseDate, index));
}

function alignBaseDate(dateString) {
  const date = dateOf(dateString);
  const day = date.getDay();
  return fmtDate(addDays(date, -day));
}

function dateOf(value) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addDaysString(dateString, amount) {
  return fmtDate(addDays(dateOf(dateString), amount));
}

function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayDateString() {
  return fmtDate(new Date());
}

function dayOffset(baseDate, targetDate) {
  return Math.floor((dateOf(targetDate) - dateOf(baseDate)) / 86400000);
}

function hourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function rangeLabel(startDate, endDate) {
  const start = dateOf(startDate);
  const end = dateOf(endDate);
  return `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
}

function categoryOptions(selected) {
  return Object.entries(CATEGORY_META).map(([key, meta]) => `<option value="${key}" ${selected === key ? "selected" : ""}>${meta.label}</option>`).join("");
}

function hourOptions(selected) {
  return HOURS.map((hour) => `<option value="${hour}" ${selected === hour ? "selected" : ""}>${hourLabel(hour)}</option>`).join("");
}

function clampHour(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return START_HOUR;
  return Math.max(START_HOUR, Math.min(END_HOUR, Math.round(number)));
}

function cryptoId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function todayWithinRange() {
  const today = todayDateString();
  const days = plannerDays(ui.baseDate);
  return days.includes(today) ? today : ui.baseDate;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escAttr(value) {
  return esc(value).replaceAll('"', "&quot;");
}
