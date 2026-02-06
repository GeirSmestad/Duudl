import { attachCommentHoverTooltip, nextValue, renderGridTable } from "./grid.js";

const token = window.__DUUDL_TOKEN__;
const selectedUserId = window.__SELECTED_USER_ID__;

const gridRoot = document.getElementById("gridRoot");
const perDateRoot = document.getElementById("perDateRoot");
const copyUrlBtn = document.getElementById("copyUrlBtn");
const copyStatus = document.getElementById("copyStatus");

const INLINE_COMMENT_EDIT_MEDIA = "(hover: hover) and (pointer: fine)";
const inlineCommentEditEnabled = window.matchMedia?.(INLINE_COMMENT_EDIT_MEDIA)?.matches ?? false;
const MOBILE_INLINE_COMMENT_EDIT_MEDIA = "(hover: none) and (pointer: coarse)";
const mobileInlineCommentEditEnabled = window.matchMedia?.(MOBILE_INLINE_COMMENT_EDIT_MEDIA)?.matches ?? false;

function isIOS() {
  const ua = navigator.userAgent || "";
  // iPadOS often reports as Mac, but with touch points.
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
}

function viewportBaseContent() {
  const meta = document.querySelector('meta[name="viewport"]');
  const raw = meta?.getAttribute("content") || "";
  if (!raw) return "";
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith("maximum-scale=") && !p.startsWith("minimum-scale=") && p !== "user-scalable=no");
  return parts.join(", ");
}

function lockIOSViewportScaleTo1() {
  // This is the only truly deterministic fix for iOS Safari's non-deterministic
  // zoom level after orientation changes on complex pages (sticky headers + scroll containers).
  //
  // In theory this should disable pinch-zoom on iOS, but in practice it does not.
  if (!isIOS() || !mobileInlineCommentEditEnabled) return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  const base = viewportBaseContent();
  if (!base) return;

  meta.setAttribute("content", `${base}, minimum-scale=1, maximum-scale=1`);
}

if (isIOS() && mobileInlineCommentEditEnabled) {
  lockIOSViewportScaleTo1();
  window.addEventListener("orientationchange", () => {
    // Re-apply after Safari relayout.
    window.setTimeout(lockIOSViewportScaleTo1, 350);
  });
}

// UI-only state (not persisted).
const ui = {
  openCommentDays: new Set(),
};

// Day -> { open({focus}), close(), setValue(v), getValue() }
const perDateEditors = new Map();

let activeGridEdit = null; // { td, day }
let gridInlineEditor = null;
let inlineEditDocListenerAttached = false;
let mobileTouchMoveBlockerAttached = false;
let blockMobileScrollDuringPress = false;

function updateGridCellForMyDay(state, day) {
  const cell = gridRoot?.querySelector(`td[data-user-id="${selectedUserId}"][data-day="${day}"]`);
  if (!cell) return;

  const key = `${selectedUserId}:${day}`;
  const comment = (state.comments?.[key] ?? "").trim();

  const textEl = cell.querySelector(".gridCell__text");
  if (textEl) {
    textEl.textContent = comment ? comment : "";
  }
  cell.classList.toggle("gridCell--comment", Boolean(comment));
}

const FULL_WEEKDAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"]; // 0=Sun..6=Sat

function noPad(n) {
  return String(n);
}

function formatIsoDayDetailed(isoDay) {
  const [y, m, d] = String(isoDay).split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const wd = FULL_WEEKDAYS[dt.getDay()] ?? "";
  return `${wd} ${noPad(d)}.${noPad(m)}`;
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

function commentKeyForMyDay(day) {
  return `${selectedUserId}:${day}`;
}

function openPerDateCommentEditor(day, { focus = false } = {}) {
  ui.openCommentDays.add(day);
  const editor = perDateEditors.get(day);
  editor?.open({ focus });
}

function setCommentForMyDay(state, day, comment, { updatePerDateInput = true } = {}) {
  ensureMaps(state);
  const key = commentKeyForMyDay(day);
  state.comments[key] = comment;
  updateGridCellForMyDay(state, day);

  if (updatePerDateInput) {
    const editor = perDateEditors.get(day);
    editor?.setValue(comment);
  }

  debounce(key, 450, async () => {
    try {
      await postResponse({ day, value: state.responses[key] ?? null, comment: state.comments[key] ?? "" });
    } catch (e) {
      // ignore
    }
  });
}

async function flushCommentCommitForMyDay(state, day) {
  ensureMaps(state);
  const key = commentKeyForMyDay(day);
  try {
    await postResponse({ day, value: state.responses[key] ?? null, comment: state.comments[key] ?? "" });
  } catch (e) {
    // ignore
  }
}

function isGridEditModeActive() {
  return Boolean(activeGridEdit?.td);
}

function focusGridInlineEditorToEnd() {
  if (!gridInlineEditor) return;
  gridInlineEditor.focus();
  try {
    gridInlineEditor.setSelectionRange(gridInlineEditor.value.length, gridInlineEditor.value.length);
  } catch (e) {
    // ignore
  }
}

function exitGridEditMode({ flush = true } = {}) {
  if (!activeGridEdit?.td) return;
  const { td, day } = activeGridEdit;
  // Clear active state early to avoid re-entrancy (e.g. blur firing when removing the input).
  activeGridEdit = null;
  td.classList.remove("gridCell--editMode");
  if (gridInlineEditor?.parentElement === td) {
    td.removeChild(gridInlineEditor);
  }

  // Fire and forget.
  if (flush) {
    void flushCommentCommitForMyDay(state, day);
  }
}

function enterGridEditMode({ td, day, state, focus = true }) {
  if (!inlineCommentEditEnabled && !mobileInlineCommentEditEnabled) return;
  if (!td || !day) return;
  const userId = Number(td.dataset.userId);
  if (!userId || !canEditCell(userId, day)) return;

  if (activeGridEdit?.td && activeGridEdit.td !== td) {
    exitGridEditMode({ flush: true });
  }

  if (!gridInlineEditor) {
    gridInlineEditor = document.createElement("input");
    gridInlineEditor.type = "text";
    gridInlineEditor.className = "gridInlineEditor";
    gridInlineEditor.autocomplete = "off";
    gridInlineEditor.spellcheck = false;

    gridInlineEditor.addEventListener("pointerdown", (ev) => {
      // Prevent the table click handler from toggling yes/no while editing.
      ev.stopPropagation();
    });

    gridInlineEditor.addEventListener("input", () => {
      const day2 = activeGridEdit?.day;
      if (!day2) return;
      setCommentForMyDay(state, day2, gridInlineEditor.value, { updatePerDateInput: true });
    });

    gridInlineEditor.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === "Escape") {
        ev.preventDefault();
        exitGridEditMode({ flush: true });
      }
    });

    gridInlineEditor.addEventListener("blur", () => {
      // If focus leaves the input, treat it as an exit.
      exitGridEditMode({ flush: true });
    });
  }

  if (!inlineEditDocListenerAttached) {
    inlineEditDocListenerAttached = true;
    document.addEventListener(
      "pointerdown",
      (ev) => {
        if (!activeGridEdit?.td) return;
        const targetNode = ev.target instanceof Node ? ev.target : null;

        if (mobileInlineCommentEditEnabled) {
          const insideGrid = targetNode ? gridRoot?.contains(targetNode) : false;
          if (!insideGrid) {
            exitGridEditMode({ flush: true });
            return;
          }

          // While editing on mobile, do not allow taps inside the grid to toggle availability.
          const insideEditor = targetNode ? gridInlineEditor?.contains(targetNode) : false;
          if (!insideEditor) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          return;
        }

        const insideCell = targetNode ? activeGridEdit.td.contains(targetNode) : false;
        if (!insideCell) exitGridEditMode({ flush: true });
      },
      { capture: true },
    );
  }

  td.classList.add("gridCell--editMode");
  activeGridEdit = { td, day };

  const key = commentKeyForMyDay(day);
  gridInlineEditor.value = state.comments?.[key] ?? "";
  td.append(gridInlineEditor);

  // Ensure the per-date editor is visible + synchronized, but do not steal focus.
  openPerDateCommentEditor(day, { focus: false });
  perDateEditors.get(day)?.setValue(gridInlineEditor.value);

  if (focus) focusGridInlineEditorToEnd();
}

function attachHandlers(tableEl, state) {
  if (mobileInlineCommentEditEnabled) {
    if (!mobileTouchMoveBlockerAttached) {
      mobileTouchMoveBlockerAttached = true;
      document.addEventListener(
        "touchmove",
        (e) => {
          if (blockMobileScrollDuringPress) e.preventDefault();
        },
        { passive: false, capture: true },
      );
    }

    // Long-press on your own cell enters comment edit mode (mobile only).
    const LONG_PRESS_MS = 520;
    const MOVE_CANCEL_PX = 10;

    let pressTimer = null;
    let pressPointerId = null;
    let pressStartX = 0;
    let pressStartY = 0;
    let pressTd = null;
    let pressDay = null;
    let pressDidEnterEdit = false;

    function clearPress() {
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = null;
      pressPointerId = null;
      pressStartX = 0;
      pressStartY = 0;
      pressTd = null;
      pressDay = null;
      pressDidEnterEdit = false;
      blockMobileScrollDuringPress = false;
    }

    tableEl.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType !== "touch") return;
      if (isGridEditModeActive()) return;

      const td = ev.target.closest("td");
      if (!td) return;
      const day = td.dataset.day;
      const userId = Number(td.dataset.userId);
      if (!day || !userId) return;
      if (!canEditCell(userId, day)) return;

      pressPointerId = ev.pointerId;
      pressStartX = ev.clientX;
      pressStartY = ev.clientY;
      pressTd = td;
      pressDay = day;

      pressTimer = window.setTimeout(() => {
        pressTimer = null;
        pressDidEnterEdit = true;
        blockMobileScrollDuringPress = true;
        // Do NOT focus until the finger is released; focusing during a press can cause iOS to scroll/zoom weirdly.
        enterGridEditMode({ td: pressTd, day: pressDay, state, focus: false });
      }, LONG_PRESS_MS);
    });

    tableEl.addEventListener("pointermove", (ev) => {
      if (!pressTimer) return;
      if (pressPointerId !== ev.pointerId) return;
      const dx = ev.clientX - pressStartX;
      const dy = ev.clientY - pressStartY;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearPress();
      }
    });

    tableEl.addEventListener("pointerup", (ev) => {
      if (pressPointerId !== ev.pointerId) return;
      if (pressDidEnterEdit) {
        blockMobileScrollDuringPress = false;
        focusGridInlineEditorToEnd();
      }
      clearPress();
    });

    tableEl.addEventListener("pointercancel", (ev) => {
      if (pressPointerId !== ev.pointerId) return;
      clearPress();
    });
  }

  tableEl.addEventListener("click", async (ev) => {
    // While editing a comment on mobile, ignore grid clicks entirely.
    // Exiting edit mode is done by tapping outside the grid.
    if (mobileInlineCommentEditEnabled && isGridEditModeActive()) {
      return;
    }

    if (ev.target.closest(".gridCell__editBtn")) {
      if (!inlineCommentEditEnabled) return;
      const td = ev.target.closest("td");
      if (!td) return;
      const day = td.dataset.day;
      if (!day) return;
      enterGridEditMode({ td, day, state });
      return;
    }

    if (ev.target.closest(".gridInlineEditor")) {
      return;
    }

    const td = ev.target.closest("td");
    if (!td) return;
    const day = td.dataset.day;
    const userId = Number(td.dataset.userId);
    if (!day || !userId) return;
    if (!canEditCell(userId, day)) return;

    // When in edit mode, do not toggle yes/no on clicks within the active cell.
    if (isGridEditModeActive() && activeGridEdit?.td === td) {
      return;
    }

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
  if (label) root.setAttribute("aria-label", label);

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

  return root;
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
  perDateEditors.clear();

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
    dayTitle.textContent = formatIsoDayDetailed(day);

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

    let editorOpen = ui.openCommentDays.has(day) || (currentComment.length > 0 && currentComment !== "+1");

    const plusOneBtn = document.createElement("button");
    plusOneBtn.type = "button";
    plusOneBtn.className = "btn btn--ghost";
    plusOneBtn.textContent = "Min +1 kan komme";
    if (currentComment === "+1") {
      plusOneBtn.classList.remove("btn--ghost");
      plusOneBtn.classList.add("btn--ok");
    }

    const addCommentBtn = document.createElement("button");
    addCommentBtn.type = "button";
    addCommentBtn.className = "btn btn--ghost";
    addCommentBtn.textContent = "Legg til kommentar";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "Kommentar (valgfritt)";
    input.value = currentComment && currentComment !== "+1" ? currentComment : "";
    input.dataset.day = day;

    function renderRow2() {
      row2.innerHTML = "";
      const commentIsPlusOne = (state.comments?.[key] ?? "").trim() === "+1";
      plusOneBtn.classList.toggle("btn--ok", commentIsPlusOne);
      plusOneBtn.classList.toggle("btn--ghost", !commentIsPlusOne);

      if (editorOpen) {
        row2.append(input);
      } else {
        row2.append(addCommentBtn, plusOneBtn);
      }
    }

    function setEditorOpen(nextOpen, { focus = false } = {}) {
      editorOpen = nextOpen;
      if (editorOpen) {
        ui.openCommentDays.add(day);
        if ((state.comments?.[key] ?? "").trim() === "+1") {
          input.value = "+1";
        }
      } else {
        ui.openCommentDays.delete(day);
      }
      renderRow2();
      if (editorOpen && focus) {
        input.focus();
      }
    }

    addCommentBtn.addEventListener("click", () => {
      setEditorOpen(true, { focus: true });
    });

    plusOneBtn.addEventListener("click", async () => {
      const cur = (state.comments?.[key] ?? "").trim();
      const next = cur === "+1" ? "" : "+1";
      setCommentForMyDay(state, day, next, { updatePerDateInput: true });
      setEditorOpen(false);
      await flushCommentCommitForMyDay(state, day);
    });

    input.addEventListener("input", () => {
      setCommentForMyDay(state, day, input.value, { updatePerDateInput: false });
    });

    input.addEventListener("blur", () => {
      const cur = (input.value || "").trim();
      if (!cur) {
        setEditorOpen(false);
      }
    });

    renderRow2();
    card.append(row2);

    perDateRoot.append(card);

    perDateEditors.set(day, {
      open: ({ focus = false } = {}) => setEditorOpen(true, { focus }),
      close: () => setEditorOpen(false),
      setValue: (v) => {
        input.value = v ?? "";
      },
      getValue: () => input.value ?? "",
    });
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
attachCommentHoverTooltip(gridRoot);

