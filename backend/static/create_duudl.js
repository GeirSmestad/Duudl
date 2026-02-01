import { createMonthCalendar, formatIsoDayPretty } from "./calendar.js";

const calendarRoot = document.getElementById("calendarRoot");
const selectedSummary = document.getElementById("selectedSummary");
const selectedDaysJson = document.getElementById("selectedDaysJson");
const clearBtn = document.getElementById("clearBtn");

let selected = new Set();
try {
  const initial = JSON.parse(selectedDaysJson?.value || "[]");
  if (Array.isArray(initial)) {
    selected = new Set(initial.map(String));
  }
} catch (e) {
  // ignore
}

const now = new Date();
let year = now.getFullYear();
let monthIndex0 = now.getMonth();

// If we already have selected dates (e.g. after validation error), start on the month of the first selected date.
const firstSelected = Array.from(selected).sort()[0];
if (firstSelected) {
  const [y, m] = firstSelected.split("-");
  const yy = Number(y);
  const mm = Number(m);
  if (Number.isFinite(yy) && Number.isFinite(mm)) {
    year = yy;
    monthIndex0 = mm - 1;
  }
}

function render() {
  createMonthCalendar({
    rootEl: calendarRoot,
    getSelectedSet: () => selected,
    onToggleDay: (isoDay) => {
      if (selected.has(isoDay)) {
        selected.delete(isoDay);
      } else {
        selected.add(isoDay);
      }
      render();
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
      render();
    },
    onNext: () => {
      monthIndex0 += 1;
      if (monthIndex0 > 11) {
        monthIndex0 = 0;
        year += 1;
      }
      render();
    },
  });
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

clearBtn?.addEventListener("click", () => {
  selected = new Set();
  render();
  updateSummary();
});

render();
updateSummary();

