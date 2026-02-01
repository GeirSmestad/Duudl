import { nextValue, renderGridTable } from "./grid.js";

const token = window.__DUUDL_TOKEN__;
const selectedUserId = window.__SELECTED_USER_ID__;

const gridRoot = document.getElementById("gridRoot");
const copyUrlBtn = document.getElementById("copyUrlBtn");
const copyStatus = document.getElementById("copyStatus");

function showCopyStatus(text) {
  copyStatus.textContent = text;
  copyStatus.style.display = "inline-flex";
  window.setTimeout(() => {
    copyStatus.style.display = "none";
  }, 1800);
}

copyUrlBtn?.addEventListener("click", async () => {
  const url = window.location.origin + window.location.pathname;
  try {
    await navigator.clipboard.writeText(url);
    showCopyStatus("Kopiert!");
  } catch (e) {
    showCopyStatus("Kunne ikke kopiere.");
  }
});

async function fetchState() {
  const res = await fetch(`/api/duudl/${encodeURIComponent(token)}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Failed to fetch duudl");
  return await res.json();
}

async function postResponse({ day, value }) {
  const res = await fetch(`/api/duudl/${encodeURIComponent(token)}/response`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ day, value }),
  });
  if (!res.ok) throw new Error("Failed to update");
}

function canEditCell(userId, _day) {
  return userId === selectedUserId;
}

function attachHandlers(tableEl, state) {
  tableEl.addEventListener("click", async (ev) => {
    const td = ev.target.closest("td");
    if (!td) return;
    const day = td.dataset.day;
    const userId = Number(td.dataset.userId);
    if (!day || !userId) return;
    if (!canEditCell(userId, day)) return;

    const key = `${userId}:${day}`;
    const current = state.responses[key] ?? null;
    const value = nextValue(current);

    // optimistic update
    state.responses[key] = value;
    await render(state);

    try {
      await postResponse({ day, value });
    } catch (e) {
      // revert on failure
      state.responses[key] = current;
      await render(state);
    }
  });
}

async function render(state) {
  const table = renderGridTable({
    rootEl: gridRoot,
    users: state.users,
    days: state.days,
    responses: state.responses,
    rowHighlightUserId: selectedUserId,
    canEditCell,
  });
  attachHandlers(table, state);
}

const state = await fetchState();
await render(state);

