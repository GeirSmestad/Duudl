export const VALUE_CYCLE = [null, "yes", "no", "inconvenient"];

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

export function valueSymbol(value) {
  if (value === "yes") return "✓";
  if (value === "no") return "✕";
  if (value === "inconvenient") return "△";
  return "";
}

export function renderGridTable({ rootEl, users, days, responses, rowHighlightUserId, canEditCell }) {
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
    th.textContent = day;
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
      const td = document.createElement("td");
      td.dataset.userId = String(u.id);
      td.dataset.day = day;
      td.className = cellClassForValue(val);
      td.textContent = valueSymbol(val);

      if (!canEditCell(u.id, day)) {
        td.classList.add("gridCell--readonly");
      }

      tr.append(td);
    }

    tbody.append(tr);
  }

  table.append(tbody);
  rootEl.append(table);

  return table;
}

