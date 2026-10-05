/**
 * Main Application Entry Point
 * Foresee Technology CCTV Service
 */

import './style.css';
import { initLiff, isLineLoggedIn, getLineUserName, loginLine, logoutLine } from './liff/line.js';
import { requestLocation, getCurrentCoords } from './utils/gps.js';
import { fetchInitialData, addNewTechnicianApi, deleteTechnicianApi, deleteCheckinApi, deleteTaskApi, clearAllCheckinsApi, subscribeToRealtimeChanges } from './api/supabase.js';
import {
  renderAssignedTasksBanner,
  selectAssignedTask,
  handlePhotoUpload,
  removePhoto,
  submitCheckinForm
} from './modules/checkin.js';
import {
  handleCheckoutPhotoUpload,
  removeCheckoutPhoto,
  submitCheckoutForm,
  submitProgressOnly,
  setActionTab,
  setUpdatePercent,
  setUpdateStatus,
  calculateDuration,
  updateCheckoutSubmitButtonsState
} from './modules/checkout.js';
import {
  setTaskViewMode,
  setStatusFilter,
  setTechFilter,
  setTaskSearchQuery,
  renderTechFilterChips,
  renderTasksList,
  openAssignModal,
  closeAssignModal,
  selectAssignPriority,
  selectAssignCategory,
  toggleAssignTech,
  renderAssignTechChips,
  submitAssignForm,
  openEditTaskModal,
  closeEditTaskModal,
  setEditModalStatus,
  saveEditedTask,
  openTaskDetailModal,
  closeTaskDetailModal,
  setDetailModalStatus,
  setDetailModalPriority,
  updateDetailPhoneLink,
  saveTaskDetailChanges,
  deleteCurrentDetailTask,
  openExtendModal,
  closeExtendModal,
  submitExtendDeadline,
  pickAssignDate,
  pickDetailDate,
  pickExtendModalDate
} from './modules/tasks.js';
import {
  openProgressModal,
  closeProgressModal,
  setProgressPercent,
  setProgressStatus,
  submitProgressUpdate
} from './modules/progress.js';
import { formatDisplayTime, formatGasTime, formatGasDate } from './utils/date.js';
import { showAppAlert, showAppConfirm } from './utils/dialog.js';
import {
  openCustomCalendar,
  closeCustomCalendar,
  prevCalendarMonth,
  nextCalendarMonth,
  selectTodayOnCalendar
} from './utils/calendar.js';

// -------------------------------------------------------------
// GLOBAL STATE
// -------------------------------------------------------------
let currentTab = "checkin";
let allTechnicians = ["ช่างกนก", "ช่างมณเฑียร", "ช่างสายฟ้า", "ช่างอาร์ม", "ช่างเอก"];
let selectedCheckinTechs = [];
let selectedJobType = "ติดตั้งกล้องวงจรปิด";

let tasksList = [];
let activeTasks = [];
let dailyLogs = [];

// Load cached state from LocalStorage
try {
  const cachedTechs = localStorage.getItem("fs_technicians");
  if (cachedTechs) allTechnicians = JSON.parse(cachedTechs);

  const cachedTasks = localStorage.getItem("fs_tasks");
  if (cachedTasks) tasksList = JSON.parse(cachedTasks);

  const cachedActives = localStorage.getItem("fs_active_tasks");
  if (cachedActives) activeTasks = JSON.parse(cachedActives);

  const cachedLogs = localStorage.getItem("fs_daily_logs");
  if (cachedLogs) dailyLogs = JSON.parse(cachedLogs);
} catch (e) {
  console.warn("LocalStorage load error:", e);
}

// -------------------------------------------------------------
// TAB SWITCHING
// -------------------------------------------------------------
export function switchTab(tab) {
  currentTab = tab;
  try {
    sessionStorage.setItem("fs_active_tab", tab);
  } catch (e) {}
  const sections = ["checkin", "checkout", "tasks"];
  sections.forEach(s => {
    const el = document.getElementById(`${s}Section`);
    if (el) {
      if (s === tab) {
        el.classList.remove("hidden");
        el.classList.add("animate-fade-in");
      } else {
        el.classList.add("hidden");
        el.classList.remove("animate-fade-in");
      }
    }

    // Desktop nav buttons
    const deskBtn = document.getElementById(`deskTabBtn${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (deskBtn) {
      if (s === tab) {
        deskBtn.className = "px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-900 bg-white shadow-2xs transition-all flex items-center space-x-1.5";
      } else {
        deskBtn.className = "px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 transition-all flex items-center space-x-1.5";
      }
    }

    // Mobile nav buttons
    const mobBtn = document.getElementById(`tabBtn${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (mobBtn) {
      if (s === tab) {
        mobBtn.className = "py-2 rounded-lg transition-all bg-white text-slate-900 shadow-sm font-semibold flex items-center justify-center space-x-1";
      } else {
        mobBtn.className = "py-2 rounded-lg transition-all hover:text-slate-900 flex items-center justify-center space-x-1 text-slate-600";
      }
    }
  });

  if (tab === "checkin") {
    renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));
    renderCheckinTechChips();
  } else if (tab === "checkout") {
    renderActiveCheckoutList();
  } else if (tab === "tasks") {
    renderTechFilterChips(tasksList, allTechnicians);
    renderTasksList(tasksList);
  }
}

// -------------------------------------------------------------
// CHECK-IN UI HELPERS
// -------------------------------------------------------------
export function renderCheckinTechChips() {
  const container = document.getElementById("checkinTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  allTechnicians.forEach(tName => {
    const isSelected = selectedCheckinTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
      isSelected
        ? "bg-slate-900 text-white font-semibold shadow-xs"
        : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
    }`;
    btn.innerHTML = `${isSelected ? '✓ ' : ''}${tName}`;
    btn.onclick = () => {
      if (selectedCheckinTechs.includes(tName)) {
        selectedCheckinTechs = selectedCheckinTechs.filter(t => t !== tName);
      } else {
        selectedCheckinTechs.push(tName);
      }
      renderCheckinTechChips();
    };
    container.appendChild(btn);
  });
}

export function setCheckinTechs(techs) {
  selectedCheckinTechs = [...techs];
  renderCheckinTechChips();
}

// -------------------------------------------------------------
// MANAGE TECHNICIANS MODAL
// -------------------------------------------------------------
export function openManageTechModal() {
  const input = document.getElementById("newTechNameInput");
  if (input) input.value = "";
  renderManageTechList();
  const modal = document.getElementById("manageTechModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeManageTechModal() {
  const modal = document.getElementById("manageTechModal");
  if (modal) modal.classList.add("hidden");
}

export function renderManageTechList() {
  const container = document.getElementById("manageTechListContainer");
  const countLabel = document.getElementById("techCountLabel");
  if (countLabel) countLabel.innerText = `${allTechnicians.length} คน`;
  if (!container) return;
  container.innerHTML = "";

  allTechnicians.forEach((name, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs";
    row.innerHTML = `
      <div class="flex items-center space-x-2.5">
        <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">${idx + 1}</span>
        <span class="font-bold text-slate-800">${name}</span>
      </div>
      <button type="button" onclick="window.deleteTech('${name}')" title="ลบรายชื่อช่างนี้" class="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1 text-[11px] font-semibold border border-rose-200 active:scale-95">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        <span>ลบ</span>
      </button>
    `;
    container.appendChild(row);
  });
}

export async function confirmAddTech() {
  const input = document.getElementById("newTechNameInput");
  const name = input ? input.value.trim() : "";
  if (!name) return;
  if (allTechnicians.includes(name)) {
    showAppAlert({
      type: "warning",
      title: "มีชื่อนี้แล้ว",
      message: `มีชื่อ "${name}" อยู่ในระบบแล้ว`
    });
    return;
  }
  allTechnicians.push(name);
  try {
    localStorage.setItem("fs_technicians", JSON.stringify(allTechnicians));
  } catch (e) {}

  if (input) input.value = "";
  renderManageTechList();
  renderCheckinTechChips();
  renderTechFilterChips(tasksList, allTechnicians);
  renderAssignTechChips(allTechnicians);

  // Sync to Google Sheet Users tab
  addNewTechnicianApi(name);

  showAppAlert({
    type: "success",
    title: "เพิ่มช่างสำเร็จ",
    message: `เพิ่ม "${name}" เข้าสู่ระบบทีมช่างเรียบร้อยแล้ว`
  });
}

export async function deleteTech(name) {
  if (allTechnicians.length <= 1) {
    showAppAlert({
      type: "warning",
      title: "ไม่สามารถลบได้",
      message: "ต้องมีรายชื่อช่างอย่างน้อย 1 คนในระบบ"
    });
    return;
  }

  showAppConfirm({
    title: "ยืนยันการลบรายชื่อช่าง",
    message: `คุณต้องการลบ "${name}" ออกจากระบบทีมช่างหรือไม่?`,
    confirmText: "ลบช่างคนนี้",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      allTechnicians = allTechnicians.filter(t => t !== name);
      selectedCheckinTechs = selectedCheckinTechs.filter(t => t !== name);
      try {
        localStorage.setItem("fs_technicians", JSON.stringify(allTechnicians));
      } catch(e) {}

      renderManageTechList();
      renderCheckinTechChips();
      renderTechFilterChips(tasksList, allTechnicians);
      renderAssignTechChips(allTechnicians);
      renderTasksList(tasksList);

      // Sync deletion to Google Sheet
      deleteTechnicianApi(name);

      showAppAlert({
        type: "success",
        title: "ลบช่างเรียบร้อย",
        message: `ลบ "${name}" ออกจากระบบแล้ว`
      });
    }
  });
}

export function selectJobType(type) {
  selectedJobType = type;
  const customContainer = document.getElementById("customJobTypeContainer");
  if (customContainer) {
    if (type === "custom") customContainer.classList.remove("hidden");
    else customContainer.classList.add("hidden");
  }

  const types = ["ติดตั้งกล้องวงจรปิด", "ตรวจเช็คซ่อม / ปรับมุมกล้อง", "เปลี่ยนอุปกรณ์ / NVR / Switch", "custom"];
  types.forEach(t => {
    const btn = document.getElementById(`jobTypeBtn-${t}`);
    if (btn) {
      if (t === type) {
        btn.className = "py-2.5 px-3 rounded-xl border-2 text-xs font-bold text-center transition-all bg-blue-600 text-white border-blue-600 shadow-sm";
      } else {
        btn.className = "py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-center transition-all bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300";
      }
    }
  });
}

// -------------------------------------------------------------
// CHECK-OUT UI HELPERS
// -------------------------------------------------------------
let selectedActiveCheckoutId = null;
let selectedCheckoutOutcome = "ติดตั้งเสร็จเรียบร้อย ทดสอบภาพชัดเจนทุกจุด";

export function renderActiveCheckoutList() {
  const container = document.getElementById("activeListContainer");
  const outcomeSection = document.getElementById("checkoutOutcomeSection");
  const clearBtn = document.getElementById("clearAllCheckinsBtn");
  if (!container) return;

  if (clearBtn) {
    if (activeTasks.length > 1) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  if (activeTasks.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center">
        ยังไม่มีงานที่เช็กอินค้างอยู่
      </div>
    `;
    if (outcomeSection) outcomeSection.classList.add("hidden");
    return;
  }

  container.innerHTML = activeTasks.map(item => {
    const isSelected = selectedActiveCheckoutId === item.id;
    const techList = Array.isArray(item.techs) ? item.techs.join(", ") : (item.techs || "ช่างทั่วไป");
    const displayTaskId = item.taskId ? `${item.taskId} (${item.id})` : item.id;
    return `
      <div onclick="window.selectActiveTaskForCheckout('${item.id}')" class="p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
        isSelected
          ? 'bg-emerald-50 border-2 border-emerald-600 shadow-sm ring-2 ring-emerald-200'
          : 'bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs'
      }">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center space-x-2 flex-wrap gap-y-1">
            <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">${displayTaskId}</span>
            <span class="text-xs text-emerald-800 font-bold font-mono">⏰ เข้างาน: ${formatGasTime(item.time)} น.</span>
          </div>
          <button type="button" onclick="event.stopPropagation(); window.deleteActiveCheckin('${item.id}')" class="text-rose-600 hover:text-white hover:bg-rose-600 px-2.5 py-1 rounded-lg border border-rose-200 hover:border-rose-600 text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs" title="ลบรายการเช็กอินนี้">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            <span>ลบรายการ</span>
          </button>
        </div>
        <div class="font-bold text-sm text-slate-950">${item.task}</div>
        <div class="text-slate-600 mt-1.5 flex items-center justify-between font-medium">
          <span>👷 ช่าง: <strong class="text-slate-900">${techList}</strong></span>
          <span class="text-xs text-slate-600 font-mono">⏱️ ${calculateDuration(item.time)}</span>
        </div>
      </div>
    `;
  }).join('');

  if (outcomeSection) {
    if (selectedActiveCheckoutId) {
      outcomeSection.classList.remove("hidden");
      outcomeSection.classList.add("animate-fade-in");
    } else {
      outcomeSection.classList.add("hidden");
      outcomeSection.classList.remove("animate-fade-in");
    }
  }
}

export function deleteActiveCheckin(id) {
  const item = activeTasks.find(a => a.id === id);
  if (!item) return;

  showAppConfirm({
    title: "ยืนยันการลบรายการเช็กอิน",
    message: `คุณต้องการลบรายการเช็กอิน "${item.id}" (${item.task}) ออกจากระบบหรือไม่?`,
    confirmText: "ลบรายการนี้",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      activeTasks = activeTasks.filter(a => a.id !== id);
      if (selectedActiveCheckoutId === id) {
        selectedActiveCheckoutId = null;
      }
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));

      dailyLogs = dailyLogs.filter(l => l.id !== id);
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));

      renderActiveCheckoutList();
      renderTodayLogs();

      // Sync deletion with Google Sheets
      deleteCheckinApi(id);

      showAppAlert({
        type: "success",
        title: "ลบรายการสำเร็จ",
        message: `ลบรายการเช็กอิน ${id} ออกจากระบบเรียบร้อยแล้ว`
      });
    }
  });
}

export function clearAllActiveCheckins() {
  if (activeTasks.length === 0) return;

  showAppConfirm({
    title: "ยืนยันการล้างรายการเช็กอิน",
    message: `คุณต้องการล้างรายการเช็กอินที่ค้างอยู่ทั้งหมด (${activeTasks.length} รายการ) ออกจากระบบหรือไม่?`,
    confirmText: "ล้างทั้งหมด",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      const idsToDelete = activeTasks.map(a => a.id);
      activeTasks = [];
      selectedActiveCheckoutId = null;
      localStorage.setItem("fs_active_tasks", JSON.stringify([]));

      dailyLogs = dailyLogs.filter(l => !idsToDelete.includes(l.id) || l.status === "เสร็จสิ้น");
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));

      renderActiveCheckoutList();
      renderTodayLogs();

      clearAllCheckinsApi();

      showAppAlert({
        type: "success",
        title: "ล้างรายการสำเร็จ",
        message: "ล้างรายการเช็กอินทั้งหมดเรียบร้อยแล้ว"
      });
    }
  });
}

export function selectActiveTaskForCheckout(id) {
  selectedActiveCheckoutId = id;
  const item = activeTasks.find(a => a.id === id);
  if (item) {
    const linkedTask = tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
    if (linkedTask && linkedTask.progress !== undefined) {
      setUpdatePercent(linkedTask.progress);
    } else if (item.progress !== undefined) {
      setUpdatePercent(item.progress);
    }
  }
  renderActiveCheckoutList();
  updateCheckoutSubmitButtonsState();
}

export function setCheckoutOutcome(outcome) {
  selectedCheckoutOutcome = outcome;
  const outcomes = [
    { key: "ปฏิบัติงานเรียบร้อย", activeClass: "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs ring-1 ring-emerald-400" },
    { key: "ติดปัญหา", activeClass: "bg-rose-50 border-rose-500 text-rose-800 shadow-2xs ring-1 ring-rose-400" }
  ];

  outcomes.forEach(oc => {
    const btn = document.getElementById(`outcomeBtn-${oc.key}`);
    if (btn) {
      if (oc.key === outcome) {
        btn.className = `py-2.5 px-3 rounded-xl border text-xs font-bold text-left transition-all ${oc.activeClass}`;
      } else {
        btn.className = "py-2.5 px-3 rounded-xl border text-xs font-medium text-left transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });

  const detailLabel = document.getElementById("checkoutOutcomeDetailLabel");
  const noteInput = document.getElementById("checkoutNoteInput");
  if (detailLabel && noteInput) {
    if (outcome === "ติดปัญหา") {
      detailLabel.innerHTML = `รายละเอียดปัญหาที่พบ <span class="text-rose-500 font-bold">* (จำเป็นต้องระบุ)</span>`;
      noteInput.placeholder = "เช่น กล้องจุดที่ 3 สัญญาณภาพไม่ออก รอเบิกสาย RG6 เส้นใหม่ หรือติดปัญหาระบบไฟฟ้า...";
    } else {
      detailLabel.innerHTML = `รายละเอียดผลการทำงาน / หมายเหตุ`;
      noteInput.placeholder = "ระบุรายละเอียดการปฏิบัติงาน เช่น ปรับมุมกล้องและส่งมอบงานให้ลูกค้าเรียบร้อย...";
    }
  }
}

// -------------------------------------------------------------
// TODAY LOGS UI
// -------------------------------------------------------------
export function renderTodayLogs() {
  const container = document.getElementById("todayLogsContainer");
  const badge = document.getElementById("todayLogsBadge");
  if (!container) return;

  if (badge) badge.innerText = `${dailyLogs.length} งาน`;

  if (dailyLogs.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
        ยังไม่มีประวัติการปฏิบัติงานในวันนี้
      </div>
    `;
    return;
  }

  container.innerHTML = dailyLogs.map(log => {
    const isDone = log.status === "เสร็จสิ้น" || log.status === "ปิดงานแล้ว";
    const techs = Array.isArray(log.techs) ? log.techs.join(", ") : (log.techs || "-");
    return `
      <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold px-1.5 py-0.2 rounded ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} font-mono">${log.id}</span>
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}">${log.status}</span>
            <button type="button" onclick="event.stopPropagation(); window.deleteTodayLog('${log.id}')" class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors active:scale-95" title="ลบประวัตินี้">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
        <div class="font-bold text-slate-900 truncate">${log.task}</div>
        <div class="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
          <span>ช่าง: ${techs}</span>
          <span>${formatDisplayTime(log.checkinTime)} น.${log.checkoutTime ? ` - ${formatDisplayTime(log.checkoutTime)} น.` : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

export function deleteTodayLog(id) {
  showAppConfirm({
    title: "ยืนยันการลบประวัติ",
    message: `คุณต้องการลบประวัติงาน "${id}" ออกจากรายการหรือไม่?`,
    confirmText: "ลบ",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      dailyLogs = dailyLogs.filter(l => l.id !== id);
      activeTasks = activeTasks.filter(a => a.id !== id);
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      renderTodayLogs();
      renderActiveCheckoutList();
      deleteCheckinApi(id);
    }
  });
}

export function toggleTodayLogsCollapse() {
  const container = document.getElementById("todayLogsContainer");
  const chevron = document.getElementById("todayLogsToggleChevron");
  if (!container) return;
  const isHidden = container.classList.toggle("hidden");
  if (chevron) {
    chevron.style.transform = isHidden ? "rotate(-90deg)" : "rotate(0deg)";
  }
}

// -------------------------------------------------------------
// INITIAL SYNC & BOOTSTRAP
// -------------------------------------------------------------
async function bootstrapApp() {
  // 1. Determine Initial Active Tab & Switch Immediately to avoid layout shift or jumping
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get("tab");
  let savedTab = null;
  try {
    savedTab = sessionStorage.getItem("fs_active_tab");
  } catch (e) {}
  const targetTab = urlTab || savedTab || "checkin";
  const targetTaskId = urlParams.get("taskId");
  const targetAction = urlParams.get("action");
  const targetId = urlParams.get("id");

  switchTab(targetTab);

  if (targetTab === "checkout") {
    if (targetAction === "update") {
      setActionTab("update");
    } else if (targetAction === "close") {
      setActionTab("close");
    }
    const matchId = targetId || targetTaskId;
    if (matchId) {
      const existing = activeTasks.find(a => a.id === matchId || a.taskId === matchId);
      if (existing) {
        selectActiveTaskForCheckout(existing.id);
      }
    }
  }

  // 2. LIFF Init
  await initLiff();
  updateLineStatusUI();

  // 3. GPS Request
  requestLocation((coords) => {
    const title = document.getElementById("gpsLocationTitle");
    const coordsText = document.getElementById("gpsCoordsText");
    const dot = document.getElementById("gpsDot");
    const text = document.getElementById("gpsStatusText");

    if (coords.isReady) {
      if (title) title.innerText = "📍 ระบุพิกัด GPS แม่นยำแล้ว";
      if (coordsText) coordsText.innerText = `ละติจูด: ${coords.lat}, ลองจิจูด: ${coords.lng} (ความคลาดเคลื่อน ±${coords.accuracy}m)`;
      if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-500";
      if (text) text.innerText = "GPS พร้อม";
    } else if (coords.error) {
      if (title) title.innerText = coords.error;
      if (dot) dot.className = "w-2 h-2 rounded-full bg-rose-500";
      if (text) text.innerText = "GPS ขัดข้อง";
    }
  });

  // 4. Sync initial data from Google Sheet in background
  const gasData = await fetchInitialData();
  if (gasData) {
    if (gasData.technicians && gasData.technicians.length > 0) {
      allTechnicians = Array.from(new Set([...allTechnicians, ...gasData.technicians]));
      localStorage.setItem("fs_technicians", JSON.stringify(allTechnicians));
    }
    if (gasData.tasks && Array.isArray(gasData.tasks)) {
      tasksList = gasData.tasks.map(gt => {
        const localCached = tasksList.find(lt => lt.id === gt.id);
        let prog = localCached && localCached.progress !== undefined ? localCached.progress : 0;
        if (gt.status === "เสร็จสิ้น") {
          prog = 100;
        } else if (gt.reason) {
          const match = String(gt.reason).match(/คืบหน้า\s*(\d+)%/);
          if (match) {
            prog = parseInt(match[1], 10);
          }
        }
        return {
          ...gt,
          progress: prog,
          latestUpdate: gt.reason && gt.reason !== '-' ? gt.reason : (localCached ? localCached.latestUpdate : '')
        };
      });
      localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
    }
    if (gasData.activeCheckins && Array.isArray(gasData.activeCheckins)) {
      activeTasks = gasData.activeCheckins.map(a => ({
        id: a.id,
        taskId: a.taskId || null,
        task: a.task,
        techs: [a.tech],
        time: formatGasTime(a.time) || "09:00",
        date: formatGasDate(a.date)
      }));
      // Merge in-progress tasks from tasksList into activeTasks so they are ready for updating
      tasksList.forEach(t => {
        if (t.status === "กำลังทำ" && !activeTasks.some(a => a.taskId === t.id || a.id === t.id || a.task === t.title)) {
          activeTasks.push({
            id: t.id,
            taskId: t.id,
            task: t.title,
            techs: Array.isArray(t.techs) ? t.techs : (t.assignee ? t.assignee.split(", ") : ["ช่างประจำทีม"]),
            time: "09:00",
            date: "วันนี้",
            progress: t.progress || 0
          });
        }
      });
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
    }

    // 3. Daily Logs (ALWAYS SYNC FROM GOOGLE SHEET AS SINGLE SOURCE OF TRUTH)
    const allSheetCheckins = [
      ...(gasData.activeCheckins || []).map(a => ({
        id: a.id,
        task: a.task,
        techs: [a.tech],
        checkinTime: formatGasTime(a.time),
        checkoutTime: a.outTime && a.outTime !== '-' ? formatGasTime(a.outTime) : null,
        status: a.status === "กำลังปฏิบัติงาน" ? "กำลังทำ" : "เสร็จสิ้น"
      })),
      ...(gasData.closedCheckins || []).map(c => ({
        id: c.id,
        task: c.task,
        techs: [c.tech],
        checkinTime: formatGasTime(c.time),
        checkoutTime: formatGasTime(c.outTime),
        status: "เสร็จสิ้น"
      }))
    ];
    dailyLogs = allSheetCheckins;
    localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
  }

  // 5. Re-render views for current tab without resetting tab
  if (currentTab === "checkin") {
    renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));
    renderCheckinTechChips();
  } else if (currentTab === "checkout") {
    renderActiveCheckoutList();
    const matchId = targetId || targetTaskId;
    if (matchId) {
      const existing = activeTasks.find(a => a.id === matchId || a.taskId === matchId);
      if (existing) {
        selectActiveTaskForCheckout(existing.id);
      }
    }
  } else if (currentTab === "tasks") {
    renderTechFilterChips(tasksList, allTechnicians);
    renderTasksList(tasksList);
  }

  renderTodayLogs();

  // 6. Supabase Realtime Live Synchronization across all devices!
  subscribeToRealtimeChanges({
    onTasksChange: async () => {
      const fresh = await fetchInitialData();
      if (fresh && fresh.tasks) {
        tasksList = fresh.tasks;
        localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
        renderTasksList(tasksList);
        renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));
        renderTechFilterChips(tasksList, allTechnicians);
      }
    },
    onCheckinsChange: async () => {
      const fresh = await fetchInitialData();
      if (fresh) {
        activeTasks = fresh.activeCheckins || [];
        dailyLogs = [...(fresh.activeCheckins || []), ...(fresh.closedCheckins || [])];
        localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
        localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
        renderActiveCheckoutList();
        renderTodayLogs();
      }
    },
    onTechsChange: async () => {
      const fresh = await fetchInitialData();
      if (fresh && fresh.technicians) {
        allTechnicians = fresh.technicians;
        localStorage.setItem("fs_technicians", JSON.stringify(allTechnicians));
        renderManageTechList();
        renderCheckinTechChips();
        renderTechFilterChips(tasksList, allTechnicians);
        renderAssignTechChips(allTechnicians);
      }
    }
  });
}

function updateLineStatusUI() {
  const dot = document.getElementById("lineLoginDot");
  const text = document.getElementById("lineLoginText");
  if (!dot || !text) return;

  if (isLineLoggedIn()) {
    const name = getLineUserName();
    dot.className = "w-2 h-2 rounded-full bg-emerald-500";
    text.innerText = name ? `LINE: ${name}` : "LINE เชื่อมต่อแล้ว";
  } else {
    dot.className = "w-2 h-2 rounded-full bg-slate-300";
    text.innerText = "เข้าสู่ระบบ LINE";
  }
}

// -------------------------------------------------------------
// EXPOSE FUNCTIONS TO WINDOW FOR INLINE HTML EVENT HANDLERS
// -------------------------------------------------------------
window.switchTab = switchTab;
window.selectAssignedTaskForCheckin = (taskId) => selectAssignedTask(taskId, tasksList, setCheckinTechs);
window.handlePhotoUpload = handlePhotoUpload;
window.removeCheckinPhoto = removePhoto;
window.selectJobType = selectJobType;
window.submitCheckin = () => {
  const locInput = document.getElementById("fieldLocationInput");
  const noteInput = document.getElementById("fieldNoteInput");
  const customInput = document.getElementById("customJobTypeInput");

  submitCheckinForm({
    selectedTechs: selectedCheckinTechs,
    selectedJobType: selectedJobType,
    customJobType: customInput ? customInput.value : "",
    locationText: locInput ? locInput.value : "",
    noteText: noteInput ? noteInput.value : "",
    onComplete: (record) => {
      activeTasks.unshift(record);
      dailyLogs.unshift({
        id: record.id,
        task: record.task,
        techs: record.techs,
        checkinTime: record.time,
        checkoutTime: null,
        status: "กำลังทำ"
      });
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      renderTodayLogs();
      renderActiveCheckoutList();
      showAppAlert({
        type: "success",
        title: "เช็กอินสำเร็จ!",
        message: `เช็กอินเข้าหน้างานและบันทึกเวลา ${record.time} น. เรียบร้อยแล้ว`
      });
    }
  });
};

window.setActionTab = setActionTab;
window.setCheckoutUpdatePercent = setUpdatePercent;
window.setCheckoutUpdateStatus = setUpdateStatus;
window.submitOngoingUpdate = () => {
  const activeItem = activeTasks.find(a => a.id === selectedActiveCheckoutId);
  const noteInput = document.getElementById("checkoutUpdateNoteInput");

  submitProgressOnly({
    activeItem: activeItem,
    noteText: noteInput ? noteInput.value : "",
    closerName: getLineUserName() || "ช่างหน้างาน",
    onComplete: (updatedInfo) => {
      const act = activeTasks.find(a => a.id === updatedInfo.id);
      if (act) {
        act.status = updatedInfo.status;
        act.progress = updatedInfo.progress;
      }
      const log = dailyLogs.find(l => l.id === updatedInfo.id);
      if (log) {
        log.status = updatedInfo.status;
        log.latestUpdate = updatedInfo.latestUpdate;
      }

      // Link and update the assigned task in tasksList
      if (activeItem) {
        const linkedTask = tasksList.find(t => 
          (activeItem.taskId && t.id === activeItem.taskId) || 
          t.id === activeItem.id || 
          t.title === activeItem.task
        );
        if (linkedTask) {
          linkedTask.progress = updatedInfo.progress;
          linkedTask.status = updatedInfo.status;
          linkedTask.latestUpdate = updatedInfo.latestUpdate;
          localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
          renderTasksList(tasksList);
        }
      }

      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      renderTodayLogs();
      renderActiveCheckoutList();
      showAppAlert({
        type: "success",
        title: "อัปเดตสำเร็จ!",
        message: `อัปเดตความคืบหน้าเป็น ${updatedInfo.progress}% และส่งเข้า LINE เรียบร้อยแล้ว`
      });
    }
  });
};

window.handleCheckoutPhotoUpload = handleCheckoutPhotoUpload;
window.removeCheckoutPhoto = removeCheckoutPhoto;
window.selectActiveTaskForCheckout = selectActiveTaskForCheckout;
window.setCheckoutOutcome = setCheckoutOutcome;
window.submitCheckout = () => {
  const activeItem = activeTasks.find(a => a.id === selectedActiveCheckoutId);
  const noteInput = document.getElementById("checkoutNoteInput");

  submitCheckoutForm({
    activeItem: activeItem,
    selectedOutcome: selectedCheckoutOutcome,
    noteText: noteInput ? noteInput.value : "",
    closerName: getLineUserName() || "ช่างหน้างาน",
    onComplete: (closedRecord) => {
      activeTasks = activeTasks.filter(a => a.id !== closedRecord.id);
      const log = dailyLogs.find(l => l.id === closedRecord.id);
      if (log) {
        log.status = "เสร็จสิ้น";
        log.checkoutTime = closedRecord.outTime;
        log.outcome = closedRecord.outcome;
      }

      // Link and complete the assigned task in tasksList
      if (closedRecord.taskId) {
        const linkedTask = tasksList.find(t => t.id === closedRecord.taskId);
        if (linkedTask) {
          linkedTask.status = "เสร็จสิ้น";
          linkedTask.progress = 100;
          linkedTask.latestUpdate = `ปิดงานเรียบร้อย: ${closedRecord.outcome}`;
          localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
          renderTasksList(tasksList);
        }
      }

      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      renderTodayLogs();
      renderActiveCheckoutList();
      showAppAlert({
        type: "success",
        title: "ปิดงานสำเร็จ!",
        message: "ปิดงานและส่งผลงานเข้าห้องแชท LINE เรียบร้อยแล้ว"
      });
    }
  });
};

window.setTaskViewMode = (mode) => setTaskViewMode(mode, tasksList);
window.setStatusFilter = (st) => setStatusFilter(st, tasksList);
window.setTaskTechFilter = (tech) => setTechFilter(tech, tasksList, allTechnicians);
window.handleTaskSearch = (query) => {
  setTaskSearchQuery(query);
  renderTasksList(tasksList);
};

window.openManageTechModal = openManageTechModal;
window.closeManageTechModal = closeManageTechModal;
window.confirmAddTech = confirmAddTech;
window.deleteTech = deleteTech;
window.toggleTodayLogsCollapse = toggleTodayLogsCollapse;

window.openAssignModal = () => openAssignModal(allTechnicians);
window.closeAssignModal = closeAssignModal;
window.selectAssignPriority = selectAssignPriority;
window.selectAssignCategory = selectAssignCategory;
window.toggleAssignTech = (t) => toggleAssignTech(t, allTechnicians);
window.fetchCurrentCoordsForAssign = () => {
  const coords = getCurrentCoords();
  const locInput = document.getElementById("assignLocationInput");
  if (!locInput) return;
  if (coords.isReady && coords.lat && coords.lng) {
    locInput.value = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
  } else {
    requestLocation((c) => {
      if (c && c.lat && c.lng) {
        locInput.value = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
      }
    });
  }
};
window.submitAssignModal = () => submitAssignForm({
  tasksList: tasksList,
  onComplete: () => {
    renderTasksList(tasksList);
    renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));
  }
});

// Calendar Pickers
window.pickAssignDate = pickAssignDate;
window.pickDetailDate = pickDetailDate;
window.pickExtendModalDate = pickExtendModalDate;
window.openCustomCalendar = openCustomCalendar;
window.closeCustomCalendar = closeCustomCalendar;
window.prevCalendarMonth = prevCalendarMonth;
window.nextCalendarMonth = nextCalendarMonth;
window.selectTodayOnCalendar = selectTodayOnCalendar;

window.openTaskDetailModal = (taskId) => openTaskDetailModal(taskId, tasksList, allTechnicians);
window.closeTaskDetailModal = closeTaskDetailModal;
window.setDetailModalStatus = setDetailModalStatus;
window.setDetailModalPriority = setDetailModalPriority;
window.updateDetailPhoneLink = updateDetailPhoneLink;
window.saveTaskDetailChanges = () => saveTaskDetailChanges(tasksList, () => {
  renderTasksList(tasksList);
});
window.deleteCurrentDetailTask = () => deleteCurrentDetailTask(tasksList, (deletedTask) => {
  if (deletedTask && deletedTask.id) {
    const linkedActives = activeTasks.filter(a => a.taskId === deletedTask.id || a.id === deletedTask.id);
    linkedActives.forEach(a => {
      deleteCheckinApi(a.id);
    });
    activeTasks = activeTasks.filter(a => a.taskId !== deletedTask.id && a.id !== deletedTask.id);
    if (selectedActiveCheckoutId && (selectedActiveCheckoutId === deletedTask.id || linkedActives.some(m => m.id === selectedActiveCheckoutId))) {
      selectedActiveCheckoutId = null;
    }
    localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
    renderActiveCheckoutList();
  }
  renderTasksList(tasksList);
});

window.deleteActiveCheckin = deleteActiveCheckin;
window.clearAllActiveCheckins = clearAllActiveCheckins;
window.deleteTodayLog = deleteTodayLog;

window.openEditTaskModal = (taskId) => openTaskDetailModal(taskId, tasksList, allTechnicians);
window.closeEditTaskModal = closeTaskDetailModal;
window.setEditModalStatus = setDetailModalStatus;
window.saveEditedTask = () => saveTaskDetailChanges(tasksList, () => renderTasksList(tasksList));

window.openExtendModal = (taskId) => openExtendModal(taskId, tasksList);
window.closeExtendModal = closeExtendModal;
window.submitExtendDeadline = () => submitExtendDeadline(tasksList, getLineUserName(), () => renderTasksList(tasksList));

window.openProgressModalForTask = (taskId) => {
  switchTab("checkout");
  setActionTab("update");
  let match = activeTasks.find(a => a.taskId === taskId || a.id === taskId);
  if (!match) {
    const task = tasksList.find(t => t.id === taskId);
    if (task) {
      match = {
        id: task.id,
        taskId: task.id,
        task: task.title,
        techs: task.assignee ? task.assignee.split(", ") : ["ช่างประจำทีม"],
        time: "09:00",
        date: "วันนี้"
      };
      activeTasks.unshift(match);
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      renderActiveCheckoutList();
    }
  }
  if (match) {
    selectActiveTaskForCheckout(match.id);
  }
};
window.closeUpdateProgressModal = closeProgressModal;
window.setProgressPercent = setProgressPercent;
window.setUpdateStatus = setProgressStatus;
window.submitUpdateProgress = () => submitProgressUpdate({
  tasksList: tasksList,
  currentLineUserName: getLineUserName(),
  onComplete: () => renderTasksList(tasksList)
});

window.handleLineLoginToggle = () => {
  if (isLineLoggedIn()) logoutLine();
  else loginLine();
};

window.requestLocation = () => requestLocation();

// Run bootstrap when DOM is ready
document.addEventListener("DOMContentLoaded", bootstrapApp);
