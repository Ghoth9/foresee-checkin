/**
 * Custom Thai Calendar Picker Modal
 * Beautiful in-app calendar replacing native browser datepicker dropdowns
 */

import { formatThaiDateDisplay, getTodayYMD } from './date.js';

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

let calCurrentYear = 2026;
let calCurrentMonth = 9; // 0-indexed (9 = Oct)
let calSelectedDate = null;
let calOnSelectCallback = null;

export function openCustomCalendar(initialDateStr, onSelect) {
  calOnSelectCallback = onSelect;

  if (initialDateStr && initialDateStr.includes("-")) {
    const parts = initialDateStr.split("-");
    calCurrentYear = parseInt(parts[0], 10) || new Date().getFullYear();
    calCurrentMonth = (parseInt(parts[1], 10) - 1) || new Date().getMonth();
    calSelectedDate = initialDateStr;
  } else {
    const d = new Date();
    calCurrentYear = d.getFullYear();
    calCurrentMonth = d.getMonth();
    calSelectedDate = getTodayYMD();
  }

  renderCustomCalendar();
  const modal = document.getElementById("customCalendarModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeCustomCalendar() {
  const modal = document.getElementById("customCalendarModal");
  if (modal) modal.classList.add("hidden");
}

export function prevCalendarMonth() {
  calCurrentMonth--;
  if (calCurrentMonth < 0) {
    calCurrentMonth = 11;
    calCurrentYear--;
  }
  renderCustomCalendar();
}

export function nextCalendarMonth() {
  calCurrentMonth++;
  if (calCurrentMonth > 11) {
    calCurrentMonth = 0;
    calCurrentYear++;
  }
  renderCustomCalendar();
}

export function selectTodayOnCalendar() {
  const today = getTodayYMD();
  if (calOnSelectCallback) calOnSelectCallback(today);
  closeCustomCalendar();
}

export function renderCustomCalendar() {
  const titleEl = document.getElementById("calMonthYearTitle");
  if (titleEl) {
    titleEl.innerText = `${THAI_MONTHS[calCurrentMonth]} ${calCurrentYear + 543} (${calCurrentYear})`;
  }

  const grid = document.getElementById("calDaysGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const firstDay = new Date(calCurrentYear, calCurrentMonth, 1).getDay();
  const daysInMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(calCurrentYear, calCurrentMonth, 0).getDate();

  // Blank days from previous month
  for (let i = 0; i < firstDay; i++) {
    const dNum = prevMonthDays - firstDay + i + 1;
    const cell = document.createElement("div");
    cell.className = "py-2.5 text-slate-300 text-center font-mono text-xs";
    cell.innerText = dNum;
    grid.appendChild(cell);
  }

  // Days in current month
  const todayYMD = getTodayYMD();
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(calCurrentMonth + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    const dateVal = `${calCurrentYear}-${mStr}-${dStr}`;

    const isSelected = dateVal === calSelectedDate;
    const isToday = dateVal === todayYMD;

    const cell = document.createElement("button");
    cell.type = "button";
    let cellClasses = "py-2 rounded-xl text-center font-bold text-xs transition-all active:scale-95 ";

    if (isSelected) {
      cellClasses += "bg-blue-600 text-white shadow-sm ring-2 ring-blue-300";
    } else if (isToday) {
      cellClasses += "bg-blue-50 text-blue-700 border-2 border-blue-400 font-extrabold";
    } else {
      cellClasses += "hover:bg-slate-100 text-slate-800";
    }
    cell.className = cellClasses;
    cell.innerText = d;
    cell.onclick = () => {
      calSelectedDate = dateVal;
      if (calOnSelectCallback) calOnSelectCallback(dateVal);
      closeCustomCalendar();
    };
    grid.appendChild(cell);
  }
}

// Window exposure
if (typeof window !== "undefined") {
  window.openCustomCalendar = openCustomCalendar;
  window.closeCustomCalendar = closeCustomCalendar;
  window.prevCalendarMonth = prevCalendarMonth;
  window.nextCalendarMonth = nextCalendarMonth;
  window.selectTodayOnCalendar = selectTodayOnCalendar;
}
