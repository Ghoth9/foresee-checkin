/**
 * Supervisor Task Management Module (งานมอบหมาย)
 */

import { formatThaiDateDisplay, getDeadlineCountdownBadge, isTaskOverdue, getTodayYMD, getSevenDaysLaterYMD } from '../utils/date.js';
import { saveTaskApi, extendTaskDeadlineApi, deleteTaskApi } from '../api/gas.js';
import { createExtendDeadlineFlexCard, triggerLiffShare } from '../liff/line.js';

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

let cachedTechnicians = [];

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
    // List Table View - High Contrast & 100% Fluid
    let tableHtml = `
      <div class="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        <table class="w-full text-left text-sm border-collapse">
          <thead class="bg-slate-100 text-xs font-bold text-slate-800 border-b-2 border-slate-200">
            <tr>
              <th class="py-3.5 px-3 w-10 text-center font-mono">#</th>
              <th class="py-3.5 px-3 w-28 whitespace-nowrap">สถานะ</th>
              <th class="py-3.5 px-3">ชื่องานปฏิบัติการ & ไซต์งาน</th>
              <th class="py-3.5 px-3 w-36">ช่างผู้รับผิดชอบ</th>
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
      const techs = getTaskTechs(task);

      let badgeBg = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
      if (isDone) badgeBg = "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold";
      else if (isOver) badgeBg = "bg-rose-100 text-rose-900 border-rose-300 font-bold";
      else if (task.status === "กำลังทำ") badgeBg = "bg-blue-100 text-blue-900 border-blue-300 font-bold";

      tableHtml += `
        <tr class="hover:bg-blue-50/50 transition-colors group cursor-pointer" onclick="window.openTaskDetailModal('${task.id}')">
          <td class="py-3.5 px-3 text-center font-mono text-xs text-slate-500 font-semibold">${index + 1}</td>
          <td class="py-3 px-3 whitespace-nowrap">
            <span class="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeBg}">
              ${task.status}
            </span>
          </td>
          <td class="py-3 px-3">
            <div>
              <div class="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">${task.title}</div>
              ${task.desc && task.desc !== '-' ? `<div class="text-xs text-slate-500 line-clamp-1 mt-0.5">${task.desc}</div>` : ''}
              ${task.latestUpdate && task.latestUpdate !== 'ยังไม่มีอัปเดต' ? `<div class="text-[11px] text-blue-600 line-clamp-1 mt-0.5">💬 ${task.latestUpdate}</div>` : ''}
            </div>
          </td>
          <td class="py-3 px-3">
            <div class="flex flex-wrap gap-1">
              ${techs.map(tName => `<span class="text-xs bg-slate-100 text-slate-800 font-medium px-2 py-0.5 rounded-md border border-slate-200">${tName}</span>`).join('')}
            </div>
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <div class="font-mono text-xs text-slate-800 font-semibold">${formatThaiDateDisplay(task.deadline)}</div>
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
            <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}')" class="px-2.5 py-1 text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg text-xs font-semibold border border-slate-200 hover:border-blue-200 transition-all inline-flex items-center space-x-1 shadow-2xs active:scale-95" title="คลิกเพื่อดูรายละเอียดและแก้ไขงาน">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>ดู/แก้ไข</span>
            </button>
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
      card.className = "group bg-white rounded-xl p-4 border border-slate-200/90 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3 cursor-pointer";
      card.onclick = () => window.openTaskDetailModal(task.id);
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-[10px] font-mono text-slate-400 font-bold">#${index + 1} (${task.id})</span>
            <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}">${task.status}</span>
          </div>
          <div>
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
            <span class="text-slate-500">กำหนดส่ง: <strong>${formatThaiDateDisplay(task.deadline)}</strong></span>
            ${getDeadlineCountdownBadge(task.deadline, isDone)}
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div class="h-1.5 ${isDone ? 'bg-emerald-500' : 'bg-slate-900'} rounded-full" style="width: ${task.progress || 0}%"></div>
            </div>
            <span class="text-xs font-mono font-bold text-slate-700">${task.progress || 0}%</span>
          </div>
          <div class="pt-1">
            <button type="button" onclick="event.stopPropagation(); window.openTaskDetailModal('${task.id}')" class="w-full py-1.5 text-center text-xs font-semibold bg-slate-50 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 border border-slate-200 group-hover:border-blue-200 rounded-lg transition-all flex items-center justify-center space-x-1.5 shadow-2xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>ดูรายละเอียดและแก้ไขงาน</span>
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
let selectedAssignPriority = "ปกติ";
let selectedAssignCategory = "ติดตั้งงานใหม่";
let selectedAssignTechs = [];

export function openAssignModal(allTechnicians) {
  selectedAssignPriority = "ปกติ";
  selectedAssignCategory = "ติดตั้งงานใหม่";
  selectedAssignTechs = [];

  selectAssignPriority("ปกติ");
  selectAssignCategory("ติดตั้งงานใหม่");

  const jobDetail = document.getElementById("assignJobDetailInput");
  const locInput = document.getElementById("assignLocationInput");
  const custName = document.getElementById("assignCustNameInput");
  const custAddress = document.getElementById("assignCustAddressInput");
  const custPhone = document.getElementById("assignCustPhoneInput");
  const custEmail = document.getElementById("assignCustEmailInput");
  const custLineId = document.getElementById("assignCustLineIdInput");
  const catOther = document.getElementById("assignCategoryOtherInput");
  const startInput = document.getElementById("assignStartDateInput");
  const deadInput = document.getElementById("assignDeadlineInput");

  if (jobDetail) jobDetail.value = "";
  if (locInput) locInput.value = "";
  if (custName) custName.value = "";
  if (custAddress) custAddress.value = "";
  if (custPhone) custPhone.value = "";
  if (custEmail) custEmail.value = "";
  if (custLineId) custLineId.value = "";
  if (catOther) catOther.value = "";
  if (startInput) startInput.value = getTodayYMD();
  if (deadInput) deadInput.value = getSevenDaysLaterYMD();

  renderAssignTechChips(allTechnicians);

  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeAssignModal() {
  const modal = document.getElementById("assignModal");
  if (modal) modal.classList.add("hidden");
}

export function selectAssignPriority(priority) {
  selectedAssignPriority = priority;
  const priorities = [
    { key: "ปกติ", activeClass: "bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-300" },
    { key: "ด่วน", activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200" },
    { key: "ด่วนที่สุด", activeClass: "bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-200" }
  ];

  priorities.forEach(p => {
    const btn = document.getElementById(`assignPriorityBtn-${p.key}`);
    if (btn) {
      if (p.key === priority) {
        btn.className = `py-2 px-3 rounded-lg border text-xs font-bold text-center transition-all ${p.activeClass}`;
      } else {
        btn.className = "py-2 px-3 rounded-lg border text-xs font-medium text-center transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export function selectAssignCategory(cat) {
  selectedAssignCategory = cat;
  const categories = [
    "ติดตั้งงานใหม่",
    "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)",
    "งานเซอร์วิส (มีค่าใช้จ่าย)",
    "งาน PM (Preventive Maintenance)",
    "สำรวจประเมินหน้างาน",
    "อื่นๆ"
  ];

  categories.forEach(c => {
    const btn = document.getElementById(`assignCatBtn-${c}`);
    if (btn) {
      if (c === cat) {
        btn.className = "py-2 px-3 rounded-lg border text-xs font-bold text-left transition-all bg-blue-50 border-blue-600 text-blue-900 shadow-2xs ring-1 ring-blue-500";
      } else {
        btn.className = "py-2 px-3 rounded-lg border text-xs font-medium text-left transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });

  const otherWrapper = document.getElementById("assignCategoryOtherWrapper");
  if (otherWrapper) {
    if (cat === "อื่นๆ") {
      otherWrapper.classList.remove("hidden");
    } else {
      otherWrapper.classList.add("hidden");
    }
  }
}

export function renderAssignTechChips(allTechnicians) {
  const container = document.getElementById("assignTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  allTechnicians.forEach(tName => {
    const isSelected = selectedAssignTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
      isSelected ? "bg-slate-900 text-white font-semibold shadow-xs" : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
    }`;
    btn.innerHTML = `${isSelected ? '✓ ' : ''}${tName}`;
    btn.onclick = () => toggleAssignTech(tName, allTechnicians);
    container.appendChild(btn);
  });
}

export function toggleAssignTech(tName, allTechnicians) {
  if (selectedAssignTechs.includes(tName)) {
    selectedAssignTechs = selectedAssignTechs.filter(t => t !== tName);
  } else {
    selectedAssignTechs.push(tName);
  }
  renderAssignTechChips(allTechnicians);
}

export async function submitAssignForm({ tasksList, onComplete }) {
  const custNameInput = document.getElementById("assignCustNameInput");
  const custAddressInput = document.getElementById("assignCustAddressInput");
  const custPhoneInput = document.getElementById("assignCustPhoneInput");
  const custEmailInput = document.getElementById("assignCustEmailInput");
  const custLineIdInput = document.getElementById("assignCustLineIdInput");
  const jobDetailInput = document.getElementById("assignJobDetailInput");
  const locationInput = document.getElementById("assignLocationInput");
  const startInput = document.getElementById("assignStartDateInput");
  const deadInput = document.getElementById("assignDeadlineInput");
  const otherCatInput = document.getElementById("assignCategoryOtherInput");

  const custName = custNameInput ? custNameInput.value.trim() : "";
  const custAddress = custAddressInput ? custAddressInput.value.trim() : "";
  const custPhone = custPhoneInput ? custPhoneInput.value.trim() : "";

  // Mandatory Customer Verification
  if (!custName) {
    alert("กรุณากรอก 'ชื่อลูกค้า' (จำเป็นสำหรับการบันทึก)");
    if (custNameInput) custNameInput.focus();
    return;
  }
  if (!custAddress) {
    alert("กรุณากรอก 'ที่อยู่ลูกค้า' (จำเป็นสำหรับการบันทึก)");
    if (custAddressInput) custAddressInput.focus();
    return;
  }
  if (!custPhone) {
    alert("กรุณากรอก 'เบอร์โทรศัพท์ลูกค้า' (จำเป็นสำหรับการบันทึก)");
    if (custPhoneInput) custPhoneInput.focus();
    return;
  }

  // Category handling
  let finalCategory = selectedAssignCategory;
  if (selectedAssignCategory === "อื่นๆ") {
    const otherText = otherCatInput ? otherCatInput.value.trim() : "";
    if (!otherText) {
      alert("กรุณากรอกระบุประเภทงานอื่นๆ");
      if (otherCatInput) otherCatInput.focus();
      return;
    }
    finalCategory = `อื่นๆ: ${otherText}`;
  }

  if (selectedAssignTechs.length === 0) {
    alert("กรุณาเลือกช่างผู้รับผิดชอบงานอย่างน้อย 1 คน");
    return;
  }

  const jobDetail = jobDetailInput ? jobDetailInput.value.trim() : "";
  const location = locationInput ? locationInput.value.trim() : "";
  const startDate = startInput && startInput.value ? startInput.value : getTodayYMD();
  const deadline = deadInput && deadInput.value ? deadInput.value : getSevenDaysLaterYMD();
  const custEmail = custEmailInput ? custEmailInput.value.trim() : "-";
  const custLineId = custLineIdInput ? custLineIdInput.value.trim() : "-";

  closeAssignModal();

  const taskId = `TASK-${Math.floor(100 + Math.random() * 900)}`;
  const titleDisplay = `${finalCategory} - ${custName}`;

  const newTask = {
    id: taskId,
    title: titleDisplay,
    category: finalCategory,
    priority: selectedAssignPriority,
    desc: jobDetail || `งาน ${finalCategory} สำหรับ ${custName}`,
    location: location || custAddress,
    customer: {
      name: custName,
      address: custAddress,
      phone: custPhone,
      email: custEmail || "-",
      lineId: custLineId || "-"
    },
    techs: [...selectedAssignTechs],
    startDate: startDate,
    deadline: deadline,
    status: "กำลังทำ",
    progress: 0,
    latestUpdate: `มอบหมายงานใหม่ [ความเร่งด่วน: ${selectedAssignPriority}]`,
    reason: "-",
    updateBy: "หัวหน้างาน",
    updateTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  };

  // Sync to Sheet
  saveTaskApi(newTask);

  tasksList.unshift(newTask);
  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
  if (onComplete) onComplete([newTask]);
}

// -------------------------------------------------------------
// TASK DETAIL & FULL EDIT MODAL (POP-UP)
// -------------------------------------------------------------
let currentDetailTaskId = null;
let currentDetailStatus = "กำลังทำ";
let currentDetailPriority = "ปกติ";
let currentDetailTechs = [];

export function openTaskDetailModal(taskId, tasksList, allTechnicians) {
  currentDetailTaskId = taskId;
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

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
  renderDetailTechChips(allTechnicians);

  // Dates
  const startInput = document.getElementById("detailStartDateInput");
  const deadInput = document.getElementById("detailDeadlineInput");
  if (startInput) startInput.value = task.startDate || getTodayYMD();
  if (deadInput) deadInput.value = task.deadline || getSevenDaysLaterYMD();

  // Progress
  const progRange = document.getElementById("detailProgressRange");
  const progText = document.getElementById("detailProgressText");
  const progVal = task.progress || 0;
  if (progRange) progRange.value = progVal;
  if (progText) progText.innerText = `${progVal}%`;

  // Latest update
  const latestInput = document.getElementById("detailLatestUpdateInput");
  if (latestInput) latestInput.value = task.latestUpdate && task.latestUpdate !== "ยังไม่มีอัปเดต" ? task.latestUpdate : "";

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
    { key: "เสร็จสิ้น", activeClass: "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs" }
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

export function renderDetailTechChips(allTechnicians) {
  const container = document.getElementById("detailTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  (allTechnicians || []).forEach(tName => {
    const isSelected = currentDetailTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
      isSelected
        ? "bg-slate-900 text-white shadow-2xs"
        : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
    }`;
    btn.innerHTML = `${isSelected ? '✓ ' : ''}${tName}`;
    btn.onclick = () => {
      if (currentDetailTechs.includes(tName)) {
        if (currentDetailTechs.length > 1) {
          currentDetailTechs = currentDetailTechs.filter(t => t !== tName);
        } else {
          alert("ต้องมีช่างผู้รับผิดชอบงานอย่างน้อย 1 คน");
        }
      } else {
        currentDetailTechs.push(tName);
      }
      renderDetailTechChips(allTechnicians);
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
    alert("กรุณากรอกชื่องาน");
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

  if (onComplete) onComplete(task);
}

export function deleteCurrentDetailTask(tasksList, onComplete) {
  const task = tasksList.find(t => t.id === currentDetailTaskId);
  if (!task) return;

  if (confirm(`คุณต้องการลบงาน "${task.title}" (${task.id}) ออกจากระบบหรือไม่?`)) {
    const idx = tasksList.findIndex(t => t.id === currentDetailTaskId);
    if (idx !== -1) {
      tasksList.splice(idx, 1);
    }
    closeTaskDetailModal();
    localStorage.setItem("fs_tasks", JSON.stringify(tasksList));

    // Sync deletion to Sheet
    deleteTaskApi(task.id);

    if (onComplete) onComplete();
  }
}

// Aliases for backwards compatibility
export const openEditTaskModal = openTaskDetailModal;
export const closeEditTaskModal = closeTaskDetailModal;
export const setEditModalStatus = setDetailModalStatus;
export const saveEditedTask = saveTaskDetailChanges;


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

  // Client Requirement: Always alert LINE group / supervisor when extending deadline
  const flexCard = createExtendDeadlineFlexCard({
    taskId: task.id,
    taskTitle: task.title,
    techs: task.techs,
    oldDeadline: oldDeadline,
    newDeadline: newDeadline,
    reason: reason,
    requestBy: currentLineUserName || "ช่างหน้างาน"
  });
  await triggerLiffShare(flexCard, "ส่งคำขอขยายเวลางานเข้ากลุ่ม LINE สำเร็จ!");

  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));
  if (onComplete) onComplete(task);
}
