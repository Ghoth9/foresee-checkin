/**
 * Main Application Entry Point
 * Foresee Technology CCTV Service
 */

import './style.css';
import { 
  initLiff, 
  isLineLoggedIn, 
  getLineUserName, 
  getLineUserProfile, 
  getLineUserId, 
  loginLine, 
  logoutLine, 
  createProgressFlexCard, 
  createCheckinFlexCard, 
  triggerLiffShare 
} from './liff/line.js';
import { requestLocation, getCurrentCoords } from './utils/gps.js';
import { 
  fetchInitialData, 
  addNewTechnicianApi, 
  addNewTechnicianWithRoleApi, 
  updateTechnicianRoleApi, 
  bindTechnicianLineUserApi, 
  deleteTechnicianApi, 
  deleteCheckinApi, 
  deleteTaskApi, 
  clearAllCheckinsApi, 
  deletePhotoFromSupabaseApi, 
  subscribeToRealtimeChanges 
} from './api/supabase.js';
import {
  renderAssignedTasksBanner,
  selectAssignedTask,
  deselectAssignedTask,
  toggleCheckinFormDetails,
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
  switchTaskDetailTab,
  openImageLightbox,
  closeImageLightbox,
  zoomLightbox,
  resetLightboxZoom,
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
  pickExtendModalDate,
  setOnDeletePhotoCallback
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

let techniciansList = [];
let currentUserRole = "technician";
let currentLinkedTech = null;
const MASTER_ADMIN_PIN = "4499";

// Load cached state from LocalStorage
try {
  const cachedTechRecords = localStorage.getItem("fs_technicians_list");
  if (cachedTechRecords) techniciansList = JSON.parse(cachedTechRecords);

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
  if (currentUserRole !== "admin" && !isUserAdminActual()) {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์จัดการทีมงานครับ"
    });
    return;
  }
  openTeamRoleModal();
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
      <button type="button" onclick="window.deleteTech('${name}')" title="ลบรายชื่อผู้ปฏิบัติงานนี้" class="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1 text-[11px] font-semibold border border-rose-200 active:scale-95">
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
    title: "เพิ่มผู้ปฏิบัติงานสำเร็จ",
    message: `เพิ่ม "${name}" เข้าสู่ระบบทีมผู้ปฏิบัติงานเรียบร้อยแล้ว`
  });
}

export async function deleteTech(name) {
  if (allTechnicians.length <= 1) {
    showAppAlert({
      type: "warning",
      title: "ไม่สามารถลบได้",
      message: "ต้องมีรายชื่อผู้ปฏิบัติงานอย่างน้อย 1 คนในระบบ"
    });
    return;
  }

  showAppConfirm({
    title: "ยืนยันการลบรายชื่อผู้ปฏิบัติงาน",
    message: `คุณต้องการลบ "${name}" ออกจากระบบทีมผู้ปฏิบัติงานหรือไม่?`,
    confirmText: "ลบผู้ปฏิบัติงานคนนี้",
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
        title: "ลบผู้ปฏิบัติงานเรียบร้อย",
        message: `ลบ "${name}" ออกจากระบบแล้ว`
      });
    }
  });
}

export function selectJobType(type) {
  const standardTypes = [
    "ติดตั้งงานใหม่",
    "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)",
    "งานเซอร์วิส (มีค่าใช้จ่าย)",
    "งาน PM (Preventive Maintenance)",
    "เข้าตรวจสอบหน้างาน / สำรวจ",
    "custom"
  ];

  let targetType = type || "ติดตั้งงานใหม่";

  // Alias / fuzzy matching
  if (targetType === "ติดตั้งกล้องวงจรปิด" || targetType === "ติดตั้งงานใหม่") {
    targetType = "ติดตั้งงานใหม่";
  } else if (targetType.includes("ไม่มีค่าใช้จ่าย") || targetType.includes("ในประกัน") || targetType.includes("ฟรี") || targetType === "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)") {
    targetType = "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)";
  } else if (targetType.includes("มีค่าใช้จ่าย")) {
    targetType = "งานเซอร์วิส (มีค่าใช้จ่าย)";
  } else if (targetType.toUpperCase().includes("PM") || targetType.includes("บำรุง")) {
    targetType = "งาน PM (Preventive Maintenance)";
  } else if (targetType.includes("สำรวจ") || targetType.includes("ตรวจสอบ")) {
    targetType = "เข้าตรวจสอบหน้างาน / สำรวจ";
  } else if (targetType.includes("ซ่อม") || targetType.includes("ปรับมุม") || targetType.includes("เซอร์วิส") || targetType.includes("ประกัน")) {
    targetType = "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)";
  } else if (!standardTypes.includes(targetType)) {
    const customInput = document.getElementById("customJobTypeInput");
    if (customInput && targetType !== "custom") {
      customInput.value = targetType.replace(/^อื่นๆ:?\s*/, "");
    }
    targetType = "custom";
  }

  selectedJobType = targetType;
  const customContainer = document.getElementById("customJobTypeContainer");
  if (customContainer) {
    if (targetType === "custom") customContainer.classList.remove("hidden");
    else customContainer.classList.add("hidden");
  }

  standardTypes.forEach(t => {
    const btn = document.getElementById(`jobTypeBtn-${t}`);
    if (btn) {
      if (t === targetType) {
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

export function getUniquePhotosForActiveTask(activeItem) {
  if (!activeItem) return [];
  const linkedTask = tasksList.find(t => 
    (activeItem.taskId && t.id === activeItem.taskId) || 
    t.id === activeItem.id || 
    t.title === activeItem.task
  );

  const photosList = [];

  // 1. Photos in active checkin
  if (Array.isArray(activeItem.photos)) {
    activeItem.photos.forEach((p, idx) => {
      const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
      if (src) {
        photosList.push({
          src,
          caption: `${activeItem.task} • รูปเช็กอิน #${idx + 1}`
        });
      }
    });
  }

  // 2. Photos in task progress history
  if (linkedTask && Array.isArray(linkedTask.progressHistory)) {
    linkedTask.progressHistory.forEach(h => {
      if (Array.isArray(h.photos)) {
        h.photos.forEach((hp, idx) => {
          const src = hp.dataUrl || hp.base64 || hp.url || (typeof hp === "string" ? hp : null);
          if (src) {
            photosList.push({
              src,
              caption: `${linkedTask.title} • ความคืบหน้า ${h.progress || 0}% (${h.time || ''} โดย ${h.by || h.tech || 'ช่าง'}) #${idx + 1}`
            });
          }
        });
      }
    });
  }

  return photosList;
}

export function formatLatestNoteText(rawText) {
  if (!rawText || rawText === '-') return '';
  // If text contains pipe chain " | ", take the last updated section
  if (rawText.includes(' | ')) {
    const parts = rawText.split(' | ').filter(Boolean);
    const last = parts[parts.length - 1].trim();
    return last;
  }
  return rawText.trim();
}

export function renderActiveTaskPhotos(activeItem) {
  const container = document.getElementById("activeTaskExistingPhotosContainer");
  const grid = document.getElementById("activeTaskPhotosGrid");
  const badge = document.getElementById("activeTaskPhotosBadge");
  if (!container || !grid) return;

  if (!activeItem) {
    container.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  const photosList = getUniquePhotosForActiveTask(activeItem);

  if (photosList.length === 0) {
    container.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  if (badge) badge.innerText = `${photosList.length} รูป`;

  grid.innerHTML = photosList.map((p, idx) => `
    <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 cursor-pointer shadow-2xs hover:ring-2 hover:ring-blue-500 transition-all bg-slate-100 group"
         onclick="window.openImageLightbox('${p.src.replace(/'/g, "\\'")}', '${p.caption.replace(/'/g, "\\'")}', '${activeItem.id}')">
      <img src="${p.src}" class="w-full h-full object-cover" alt="รูปที่ ${idx + 1}" loading="lazy">
      <div class="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/0 transition-colors flex items-center justify-center">
        <svg class="w-4 h-4 text-white drop-shadow opacity-80 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
      </div>
      <button type="button" onclick="event.stopPropagation(); window.deletePhotoFromTask('${p.src.replace(/'/g, "\\'")}', '${activeItem.id}')" class="absolute top-1 right-1 w-5 h-5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md opacity-85 hover:opacity-100 hover:scale-110 transition-all z-10" title="ลบรูปนี้">
        ✕
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[9px] text-white text-center py-0.2">
        #${idx + 1}
      </div>
    </div>
  `).join("");
}

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
    renderActiveTaskPhotos(null);
    return;
  }

  container.innerHTML = activeTasks.map(item => {
    const isSelected = selectedActiveCheckoutId === item.id;
    const techList = Array.isArray(item.techs) ? item.techs.join(", ") : (item.techs || "ผู้ปฏิบัติงานทั่วไป");
    const displayTaskId = item.taskId ? `${item.taskId} (${item.id})` : item.id;
    const linkedTask = tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
    const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);
    const uniquePhotos = getUniquePhotosForActiveTask(item);
    const totalPhotos = uniquePhotos.length;
    const rawNote = linkedTask?.latestUpdate || item.note;
    const cleanNote = formatLatestNoteText(rawNote);

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
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono shadow-2xs">คืบหน้า ${itemProg}%</span>
            ${totalPhotos > 0 ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">📸 ${totalPhotos} รูป</span>` : ''}
          </div>
          <div class="flex items-center space-x-1.5">
            <button type="button" onclick="event.stopPropagation(); window.shareActiveTaskToLine('${item.id}')" class="text-emerald-700 hover:text-white hover:bg-emerald-600 px-2 py-1 rounded-lg border border-emerald-300 hover:border-emerald-600 text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs" title="แชร์ข้อมูลงานนี้เข้ากลุ่ม LINE">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 2.92 1.63 5.51 4.16 7.05-.18.66-.66 2.4-0.75 2.76-.12.44.16.44.34.32.24-.16 2.84-1.92 3.99-2.7 0.73.13 1.48.21 2.26.21 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"/></svg>
              <span>แชร์เข้า LINE</span>
            </button>
            ${currentUserRole === "admin" ? `
              <button type="button" onclick="event.stopPropagation(); window.deleteActiveCheckin('${item.id}')" class="text-rose-600 hover:text-white hover:bg-rose-600 px-2.5 py-1 rounded-lg border border-rose-200 hover:border-rose-600 text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs" title="ลบรายการเช็กอินนี้">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>ลบรายการ</span>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="font-bold text-sm text-slate-950">${item.task}</div>
        ${cleanNote ? `
          <div class="text-[11px] text-blue-900 bg-blue-50/90 rounded-lg px-2.5 py-1.5 mt-2 font-medium border border-blue-200/70 flex items-start space-x-1.5">
            <span class="flex-shrink-0 text-blue-600 font-bold">📌 ล่าสุด:</span>
            <span class="truncate block flex-1 font-sans text-slate-800" title="${cleanNote}">${cleanNote}</span>
          </div>
        ` : ''}
        <div class="text-slate-600 mt-2 flex items-center justify-between font-medium pt-1.5 border-t border-slate-100">
          <span>👷 ผู้ปฏิบัติงาน: <strong class="text-slate-900">${techList}</strong></span>
          <span class="text-xs text-slate-600 font-mono">⏱️ ${calculateDuration(item.time)}</span>
        </div>
      </div>
    `;
  }).join('');

  if (outcomeSection) {
    if (selectedActiveCheckoutId) {
      outcomeSection.classList.remove("hidden");
      outcomeSection.classList.add("animate-fade-in");
      const activeObj = activeTasks.find(a => a.id === selectedActiveCheckoutId);
      if (activeObj) renderActiveTaskPhotos(activeObj);
    } else {
      outcomeSection.classList.add("hidden");
      outcomeSection.classList.remove("animate-fade-in");
      renderActiveTaskPhotos(null);
    }
  }
}

export function deleteActiveCheckin(id) {
  if (currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบรายการเช็กอินได้ครับ"
    });
    return;
  }
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
  if (currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถล้างรายการเช็กอินทั้งหมดได้ครับ"
    });
    return;
  }
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

  const isAdmin = currentUserRole === "admin";

  container.innerHTML = dailyLogs.map(log => {
    const isDone = log.status === "เสร็จสิ้น" || log.status === "ปิดงานแล้ว";
    const techs = Array.isArray(log.techs) ? log.techs.join(", ") : (log.techs || "-");
    return `
      <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-bold px-1.5 py-0.2 rounded ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} font-mono">${log.id}</span>
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}">${log.status}</span>
            ${isAdmin ? `
              <button type="button" onclick="event.stopPropagation(); window.deleteTodayLog('${log.id}')" class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors active:scale-95" title="ลบประวัตินี้">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="font-bold text-slate-900 truncate">${log.task}</div>
        <div class="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
          <span>ผู้ปฏิบัติงาน: ${techs}</span>
          <span>${formatDisplayTime(log.checkinTime)} น.${log.checkoutTime ? ` - ${formatDisplayTime(log.checkoutTime)} น.` : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

export function deleteTodayLog(id) {
  if (currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบประวัติงานได้ครับ"
    });
    return;
  }
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
  } else if (targetTab === "tasks" && targetTaskId) {
    const targetSubtab = urlParams.get("subtab");
    setTimeout(() => {
      openTaskDetailModal(targetTaskId, tasksList, allTechnicians, targetSubtab === "timeline" ? "timeline" : "info");
    }, 150);
  }

  // 2. INSTANT ZERO-MILLISECOND RENDER FROM LOCAL CACHE (0ms delay)
  renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));
  renderCheckinTechChips();
  renderActiveCheckoutList();
  renderTechFilterChips(tasksList, allTechnicians);
  renderTasksList(tasksList);
  renderTodayLogs();

  // 3. Background Services (Non-blocking): LINE LIFF & GPS
  resolveUserRole();
  initLiff().then(() => {
    updateLineStatusUI();
    resolveUserRole();
  }).catch(e => console.warn("LIFF init error:", e));
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

  // 4. Initial live sync from Supabase immediately in parallel
  refreshFromSupabase(true);

  // 5. Supabase Realtime Live Synchronization across all devices!
  subscribeToRealtimeChanges({
    onTasksChange: () => refreshFromSupabase(true),
    onCheckinsChange: () => refreshFromSupabase(true),
    onTechsChange: () => refreshFromSupabase(true)
  });

  // 6. Auto refresh on window focus / tab visibility change (PC & Mobile sync)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshFromSupabase();
    }
  });
  window.addEventListener('focus', () => {
    refreshFromSupabase();
  });

  // 7. Background sync interval (every 15 seconds)
  setInterval(() => refreshFromSupabase(), 15000);
}

let isRefreshing = false;
let lastRefreshTime = 0;

export async function refreshFromSupabase(force = false) {
  const now = Date.now();
  if (!force && (isRefreshing || (now - lastRefreshTime < 2000))) return;
  isRefreshing = true;
  lastRefreshTime = now;

  try {
    const fresh = await fetchInitialData();
    if (!fresh) return;

    if (fresh.technicians && Array.isArray(fresh.technicians) && fresh.technicians.length > 0) {
      allTechnicians = Array.from(new Set([...allTechnicians, ...fresh.technicians]));
      localStorage.setItem("fs_technicians", JSON.stringify(allTechnicians));
      renderManageTechList();
      renderCheckinTechChips();
      renderAssignTechChips(allTechnicians);
    }

    if (fresh.techniciansList && Array.isArray(fresh.techniciansList)) {
      techniciansList = fresh.techniciansList;
      try {
        localStorage.setItem("fs_technicians_list", JSON.stringify(techniciansList));
      } catch (e) {}
      await resolveUserRole();
      if (!document.getElementById("teamRoleModal")?.classList.contains("hidden")) {
        renderTeamRoleList();
      }
    }

    if (fresh.tasks && Array.isArray(fresh.tasks)) {
      const serverMap = new Map(fresh.tasks.map(t => [t.id, t]));
      // Keep any recently created local tasks (under 3 mins old) that might still be syncing
      const recentLocal = tasksList.filter(t => !serverMap.has(t.id) && (Date.now() - (t.createdAt || 0) < 180000));
      tasksList = [...recentLocal, ...fresh.tasks];
      localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
      renderTasksList(tasksList);
      renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));
      renderTechFilterChips(tasksList, allTechnicians);
    }

    // Active Checkins + In-Progress Tasks Merge
    const checkinActives = Array.isArray(fresh.activeCheckins) ? fresh.activeCheckins.map(a => {
      const linkedT = tasksList.find(t => t.id === a.taskId || t.title === a.task);
      return {
        id: a.id,
        taskId: a.taskId || null,
        task: a.task,
        techs: Array.isArray(a.techs) && a.techs.length > 0 ? a.techs : (a.tech ? [a.tech] : ["ผู้ปฏิบัติงานทั่วไป"]),
        time: formatGasTime(a.time) || "09:00",
        date: formatGasDate(a.date),
        progress: a.progress !== undefined && a.progress > 0 ? a.progress : (linkedT?.progress || 0),
        photos: a.photos || [],
        note: a.note || ''
      };
    }) : [];

    // Also include in-progress tasks so technicians can view & update anytime
    tasksList.forEach(t => {
      if (t.status === "กำลังทำ" && !checkinActives.some(a => a.taskId === t.id || a.id === t.id || a.task === t.title)) {
        checkinActives.push({
          id: t.id,
          taskId: t.id,
          task: t.title,
          techs: Array.isArray(t.techs) ? t.techs : (t.assignee ? t.assignee.split(", ") : ["ผู้ปฏิบัติงานประจำทีม"]),
          time: "09:00",
          date: "วันนี้",
          progress: t.progress || 0,
          photos: [],
          note: t.latestUpdate || ''
        });
      }
    });

    activeTasks = checkinActives;
    localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
    renderActiveCheckoutList();

    if (fresh.activeCheckins || fresh.closedCheckins) {
      dailyLogs = [...(fresh.activeCheckins || []), ...(fresh.closedCheckins || [])];
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      renderTodayLogs();
    }

    if (selectedActiveCheckoutId) {
      const curActive = activeTasks.find(a => a.id === selectedActiveCheckoutId || a.taskId === selectedActiveCheckoutId);
      if (curActive) renderActiveTaskPhotos(curActive);
    }
  } catch (err) {
    console.warn("refreshFromSupabase error:", err);
  } finally {
    isRefreshing = false;
  }
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
// USER ROLE & PERMISSION MANAGEMENT (ADMIN VS TECHNICIAN)
// -------------------------------------------------------------
export function isCurrentUserAdmin() {
  return currentUserRole === "admin";
}

export async function resolveUserRole() {
  // 1. Identify LINE Login Profile and perform Auto-Bind
  let matchedTech = null;
  if (isLineLoggedIn()) {
    const profile = getLineUserProfile();
    if (profile && profile.userId) {
      // Find match in techniciansList by line_user_id
      let match = techniciansList.find(t => t.line_user_id === profile.userId);

      // If not found by line_user_id, match by displayName keywords
      if (!match) {
        const dName = (profile.displayName || "").toLowerCase();
        if (dName.includes("nonmarn")) {
          match = techniciansList.find(t => t.name && t.name.toLowerCase().includes("nonmarn"));
        } else if (dName.includes("baipor") || dName.includes("ใบปอ") || dName.includes("095-8188897") || dName.includes("สุพิชชาญาต์")) {
          match = techniciansList.find(t => (t.name && (t.name.includes("ใบปอ") || t.name.includes("สุพิชชาญาต์"))));
        } else if (dName.includes("arm") || dName.includes("อาร์ม") || dName.includes("ชัยวัฒน์")) {
          match = techniciansList.find(t => t.name && (t.name.includes("อาร์ม") || t.name.includes("ชัยวัฒน์")));
        }

        // Or match against any technician's nickname
        if (!match) {
          match = techniciansList.find(t => {
            if (!t.name) return false;
            const pureName = t.name.replace(/K\./g, '').split('(')[0].trim().toLowerCase();
            return pureName && pureName.length > 1 && dName.includes(pureName);
          });
        }

        // Auto-bind line_user_id to this technician in Supabase
        if (match && !match.line_user_id) {
          match.line_user_id = profile.userId;
          bindTechnicianLineUserApi(match.id, profile.userId);
        }
      }

      if (match) {
        currentLinkedTech = match;
        matchedTech = match;
      } else {
        // Logged in via LINE, but no profile linked yet! Prompt link modal once!
        if (sessionStorage.getItem("fs_link_modal_dismissed") !== "true") {
          setTimeout(() => openLinkLineAccountModal(), 600);
        }
      }
    }
  }

  // 2. Determine actual role
  let actualRole = "technician";
  if (matchedTech && matchedTech.role === "admin") {
    actualRole = "admin";
  } else if (sessionStorage.getItem("fs_admin_override") === "true") {
    actualRole = "admin";
  }

  // 3. Check active simulation (persisted in sessionStorage)
  const sim = sessionStorage.getItem("fs_simulated_role");
  if (sim) {
    simulatedRole = sim;
    currentUserRole = sim;
    applyRolePermissionsUI(currentUserRole, currentLinkedTech);
    return;
  }

  // 4. Normal role application
  currentUserRole = actualRole;
  applyRolePermissionsUI(currentUserRole, currentLinkedTech);
}

let simulatedRole = null;

export function isUserAdminActual() {
  if (sessionStorage.getItem("fs_admin_override") === "true") return true;
  if (currentLinkedTech && currentLinkedTech.role === "admin") return true;
  if (isLineLoggedIn()) {
    const profile = getLineUserProfile();
    if (profile && profile.userId) {
      const match = techniciansList.find(t => t.line_user_id === profile.userId);
      if (match && match.role === "admin") return true;
      const dName = (profile.displayName || "").toLowerCase();
      if (dName.includes("nonmarn") || dName.includes("baipor") || dName.includes("ใบปอ") || dName.includes("อาร์ม")) return true;
    }
  }
  return false;
}

export function switchSimulatedRole(mode) {
  if (mode === "admin") {
    sessionStorage.removeItem("fs_simulated_role");
    simulatedRole = null;
    currentUserRole = "admin";
  } else {
    sessionStorage.setItem("fs_simulated_role", "technician");
    simulatedRole = "technician";
    currentUserRole = "technician";
  }

  closeRoleDropdownMenu();
  applyRolePermissionsUI(currentUserRole, currentLinkedTech);

  // Sync tasks view and check-in banner immediately
  renderTasksList(tasksList);
  renderAssignedTasksBanner(tasksList, allTechnicians, (tId) => selectAssignedTask(tId, tasksList, setCheckinTechs));

  showAppAlert({
    type: "info",
    title: mode === "admin" ? "สลับเป็น: มุมมองแอดมิน 👑" : "สลับเป็น: มุมมองผู้ปฏิบัติงาน 👷",
    message: mode === "admin"
      ? "แสดงผลแบบแอดมินเต็มรูปแบบ (มอบหมายงาน, แก้ไข, ลบงาน, จัดการสิทธิ์)"
      : "แสดงผลแบบผู้ปฏิบัติงาน (ซ่อนปุ่มมอบหมายงานและปุ่มลบงาน ดูรายละเอียดงานอย่างเดียว)"
  });
}

export function toggleRoleDropdownMenu() {
  const menu = document.getElementById("userRoleDropdownMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

export function closeRoleDropdownMenu() {
  const menu = document.getElementById("userRoleDropdownMenu");
  if (menu) menu.classList.add("hidden");
}

export function applyRolePermissionsUI(role, techObj) {
  const isAdmin = role === "admin";

  // 1. Header Role Badge
  const badge = document.getElementById("userRoleBadge");
  const icon = document.getElementById("userRoleIcon");
  const text = document.getElementById("userRoleText");
  const adminTeamBtn = document.getElementById("adminManageTeamBtn");
  const assignTaskHeaderBtn = document.getElementById("assignTaskHeaderBtn");

  if (badge && icon && text) {
    if (isAdmin) {
      icon.innerText = "👑";
      const cleanName = techObj?.name ? techObj.name.replace(/K\./g, '').split(' ')[0] : (getLineUserName() || "แอดมิน");
      text.innerText = `แอดมิน: ${cleanName}`;
      badge.className = "flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 shadow-2xs transition-all active:scale-95 cursor-pointer";
      badge.title = "คุณมีสิทธิ์แอดมิน (แตะเพื่อสลับมุมมองหรือจัดการสิทธิ์)";
    } else {
      icon.innerText = "👷";
      const cleanName = techObj?.name ? techObj.name.replace(/K\./g, '').split(' ')[0] : (getLineUserName() || "ทั่วไป");
      text.innerText = `ผู้ปฏิบัติงาน: ${cleanName}`;
      badge.className = "flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs transition-all active:scale-95 cursor-pointer";
      badge.title = "เข้าสู่ระบบในฐานะผู้ปฏิบัติงาน (แตะเพื่อปลดล็อกแอดมินหรือสลับมุมมอง)";
    }
  }

  // 2. Dropdown checks
  const checkAdmin = document.getElementById("roleCheckAdmin");
  const checkTech = document.getElementById("roleCheckTech");
  if (checkAdmin) {
    if (isAdmin) checkAdmin.classList.remove("hidden");
    else checkAdmin.classList.add("hidden");
  }
  if (checkTech) {
    if (!isAdmin) checkTech.classList.remove("hidden");
    else checkTech.classList.add("hidden");
  }

  // 3. Simulated role banner
  const banner = document.getElementById("simulatedRoleBanner");
  if (banner) {
    if (!isAdmin && (isUserAdminActual() || sessionStorage.getItem("fs_admin_override") === "true")) {
      banner.classList.remove("hidden");
      banner.classList.add("flex");
    } else {
      banner.classList.add("hidden");
      banner.classList.remove("flex");
    }
  }

  // 4. Admin Team Button
  if (adminTeamBtn) {
    if (isAdmin) {
      adminTeamBtn.classList.remove("hidden");
      adminTeamBtn.classList.add("flex");
    } else {
      adminTeamBtn.classList.add("hidden");
      adminTeamBtn.classList.remove("flex");
    }
  }

  // 5. Assign Task & Manage Team Buttons
  if (assignTaskHeaderBtn) {
    if (isAdmin) {
      assignTaskHeaderBtn.classList.remove("hidden");
    } else {
      assignTaskHeaderBtn.classList.add("hidden");
    }
  }

  const assignTaskSectionBtn = document.getElementById("assignTaskSectionBtn");
  if (assignTaskSectionBtn) {
    if (isAdmin) {
      assignTaskSectionBtn.classList.remove("hidden");
    } else {
      assignTaskSectionBtn.classList.add("hidden");
    }
  }

  const manageTechSectionBtn = document.getElementById("manageTechSectionBtn");
  if (manageTechSectionBtn) {
    if (isAdmin) {
      manageTechSectionBtn.classList.remove("hidden");
    } else {
      manageTechSectionBtn.classList.add("hidden");
    }
  }

  // 6. Task Detail Modal Controls
  const deleteBtn = document.getElementById("detailModalDeleteBtn");
  const saveBtn = document.getElementById("detailModalSaveBtn");
  const notice = document.getElementById("detailModalTechNotice");
  if (deleteBtn) {
    if (isAdmin) deleteBtn.classList.remove("hidden");
    else deleteBtn.classList.add("hidden");
  }
  if (saveBtn) {
    if (isAdmin) saveBtn.classList.remove("hidden");
    else saveBtn.classList.add("hidden");
  }
  if (notice) {
    if (isAdmin) {
      notice.classList.add("hidden");
      notice.classList.remove("flex");
    } else {
      notice.classList.remove("hidden");
      notice.classList.add("flex");
    }
  }

  // 7. Clear all checkins button in Checkout tab
  const clearAllBtn = document.getElementById("clearAllCheckinsBtn");
  if (clearAllBtn) {
    if (isAdmin && activeTasks.length > 0) {
      clearAllBtn.classList.remove("hidden");
    } else {
      clearAllBtn.classList.add("hidden");
    }
  }

  // 8. Re-render Today Logs & Active Checkout List to sync delete buttons
  renderTodayLogs();
  renderActiveCheckoutList();
}

export function handleRoleBadgeClick() {
  const isAdmin = isUserAdminActual() || currentUserRole === "admin";
  if (isAdmin) {
    toggleRoleDropdownMenu();
  } else {
    // Open PIN prompt
    const el = document.getElementById("adminPinModal");
    const input = document.getElementById("adminPinInput");
    if (input) input.value = "";
    if (el) el.classList.remove("hidden");
    if (input) input.focus();
  }
}

export function closeAdminPinModal() {
  const el = document.getElementById("adminPinModal");
  if (el) el.classList.add("hidden");
}

export function submitAdminPinUnlock() {
  const input = document.getElementById("adminPinInput");
  const pin = input ? input.value.trim() : "";
  if (pin === MASTER_ADMIN_PIN || pin === "8888") {
    sessionStorage.setItem("fs_admin_override", "true");
    currentUserRole = "admin";
    closeAdminPinModal();
    applyRolePermissionsUI("admin", { name: "ผู้ดูแลระบบ (Admin)", role: "admin" });
    showAppAlert({
      type: "success",
      title: "ปลดล็อกสิทธิ์แอดมินสำเร็จ",
      message: "ยินดีต้อนรับ เข้าสู่โหมดแอดมินเต็มรูปแบบ สามารถมอบหมายงาน แก้ไข ลบงาน จัดการสิทธิ์ และสลับมุมมองหน้าจอได้ทันทีครับ 👑"
    });
  } else {
    showAppAlert({
      type: "warning",
      title: "รหัส PIN ไม่ถูกต้อง",
      message: "กรุณาระบุรหัส PIN ผู้ดูแลระบบให้ถูกต้อง"
    });
  }
}

export function openTeamRoleModal() {
  if (currentUserRole !== "admin" && !isUserAdminActual()) {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงส่วนจัดการทีมงานได้"
    });
    return;
  }
  renderTeamRoleList();
  const el = document.getElementById("teamRoleModal");
  if (el) el.classList.remove("hidden");
}

export function closeTeamRoleModal() {
  const el = document.getElementById("teamRoleModal");
  if (el) el.classList.add("hidden");
}

export function renderTeamRoleList() {
  const container = document.getElementById("teamRoleListContainer");
  const countEl = document.getElementById("teamRoleCount");
  if (!container) return;

  if (countEl) countEl.innerText = techniciansList.length;

  if (techniciansList.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 text-center py-4">ยังไม่มีรายชื่อสมาชิกในระบบ</div>`;
    return;
  }

  const currentLineName = getLineUserName();
  const currentLineId = getLineUserId();

  container.innerHTML = techniciansList.map(tech => {
    const isAdmin = tech.role === "admin";
    const isLineLinked = !!tech.line_user_id;
    const isLinkedToMe = isLineLinked && currentLineId && tech.line_user_id === currentLineId;

    return `
      <div class="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
        <div class="min-w-0">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="font-bold text-xs text-slate-900 truncate">${tech.name}</span>
            ${isAdmin ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">👑 แอดมิน</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">👷 ผู้ปฏิบัติงาน</span>`}
            ${isLinkedToMe ? `<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">บัญชีของคุณ</span>` : ''}
          </div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center space-x-2 flex-wrap gap-y-1">
            <span>📞 ${tech.phone || '-'}</span>
            <span>•</span>
            ${isLineLinked ? `
              <span class="text-emerald-600 font-semibold flex items-center space-x-1">
                <span>🟢 เชื่อม LINE แล้ว</span>
                <button type="button" onclick="window.unbindTechLineUser('${tech.id}')" class="text-slate-400 hover:text-rose-600 text-[10px] ml-1 p-0.5 rounded hover:bg-rose-50" title="ยกเลิกการผูก LINE">✕ ยกเลิกผูก</button>
              </span>
            ` : `
              <span class="text-slate-400">⚪ ยังไม่ผูก LINE</span>
            `}
          </div>
        </div>

        <div class="flex items-center space-x-1.5 flex-shrink-0">
          <div class="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
            <button type="button" onclick="window.handleChangeMemberRole('${tech.id}', 'technician')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${!isAdmin ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'}" title="กำหนดสิทธิ์เป็นผู้ปฏิบัติงาน">
              👷 ช่าง
            </button>
            <button type="button" onclick="window.handleChangeMemberRole('${tech.id}', 'admin')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${isAdmin ? 'bg-amber-400 text-slate-950 shadow-2xs' : 'text-slate-400 hover:text-amber-700'}" title="กำหนดสิทธิ์เป็นแอดมิน">
              👑 แอดมิน
            </button>
          </div>
          <button type="button" onclick="window.handleDeleteMember('${tech.name}', '${tech.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" title="ลบสมาชิก">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

export function setNewMemberRole(role) {
  const input = document.getElementById("newMemberRoleSelect");
  const btnTech = document.getElementById("newMemberRoleBtnTech");
  const btnAdmin = document.getElementById("newMemberRoleBtnAdmin");
  if (input) input.value = role;
  if (btnTech && btnAdmin) {
    if (role === "admin") {
      btnAdmin.className = "py-1.5 rounded-lg transition-all bg-amber-400 text-slate-950 shadow-2xs font-bold flex items-center justify-center space-x-1 cursor-pointer";
      btnTech.className = "py-1.5 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1 cursor-pointer";
    } else {
      btnTech.className = "py-1.5 rounded-lg transition-all bg-white text-slate-900 shadow-2xs font-bold flex items-center justify-center space-x-1 cursor-pointer";
      btnAdmin.className = "py-1.5 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1 cursor-pointer";
    }
  }
}

export async function bindCurrentLineUserToTech(techId) {
  const profile = getLineUserProfile();
  if (!profile || !profile.userId) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เข้าสู่ระบบ LINE",
      message: "กรุณากดเข้าสู่ระบบ LINE ก่อนดำเนินการผูกบัญชีครับ"
    });
    return;
  }
  const res = await bindTechnicianLineUserApi(techId, profile.userId);
  if (res.success) {
    const tech = techniciansList.find(t => t.id === techId);
    if (tech) tech.line_user_id = profile.userId;
    showAppAlert({
      type: "success",
      title: "ผูกบัญชี LINE สำเร็จ!",
      message: `เชื่อมต่อบัญชี LINE "${profile.displayName}" เข้ากับ "${tech?.name || ''}" เรียบร้อยแล้ว 🟢`
    });
    refreshFromSupabase(true);
  } else {
    showAppAlert({
      type: "warning",
      title: "เกิดข้อผิดพลาด",
      message: res.error || "ไม่สามารถผูกบัญชี LINE ได้"
    });
  }
}

export async function unbindTechLineUser(techId) {
  showAppConfirm({
    title: "ยืนยันยกเลิกการผูกบัญชี LINE",
    message: "คุณต้องการยกเลิกการผูกบัญชี LINE ของสมาชิกท่านนี้หรือไม่?",
    confirmText: "ยกเลิกการผูก",
    cancelText: "ปิด",
    isDanger: true,
    onConfirm: async () => {
      const res = await bindTechnicianLineUserApi(techId, null);
      if (res.success) {
        const tech = techniciansList.find(t => t.id === techId);
        if (tech) tech.line_user_id = null;
        showAppAlert({
          type: "info",
          title: "ยกเลิกการผูก LINE สำเร็จ",
          message: "ยกเลิกการผูกบัญชีเรียบร้อยแล้ว"
        });
        refreshFromSupabase(true);
      }
    }
  });
}

export function openLinkLineAccountModal() {
  const el = document.getElementById("linkLineAccountModal");
  const nameEl = document.getElementById("linkLineDisplayNameText");
  const listEl = document.getElementById("linkLineMemberListContainer");
  if (!el || !listEl) return;

  const currentName = getLineUserName() || "LINE User";
  if (nameEl) nameEl.innerText = currentName;

  listEl.innerHTML = techniciansList.map(tech => {
    const isBound = !!tech.line_user_id;
    return `
      <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shadow-2xs">
        <div class="min-w-0">
          <div class="font-bold text-xs text-slate-900 truncate">${tech.name}</div>
          <div class="text-[10px] text-slate-500">${tech.role === 'admin' ? '👑 แอดมิน' : '👷 ผู้ปฏิบัติงาน'} ${isBound ? '• ผูก LINE แล้ว' : '• ยังไม่ผูก LINE'}</div>
        </div>
        <button type="button" onclick="window.selectTechToBindLine('${tech.id}')" class="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95 transition-all flex-shrink-0">
          เลือกฉัน
        </button>
      </div>
    `;
  }).join("");

  el.classList.remove("hidden");
}

export function closeLinkLineAccountModal() {
  const el = document.getElementById("linkLineAccountModal");
  if (el) el.classList.add("hidden");
  sessionStorage.setItem("fs_link_modal_dismissed", "true");
}

export async function selectTechToBindLine(techId) {
  await bindCurrentLineUserToTech(techId);
  closeLinkLineAccountModal();
}

export async function handleChangeMemberRole(techId, newRole) {
  const target = techniciansList.find(t => t.id === techId);
  if (target && target.role === newRole) return; // Already this role

  const res = await updateTechnicianRoleApi(techId, newRole);
  if (res.success) {
    if (target) target.role = newRole;
    showAppAlert({
      type: "success",
      title: "อัปเดตสิทธิ์สำเร็จ",
      message: `เปลี่ยนสิทธิ์ของ "${target?.name || ''}" เป็น ${newRole === 'admin' ? 'แอดมิน' : 'ผู้ปฏิบัติงาน'} เรียบร้อยแล้ว`
    });
    renderTeamRoleList();
    resolveUserRole();
  } else {
    showAppAlert({
      type: "warning",
      title: "เกิดข้อผิดพลาด",
      message: res.error || "ไม่สามารถอัปเดตสิทธิ์ได้"
    });
  }
}

export async function submitAddNewMember() {
  const nameInput = document.getElementById("newMemberNameInput");
  const roleSelect = document.getElementById("newMemberRoleSelect");
  const name = nameInput ? nameInput.value.trim() : "";
  const role = roleSelect ? roleSelect.value : "technician";

  if (!name) {
    showAppAlert({
      type: "warning",
      title: "กรุณาระบุชื่อสมาชิก",
      message: "กรุณากรอกชื่อ-สกุล หรือชื่อเล่นของสมาชิกใหม่"
    });
    return;
  }

  const res = await addNewTechnicianWithRoleApi(name, "-", role);
  if (res.success) {
    if (nameInput) nameInput.value = "";
    setNewMemberRole("technician");
    showAppAlert({
      type: "success",
      title: "เพิ่มสมาชิกสำเร็จ",
      message: `บันทึก "${name}" เข้าสู่ระบบเรียบร้อยแล้ว`
    });
    refreshFromSupabase(true);
  } else {
    showAppAlert({
      type: "warning",
      title: "บันทึกไม่สำเร็จ",
      message: res.error || "ไม่สามารถเพิ่มสมาชิกได้"
    });
  }
}

export async function handleDeleteMember(techName, techId) {
  showAppConfirm({
    title: "ยืนยันการลบสมาชิก",
    message: `คุณต้องการลบ "${techName}" ออกจากระบบหรือไม่?`,
    confirmText: "ลบสมาชิก",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: async () => {
      const res = await deleteTechnicianApi(techName);
      if (res.success) {
        showAppAlert({
          type: "success",
          title: "ลบสมาชิกสำเร็จ",
          message: `ลบ "${techName}" ออกจากระบบเรียบร้อยแล้ว`
        });
        refreshFromSupabase(true);
      } else {
        showAppAlert({
          type: "warning",
          title: "เกิดข้อผิดพลาด",
          message: res.error || "ไม่สามารถลบสมาชิกได้"
        });
      }
    }
  });
}

// -------------------------------------------------------------
// EXPOSE FUNCTIONS TO WINDOW FOR INLINE HTML EVENT HANDLERS
// -------------------------------------------------------------
window.switchTab = switchTab;
window.selectAssignedTaskForCheckin = (taskId) => selectAssignedTask(taskId, tasksList, setCheckinTechs);
window.deselectAssignedTask = () => deselectAssignedTask(tasksList);
window.toggleCheckinFormDetails = toggleCheckinFormDetails;
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
  const uniquePhotos = getUniquePhotosForActiveTask(activeItem);

  submitProgressOnly({
    activeItem: activeItem,
    noteText: noteInput ? noteInput.value : "",
    closerName: getLineUserName() || "ผู้ปฏิบัติงานหน้างาน",
    totalPhotosCount: uniquePhotos.length,
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
          if (updatedInfo.historyItem) {
            if (!Array.isArray(linkedTask.progressHistory)) linkedTask.progressHistory = [];
            if (!linkedTask.progressHistory.some(h => h.id === updatedInfo.historyItem.id)) {
              linkedTask.progressHistory.push(updatedInfo.historyItem);
            }
          }
          localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
          renderTasksList(tasksList);
        }
      }

      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      if (noteInput) noteInput.value = "";
      renderTodayLogs();
      renderActiveCheckoutList();
      if (act) renderActiveTaskPhotos(act);

      if (updatedInfo.lineShared) {
        showAppAlert({
          type: "success",
          title: "อัปเดตและแชร์สำเร็จ!",
          message: `บันทึกความคืบหน้าเป็น ${updatedInfo.progress}% และแชร์รายงานเข้ากลุ่ม LINE เรียบร้อยแล้ว`
        });
      } else {
        showAppAlert({
          type: "info",
          title: "บันทึกข้อมูลสำเร็จ!",
          message: `บันทึกความคืบหน้าเป็น ${updatedInfo.progress}% และจัดเก็บรูปถ่ายเข้าสู่ระบบแล้ว\n(ยังไม่ได้แชร์เข้าห้องแชท LINE เนื่องจากยกเลิกการเลือกห้องแชท หรือเปิดผ่านเบราว์เซอร์ทั่วไป)`
        });
      }
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
    closerName: getLineUserName() || "ผู้ปฏิบัติงานหน้างาน",
    onComplete: (closedRecord) => {
      const isProblem = closedRecord.outcome === "ติดปัญหา";
      activeTasks = activeTasks.filter(a => a.id !== closedRecord.id);
      const log = dailyLogs.find(l => l.id === closedRecord.id);
      if (log) {
        log.status = isProblem ? "ติดปัญหา" : "เสร็จสิ้น";
        log.checkoutTime = closedRecord.outTime;
        log.outcome = closedRecord.outcome;
        log.note = closedRecord.note;
      }

      // Link and update the assigned task in tasksList
      if (closedRecord.taskId) {
        const linkedTask = tasksList.find(t => t.id === closedRecord.taskId);
        if (linkedTask) {
          linkedTask.status = isProblem ? "ติดปัญหา" : "เสร็จสิ้น";
          if (!isProblem) {
            linkedTask.progress = 100;
            linkedTask.latestUpdate = `ปิดงานเรียบร้อย: ${closedRecord.outcome}`;
          } else {
            linkedTask.latestUpdate = `[ติดปัญหา] ${closedRecord.note ? closedRecord.note : 'พบปัญหาหน้างาน'} (โดย ${closedRecord.closedBy || 'ช่าง'})`;
          }
          localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
          renderTasksList(tasksList);
        }
      }

      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      renderTodayLogs();
      renderActiveCheckoutList();
      showAppAlert({
        type: isProblem ? "warning" : "success",
        title: isProblem ? "บันทึกแจ้งปัญหาหน้างานสำเร็จ" : "ปิดงานสำเร็จ!",
        message: isProblem 
          ? "บันทึกสถานะติดปัญหาและส่งแจ้งเตือนเข้าห้องแชท LINE เรียบร้อยแล้ว"
          : "ปิดงานและส่งผลงานเข้าห้องแชท LINE เรียบร้อยแล้ว"
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

// Role and Team Management Bindings
window.handleRoleBadgeClick = handleRoleBadgeClick;
window.switchSimulatedRole = switchSimulatedRole;
window.toggleRoleDropdownMenu = toggleRoleDropdownMenu;
window.closeRoleDropdownMenu = closeRoleDropdownMenu;
window.closeAdminPinModal = closeAdminPinModal;
window.submitAdminPinUnlock = submitAdminPinUnlock;
window.openTeamRoleModal = openTeamRoleModal;
window.closeTeamRoleModal = closeTeamRoleModal;
window.handleChangeMemberRole = handleChangeMemberRole;
window.submitAddNewMember = submitAddNewMember;
window.setNewMemberRole = setNewMemberRole;
window.handleDeleteMember = handleDeleteMember;
window.bindCurrentLineUserToTech = bindCurrentLineUserToTech;
window.unbindTechLineUser = unbindTechLineUser;
window.openLinkLineAccountModal = openLinkLineAccountModal;
window.closeLinkLineAccountModal = closeLinkLineAccountModal;
window.selectTechToBindLine = selectTechToBindLine;

window.openAssignModal = () => {
  if (currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "ฟังก์ชันมอบหมายงานสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นครับ"
    });
    return;
  }
  openAssignModal(allTechnicians);
};
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

window.isCurrentUserAdmin = () => currentUserRole === "admin";

window.openTaskDetailModal = (taskId, initialTab = "info") => {
  openTaskDetailModal(taskId, tasksList, allTechnicians, initialTab);
  const isAdmin = currentUserRole === "admin";
  const inputs = [
    "detailTitleInput",
    "detailDescInput",
    "detailLocationInput",
    "detailCustNameInput",
    "detailCustPhoneInput",
    "detailCustAddressInput",
    "detailCustEmailInput",
    "detailCustLineInput",
    "detailCategorySelect",
    "detailLatestUpdateInput",
    "detailProgressRange"
  ];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !isAdmin;
      if (!isAdmin) {
        el.classList.add("bg-slate-100", "cursor-not-allowed", "text-slate-600");
      } else {
        el.classList.remove("bg-slate-100", "cursor-not-allowed", "text-slate-600");
      }
    }
  });

  // Dynamic Modal Header
  const titleEl = document.getElementById("taskDetailModalTitle");
  const subtitleEl = document.getElementById("taskDetailModalSubtitle");
  if (titleEl) titleEl.innerText = isAdmin ? "รายละเอียด & แก้ไขข้อมูลงาน" : "รายละเอียดงาน";
  if (subtitleEl) subtitleEl.innerText = isAdmin ? "ตรวจสอบ แก้ไขข้อมูลงาน ลูกค้า ผู้ปฏิบัติงานที่รับผิดชอบ และกำหนดส่ง" : "ตรวจสอบข้อมูลงาน ลูกค้า สถานที่หน้างาน และความคืบหน้า";

  // Lock status and priority buttons for technician
  ["กำลังทำ", "เกินกำหนด", "เสร็จสิ้น", "ติดปัญหา"].forEach(st => {
    const btn = document.getElementById(`detailStatus-${st}`);
    if (btn) {
      if (!isAdmin) {
        btn.classList.add("pointer-events-none", "opacity-80", "cursor-default");
      } else {
        btn.classList.remove("pointer-events-none", "opacity-80", "cursor-default");
      }
    }
  });
  ["ปกติ", "ด่วน", "ด่วนที่สุด"].forEach(pr => {
    const btn = document.getElementById(`detailPriority-${pr}`);
    if (btn) {
      if (!isAdmin) {
        btn.classList.add("pointer-events-none", "opacity-80", "cursor-default");
      } else {
        btn.classList.remove("pointer-events-none", "opacity-80", "cursor-default");
      }
    }
  });

  applyRolePermissionsUI(currentUserRole, currentLinkedTech);
};
window.closeTaskDetailModal = closeTaskDetailModal;
window.switchTaskDetailTab = switchTaskDetailTab;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.zoomLightbox = zoomLightbox;
window.resetLightboxZoom = resetLightboxZoom;
window.getUniquePhotosForActiveTask = getUniquePhotosForActiveTask;
window.setDetailModalStatus = setDetailModalStatus;
window.setDetailModalPriority = setDetailModalPriority;
window.updateDetailPhoneLink = updateDetailPhoneLink;
window.saveTaskDetailChanges = () => {
  if (currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "ฟังก์ชันแก้ไขข้อมูลงานสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นครับ"
    });
    return;
  }
  saveTaskDetailChanges(tasksList, () => {
    renderTasksList(tasksList);
  });
};
window.deleteCurrentDetailTask = () => {
  if (currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "ฟังก์ชันลบงานสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นครับ"
    });
    return;
  }
  deleteCurrentDetailTask(tasksList, (deletedTask) => {
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
};

window.deleteActiveCheckin = deleteActiveCheckin;
window.clearAllActiveCheckins = clearAllActiveCheckins;
window.deleteTodayLog = deleteTodayLog;
window.renderActiveTaskPhotos = renderActiveTaskPhotos;

// Lightbox callback for deleting photo
setOnDeletePhotoCallback((photoSrc, taskId) => {
  window.deletePhotoFromTask(photoSrc, taskId || selectedActiveCheckoutId);
});

window.deletePhotoFromTask = (photoSrc, activeTaskId) => {
  if (!photoSrc) return;
  showAppConfirm({
    title: "ยืนยันการลบรูปภาพ",
    message: "คุณต้องการลบรูปภาพนี้ออกจากรายการงานหรือไม่?",
    confirmText: "ลบรูปภาพ",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: async () => {
      if (typeof closeImageLightbox === "function") {
        closeImageLightbox();
      }

      const activeItem = activeTasks.find(a => a.id === activeTaskId || (a.taskId && a.taskId === activeTaskId));
      const targetTaskId = activeItem?.taskId || activeTaskId;
      const linkedTask = tasksList.find(t => (targetTaskId && t.id === targetTaskId) || t.id === activeTaskId || (activeItem && t.title === activeItem.task));

      if (activeItem && Array.isArray(activeItem.photos)) {
        activeItem.photos = activeItem.photos.filter(p => {
          const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
          return src !== photoSrc;
        });
        localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      }

      if (linkedTask) {
        if (Array.isArray(linkedTask.progressHistory)) {
          linkedTask.progressHistory.forEach(h => {
            if (Array.isArray(h.photos)) {
              h.photos = h.photos.filter(p => {
                const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
                return src !== photoSrc;
              });
            }
          });
        }
        if (linkedTask.customer && Array.isArray(linkedTask.customer.progress_history)) {
          linkedTask.customer.progress_history.forEach(h => {
            if (Array.isArray(h.photos)) {
              h.photos = h.photos.filter(p => {
                const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
                return src !== photoSrc;
              });
            }
          });
        }
        localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
      }

      if (activeItem) {
        renderActiveTaskPhotos(activeItem);
      }
      renderActiveCheckoutList();
      renderTasksList(tasksList);

      deletePhotoFromSupabaseApi(photoSrc, targetTaskId, activeItem?.id);

      showAppAlert({
        type: "success",
        title: "ลบรูปภาพสำเร็จ",
        message: "ลบรูปภาพออกจากระบบเรียบร้อยแล้ว"
      });
    }
  });
};

window.shareActiveTaskToLine = async (activeId) => {
  const item = activeTasks.find(a => a.id === activeId);
  if (!item) return;

  const linkedTask = tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);
  const uniquePhotos = getUniquePhotosForActiveTask(item);
  const techList = Array.isArray(item.techs) ? item.techs.join(", ") : (item.techs || "ผู้ปฏิบัติงานทั่วไป");
  const rawNote = linkedTask?.latestUpdate || item.note;
  const cleanNote = formatLatestNoteText(rawNote);

  let flexCard;
  if (itemProg > 0) {
    flexCard = createProgressFlexCard({
      id: item.id,
      taskId: item.taskId || item.id,
      taskTitle: item.task,
      techs: item.techs,
      progress: itemProg,
      status: item.status || "กำลังทำ",
      note: cleanNote || "อัปเดตสถานะงานปัจจุบัน",
      updateBy: getLineUserName() || techList,
      updateTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      photoCount: uniquePhotos.length,
      totalPhotos: uniquePhotos.length
    });
  } else {
    flexCard = createCheckinFlexCard({
      id: item.id,
      taskId: item.taskId || item.id,
      task: item.task,
      techs: item.techs,
      time: formatGasTime(item.time),
      coords: item.coords,
      mapUrl: item.mapUrl,
      photoCount: uniquePhotos.length
    });
  }

  const res = await triggerLiffShare(flexCard, `แชร์ข้อมูลงาน ${item.task} เข้ากลุ่ม LINE สำเร็จ!`);
  if (res && res.success) {
    showAppAlert({
      type: "success",
      title: "แชร์เข้า LINE สำเร็จ",
      message: `ส่งข้อมูลงาน ${item.task} เข้าห้องแชทเรียบร้อยแล้ว`
    });
  }
};

window.openEditTaskModal = (taskId) => openTaskDetailModal(taskId, tasksList, allTechnicians);
window.closeEditTaskModal = closeTaskDetailModal;
window.saveEditedTask = () => window.saveTaskDetailChanges();

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
        techs: task.assignee ? task.assignee.split(", ") : ["ผู้ปฏิบัติงานประจำทีม"],
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

// Global outside click for role dropdown
document.addEventListener("click", (e) => {
  const menu = document.getElementById("userRoleDropdownMenu");
  const badge = document.getElementById("userRoleBadge");
  if (menu && !menu.classList.contains("hidden")) {
    if (!menu.contains(e.target) && !badge?.contains(e.target)) {
      menu.classList.add("hidden");
    }
  }
});

// Run bootstrap when DOM is ready
document.addEventListener("DOMContentLoaded", bootstrapApp);
