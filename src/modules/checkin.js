/**
 * Field Check-in Module (เช็กอินหน้างาน)
 * Supports:
 * - 1-Tap Assigned Task Selection (Auto-fill)
 * - GPS Geolocation
 * - Up to 5 Compressed Photos
 * - LINE Flex Message Sharing
 */

import { getCurrentCoords, getMapUrl } from '../utils/gps.js';
import { compressMultipleFiles } from '../utils/compressor.js';
import { createCheckinFlexCard, triggerLiffShare } from '../liff/line.js';
import { saveCheckinApi } from '../api/supabase.js';
import { formatThaiDateDisplay } from '../utils/date.js';
import { showAppAlert, showSharePromptDialog } from '../utils/dialog.js';
import { matchesOperator } from './tasks.js';
import { state } from './state.js';

let isSubmittingCheckin = false;
let checkinPhotos = [];
let selectedAssignedTaskId = null;
let cachedTasksList = [];

export function getCheckinPhotos() {
  return checkinPhotos;
}

export function clearCheckinPhotos() {
  checkinPhotos = [];
  renderPhotoPreviews();
}

export function updateQuickCardUI(task) {
  const normalHeader = document.getElementById("checkinNormalHeader");
  const quickCard = document.getElementById("assignedTaskQuickCheckinCard");
  const detailsContainer = document.getElementById("checkinFormDetailsContainer");
  const detailsEditNotice = document.getElementById("checkinDetailsEditNotice");

  if (!quickCard) return;

  if (task) {
    const taskIdEl = document.getElementById("quickCardTaskId");
    const categoryEl = document.getElementById("quickCardCategory");
    const titleEl = document.getElementById("quickCardTitle");
    const descEl = document.getElementById("quickCardDesc");
    const techsEl = document.getElementById("quickCardTechs");
    const deadlineEl = document.getElementById("quickCardDeadline");
    const toggleTextEl = document.getElementById("quickCardToggleText");
    const toggleChevronEl = document.getElementById("quickCardToggleChevron");

    const techList = Array.isArray(task.techs) ? task.techs.join(", ") : (task.techs || "ผู้ปฏิบัติงานทั่วไป");

    if (taskIdEl) taskIdEl.innerText = task.id;
    if (categoryEl) categoryEl.innerText = task.category || "ติดตั้งงานใหม่";
    if (titleEl) titleEl.innerText = task.title;
    if (descEl) descEl.innerText = task.desc && task.desc !== "-" ? task.desc : "ไม่มีรายละเอียดเพิ่มเติม";
    if (techsEl) {
      techsEl.innerText = techList;
      techsEl.title = techList;
    }
    if (deadlineEl) deadlineEl.innerText = formatThaiDateDisplay(task.deadline);
    if (toggleTextEl) toggleTextEl.innerText = "📋 ขยายดูรายละเอียดงาน";
    if (toggleChevronEl) toggleChevronEl.style.transform = "rotate(0deg)";

    if (normalHeader) normalHeader.classList.add("hidden");
    quickCard.classList.remove("hidden");
    
    // By default, collapse details container so the user sees the Quick Card + Big Check-in Button immediately!
    if (detailsContainer) detailsContainer.classList.add("hidden");
    if (detailsEditNotice) detailsEditNotice.classList.remove("hidden");
  } else {
    if (normalHeader) normalHeader.classList.remove("hidden");
    quickCard.classList.add("hidden");
    if (detailsContainer) detailsContainer.classList.remove("hidden");
    if (detailsEditNotice) detailsEditNotice.classList.add("hidden");
  }
}

export function deselectAssignedTask(tasksList = null) {
  selectedAssignedTaskId = null;
  const locInput = document.getElementById("fieldLocationInput");
  const noteInput = document.getElementById("fieldNoteInput");
  if (locInput) locInput.value = "";
  if (noteInput) noteInput.value = "";
  if (typeof window.selectJobType === "function") {
    window.selectJobType("ติดตั้งงานใหม่");
  }
  updateQuickCardUI(null);
  const listToRender = tasksList || cachedTasksList;
  if (listToRender && listToRender.length > 0) {
    renderAssignedTasksBanner(listToRender, [], null);
  }
}

export function toggleCheckinFormDetails() {
  const detailsContainer = document.getElementById("checkinFormDetailsContainer");
  const toggleTextEl = document.getElementById("quickCardToggleText");
  const toggleChevronEl = document.getElementById("quickCardToggleChevron");

  if (!detailsContainer) return;
  const isHidden = detailsContainer.classList.contains("hidden");

  if (isHidden) {
    detailsContainer.classList.remove("hidden");
    if (toggleTextEl) toggleTextEl.innerText = "▲ ย่อรายละเอียดกลับ";
    if (toggleChevronEl) toggleChevronEl.style.transform = "rotate(180deg)";
    detailsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    detailsContainer.classList.add("hidden");
    if (toggleTextEl) toggleTextEl.innerText = "📋 ขยายดูรายละเอียดงาน";
    if (toggleChevronEl) toggleChevronEl.style.transform = "rotate(0deg)";
  }
}

export function renderAssignedTasksBanner(tasksList, allTechnicians, onSelectTask, currentOperatorName = null, isAdminArg = null) {
  if (Array.isArray(tasksList)) cachedTasksList = tasksList;
  const container = document.getElementById("assignedTasksCheckinContainer");
  if (!container) return;

  const isAdmin = (typeof isAdminArg === "boolean")
    ? isAdminArg
    : (state.currentUserRole === "admin" || (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()));

  const opName = currentOperatorName || state.currentLinkedTech?.name || localStorage.getItem("fs_current_operator_name");

  // Filter tasks that are in progress or pending
  let pendingTasks = (tasksList || []).filter(t => t.status !== "เสร็จสิ้น");

  // If Operator (non-admin), ONLY show their assigned tasks or tasks they created!
  if (!isAdmin) {
    if (opName) {
      pendingTasks = pendingTasks.filter(t => {
        const techs = Array.isArray(t.techs) ? t.techs : (typeof t.techs === 'string' ? t.techs.split(',').map(s => s.trim()) : []);
        const isAssignedToMe = techs.some(tech => matchesOperator(tech, opName));
        const isCreatedByMe = matchesOperator(t.assignedBy, opName) ||
          matchesOperator(t.creator, opName) ||
          matchesOperator(t.customer?.assigned_by, opName) ||
          matchesOperator(t.customer?.creator, opName) ||
          matchesOperator(t.updateBy, opName) ||
          matchesOperator(t.updated_by, opName);
        return isAssignedToMe || isCreatedByMe;
      });
    } else {
      pendingTasks = [];
    }
  }

  if (pendingTasks.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
        ${!isAdmin && opName
          ? `ไม่มีงานมอบหมายค้างอยู่ของ <strong>${opName}</strong> ในขณะนี้ (สามารถกรอกสถานที่เพื่อเช็กอินงานทั่วไปได้เลย)`
          : `ไม่มีงานมอบหมายค้างอยู่ สามารถกรอกสถานที่เพื่อเช็กอินงานทั่วไปได้เลย`}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-bold text-slate-800 flex items-center space-x-1.5">
          <span>📋</span>
          <span>${!isAdmin && currentOperatorName ? `งานที่คุณได้รับมอบหมาย (${currentOperatorName}):` : `งานที่ได้รับมอบหมาย (แตะเพื่อเช็กอินทันที):`}</span>
        </span>
        <span class="text-[11px] text-blue-600 font-semibold">${pendingTasks.length} งาน</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5 no-scrollbar">
        ${pendingTasks.map(task => {
          const isSelected = selectedAssignedTaskId === task.id;
          const techList = Array.isArray(task.techs) ? task.techs.join(", ") : (task.techs || "ผู้ปฏิบัติงานทั่วไป");
          return `
            <div onclick="window.selectAssignedTaskForCheckin('${task.id}')" class="p-3 rounded-xl border text-xs cursor-pointer transition-all ${
              isSelected 
                ? 'bg-blue-50 border-2 border-blue-600 shadow-sm ring-2 ring-blue-200' 
                : 'bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs'
            }">
              <div class="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-950 text-white font-mono flex-shrink-0 shadow-2xs">${task.id}</span>
                <span class="text-xs font-medium text-slate-600 truncate text-right">
                  กำหนดส่ง: <strong class="font-bold text-blue-700">${formatThaiDateDisplay(task.deadline)}</strong>
                </span>
              </div>
              <div class="font-bold text-sm text-slate-950 line-clamp-1 leading-snug">${task.title}</div>
              <div class="text-xs text-slate-600 mt-2 font-medium flex items-center space-x-1.5 min-w-0" title="ผู้ปฏิบัติงาน: ${techList.replace(/"/g, '&quot;')}">
                <span class="flex-shrink-0 whitespace-nowrap font-semibold">👤 ผู้ปฏิบัติงาน:</span>
                <strong class="text-slate-800 truncate min-w-0 font-bold block" title="${techList.replace(/"/g, '&quot;')}">${techList}</strong>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function selectAssignedTask(taskId, tasksList, setSelectedTechsCallback) {
  if (Array.isArray(tasksList)) cachedTasksList = tasksList;
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

  if (selectedAssignedTaskId === taskId) {
    // Deselect if already selected
    deselectAssignedTask(tasksList);
  } else {
    selectedAssignedTaskId = taskId;
    const locInput = document.getElementById("fieldLocationInput");
    const noteInput = document.getElementById("fieldNoteInput");
    if (locInput) locInput.value = task.title;
    if (noteInput) noteInput.value = task.desc && task.desc !== "-" ? task.desc : "";

    // Auto-select assigned technicians
    if (setSelectedTechsCallback && task.techs && task.techs.length > 0) {
      setSelectedTechsCallback(task.techs);
    }

    // Auto-link and select assigned Job Category!
    if (task.category && typeof window.selectJobType === "function") {
      window.selectJobType(task.category);
    }

    // Update Quick Card UI
    updateQuickCardUI(task);
  }

  // Highlight selected card
  renderAssignedTasksBanner(tasksList, [], null);
}

export async function handlePhotoUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const currentCount = checkinPhotos.length;
  const remainingSlots = 5 - currentCount;
  if (remainingSlots <= 0) {
    showAppAlert({
      type: "warning",
      title: "แนบรูปครบแล้ว",
      message: "แนบรูปได้สูงสุด 5 รูปแล้ว"
    });
    return;
  }

  const newCompressed = await compressMultipleFiles(files, remainingSlots);
  checkinPhotos = [...checkinPhotos, ...newCompressed].slice(0, 5);
  renderPhotoPreviews();
  event.target.value = ""; // Reset input
}

export function removePhoto(index) {
  checkinPhotos.splice(index, 1);
  renderPhotoPreviews();
}

export function renderPhotoPreviews() {
  const container = document.getElementById("checkinPhotoPreviewsContainer");
  const countBadge = document.getElementById("checkinPhotoCountBadge");
  if (!container) return;

  if (countBadge) {
    countBadge.innerText = `${checkinPhotos.length}/5 รูป`;
    if (checkinPhotos.length === 5) {
      countBadge.className = "text-xs font-bold font-mono px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs";
    } else if (checkinPhotos.length > 0) {
      countBadge.className = "text-xs font-bold font-mono px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs";
    } else {
      countBadge.className = "text-xs font-bold font-mono px-3 py-1 rounded-full bg-white text-slate-700 border border-slate-300 shadow-2xs";
    }
  }

  if (checkinPhotos.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-400 italic px-2">ยังไม่มีรูปถ่ายที่แนบ</div>`;
    return;
  }

  container.innerHTML = "";
  checkinPhotos.forEach((photo, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white ring-1 ring-slate-200 shadow-xs group flex-shrink-0 animate-pop-in";
    thumb.innerHTML = `
      <img src="${photo.dataUrl}" class="w-full h-full object-cover" alt="photo ${idx + 1}">
      <span class="absolute top-1 left-1 bg-slate-900/80 text-white font-mono font-bold text-[9px] px-1.5 py-0.2 rounded-md">#${idx + 1}</span>
      <button type="button" onclick="window.removeCheckinPhoto(${idx})" class="absolute top-1 right-1 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold flex items-center justify-center shadow-xs transition-transform active:scale-90" title="ลบรูปนี้">
        ✕
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent text-[9px] text-white text-center py-0.5 font-mono">
        ${photo.sizeKb}KB
      </div>
    `;
    container.appendChild(thumb);
  });
}

export async function submitCheckinForm({ selectedTechs, selectedJobType, customJobType, locationText, noteText, onComplete }) {
  if (isSubmittingCheckin) return;

  if (selectedTechs.length === 0) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกผู้ปฏิบัติงาน",
      message: "กรุณาเลือกผู้ปฏิบัติงานอย่างน้อย 1 คนก่อนเช็กอิน"
    });
    return;
  }

  let finalJobTitle = "";
  if (locationText.trim()) {
    finalJobTitle = locationText.trim();
  } else if (selectedJobType === "custom" && customJobType.trim()) {
    finalJobTitle = customJobType.trim();
  } else if (selectedJobType) {
    finalJobTitle = selectedJobType;
  } else {
    showAppAlert({
      type: "warning",
      title: "ข้อมูลไม่ครบถ้วน",
      message: "กรุณากรอกสถานที่ / ไซต์งาน หรือเลือกงานมอบหมาย"
    });
    return;
  }

  isSubmittingCheckin = true;
  const checkinBtns = document.querySelectorAll('button[onclick="submitCheckin()"]');
  checkinBtns.forEach(btn => {
    btn.disabled = true;
    btn.dataset.origHtml = btn.innerHTML;
    btn.innerHTML = `<span>⏳ กำลังบันทึกการเช็กอิน...</span>`;
  });

  try {
    const coords = getCurrentCoords();
    const now = new Date();
    const checkinId = `CHK-${Math.floor(1000 + Math.random() * 9000)}`;
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("th-TH");
    const mapUrl = coords.isReady ? getMapUrl(coords.lat, coords.lng) : "";

    const checkinRecord = {
      id: checkinId,
      taskId: selectedAssignedTaskId,
      task: finalJobTitle,
      techs: [...selectedTechs],
      time: timeStr,
      date: dateStr,
      lat: coords.lat || "",
      lng: coords.lng || "",
      mapUrl: mapUrl,
      note: noteText.trim() || "-",
      photoCount: 0,
      photos: []
    };

    // 1. Prepare LINE Flex Card
    const flexCard = createCheckinFlexCard({
      id: checkinId,
      task: finalJobTitle,
      techs: selectedTechs,
      time: timeStr,
      coords: coords.isReady ? `${coords.lat}, ${coords.lng}` : null,
      mapUrl: mapUrl,
      photoCount: 0,
      taskId: selectedAssignedTaskId
    });

    // 2. Realtime sync to Supabase Database
    await saveCheckinApi(checkinRecord);

    // Reset form
    clearCheckinPhotos();
    deselectAssignedTask();
    if (onComplete) onComplete(checkinRecord);

    // 3. Prompt user to Share to LINE (Direct User Gesture)
    showSharePromptDialog({
      title: "เช็กอินเข้าหน้างานสำเร็จ!",
      message: `บันทึกเวลาเข้างาน (${timeStr} น.) เรียบร้อยแล้ว\n\nต้องการส่งการ์ดเช็กอินเข้ากลุ่ม LINE ตอนนี้หรือไม่?`,
      shareBtnText: "💬 เลือกกลุ่ม LINE และส่งการ์ดเช็กอิน",
      skipBtnText: "เสร็จสิ้น / ไว้แชร์ทีหลัง",
      onShare: () => {
        triggerLiffShare(flexCard, "เช็กอินเข้าหน้างานและส่งการ์ดเข้า LINE สำเร็จ!");
      }
    });
  } catch (err) {
    console.error("submitCheckinForm error:", err);
    showAppAlert({
      type: "error",
      title: "เกิดข้อผิดพลาด",
      message: "ไม่สามารถบันทึกการเช็กอินได้ กรุณาลองใหม่อีกครั้ง"
    });
  } finally {
    isSubmittingCheckin = false;
    checkinBtns.forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
    });
  }
}

let selectedJobType = "ติดตั้งกล้องวงจรปิด";

export function getSelectedJobType() {
  return selectedJobType;
}

export function selectJobType(type) {
  const standardTypes = [
    "ติดตั้งงานใหม่",
    "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)",
    "งานเซอร์วิส (มีค่าใช้จ่าย)",
    "งาน PM (Preventive Maintenance)",
    "เข้าตรวจสอบหน้างาน / สำรวจ",
    "custom"
  ];

  let targetType = type || "ติดตั้งงานใหม่";

  if (targetType === "ติดตั้งกล้องวงจรปิด" || targetType === "ติดตั้งงานใหม่") {
    targetType = "ติดตั้งงานใหม่";
  } else if (targetType.includes("ไม่มีค่าใช้จ่าย") || targetType.includes("ในประกัน") || targetType.includes("ฟรี") || targetType === "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)") {
    targetType = "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)";
  } else if (targetType.includes("มีค่าใช้จ่าย")) {
    targetType = "งานเซอร์วิส (มีค่าใช้จ่าย)";
  } else if (targetType.toUpperCase().includes("PM") || targetType.includes("บำรุง")) {
    targetType = "งาน PM (Preventive Maintenance)";
  } else if (targetType.includes("สำรวจ") || targetType.includes("ตรวจสอบ")) {
    targetType = "เข้าตรวจสอบหน้างาน / สำรวจ";
  } else if (targetType.includes("ซ่อม") || targetType.includes("ปรับมุม") || targetType.includes("เซอร์วิส") || targetType.includes("ประกัน")) {
    targetType = "งานเซอร์วิส (ไม่มีค่าใช้จ่าย อยู่ในประกัน)";
  } else if (!standardTypes.includes(targetType)) {
    const customInput = document.getElementById("customJobTypeInput");
    if (customInput && targetType !== "custom") {
      customInput.value = targetType.replace(/^อื่นๆ:?\s*/, "");
    }
    targetType = "custom";
  }

  selectedJobType = targetType;
  const customContainer = document.getElementById("customJobTypeContainer");
  if (customContainer) {
    if (targetType === "custom") customContainer.classList.remove("hidden");
    else customContainer.classList.add("hidden");
  }

  standardTypes.forEach(t => {
    const btn = document.getElementById(`jobTypeBtn-${t}`);
    if (btn) {
      if (t === targetType) {
        btn.className = "py-2.5 px-3 rounded-xl border-2 text-xs font-bold text-center transition-all bg-blue-600 text-white border-blue-600 shadow-sm";
      } else {
        btn.className = "py-2.5 px-3 rounded-xl border-2 text-xs font-semibold text-center transition-all bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300";
      }
    }
  });
}

