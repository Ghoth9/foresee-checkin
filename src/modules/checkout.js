/**
 * Field Update & Close Module (อัปเดตงาน & ปิดงานหน้างาน)
 * Handles both:
 * 1. Progress updates when work is ongoing (% progress, status, photos, LINE share)
 * 2. Final completion check-out when work is 100% finished
 */

import { compressMultipleFiles } from '../utils/compressor.js';
import { createCheckoutFlexCard, createProgressFlexCard, triggerLiffShare } from '../liff/line.js';
import { saveCheckoutApi, updateTaskProgressApi } from '../api/supabase.js';
import { formatGasTime } from '../utils/date.js';
import { showAppAlert } from '../utils/dialog.js';

let checkoutPhotos = [];
let currentActionTab = "update"; // "update" or "close"
let updatePercent = 50;
let updateStatus = "กำลังทำ";

export function getCheckoutPhotos() {
  return checkoutPhotos;
}

export function clearCheckoutPhotos() {
  checkoutPhotos = [];
  renderCheckoutPhotoPreviews();
}

export function setActionTab(tab) {
  currentActionTab = tab;
  const updatePanel = document.getElementById("actionPanelUpdate");
  const closePanel = document.getElementById("actionPanelClose");
  const tabBtnUpdate = document.getElementById("actionTabBtnUpdate");
  const tabBtnClose = document.getElementById("actionTabBtnClose");

  if (tab === "update") {
    if (updatePanel) {
      updatePanel.classList.remove("hidden");
      updatePanel.classList.add("animate-fade-in");
    }
    if (closePanel) closePanel.classList.add("hidden");
    if (tabBtnUpdate) tabBtnUpdate.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 bg-white text-blue-700 shadow-sm border border-slate-200/80 flex items-center justify-center space-x-1.5 active:scale-[0.98]";
    if (tabBtnClose) tabBtnClose.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1.5 active:scale-[0.98]";
  } else {
    if (closePanel) {
      closePanel.classList.remove("hidden");
      closePanel.classList.add("animate-fade-in");
    }
    if (updatePanel) updatePanel.classList.add("hidden");
    if (tabBtnClose) tabBtnClose.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 bg-white text-emerald-700 shadow-sm border border-slate-200/80 flex items-center justify-center space-x-1.5 active:scale-[0.98]";
    if (tabBtnUpdate) tabBtnUpdate.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1.5 active:scale-[0.98]";
  }
  updateCheckoutSubmitButtonsState();
}

export function setUpdatePercent(val) {
  updatePercent = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
  const numElem = document.getElementById("checkoutUpdateProgressNum");
  if (numElem) numElem.innerText = `${updatePercent}%`;

  const barElem = document.getElementById("checkoutUpdateProgressBarFill");
  if (barElem) barElem.style.width = `${updatePercent}%`;

  [25, 50, 75, 90].forEach(p => {
    const btn = document.getElementById(`checkoutQuickProg-${p}`);
    if (btn) {
      if (p === updatePercent) {
        btn.className = "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all bg-blue-600 text-white border-blue-600 shadow-xs";
      } else {
        btn.className = "py-1.5 px-2 rounded-lg text-xs font-medium border transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export function setUpdateStatus(st) {
  updateStatus = st;
  const statuses = [
    { key: "กำลังทำ", activeClass: "bg-blue-600 text-white border-blue-600 shadow-xs" },
    { key: "เสร็จสิ้น", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs" }
  ];

  statuses.forEach(s => {
    const btn = document.getElementById(`checkoutStatusChoice-${s.key}`);
    if (btn) {
      if (s.key === st) {
        btn.className = `py-2 px-3 rounded-lg border text-center text-xs font-bold transition-all ${s.activeClass}`;
      } else {
        btn.className = "py-2 px-3 rounded-lg border text-center text-xs font-medium transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export async function handleCheckoutPhotoUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const currentCount = checkoutPhotos.length;
  const remainingSlots = 10 - currentCount;
  if (remainingSlots <= 0) {
    showAppAlert({
      type: "warning",
      title: "แนบรูปครบแล้ว",
      message: "แนบรูปได้สูงสุด 10 รูปแล้ว"
    });
    return;
  }

  const newCompressed = await compressMultipleFiles(files, remainingSlots);
  checkoutPhotos = [...checkoutPhotos, ...newCompressed].slice(0, 10);
  renderCheckoutPhotoPreviews();
  event.target.value = "";
}

export function removeCheckoutPhoto(index) {
  checkoutPhotos.splice(index, 1);
  renderCheckoutPhotoPreviews();
}

export function renderCheckoutPhotoPreviews() {
  const containers = [
    document.getElementById("checkoutPhotoPreviewsContainer"),
    document.getElementById("checkoutClosePhotoPreviewsContainer")
  ].filter(Boolean);

  const countBadges = [
    document.getElementById("checkoutPhotoCountBadge"),
    document.getElementById("checkoutClosePhotoCountBadge")
  ].filter(Boolean);

  const isMet = checkoutPhotos.length >= 5;
  countBadges.forEach(badge => {
    badge.innerText = `${checkoutPhotos.length} รูป ${isMet ? '(✓ ครบขั้นต่ำ 5 รูป)' : '(ต้องการอย่างน้อย 5 รูป)'}`;
    if (isMet) {
      badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300";
    } else {
      badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300";
    }
  });

  containers.forEach(container => {
    container.innerHTML = "";
    checkoutPhotos.forEach((photo, idx) => {
      const thumb = document.createElement("div");
      thumb.className = "relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group flex-shrink-0 animate-pop-in shadow-2xs";
      thumb.innerHTML = `
        <img src="${photo.dataUrl}" class="w-full h-full object-cover" alt="photo ${idx + 1}">
        <button type="button" onclick="window.removeCheckoutPhoto(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600 text-white rounded-full text-xs flex items-center justify-center shadow-xs hover:bg-rose-700 active:scale-90 transition-transform">
          ×
        </button>
        <div class="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[9px] text-white text-center py-0.2">
          ${photo.sizeKb}KB
        </div>
      `;
      container.appendChild(thumb);
    });
  });

  updateCheckoutSubmitButtonsState();
}

export function updateCheckoutSubmitButtonsState() {
  const updateBtn = document.getElementById("submitUpdateBtn");
  const checkoutBtn = document.getElementById("submitCheckoutBtn");

  // 1. Progress Update Button
  if (updateBtn) {
    updateBtn.disabled = false;
    updateBtn.className = "w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm shadow-md shadow-blue-500/20 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer";
    if (checkoutPhotos.length === 0) {
      updateBtn.innerHTML = `<span>📊 อัปเดตความคืบหน้า & ส่งรายงานเข้ากลุ่ม LINE</span>`;
    } else {
      updateBtn.innerHTML = `<span>📊 อัปเดตความคืบหน้า & ส่งรายงานเข้ากลุ่ม LINE (แนบรูป ${checkoutPhotos.length} รูป)</span>`;
    }
  }

  // 2. Final Checkout Button (Must have at least 5 photos)
  if (checkoutBtn) {
    if (checkoutPhotos.length < 5) {
      checkoutBtn.disabled = true;
      checkoutBtn.className = "w-full bg-slate-200 text-slate-400 font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm cursor-not-allowed border border-slate-300 transition-all duration-200 flex items-center justify-center space-x-2 select-none shadow-none";
      checkoutBtn.innerHTML = `<span>🔒 แนบรูปให้ครบอย่างน้อย 5 รูปเพื่อปิดงาน (${checkoutPhotos.length}/5)</span>`;
    } else {
      checkoutBtn.disabled = false;
      checkoutBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm shadow-md shadow-emerald-500/20 transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer";
      checkoutBtn.innerHTML = `<span>🏁 บันทึกปิดงาน & ส่งสรุปเข้ากลุ่ม LINE (แนบแล้ว ${checkoutPhotos.length} รูป)</span>`;
    }
  }
}

export function calculateDuration(checkinTimeStr) {
  if (!checkinTimeStr || checkinTimeStr === "-") return "ตามเวลาปฏิบัติงาน";
  try {
    const cleanTime = formatGasTime(checkinTimeStr);
    const parts = cleanTime.split(":");
    if (parts.length < 2) return "ตามเวลาปฏิบัติงาน";

    const inHours = parseInt(parts[0], 10);
    const inMins = parseInt(parts[1], 10);
    if (isNaN(inHours) || isNaN(inMins)) return "ตามเวลาปฏิบัติงาน";

    const now = new Date();
    const inDate = new Date();
    inDate.setHours(inHours, inMins, 0, 0);

    let diffMs = now.getTime() - inDate.getTime();
    if (diffMs < 0) diffMs = 0;

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours} ชม. ${diffMinutes} นาที`;
    }
    return `${diffMinutes} นาที`;
  } catch (e) {
    return "ตามเวลาปฏิบัติงาน";
  }
}

// -------------------------------------------------------------
// SUBMIT: PROGRESS UPDATE (MODE 1: งานยังไม่เสร็จ)
// -------------------------------------------------------------
export async function submitProgressOnly({
  activeItem,
  noteText,
  closerName,
  onComplete
}) {
  if (!activeItem) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกงาน",
      message: "กรุณาเลือกงานที่ต้องการอัปเดต"
    });
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("th-TH");
  const updateEntry = `[คืบหน้า ${updatePercent}%: ${updateStatus}] ${noteText.trim() || 'อัปเดตงานตามขั้นตอน'} (โดย ${closerName || 'ช่างหน้างาน'} เมื่อ ${dateStr} ${timeStr})`;

  // 1. Send Progress Flex Card
  const flexCard = createProgressFlexCard({
    id: activeItem.id,
    taskId: activeItem.taskId || activeItem.id,
    taskTitle: activeItem.task,
    techs: activeItem.techs,
    progress: updatePercent,
    status: updateStatus,
    note: noteText.trim() || "อัปเดตความคืบหน้าระหว่างปฏิบัติงาน",
    updateBy: closerName || "ช่างหน้างาน",
    updateTime: timeStr,
    photoCount: checkoutPhotos.length
  });

  // 2. Sync to Supabase Database & Timeline
  const apiRes = await updateTaskProgressApi({
    taskId: activeItem.taskId || activeItem.id,
    taskTitle: activeItem.task,
    progress: updatePercent,
    status: updateStatus,
    note: noteText.trim() || "-",
    updateBy: closerName || "ช่างหน้างาน",
    updateEntry: updateEntry,
    photos: checkoutPhotos
  });

  // 3. Share to LINE
  const shareRes = await triggerLiffShare(flexCard, "อัปเดตความคืบหน้างานและส่งเข้า LINE สำเร็จ!");

  const savedPhotos = [...checkoutPhotos];
  clearCheckoutPhotos();

  if (onComplete) onComplete({
    id: activeItem.id,
    task: activeItem.task,
    status: updateStatus,
    progress: updatePercent,
    latestUpdate: updateEntry,
    photos: savedPhotos,
    historyItem: apiRes?.historyItem,
    lineShared: !!(shareRes && shareRes.success)
  });
}

// -------------------------------------------------------------
// SUBMIT: FINAL COMPLETION (MODE 2: งานเสร็จสิ้น 100%)
// -------------------------------------------------------------
export async function submitCheckoutForm({
  activeItem,
  selectedOutcome,
  noteText,
  closerName,
  onComplete
}) {
  if (!activeItem) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกงาน",
      message: "กรุณาเลือกงานที่ต้องการปิด"
    });
    return;
  }
  if (!selectedOutcome) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกผลงาน",
      message: "กรุณาเลือกสรุปผลการปฏิบัติงาน"
    });
    return;
  }

  if (selectedOutcome === "ติดปัญหา" && (!noteText || !noteText.trim())) {
    showAppAlert({
      type: "warning",
      title: "จำเป็นต้องระบุปัญหา",
      message: "กรณีติดปัญหา กรุณาระบุรายละเอียดปัญหาที่พบ"
    });
    const noteEl = document.getElementById("checkoutNoteInput");
    if (noteEl) noteEl.focus();
    return;
  }

  // Client requirement: Minimum 5 photos required to close job
  if (checkoutPhotos.length < 5) {
    showAppAlert({
      type: "warning",
      title: "รูปถ่ายไม่ครบตามกำหนด",
      message: `กรุณาแนบรูปภาพการดำเนินงานเพื่อปิดงานอย่างน้อย 5 รูปภาพ (ปัจจุบันแนบแล้ว ${checkoutPhotos.length}/5 รูป)`
    });
    return;
  }

  const now = new Date();
  const outTimeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  const durationStr = calculateDuration(activeItem.time);

  const payload = {
    id: activeItem.id,
    taskId: activeItem.taskId || null,
    task: activeItem.task,
    techs: activeItem.techs,
    inTime: formatGasTime(activeItem.time),
    outTime: outTimeStr,
    duration: durationStr,
    outcome: selectedOutcome,
    note: noteText.trim() || "-",
    closedBy: closerName || "ช่างหน้างาน",
    photoCount: checkoutPhotos.length,
    photos: checkoutPhotos.map(p => ({ name: p.name, base64: p.base64, sizeKb: p.sizeKb }))
  };

  // 1. Flex Message
  const flexCard = createCheckoutFlexCard({
    id: activeItem.id,
    task: activeItem.task,
    techs: activeItem.techs,
    inTime: formatGasTime(activeItem.time),
    outTime: outTimeStr,
    duration: durationStr,
    outcome: selectedOutcome,
    note: noteText.trim() || "",
    photoCount: checkoutPhotos.length
  });

  // 2. Realtime sync to GAS
  saveCheckoutApi(payload);

  // 3. Share to LINE
  await triggerLiffShare(flexCard, "ปิดงานและส่งสรุปผลงานเข้า LINE สำเร็จ!");

  // Reset
  clearCheckoutPhotos();
  if (onComplete) onComplete(payload);
}
