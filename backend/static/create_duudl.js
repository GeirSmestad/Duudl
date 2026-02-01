import { createMonthCalendar, formatIsoDayPretty } from "./calendar.js";

const calendarRoot = document.getElementById("calendarRoot");
const selectedSummary = document.getElementById("selectedSummary");
const selectedDaysJson = document.getElementById("selectedDaysJson");
const clearBtn = document.getElementById("clearBtn");

let selected = new Set();

const now = new Date();
let year = now.getFullYear();
let monthIndex0 = now.getMonth();

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

