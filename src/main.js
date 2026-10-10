/**
 * Main Application Entry Point
 * Foresee Technology CCTV & Office Workflow Management System
 */

import './style.css';
import { state, getEffectiveOperator, getEffectiveOperatorName } from './modules/state.js';
import { initLiff, isLineLoggedIn, getLineUserName, getLineUserProfile, loginLine, logoutLine } from './liff/line.js';
import { requestLocation, getCurrentCoords } from './utils/gps.js';
import { fetchInitialData, deleteCheckinApi, deletePhotoFromSupabaseApi, subscribeToRealtimeChanges } from './api/supabase.js';
import {
  renderAssignedTasksBanner, selectAssignedTask, deselectAssignedTask, toggleCheckinFormDetails,
  handlePhotoUpload, removePhoto, submitCheckinForm, selectJobType, getSelectedJobType
} from './modules/checkin.js';
import {
  handleCheckoutPhotoUpload, removeCheckoutPhoto, submitCheckoutForm, submitProgressOnly,
  setActionTab, setUpdatePercent, setUpdateStatus
} from './modules/checkout.js';
import {
  setTaskViewMode, setStatusFilter, setTechFilter, setTaskSearchQuery, renderTechFilterChips,
  renderTasksList, openAssignModal, closeAssignModal, selectAssignPriority, selectAssignCategory,
  toggleAssignTech, renderAssignTechChips, submitAssignForm, openEditTaskModal, closeEditTaskModal,
  setEditModalStatus, saveEditedTask, openTaskDetailModal, closeTaskDetailModal, switchTaskDetailTab,
  openImageLightbox, closeImageLightbox, zoomLightbox, resetLightboxZoom, setDetailModalStatus,
  setDetailModalPriority, updateDetailPhoneLink, saveTaskDetailChanges, deleteCurrentDetailTask,
  openExtendModal, closeExtendModal, submitExtendDeadline, pickAssignDate, pickDetailDate,
  pickExtendModalDate, setOnDeletePhotoCallback, deletePhotoFromTask, deleteCurrentLightboxImage,
  clearAssignTechSearch, clearDetailTechSearch
} from './modules/tasks.js';
import {
  openProgressModal, closeProgressModal, setProgressPercent, setProgressStatus, submitProgressUpdate
} from './modules/progress.js';
import { formatGasTime, formatGasDate } from './utils/date.js';
import { showAppAlert, showAppConfirm } from './utils/dialog.js';
import {
  openCustomCalendar, closeCustomCalendar, prevCalendarMonth, nextCalendarMonth, selectTodayOnCalendar
} from './utils/calendar.js';

// Modular Subsystems
import {
  isUserAdminActual, isCurrentUserAdmin, resolveUserRole, switchSimulatedRole,
  toggleRoleDropdownMenu, closeRoleDropdownMenu, handleRoleBadgeClick, applyRolePermissionsUI,
  openAdminPinModal, closeAdminPinModal, submitAdminPinUnlock, quickUnlockNonmarnAdmin,
  openTeamRoleModal, closeTeamRoleModal, setTeamRoleFilter, renderTeamRoleList,
  setNewMemberRole, handleChangeMemberRole, submitAddNewMember, handleDeleteMember,
  bindCurrentLineUserToTech, unbindTechLineUser, openManageTechModal, closeManageTechModal,
  renderManageTechList, confirmAddTech, deleteTech, renderCheckinTechChips, setCheckinTechs,
  updateTeamRoleBanner
} from './modules/team.js';

import {
  openSelectOperatorModal, closeSelectOperatorModal, filterSelectOperatorList,
  clearSelectOperatorSearch, renderSelectOperatorList, chooseOperatorProfile
} from './modules/operator.js';

import {
  matchTechName, getUniquePhotosForActiveTask, formatLatestNoteText, renderActiveTaskPhotos,
  renderActiveCheckoutList, deleteActiveCheckin, clearAllActiveCheckins, selectActiveTaskForCheckout,
  setCheckoutOutcome, renderTodayLogs, deleteTodayLog, toggleTodayLogsCollapse
} from './modules/checkoutList.js';

import { openShareTaskLineModal, closeShareTaskLineModal, submitShareTaskChoice } from './modules/shareModal.js';

// -------------------------------------------------------------
// LOCAL STATE INITIALIZATION FROM CACHE
// -------------------------------------------------------------
let currentTab = "checkin";

try {
  const cachedTechRecords = localStorage.getItem("fs_technicians_list");
  if (cachedTechRecords) state.techniciansList = JSON.parse(cachedTechRecords);

  const cachedTechs = localStorage.getItem("fs_technicians");
  if (cachedTechs) state.allTechnicians = JSON.parse(cachedTechs);
  else state.allTechnicians = ["ช่างกนก", "ช่างมณเฑียร", "ช่างสายฟ้า", "ช่างอาร์ม", "ช่างเอก"];

  const cachedTasks = localStorage.getItem("fs_tasks");
  if (cachedTasks) state.tasksList = JSON.parse(cachedTasks);

  const cachedActives = localStorage.getItem("fs_active_tasks");
  if (cachedActives) state.activeTasks = JSON.parse(cachedActives);

  const cachedLogs = localStorage.getItem("fs_daily_logs");
  if (cachedLogs) state.dailyLogs = JSON.parse(cachedLogs);
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

    // Desktop nav button
    const deskBtn = document.getElementById(`deskTabBtn${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (deskBtn) {
      if (s === tab) {
        deskBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-white shadow-xs transition-all flex items-center space-x-1.5 whitespace-nowrap";
      } else {
        deskBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-950 transition-all flex items-center space-x-1.5 whitespace-nowrap";
      }
    }

    // Mobile nav button
    const mobBtn = document.getElementById(`tabBtn${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (mobBtn) {
      if (s === tab) {
        mobBtn.className = "py-2.5 rounded-lg transition-all bg-slate-950 text-white shadow-sm font-bold flex items-center justify-center space-x-1 whitespace-nowrap";
      } else {
        mobBtn.className = "py-2.5 rounded-lg transition-all hover:text-slate-950 flex items-center justify-center space-x-1 text-slate-600 whitespace-nowrap";
      }
    }
  });

  if (tab === "checkin") {
    renderAssignedTasksBannerScoped();
    renderCheckinTechChips();
  } else if (tab === "checkout") {
    renderActiveCheckoutList();
  } else if (tab === "tasks") {
    renderTechFilterChips(state.tasksList, state.allTechnicians);
    renderTasksListScoped();
  }
}

// -------------------------------------------------------------
// SCOPED TASK VIEWS
// -------------------------------------------------------------
export function renderTasksListScoped() {
  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  const opName = getEffectiveOperatorName();
  renderTasksList(state.tasksList, opName, isAdmin);
}
window.renderTasksListScoped = renderTasksListScoped;

export function renderAssignedTasksBannerScoped() {
  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  const opName = getEffectiveOperatorName();
  renderAssignedTasksBanner(state.tasksList, state.allTechnicians, (tId) => selectAssignedTask(tId, state.tasksList, setCheckinTechs), opName, isAdmin);
}
window.renderAssignedTasksBannerScoped = renderAssignedTasksBannerScoped;

// -------------------------------------------------------------
// LIVE REFRESH & SUPABASE SYNC
// -------------------------------------------------------------
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
      state.allTechnicians = Array.from(new Set([...state.allTechnicians, ...fresh.technicians]));
      localStorage.setItem("fs_technicians", JSON.stringify(state.allTechnicians));
      renderManageTechList();
      renderCheckinTechChips();
      renderAssignTechChips(state.allTechnicians);
    }

    if (fresh.techniciansList && Array.isArray(fresh.techniciansList)) {
      state.techniciansList = fresh.techniciansList;
      try {
        localStorage.setItem("fs_technicians_list", JSON.stringify(state.techniciansList));
      } catch (e) {}
      await resolveUserRole();
      if (!document.getElementById("teamRoleModal")?.classList.contains("hidden")) {
        renderTeamRoleList();
      }
    }

    if (fresh.tasks && Array.isArray(fresh.tasks)) {
      const serverMap = new Map(fresh.tasks.map(t => [t.id, t]));
      const recentLocal = state.tasksList.filter(t => !serverMap.has(t.id) && (Date.now() - (t.createdAt || 0) < 180000));
      state.tasksList = [...recentLocal, ...fresh.tasks];
      localStorage.setItem("fs_tasks", JSON.stringify(state.tasksList));
      renderTasksListScoped();
      renderAssignedTasksBannerScoped();
      renderTechFilterChips(state.tasksList, state.allTechnicians);
    }

    // Active Checkins + In-Progress Tasks Merge
    const checkinActives = Array.isArray(fresh.activeCheckins) ? fresh.activeCheckins.map(a => {
      const linkedT = state.tasksList.find(t => t.id === a.taskId || t.title === a.task);
      return {
        id: a.id,
        taskId: a.taskId || null,
        task: a.task,
        techs: Array.isArray(a.techs) && a.techs.length > 0 ? a.techs : (a.tech ? [a.tech] : ["ผู้ปฏิบัติงานทั่วไป"]),
        time: formatGasTime(a.time),
        date: formatGasDate(a.date),
        progress: a.progress !== undefined && a.progress > 0 ? a.progress : (linkedT?.progress || 0),
        photos: a.photos || [],
        note: a.note || '',
        isCheckedIn: true,
        checkedInBy: a.checkedInBy || a.closerName || '',
        closerName: a.closerName || ''
      };
    }) : [];

    state.tasksList.forEach(t => {
      if (t.status === "กำลังทำ" && !checkinActives.some(a => a.taskId === t.id || a.id === t.id || a.task === t.title)) {
        checkinActives.push({
          id: t.id,
          taskId: t.id,
          task: t.title,
          techs: Array.isArray(t.techs) ? t.techs : (t.assignee ? t.assignee.split(", ") : ["ผู้ปฏิบัติงานประจำทีม"]),
          time: null,
          date: t.startDate || "วันนี้",
          progress: t.progress || 0,
          photos: [],
          note: t.latestUpdate || '',
          isCheckedIn: false,
          isSynthetic: true,
          linkedTaskObj: t
        });
      }
    });

    // Deduplicate activeTasks
    const uniqueActivesMap = new Map();
    checkinActives.forEach(item => {
      const key = item.taskId || item.id;
      if (!uniqueActivesMap.has(key)) {
        uniqueActivesMap.set(key, item);
      } else {
        const existing = uniqueActivesMap.get(key);
        const mergedTechs = Array.from(new Set([...(existing.techs || []), ...(item.techs || [])]));
        existing.techs = mergedTechs;
        if (item.photos && item.photos.length > 0) {
          existing.photos = Array.from(new Set([...(existing.photos || []), ...item.photos]));
        }
        if (item.isCheckedIn) {
          existing.isCheckedIn = true;
          existing.time = item.time;
        }
      }
    });

    state.activeTasks = Array.from(uniqueActivesMap.values());
    localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
    renderActiveCheckoutList();

    if (fresh.activeCheckins || fresh.closedCheckins) {
      state.dailyLogs = [...(fresh.activeCheckins || []), ...(fresh.closedCheckins || [])];
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
      renderTodayLogs();
    }

    if (state.selectedActiveCheckoutId) {
      const curActive = state.activeTasks.find(a => a.id === state.selectedActiveCheckoutId || a.taskId === state.selectedActiveCheckoutId);
      if (curActive) renderActiveTaskPhotos(curActive);
    }
  } catch (err) {
    console.warn("refreshFromSupabase error:", err);
  } finally {
    isRefreshing = false;
  }
}

export function updateLineStatusUI() {
  const dot = document.getElementById("lineLoginDot");
  const text = document.getElementById("lineLoginText");
  const banner = document.getElementById("lineNotLoggedInBanner");
  if (!dot || !text) return;

  const profile = getLineUserProfile();
  const name = getLineUserName() || profile?.displayName;
  const loggedIn = isLineLoggedIn() || !!profile || !!name;

  if (loggedIn && name) {
    dot.className = "w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0";
    const shortName = name.length > 8 ? name.slice(0, 7) + '…' : name;
    text.innerText = `LINE: ${shortName}`;
    if (banner) { banner.classList.add("hidden"); banner.classList.remove("flex"); }
  } else if (loggedIn) {
    dot.className = "w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0";
    text.innerText = "LINE เชื่อมต่อแล้ว";
    if (banner) { banner.classList.add("hidden"); banner.classList.remove("flex"); }
  } else {
    dot.className = "w-2 h-2 rounded-full bg-slate-300 flex-shrink-0";
    text.innerText = "เข้าสู่ระบบ LINE";
    if (banner) { banner.classList.remove("hidden"); banner.classList.add("flex"); }
  }
}

// -------------------------------------------------------------
// APP BOOTSTRAP
// -------------------------------------------------------------
async function bootstrapApp() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("liff.state")) {
    try {
      const rawState = decodeURIComponent(urlParams.get("liff.state"));
      const stateParams = new URLSearchParams(rawState.startsWith("?") ? rawState.slice(1) : rawState);
      stateParams.forEach((val, key) => urlParams.set(key, val));
    } catch (e) {}
  }
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
      const existing = state.activeTasks.find(a => a.id === matchId || a.taskId === matchId);
      if (existing) {
        selectActiveTaskForCheckout(existing.id);
      }
    }
  } else if (targetTab === "tasks" && targetTaskId) {
    const targetSubtab = urlParams.get("subtab");
    setTimeout(() => {
      openTaskDetailModal(targetTaskId, state.tasksList, state.allTechnicians, targetSubtab === "timeline" ? "timeline" : "info");
    }, 150);
  }

  // Clear search input
  const taskSearchInput = document.getElementById("taskSearchInput");
  if (taskSearchInput) taskSearchInput.value = "";
  setTaskSearchQuery("");
  const taskSearchClearBtn = document.getElementById("taskSearchClearBtn");
  if (taskSearchClearBtn) taskSearchClearBtn.classList.add("hidden");

  renderAssignedTasksBannerScoped();
  renderCheckinTechChips();
  renderActiveCheckoutList();
  renderTechFilterChips(state.tasksList, state.allTechnicians);
  renderTasksListScoped();
  renderTodayLogs();

  updateLineStatusUI();
  resolveUserRole();
  initLiff().then(() => {
    updateLineStatusUI();
    resolveUserRole();
  }).catch(e => {
    console.warn("LIFF init error:", e);
    updateLineStatusUI();
  });

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

  refreshFromSupabase(true);
  subscribeToRealtimeChanges({
    onTasksChange: () => refreshFromSupabase(true),
    onCheckinsChange: () => refreshFromSupabase(true),
    onTechsChange: () => refreshFromSupabase(true)
  });
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshFromSupabase(); });
  window.addEventListener('focus', () => refreshFromSupabase());
  setInterval(() => refreshFromSupabase(), 15000);
}

// -------------------------------------------------------------
// WINDOW EXPORTS FOR HTML ONCLICK & EVENT BINDINGS
// -------------------------------------------------------------
window.switchTab = switchTab;
window.handleBrandClick = () => switchTab(state.currentUserRole === "admin" ? "tasks" : "checkin");
window.selectAssignedTaskForCheckin = (taskId) => selectAssignedTask(taskId, state.tasksList, setCheckinTechs);
window.deselectAssignedTask = () => deselectAssignedTask(state.tasksList);
window.toggleCheckinFormDetails = toggleCheckinFormDetails;
window.handlePhotoUpload = handlePhotoUpload;
window.removeCheckinPhoto = removePhoto;
window.selectJobType = selectJobType;
window.submitCheckin = () => {
  const locInput = document.getElementById("fieldLocationInput");
  const noteInput = document.getElementById("fieldNoteInput");
  const customInput = document.getElementById("customJobTypeInput");

  submitCheckinForm({
    selectedTechs: state.selectedCheckinTechs,
    selectedJobType: getSelectedJobType(),
    customJobType: customInput ? customInput.value : "",
    locationText: locInput ? locInput.value : "",
    noteText: noteInput ? noteInput.value : "",
    onComplete: (record) => {
      if (record.taskId) {
        const linkedT = state.tasksList.find(t => t.id === record.taskId);
        if (linkedT && linkedT.status !== 'กำลังทำ') {
          linkedT.status = 'กำลังทำ';
          localStorage.setItem("fs_tasks", JSON.stringify(state.tasksList));
          renderTasksListScoped();
        }
      }
      state.activeTasks.unshift(record);
      state.dailyLogs.unshift({
        id: record.id,
        taskId: record.taskId || null,
        task: record.task,
        techs: record.techs,
        checkinTime: record.time,
        checkoutTime: null,
        status: "กำลังทำ",
        checkedInBy: record.checkedInBy || '',
        closerName: record.closerName || ''
      });
      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
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
  const activeItem = state.activeTasks.find(a => a.id === state.selectedActiveCheckoutId);
  const noteInput = document.getElementById("checkoutUpdateNoteInput");
  const uniquePhotos = getUniquePhotosForActiveTask(activeItem);

  submitProgressOnly({
    activeItem: activeItem,
    noteText: noteInput ? noteInput.value : "",
    closerName: getLineUserName() || "ผู้ปฏิบัติงานหน้างาน",
    totalPhotosCount: uniquePhotos.length,
    onComplete: (updatedInfo) => {
      const act = state.activeTasks.find(a => a.id === updatedInfo.id);
      if (act) {
        act.status = updatedInfo.status;
        act.progress = updatedInfo.progress;
      }
      const log = state.dailyLogs.find(l => l.id === updatedInfo.id);
      if (log) {
        log.status = updatedInfo.status;
        log.latestUpdate = updatedInfo.latestUpdate;
      }

      if (activeItem) {
        const linkedTask = state.tasksList.find(t => 
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
          localStorage.setItem("fs_tasks", JSON.stringify(state.tasksList));
          renderTasksListScoped();
        }
      }

      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
      if (noteInput) noteInput.value = "";
      renderTodayLogs();
      renderActiveCheckoutList();
      if (act) renderActiveTaskPhotos(act);

      showAppAlert({
        type: updatedInfo.lineShared ? "success" : "info",
        title: updatedInfo.lineShared ? "อัปเดตและแชร์สำเร็จ!" : "บันทึกข้อมูลสำเร็จ!",
        message: updatedInfo.lineShared 
          ? `บันทึกความคืบหน้าเป็น ${updatedInfo.progress}% และแชร์รายงานเข้ากลุ่ม LINE เรียบร้อยแล้ว`
          : `บันทึกความคืบหน้าเป็น ${updatedInfo.progress}% และจัดเก็บรูปถ่ายเข้าสู่ระบบแล้ว\n(ยังไม่ได้แชร์เข้าห้องแชท LINE เนื่องจากยกเลิกการเลือกห้องแชท หรือเปิดผ่านเบราว์เซอร์ทั่วไป)`
      });
    }
  });
};

window.handleCheckoutPhotoUpload = handleCheckoutPhotoUpload;
window.removeCheckoutPhoto = removeCheckoutPhoto;
window.selectActiveTaskForCheckout = selectActiveTaskForCheckout;
window.setCheckoutOutcome = setCheckoutOutcome;
window.submitCheckout = () => {
  const activeItem = state.activeTasks.find(a => a.id === state.selectedActiveCheckoutId);
  const noteInput = document.getElementById("checkoutNoteInput");

  submitCheckoutForm({
    activeItem: activeItem,
    selectedOutcome: state.selectedCheckoutOutcome,
    noteText: noteInput ? noteInput.value : "",
    closerName: getLineUserName() || "ผู้ปฏิบัติงานหน้างาน",
    onComplete: (closedRecord) => {
      const isProblem = closedRecord.outcome === "ติดปัญหา";
      state.activeTasks = state.activeTasks.filter(a => a.id !== closedRecord.id);
      const log = state.dailyLogs.find(l => l.id === closedRecord.id);
      if (log) {
        log.status = isProblem ? "ติดปัญหา" : "เสร็จสิ้น";
        log.checkoutTime = closedRecord.outTime;
        log.outcome = closedRecord.outcome;
        log.note = closedRecord.note;
      }

      if (closedRecord.taskId) {
        const linkedTask = state.tasksList.find(t => t.id === closedRecord.taskId);
        if (linkedTask) {
          linkedTask.status = isProblem ? "ติดปัญหา" : "เสร็จสิ้น";
          if (!isProblem) {
            linkedTask.progress = 100;
            linkedTask.latestUpdate = `ปิดงานเรียบร้อย: ${closedRecord.outcome}`;
          } else {
            linkedTask.latestUpdate = `[ติดปัญหา] ${closedRecord.note ? closedRecord.note : 'พบปัญหาหน้างาน'} (โดย ${closedRecord.closedBy || 'ผู้ปฏิบัติงาน'})`;
          }
          localStorage.setItem("fs_tasks", JSON.stringify(state.tasksList));
          renderTasksListScoped();
        }
      }

      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
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

window.setTaskViewMode = (mode) => setTaskViewMode(mode, state.tasksList);
window.setStatusFilter = (st) => setStatusFilter(st, state.tasksList);
window.setTaskTechFilter = (tech) => setTechFilter(tech, state.tasksList, state.allTechnicians);
window.handleTaskSearch = (query) => {
  setTaskSearchQuery(query);
  const clearBtn = document.getElementById("taskSearchClearBtn");
  if (clearBtn) {
    if (query && query.trim()) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  renderTasksListScoped();
};

window.clearTaskSearch = () => {
  const input = document.getElementById("taskSearchInput");
  if (input) input.value = "";
  window.handleTaskSearch("");
};

window.openManageTechModal = openManageTechModal;
window.closeManageTechModal = closeManageTechModal;
window.confirmAddTech = confirmAddTech;
window.deleteTech = deleteTech;
window.toggleTodayLogsCollapse = toggleTodayLogsCollapse;
window.refreshFromSupabase = refreshFromSupabase;
window.renderCheckinTechChips = renderCheckinTechChips;
window.resolveUserRole = resolveUserRole;

// Role and Team Management Bindings
window.applyRolePermissionsUI = applyRolePermissionsUI;
window.updateTeamRoleBanner = updateTeamRoleBanner;
window.handleRoleBadgeClick = handleRoleBadgeClick;
window.switchSimulatedRole = switchSimulatedRole;
window.toggleRoleDropdownMenu = toggleRoleDropdownMenu;
window.closeRoleDropdownMenu = closeRoleDropdownMenu;
window.openAdminPinModal = openAdminPinModal;
window.closeAdminPinModal = closeAdminPinModal;
window.submitAdminPinUnlock = submitAdminPinUnlock;
window.quickUnlockNonmarnAdmin = quickUnlockNonmarnAdmin;
window.updateLineStatusUI = updateLineStatusUI;
window.openTeamRoleModal = openTeamRoleModal;
window.closeTeamRoleModal = closeTeamRoleModal;
window.setTeamRoleFilter = setTeamRoleFilter;
window.handleChangeMemberRole = handleChangeMemberRole;
window.submitAddNewMember = submitAddNewMember;
window.setNewMemberRole = setNewMemberRole;
window.handleDeleteMember = handleDeleteMember;
window.bindCurrentLineUserToTech = bindCurrentLineUserToTech;
window.unbindTechLineUser = unbindTechLineUser;

// Select Operator Modal Bindings
window.openSelectOperatorModal = openSelectOperatorModal;
window.closeSelectOperatorModal = closeSelectOperatorModal;
window.filterSelectOperatorList = filterSelectOperatorList;
window.clearSelectOperatorSearch = clearSelectOperatorSearch;
window.renderSelectOperatorList = renderSelectOperatorList;
window.chooseOperatorProfile = chooseOperatorProfile;

// Task Assignment
window.openAssignModal = () => {
  openAssignModal(state.allTechnicians);
};
window.closeAssignModal = closeAssignModal;
window.selectAssignPriority = selectAssignPriority;
window.selectAssignCategory = selectAssignCategory;
window.toggleAssignTech = (t) => toggleAssignTech(t, state.allTechnicians);
window.clearAssignTechSearch = clearAssignTechSearch;
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
  tasksList: state.tasksList,
  onComplete: () => {
    renderTasksListScoped();
    renderAssignedTasksBannerScoped();
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

window.isCurrentUserAdmin = () => isCurrentUserAdmin();
window.isUserAdminActual = () => isUserAdminActual();

window.openTaskDetailModal = (taskId, initialTab = "info") => {
  openTaskDetailModal(taskId, state.tasksList, state.allTechnicians, initialTab);
  const isAdmin = typeof window.isCurrentUserAdmin === "function" ? window.isCurrentUserAdmin() : (state.currentUserRole === "admin");
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

  const titleEl = document.getElementById("taskDetailModalTitle");
  const subtitleEl = document.getElementById("taskDetailModalSubtitle");
  if (titleEl) titleEl.innerText = isAdmin ? "รายละเอียด & แก้ไขข้อมูลงาน" : "รายละเอียดงาน";
  if (subtitleEl) subtitleEl.innerText = isAdmin ? "ตรวจสอบ แก้ไขข้อมูลงาน ลูกค้า ผู้ปฏิบัติงานที่รับผิดชอบ และกำหนดส่ง" : "ตรวจสอบข้อมูลงาน ลูกค้า สถานที่หน้างาน และความคืบหน้า";

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

  applyRolePermissionsUI(state.currentUserRole, state.currentLinkedTech);
};
window.closeTaskDetailModal = closeTaskDetailModal;
window.switchTaskDetailTab = switchTaskDetailTab;
window.clearDetailTechSearch = clearDetailTechSearch;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.zoomLightbox = zoomLightbox;
window.resetLightboxZoom = resetLightboxZoom;
window.deleteCurrentLightboxImage = deleteCurrentLightboxImage;
window.getUniquePhotosForActiveTask = getUniquePhotosForActiveTask;
window.scrollActivePhotos = (delta) => {
  const grid = document.getElementById("activeTaskPhotosGrid");
  if (grid) {
    grid.scrollBy({ left: delta, behavior: "smooth" });
  }
};
window.setDetailModalStatus = setDetailModalStatus;
window.setDetailModalPriority = setDetailModalPriority;
window.updateDetailPhoneLink = updateDetailPhoneLink;
window.saveTaskDetailChanges = () => {
  if (state.currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "ฟังก์ชันแก้ไขข้อมูลงานสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นครับ"
    });
    return;
  }
  saveTaskDetailChanges(state.tasksList, () => {
    renderTasksListScoped();
  });
};
window.deleteCurrentDetailTask = () => {
  if (state.currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "ฟังก์ชันลบงานสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นครับ"
    });
    return;
  }
  deleteCurrentDetailTask(state.tasksList, (deletedTask) => {
    if (deletedTask && deletedTask.id) {
      const linkedActives = state.activeTasks.filter(a => a.taskId === deletedTask.id || a.id === deletedTask.id);
      linkedActives.forEach(a => {
        deleteCheckinApi(a.id);
      });
      state.activeTasks = state.activeTasks.filter(a => a.taskId !== deletedTask.id && a.id !== deletedTask.id);
      if (state.selectedActiveCheckoutId && (state.selectedActiveCheckoutId === deletedTask.id || linkedActives.some(m => m.id === state.selectedActiveCheckoutId))) {
        state.selectedActiveCheckoutId = null;
      }
      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
      renderActiveCheckoutList();
    }
    renderTasksListScoped();
  });
};

window.deleteActiveCheckin = deleteActiveCheckin;
window.clearAllActiveCheckins = clearAllActiveCheckins;
window.deleteTodayLog = deleteTodayLog;
window.renderActiveTaskPhotos = renderActiveTaskPhotos;
window.deletePhotoFromTask = deletePhotoFromTask;
setOnDeletePhotoCallback((photoSrc, taskId) => {
  window.deletePhotoFromTask(photoSrc, taskId || state.selectedActiveCheckoutId);
});

window.openShareTaskLineModal = openShareTaskLineModal;
window.closeShareTaskLineModal = closeShareTaskLineModal;
window.submitShareTaskChoice = submitShareTaskChoice;
window.shareActiveTaskToLine = (activeId) => openShareTaskLineModal(activeId);
window.openEditTaskModal = (taskId) => openTaskDetailModal(taskId, state.tasksList, state.allTechnicians);
window.closeEditTaskModal = closeTaskDetailModal;
window.saveEditedTask = () => window.saveTaskDetailChanges();
window.openExtendModal = (taskId) => openExtendModal(taskId, state.tasksList);
window.closeExtendModal = closeExtendModal;
window.submitExtendDeadline = () => submitExtendDeadline(state.tasksList, getLineUserName(), () => renderTasksListScoped());

window.openProgressModalForTask = (taskId) => {
  switchTab("checkout");
  setActionTab("update");
  let match = state.activeTasks.find(a => a.taskId === taskId || a.id === taskId);
  if (!match) {
    const task = state.tasksList.find(t => t.id === taskId);
    if (task) {
      match = {
        id: task.id,
        taskId: task.id,
        task: task.title,
        techs: task.assignee ? task.assignee.split(", ") : ["ผู้ปฏิบัติงานประจำทีม"],
        time: "09:00",
        date: "วันนี้"
      };
      state.activeTasks.unshift(match);
      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
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
  tasksList: state.tasksList,
  currentLineUserName: getLineUserName(),
  onComplete: () => {
    renderTasksListScoped();
    renderAssignedTasksBannerScoped();
  }
});

window.handleLineLoginToggle = async () => {
  if (isLineLoggedIn()) {
    const ok = await showAppConfirm({
      type: "info",
      title: "ออกจากระบบ LINE?",
      message: `ปัจจุบันเชื่อมต่อด้วย LINE: ${getLineUserName() || "เชื่อมต่อแล้ว"}\nคุณต้องการออกจากระบบ LINE หรือไม่?`,
      confirmText: "ออกจากระบบ",
      cancelText: "ยกเลิก"
    });
    if (ok) logoutLine();
  } else {
    await loginLine();
  }
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapApp);
} else {
  bootstrapApp();
}
