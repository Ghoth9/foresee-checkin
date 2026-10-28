/**
 * Active Checkout Tasks List & Today Logs Module
 * Handles active tasks rendering, selection for progress/checkout,
 * horizontal drag photo gallery, and today's activity logs.
 */

import { state, getEffectiveOperatorName } from './state.js';
import { formatGasTime, formatDisplayTime } from '../utils/date.js';
import { showAppAlert, showAppConfirm, showAppPrompt } from '../utils/dialog.js';
import { deleteCheckinApi, clearAllCheckinsApi, deleteTaskActivityLogApi, submitDutyCheckoutApi } from '../api/supabase.js';
import { setUpdatePercent, setActionTab, calculateDuration, updateCheckoutSubmitButtonsState, setCheckoutOutcome } from './checkout.js';
export { setCheckoutOutcome };
import { matchesOperator } from './tasks.js';
import { showDutyCheckoutShareDialog } from './shareModal.js';
import { updateWorkHistoryBadge, renderWorkHistoryList, renderTodayLogs, deleteTodayLog, toggleTodayLogsCollapse } from './historyModal.js';
export { renderTodayLogs, deleteTodayLog, toggleTodayLogsCollapse };
import {
  getTaskMemberStatuses,
  getUniquePhotosForActiveTask,
  formatLatestNoteText,
  collectTaskActivityLogs,
  matchTechName,
  enableSmoothHorizontalDragScroll,
  renderActiveTaskPhotos
} from '../utils/taskMembers.js';

export {
  getUniquePhotosForActiveTask,
  formatLatestNoteText,
  collectTaskActivityLogs,
  getTaskMemberStatuses,
  matchTechName,
  enableSmoothHorizontalDragScroll,
  renderActiveTaskPhotos
};


let checkoutSearchQuery = "";
let checkoutStatusFilter = "all";
let checkoutTechFilter = "ทั้งหมด";

export function setCheckoutStatusFilter(status) {
  checkoutStatusFilter = status;
  ['all', 'checkin', 'assigned'].forEach(st => {
    const btn = document.getElementById(`checkoutStatusFilter-${st}`);
    if (btn) {
      if (st === status) {
        btn.className = "px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs transition-all flex items-center justify-center space-x-1 cursor-pointer";
        const badge = btn.querySelector("span:last-child");
        if (badge) badge.className = "text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700 font-mono";
      } else {
        btn.className = "px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all flex items-center justify-center space-x-1 cursor-pointer";
        const badge = btn.querySelector("span:last-child");
        if (badge) badge.className = "text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 font-mono";
      }
    }
  });
  renderActiveCheckoutList();
}

export function setCheckoutTechFilter(tech) {
  checkoutTechFilter = tech;
  renderActiveCheckoutList();
}

export function setCheckoutSearchQuery(q) {
  checkoutSearchQuery = q || "";
  const clearBtn = document.getElementById("checkoutSearchClearBtn");
  if (clearBtn) {
    if (checkoutSearchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  renderActiveCheckoutList();
}

export function clearCheckoutSearch() {
  const input = document.getElementById("checkoutSearchInput");
  if (input) input.value = "";
  setCheckoutSearchQuery("");
}

export function resetCheckoutFilters() {
  checkoutSearchQuery = "";
  checkoutStatusFilter = "all";
  checkoutTechFilter = "ทั้งหมด";
  const input = document.getElementById("checkoutSearchInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("checkoutSearchClearBtn");
  if (clearBtn) clearBtn.classList.add("hidden");
  setCheckoutStatusFilter("all");
}

export function renderCheckoutTechChips(activeList = []) {
  const container = document.getElementById("checkoutTechFilterContainer");
  if (!container) return;

  const techSet = new Set();
  (activeList || []).forEach(item => {
    if (Array.isArray(item.techs)) {
      item.techs.forEach(t => { if (t && t.trim()) techSet.add(t.trim()); });
    } else if (typeof item.techs === "string" && item.techs.trim()) {
      item.techs.split(',').forEach(t => { if (t && t.trim()) techSet.add(t.trim()); });
    }
  });

  const uniqueTechs = Array.from(techSet).sort((a, b) => a.localeCompare(b, 'th'));
  const opName = getEffectiveOperatorName();

  const chips = [
    { id: "ทั้งหมด", label: "ทั้งหมด" }
  ];
  if (opName) {
    chips.push({ id: "งานของฉัน", label: "⭐ งานของฉัน" });
  }
  uniqueTechs.forEach(t => {
    let shortName = t.replace(/K\./g, '').split('(')[0].trim();
    if (!shortName) shortName = t;
    chips.push({ id: t, label: shortName });
  });

  container.innerHTML = chips.map(c => {
    const isSelected = checkoutTechFilter === c.id;
    return `
      <button type="button" onclick="window.setCheckoutTechFilter('${c.id.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
        isSelected
          ? 'bg-blue-600 text-white font-bold shadow-2xs'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }">
        ${c.label}
      </button>
    `;
  }).join('');
}

export function renderActiveCheckoutList() {
  const container = document.getElementById("activeListContainer");
  const outcomeSection = document.getElementById("checkoutOutcomeSection");
  const clearBtn = document.getElementById("clearAllCheckinsBtn");
  if (!container) return;

  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  const opName = getEffectiveOperatorName();

function isTaskAssignedOrCreatedBy(item, targetOp) {
  if (!targetOp || !item) return false;
  if (matchTechName(item.techs, targetOp)) return true;
  if (matchesOperator(item.checkedInBy, targetOp) || matchesOperator(item.closerName, targetOp) || matchesOperator(item.closer_name, targetOp) || matchesOperator(item.creator, targetOp)) return true;
  const linked = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  if (linked) {
    if (matchTechName(linked.techs, targetOp) || matchTechName(linked.assignee, targetOp)) return true;
    const c = (linked && typeof linked.customer === 'object') ? linked.customer : {};
    if (matchesOperator(linked.assignedBy, targetOp) || matchesOperator(linked.creator, targetOp) || matchesOperator(linked.assigned_by, targetOp) || matchesOperator(c.assigned_by, targetOp) || matchesOperator(c.creator, targetOp)) return true;
  }
  return false;
}

  let displayActiveTasks = state.activeTasks;
  if (!isAdmin) {
    displayActiveTasks = opName ? state.activeTasks.filter(item => isTaskAssignedOrCreatedBy(item, opName)) : [];
  }

  // 1. Calculate status pill counts
  const countAll = displayActiveTasks.length;
  const countCheckin = displayActiveTasks.filter(item => (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00").length;
  const countAssigned = countAll - countCheckin;

  const elCountAll = document.getElementById("checkoutCountAll");
  const elCountCheckin = document.getElementById("checkoutCountCheckin");
  const elCountAssigned = document.getElementById("checkoutCountAssigned");
  if (elCountAll) elCountAll.innerText = countAll;
  if (elCountCheckin) elCountCheckin.innerText = countCheckin;
  if (elCountAssigned) elCountAssigned.innerText = countAssigned;

  // 2. Render technician filter chips
  renderCheckoutTechChips(displayActiveTasks);

  if (clearBtn) {
    if (isAdmin && displayActiveTasks.length > 1) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  // 3. Apply Status Filter
  let filteredList = displayActiveTasks;
  if (checkoutStatusFilter === "checkin") {
    filteredList = filteredList.filter(item => (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00");
  } else if (checkoutStatusFilter === "assigned") {
    filteredList = filteredList.filter(item => !((item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00"));
  }

  // 4. Apply Tech Filter
  if (checkoutTechFilter && checkoutTechFilter !== "ทั้งหมด") {
    const filterTarget = checkoutTechFilter === "งานของฉัน" ? opName : checkoutTechFilter;
    if (filterTarget) {
      filteredList = filteredList.filter(item => isTaskAssignedOrCreatedBy(item, filterTarget));
    }
  }

  // 5. Apply Search Query
  if (checkoutSearchQuery) {
    const q = checkoutSearchQuery.toLowerCase().trim();
    filteredList = filteredList.filter(item => {
      const taskMatch = (item.task || "").toLowerCase().includes(q);
      const idMatch = (item.id || "").toLowerCase().includes(q);
      const taskIdMatch = (item.taskId || "").toLowerCase().includes(q);
      const techMatch = (Array.isArray(item.techs) ? item.techs.join(" ") : String(item.techs || "")).toLowerCase().includes(q);
      const noteMatch = (item.note || "").toLowerCase().includes(q);
      const linked = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
      const custMatch = (linked?.customer?.name || "").toLowerCase().includes(q) || (linked?.customer?.address || "").toLowerCase().includes(q);
      const catMatch = (linked?.category || "").toLowerCase().includes(q);
      return taskMatch || idMatch || taskIdMatch || techMatch || noteMatch || custMatch || catMatch;
    });
  }

  // If selected task is no longer in visible list, close modal
  if (state.selectedActiveCheckoutId && !filteredList.some(a => a.id === state.selectedActiveCheckoutId)) {
    const modal = document.getElementById("checkoutOutcomeModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
    state.selectedActiveCheckoutId = null;
  }

  if (filteredList.length === 0) {
    if (displayActiveTasks.length > 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6">
          <div class="text-2xl mb-1">🔍</div>
          <div class="text-xs font-bold text-slate-700">ไม่พบงานที่ตรงกับตัวกรอง</div>
          <p class="text-[11px] text-slate-400 mt-0.5">${checkoutSearchQuery ? `ไม่พบงานที่มีคำว่า "${checkoutSearchQuery}"` : 'ลองเปลี่ยนผู้ปฏิบัติงานหรือสถานะที่เลือก'}</p>
          <button type="button" onclick="window.resetCheckoutFilters()" class="mt-2.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer">
            ✕ ล้างตัวกรองทั้งหมด
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="col-span-full text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
          ${!isAdmin && opName ? `ยังไม่มีงานที่คุณ (${opName}) เช็กอินค้างอยู่` : `ยังไม่มีงานที่เช็กอินค้างอยู่`}
        </div>
      `;
    }
    const modal = document.getElementById("checkoutOutcomeModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    }
    state.selectedActiveCheckoutId = null;
    return;
  }

  container.innerHTML = filteredList.map(item => {
    try {
      const isSelected = state.selectedActiveCheckoutId === item.id;
    const techList = Array.isArray(item.techs) ? item.techs.join(", ") : (item.techs || "ผู้ปฏิบัติงานทั่วไป");
    const displayTaskId = item.taskId || item.id;
    const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
    const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);
    const uniquePhotos = getUniquePhotosForActiveTask(item);
    const totalPhotos = uniquePhotos.length;
    const rawNote = linkedTask?.latestUpdate || item.note;
    const cleanNote = formatLatestNoteText(rawNote);
    const isRealCheckin = (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00";
    const durationStr = calculateDuration(item.time, item.date, item.createdAt);
    const isToday = !item.date || item.date === "วันนี้" || item.date === "-";
    const checkinDateLabel = (!isToday && item.date) ? `${item.date} ` : "";

    // Collect all task activity logs
    const taskActivityLogs = collectTaskActivityLogs(item, linkedTask);
    const memberStatuses = getTaskMemberStatuses(linkedTask || item, item);

    // Recent update snippet from task history
    let historySnippet = "";
    if (linkedTask && Array.isArray(linkedTask.progressHistory) && linkedTask.progressHistory.length > 0) {
      const lastHist = linkedTask.progressHistory[linkedTask.progressHistory.length - 1];
      historySnippet = `อัปเดตล่าสุด: ${lastHist.progress || itemProg}% (${lastHist.time || ''} โดย ${lastHist.by || lastHist.tech || 'ผู้ปฏิบัติงาน'})`;
      if (lastHist.note) historySnippet += ` - "${lastHist.note}"`;
    }

    return `
      <div onclick="window.openCheckoutModal('${item.id}')" class="p-3.5 sm:p-4 rounded-xl border text-xs cursor-pointer transition-all hover:border-blue-400 hover:shadow-md ${
        isSelected
          ? 'bg-blue-50/40 border-2 border-blue-600 shadow-sm ring-2 ring-blue-200'
          : 'bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs'
      }">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center space-x-2 flex-wrap gap-y-1">
            <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">${displayTaskId}</span>
            ${isRealCheckin 
              ? `<span class="text-xs text-emerald-800 font-bold font-mono">⏰ เช็กอิน: ${checkinDateLabel}${formatGasTime(item.time)} น.</span>` 
              : `<span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 flex items-center space-x-1"><span class="animate-pulse">⚠️</span><span>ยังไม่ได้เช็กอินเข้างาน</span></span>`}
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono shadow-2xs">คืบหน้า ${itemProg}%</span>
            ${totalPhotos > 0 ? `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">📸 ${totalPhotos} รูป</span>` : ''}
          </div>
          <div class="flex items-center space-x-1.5">
            <button type="button" onclick="event.stopPropagation(); window.shareActiveTaskToLine('${item.id}')" class="text-emerald-700 hover:text-white hover:bg-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-300 hover:border-emerald-600 text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer" title="แชร์ข้อมูลงานนี้เข้ากลุ่ม LINE">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 2.92 1.63 5.51 4.16 7.05-.18.66-.66 2.4-0.75 2.76-.12.44.16.44.34.32.24-.16 2.84-1.92 3.99-2.7 0.73.13 1.48.21 2.26.21 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"/></svg>
              <span>แชร์เข้า LINE</span>
            </button>
            ${state.currentUserRole === "admin" ? `
              <button type="button" onclick="event.stopPropagation(); window.deleteActiveCheckin('${item.id}')" class="text-rose-600 hover:text-white hover:bg-rose-600 px-2.5 py-1 rounded-lg border border-rose-200 hover:border-rose-600 text-xs font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer" title="ลบรายการเช็กอินนี้">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span>ลบรายการ</span>
              </button>
            ` : ''}
          </div>
        </div>
        <div class="font-bold text-sm text-slate-950 mb-1">${item.task}</div>
        
        ${cleanNote ? `
          <div class="text-[11px] text-blue-900 bg-blue-50/90 rounded-lg px-2.5 py-1.5 mt-1.5 font-medium border border-blue-200/70 flex items-start space-x-1.5">
            <span class="flex-shrink-0 text-blue-600 font-bold">📌 ล่าสุด:</span>
            <span class="truncate block flex-1 font-sans text-slate-800" title="${cleanNote}">${cleanNote}</span>
          </div>
        ` : ''}
        ${historySnippet ? `
          <div class="text-[10px] text-slate-500 mt-1 flex items-center space-x-1.5 pl-0.5">
            <span class="text-slate-400">🕒</span>
            <span class="truncate">${historySnippet}</span>
          </div>
        ` : ''}

        ${memberStatuses.length > 0 ? `
          <div class="mt-2.5 p-2.5 bg-slate-50/95 rounded-xl border border-slate-200/90 space-y-1.5">
            <div class="flex items-center justify-between flex-wrap gap-1">
              <span class="text-[11px] font-bold text-slate-800 flex items-center space-x-1">
                <span>👥 ผู้รับผิดชอบในลูปงานนี้</span>
                <span class="text-slate-400 font-normal">(${memberStatuses.length} คน)</span>
              </span>
              <span class="text-[10px] font-medium text-slate-500 font-mono">
                เข้างาน: ${memberStatuses.filter(m => m.hasCheckedIn).length}/${memberStatuses.length} • จบงาน: ${memberStatuses.filter(m => m.hasCheckedOut).length}/${memberStatuses.length}
              </span>
            </div>
            <div class="space-y-1 pt-0.5">
              ${memberStatuses.map(m => `
                <div class="flex items-center justify-between p-1.5 px-2 rounded-lg bg-white border ${
                  m.hasCheckedOut
                    ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900'
                    : (m.hasCheckedIn ? 'border-blue-200 bg-blue-50/30 text-blue-900' : 'border-amber-200 bg-amber-50/40 text-amber-900')
                } text-[11px] flex-wrap gap-1">
                  <div class="flex items-center space-x-1.5 min-w-0 flex-1 pr-1">
                    <span class="font-bold text-slate-900 truncate">${m.shortName}</span>
                    ${m.hasCheckedOut ? `
                      <span class="inline-flex items-center px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">🏁 จบหน้าที่แล้ว (${m.checkoutTime})</span>
                    ` : (m.hasCheckedIn ? `
                      <span class="inline-flex items-center px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-800 text-[10px] font-semibold border border-blue-300">🟢 เช็กอินแล้ว (${m.checkinTime})</span>
                    ` : (m.hasPausedToday ? `
                      <span class="inline-flex items-center px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">🌇 พักงานรายวัน (${m.checkoutTime})</span>
                    ` : `
                      <span class="inline-flex items-center px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-medium border border-amber-300">⏳ ยังไม่ได้เช็กอิน</span>
                    `))}
                  </div>
                  ${m.checkoutNote ? `<span class="text-[10px] text-slate-500 truncate max-w-[150px] font-sans" title="${m.checkoutNote}">"${m.checkoutNote}"</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${taskActivityLogs.length > 0 ? `
          <div class="mt-2.5 pt-2 border-t border-slate-100">
            <button type="button" onclick="event.stopPropagation(); window.toggleTaskLogs('${item.id}')" class="text-[11px] font-bold text-slate-600 hover:text-blue-600 flex items-center space-x-1.5 transition-colors cursor-pointer select-none">
              <span>📋 ดูประวัติกิจกรรม & การอัปเดต (${taskActivityLogs.length} รายการ)</span>
              <span id="logToggleIcon-${item.id}" class="text-[10px] transform transition-transform">▼</span>
            </button>
            <div id="logAccordion-${item.id}" class="hidden mt-2 space-y-1.5 bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 text-[11px] max-h-56 overflow-y-auto" style="scrollbar-width: thin;">
              ${taskActivityLogs.map((log, lIdx) => `
                <div class="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-start space-x-2">
                  <span class="text-sm flex-shrink-0 mt-0.5">
                    ${log.type === 'checkin' ? '🟢' : (log.type === 'close' ? '🏁' : (log.type === 'extend' ? '⏳' : '📊'))}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between flex-wrap gap-1">
                      <div class="flex items-center space-x-1.5 flex-wrap">
                        <strong class="text-slate-900">${log.label}</strong>
                        <span class="text-[10px] text-slate-500 font-mono">${log.date && log.date !== 'วันนี้' ? log.date + ' ' : ''}${log.time} น.</span>
                      </div>
                      <div class="flex items-center space-x-1">
                        <button type="button" onclick="event.stopPropagation(); window.shareActivityLogToLine('${item.id}', ${lIdx})" class="text-emerald-700 hover:text-white hover:bg-emerald-600 px-2 py-0.5 rounded-md border border-emerald-300 hover:border-emerald-600 text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer select-none" title="แชร์กิจกรรมนี้เข้า LINE">
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 2.92 1.63 5.51 4.16 7.05-.18.66-.66 2.4-0.75 2.76-.12.44.16.44.34.32.24-.16 2.84-1.92 3.99-2.7 0.73.13 1.48.21 2.26.21 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"/></svg>
                          <span>แชร์</span>
                        </button>
                        ${isAdmin ? `
                          <button type="button" onclick="event.stopPropagation(); window.deleteTaskActivityLog('${item.id}', ${lIdx})" class="text-rose-600 hover:text-white hover:bg-rose-600 px-2 py-0.5 rounded-md border border-rose-200 hover:border-rose-600 text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer select-none" title="ลบรายการประวัตินี้ (เฉพาะแอดมิน)">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            <span>ลบ</span>
                          </button>
                        ` : ''}
                      </div>
                    </div>
                    <div class="text-[10px] text-slate-600 mt-0.5">
                      โดย: <strong class="text-slate-800">${log.tech}</strong>
                      ${log.note && log.note !== '-' ? ` • <span class="text-slate-700">"${log.note}"</span>` : ''}
                    </div>
                    ${Array.isArray(log.photos) && log.photos.length > 0 ? `
                      <div class="flex items-center space-x-1.5 mt-1.5 overflow-x-auto py-0.5" style="scrollbar-width: thin;">
                        ${log.photos.slice(0, 4).map(p => {
                          const src = typeof p === 'string' ? p : (p.dataUrl || p.base64 || p.src || '');
                          return `<img src="${src}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 flex-shrink-0 hover:scale-105 transition-transform cursor-pointer" onclick="event.stopPropagation(); window.openImageLightbox('${src.replace(/'/g, "\\'")}', 'รูปกิจกรรม', '${item.id}')" />`;
                        }).join('')}
                        ${log.photos.length > 4 ? `<span class="text-[9px] text-slate-500 font-bold self-center">+${log.photos.length - 4}</span>` : ''}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="text-slate-600 mt-2.5 flex items-center justify-between font-medium pt-2 border-t border-slate-100 flex-wrap gap-2">
          <span>👷 ผู้ปฏิบัติงาน: <strong class="text-slate-900">${techList}</strong></span>
          <div class="flex items-center space-x-2">
            ${isRealCheckin 
              ? `<span class="text-xs text-slate-600 font-mono">⏱️ ${durationStr}</span>
                 <button type="button" onclick="event.stopPropagation(); window.openCheckoutModal('${item.id}')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer">
                   <span>📝 อัปเดต / ปิดงาน</span>
                   <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                 </button>` 
              : `<span class="text-xs text-slate-500 font-sans">📅 เริ่ม: ${item.date || 'วันนี้'}</span>
                 <button type="button" onclick="event.stopPropagation(); window.goCheckinForTask('${item.taskId || item.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer" title="สลับไปหน้าเช็กอินเพื่อบันทึกเวลาและพิกัด GPS">
                   <span>📍 เช็กอินเข้างาน</span>
                 </button>
                 <button type="button" onclick="event.stopPropagation(); window.openCheckoutModal('${item.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-300 shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer" title="อัปเดตงาน">
                   <span>📝 อัปเดต</span>
                 </button>`}
          </div>
        </div>
      </div>
    `;
    } catch (itemErr) {
      console.warn("checkout item render error:", item?.id, itemErr);
      return '';
    }
  }).join('');
}

export function deleteActiveCheckin(id) {
  if (state.currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบรายการเช็กอินได้ครับ"
    });
    return;
  }
  const item = state.activeTasks.find(a => a.id === id);
  if (!item) return;

  showAppConfirm({
    title: "ยืนยันการลบรายการเช็กอิน",
    message: `คุณต้องการลบรายการเช็กอิน "${item.id}" (${item.task}) ออกจากระบบหรือไม่?`,
    confirmText: "ลบรายการนี้",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      state.activeTasks = state.activeTasks.filter(a => a.id !== id);
      if (state.selectedActiveCheckoutId === id) {
        closeCheckoutModal();
      }
      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));

      state.dailyLogs = state.dailyLogs.filter(l => l.id !== id);
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));

      renderActiveCheckoutList();
      renderTodayLogs();

      // Sync deletion with Supabase
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
  if (state.currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถล้างรายการเช็กอินทั้งหมดได้ครับ"
    });
    return;
  }
  if (state.activeTasks.length === 0) return;

  showAppConfirm({
    title: "ยืนยันการล้างรายการเช็กอิน",
    message: `คุณต้องการล้างรายการเช็กอินที่ค้างอยู่ทั้งหมด (${state.activeTasks.length} รายการ) ออกจากระบบหรือไม่?`,
    confirmText: "ล้างทั้งหมด",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      const idsToDelete = state.activeTasks.map(a => a.id);
      state.activeTasks = [];
      closeCheckoutModal();
      localStorage.setItem("fs_active_tasks", JSON.stringify([]));

      state.dailyLogs = state.dailyLogs.filter(l => !idsToDelete.includes(l.id) || l.status === "เสร็จสิ้น");
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));

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

export function openCheckoutModal(id) {
  if (!id) return;
  state.selectedActiveCheckoutId = id;
  let item = state.activeTasks.find(a => a.id === id || a.taskId === id);
  if (!item) {
    const linked = state.tasksList.find(t => t.id === id || t.title === id || (t.customer && t.customer.checkinId === id));
    if (linked) {
      item = {
        id: linked.id,
        taskId: linked.id,
        task: linked.title || "งานที่เลือก",
        techs: Array.isArray(linked.techs) ? linked.techs : [],
        time: null,
        date: linked.startDate || "วันนี้",
        createdAt: linked.createdAt || null,
        progress: linked.progress || 0,
        photos: [],
        note: linked.latestUpdate || '',
        isCheckedIn: false,
        isSynthetic: true,
        linkedTaskObj: linked
      };
      state.activeTasks.unshift(item);
    } else {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTask = urlParams.get("task");
        if (urlTask || id) {
          item = {
            id: id,
            taskId: urlParams.get("taskId") || (id.startsWith("TASK-") ? id : ""),
            task: urlTask || (id.startsWith("TASK-") ? id : "งานที่กำลังดำเนินการ"),
            techs: urlParams.get("techs") ? urlParams.get("techs").split(",").map(t => t.trim()) : [],
            time: urlParams.get("time") || null,
            date: "วันนี้",
            createdAt: new Date().toISOString(),
            progress: 0,
            photos: [],
            note: '',
            isCheckedIn: true
          };
          state.activeTasks.unshift(item);
        }
      } catch (e) {}
    }
  }
  if (!item) return;
  state.selectedActiveCheckoutId = item.id;

  const modal = document.getElementById("checkoutOutcomeModal");
  if (!modal) return;

  const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const displayTaskId = item.taskId || item.id;
  const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);

  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));

  // Set modal header details
  const titleEl = document.getElementById("checkoutModalTaskTitle");
  const idEl = document.getElementById("checkoutModalTaskId");
  const progEl = document.getElementById("checkoutModalTaskProgress");
  const timeEl = document.getElementById("checkoutModalTaskTime");

  if (titleEl) titleEl.innerText = item.task;
  if (idEl) idEl.innerText = displayTaskId;
  if (progEl) {
    progEl.innerText = `คืบหน้า ${itemProg}%`;
    progEl.className = itemProg === 100 
      ? "text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-mono shadow-2xs" 
      : "text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono shadow-2xs";
  }
  const isRealCheckin = (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00";
  if (timeEl) {
    const checkinDateLabel = (item.date && item.date !== "วันนี้" && item.date !== "-") ? `${item.date} ` : "";
    const durStr = calculateDuration(item.time, item.date, item.createdAt);
    timeEl.innerText = isRealCheckin ? `⏰ เช็กอิน: ${checkinDateLabel}${formatGasTime(item.time)} น. (${durStr})` : `📅 เริ่ม: ${item.date || 'วันนี้'}`;
  }

  const noticeEl = document.getElementById("checkoutModalUncheckedNotice");
  const goCheckinBtn = document.getElementById("checkoutModalGoCheckinBtn");
  if (noticeEl) {
    if (!isRealCheckin) {
      noticeEl.classList.remove("hidden");
      if (goCheckinBtn) goCheckinBtn.onclick = () => window.goCheckinForTask(item.taskId || item.id);
    } else {
      noticeEl.classList.add("hidden");
    }
  }

  const currentTechEl = document.getElementById("checkoutModalCurrentTech");
  if (currentTechEl) {
    currentTechEl.innerText = getEffectiveOperatorName() || "ผู้ปฏิบัติงานหน้างาน";
  }

  // Render team member loop statuses
  const memberStatuses = getTaskMemberStatuses(linkedTask || item, item);
  const loopContainer = document.getElementById("checkoutModalMemberLoopContainer");
  const memberCountBadge = document.getElementById("checkoutModalMemberCountBadge");
  const memberSummaryBadge = document.getElementById("checkoutModalMemberSummaryBadge");
  const memberListEl = document.getElementById("checkoutModalMemberList");

  if (loopContainer && memberListEl) {
    if (memberStatuses.length > 0) {
      loopContainer.classList.remove("hidden");
      const doneCount = memberStatuses.filter(m => m.hasCheckedOut).length;
      const inCount = memberStatuses.filter(m => m.hasCheckedIn).length;
      if (memberCountBadge) memberCountBadge.innerText = `${memberStatuses.length} คน`;
      if (memberSummaryBadge) memberSummaryBadge.innerText = `เช็กอิน: ${inCount}/${memberStatuses.length} • จบหน้าที่: ${doneCount}/${memberStatuses.length}`;

      const opName = getEffectiveOperatorName();
      memberListEl.innerHTML = memberStatuses.map(m => {
        const isMe = matchesOperator(m.fullName, opName) || matchesOperator(m.shortName, opName);
        return `
          <div class="flex items-center justify-between p-2 rounded-xl bg-white border ${
            m.hasCheckedOut 
              ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900' 
              : (m.hasCheckedIn ? 'border-blue-200 bg-blue-50/30 text-blue-900' : 'border-amber-200 bg-amber-50/40 text-amber-900')
          } text-xs flex-wrap gap-2">
            <div class="flex items-center space-x-2 min-w-0 flex-1">
              <span class="w-6 h-6 rounded-full ${m.hasCheckedOut ? 'bg-emerald-100 text-emerald-800' : (m.hasCheckedIn ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')} flex items-center justify-center text-xs font-bold flex-shrink-0">
                ${m.hasCheckedOut ? '🏁' : (m.hasCheckedIn ? '🟢' : (m.hasPausedToday ? '🌇' : '⏳'))}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-slate-900 truncate flex items-center space-x-1">
                  <span>${m.fullName}</span>
                  ${isMe ? `<span class="text-[9px] bg-slate-900 text-white font-semibold px-1.5 py-0.2 rounded-full">คุณ</span>` : ''}
                </div>
                <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 flex-wrap">
                  ${m.hasCheckedIn ? `<span class="text-blue-700 font-medium">เข้า: ${m.checkinTime}</span>` : (m.hasPausedToday ? `<span class="text-amber-700 font-bold">🌇 พักงานรายวัน (${m.checkoutTime})</span>` : `<span class="text-amber-700 font-medium font-semibold">⚠️ ยังไม่ได้เช็กอินเข้างาน</span>`)}
                  ${m.hasCheckedOut ? `<span>•</span><span class="text-emerald-700 font-bold">จบหน้าที่: ${m.checkoutTime}</span>` : ''}
                  ${m.durationLabel ? `<span>•</span><span class="text-emerald-800 font-bold bg-emerald-100/90 px-1.5 py-0.2 rounded font-mono">⏱️ ${m.durationLabel}</span>` : ''}
                </div>
                ${m.checkoutNote ? `<div class="text-[10px] text-slate-600 italic mt-0.5 font-sans">"${m.checkoutNote}"</div>` : ''}
              </div>
            </div>
            ${m.hasCheckedOut ? `
              <div class="flex items-center space-x-1.5 flex-shrink-0">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">✓ เช็กเอาต์แล้ว</span>
                ${isMe ? `
                  <button type="button" onclick="event.stopPropagation(); window.goCheckinForTask('${item.taskId || item.id}')" class="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] border border-blue-300 shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer" title="แตะเพื่อเช็กอินรอบใหม่ในวันถัดไปหรือเริ่มกะใหม่">
                    <span>📍 เช็กอินรอบใหม่</span>
                  </button>
                ` : ''}
              </div>
            ` : (isMe ? (m.hasCheckedIn ? `
              <button type="button" onclick="event.stopPropagation(); window.promptIndividualDutyCheckout('${item.id}', '${m.fullName.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer flex-shrink-0" title="บันทึกเช็กเอาต์จบงานหน้าที่ของคุณ">
                <span>🏁 เช็กเอาต์จบหน้าที่</span>
              </button>
            ` : `
              <button type="button" onclick="event.stopPropagation(); window.goCheckinForTask('${item.taskId || item.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer flex-shrink-0" title="${m.hasPausedToday ? 'แตะเพื่อเช็กอินทำต่อในวันใหม่' : 'คุณยังไม่ได้เช็กอินเข้างาน แตะเพื่อไปเช็กอิน'}">
                <span>${m.hasPausedToday ? '▶️ เช็กอินทำต่อ' : '📍 ไปเช็กอินก่อน'}</span>
              </button>
            `) : (m.hasCheckedIn ? `
              <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span>กำลังปฏิบัติงาน</span>
              </span>
            ` : `
              <span class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                ${m.hasPausedToday ? '🌇 พักงานรายวัน' : '⏳ รอเช็กอิน'}
              </span>
            `))}
          </div>
        `;
      }).join('');
    } else {
      loopContainer.classList.add("hidden");
    }
  }

  // Render modal activity logs
  const activityLogs = collectTaskActivityLogs(item, linkedTask);
  const badgeEl = document.getElementById("checkoutModalActivityBadge");
  const listEl = document.getElementById("checkoutModalActivityList");
  if (badgeEl) badgeEl.innerText = `${activityLogs.length} รายการ`;
  if (listEl) {
    if (activityLogs.length === 0) {
      listEl.innerHTML = `<div class="text-center py-2 text-slate-400 text-[11px]">ยังไม่มีประวัติกิจกรรม</div>`;
    } else {
      listEl.innerHTML = activityLogs.map((log, lIdx) => `
        <div class="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-start space-x-2 text-[11px]">
          <span class="text-sm flex-shrink-0 mt-0.5">
            ${log.type === 'checkin' ? '🟢' : (log.type === 'close' ? '🏁' : (log.type === 'extend' ? '⏳' : '📊'))}
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between flex-wrap gap-1">
              <div class="flex items-center space-x-1.5 flex-wrap">
                <strong class="text-slate-900">${log.label}</strong>
                <span class="text-[10px] text-slate-500 font-mono">${log.date && log.date !== 'วันนี้' ? log.date + ' ' : ''}${log.time} น.</span>
              </div>
              <div class="flex items-center space-x-1">
                <button type="button" onclick="event.stopPropagation(); window.shareActivityLogToLine('${item.id}', ${lIdx})" class="text-emerald-700 hover:text-white hover:bg-emerald-600 px-2 py-0.5 rounded-md border border-emerald-300 hover:border-emerald-600 text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer select-none" title="แชร์กิจกรรมนี้เข้า LINE">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 2.92 1.63 5.51 4.16 7.05-.18.66-.66 2.4-0.75 2.76-.12.44.16.44.34.32.24-.16 2.84-1.92 3.99-2.7 0.73.13 1.48.21 2.26.21 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"/></svg>
                  <span>แชร์</span>
                </button>
                ${isAdmin ? `
                  <button type="button" onclick="event.stopPropagation(); window.deleteTaskActivityLog('${item.id}', ${lIdx})" class="text-rose-600 hover:text-white hover:bg-rose-600 px-2 py-0.5 rounded-md border border-rose-200 hover:border-rose-600 text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer select-none" title="ลบรายการประวัตินี้ (เฉพาะแอดมิน)">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    <span>ลบ</span>
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="text-[10px] text-slate-600 mt-0.5">
              โดย: <strong class="text-slate-800">${log.tech}</strong>
              ${log.note && log.note !== '-' ? ` • <span class="text-slate-700">"${log.note}"</span>` : ''}
            </div>
            ${Array.isArray(log.photos) && log.photos.length > 0 ? `
              <div class="flex items-center space-x-1.5 mt-1.5 overflow-x-auto py-0.5" style="scrollbar-width: thin;">
                ${log.photos.slice(0, 4).map(p => {
                  const src = typeof p === 'string' ? p : (p.dataUrl || p.base64 || p.src || '');
                  return `<img src="${src}" class="w-8 h-8 rounded-lg object-cover border border-slate-200 flex-shrink-0 hover:scale-105 transition-transform cursor-pointer" onclick="event.stopPropagation(); window.openImageLightbox('${src.replace(/'/g, "\\'")}', 'รูปกิจกรรม', '${item.id}')" />`;
                }).join('')}
                ${log.photos.length > 4 ? `<span class="text-[9px] text-slate-500 font-bold self-center">+${log.photos.length - 4}</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // Pre-fill / sync current progress in checkout module
  setActionTab("update");
  setUpdatePercent(itemProg);

  // Render existing photos of this task
  renderActiveTaskPhotos(item);

  // Update submit buttons state
  updateCheckoutSubmitButtonsState();

  // Show modal
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");

  // Re-render list to reflect selected state
  renderActiveCheckoutList();
}

export function closeCheckoutModal() {
  const modal = document.getElementById("checkoutOutcomeModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  const noticeEl = document.getElementById("checkoutModalUncheckedNotice");
  if (noticeEl) noticeEl.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  state.selectedActiveCheckoutId = null;
  renderActiveTaskPhotos(null);
}

export function selectActiveTaskForCheckout(id) {
  openCheckoutModal(id);
}

export function toggleTaskLogs(id) {
  const acc = document.getElementById(`logAccordion-${id}`);
  const icon = document.getElementById(`logToggleIcon-${id}`);
  if (acc) {
    acc.classList.toggle("hidden");
    if (icon) {
      icon.innerText = acc.classList.contains("hidden") ? "▼" : "▲";
    }
  }
}

export function toggleCheckoutModalActivityList() {
  const listEl = document.getElementById("checkoutModalActivityList");
  const btn = document.getElementById("checkoutModalActivityToggleBtn");
  if (listEl) {
    listEl.classList.toggle("hidden");
    if (btn) {
      btn.innerText = listEl.classList.contains("hidden") ? "ดูประวัติ ▼" : "ซ่อนประวัติ ▲";
    }
  }
}

export async function deleteTaskActivityLog(itemId, logIndex) {
  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  if (!isAdmin) {
    showAppAlert({ type: "warning", title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)", message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบรายการประวัติกิจกรรมได้ครับ" });
    return;
  }
  const item = state.activeTasks.find(a => a.id === itemId || a.taskId === itemId);
  if (!item) return;
  const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const logs = collectTaskActivityLogs(item, linkedTask);
  const targetLog = logs[logIndex];
  if (!targetLog) return;

  showAppConfirm({
    title: "ยืนยันการลบประวัติรายการนี้?",
    message: `ต้องการลบรายการ "${targetLog.label}" (${targetLog.time || ''} น.) ออกจากประวัติงานใช่หรือไม่?`,
    confirmText: "ลบรายการ", cancelText: "ยกเลิก", isDanger: true,
    onConfirm: async () => {
      try {
        await deleteTaskActivityLogApi({
          taskId: linkedTask?.id || item.taskId,
          logId: targetLog.id,
          logTime: targetLog.time,
          logType: targetLog.type,
          logTech: targetLog.tech
        });
        if (Array.isArray(item.checkinSessions)) {
          item.checkinSessions = item.checkinSessions.filter(cs => cs.id !== targetLog.id && !(cs.time === targetLog.time && cs.date === targetLog.date));
        }
        if (linkedTask) {
          const cust = (linkedTask && typeof linkedTask.customer === 'object') ? linkedTask.customer : {};
          if (Array.isArray(cust.progress_history)) {
            cust.progress_history = cust.progress_history.filter(h => {
              if (targetLog.id && h.id && h.id === targetLog.id) return false;
              return !(h.time === targetLog.time && h.type === targetLog.type);
            });
            linkedTask.progressHistory = cust.progress_history;
            const remaining = cust.progress_history;
            const lastUpdate = remaining.length > 0 ? remaining[remaining.length - 1] : null;
            linkedTask.progress = lastUpdate && lastUpdate.progress !== undefined ? Number(lastUpdate.progress) : 0;
            linkedTask.latestUpdate = lastUpdate ? `${lastUpdate.label || ''} โดย ${lastUpdate.tech || lastUpdate.by || ''}` : '';
            item.progress = linkedTask.progress;
          }
        }
        localStorage.setItem("fs_tasks", JSON.stringify(state.tasksList));
        localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
        showAppAlert({ type: "success", title: "ลบสำเร็จ", message: "ลบรายการประวัติเรียบร้อยแล้ว" });
        openCheckoutModal(item.id);
        renderActiveCheckoutList();
        if (typeof window.renderTasksListScoped === "function") window.renderTasksListScoped();
      } catch (err) {
        console.error("deleteTaskActivityLog error:", err);
        showAppAlert({ type: "error", title: "เกิดข้อผิดพลาด", message: "ไม่สามารถลบรายการได้: " + (err.message || err) });
      }
    }
  });
}

export function promptIndividualDutyCheckout(itemId, techName) {
  const targetTech = techName || getEffectiveOperatorName() || "ผู้ปฏิบัติงาน";
  const shortName = targetTech.replace(/K\./g, '').split('(')[0].trim() || targetTech;
  const opName = getEffectiveOperatorName();
  const isMe = matchesOperator(targetTech, opName) || matchesOperator(shortName, opName);
  if (!isMe) {
    showAppAlert({
      type: "warning",
      title: "ไม่สามารถกดแทนผู้อื่นได้",
      message: `คุณกำลังเข้าใช้งานในชื่อ "${opName || 'ผู้ใช้งาน'}" จึงไม่สามารถกดจบหน้าที่แทน "${shortName}" ได้ครับ สมาชิกแต่ละท่านต้องเป็นผู้กดบันทึกหน้าที่ของตนเองครับ`
    });
    return;
  }

  const item = state.activeTasks.find(a => a.id === itemId || a.taskId === itemId);
  const taskId = item ? (item.taskId || item.id) : itemId;
  const linkedTask = state.tasksList.find(t => t.id === taskId);
  const memberStatuses = getTaskMemberStatuses(linkedTask || item, item);
  const currentMember = memberStatuses.find(m => matchesOperator(m.fullName, targetTech) || matchesOperator(m.shortName, shortName));

  if (currentMember && !currentMember.hasCheckedIn) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เช็กอินเข้างาน",
      message: `${shortName} ยังไม่ได้บันทึกเวลาเช็กอินเข้างานหน้างานครับ กรุณาบันทึกเช็กอินเข้าเริ่มงานก่อนทำการเช็กเอาต์จบหน้าที่ครับ`
    });
    return;
  }

  showAppPrompt({
    title: `เช็กเอาต์จบงานเฉพาะหน้าที่: ${shortName}`,
    message: `บันทึกสรุปผลงานส่วนของ ${shortName} (เช่น ส่งคืนซัพฯ แล้ว / ประสานเอกสารแล้ว / ได้รับ CN แล้ว)\n\nเมื่อจบงานแล้ว งานจะยังเปิดให้เพื่อนร่วมงานท่านอื่นในลูปทำงานต่อจนครบ:`,
    placeholder: "พิมพ์รายละเอียดการจบหน้าที่ เช่น ส่งคืนซัพฯ เรียบร้อยแล้ว...",
    defaultValue: "ปฏิบัติหน้าที่เรียบร้อย",
    confirmText: "🏁 ยืนยันจบหน้าที่",
    cancelText: "ยกเลิก",
    onConfirm: async (noteVal) => {
      const note = (noteVal && noteVal.trim()) ? noteVal.trim() : "ปฏิบัติหน้าที่เรียบร้อย";
      try {
        const res = await submitDutyCheckoutApi({ taskId, tech: targetTech, note, photos: [] });

        const linked = state.tasksList.find(t => t.id === taskId);
        if (linked) {
          if (!linked.customer) linked.customer = {};
          if (!Array.isArray(linked.customer.progress_history)) linked.customer.progress_history = [];
          linked.customer.progress_history.push(res.historyItem);
          if (res.isAllDone) {
            linked.status = 'เสร็จสิ้น';
            linked.progress = 100;
          } else if (res.autoProgress !== undefined) {
            linked.progress = Math.max(linked.progress || 0, res.autoProgress);
          }
        }
        if (item) {
          if (res.isAllDone) {
            item.progress = 100;
            state.activeTasks = state.activeTasks.filter(a => a.id !== item.id);
          } else if (res.autoProgress !== undefined) {
            item.progress = Math.max(item.progress || 0, res.autoProgress);
          }
        }

        if (res.isAllDone) {
          closeCheckoutModal();
        } else {
          openCheckoutModal(itemId);
        }
        renderActiveCheckoutList();

        const taskTitle = item ? item.task : (linked ? linked.title : 'งาน');
        showDutyCheckoutShareDialog({ item, taskId, taskTitle, targetTech, shortName, note, res });

      } catch (err) {
        showAppAlert({ type: "error", title: "เกิดข้อผิดพลาด", message: `ไม่สามารถบันทึกจบหน้าที่ได้: ${err.message}` });
      }
    }
  });
}



if (typeof window !== "undefined") {
  window.toggleTaskLogs = toggleTaskLogs;
  window.toggleCheckoutModalActivityList = toggleCheckoutModalActivityList;
  window.deleteTaskActivityLog = deleteTaskActivityLog;
  window.promptIndividualDutyCheckout = promptIndividualDutyCheckout;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("checkoutOutcomeModal");
      if (modal && !modal.classList.contains("hidden")) closeCheckoutModal();
    }
  });
}
