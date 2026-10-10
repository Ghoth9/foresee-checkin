/**
 * Active Checkout Tasks List & Today Logs Module
 * Handles active tasks rendering, selection for progress/checkout,
 * horizontal drag photo gallery, and today's activity logs.
 */

import { state, getEffectiveOperatorName } from './state.js';
import { formatGasTime, formatDisplayTime } from '../utils/date.js';
import { showAppAlert, showAppConfirm } from '../utils/dialog.js';
import { deleteCheckinApi, clearAllCheckinsApi } from '../api/supabase.js';
import { setUpdatePercent, calculateDuration, updateCheckoutSubmitButtonsState } from './checkout.js';
import { matchesOperator } from './tasks.js';

export function matchTechName(techs, targetName) {
  if (!targetName || !techs) return false;
  const tArr = Array.isArray(techs) ? techs : [techs];
  return tArr.some(t => {
    if (!t) return false;
    return matchesOperator(t, targetName);
  });
}

export function getUniquePhotosForActiveTask(activeItem) {
  if (!activeItem) return [];
  const linkedTask = state.tasksList.find(t => 
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
              caption: `${linkedTask.title} • ความคืบหน้า ${h.progress || 0}% (${h.time || ''} โดย ${h.by || h.tech || 'ผู้ปฏิบัติงาน'}) #${idx + 1}`
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
  let cleaned = rawText;
  if (cleaned.includes(' | ')) {
    const parts = cleaned.split(' | ').filter(Boolean);
    cleaned = parts[parts.length - 1].trim();
  }
  return cleaned
    .replace(/ติดตั้งเสร็จเรียบร้อย\s*ทดสอบภาพชัดเจนทุกจุด/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ทดสอบภาพชัดเจนทุกจุด/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ผู้ปฏิบัติงานหน้างาน/g, 'ผู้ปฏิบัติงาน')
    .trim();
}

export function enableSmoothHorizontalDragScroll(container) {
  if (!container || container._hasSmoothDrag) return;
  container._hasSmoothDrag = true;

  // 1. Mouse wheel horizontal scrolling
  container.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0 && container.scrollWidth > container.clientWidth) {
      e.preventDefault();
      container.scrollBy({ left: e.deltaY * 1.5, behavior: "auto" });
    }
  }, { passive: false });

  // 2. Drag-to-scroll with mouse
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let dragDistance = 0;

  container.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    isDown = true;
    dragDistance = 0;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  window.addEventListener("mouseup", () => {
    isDown = false;
  });

  container.addEventListener("mouseleave", () => {
    isDown = false;
  });

  container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX);
    dragDistance += Math.abs(walk);
    if (Math.abs(walk) > 3) {
      e.preventDefault();
      container.scrollLeft = scrollLeft - walk;
    }
  });

  // Suppress lightbox click if user was dragging
  container.addEventListener("click", (e) => {
    if (dragDistance > 8) {
      e.stopPropagation();
      e.preventDefault();
      dragDistance = 0;
    }
  }, true);
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
    <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 cursor-pointer shadow-2xs hover:ring-2 hover:ring-blue-500 transition-all bg-slate-100 group select-none"
         onclick="window.openImageLightbox('${p.src.replace(/'/g, "\\'")}', '${p.caption.replace(/'/g, "\\'")}', '${activeItem.id}')">
      <img src="${p.src}" class="w-full h-full object-cover pointer-events-none" alt="รูปที่ ${idx + 1}" loading="lazy" draggable="false">
      <div class="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/0 transition-colors flex items-center justify-center pointer-events-none">
        <svg class="w-4 h-4 text-white drop-shadow opacity-80 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
      </div>
      <button type="button" onclick="event.stopPropagation(); window.deletePhotoFromTask('${p.src.replace(/'/g, "\\'")}', '${activeItem.id}')" class="absolute top-1 right-1 w-5 h-5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md opacity-85 hover:opacity-100 hover:scale-110 transition-all z-10 cursor-pointer" title="ลบรูปนี้">
        ✕
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[9px] text-white text-center py-0.2 pointer-events-none">
        #${idx + 1}
      </div>
    </div>
  `).join("");

  enableSmoothHorizontalDragScroll(grid);
}

export function renderActiveCheckoutList() {
  const container = document.getElementById("activeListContainer");
  const outcomeSection = document.getElementById("checkoutOutcomeSection");
  const clearBtn = document.getElementById("clearAllCheckinsBtn");
  if (!container) return;

  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  const opName = getEffectiveOperatorName();

  let displayActiveTasks = state.activeTasks;
  if (!isAdmin) {
    if (opName) {
      displayActiveTasks = state.activeTasks.filter(item => {
        // 1. Matched in active checkin assigned techs
        if (matchTechName(item.techs, opName)) return true;
        // 2. Checked in by this user
        if (matchesOperator(item.checkedInBy, opName) || matchesOperator(item.closerName, opName) || matchesOperator(item.closer_name, opName) || matchesOperator(item.creator, opName)) return true;

        // 3. Linked task check
        const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
        if (linkedTask) {
          if (matchTechName(linkedTask.techs, opName) || matchTechName(linkedTask.assignee, opName)) return true;
          const isCreatedByMe = matchesOperator(linkedTask.assignedBy, opName) ||
            matchesOperator(linkedTask.creator, opName) ||
            matchesOperator(linkedTask.customer?.assigned_by, opName) ||
            matchesOperator(linkedTask.customer?.creator, opName) ||
            matchesOperator(linkedTask.updateBy, opName) ||
            matchesOperator(linkedTask.updated_by, opName);
          if (isCreatedByMe) return true;
        }
        return false;
      });
    } else {
      displayActiveTasks = [];
    }
  }

  if (clearBtn) {
    if (isAdmin && displayActiveTasks.length > 1) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  // If selected task is no longer in visible list, close modal
  if (state.selectedActiveCheckoutId && !displayActiveTasks.some(a => a.id === state.selectedActiveCheckoutId)) {
    closeCheckoutModal();
  }

  if (displayActiveTasks.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center">
        ${!isAdmin && opName ? `ยังไม่มีงานที่คุณ (${opName}) เช็กอินค้างอยู่` : `ยังไม่มีงานที่เช็กอินค้างอยู่`}
      </div>
    `;
    closeCheckoutModal();
    return;
  }

  container.innerHTML = displayActiveTasks.map(item => {
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
              ? `<span class="text-xs text-emerald-800 font-bold font-mono">⏰ เช็กอิน: ${formatGasTime(item.time)} น.</span>` 
              : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">📋 งานมอบหมาย (ยังไม่เช็กอิน)</span>`}
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
        <div class="text-slate-600 mt-2.5 flex items-center justify-between font-medium pt-2 border-t border-slate-100 flex-wrap gap-2">
          <span>👷 ผู้ปฏิบัติงาน: <strong class="text-slate-900">${techList}</strong></span>
          <div class="flex items-center space-x-2">
            ${isRealCheckin 
              ? `<span class="text-xs text-slate-600 font-mono">⏱️ ${calculateDuration(item.time)}</span>` 
              : `<span class="text-xs text-slate-500 font-sans">📅 เริ่ม: ${item.date || 'วันนี้'}</span>`}
            <button type="button" onclick="event.stopPropagation(); window.openCheckoutModal('${item.id}')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs flex items-center space-x-1 active:scale-95 transition-all cursor-pointer">
              <span>📝 อัปเดต / ปิดงาน</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;
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
  state.selectedActiveCheckoutId = id;
  const item = state.activeTasks.find(a => a.id === id);
  if (!item) return;

  const modal = document.getElementById("checkoutOutcomeModal");
  if (!modal) return;

  const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const displayTaskId = item.taskId || item.id;
  const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);

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
  if (timeEl) {
    const isRealCheckin = (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00";
    timeEl.innerText = isRealCheckin ? `⏰ เช็กอิน: ${formatGasTime(item.time)} น.` : `📅 เริ่ม: ${item.date || 'วันนี้'}`;
  }

  // Pre-fill / sync current progress in checkout module
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
  document.body.classList.remove("overflow-hidden");
  state.selectedActiveCheckoutId = null;
  renderActiveTaskPhotos(null);
  renderActiveCheckoutList();
}

export function selectActiveTaskForCheckout(id) {
  openCheckoutModal(id);
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("checkoutOutcomeModal");
      if (modal && !modal.classList.contains("hidden")) {
        closeCheckoutModal();
      }
    }
  });
}

export function setCheckoutOutcome(outcome) {
  state.selectedCheckoutOutcome = outcome;
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

export function renderTodayLogs() {
  const container = document.getElementById("todayLogsContainer");
  const badge = document.getElementById("todayLogsBadge");
  if (!container) return;

  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isAdmin = !isSimTech && (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));
  const opName = getEffectiveOperatorName();

  let displayLogs = state.dailyLogs;
  if (!isAdmin) {
    if (opName) {
      displayLogs = state.dailyLogs.filter(log => {
        if (matchTechName(log.techs, opName)) return true;
        if (matchesOperator(log.checkedInBy, opName) || matchesOperator(log.closerName, opName) || matchesOperator(log.closer_name, opName) || matchesOperator(log.closedBy, opName) || matchesOperator(log.creator, opName)) return true;
        const linkedTask = state.tasksList.find(t => (log.taskId && t.id === log.taskId) || t.id === log.id || t.title === log.task);
        if (linkedTask) {
          if (matchTechName(linkedTask.techs, opName) || matchTechName(linkedTask.assignee, opName)) return true;
          const isCreatedByMe = matchesOperator(linkedTask.assignedBy, opName) ||
            matchesOperator(linkedTask.creator, opName) ||
            matchesOperator(linkedTask.customer?.assigned_by, opName) ||
            matchesOperator(linkedTask.customer?.creator, opName) ||
            matchesOperator(linkedTask.updateBy, opName) ||
            matchesOperator(linkedTask.updated_by, opName);
          if (isCreatedByMe) return true;
        }
        return false;
      });
    } else {
      displayLogs = [];
    }
  }

  if (badge) badge.innerText = `${displayLogs.length} งาน`;

  if (displayLogs.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
        ${!isAdmin && opName ? `ยังไม่มีประวัติการปฏิบัติงานของ "${opName}" ในวันนี้` : `ยังไม่มีประวัติการปฏิบัติงานในวันนี้`}
      </div>
    `;
    return;
  }

  container.innerHTML = displayLogs.map(log => {
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
    message: `คุณต้องการลบประวัติงาน "${id}" ออกจากรายการหรือไม่?`,
    confirmText: "ลบ",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      state.dailyLogs = state.dailyLogs.filter(l => l.id !== id);
      state.activeTasks = state.activeTasks.filter(a => a.id !== id);
      localStorage.setItem("fs_daily_logs", JSON.stringify(state.dailyLogs));
      localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
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
