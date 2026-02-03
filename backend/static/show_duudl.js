import { formatIsoDayHeader, nextValue, renderGridTable } from "./grid.js";

const token = window.__DUUDL_TOKEN__;
const selectedUserId = window.__SELECTED_USER_ID__;

const gridRoot = document.getElementById("gridRoot");
const perDateRoot = document.getElementById("perDateRoot");
const copyUrlBtn = document.getElementById("copyUrlBtn");
const copyStatus = document.getElementById("copyStatus");

function updateGridCellForMyDay(state, day) {
  const cell = gridRoot?.querySelector(`td[data-user-id="${selectedUserId}"][data-day="${day}"]`);
  if (!cell) return;

  const key = `${selectedUserId}:${day}`;
  const comment = (state.comments?.[key] ?? "").trim();

  cell.textContent = comment ? comment : "";
  cell.classList.toggle("gridCell--comment", Boolean(comment));
  if (comment) {
    cell.title = comment;
  } else {
    cell.removeAttribute("title");
  }
}

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

async function postResponse({ day, value, comment }) {
  const res = await fetch(`/api/duudl/${encodeURIComponent(token)}/response`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ day, value, comment }),
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
    const comment = state.comments?.[key] ?? "";

    // optimistic update
    state.responses[key] = value;
    await render(state);

    try {
      await postResponse({ day, value, comment });
    } catch (e) {
      // revert on failure
      state.responses[key] = current;
      await render(state);
    }
  });
}

function ensureMaps(state) {
  if (!state.comments) state.comments = {};
  if (!state.responses) state.responses = {};
}

function createSegmentedChoice({ label, options, value, onChange }) {
  const root = document.createElement("div");
  root.className = "segmented";

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `segmented__btn ${opt.className || ""}`.trim();
    btn.textContent = opt.label;
    if (opt.value === value) btn.classList.add("segmented__btn--active");
    btn.addEventListener("click", () => {
      // Clicking the already-selected option clears the selection (blank).
      if (opt.value === value) {
        onChange(null);
      } else {
        onChange(opt.value);
      }
    });
    root.append(btn);
  }

  const wrap = document.createElement("div");
  wrap.className = "stack";
  const l = document.createElement("div");
  l.className = "pill";
  l.textContent = label;
  wrap.append(l, root);
  return wrap;
}

function debounceByKey() {
  const timers = new Map();
  return (key, ms, fn) => {
    const prev = timers.get(key);
    if (prev) window.clearTimeout(prev);
    timers.set(
      key,
      window.setTimeout(() => {
        timers.delete(key);
        fn();
      }, ms),
    );
  };
}

const debounce = debounceByKey();

function renderPerDateControls(state) {
  if (!perDateRoot) return;
  perDateRoot.innerHTML = "";

  const myUserId = selectedUserId;

  for (const day of state.days) {
    const key = `${myUserId}:${day}`;
    const currentValue = state.responses[key] ?? null;
    const currentComment = (state.comments?.[key] ?? "").trim();

    const card = document.createElement("div");
    card.className = "card stack";

    const header = document.createElement("div");
    header.className = "row";
    header.style.justifyContent = "space-between";

    const dayTitle = document.createElement("div");
    dayTitle.className = "h1";
    dayTitle.style.fontSize = "16px";
    dayTitle.style.margin = "0";
    dayTitle.textContent = formatIsoDayHeader(day);

    header.append(dayTitle);
    card.append(header);

    const choice = createSegmentedChoice({
      label: "Svar",
      options: [
        { value: "yes", label: "Ja", className: "segmented__btn--yes" },
        { value: "no", label: "Nei", className: "segmented__btn--no" },
        { value: "inconvenient", label: "Muligens", className: "segmented__btn--inconvenient" },
      ],
      value: currentValue,
      onChange: async (v) => {
        state.responses[key] = v;
        await render(state);
        try {
          await postResponse({ day, value: v, comment: state.comments?.[key] ?? "" });
        } catch (e) {
          // ignore; UI already updated
        }
      },
    });
    card.append(choice);

    const row2 = document.createElement("div");
    row2.className = "row";

    let editorOpen = currentComment.length > 0 && currentComment !== "+1";

    const plusOneBtn = document.createElement("button");
    plusOneBtn.type = "button";
    plusOneBtn.className = "btn btn--ghost";
    plusOneBtn.textContent = "Min +1 kan komme";
    if (currentComment === "+1") plusOneBtn.classList.add("btn--primary");

    const addCommentBtn = document.createElement("button");
    addCommentBtn.type = "button";
    addCommentBtn.className = "btn btn--ghost";
    addCommentBtn.textContent = "Legg til kommentar";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "Kommentar (valgfritt)";
    input.value = currentComment && currentComment !== "+1" ? currentComment : "";

    function renderRow2() {
      row2.innerHTML = "";
      const commentIsPlusOne = (state.comments?.[key] ?? "").trim() === "+1";
      plusOneBtn.classList.toggle("btn--primary", commentIsPlusOne);

      if (editorOpen) {
        row2.append(input);
      } else {
        row2.append(addCommentBtn, plusOneBtn);
      }
    }

    addCommentBtn.addEventListener("click", () => {
      editorOpen = true;
      if ((state.comments?.[key] ?? "").trim() === "+1") {
        input.value = "+1";
      }
      renderRow2();
      input.focus();
    });

    plusOneBtn.addEventListener("click", async () => {
      const cur = (state.comments?.[key] ?? "").trim();
      const next = cur === "+1" ? "" : "+1";
      state.comments[key] = next;
      editorOpen = false;
      updateGridCellForMyDay(state, day);
      renderRow2();
      try {
        await postResponse({ day, value: state.responses[key] ?? null, comment: next });
      } catch (e) {
        // ignore
      }
    });

    input.addEventListener("input", () => {
      state.comments[key] = input.value;
      updateGridCellForMyDay(state, day);
      debounce(key, 450, async () => {
        try {
          await postResponse({ day, value: state.responses[key] ?? null, comment: state.comments[key] ?? "" });
        } catch (e) {
          // ignore
        }
      });
    });

    input.addEventListener("blur", () => {
      const cur = (input.value || "").trim();
      if (!cur) {
        editorOpen = false;
        renderRow2();
      }
    });

    renderRow2();
    card.append(row2);

    perDateRoot.append(card);
  }
}

async function render(state) {
  ensureMaps(state);
  const table = renderGridTable({
    rootEl: gridRoot,
    users: state.users,
    days: state.days,
    responses: state.responses,
    comments: state.comments,
    rowHighlightUserId: selectedUserId,
    canEditCell,
  });
  attachHandlers(table, state);
  renderPerDateControls(state);
}

const state = await fetchState();
await render(state);

