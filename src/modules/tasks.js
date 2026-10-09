/**
 * Supervisor Task Management Module (งานมอบหมาย)
 * Handles Task Lists (Table / Grid), Filters, Statuses, Multi-Assignee Tracking,
 * and re-exports submodules for Assign, Detail, and Lightbox modals.
 */

import { formatThaiDateDisplay, getDeadlineCountdownBadge, isTaskOverdue } from '../utils/date.js';
import { getRecentNewTaskIds } from './taskAssignModal.js';

// Re-export submodules for full backward compatibility
export * from './taskLightbox.js';
export * from './taskAssignModal.js';
export * from './taskDetailModal.js';

let taskViewMode = window.innerWidth >= 768 ? "list" : "grid";
let currentStatusFilter = "ทั้งหมด";
let currentTechFilter = "ทั้งหมด";
let taskSearchQuery = "";
let cachedTechnicians = [];

export function getTaskTechs(task) {
  if (Array.isArray(task.techs) && task.techs.length > 0) return task.techs;
  if (typeof task.techs === "string" && task.techs.trim()) return task.techs.split(',').map(s => s.trim());
  if (typeof task.assignee === "string" && task.assignee.trim()) return task.assignee.split(',').map(s => s.trim());
  return ["ผู้ปฏิบัติงานทั่วไป"];
}

export function getAssigneeSubmissionsStatus(task) {
  const techs = getTaskTechs(task);
  let timelineItems = [];
  if (Array.isArray(task.progressHistory) && task.progressHistory.length > 0) {
    timelineItems = [...task.progressHistory];
  } else if (task.customer && Array.isArray(task.customer.progress_history)) {
    timelineItems = [...task.customer.progress_history];
  }

  const match = (itemTech, targetTech) => {
    if (!itemTech || !targetTech) return false;
    const cleanItem = itemTech.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
    const cleanTarget = targetTech.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
    if (!cleanItem || !cleanTarget) return false;
    const targetBase = targetTech.split('(')[0].trim().toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
    const itemBase = itemTech.split('(')[0].trim().toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
    return cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem) ||
           (targetBase && cleanItem.includes(targetBase)) ||
           (itemBase && cleanTarget.includes(itemBase));
  };

  return techs.map(techName => {
    const userSubs = timelineItems.filter(it => match(it.tech, techName));
    if (userSubs.length === 0) {
      return {
        techName,
        submitted: false,
        status: "ยังไม่ส่งงาน",
        badgeClass: "bg-slate-100 text-slate-500 border-slate-200",
        label: `${techName}: ยังไม่ส่งงาน (รอดำเนินการ)`
      };
    }

    const closeSub = userSubs.find(s => s.status === "เสร็จสิ้น" || s.status === "ปิดงานแล้ว" || Number(s.progress) === 100);
    const latestSub = userSubs[userSubs.length - 1];
    const targetSub = closeSub || latestSub;
    const isClosed = !!closeSub;
    const timeStr = targetSub.time ? `${targetSub.time} น.` : '';

    return {
      techName,
      submitted: true,
      isClosed: isClosed,
      status: isClosed ? "ปิดงานแล้ว" : `คืบหน้า ${targetSub.progress}%`,
      time: targetSub.time,
      date: targetSub.date,
      note: targetSub.note,
      photoCount: Array.isArray(targetSub.photos) ? targetSub.photos.length : 0,
      badgeClass: isClosed
        ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
        : "bg-blue-50 text-blue-800 border-blue-300 font-bold",
      label: isClosed
        ? `${techName}: ปิดงานแล้ว (${timeStr} ✅)`
        : `${techName}: ส่งงานแล้ว (${targetSub.progress}% เมื่อ ${timeStr})`
    };
  });
}

export function cleanLatestText(text) {
  if (!text || text === 'ยังไม่มีอัปเดต' || text === '-') return '';
  return text
    .replace(/ติดตั้งเสร็จเรียบร้อย\s*ทดสอบภาพชัดเจนทุกจุด/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ติดตั้งเสร็จเรียบร้อย\s*ทดสอบภาพชัดเจน/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ทดสอบภาพชัดเจนทุกจุด/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ผู้ปฏิบัติงานหน้างาน/g, 'ผู้ปฏิบัติงาน')
    .trim();
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

  if (!container._hasHWheel) {
    container._hasHWheel = true;
    container.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0 && container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        container.scrollBy({ left: e.deltaY * 1.5, behavior: "auto" });
      }
    }, { passive: false });
  }
}

export function setTaskSearchQuery(q) {
  taskSearchQuery = q || "";
}

export function renderTasksList(tasksList, activeOperatorName = null, isAdmin = false) {
  const container = document.getElementById("tasksListContainer");
  if (!container) return;

  const recentNewTaskIds = getRecentNewTaskIds();

  // 1. Role-based scoping: non-admin operators only see tasks assigned to them!
  let baseTasks = tasksList;
  if (!isAdmin) {
    if (activeOperatorName) {
      baseTasks = baseTasks.filter(t => {
        const techs = getTaskTechs(t);
        return techs.includes(activeOperatorName);
      });
    } else {
      // Unauthenticated staff: MUST NOT SEE ANY TASKS!
      baseTasks = [];
      container.innerHTML = `
        <div class="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-3">
          <div class="w-14 h-14 mx-auto bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-3xl font-bold border border-amber-200">🔒</div>
          <h3 class="text-base font-bold text-slate-900">กรุณาระบุตัวตนเพื่อดูรายการงานที่ได้รับมอบหมาย</h3>
          <p class="text-xs text-slate-500 max-w-md mx-auto">เพื่อความปลอดภัยและความเป็นส่วนตัวของข้อมูลงาน พนักงานที่ยังไม่ผูก LINE จำเป็นต้องเข้าสู่ระบบหรือเลือกชื่อของตนเองก่อน จึงจะสามารถดูงานที่ได้รับมอบหมายได้ครับ</p>
          <div class="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
            <button type="button" onclick="handleLineLoginToggle()" class="px-4 py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer">
              <span>💬</span>
              <span>เข้าสู่ระบบผ่าน LINE</span>
            </button>
            <button type="button" onclick="openSelectOperatorModal()" class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer">
              <span>👤</span>
              <span>เลือกชื่อผู้ปฏิบัติงานของฉัน</span>
            </button>
          </div>
        </div>
      `;
      const elTotal = document.getElementById("statTotalTasks");
      if (elTotal) elTotal.innerText = 0;
      const elOver = document.getElementById("statOverdue");
      if (elOver) elOver.innerText = 0;
      const elProg = document.getElementById("statInProgress");
      if (elProg) elProg.innerText = 0;
      const elComp = document.getElementById("statCompleted");
      if (elComp) elComp.innerText = 0;
      const elProb = document.getElementById("statProblem");
      if (elProb) elProb.innerText = 0;
      return;
    }
  }

  const techFiltered = baseTasks.filter(t => {
    if (currentTechFilter === "ทั้งหมด") return true;
    const techs = getTaskTechs(t);
    return techs.includes(currentTechFilter);
  });

  let inprogCount = 0;
  let overdueCount = 0;
  let completedCount = 0;
  let problemCount = 0;

  techFiltered.forEach(t => {
    const isDone = t.status === "เสร็จสิ้น";
    const isProblem = t.status === "ติดปัญหา";
    const isOver = isTaskOverdue(t.deadline, isDone);
    if (isDone) completedCount++;
    else if (isProblem) problemCount++;
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
  const elProb = document.getElementById("statProblem");
  if (elProb) elProb.innerText = problemCount;

  // 2. Filter by Status & Search
  const filteredTasks = techFiltered.filter(t => {
    const isDone = t.status === "เสร็จสิ้น";
    const isProblem = t.status === "ติดปัญหา";
    const isOver = isTaskOverdue(t.deadline, isDone);

    if (currentStatusFilter === "กำลังทำ" && (isDone || isOver || isProblem)) return false;
    if (currentStatusFilter === "เกินกำหนด" && !isOver) return false;
    if (currentStatusFilter === "เสร็จสิ้น" && !isDone) return false;
    if (currentStatusFilter === "ติดปัญหา" && !isProblem) return false;

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
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">เริ่มต้นมอบหมายงานแรก โดยกดปุ่มด้านล่างเพื่อระบุไซต์งานและผู้ปฏิบัติงานที่รับผิดชอบ</p>
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
              <th class="py-3.5 px-3 w-36">ผู้ปฏิบัติงาน</th>
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
      const assigneeStatuses = getAssigneeSubmissionsStatus(task);
      const photoCount = (task.progressHistory || task.customer?.progress_history || []).reduce((acc, it) => acc + (Array.isArray(it.photos) ? it.photos.length : 0), 0);

      const isProblem = task.status === "ติดปัญหา";
      let badgeBg = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
      if (isDone) badgeBg = "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold";
      else if (isProblem) badgeBg = "bg-rose-100 text-rose-800 border-rose-300 font-bold";
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
              ${task.latestUpdate && task.latestUpdate !== 'ยังไม่มีอัปเดต' ? `<div class="text-[11px] text-blue-600 line-clamp-1 mt-0.5">💬 ${cleanLatestText(task.latestUpdate)}</div>` : ''}
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-wrap gap-1">
              ${assigneeStatuses.map(s => `
                <span class="text-[11px] px-2 py-0.5 rounded-md border ${s.badgeClass}">
                  ${s.label}
                </span>
              `).join('')}
            </div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="font-mono text-xs text-slate-800 font-semibold">${formatThaiDateDisplay(task.deadline)}</div>
            <div class="mt-0.5">${isProblem ? `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap flex-shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>⚠️ ติดปัญหา</span></span>` : getDeadlineCountdownBadge(task.deadline, isDone)}</div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="flex items-center space-x-2">
              <div class="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div class="h-1.5 ${isDone ? 'bg-emerald-500' : (isProblem ? 'bg-rose-500' : 'bg-slate-900')} rounded-full transition-all" style="width: ${task.progress || 0}%"></div>
              </div>
              <span class="font-mono text-xs font-bold text-slate-800">${task.progress || 0}%</span>
            </div>
          </td>
          <td class="py-3 px-3 text-right pr-4 whitespace-nowrap">
            <div class="flex items-center justify-end space-x-1.5">
              ${photoCount > 0 ? `
                <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}', 'timeline')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition-all inline-flex items-center space-x-1 active:scale-95 shadow-2xs" title="ดูภาพถ่ายผลงาน">
                  <span>📸</span>
                  <span>${photoCount}</span>
                </button>
              ` : ''}
              <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}')" class="px-2.5 py-1 text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg text-xs font-semibold border border-slate-200 hover:border-blue-200 transition-all inline-flex items-center space-x-1 shadow-2xs active:scale-95" title="${typeof window.isCurrentUserAdmin === 'function' && window.isCurrentUserAdmin() ? 'คลิกเพื่อดูรายละเอียดและแก้ไขงาน' : 'คลิกเพื่อดูรายละเอียดงาน'}">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <span>${typeof window.isCurrentUserAdmin === 'function' && window.isCurrentUserAdmin() ? 'ดู/แก้ไข' : 'ดูรายละเอียด'}</span>
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
      const assigneeStatuses = getAssigneeSubmissionsStatus(task);
      const photoCount = (task.progressHistory || task.customer?.progress_history || []).reduce((acc, it) => acc + (Array.isArray(it.photos) ? it.photos.length : 0), 0);

      const isProblem = task.status === "ติดปัญหา";
      let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
      if (isDone) badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      else if (isProblem) badgeBg = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
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
            ${task.latestUpdate && task.latestUpdate !== 'ยังไม่มีอัปเดต' ? `<p class="text-[11px] text-blue-600 line-clamp-1 mt-1 font-medium">💬 ${cleanLatestText(task.latestUpdate)}</p>` : ''}
          </div>
          <div class="mt-2.5 pt-2 border-t border-slate-100 text-xs">
            <div class="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
              <span>👷 ผู้ปฏิบัติงาน (${techs.length} คน):</span>
              <span class="text-[10px] text-slate-400 font-normal">สถานะส่งงาน</span>
            </div>
            <div class="flex flex-wrap gap-1">
              ${assigneeStatuses.map(s => `
                <span class="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md border ${s.badgeClass}">
                  ${s.label}
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 space-y-2">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-500">กำหนดส่ง: <strong>${formatThaiDateDisplay(task.deadline)}</strong></span>
            ${isProblem ? `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap flex-shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>⚠️ ติดปัญหา</span></span>` : getDeadlineCountdownBadge(task.deadline, isDone)}
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 ${isDone ? 'bg-emerald-500' : (isProblem ? 'bg-rose-500' : 'bg-slate-900')} rounded-full" style="width: ${task.progress || 0}%"></div>
            </div>
            <span class="text-xs font-mono font-bold text-slate-700">${task.progress || 0}%</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 pt-1">
            <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}', 'timeline')" class="py-1.5 px-2 text-center text-xs font-bold ${photoCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'} border rounded-lg transition-all flex items-center justify-center space-x-1 shadow-2xs">
              <span>📸</span>
              <span>ภาพถ่ายผลงาน (${photoCount})</span>
            </button>
            <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}')" class="py-1.5 px-2 text-center text-xs font-semibold bg-slate-50 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 border border-slate-200 group-hover:border-blue-200 rounded-lg transition-all flex items-center justify-center space-x-1 shadow-2xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>${typeof window.isCurrentUserAdmin === 'function' && window.isCurrentUserAdmin() ? 'ดู/แก้ไข' : 'ดูรายละเอียด'}</span>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}
