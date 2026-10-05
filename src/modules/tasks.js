/**
 * Supervisor Task Management Module (งานมอบหมาย)
 */

import { formatThaiDateDisplay, getDeadlineCountdownBadge, isTaskOverdue, getTodayYMD, getSevenDaysLaterYMD } from '../utils/date.js';
import { saveTaskApi, extendTaskDeadlineApi, deleteTaskApi } from '../api/supabase.js';
import { createExtendDeadlineFlexCard, createAssignTaskFlexCard, triggerLiffShare } from '../liff/line.js';
import { showAppAlert, showAppConfirm } from '../utils/dialog.js';
import { openCustomCalendar } from '../utils/calendar.js';

let taskViewMode = window.innerWidth >= 768 ? "list" : "grid";
let currentStatusFilter = "ทั้งหมด";
let currentTechFilter = "ทั้งหมด";
let taskSearchQuery = "";

let assignRows = [];
let selectedAssignStatus = "กำลังทำ";

let currentEditingTaskId = null;
let editingTechs = [];
let editingStartDate = null;
let editingDeadlineDate = null;
let editModalStatus = "กำลังทำ";

let currentExtendingTaskId = null;
let selectedExtendNewDeadline = null;

let recentNewTaskIds = new Set();
try {
  const savedNew = localStorage.getItem("fs_recent_new_tasks");
  if (savedNew) recentNewTaskIds = new Set(JSON.parse(savedNew));
} catch (e) {}

export function getTaskTechs(task) {
  if (Array.isArray(task.techs)) return task.techs;
  if (typeof task.techs === "string") return [task.techs];
  return ["ช่างทั่วไป"];
}

export function setTaskViewMode(mode, tasksList) {
  taskViewMode = mode;
  const btnList = document.getElementById("viewModeBtnList");
  const btnGrid = document.getElementById("viewModeBtnGrid");
  if (btnList && btnGrid) {
    if (mode === "list") {
      btnList.className = "p-1.5 rounded-md transition-all bg-white text-slate-900 shadow-2xs font-semibold";
      btnGrid.className = "p-1.5 rounded-md transition-all text-slate-500 hover:text-slate-900";
    } else {
      btnGrid.className = "p-1.5 rounded-md transition-all bg-white text-slate-900 shadow-2xs font-semibold";
      btnList.className = "p-1.5 rounded-md transition-all text-slate-500 hover:text-slate-900";
    }
  }
  renderTasksList(tasksList);
}

export function setStatusFilter(status, tasksList) {
  currentStatusFilter = status;
  ["ทั้งหมด", "กำลังทำ", "เกินกำหนด", "เสร็จสิ้น"].forEach(st => {
    const btn = document.getElementById(`statusFilterBtn-${st}`);
    if (btn) {
      if (st === status) {
        btn.className = "px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-white transition-all flex items-center space-x-1.5 flex-shrink-0";
      } else {
        btn.className = "px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all flex items-center space-x-1.5 flex-shrink-0";
      }
    }
  });
  renderTasksList(tasksList);
}

let cachedTechnicians = [];

export function setTechFilter(techName, tasksList, allTechnicians) {
  currentTechFilter = techName;
  if (Array.isArray(allTechnicians) && allTechnicians.length > 0) {
    cachedTechnicians = allTechnicians;
  }
  renderTechFilterChips(tasksList, cachedTechnicians);
  renderTasksList(tasksList);
}

export function renderTechFilterChips(tasksList, allTechnicians = []) {
  if (Array.isArray(allTechnicians) && allTechnicians.length > 0) {
    cachedTechnicians = allTechnicians;
  }
  const container = document.getElementById("techFilterChipsContainer");
  if (!container) return;

  const techs = ["ทั้งหมด", ...cachedTechnicians];
  container.innerHTML = techs.map(tName => {
    const isSelected = currentTechFilter === tName;
    return `
      <button type="button" onclick="window.setTaskTechFilter('${tName}')" class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
        isSelected
          ? 'bg-slate-900 text-white font-semibold shadow-xs'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }">
        ${tName}
      </button>
    `;
  }).join('');
}

export function setTaskSearchQuery(q) {
  taskSearchQuery = q || "";
}

export function renderTasksList(tasksList) {
  const container = document.getElementById("tasksListContainer");
  if (!container) return;

  // 1. Calculate Filter Statistics (BUG FIX: Accurate overdue calculation)
  let overdueCount = 0;
  let inprogCount = 0;
  let completedCount = 0;

  const techFiltered = tasksList.filter(t => {
    if (currentTechFilter === "ทั้งหมด") return true;
    const techs = getTaskTechs(t);
    return techs.includes(currentTechFilter);
  });

  techFiltered.forEach(t => {
    const isDone = t.status === "เสร็จสิ้น";
    const isOver = isTaskOverdue(t.deadline, isDone);
    if (isDone) completedCount++;
    else if (isOver) overdueCount++;
    else inprogCount++;
  });

  const elTotal = document.getElementById("statTotalTasks");
  if (elTotal) elTotal.innerText = techFiltered.length;
  const elOver = document.getElementById("statOverdue");
  if (elOver) elOver.innerText = overdueCount;
  const elProg = document.getElementById("statInProgress");
  if (elProg) elProg.innerText = inprogCount;
  const elComp = document.getElementById("statCompleted");
  if (elComp) elComp.innerText = completedCount;

  // 2. Filter by Status & Search
  const filteredTasks = techFiltered.filter(t => {
    const isDone = t.status === "เสร็จสิ้น";
    const isOver = isTaskOverdue(t.deadline, isDone);

    if (currentStatusFilter === "กำลังทำ" && (isDone || isOver)) return false;
    if (currentStatusFilter === "เกินกำหนด" && !isOver) return false;
    if (currentStatusFilter === "เสร็จสิ้น" && !isDone) return false;

    if (taskSearchQuery) {
      const q = taskSearchQuery.toLowerCase();
      const titleMatch = (t.title || "").toLowerCase().includes(q);
      const descMatch = (t.desc || "").toLowerCase().includes(q);
      const techMatch = getTaskTechs(t).some(tech => tech.toLowerCase().includes(q));
      if (!titleMatch && !descMatch && !techMatch) return false;
    }
    return true;
  });

  // Sort: Newly created tasks always appear at the top!
  filteredTasks.sort((a, b) => {
    const isNewA = recentNewTaskIds.has(a.id) || a.isNew;
    const isNewB = recentNewTaskIds.has(b.id) || b.isNew;
    if (isNewA && !isNewB) return -1;
    if (!isNewA && isNewB) return 1;
    return 0;
  });


  if (tasksList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8 shadow-xs">
        <div class="w-14 h-14 mx-auto mb-3.5 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl">📋</div>
        <h3 class="text-base font-bold text-slate-900">ยังไม่มีรายการงานในระบบ</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">เริ่มต้นมอบหมายงานแรกให้ทีมช่าง โดยกดปุ่มด้านล่างเพื่อระบุไซต์งานและช่างผู้รับผิดชอบ</p>
        <button type="button" onclick="openAssignModal()" class="mt-4 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all inline-flex items-center space-x-1.5 active:scale-95">
          <span>+ มอบหมายงานใหม่</span>
        </button>
      </div>
    `;
    return;
  }

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div class="text-3xl mb-2">🔍</div>
        <div class="text-sm font-bold text-slate-800">ไม่พบงานที่ตรงกับเงื่อนไข</div>
        <p class="text-xs text-slate-500 mt-1">ตัวกรองปัจจุบัน: สถานะ "${currentStatusFilter}"${currentTechFilter !== 'ทั้งหมด' ? ` / ${currentTechFilter}` : ''}</p>
        <button type="button" onclick="window.setStatusFilter('ทั้งหมด'); window.setTaskTechFilter('ทั้งหมด');" class="mt-3 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-colors">
          ล้างตัวกรองทั้งหมด
        </button>
      </div>
    `;
    return;
  }

  // 3. Render View Mode
  if (taskViewMode === "list" && window.innerWidth >= 768) {
    // List Table View - High Contrast & 100% Fluid
    let tableHtml = `
      <div class="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        <table class="w-full text-left text-sm border-collapse">
          <thead class="bg-slate-100 text-xs font-bold text-slate-800 border-b-2 border-slate-200">
            <tr>
              <th class="py-3.5 px-3 w-10 text-center font-mono">#</th>
              <th class="py-3.5 px-3 w-32 whitespace-nowrap">สถานะ</th>
              <th class="py-3.5 px-3">ชื่องานปฏิบัติการ & ไซต์งาน</th>
              <th class="py-3.5 px-3 w-36">ช่างผู้รับผิดชอบ</th>
              <th class="py-3.5 px-3 w-32 whitespace-nowrap">กำหนดส่ง</th>
              <th class="py-3.5 px-3 w-28 whitespace-nowrap">ความคืบหน้า</th>
              <th class="py-3.5 px-3 w-36 text-right pr-4 whitespace-nowrap">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
    `;

    filteredTasks.forEach((task, index) => {
      const isDone = task.status === "เสร็จสิ้น";
      const isOver = isTaskOverdue(task.deadline, isDone);
      const isNew = recentNewTaskIds.has(task.id) || task.isNew;
      const techs = getTaskTechs(task);
      const photoCount = (task.progressHistory || task.customer?.progress_history || []).reduce((acc, it) => acc + (Array.isArray(it.photos) ? it.photos.length : 0), 0);

      let badgeBg = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
      if (isDone) badgeBg = "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold";
      else if (isOver) badgeBg = "bg-rose-100 text-rose-900 border-rose-300 font-bold";
      else if (task.status === "กำลังทำ") badgeBg = "bg-blue-100 text-blue-900 border-blue-300 font-bold";

      const rowClass = isNew
        ? "bg-blue-50/70 border-l-4 border-l-blue-600 hover:bg-blue-100/70 transition-colors group cursor-pointer ring-1 ring-blue-200/50"
        : "hover:bg-blue-50/50 transition-colors group cursor-pointer";

      tableHtml += `
        <tr class="${rowClass}" onclick="window.openTaskDetailModal('${task.id}')">
          <td class="py-3.5 px-3 text-center font-mono text-xs text-slate-500 font-semibold">${index + 1}</td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span class="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeBg}">
                ${task.status}
              </span>
              ${isNew ? `<span class="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 border border-amber-300 shadow-xs animate-pulse flex-shrink-0"><span>✨</span><span>งานใหม่</span></span>` : ''}
            </div>
          </td>
          <td class="py-3 px-3">
            <div>
              <div class="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 flex items-center space-x-2">
                <span>${task.title}</span>
              </div>
              ${task.desc && task.desc !== '-' ? `<div class="text-xs text-slate-500 line-clamp-1 mt-0.5">${task.desc}</div>` : ''}
              ${task.latestUpdate && task.latestUpdate !== 'ยังไม่มีอัปเดต' ? `<div class="text-[11px] text-blue-600 line-clamp-1 mt-0.5">💬 ${task.latestUpdate}</div>` : ''}
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-wrap gap-1">
              ${techs.map(tName => `<span class="text-xs bg-slate-100 text-slate-800 font-medium px-2 py-0.5 rounded-md border border-slate-200">${tName}</span>`).join('')}
            </div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="font-mono text-xs text-slate-800 font-semibold">${formatThaiDateDisplay(task.deadline)}</div>
            <div class="mt-0.5">${getDeadlineCountdownBadge(task.deadline, isDone)}</div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="flex items-center space-x-2">
              <div class="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div class="h-1.5 ${isDone ? 'bg-emerald-500' : 'bg-slate-900'} rounded-full transition-all" style="width: ${task.progress || 0}%"></div>
              </div>
              <span class="font-mono text-xs font-bold text-slate-800">${task.progress || 0}%</span>
            </div>
          </td>
          <td class="py-3 px-3 text-right pr-4 whitespace-nowrap">
            <div class="flex items-center justify-end space-x-1.5">
              ${photoCount > 0 ? `
                <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}', 'timeline')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition-all inline-flex items-center space-x-1 active:scale-95 shadow-2xs" title="ดูภาพหน้างาน">
                  <span>📸</span>
                  <span>${photoCount}</span>
                </button>
              ` : ''}
              <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}')" class="px-2.5 py-1 text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg text-xs font-semibold border border-slate-200 hover:border-blue-200 transition-all inline-flex items-center space-x-1 shadow-2xs active:scale-95" title="คลิกเพื่อดูรายละเอียดและแก้ไขงาน">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <span>ดู/แก้ไข</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = tableHtml;
  } else {
    // Grid Card View
    container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" id="taskCardsGrid"></div>`;
    const grid = document.getElementById("taskCardsGrid");

    filteredTasks.forEach((task, index) => {
      const isDone = task.status === "เสร็จสิ้น";
      const isOver = isTaskOverdue(task.deadline, isDone);
      const isNew = recentNewTaskIds.has(task.id) || task.isNew;
      const techs = getTaskTechs(task);
      const photoCount = (task.progressHistory || task.customer?.progress_history || []).reduce((acc, it) => acc + (Array.isArray(it.photos) ? it.photos.length : 0), 0);

      let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
      if (isDone) badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      else if (isOver) badgeBg = "bg-rose-50 text-rose-700 border-rose-200";

      const cardClass = isNew
        ? "group bg-gradient-to-b from-blue-50/70 to-white rounded-xl p-4 border-2 border-blue-500 shadow-md ring-2 ring-blue-400/20 hover:shadow-lg transition-all flex flex-col justify-between space-y-3 cursor-pointer"
        : "group bg-white rounded-xl p-4 border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3 cursor-pointer";

      const card = document.createElement("div");
      card.className = cardClass;
      card.onclick = () => window.openTaskDetailModal(task.id);
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between text-xs mb-2">
            <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span class="text-[10px] font-mono text-slate-400 font-bold">#${index + 1} (${task.id})</span>
              ${isNew ? `<span class="inline-flex items-center space-x-0.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-xs animate-pulse"><span>✨</span><span>งานใหม่</span></span>` : ''}
            </div>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}">${task.status}</span>
          </div>
          <div>
            <h3 class="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">${task.title}</h3>
            ${task.desc && task.desc !== '-' ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${task.desc}</p>` : ''}
            ${task.latestUpdate && task.latestUpdate !== 'ยังไม่มีอัปเดต' ? `<p class="text-[11px] text-blue-600 line-clamp-1 mt-1 font-medium">💬 ${task.latestUpdate}</p>` : ''}
          </div>
          <div class="mt-2 text-xs text-slate-500 flex items-center space-x-1">
            <span>👷 ช่าง:</span>
            <strong class="text-slate-700">${techs.join(', ')}</strong>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 space-y-2">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-500">กำหนดส่ง: <strong>${formatThaiDateDisplay(task.deadline)}</strong></span>
            ${getDeadlineCountdownBadge(task.deadline, isDone)}
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 ${isDone ? 'bg-emerald-500' : 'bg-slate-900'} rounded-full" style="width: ${task.progress || 0}%"></div>
            </div>
            <span class="text-xs font-mono font-bold text-slate-700">${task.progress || 0}%</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}', 'timeline')" class="py-1.5 px-2 text-center text-xs font-bold ${photoCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'} border rounded-lg transition-all flex items-center justify-center space-x-1 shadow-2xs">
              <span>📸</span>
              <span>ภาพหน้างาน (${photoCount})</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}')" class="py-1.5 px-2 text-center text-xs font-semibold bg-slate-50 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 border border-slate-200 group-hover:border-blue-200 rounded-lg transition-all flex items-center justify-center space-x-1 shadow-2xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>ดู/แก้ไข</span>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

// -------------------------------------------------------------
// CUSTOM THAI CALENDAR INTEGRATION
// -------------------------------------------------------------
export function pickAssignDate(type) {
  const isStart = type === 'start';
  const inputEl = document.getElementById(isStart ? 'assignStartDateInput' : 'assignDeadlineInput');
  const textEl = document.getElementById(isStart ? 'assignStartDateText' : 'assignDeadlineText');
  const currentVal = inputEl && inputEl.value ? inputEl.value : (isStart ? getTodayYMD() : getSevenDaysLaterYMD());

  openCustomCalendar(currentVal, (selectedDate) => {
    if (inputEl) inputEl.value = selectedDate;
    if (textEl) textEl.innerText = formatThaiDateDisplay(selectedDate);
  });
}

export function pickDetailDate(type) {
  const isStart = type === 'start';
  const inputEl = document.getElementById(isStart ? 'detailStartDateInput' : 'detailDeadlineInput');
  const textEl = document.getElementById(isStart ? 'detailStartDateText' : 'detailDeadlineText');
  const currentVal = inputEl && inputEl.value ? inputEl.value : (isStart ? getTodayYMD() : getSevenDaysLaterYMD());

  openCustomCalendar(currentVal, (selectedDate) => {
    if (inputEl) inputEl.value = selectedDate;
    if (textEl) textEl.innerText = formatThaiDateDisplay(selectedDate);
  });
}

export function pickExtendModalDate() {
  const inputEl = document.getElementById('extendNewDateInput');
  const textEl = document.getElementById('extendDatePreviewText');
  const currentVal = inputEl && inputEl.value ? inputEl.value : getTodayYMD();

  openCustomCalendar(currentVal, (selectedDate) => {
    if (inputEl) inputEl.value = selectedDate;
    if (textEl) textEl.innerText = formatThaiDateDisplay(selectedDate);
  });
}

// -------------------------------------------------------------
// ASSIGN TASK MODAL
// -------------------------------------------------------------
let selectedAssignPriority = "ปกติ";
let selectedAssignCategory = "ติดตั้งงานใหม่";
let selectedAssignTechs = [];

export function openAssignModal(allTechnicians) {
  selectedAssignPriority = "ปกติ";
  selectedAssignCategory = "ติดตั้งงานใหม่";
  selectedAssignTechs = [];

  selectAssignPriority("ปกติ");
  selectAssignCategory("ติดตั้งงานใหม่");

  const jobDetail = document.getElementById("assignJobDetailInput");
  const locInput = document.getElementById("assignLocationInput");
  const custName = document.getElementById("assignCustNameInput");
  const custAddress = document.getElementById("assignCustAddressInput");
  const custPhone = document.getElementById("assignCustPhoneInput");
  const custEmail = document.getElementById("assignCustEmailInput");
  const custLineId = document.getElementById("assignCustLineIdInput");
  const catOther = document.getElementById("assignCategoryOtherInput");
  const startInput = document.getElementById("assignStartDateInput");
  const deadInput = document.getElementById("assignDeadlineInput");
  const startText = document.getElementById("assignStartDateText");
  const deadText = document.getElementById("assignDeadlineText");

  if (jobDetail) jobDetail.value = "";
  if (locInput) locInput.value = "";
  if (custName) custName.value = "";
  if (custAddress) custAddress.value = "";
  if (custPhone) custPhone.value = "";
  if (custEmail) custEmail.value = "";
  if (custLineId) custLineId.value = "";
  if (catOther) catOther.value = "";

  const today = getTodayYMD();
  const next7Days = getSevenDaysLaterYMD();
  if (startInput) startInput.value = today;
  if (deadInput) deadInput.value = next7Days;
  if (startText) startText.innerText = formatThaiDateDisplay(today);
  if (deadText) deadText.innerText = formatThaiDateDisplay(next7Days);

  renderAssignTechChips(allTechnicians);

  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeAssignModal() {
  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.add("hidden");
}

export function selectAssignPriority(priority) {
  selectedAssignPriority = priority;
  const priorities = [
    { key: "ปกติ", activeClass: "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-300" },
    { key: "ด่วน", activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200" },
    { key: "ด่วนที่สุด", activeClass: "bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-200" }
  ];

  priorities.forEach(p => {
    const btn = document.getElementById(`assignPriorityBtn-${p.key}`);
    if (btn) {
      if (p.key === priority) {
        btn.className = `py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${p.activeClass}`;
      } else {
        btn.className = "py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export function selectAssignCategory(cat) {
  selectedAssignCategory = cat;
  const categories = [
    "ติดตั้งงานใหม่",
    "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)",
    "งานเซอร์วิส (มีค่าใช้จ่าย)",
    "งาน PM (Preventive Maintenance)",
    "สำรวจประเมินหน้างาน",
    "อื่นๆ"
  ];

  categories.forEach(c => {
    const btn = document.getElementById(`assignCatBtn-${c}`);
    if (btn) {
      if (c === cat) {
        btn.className = "py-2 px-3 rounded-lg border text-xs font-bold text-left transition-all bg-blue-50 border-blue-600 text-blue-900 shadow-2xs ring-1 ring-blue-500";
      } else {
        btn.className = "py-2 px-3 rounded-lg border text-xs font-medium text-left transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });

  const otherWrapper = document.getElementById("assignCategoryOtherWrapper");
  if (otherWrapper) {
    if (cat === "อื่นๆ") {
      otherWrapper.classList.remove("hidden");
    } else {
      otherWrapper.classList.add("hidden");
    }
  }
}

export function renderAssignTechChips(allTechnicians) {
  const container = document.getElementById("assignTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  allTechnicians.forEach(tName => {
    const isSelected = selectedAssignTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
      isSelected ? "bg-slate-900 text-white font-semibold shadow-xs" : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
    }`;
    btn.innerHTML = `${isSelected ? '✓ ' : ''}${tName}`;
    btn.onclick = () => toggleAssignTech(tName, allTechnicians);
    container.appendChild(btn);
  });
}

export function toggleAssignTech(tName, allTechnicians) {
  if (selectedAssignTechs.includes(tName)) {
    selectedAssignTechs = selectedAssignTechs.filter(t => t !== tName);
  } else {
    selectedAssignTechs.push(tName);
  }
  renderAssignTechChips(allTechnicians);
}

export async function submitAssignForm({ tasksList, onComplete }) {
  const custNameInput = document.getElementById("assignCustNameInput");
  const custAddressInput = document.getElementById("assignCustAddressInput");
  const custPhoneInput = document.getElementById("assignCustPhoneInput");
  const custEmailInput = document.getElementById("assignCustEmailInput");
  const custLineIdInput = document.getElementById("assignCustLineIdInput");
  const jobDetailInput = document.getElementById("assignJobDetailInput");
  const locationInput = document.getElementById("assignLocationInput");
  const startInput = document.getElementById("assignStartDateInput");
  const deadInput = document.getElementById("assignDeadlineInput");
  const otherCatInput = document.getElementById("assignCategoryOtherInput");

  const custName = custNameInput ? custNameInput.value.trim() : "";
  const custAddress = custAddressInput ? custAddressInput.value.trim() : "";
  const custPhone = custPhoneInput ? custPhoneInput.value.trim() : "";

  // Mandatory Customer Verification
  if (!custName) {
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกชื่อลูกค้า",
      message: "จำเป็นต้องระบุชื่อลูกค้าก่อนบันทึกข้อมูลงาน"
    });
    if (custNameInput) custNameInput.focus();
    return;
  }
  if (!custAddress) {
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกที่อยู่ลูกค้า",
      message: "จำเป็นต้องระบุที่อยู่ลูกค้าก่อนบันทึกข้อมูลงาน"
    });
    if (custAddressInput) custAddressInput.focus();
    return;
  }
  if (!custPhone) {
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกเบอร์โทรศัพท์",
      message: "จำเป็นต้องระบุเบอร์โทรศัพท์ลูกค้าก่อนบันทึกข้อมูลงาน"
    });
    if (custPhoneInput) custPhoneInput.focus();
    return;
  }

  // Category handling
  let finalCategory = selectedAssignCategory;
  if (selectedAssignCategory === "อื่นๆ") {
    const otherText = otherCatInput ? otherCatInput.value.trim() : "";
    if (!otherText) {
      showAppAlert({
        type: "warning",
        title: "ระบุประเภทงานอื่นๆ",
        message: "กรุณากรอกระบุประเภทงานอื่นๆ"
      });
      if (otherCatInput) otherCatInput.focus();
      return;
    }
    finalCategory = `อื่นๆ: ${otherText}`;
  }

  if (selectedAssignTechs.length === 0) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกช่าง",
      message: "กรุณาเลือกช่างผู้รับผิดชอบงานอย่างน้อย 1 คน"
    });
    return;
  }

  const jobDetail = jobDetailInput ? jobDetailInput.value.trim() : "";
  const location = locationInput ? locationInput.value.trim() : "";
  const startDate = startInput && startInput.value ? startInput.value : getTodayYMD();
  const deadline = deadInput && deadInput.value ? deadInput.value : getSevenDaysLaterYMD();
  const custEmail = custEmailInput ? custEmailInput.value.trim() : "-";
  const custLineId = custLineIdInput ? custLineIdInput.value.trim() : "-";

  closeAssignModal();

  const taskId = `TASK-${Math.floor(100 + Math.random() * 900)}`;
  const titleDisplay = `${finalCategory} - ${custName}`;

  const newTask = {
    id: taskId,
    title: titleDisplay,
    isNew: true,
    createdAt: Date.now(),
    category: finalCategory,
    priority: selectedAssignPriority,
    desc: jobDetail || `งาน ${finalCategory} สำหรับ ${custName}`,
    location: location || custAddress,
    customer: {
      name: custName,
      address: custAddress,
      phone: custPhone,
      email: custEmail || "-",
      lineId: custLineId || "-"
    },
    techs: [...selectedAssignTechs],
    startDate: startDate,
    deadline: deadline,
    status: "กำลังทำ",
    progress: 0,
    latestUpdate: `มอบหมายงานใหม่ [ความเร่งด่วน: ${selectedAssignPriority}]`,
    reason: "-",
    updateBy: "หัวหน้างาน",
    updateTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  };

  recentNewTaskIds.add(taskId);
  try {
    localStorage.setItem("fs_recent_new_tasks", JSON.stringify(Array.from(recentNewTaskIds)));
  } catch (e) {}

  // 1. Update memory & localStorage immediately (Optimistic Update)
  tasksList.unshift(newTask);
  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));

  // 2. Immediately re-render views so the user instantly sees the new task
  if (onComplete) onComplete([newTask]);

  // 3. Persist to Supabase Database
  try {
    await saveTaskApi(newTask);
  } catch (err) {
    console.warn("saveTaskApi error:", err);
  }

  // 4. Trigger LINE Share Target Picker (Safe non-blocking)
  try {
    const flexCard = createAssignTaskFlexCard(newTask);
    triggerLiffShare(flexCard, "มอบหมายงานใหม่และส่งเข้ากลุ่ม LINE เรียบร้อยแล้ว");
  } catch (shareErr) {
    console.warn("LIFF share error:", shareErr);
  }

  showAppAlert({
    type: "success",
    title: "มอบหมายงานสำเร็จ!",
    message: `บันทึกงาน "${titleDisplay}" (${taskId}) เรียบร้อยแล้ว`
  });
}

// -------------------------------------------------------------
// TASK DETAIL & FULL EDIT MODAL (POP-UP)
// -------------------------------------------------------------
let currentDetailTaskId = null;
let currentDetailStatus = "กำลังทำ";
let currentDetailPriority = "ปกติ";
let currentDetailTechs = [];
let currentDetailTab = "info";

export function switchTaskDetailTab(tab) {
  currentDetailTab = tab;
  const tabInfo = document.getElementById("taskDetailTabBtnInfo");
  const tabTimeline = document.getElementById("taskDetailTabBtnTimeline");
  const contentInfo = document.getElementById("detailTabContentInfo");
  const contentTimeline = document.getElementById("detailTabContentTimeline");

  if (tab === "timeline") {
    if (tabInfo) tabInfo.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all flex items-center space-x-1.5 cursor-pointer";
    if (tabTimeline) tabTimeline.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer";
    if (contentInfo) contentInfo.classList.add("hidden");
    if (contentTimeline) contentTimeline.classList.remove("hidden");
  } else {
    if (tabInfo) tabInfo.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs transition-all flex items-center space-x-1.5 cursor-pointer";
    if (tabTimeline) tabTimeline.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all flex items-center space-x-1.5 cursor-pointer";
    if (contentInfo) contentInfo.classList.remove("hidden");
    if (contentTimeline) contentTimeline.classList.add("hidden");
  }
}

let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let initialPinchDistance = 0;
let initialPinchZoom = 1;
let lastTapTime = 0;
let isLightboxGesturesInit = false;
let currentLightboxSrc = null;
let currentLightboxTaskId = null;
let onDeletePhotoCallback = null;

export function setOnDeletePhotoCallback(fn) {
  onDeletePhotoCallback = fn;
}

export function clampPan(x, y, zoom) {
  if (zoom <= 1) return { x: 0, y: 0 };
  const viewport = document.getElementById("lightboxViewport");
  const img = document.getElementById("lightboxImg");
  if (!viewport || !img) return { x: 0, y: 0 };

  const vpW = viewport.clientWidth || window.innerWidth;
  const vpH = viewport.clientHeight || (window.innerHeight * 0.7);
  const renderedW = (img.offsetWidth || (vpW * 0.8)) * zoom;
  const renderedH = (img.offsetHeight || (vpH * 0.8)) * zoom;

  const maxPanX = Math.max(0, (renderedW - vpW) / 2 + 30);
  const maxPanY = Math.max(0, (renderedH - vpH) / 2 + 30);

  return {
    x: Math.max(-maxPanX, Math.min(maxPanX, x)),
    y: Math.max(-maxPanY, Math.min(maxPanY, y))
  };
}

export function updateLightboxTransform(animate = true) {
  const img = document.getElementById("lightboxImg");
  const percentElem = document.getElementById("lightboxZoomPercent");
  if (!img) return;

  if (animate) {
    img.style.transition = "transform 0.15s ease-out";
  } else {
    img.style.transition = "none";
  }

  img.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  if (percentElem) {
    percentElem.innerText = `${Math.round(currentZoom * 100)}%`;
  }
}

export function zoomLightbox(delta) {
  const newZoom = Math.min(5, Math.max(1, currentZoom + delta));
  currentZoom = Math.round(newZoom * 10) / 10;
  if (currentZoom <= 1) {
    panX = 0;
    panY = 0;
  } else {
    const clamped = clampPan(panX, panY, currentZoom);
    panX = clamped.x;
    panY = clamped.y;
  }
  updateLightboxTransform(true);
}

export function resetLightboxZoom() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateLightboxTransform(true);
}

export function initLightboxGestures() {
  if (isLightboxGesturesInit) return;
  const viewport = document.getElementById("lightboxViewport");
  const img = document.getElementById("lightboxImg");
  if (!viewport || !img) return;
  isLightboxGesturesInit = true;

  // Mouse wheel zoom
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    zoomLightbox(delta);
  }, { passive: false });

  // Mouse Drag / Pan
  viewport.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || currentZoom <= 1) return;
    isDragging = true;
    startDragX = e.clientX - panX;
    startDragY = e.clientY - panY;
    viewport.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging || currentZoom <= 1) return;
    const clamped = clampPan(e.clientX - startDragX, e.clientY - startDragY, currentZoom);
    panX = clamped.x;
    panY = clamped.y;
    updateLightboxTransform(false);
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      const vp = document.getElementById("lightboxViewport");
      if (vp) vp.style.cursor = currentZoom > 1 ? "grab" : "default";
    }
  });

  // Double Click / Double Tap to zoom
  viewport.addEventListener("click", (e) => {
    if (e.target !== img && e.target !== viewport) return;
    const now = Date.now();
    if (now - lastTapTime < 300) {
      if (currentZoom > 1.2) {
        resetLightboxZoom();
      } else {
        currentZoom = 2.5;
        panX = 0;
        panY = 0;
        updateLightboxTransform(true);
      }
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  });

  // Touch: Pinch to zoom & Pan
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance = Math.hypot(dx, dy);
      initialPinchZoom = currentZoom;
    } else if (e.touches.length === 1 && currentZoom > 1) {
      isDragging = true;
      startDragX = e.touches[0].clientX - panX;
      startDragY = e.touches[0].clientY - panY;
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && initialPinchDistance > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / initialPinchDistance;
      const newZ = Math.min(5, Math.max(1, Math.round(initialPinchZoom * factor * 10) / 10));
      currentZoom = newZ;
      const clamped = clampPan(panX, panY, currentZoom);
      panX = clamped.x;
      panY = clamped.y;
      updateLightboxTransform(false);
    } else if (e.touches.length === 1 && isDragging && currentZoom > 1) {
      e.preventDefault();
      const clamped = clampPan(e.touches[0].clientX - startDragX, e.touches[0].clientY - startDragY, currentZoom);
      panX = clamped.x;
      panY = clamped.y;
      updateLightboxTransform(false);
    }
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = 0;
    }
    if (e.touches.length === 0) {
      isDragging = false;
    }
  }, { passive: true });
}

export function openImageLightbox(src, caption = "", taskId = null) {
  const modal = document.getElementById("imageLightboxModal");
  const img = document.getElementById("lightboxImg");
  const cap = document.getElementById("lightboxCaption");
  const dl = document.getElementById("lightboxDownloadBtn");
  if (!modal || !img) return;

  currentLightboxSrc = src;
  currentLightboxTaskId = taskId;

  initLightboxGestures();
  resetLightboxZoom();

  img.src = src;
  if (cap) cap.innerText = caption;
  if (dl) dl.href = src;
  modal.classList.remove("hidden");
}

export function closeImageLightbox() {
  const modal = document.getElementById("imageLightboxModal");
  if (modal) modal.classList.add("hidden");
  resetLightboxZoom();
}

export function deleteCurrentLightboxImage() {
  if (!currentLightboxSrc) return;
  if (typeof onDeletePhotoCallback === "function") {
    onDeletePhotoCallback(currentLightboxSrc, currentLightboxTaskId);
  }
}

export function openTaskDetailModal(taskId, tasksList, allTechnicians, initialTab = "info") {
  currentDetailTaskId = taskId;
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

  const idBadge = document.getElementById("detailTaskIdBadge");
  if (idBadge) idBadge.innerText = task.id;

  // Status & Priority
  currentDetailStatus = task.status || "กำลังทำ";
  currentDetailPriority = task.priority || "ปกติ";
  setDetailModalStatus(currentDetailStatus);
  setDetailModalPriority(currentDetailPriority);

  // Category
  const catSelect = document.getElementById("detailCategorySelect");
  if (catSelect) catSelect.value = task.category || "ติดตั้งงานใหม่";

  // Title & Desc
  const titleInput = document.getElementById("detailTitleInput");
  const descInput = document.getElementById("detailDescInput");
  if (titleInput) titleInput.value = task.title || "";
  if (descInput) descInput.value = task.desc || "";

  // Location & Map Link
  const locInput = document.getElementById("detailLocationInput");
  const mapLink = document.getElementById("detailMapLink");
  const locVal = task.location || (task.customer && task.customer.address) || "";
  if (locInput) locInput.value = locVal;
  if (mapLink) {
    if (locVal && (locVal.includes(",") || locVal.length > 5)) {
      mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locVal)}`;
      mapLink.classList.remove("hidden");
    } else {
      mapLink.classList.add("hidden");
    }
  }

  // Customer Card
  const cust = task.customer || {};
  const custName = document.getElementById("detailCustNameInput");
  const custPhone = document.getElementById("detailCustPhoneInput");
  const custAddress = document.getElementById("detailCustAddressInput");
  const custEmail = document.getElementById("detailCustEmailInput");
  const custLine = document.getElementById("detailCustLineInput");

  if (custName) custName.value = cust.name || "";
  if (custPhone) custPhone.value = cust.phone || "";
  if (custAddress) custAddress.value = cust.address || locVal || "";
  if (custEmail) custEmail.value = cust.email || "";
  if (custLine) custLine.value = cust.lineId || "";
  updateDetailPhoneLink(cust.phone || "");

  // Technicians
  currentDetailTechs = [...getTaskTechs(task)];
  renderDetailTechChips(allTechnicians);

  // Dates
  const startInput = document.getElementById("detailStartDateInput");
  const deadInput = document.getElementById("detailDeadlineInput");
  const startText = document.getElementById("detailStartDateText");
  const deadText = document.getElementById("detailDeadlineText");

  const sVal = task.startDate || getTodayYMD();
  const dVal = task.deadline || getSevenDaysLaterYMD();
  if (startInput) startInput.value = sVal;
  if (deadInput) deadInput.value = dVal;
  if (startText) startText.innerText = formatThaiDateDisplay(sVal);
  if (deadText) deadText.innerText = formatThaiDateDisplay(dVal);

  // Progress
  const progRange = document.getElementById("detailProgressRange");
  const progText = document.getElementById("detailProgressText");
  const progVal = task.progress || 0;
  if (progRange) progRange.value = progVal;
  if (progText) progText.innerText = `${progVal}%`;

  // Latest update
  const latestInput = document.getElementById("detailLatestUpdateInput");
  if (latestInput) latestInput.value = task.latestUpdate && task.latestUpdate !== "ยังไม่มีอัปเดต" ? task.latestUpdate : "";

  // -------------------------------------------------------------
  // RENDER PROGRESS TIMELINE & PHOTOS (Supervisor Experience)
  // -------------------------------------------------------------
  let timelineItems = [];
  if (Array.isArray(task.progressHistory) && task.progressHistory.length > 0) {
    timelineItems = [...task.progressHistory];
  } else if (task.customer && Array.isArray(task.customer.progress_history)) {
    timelineItems = [...task.customer.progress_history];
  }

  // Also include matching check-in photos if stored locally
  try {
    const rawCheckins = localStorage.getItem("fs_daily_logs");
    if (rawCheckins) {
      const parsed = JSON.parse(rawCheckins);
      const matched = parsed.filter(c => c.taskId === task.id || c.id === task.id || c.task === task.title);
      matched.forEach(c => {
        if (!timelineItems.some(it => it.id === c.id)) {
          if (c.photos && c.photos.length > 0) {
            timelineItems.unshift({
              id: c.id,
              time: c.checkinTime || "09:00",
              date: c.date || "วันนี้",
              progress: c.progress || 0,
              status: c.status || "กำลังทำ",
              note: c.note || `เช็กอินเข้าปฏิบัติงานเวลา ${c.checkinTime || '09:00'} น.`,
              tech: Array.isArray(c.techs) ? c.techs.join(", ") : (c.tech || "ช่างหน้างาน"),
              photos: c.photos,
              isCheckin: true
            });
          }
        }
      });
    }
  } catch (e) {}

  const totalPhotos = timelineItems.reduce((acc, it) => acc + (Array.isArray(it.photos) ? it.photos.length : 0), 0);
  const photoBadge = document.getElementById("detailTimelinePhotoCountBadge");
  const totalBadge = document.getElementById("detailTimelineTotalBadge");
  if (photoBadge) photoBadge.innerText = totalPhotos;
  if (totalBadge) totalBadge.innerText = `${totalPhotos} ภาพ`;

  const timelineContainer = document.getElementById("detailTimelineContainer");
  if (timelineContainer) {
    if (timelineItems.length === 0) {
      timelineContainer.innerHTML = `
        <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="text-3xl mb-2">📸</div>
          <div class="text-sm font-bold text-slate-800">ยังไม่มีบันทึกภาพถ่ายหน้างาน</div>
          <p class="text-xs text-slate-500 mt-1">รูปถ่ายความคืบหน้าจะแสดงที่นี่เมื่อทีมช่างเช็กอินหรืออัปเดตงานระหว่างวัน</p>
        </div>
      `;
    } else {
      timelineContainer.innerHTML = timelineItems.map((item, idx) => {
        const isDone = item.status === "เสร็จสิ้น" || item.progress === 100;
        const bulletColor = isDone ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-blue-600 ring-4 ring-blue-100";
        const hasPhotos = Array.isArray(item.photos) && item.photos.length > 0;

        let photosHtml = "";
        if (hasPhotos) {
          photosHtml = `
            <div class="pt-2">
              <div class="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <span>📸 รูปถ่ายหน้างาน (${item.photos.length} รูป):</span>
                <span class="text-[10px] text-slate-400 font-normal">(แตะเพื่อดูภาพขยาย)</span>
              </div>
              <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                ${item.photos.map((pUrl, pIdx) => `
                  <div class="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group cursor-pointer shadow-2xs hover:ring-2 hover:ring-blue-500 transition-all bg-slate-100" onclick="window.openImageLightbox('${pUrl}', '${task.title} • ${item.time} น. (${item.progress}%)')">
                    <img src="${pUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="photo ${pIdx + 1}" loading="lazy">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors">
                      <span class="opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold bg-slate-900/80 px-2 py-0.5 rounded-full backdrop-blur-xs">🔍 ขยาย</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        return `
          <div class="relative pl-6 pb-4 border-l-2 border-slate-200 last:border-l-0 last:pb-0">
            <div class="absolute -left-[9px] top-1 w-4 h-4 rounded-full ${bulletColor} flex items-center justify-center text-[9px] text-white font-bold">
              ${idx + 1}
            </div>
            <div class="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
              <div class="flex items-center justify-between flex-wrap gap-1">
                <div class="flex items-center space-x-1.5">
                  <span class="text-xs font-bold text-slate-900">${item.isCheckin ? '📍 เช็กอินเข้าหน้างาน' : `📊 คืบหน้า ${item.progress}%`}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                    ${item.status}
                  </span>
                </div>
                <span class="text-[11px] font-mono text-slate-500 font-semibold">${item.date ? item.date + ' • ' : ''}${item.time || ''} น.</span>
              </div>
              ${item.note && item.note !== '-' ? `<p class="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">${item.note}</p>` : ''}
              <div class="text-[11px] text-slate-500">
                ผู้ปฏิบัติงาน: <strong class="text-slate-800">${item.tech || 'ช่างประจำทีม'}</strong>
              </div>
              ${photosHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  switchTaskDetailTab(initialTab);

  const modal = document.getElementById("taskDetailModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeTaskDetailModal() {
  const modal = document.getElementById("taskDetailModal");
  if (modal) modal.classList.add("hidden");
}


export function setDetailModalStatus(st) {
  currentDetailStatus = st;
  const statuses = [
    { key: "กำลังทำ", activeClass: "bg-blue-600 text-white border-blue-600 font-bold shadow-xs" },
    { key: "เกินกำหนด", activeClass: "bg-rose-600 text-white border-rose-600 font-bold shadow-xs" },
    { key: "เสร็จสิ้น", activeClass: "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs" }
  ];
  statuses.forEach(s => {
    const btn = document.getElementById(`detailStatus-${s.key}`);
    if (btn) {
      if (s.key === st) {
        btn.className = `py-1.5 px-1 rounded-lg border text-[11px] text-center transition-all ${s.activeClass}`;
      } else {
        btn.className = "py-1.5 px-1 rounded-lg border text-[11px] font-medium text-center transition-all bg-white hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export function setDetailModalPriority(p) {
  currentDetailPriority = p;
  const priorities = [
    { key: "ปกติ", activeClass: "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs" },
    { key: "ด่วน", activeClass: "bg-amber-600 text-white border-amber-600 font-bold shadow-xs" },
    { key: "ด่วนที่สุด", activeClass: "bg-rose-600 text-white border-rose-600 font-bold shadow-xs" }
  ];
  priorities.forEach(item => {
    const btn = document.getElementById(`detailPriority-${item.key}`);
    if (btn) {
      if (item.key === p) {
        btn.className = `py-1.5 px-1 rounded-lg border text-[11px] text-center transition-all ${item.activeClass}`;
      } else {
        btn.className = "py-1.5 px-1 rounded-lg border text-[11px] font-medium text-center transition-all bg-white hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export function updateDetailPhoneLink(phone) {
  const btn = document.getElementById("detailCustomerPhoneLink");
  if (!btn) return;
  const cleanPhone = (phone || "").replace(/[^0-9+]/g, "");
  if (cleanPhone.length >= 8) {
    btn.href = `tel:${cleanPhone}`;
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
}

export function renderDetailTechChips(allTechnicians) {
  const container = document.getElementById("detailTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  (allTechnicians || []).forEach(tName => {
    const isSelected = currentDetailTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
      isSelected
        ? "bg-slate-900 text-white shadow-2xs"
        : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
    }`;
    btn.innerHTML = `${isSelected ? '✓ ' : ''}${tName}`;
    btn.onclick = () => {
      if (currentDetailTechs.includes(tName)) {
        if (currentDetailTechs.length > 1) {
          currentDetailTechs = currentDetailTechs.filter(t => t !== tName);
        } else {
          showAppAlert({
            type: "warning",
            title: "ไม่สามารถลบได้",
            message: "ต้องมีช่างผู้รับผิดชอบงานอย่างน้อย 1 คน"
          });
        }
      } else {
        currentDetailTechs.push(tName);
      }
      renderDetailTechChips(allTechnicians);
    };
    container.appendChild(btn);
  });
}

export function saveTaskDetailChanges(tasksList, onComplete) {
  const task = tasksList.find(t => t.id === currentDetailTaskId);
  if (!task) return;

  const titleInput = document.getElementById("detailTitleInput");
  const descInput = document.getElementById("detailDescInput");
  const catSelect = document.getElementById("detailCategorySelect");
  const locInput = document.getElementById("detailLocationInput");
  const startInput = document.getElementById("detailStartDateInput");
  const deadInput = document.getElementById("detailDeadlineInput");
  const progRange = document.getElementById("detailProgressRange");
  const latestInput = document.getElementById("detailLatestUpdateInput");

  const custName = document.getElementById("detailCustNameInput");
  const custPhone = document.getElementById("detailCustPhoneInput");
  const custAddress = document.getElementById("detailCustAddressInput");
  const custEmail = document.getElementById("detailCustEmailInput");
  const custLine = document.getElementById("detailCustLineInput");

  const newTitle = titleInput ? titleInput.value.trim() : task.title;
  if (!newTitle) {
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกชื่องาน",
      message: "ต้องระบุชื่องานเพื่อบันทึกข้อมูล"
    });
    return;
  }

  task.title = newTitle;
  task.desc = descInput ? descInput.value.trim() : task.desc;
  task.category = catSelect ? catSelect.value : task.category;
  task.location = locInput ? locInput.value.trim() : task.location;
  task.status = currentDetailStatus;
  task.priority = currentDetailPriority;
  task.techs = [...currentDetailTechs];
  task.startDate = startInput ? startInput.value : task.startDate;
  task.deadline = deadInput ? deadInput.value : task.deadline;
  task.progress = progRange ? parseInt(progRange.value, 10) : task.progress;

  if (latestInput && latestInput.value.trim()) {
    task.latestUpdate = latestInput.value.trim();
  }

  task.customer = {
    name: custName ? custName.value.trim() : (task.customer?.name || ""),
    phone: custPhone ? custPhone.value.trim() : (task.customer?.phone || ""),
    address: custAddress ? custAddress.value.trim() : (task.customer?.address || task.location || ""),
    email: custEmail ? custEmail.value.trim() : (task.customer?.email || "-"),
    lineId: custLine ? custLine.value.trim() : (task.customer?.lineId || "-")
  };

  closeTaskDetailModal();
  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));

  // Sync to Sheet
  saveTaskApi(task);

  showAppAlert({
    type: "success",
    title: "บันทึกการแก้ไขสำเร็จ",
    message: `บันทึกข้อมูลงาน "${task.title}" เรียบร้อยแล้ว`
  });

  if (onComplete) onComplete(task);
}

export function deleteCurrentDetailTask(tasksList, onComplete) {
  const task = tasksList.find(t => t.id === currentDetailTaskId);
  if (!task) return;

  showAppConfirm({
    title: "ยืนยันการลบงาน",
    message: `คุณต้องการลบงาน "${task.title}" (${task.id}) ออกจากระบบหรือไม่? ข้อมูลจะไม่สามารถกู้คืนได้`,
    confirmText: "ลบงานนี้",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      const idx = tasksList.findIndex(t => t.id === currentDetailTaskId);
      if (idx !== -1) {
        tasksList.splice(idx, 1);
      }
      closeTaskDetailModal();
      localStorage.setItem("fs_tasks", JSON.stringify(tasksList));

      // Sync deletion to Sheet
      deleteTaskApi(task.id);

      showAppAlert({
        type: "success",
        title: "ลบงานสำเร็จ",
        message: `ลบงาน ${task.id} ออกจากระบบเรียบร้อยแล้ว`
      });

      if (onComplete) onComplete();
    }
  });
}

// Aliases for backwards compatibility
export const openEditTaskModal = openTaskDetailModal;
export const closeEditTaskModal = closeTaskDetailModal;
export const setEditModalStatus = setDetailModalStatus;
export const saveEditedTask = saveTaskDetailChanges;


// -------------------------------------------------------------
// EXTEND DEADLINE MODAL
// -------------------------------------------------------------
export function openExtendModal(taskId, tasksList) {
  currentExtendingTaskId = taskId;
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

  const titleLabel = document.getElementById("extendTaskTitleLabel");
  const curDeadLabel = document.getElementById("currentDeadlineDisplay");
  const reasonInput = document.getElementById("extendReasonInput");
  const dateInput = document.getElementById("extendNewDateInput");
  const datePreviewText = document.getElementById("extendDatePreviewText");

  if (titleLabel) titleLabel.innerText = task.title;
  if (curDeadLabel) curDeadLabel.innerText = formatThaiDateDisplay(task.deadline);
  if (reasonInput) reasonInput.value = "";
  if (dateInput) dateInput.value = "";
  if (datePreviewText) datePreviewText.innerText = "คลิกเพื่อเลือกวันที่ใหม่";

  const modal = document.getElementById("extendDeadlineModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeExtendModal() {
  const modal = document.getElementById("extendDeadlineModal");
  if (modal) modal.classList.add("hidden");
}

export async function submitExtendDeadline(tasksList, currentLineUserName, onComplete) {
  const dateInput = document.getElementById("extendNewDateInput");
  const reasonInput = document.getElementById("extendReasonInput");

  const newDeadline = dateInput ? dateInput.value : "";
  const reason = reasonInput ? reasonInput.value.trim() : "";

  if (!newDeadline) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกวันที่",
      message: "กรุณาเลือกกำหนดส่งใหม่"
    });
    return;
  }
  if (!reason) {
    showAppAlert({
      type: "warning",
      title: "กรุณาระบุเหตุผล",
      message: "กรุณาระบุเหตุผลการขยายเวลากำหนดส่ง"
    });
    return;
  }

  const task = tasksList.find(t => t.id === currentExtendingTaskId);
  if (!task) return;

  const oldDeadline = task.deadline;
  task.oldDeadline = oldDeadline;
  task.deadline = newDeadline;
  task.reason = reason;
  task.latestUpdate = `ขยายกำหนดส่งเป็น ${newDeadline} (เหตุผล: ${reason})`;
  task.updateBy = currentLineUserName || "ช่างหน้างาน";
  task.updateTime = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  closeExtendModal();

  // Sync to Sheet
  extendTaskDeadlineApi({
    taskId: task.id,
    taskTitle: task.title,
    newDeadline: newDeadline,
    oldDeadline: oldDeadline,
    reason: reason,
    updateBy: currentLineUserName || "ช่างหน้างาน"
  });

  // Client Requirement: Always alert LINE group / supervisor when extending deadline
  const flexCard = createExtendDeadlineFlexCard({
    taskId: task.id,
    taskTitle: task.title,
    techs: task.techs,
    oldDeadline: oldDeadline,
    newDeadline: newDeadline,
    reason: reason,
    requestBy: currentLineUserName || "ช่างหน้างาน"
  });
  await triggerLiffShare(flexCard, "ส่งคำขอขยายเวลางานเข้ากลุ่ม LINE สำเร็จ!");

  showAppAlert({
    type: "success",
    title: "ขยายเวลาสำเร็จ",
    message: `ขยายกำหนดส่งเป็น ${formatThaiDateDisplay(newDeadline)} และส่งแจ้งเตือนเข้ากลุ่ม LINE เรียบร้อยแล้ว`
  });

  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
  if (onComplete) onComplete(task);
}
