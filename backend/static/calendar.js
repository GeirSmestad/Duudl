function pad2(n) {
  return String(n).padStart(2, "0");
}

export function isoDayFromYmd(year, monthIndex0, day) {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

export function formatIsoDayPretty(isoDay) {
  // Very small Norwegian-ish formatting without locale dependencies: YYYY-MM-DD → DD.MM.YYYY
  const [y, m, d] = isoDay.split("-");
  return `${d}.${m}.${y}`;
}

export function monthTitle(year, monthIndex0) {
  const monthNames = [
    "Januar",
    "Februar",
    "Mars",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${monthNames[monthIndex0]} ${year}`;
}

// Monday-first, so Sat/Sun are rightmost (as required).
export const DOW_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function weekdayMondayFirst(year, monthIndex0, day) {
  // JS: 0=Sun..6=Sat. Convert to Monday-first 0..6.
  const js = new Date(year, monthIndex0, day).getDay();
  return (js + 6) % 7;
}

export function createMonthCalendar({ rootEl, getSelectedSet, onToggleDay, year, monthIndex0, onPrev, onNext }) {
  rootEl.innerHTML = "";

  const header = document.createElement("div");
  header.className = "calendar__header";

  const leftBtn = document.createElement("button");
  leftBtn.type = "button";
  leftBtn.className = "btn btn--ghost";
  leftBtn.textContent = "←";
  leftBtn.addEventListener("click", onPrev);

  const title = document.createElement("div");
  title.className = "calendar__title";
  title.textContent = monthTitle(year, monthIndex0);

  const rightBtn = document.createElement("button");
  rightBtn.type = "button";
  rightBtn.className = "btn btn--ghost";
  rightBtn.textContent = "→";
  rightBtn.addEventListener("click", onNext);

  header.append(leftBtn, title, rightBtn);
  rootEl.append(header);

  const grid = document.createElement("div");
  grid.className = "calendar__grid";

  for (const label of DOW_LABELS) {
    const dow = document.createElement("div");
    dow.className = "calendar__dow";
    dow.textContent = label;
    grid.append(dow);
  }

  const firstWeekday = weekdayMondayFirst(year, monthIndex0, 1);
  const totalDays = daysInMonth(year, monthIndex0);

  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar__day calendar__day--empty";
    grid.append(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const iso = isoDayFromYmd(year, monthIndex0, day);
    const cell = document.createElement("div");
    cell.className = "calendar__day";
    cell.textContent = String(day);
    cell.dataset.isoDay = iso;

    if (getSelectedSet().has(iso)) {
      cell.classList.add("calendar__day--selected");
    }

    cell.addEventListener("click", () => {
      onToggleDay(iso);
    });

    grid.append(cell);
  }

  rootEl.append(grid);
}

