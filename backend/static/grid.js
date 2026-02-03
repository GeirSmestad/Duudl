import { attachHoverTooltip, isTextTruncated } from "./tooltip.js";

export const VALUE_CYCLE = [null, "yes", "no", "inconvenient"];

const PENCIL_ICON_SVG = `
<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
</svg>
`.trim();

export function nextValue(current) {
  const idx = VALUE_CYCLE.indexOf(current ?? null);
  return VALUE_CYCLE[(idx + 1) % VALUE_CYCLE.length];
}

export function cellClassForValue(value) {
  if (value === "yes") return "gridCell gridCell--yes";
  if (value === "no") return "gridCell gridCell--no";
  if (value === "inconvenient") return "gridCell gridCell--inconvenient";
  return "gridCell";
}

function displayCellText({ value, comment }) {
  const c = (comment || "").trim();
  if (c) return c;
  return "";
}

const WEEKDAYS = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"]; // JS: 0=Sun..6=Sat

function noPad(n) {
  return String(n);
}

export function formatIsoDayHeader(isoDay) {
  // isoDay: YYYY-MM-DD (treated as local date for display)
  const [y, m, d] = String(isoDay).split("-").map((x) => Number(x));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const wd = WEEKDAYS[dt.getDay()] ?? "";
  return `${wd} ${noPad(d)}.${noPad(m)}`;
}

export function renderGridTable({ rootEl, users, days, responses, comments, rowHighlightUserId, canEditCell }) {
  rootEl.innerHTML = "";

  const table = document.createElement("table");
  table.className = "gridTable";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  const th0 = document.createElement("th");
  th0.textContent = "Navn";
  headRow.append(th0);

  for (const day of days) {
    const th = document.createElement("th");
    th.textContent = formatIsoDayHeader(day);
    headRow.append(th);
  }

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");

  for (const u of users) {
    const tr = document.createElement("tr");
    if (rowHighlightUserId && u.id === rowHighlightUserId) {
      tr.classList.add("gridRow--me");
    }

    const nameCell = document.createElement("td");
    nameCell.style.textAlign = "left";
    nameCell.textContent = u.display_name;
    tr.append(nameCell);

    for (const day of days) {
      const key = `${u.id}:${day}`;
      const val = responses[key] ?? null;
      const comment = comments?.[key] ?? "";
      const td = document.createElement("td");
      td.dataset.userId = String(u.id);
      td.dataset.day = day;
      td.className = cellClassForValue(val);
      const textEl = document.createElement("div");
      textEl.className = "gridCell__text";
      textEl.textContent = displayCellText({ value: val, comment });
      td.append(textEl);
      if (comment) {
        td.classList.add("gridCell--comment");
      }

      const editable = canEditCell(u.id, day);
      if (!editable) {
        td.classList.add("gridCell--readonly");
      } else {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "gridCell__editBtn";
        editBtn.setAttribute("aria-label", "Rediger kommentar");
        editBtn.innerHTML = PENCIL_ICON_SVG;
        td.append(editBtn);
      }

      tr.append(td);
    }

    tbody.append(tr);
  }

  table.append(tbody);
  rootEl.append(table);

  return table;
}

export function attachCommentHoverTooltip(containerEl) {
  // Tooltip is shown only when the visible text is actually truncated.
  // Since we use multi-line clamping, measure truncation on the inner `.gridCell__text` element.
  return attachHoverTooltip({
    containerEl,
    targetSelector: "td.gridCell--comment:not(.gridCell--editMode)",
    tooltipClassName: "commentTooltip",
    getText: (td) => td.textContent || "",
    shouldShow: (td) => {
      const textEl = td.querySelector(".gridCell__text");
      if (!textEl) return false;
      return isTextTruncated(textEl, 2);
    },
  });
}
