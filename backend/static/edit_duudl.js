import { createMonthCalendar, formatIsoDayPretty } from "./calendar.js";
import { nextValue, renderGridTable } from "./grid.js";

const token = window.__DUUDL_TOKEN__;

const calendarRoot = document.getElementById("calendarRoot");
const selectedSummary = document.getElementById("selectedSummary");
const selectedDaysJson = document.getElementById("selectedDaysJson");
const clearBtn = document.getElementById("clearBtn");
const editForm = document.getElementById("editForm");

const gridRoot = document.getElementById("gridRoot");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalBody = document.getElementById("modalBody");
const modalCancel = document.getElementById("modalCancel");
const modalOk = document.getElementById("modalOk");

let state = null;
let initialDays = [];
let selected = new Set();

const now = new Date();
let year = now.getFullYear();
let monthIndex0 = now.getMonth();

function openModal({ text, onOk }) {
  modalBody.textContent = text;
  modalBackdrop.classList.add("modalBackdrop--open");

  function close() {
    modalBackdrop.classList.remove("modalBackdrop--open");
    modalCancel.removeEventListener("click", onCancel);
    modalOk.removeEventListener("click", onOkClick);
  }

  function onCancel() {
    close();
  }
  function onOkClick() {
    close();
    onOk();
  }

  modalCancel.addEventListener("click", onCancel);
  modalOk.addEventListener("click", onOkClick);
}

function updateSummary() {
  const days = Array.from(selected).sort();
  selectedDaysJson.value = JSON.stringify(days);
  if (days.length === 0) {
    selectedSummary.textContent = "ingen";
  } else {
    selectedSummary.textContent = days.map(formatIsoDayPretty).join(", ");
  }
}

function renderCalendar() {
  createMonthCalendar({
    rootEl: calendarRoot,
    getSelectedSet: () => selected,
    onToggleDay: (isoDay) => {
      if (selected.has(isoDay)) {
        selected.delete(isoDay);
      } else {
        selected.add(isoDay);
      }
      renderCalendar();
      updateSummary();
    },
    year,
    monthIndex0,
    onPrev: () => {
      monthIndex0 -= 1;
      if (monthIndex0 < 0) {
        monthIndex0 = 11;
        year -= 1;
      }
      renderCalendar();
    },
    onNext: () => {
      monthIndex0 += 1;
      if (monthIndex0 > 11) {
        monthIndex0 = 0;
        year += 1;
      }
      renderCalendar();
    },
  });
}

clearBtn?.addEventListener("click", () => {
  selected = new Set();
  renderCalendar();
  updateSummary();
});

editForm?.addEventListener("submit", (ev) => {
  const removed = initialDays.filter((d) => !selected.has(d));
  if (removed.length === 0) return;

  ev.preventDefault();
  openModal({
    text: `Du fjerner dato(er) som allerede finnes. Dette vil slette alle svar for disse datoene: ${removed.join(
      ", ",
    )}. Fortsette?`,
    onOk: () => {
      editForm.submit();
    },
  });
});

async function fetchState() {
  const res = await fetch(`/api/duudl/${encodeURIComponent(token)}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Failed to fetch duudl");
  return await res.json();
}

async function postAdminResponse({ user_id, day, value }) {
  const res = await fetch(`/api/duudl/${encodeURIComponent(token)}/admin-response`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id, day, value }),
  });
  if (!res.ok) throw new Error("Failed to update");
}

function attachGridHandlers(tableEl, s) {
  tableEl.addEventListener("click", async (ev) => {
    const td = ev.target.closest("td");
    if (!td) return;
    const day = td.dataset.day;
    const userId = Number(td.dataset.userId);
    if (!day || !userId) return;

    const key = `${userId}:${day}`;
    const current = s.responses[key] ?? null;
    const value = nextValue(current);

    // optimistic update
    s.responses[key] = value;
    renderGrid(s);

    try {
      await postAdminResponse({ user_id: userId, day, value });
    } catch (e) {
      s.responses[key] = current;
      renderGrid(s);
    }
  });
}

function renderGrid(s) {
  const table = renderGridTable({
    rootEl: gridRoot,
    users: s.users,
    days: s.days,
    responses: s.responses,
    rowHighlightUserId: null,
    canEditCell: () => true,
  });
  attachGridHandlers(table, s);
}

state = await fetchState();
initialDays = state.days.slice();
selected = new Set(state.days);
updateSummary();
renderCalendar();
renderGrid(state);

