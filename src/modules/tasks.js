/**
 * Supervisor Task Management Module (งานมอบหมาย)
 */

import { formatThaiDateDisplay, getDeadlineCountdownBadge, isTaskOverdue, getTodayYMD, getSevenDaysLaterYMD } from '../utils/date.js';
import { saveTaskApi, extendTaskDeadlineApi, deleteTaskApi } from '../api/gas.js';

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

export function setTechFilter(techName, tasksList) {
  currentTechFilter = techName;
  renderTechFilterChips(tasksList);
  renderTasksList(tasksList);
}

export function renderTechFilterChips(tasksList, allTechnicians = []) {
  const container = document.getElementById("techFilterChipsContainer");
  if (!container) return;

  const techs = ["ทั้งหมด", ...allTechnicians];
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

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 bg-white rounded-xl border border-slate-200 p-6">
        <div class="text-3xl mb-2">📋</div>
        <div class="text-sm font-bold text-slate-800">ไม่พบงานที่ตรงกับเงื่อนไข</div>
        <p class="text-xs text-slate-500 mt-1">ลองเปลี่ยนตัวกรอง หรือค้นหาด้วยคำอื่น</p>
      </div>
    `;
    return;
  }

  // 3. Render View Mode
  if (taskViewMode === "list" && window.innerWidth >= 768) {
    // List Table View - 100% Fluid, zero horizontal scrollbar!
    let tableHtml = `
      <div class="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <table class="w-full text-left text-sm border-collapse">
          <thead class="bg-slate-50/90 text-xs font-bold text-slate-600 border-b border-slate-200">
            <tr>
              <th class="py-3 px-3 w-10 text-center font-mono">#</th>
              <th class="py-3 px-3 w-28 whitespace-nowrap">สถานะ</th>
              <th class="py-3 px-3">ชื่องานปฏิบัติการ & ไซต์งาน</th>
              <th class="py-3 px-3 w-36">ช่างผู้รับผิดชอบ</th>
              <th class="py-3 px-3 w-32 whitespace-nowrap">กำหนดส่ง</th>
              <th class="py-3 px-3 w-28 whitespace-nowrap">ความคืบหน้า</th>
              <th class="py-3 px-3 w-36 text-right pr-4 whitespace-nowrap">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
    `;

    filteredTasks.forEach((task, index) => {
      const isDone = task.status === "เสร็จสิ้น";
      const isOver = isTaskOverdue(task.deadline, isDone);
      const techs = getTaskTechs(task);

      let badgeBg = "bg-amber-50 text-amber-800 border-amber-200";
      if (isDone) badgeBg = "bg-emerald-50 text-emerald-800 border-emerald-200";
      else if (isOver) badgeBg = "bg-rose-50 text-rose-800 border-rose-200";

      tableHtml += `
        <tr class="hover:bg-slate-50/70 transition-colors group">
          <td class="py-3 px-3 text-center font-mono text-xs text-slate-400 font-semibold">${index + 1}</td>
          <td class="py-3 px-3 whitespace-nowrap">
            <span class="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border ${badgeBg}">
              ${task.status}
            </span>
          </td>
          <td class="py-3 px-3">
            <div class="cursor-pointer" onclick="window.openTaskActionModal('${task.id}')">
              <div class="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">${task.title}</div>
              ${task.desc && task.desc !== '-' ? `<div class="text-xs text-slate-500 line-clamp-1 mt-0.5">${task.desc}</div>` : ''}
              ${task.latestUpdate && task.latestUpdate !== 'ยังไม่มีอัปเดต' ? `<div class="text-[11px] text-blue-600 line-clamp-1 mt-0.5">💬 ${task.latestUpdate}</div>` : ''}
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-wrap gap-1">
              ${techs.map(tName => `<span class="text-xs bg-slate-100 text-slate-800 font-medium px-1.5 py-0.5 rounded border border-slate-200">${tName}</span>`).join('')}
            </div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="font-mono text-xs text-slate-800 font-semibold">${task.deadline}</div>
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
            <div class="flex items-center justify-end space-x-1">
              <button type="button" onclick="window.openProgressModalForTask('${task.id}')" class="px-2 py-1 text-blue-700 hover:bg-blue-50 rounded-md text-xs font-semibold border border-blue-200 transition-colors" title="อัปเดตงาน">
                อัปเดต
              </button>
              <button type="button" onclick="window.openExtendModal('${task.id}')" class="px-2 py-1 text-amber-800 hover:bg-amber-50 rounded-md text-xs font-semibold border border-amber-200 transition-colors" title="ขยายเวลา">
                ขยาย
              </button>
              <button type="button" onclick="window.openEditTaskModal('${task.id}')" class="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" title="แก้ไข">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
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
      const techs = getTaskTechs(task);

      let badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
      if (isDone) badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
      else if (isOver) badgeBg = "bg-rose-50 text-rose-700 border-rose-200";

      const card = document.createElement("div");
      card.className = "group bg-white rounded-xl p-4 border border-slate-200/90 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3";
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-[10px] font-mono text-slate-400 font-bold">#${index + 1} (${task.id})</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}">${task.status}</span>
          </div>
          <div class="cursor-pointer group" onclick="window.openTaskActionModal('${task.id}')">
            <h3 class="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">${task.title}</h3>
            ${task.desc && task.desc !== '-' ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${task.desc}</p>` : ''}
          </div>
          <div class="mt-2 text-xs text-slate-500 flex items-center space-x-1">
            <span>👷 ช่าง:</span>
            <strong class="text-slate-700">${techs.join(', ')}</strong>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 space-y-2">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-500">กำหนดส่ง: <strong>${task.deadline}</strong></span>
            ${getDeadlineCountdownBadge(task.deadline, isDone)}
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 ${isDone ? 'bg-emerald-500' : 'bg-slate-900'} rounded-full" style="width: ${task.progress || 0}%"></div>
            </div>
            <span class="text-xs font-mono font-bold text-slate-700">${task.progress || 0}%</span>
          </div>
          <div class="flex items-center justify-end space-x-1 pt-1">
            <button type="button" onclick="window.openProgressModalForTask('${task.id}')" class="px-2.5 py-1 text-blue-700 hover:bg-blue-50 rounded-lg text-xs font-semibold border border-blue-200">
              อัปเดต
            </button>
            <button type="button" onclick="window.openExtendModal('${task.id}')" class="px-2.5 py-1 text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-semibold border border-amber-200">
              ขยายเวลา
            </button>
            <button type="button" onclick="window.openEditTaskModal('${task.id}')" class="p-1 text-slate-400 hover:text-slate-700 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

// -------------------------------------------------------------
// ASSIGN TASK MODAL
// -------------------------------------------------------------
export function openAssignModal(allTechnicians) {
  selectedAssignStatus = "กำลังทำ";
  selectAssignStatus("กำลังทำ");
  assignRows = [{
    id: 1,
    title: "",
    desc: "",
    startDate: getTodayYMD(),
    deadline: getSevenDaysLaterYMD(),
    techs: []
  }];
  renderAssignRows(allTechnicians);
  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeAssignModal() {
  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.add("hidden");
}

export function selectAssignStatus(st) {
  selectedAssignStatus = st;
  const statuses = [
    { key: "กำลังทำ", activeClass: "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200" },
    { key: "รอดำเนินการ", activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200" },
    { key: "ด่วน", activeClass: "bg-orange-600 text-white border-orange-600 shadow-xs ring-2 ring-orange-200" },
    { key: "ด่วนที่สุด", activeClass: "bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-200" }
  ];
  statuses.forEach(s => {
    const btn = document.getElementById(`assignStatusPill-${s.key}`);
    if (btn) {
      if (s.key === st) {
        btn.className = `assign-status-pill py-2 px-2.5 rounded-lg border text-xs font-bold text-center transition-all ${s.activeClass}`;
      } else {
        btn.className = "assign-status-pill py-2 px-2.5 rounded-lg border text-xs font-medium text-center transition-all bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200";
      }
    }
  });
}

export function renderAssignRows(allTechnicians) {
  const container = document.getElementById("assignRowsContainer");
  if (!container) return;
  container.innerHTML = "";

  assignRows.forEach((row, idx) => {
    const card = document.createElement("div");
    card.className = "bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5";
    card.innerHTML = `
      <div class="flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>งานที่ ${idx + 1}</span>
        ${assignRows.length > 1 ? `<button type="button" onclick="window.removeAssignRow(${idx})" class="text-rose-500 hover:text-rose-700">ลบแถวนี้</button>` : ''}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input type="text" value="${row.title}" oninput="window.updateAssignRowField(${idx}, 'title', this.value)" placeholder="ชื่องาน CCTV เช่น ติดตั้ง 4 ตัว ไซต์บางนา..." class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none">
        <input type="text" value="${row.desc}" oninput="window.updateAssignRowField(${idx}, 'desc', this.value)" placeholder="สถานที่ / รายละเอียดเพิ่มเติม..." class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="block text-[11px] text-slate-600 mb-1">เริ่มงาน</span>
          <input type="date" value="${row.startDate}" onchange="window.updateAssignRowField(${idx}, 'startDate', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
        </div>
        <div>
          <span class="block text-[11px] text-slate-600 mb-1">กำหนดส่ง</span>
          <input type="date" value="${row.deadline}" onchange="window.updateAssignRowField(${idx}, 'deadline', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
        </div>
      </div>
      <div>
        <span class="block text-[11px] text-slate-600 mb-1">ทีมช่างที่มอบหมาย:</span>
        <div class="flex flex-wrap gap-1.5">
          ${allTechnicians.map(tName => {
            const isSelected = (row.techs || []).includes(tName);
            return `
              <button type="button" onclick="window.toggleAssignRowTech(${idx}, '${tName}')" class="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                isSelected ? 'bg-slate-900 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-600'
              }">
                ${isSelected ? '✓ ' : ''}${tName}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

export function updateAssignRowField(idx, field, val) {
  if (assignRows[idx]) assignRows[idx][field] = val;
}

export function toggleAssignRowTech(idx, tName, allTechnicians) {
  if (!assignRows[idx]) return;
  let cur = assignRows[idx].techs || [];
  if (cur.includes(tName)) {
    cur = cur.filter(t => t !== tName);
  } else {
    cur.push(tName);
  }
  assignRows[idx].techs = cur;
  renderAssignRows(allTechnicians);
}

export function addAssignRow(allTechnicians) {
  assignRows.push({
    id: assignRows.length + 1,
    title: "",
    desc: "",
    startDate: getTodayYMD(),
    deadline: getSevenDaysLaterYMD(),
    techs: []
  });
  renderAssignRows(allTechnicians);
}

export function removeAssignRow(idx, allTechnicians) {
  assignRows.splice(idx, 1);
  renderAssignRows(allTechnicians);
}

export async function submitAssignForm({ tasksList, onComplete }) {
  const validRows = assignRows.filter(r => r.title.trim() !== "");
  if (validRows.length === 0) {
    alert("กรุณากรอกชื่องานอย่างน้อย 1 รายการ");
    return;
  }

  for (let r of validRows) {
    if (!r.techs || r.techs.length === 0) {
      alert(`กรุณาเลือกช่างผู้รับผิดชอบสำหรับงาน "${r.title}"`);
      return;
    }
  }

  closeAssignModal();

  const newItems = validRows.map(r => ({
    id: `TASK-${Math.floor(100 + Math.random() * 900)}`,
    title: r.title,
    desc: r.desc || "-",
    techs: [...r.techs],
    startDate: r.startDate,
    deadline: r.deadline,
    status: selectedAssignStatus,
    progress: 0,
    latestUpdate: "มอบหมายงานใหม่",
    reason: "-",
    updateBy: "หัวหน้างาน",
    updateTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  }));

  // Sync to Sheet
  newItems.forEach(item => {
    saveTaskApi(item);
  });

  tasksList.unshift(...newItems);
  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
  if (onComplete) onComplete(newItems);
}

// -------------------------------------------------------------
// EDIT TASK MODAL
// -------------------------------------------------------------
export function openEditTaskModal(taskId, tasksList, allTechnicians) {
  currentEditingTaskId = taskId;
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

  const titleInput = document.getElementById("editTaskTitleInput");
  const descInput = document.getElementById("editTaskDescInput");
  if (titleInput) titleInput.value = task.title;
  if (descInput) descInput.value = task.desc || "";

  editingTechs = [...getTaskTechs(task)];
  renderEditTechChips(allTechnicians);

  setEditModalStatus(task.status || "กำลังทำ");

  editingStartDate = task.startDate;
  editingDeadlineDate = task.deadline;
  const startText = document.getElementById("editStartDateText");
  const deadText = document.getElementById("editDeadlineDateText");
  if (startText) startText.innerText = formatThaiDateDisplay(task.startDate);
  if (deadText) deadText.innerText = formatThaiDateDisplay(task.deadline);

  const modal = document.getElementById("editTaskModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeEditTaskModal() {
  const modal = document.getElementById("editTaskModal");
  if (modal) modal.classList.add("hidden");
}

export function setEditModalStatus(st) {
  editModalStatus = st;
  const statuses = [
    { key: "กำลังทำ", activeClass: "bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200" },
    { key: "รอดำเนินการ", activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200" },
    { key: "รออะไหล่", activeClass: "bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-200" },
    { key: "เสร็จสิ้น", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200" }
  ];
  statuses.forEach(s => {
    const btn = document.getElementById(`editStatusPill-${s.key}`);
    if (btn) {
      if (s.key === st) {
        btn.className = `edit-status-pill py-2 px-2 rounded-lg border text-xs font-semibold text-center transition-all ${s.activeClass}`;
      } else {
        btn.className = "edit-status-pill py-2 px-2 rounded-lg border text-xs font-medium text-center transition-all bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200";
      }
    }
  });
}

export function renderEditTechChips(allTechnicians) {
  const container = document.getElementById("editTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  allTechnicians.forEach(tName => {
    const isSelected = editingTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
      isSelected ? "bg-slate-900 text-white font-semibold" : "bg-white border border-slate-200 text-slate-600"
    }`;
    btn.innerHTML = `${isSelected ? '✓ ' : ''}${tName}`;
    btn.onclick = () => {
      if (editingTechs.includes(tName)) {
        if (editingTechs.length > 1) editingTechs = editingTechs.filter(t => t !== tName);
      } else {
        editingTechs.push(tName);
      }
      renderEditTechChips(allTechnicians);
    };
    container.appendChild(btn);
  });
}

export function saveEditedTask(tasksList, onComplete) {
  const titleInput = document.getElementById("editTaskTitleInput");
  const descInput = document.getElementById("editTaskDescInput");
  const title = titleInput ? titleInput.value.trim() : "";
  if (!title) {
    alert("กรุณากรอกชื่องาน");
    return;
  }

  const task = tasksList.find(t => t.id === currentEditingTaskId);
  if (!task) return;

  task.title = title;
  task.desc = descInput ? descInput.value.trim() : "";
  task.techs = [...editingTechs];
  task.status = editModalStatus;

  closeEditTaskModal();
  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
  if (onComplete) onComplete(task);
}

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

  if (titleLabel) titleLabel.innerText = task.title;
  if (curDeadLabel) curDeadLabel.innerText = formatThaiDateDisplay(task.deadline);
  if (reasonInput) reasonInput.value = "";
  if (dateInput) dateInput.value = "";

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
    alert("กรุณาเลือกกำหนดส่งใหม่");
    return;
  }
  if (!reason) {
    alert("กรุณาระบุเหตุผลการขยายเวลา");
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

  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
  if (onComplete) onComplete(task);
}
