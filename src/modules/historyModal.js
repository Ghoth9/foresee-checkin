/**
 * Work History Modal Module (ประวัติการปฏิบัติงานที่ทำเสร็จแล้ว)
 * Provides user work history popup, filterable by today/all,
 * and detailed popup view for completed jobs.
 */

import { state, getEffectiveOperatorName } from './state.js';
import { formatDisplayTime, formatGasTime } from '../utils/date.js';
import { showAppAlert, showAppConfirm } from '../utils/dialog.js';
import { createCheckoutFlexCard, triggerLiffShare } from '../liff/line.js';
import { matchesOperator } from './tasks.js';
import { deleteCheckinApi } from '../api/supabase.js';
import { calculateDuration } from './checkout.js';

export function matchTechName(techs, targetName) {
  if (!targetName || !techs) return false;
  const tArr = Array.isArray(techs) ? techs : [techs];
  return tArr.some(t => t && matchesOperator(t, targetName));
}

let activeHistoryFilter = "today"; // "today" | "all"
let selectedDetailLog = null;

export function getFilteredHistoryLogs() {
  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  const opName = getEffectiveOperatorName();

  let logs = state.dailyLogs || [];

  // Scoping for non-admin: show their own completed/recorded jobs
  if (!isAdmin) {
    if (opName) {
      logs = logs.filter(log => {
        if (matchTechName(log.techs, opName)) return true;
        if (matchesOperator(log.checkedInBy, opName) || 
            matchesOperator(log.closerName, opName) || 
            matchesOperator(log.closer_name, opName) || 
            matchesOperator(log.closedBy, opName) || 
            matchesOperator(log.creator, opName)) return true;
        const linkedTask = state.tasksList.find(t => (log.taskId && t.id === log.taskId) || t.id === log.id || t.title === log.task);
        if (linkedTask) {
          if (matchTechName(linkedTask.techs, opName) || matchTechName(linkedTask.assignee, opName)) return true;
        }
        return false;
      });
    } else {
      logs = [];
    }
  }

  // Filter: today vs all
  if (activeHistoryFilter === "today") {
    // Show logs from today or status Completed today
    logs = logs.filter(log => {
      if (log.date === "วันนี้" || !log.date || log.date === "-") return true;
      const todayThai = new Date().toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
      return log.date === todayThai;
    });
  }

  return logs;
}

export function updateWorkHistoryBadge() {
  const logs = getFilteredHistoryLogs();
  const headerBadge = document.getElementById("headerWorkHistoryBadge");
  const dropdownBadge = document.getElementById("dropdownHistoryBadge");
  const modalBadge = document.getElementById("workHistoryModalBadge");

  const countStr = logs.length.toString();
  if (headerBadge) headerBadge.innerText = countStr;
  if (dropdownBadge) dropdownBadge.innerText = countStr;
  if (modalBadge) modalBadge.innerText = `${logs.length} งาน`;
}

export function renderWorkHistoryList() {
  updateWorkHistoryBadge();
  const container = document.getElementById("workHistoryListContainer");
  if (!container) return;

  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));

  const logs = getFilteredHistoryLogs();

  if (logs.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 space-y-2 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl font-bold">
          📋
        </div>
        <div class="text-xs font-bold text-slate-700">
          ${activeHistoryFilter === "today" ? "ยังไม่มีงานที่บันทึกปิดงานเสร็จสิ้นในวันนี้" : "ยังไม่มีงานที่บันทึกปิดงานเสร็จสิ้น"}
        </div>
        <p class="text-[11px] text-slate-500 max-w-xs mx-auto">
          หน้านี้แสดงเฉพาะงานที่บันทึกปิดงานเสร็จสิ้นแล้ว (100% / เสร็จสิ้น)<br>
          <span class="text-blue-600 font-medium">💡 สำหรับงานที่กำลังทำอยู่ สามารถตรวจสอบและอัปเดตได้ที่แท็บ "ส่งงาน" หรือ "รายการงาน"</span>
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = logs.map(log => {
    const isDone = log.status === "เสร็จสิ้น" || log.status === "ปิดงานแล้ว";
    const techs = Array.isArray(log.techs) ? log.techs.join(", ") : (log.techs || "ผู้ปฏิบัติงาน");
    const photoCount = Array.isArray(log.photos) ? log.photos.length : 0;
    const durStr = calculateDuration(log.checkinTime || log.time, log.date, log.createdAt);

    return `
      <div onclick="window.openCompletedTaskDetailModal('${log.id}')" class="p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-1">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isDone ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}">${log.id}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}">${log.status}</span>
            ${photoCount > 0 ? `<span class="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">📸 ${photoCount} รูป</span>` : ''}
          </div>
          <div class="flex items-center space-x-1">
            <button type="button" onclick="event.stopPropagation(); window.shareCompletedLogToLine('${log.id}')" class="text-emerald-700 hover:text-white hover:bg-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-300 hover:border-emerald-600 text-[10px] font-bold flex items-center space-x-1 transition-all active:scale-95 shadow-2xs cursor-pointer select-none" title="แชร์เข้า LINE">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 2.92 1.63 5.51 4.16 7.05-.18.66-.66 2.4-0.75 2.76-.12.44.16.44.34.32.24-.16 2.84-1.92 3.99-2.7 0.73.13 1.48.21 2.26.21 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"/></svg>
              <span>แชร์</span>
            </button>
            ${isAdmin ? `
              <button type="button" onclick="event.stopPropagation(); window.deleteWorkHistoryLog('${log.id}')" class="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-lg transition-colors active:scale-95 cursor-pointer" title="ลบประวัตินี้">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            ` : ''}
          </div>
        </div>

        <div>
          <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${log.task}</h4>
          ${log.note && log.note !== '-' ? `
            <p class="text-[11px] text-slate-600 line-clamp-2 mt-0.5 font-normal">"${log.note}"</p>
          ` : ''}
        </div>

        <div class="text-[11px] text-slate-500 flex items-center justify-between pt-1.5 border-t border-slate-100 flex-wrap gap-1">
          <span class="truncate max-w-[200px]">👷 ผู้ปฏิบัติงาน: <strong class="text-slate-800">${techs}</strong></span>
          <div class="flex items-center space-x-1.5 font-mono text-[10px] text-slate-600">
            <span>⏰ ${formatDisplayTime(log.checkinTime || log.time)} น.${log.checkoutTime ? ` - ${formatDisplayTime(log.checkoutTime)} น.` : ''}</span>
            <span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-sans font-medium">⏱️ ${durStr}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function setWorkHistoryFilter(filter) {
  activeHistoryFilter = filter;
  const btnToday = document.getElementById("historyFilterBtnToday");
  const btnAll = document.getElementById("historyFilterBtnAll");

  if (btnToday && btnAll) {
    if (filter === "today") {
      btnToday.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-white text-blue-700 shadow-2xs border border-slate-200";
      btnAll.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-medium transition-all text-slate-500 hover:text-slate-800";
    } else {
      btnToday.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-medium transition-all text-slate-500 hover:text-slate-800";
      btnAll.className = "flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all bg-white text-blue-700 shadow-2xs border border-slate-200";
    }
  }

  renderWorkHistoryList();
}

export function openWorkHistoryModal() {
  const modal = document.getElementById("workHistoryModal");
  if (!modal) return;
  activeHistoryFilter = "today";
  setWorkHistoryFilter("today");
  renderWorkHistoryList();
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

export function closeWorkHistoryModal() {
  const modal = document.getElementById("workHistoryModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  }
}

export function openCompletedTaskDetailModal(logId) {
  const log = (state.dailyLogs || []).find(l => l.id === logId);
  if (!log) return;
  selectedDetailLog = log;

  const modal = document.getElementById("completedTaskDetailModal");
  if (!modal) return;

  const idEl = document.getElementById("completedModalTaskId");
  const titleEl = document.getElementById("completedModalTaskTitle");
  const statusEl = document.getElementById("completedModalTaskStatus");
  const techEl = document.getElementById("completedModalTechs");
  const timeEl = document.getElementById("completedModalTimeRange");
  const durEl = document.getElementById("completedModalDuration");
  const noteEl = document.getElementById("completedModalNote");
  const outcomeEl = document.getElementById("completedModalOutcome");
  const photosContainer = document.getElementById("completedModalPhotosContainer");
  const photosBadge = document.getElementById("completedModalPhotosBadge");

  const isDone = log.status === "เสร็จสิ้น" || log.status === "ปิดงานแล้ว";
  const techs = Array.isArray(log.techs) ? log.techs.join(", ") : (log.techs || "ผู้ปฏิบัติงาน");
  const durStr = calculateDuration(log.checkinTime || log.time, log.date, log.createdAt);

  if (idEl) idEl.innerText = log.taskId || log.id;
  if (titleEl) titleEl.innerText = log.task;
  if (statusEl) {
    statusEl.innerText = log.status;
    statusEl.className = `text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isDone ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`;
  }
  if (techEl) techEl.innerText = techs;
  if (timeEl) {
    timeEl.innerText = `${formatDisplayTime(log.checkinTime || log.time)} น.${log.checkoutTime ? ` - ${formatDisplayTime(log.checkoutTime)} น.` : ''}`;
  }
  if (durEl) durEl.innerText = durStr;
  if (outcomeEl) {
    outcomeEl.innerText = log.outcome || (isDone ? "ปฏิบัติงานเรียบร้อย" : "ติดปัญหา");
    outcomeEl.className = `font-bold text-xs ${isDone ? 'text-emerald-700' : 'text-rose-600'}`;
  }
  if (noteEl) {
    noteEl.innerText = (log.note && log.note !== "-") ? log.note : "ไม่มีหมายเหตุเพิ่มเติม";
  }

  // Render photos
  const photos = Array.isArray(log.photos) ? log.photos : [];
  if (photosBadge) photosBadge.innerText = `${photos.length} รูป`;
  if (photosContainer) {
    if (photos.length === 0) {
      photosContainer.innerHTML = `<div class="text-center py-4 text-xs text-slate-400">ไม่มีรูปภาพแนบในรายการนี้</div>`;
    } else {
      photosContainer.innerHTML = photos.map((p, idx) => {
        const src = typeof p === "string" ? p : (p.dataUrl || p.base64 || p.src || "");
        return `
          <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 cursor-pointer shadow-2xs hover:scale-105 transition-transform" onclick="window.openImageLightbox('${src.replace(/'/g, "\\'")}', '${log.task} • รูปที่ ${idx + 1}', '${log.id}')">
            <img src="${src}" class="w-full h-full object-cover" alt="รูปที่ ${idx + 1}">
          </div>
        `;
      }).join('');
    }
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

export function closeCompletedTaskDetailModal() {
  const modal = document.getElementById("completedTaskDetailModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

export async function shareCompletedLogToLine(logId) {
  const log = (state.dailyLogs || []).find(l => l.id === logId);
  if (!log) return;

  const techs = Array.isArray(log.techs) ? log.techs.join(", ") : (log.techs || "ผู้ปฏิบัติงาน");
  const durStr = calculateDuration(log.checkinTime || log.time, log.date, log.createdAt);
  const photoCount = Array.isArray(log.photos) ? log.photos.length : 0;

  const flexCard = createCheckoutFlexCard({
    id: log.id,
    task: log.task,
    techs: techs,
    inTime: log.checkinTime || log.time,
    outTime: log.checkoutTime || "-",
    duration: durStr,
    outcome: log.outcome || log.status || "เสร็จสิ้น",
    note: log.note && log.note !== "-" ? log.note : "บันทึกปิดงาน",
    photoCount: photoCount
  });

  await triggerLiffShare(flexCard, `แชร์ประวัติงาน "${log.task}" เข้า LINE สำเร็จ!`);
}

export function shareSelectedCompletedLogToLine() {
  if (selectedDetailLog) {
    shareCompletedLogToLine(selectedDetailLog.id);
  }
}

export function deleteWorkHistoryLog(logId) {
  if (state.currentUserRole !== "admin") {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบประวัติงานได้ครับ"
    });
    return;
  }

  showAppConfirm({
    title: "ยืนยันการลบประวัติ",
    message: `คุณต้องการลบประวัติงาน "${logId}" ออกจากระบบหรือไม่?`,
    confirmText: "ลบรายการ",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      state.dailyLogs = state.dailyLogs.filter(l => l.id !== logId);
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
      renderWorkHistoryList();
      closeCompletedTaskDetailModal();
      deleteCheckinApi(logId);
    }
  });
}

export function renderTodayLogs() {
  updateWorkHistoryBadge();
  renderWorkHistoryList();
}

export function deleteTodayLog(id) {
  if (state.currentUserRole !== "admin") {
    showAppAlert({ type: "warning", title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)", message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบประวัติงานได้ครับ" });
    return;
  }
  showAppConfirm({
    title: "ยืนยันการลบประวัติ", message: `คุณต้องการลบประวัติงาน "${id}" ออกจากรายการหรือไม่?`,
    confirmText: "ลบ", cancelText: "ยกเลิก", isDanger: true,
    onConfirm: () => {
      state.dailyLogs = state.dailyLogs.filter(l => l.id !== id);
      state.activeTasks = state.activeTasks.filter(a => a.id !== id);
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
      renderTodayLogs();
      if (typeof window.renderActiveCheckoutList === "function") window.renderActiveCheckoutList();
      deleteCheckinApi(id);
    }
  });
}

export function toggleTodayLogsCollapse() {
  const container = document.getElementById("todayLogsContainer");
  const chevron = document.getElementById("todayLogsToggleChevron");
  if (!container) return;
  const isHidden = container.classList.toggle("hidden");
  if (chevron) chevron.style.transform = isHidden ? "rotate(-90deg)" : "rotate(0deg)";
}

