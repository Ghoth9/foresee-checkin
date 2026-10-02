/**
 * Main Application Entry Point
 * Foresee Technology CCTV Service
 */

import './style.css';
import { initLiff, isLineLoggedIn, getLineUserName, loginLine, logoutLine } from './liff/line.js';
import { requestLocation, getCurrentCoords } from './utils/gps.js';
import { fetchInitialData, addNewTechnicianApi, deleteCheckinApi, deleteTaskApi } from './api/gas.js';
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
  openExtendModal,
  closeExtendModal,
  submitExtendDeadline
} from './modules/tasks.js';
import {
  openProgressModal,
  closeProgressModal,
  setProgressPercent,
  setProgressStatus,
  submitProgressUpdate
} from './modules/progress.js';
import { formatDisplayTime, formatGasTime, formatGasDate } from './utils/date.js';

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
        btn.className = "py-2 px-2.5 rounded-lg border text-xs font-bold text-center transition-all bg-blue-50 border-blue-400 text-blue-800 shadow-2xs";
      } else {
        btn.className = "py-2 px-2.5 rounded-lg border text-xs font-medium text-center transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
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
  if (!container) return;

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
          <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">${displayTaskId}</span>
          <span class="text-xs text-emerald-800 font-bold font-mono">⏰ เข้างาน: ${formatGasTime(item.time)} น.</span>
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

export function selectActiveTaskForCheckout(id) {
  selectedActiveCheckoutId = id;
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
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}">${log.status}</span>
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

// -------------------------------------------------------------
// INITIAL SYNC & BOOTSTRAP
// -------------------------------------------------------------
async function bootstrapApp() {
  // 1. LIFF Init
  await initLiff();
  updateLineStatusUI();

  // 2. GPS Request
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

  // 3. Sync initial data from Google Sheet
  const gasData = await fetchInitialData();
  if (gasData) {
    if (gasData.technicians && gasData.technicians.length > 0) {
      allTechnicians = Array.from(new Set([...allTechnicians, ...gasData.technicians]));
      localStorage.setItem("fs_technicians", JSON.stringify(allTechnicians));
    }
    if (gasData.tasks && Array.isArray(gasData.tasks)) {
      tasksList = gasData.tasks;
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
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
    }
  }

  // 4. Handle Deep Linking via URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get("tab") || "checkin";
  const targetTaskId = urlParams.get("taskId");
  const targetAction = urlParams.get("action");

  switchTab(targetTab);

  if (targetTab === "tasks" && targetAction === "update" && targetTaskId) {
    const task = tasksList.find(t => t.id === targetTaskId);
    if (task) openProgressModal(task);
  } else if (targetTab === "checkout" && urlParams.get("id")) {
    const id = urlParams.get("id");
    const existing = activeTasks.find(a => a.id === id);
    if (!existing) {
      activeTasks.unshift({
        id: id,
        task: urlParams.get("task") || "งานหน้างาน",
        techs: (urlParams.get("techs") || "").split(","),
        time: urlParams.get("time") || "09:00"
      });
    }
    selectActiveTaskForCheckout(id);
  }

  renderTodayLogs();
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
      alert("เช็กอินเรียบร้อยและบันทึกเวลาแล้ว!");
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
      }
      const log = dailyLogs.find(l => l.id === updatedInfo.id);
      if (log) {
        log.status = updatedInfo.status;
        log.latestUpdate = updatedInfo.latestUpdate;
      }
      localStorage.setItem("fs_active_tasks", JSON.stringify(activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(dailyLogs));
      renderTodayLogs();
      renderActiveCheckoutList();
      alert("อัปเดตความคืบหน้างานเข้า LINE เรียบร้อยแล้ว!");
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
      alert("ปิดงานและส่งผลงานเรียบร้อยแล้ว!");
    }
  });
};

window.setTaskViewMode = (mode) => setTaskViewMode(mode, tasksList);
window.setStatusFilter = (st) => setStatusFilter(st, tasksList);
window.setTaskTechFilter = (tech) => setTechFilter(tech, tasksList, allTechnicians);
window.handleTaskSearch = (query) => {
  renderTasksList(tasksList);
};

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
    alert("มอบหมายงานใหม่สำเร็จ!");
  }
});

window.openEditTaskModal = (taskId) => openEditTaskModal(taskId, tasksList, allTechnicians);
window.closeEditTaskModal = closeEditTaskModal;
window.setEditModalStatus = setEditModalStatus;
window.saveEditedTask = () => saveEditedTask(tasksList, () => renderTasksList(tasksList));

window.openExtendModal = (taskId) => openExtendModal(taskId, tasksList);
window.closeExtendModal = closeExtendModal;
window.submitExtendDeadline = () => submitExtendDeadline(tasksList, getLineUserName(), () => renderTasksList(tasksList));

window.openProgressModalForTask = (taskId) => {
  const task = tasksList.find(t => t.id === taskId);
  if (task) openProgressModal(task);
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
