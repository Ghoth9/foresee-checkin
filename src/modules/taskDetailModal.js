/**
 * Task Detail & Full Edit Modal Module (รายละเอียดและแก้ไขงาน)
 * Includes Deadline Extension Modal logic.
 */

import { formatThaiDateDisplay, getTodayYMD, getSevenDaysLaterYMD } from '../utils/date.js';
import { saveTaskApi, extendTaskDeadlineApi, deleteTaskApi } from '../api/supabase.js';
import { createExtendDeadlineFlexCard, triggerLiffShare } from '../liff/line.js';
import { showAppAlert, showAppConfirm } from '../utils/dialog.js';
import { openCustomCalendar } from '../utils/calendar.js';
import { openImageLightbox } from './taskLightbox.js';
import { getTaskTechs, getAssigneeSubmissionsStatus } from './tasks.js';
import { state, getEffectiveOperatorName } from './state.js';

let currentDetailTaskId = null;
let currentDetailStatus = "กำลังทำ";
let currentDetailPriority = "ปกติ";
let currentDetailTechs = [];
let currentDetailTab = "info";

let currentExtendingTaskId = null;

let detailTechSearchQuery = "";
let cachedDetailTechsList = [];

export function getCurrentDetailTaskId() {
  return currentDetailTaskId;
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

export function openTaskDetailModal(taskId, tasksList, allTechnicians, initialTab = "info") {
  currentDetailTaskId = taskId;
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

  // Security & Privacy Check: Admins can open any task. Non-admins cannot open tasks not assigned to them.
  const isSimTech = (state.simulatedRole === "technician") || (sessionStorage.getItem("fs_simulated_role") === "technician");
  const isActualAdmin = !isSimTech && ((state.currentUserRole === "admin") ||
    (typeof window.isCurrentUserAdmin === 'function' && window.isCurrentUserAdmin()) ||
    (state.currentLinkedTech && state.currentLinkedTech.role === "admin") ||
    (typeof window.isUserAdminActual === 'function' && window.isUserAdminActual()));

  const opName = getEffectiveOperatorName();
  const isNameAdmin = !isSimTech && (opName.includes("ใบปอ") || opName.includes("สุพิชชาญาต์") || opName.includes("nonmarn") || opName.includes("อาร์ม") || opName.includes("ชัยวัฒน์"));

  const isAdmin = isActualAdmin || isNameAdmin;

  if (!isAdmin) {
    const taskTechs = getTaskTechs(task);
    const isAssignedToMe = opName && taskTechs.includes(opName);
    const isCreatedByMe = opName && (
      task.assignedBy === opName ||
      task.creator === opName ||
      task.customer?.assigned_by === opName ||
      task.customer?.creator === opName ||
      task.updateBy === opName ||
      task.updated_by === opName
    );

    if (!isAssignedToMe && !isCreatedByMe) {
      showAppAlert({
        type: "warning",
        title: "ไม่มีสิทธิ์เข้าถึงงานนี้ (Privacy Protection)",
        message: "งานนี้ไม่ได้มอบหมายให้คุณ และคุณไม่ได้เป็นผู้มอบหมายงานนี้ครับ"
      });
      return;
    }
  }

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
  detailTechSearchQuery = "";
  const detailSearchInput = document.getElementById("detailTechSearchInput");
  if (detailSearchInput) detailSearchInput.value = "";
  const detailClearBtn = document.getElementById("detailTechSearchClearBtn");
  if (detailClearBtn) detailClearBtn.classList.add("hidden");
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

  // Collect all photos from existing progress history updates
  const existingUpdatePhotoSet = new Set();
  timelineItems.forEach(it => {
    if (Array.isArray(it.photos)) {
      it.photos.forEach(p => {
        const url = typeof p === 'string' ? p : (p.dataUrl || p.base64 || p.src || '');
        if (url) existingUpdatePhotoSet.add(url);
      });
    }
  });

  // Also include matching check-in photos if stored locally
  try {
    const rawCheckins = localStorage.getItem("fs_daily_logs");
    if (rawCheckins) {
      const parsed = JSON.parse(rawCheckins);
      const matched = parsed.filter(c => c.taskId === task.id || c.id === task.id || c.task === task.title);
      matched.forEach(c => {
        if (!timelineItems.some(it => it.id === c.id)) {
          // Filter out photos that are already in progress updates (prevents duplicate photos bug)
          const genuineCheckinPhotos = Array.isArray(c.photos) 
            ? c.photos.filter(p => {
                const url = typeof p === 'string' ? p : (p.dataUrl || p.base64 || p.src || '');
                return url && !existingUpdatePhotoSet.has(url);
              })
            : [];

          timelineItems.unshift({
            id: c.id,
            time: c.checkinTime || "09:00",
            date: c.date || "วันนี้",
            progress: 0,
            status: c.status || "กำลังทำ",
            note: c.note || `เช็กอินเข้าปฏิบัติงานเวลา ${c.checkinTime || '09:00'} น.`,
            tech: Array.isArray(c.techs) ? c.techs.join(", ") : (c.tech || "ผู้ปฏิบัติงานหน้างาน"),
            photos: genuineCheckinPhotos,
            isCheckin: true
          });
        }
      });
    }
  } catch (e) {}

  // Total photos count across all timeline updates
  const totalPhotos = timelineItems.reduce((acc, it) => acc + (Array.isArray(it.photos) ? it.photos.length : 0), 0);
  const photoBadge = document.getElementById("detailTimelinePhotoCountBadge");
  const totalBadge = document.getElementById("detailTimelineTotalBadge");
  if (photoBadge) photoBadge.innerText = totalPhotos;
  if (totalBadge) totalBadge.innerText = `${totalPhotos} ภาพ`;

  const timelineContainer = document.getElementById("detailTimelineContainer");
  if (timelineContainer) {
    const assigneeStatuses = getAssigneeSubmissionsStatus(task);
    const summaryCardHtml = `
      <div class="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <div class="flex items-center justify-between text-xs font-bold text-slate-800">
          <span class="flex items-center space-x-1">
            <span>👥 สรุปสถานะการส่งงานรายบุคคล (${assigneeStatuses.length} คน):</span>
          </span>
          <span class="text-[11px] text-slate-500 font-normal">แสดงตามเวลาที่ส่งงานจริง</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          ${assigneeStatuses.map(s => `
            <div class="p-2 rounded-lg border text-xs flex items-center justify-between ${s.badgeClass}">
              <div class="flex items-center space-x-1.5 truncate mr-2">
                <span>${s.submitted ? (s.isClosed ? '🏁' : '📊') : '⏳'}</span>
                <span class="font-bold truncate">${s.techName}</span>
              </div>
              <span class="font-mono text-[11px] flex-shrink-0">${s.submitted ? `${s.status} (${s.time ? `${s.time} น.` : ''})` : 'ยังไม่ส่งงาน'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    if (timelineItems.length === 0) {
      timelineContainer.innerHTML = summaryCardHtml + `
        <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
          <div class="text-3xl mb-2">📸</div>
          <div class="text-sm font-bold text-slate-800">ยังไม่มีบันทึกภาพถ่ายผลงาน</div>
          <p class="text-xs text-slate-500 mt-1">รูปถ่ายความคืบหน้าจะแสดงที่นี่เมื่อผู้ปฏิบัติงานเช็กอินหรืออัปเดตงานระหว่างวัน</p>
        </div>
      `;
    } else {
      timelineContainer.innerHTML = summaryCardHtml + timelineItems.map((item, idx) => {
        const isDone = item.status === "เสร็จสิ้น" || item.progress === 100;
        const bulletColor = isDone ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-blue-600 ring-4 ring-blue-100";
        const hasPhotos = Array.isArray(item.photos) && item.photos.length > 0;

        let photosHtml = "";
        if (hasPhotos) {
          photosHtml = `
            <div class="pt-2">
              <div class="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
                <span>📸 รูปถ่ายผลงาน (${item.photos.length} รูป):</span>
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
                  <span class="text-xs font-bold text-slate-900">${item.isCheckin ? '📍 เช็กอินเริ่มปฏิบัติงาน' : `📊 คืบหน้า ${item.progress}%`}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
                    ${item.status}
                  </span>
                </div>
                <span class="text-[11px] font-mono text-slate-500 font-semibold">${item.date ? item.date + ' • ' : ''}${item.time || ''} น.</span>
              </div>
              ${item.note && item.note !== '-' ? `<p class="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">${item.note}</p>` : ''}
              <div class="text-[11px] text-slate-500">
                ผู้ปฏิบัติงาน: <strong class="text-slate-800">${item.tech || 'ผู้ปฏิบัติงานประจำทีม'}</strong>
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
    { key: "เสร็จสิ้น", activeClass: "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs" },
    { key: "ติดปัญหา", activeClass: "bg-rose-600 text-white border-rose-600 font-bold shadow-xs" }
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

export function filterDetailTechChips(query) {
  detailTechSearchQuery = (query || "").trim().toLowerCase();
  const clearBtn = document.getElementById("detailTechSearchClearBtn");
  if (clearBtn) {
    if (detailTechSearchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  renderDetailTechChips(cachedDetailTechsList);
}
window.filterDetailTechChips = filterDetailTechChips;

export function clearDetailTechSearch() {
  const input = document.getElementById("detailTechSearchInput");
  if (input) input.value = "";
  filterDetailTechChips("");
}
window.clearDetailTechSearch = clearDetailTechSearch;

export function renderDetailTechChips(allTechnicians) {
  const container = document.getElementById("detailTechChipsContainer");
  const countBadge = document.getElementById("detailTechSelectedCount");
  if (!container) return;

  if (allTechnicians && allTechnicians.length > 0) {
    cachedDetailTechsList = allTechnicians;
  }
  const sourceList = cachedDetailTechsList.length > 0 ? cachedDetailTechsList : (allTechnicians || []);

  if (countBadge) {
    if (currentDetailTechs.length > 0) {
      countBadge.innerText = `เลือกแล้ว ${currentDetailTechs.length} คน`;
      countBadge.classList.remove("hidden");
    } else {
      countBadge.classList.add("hidden");
    }
  }

  container.innerHTML = "";

  let displayList = sourceList;
  if (detailTechSearchQuery) {
    displayList = displayList.filter(t => t && t.toLowerCase().includes(detailTechSearchQuery));
  }

  // Smart sort: Put selected at top, then Thai alphabetical
  displayList = [...displayList].sort((a, b) => {
    const aSel = currentDetailTechs.includes(a);
    const bSel = currentDetailTechs.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return a.localeCompare(b, 'th');
  });

  if (displayList.length === 0) {
    container.innerHTML = `
      <div class="w-full text-center py-3 text-xs text-slate-400">
        ไม่พบชื่อที่ตรงกับ "${detailTechSearchQuery}"
      </div>
    `;
    return;
  }

  displayList.forEach(tName => {
    const isSelected = currentDetailTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
      isSelected
        ? "bg-slate-900 text-white font-bold shadow-xs ring-1 ring-slate-800"
        : "bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-2xs"
    }`;
    btn.innerHTML = `${isSelected ? '<span>✓</span>' : ''}<span>${tName}</span>`;
    btn.onclick = () => {
      if (currentDetailTechs.includes(tName)) {
        if (currentDetailTechs.length > 1) {
          currentDetailTechs = currentDetailTechs.filter(t => t !== tName);
        } else {
          showAppAlert({
            type: "warning",
            title: "ไม่สามารถลบได้",
            message: "ต้องมีผู้ปฏิบัติงานที่รับผิดชอบงานอย่างน้อย 1 คน"
          });
        }
      } else {
        currentDetailTechs.push(tName);
      }
      renderDetailTechChips(sourceList);
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
  task.updateBy = currentLineUserName || "ผู้ปฏิบัติงานหน้างาน";
  task.updateTime = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  closeExtendModal();

  // Sync to Sheet
  extendTaskDeadlineApi({
    taskId: task.id,
    taskTitle: task.title,
    newDeadline: newDeadline,
    oldDeadline: oldDeadline,
    reason: reason,
    updateBy: currentLineUserName || "ผู้ปฏิบัติงานหน้างาน"
  });

  // Client Requirement: Always alert LINE group / supervisor when extending deadline
  const flexCard = createExtendDeadlineFlexCard({
    taskId: task.id,
    taskTitle: task.title,
    techs: task.techs,
    oldDeadline: oldDeadline,
    newDeadline: newDeadline,
    reason: reason,
    requestBy: currentLineUserName || "ผู้ปฏิบัติงานหน้างาน"
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
