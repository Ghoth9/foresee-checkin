/**
 * Task Assignment Form Modal Module (มอบหมายงาน)
 */

import { formatThaiDateDisplay, getTodayYMD, getSevenDaysLaterYMD } from '../utils/date.js';
import { saveTaskApi } from '../api/supabase.js';
import { createAssignTaskFlexCard, triggerLiffShare } from '../liff/line.js';
import { showAppAlert } from '../utils/dialog.js';
import { openCustomCalendar } from '../utils/calendar.js';

let selectedAssignPriority = "ปกติ";
let selectedAssignCategory = "ติดตั้งงานใหม่";
let selectedAssignTechs = [];
let assignTechSearchQuery = "";
let cachedAssignTechsList = [];

let recentNewTaskIds = new Set();
try {
  const savedNew = localStorage.getItem("fs_recent_new_tasks");
  if (savedNew) recentNewTaskIds = new Set(JSON.parse(savedNew));
} catch (e) {}

export function getRecentNewTaskIds() {
  return recentNewTaskIds;
}

export function pickAssignDate(type) {
  const isStart = type === 'start';
  const inputEl = document.getElementById(isStart ? 'assignStartDateInput' : 'assignDeadlineInput');
  const textEl = document.getElementById(isStart ? 'assignStartDateText' : 'assignDeadlineText');
  const currentVal = inputEl && inputEl.value ? inputEl.value : (isStart ? getTodayYMD() : getSevenDaysLaterYMD());

  openCustomCalendar(currentVal, (selectedDate) => {
    if (inputEl) inputEl.value = selectedDate;
    if (textEl) textEl.innerText = formatThaiDateDisplay(selectedDate);
  });
}

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
  const startText = document.getElementById("assignStartDateText");
  const deadText = document.getElementById("assignDeadlineText");

  if (jobDetail) jobDetail.value = "";
  if (locInput) locInput.value = "";
  if (custName) custName.value = "";
  if (custAddress) custAddress.value = "";
  if (custPhone) custPhone.value = "";
  if (custEmail) custEmail.value = "";
  if (custLineId) custLineId.value = "";
  if (catOther) catOther.value = "";

  const today = getTodayYMD();
  const next7Days = getSevenDaysLaterYMD();
  if (startInput) startInput.value = today;
  if (deadInput) deadInput.value = next7Days;
  if (startText) startText.innerText = formatThaiDateDisplay(today);
  if (deadText) deadText.innerText = formatThaiDateDisplay(next7Days);

  assignTechSearchQuery = "";
  const assignSearchInput = document.getElementById("assignTechSearchInput");
  if (assignSearchInput) assignSearchInput.value = "";
  const assignClearBtn = document.getElementById("assignTechSearchClearBtn");
  if (assignClearBtn) assignClearBtn.classList.add("hidden");

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

export function filterAssignTechChips(query) {
  assignTechSearchQuery = (query || "").trim().toLowerCase();
  const clearBtn = document.getElementById("assignTechSearchClearBtn");
  if (clearBtn) {
    if (assignTechSearchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  renderAssignTechChips(cachedAssignTechsList);
}
window.filterAssignTechChips = filterAssignTechChips;

export function clearAssignTechSearch() {
  const input = document.getElementById("assignTechSearchInput");
  if (input) input.value = "";
  filterAssignTechChips("");
}
window.clearAssignTechSearch = clearAssignTechSearch;

export function renderAssignTechChips(allTechnicians) {
  const container = document.getElementById("assignTechChipsContainer");
  const countBadge = document.getElementById("assignTechSelectedCount");
  if (!container) return;

  if (allTechnicians && allTechnicians.length > 0) {
    cachedAssignTechsList = allTechnicians;
  }
  const sourceList = cachedAssignTechsList.length > 0 ? cachedAssignTechsList : (allTechnicians || []);

  if (countBadge) {
    if (selectedAssignTechs.length > 0) {
      countBadge.innerText = `เลือกแล้ว ${selectedAssignTechs.length} คน`;
      countBadge.classList.remove("hidden");
    } else {
      countBadge.classList.add("hidden");
    }
  }

  container.innerHTML = "";

  let displayList = sourceList;
  if (assignTechSearchQuery) {
    displayList = displayList.filter(t => t && t.toLowerCase().includes(assignTechSearchQuery));
  }

  // Smart sort: Put selected at top, then Thai alphabetical
  displayList = [...displayList].sort((a, b) => {
    const aSel = selectedAssignTechs.includes(a);
    const bSel = selectedAssignTechs.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return a.localeCompare(b, 'th');
  });

  if (displayList.length === 0) {
    container.innerHTML = `
      <div class="w-full text-center py-3 text-xs text-slate-400">
        ไม่พบชื่อที่ตรงกับ "${assignTechSearchQuery}"
      </div>
    `;
    return;
  }

  displayList.forEach(tName => {
    const isSelected = selectedAssignTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
      isSelected
        ? "bg-slate-900 text-white font-bold shadow-xs ring-1 ring-slate-800"
        : "bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-2xs"
    }`;
    btn.innerHTML = `${isSelected ? '<span>✓</span>' : ''}<span>${tName}</span>`;
    btn.onclick = () => toggleAssignTech(tName, sourceList);
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
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกชื่อลูกค้า",
      message: "จำเป็นต้องระบุชื่อลูกค้าก่อนบันทึกข้อมูลงาน"
    });
    if (custNameInput) custNameInput.focus();
    return;
  }
  if (!custAddress) {
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกที่อยู่ลูกค้า",
      message: "จำเป็นต้องระบุที่อยู่ลูกค้าก่อนบันทึกข้อมูลงาน"
    });
    if (custAddressInput) custAddressInput.focus();
    return;
  }
  if (!custPhone) {
    showAppAlert({
      type: "warning",
      title: "กรุณากรอกเบอร์โทรศัพท์",
      message: "จำเป็นต้องระบุเบอร์โทรศัพท์ลูกค้าก่อนบันทึกข้อมูลงาน"
    });
    if (custPhoneInput) custPhoneInput.focus();
    return;
  }

  // Category handling
  let finalCategory = selectedAssignCategory;
  if (selectedAssignCategory === "อื่นๆ") {
    const otherText = otherCatInput ? otherCatInput.value.trim() : "";
    if (!otherText) {
      showAppAlert({
        type: "warning",
        title: "ระบุประเภทงานอื่นๆ",
        message: "กรุณากรอกระบุประเภทงานอื่นๆ"
      });
      if (otherCatInput) otherCatInput.focus();
      return;
    }
    finalCategory = `อื่นๆ: ${otherText}`;
  }

  if (selectedAssignTechs.length === 0) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกผู้ปฏิบัติงาน",
      message: "กรุณาเลือกผู้ปฏิบัติงานที่รับผิดชอบงานอย่างน้อย 1 คน"
    });
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

  const creatorName = state.currentLinkedTech?.name || localStorage.getItem("fs_current_operator_name") || "หัวหน้างาน";

  const newTask = {
    id: taskId,
    title: titleDisplay,
    isNew: true,
    createdAt: Date.now(),
    category: finalCategory,
    priority: selectedAssignPriority,
    desc: jobDetail || `งาน ${finalCategory} สำหรับ ${custName}`,
    location: location || custAddress,
    customer: {
      name: custName,
      address: custAddress,
      phone: custPhone,
      email: custEmail || "-",
      lineId: custLineId || "-",
      assigned_by: creatorName,
      creator: creatorName
    },
    techs: [...selectedAssignTechs],
    assignedBy: creatorName,
    creator: creatorName,
    startDate: startDate,
    deadline: deadline,
    status: "กำลังทำ",
    progress: 0,
    latestUpdate: `มอบหมายงานใหม่ [ความเร่งด่วน: ${selectedAssignPriority}]`,
    reason: "-",
    updateBy: creatorName,
    updateTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
  };

  recentNewTaskIds.add(taskId);
  try {
    localStorage.setItem("fs_recent_new_tasks", JSON.stringify(Array.from(recentNewTaskIds)));
  } catch (e) {}

  // 1. Update memory & localStorage immediately (Optimistic Update)
  tasksList.unshift(newTask);
  localStorage.setItem("fs_tasks", JSON.stringify(tasksList));

  // 2. Immediately re-render views so the user instantly sees the new task
  if (onComplete) onComplete([newTask]);

  // 3. Persist to Supabase Database
  try {
    await saveTaskApi(newTask);
  } catch (err) {
    console.warn("saveTaskApi error:", err);
  }

  // 4. Trigger LINE Share Target Picker (Safe non-blocking)
  try {
    const flexCard = createAssignTaskFlexCard(newTask);
    triggerLiffShare(flexCard, "มอบหมายงานใหม่และส่งเข้ากลุ่ม LINE เรียบร้อยแล้ว");
  } catch (shareErr) {
    console.warn("LIFF share error:", shareErr);
  }

  showAppAlert({
    type: "success",
    title: "มอบหมายงานสำเร็จ!",
    message: `บันทึกงาน "${titleDisplay}" (${taskId}) เรียบร้อยแล้ว`
  });
}
