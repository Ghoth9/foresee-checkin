/**
 * Field Update & Close Module (อัปเดตงาน & ปิดงานหน้างาน)
 * Handles both:
 * 1. Progress updates when work is ongoing (% progress, status, photos, LINE share)
 * 2. Final completion check-out when work is 100% finished
 */

import { compressMultipleFiles } from '../utils/compressor.js';
import { createCheckoutFlexCard, createProgressFlexCard, triggerLiffShare } from '../liff/line.js';
import { saveCheckoutApi, updateTaskProgressApi } from '../api/supabase.js';
import { formatGasTime, parseDeadlineDate } from '../utils/date.js';
import { showAppAlert, showSharePromptDialog } from '../utils/dialog.js';
import { state } from './state.js';
import { getTaskMemberStatuses } from '../utils/taskMembers.js';

let checkoutPhotos = [];
let currentActionTab = "update"; // "update" or "close"
let updatePercent = 50;
let updateStatus = "กำลังทำ";
let isDailyCheckoutMode = true;

export function setDailyCheckoutMode(val) {
  isDailyCheckoutMode = !!val;
  const btnTrue = document.getElementById("dailyCheckoutModeBtn-true");
  const btnFalse = document.getElementById("dailyCheckoutModeBtn-false");
  if (btnTrue && btnFalse) {
    if (isDailyCheckoutMode) {
      btnTrue.className = "py-2 px-3 rounded-xl border text-left transition-all bg-blue-600 text-white border-blue-600 shadow-xs cursor-pointer active:scale-95";
      btnFalse.className = "py-2 px-3 rounded-xl border text-left transition-all bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs cursor-pointer active:scale-95";
    } else {
      btnTrue.className = "py-2 px-3 rounded-xl border text-left transition-all bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs cursor-pointer active:scale-95";
      btnFalse.className = "py-2 px-3 rounded-xl border text-left transition-all bg-blue-600 text-white border-blue-600 shadow-xs cursor-pointer active:scale-95";
    }
  }
  updateCheckoutSubmitButtonsState();
}
if (typeof window !== "undefined") {
  window.setDailyCheckoutMode = setDailyCheckoutMode;
}

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
  const updateBtn = document.getElementById("submitUpdateBtn");
  const checkoutBtn = document.getElementById("submitCheckoutBtn");

  if (tab === "update") {
    if (updatePanel) {
      updatePanel.classList.remove("hidden");
      updatePanel.classList.add("animate-fade-in");
    }
    if (closePanel) closePanel.classList.add("hidden");
    if (updateBtn) updateBtn.classList.remove("hidden");
    if (checkoutBtn) checkoutBtn.classList.add("hidden");
    if (tabBtnUpdate) tabBtnUpdate.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 bg-white text-blue-700 shadow-sm border border-slate-200/80 flex items-center justify-center space-x-1.5 active:scale-[0.98]";
    if (tabBtnClose) tabBtnClose.className = "flex-1 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1.5 active:scale-[0.98]";
  } else {
    if (closePanel) {
      closePanel.classList.remove("hidden");
      closePanel.classList.add("animate-fade-in");
    }
    if (updatePanel) updatePanel.classList.add("hidden");
    if (checkoutBtn) checkoutBtn.classList.remove("hidden");
    if (updateBtn) updateBtn.classList.add("hidden");
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
  updateCheckoutSubmitButtonsState();
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
  const updateContainer = document.getElementById("checkoutPhotoPreviewsContainer");
  const closeContainer = document.getElementById("checkoutClosePhotoPreviewsContainer");
  const updateBadge = document.getElementById("checkoutPhotoCountBadge");
  const closeBadge = document.getElementById("checkoutClosePhotoCountBadge");

  // 1. Update Progress Badge (requires 1-5 photos)
  if (updateBadge) {
    if (checkoutPhotos.length === 0) {
      updateBadge.innerText = "0/5 รูป (ต้องแนบอย่างน้อย 1 รูป)";
      updateBadge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300";
    } else {
      updateBadge.innerText = `${checkoutPhotos.length}/5 รูป (✓ พร้อมส่ง)`;
      updateBadge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300";
    }
  }

  // 2. Final Close Badge (requires at least 5 photos)
  if (closeBadge) {
    const isCloseMet = checkoutPhotos.length >= 5;
    closeBadge.innerText = `${checkoutPhotos.length}/5 รูป ${isCloseMet ? '(✓ ครบขั้นต่ำ 5 รูป)' : '(ต้องการอย่างน้อย 5 รูป)'}`;
    closeBadge.className = isCloseMet
      ? "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300"
      : "text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300";
  }

  [updateContainer, closeContainer].filter(Boolean).forEach(container => {
    container.innerHTML = "";
    checkoutPhotos.forEach((photo, idx) => {
      const thumb = document.createElement("div");
      thumb.className = "relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group flex-shrink-0 animate-pop-in shadow-2xs";
      thumb.innerHTML = `
        <img src="${photo.dataUrl}" class="w-full h-full object-cover" alt="photo ${idx + 1}">
        <button type="button" onclick="window.removeCheckoutPhoto(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600 text-white rounded-full text-xs flex items-center justify-center shadow-xs hover:bg-rose-700 active:scale-90 transition-transform">
          ✕
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

  const isUpdateTab = currentActionTab === "update";

  // 1. Progress Update Button (Requires at least 1 photo)
  if (updateBtn) {
    if (!isUpdateTab) {
      updateBtn.classList.add("hidden");
    } else {
      updateBtn.classList.remove("hidden");
      if (checkoutPhotos.length === 0) {
        updateBtn.disabled = true;
        updateBtn.className = "w-full bg-slate-100 text-slate-400 font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-200 cursor-not-allowed transition-all flex items-center justify-center space-x-1.5 select-none";
        updateBtn.innerHTML = `<span>แนบรูปอย่างน้อย 1 รูปเพื่อส่งงาน (0/5)</span>`;
      } else {
        updateBtn.disabled = false;
        updateBtn.className = "w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer";
        updateBtn.innerHTML = isDailyCheckoutMode
          ? `<span>บันทึกเช็กเอาต์จบวันนี้ (${updatePercent}%) • ${checkoutPhotos.length} รูป</span>`
          : `<span>ส่งความคืบหน้า (${updatePercent}%) • ${checkoutPhotos.length} รูป</span>`;
      }
    }
  }

  // 2. Final Checkout Button (Must have at least 5 photos)
  if (checkoutBtn) {
    if (isUpdateTab) {
      checkoutBtn.classList.add("hidden");
    } else {
      checkoutBtn.classList.remove("hidden");
      if (checkoutPhotos.length < 5) {
        checkoutBtn.disabled = true;
        checkoutBtn.className = "w-full bg-slate-100 text-slate-400 font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-200 cursor-not-allowed transition-all flex items-center justify-center space-x-1.5 select-none";
        checkoutBtn.innerHTML = `<span>แนบรูปอย่างน้อย 5 รูปเพื่อปิดงาน (${checkoutPhotos.length}/5)</span>`;
      } else {
        checkoutBtn.disabled = false;
        checkoutBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer";
        checkoutBtn.innerHTML = `<span>บันทึกปิดงาน 100% • ${checkoutPhotos.length} รูป</span>`;
      }
    }
  }
}

export function calculateDuration(checkinTimeStr, checkinDateStr = null, createdAt = null) {
  if (!checkinTimeStr || checkinTimeStr === "-") return "ตามเวลาปฏิบัติงาน";
  try {
    let inDate = null;

    // 1. If createdAt ISO timestamp is provided, use it directly
    if (createdAt) {
      const parsed = new Date(createdAt);
      if (!isNaN(parsed.getTime())) {
        inDate = parsed;
      }
    }

    // 2. If not parsed yet, combine checkinDateStr and checkinTimeStr
    if (!inDate) {
      const cleanTime = formatGasTime(checkinTimeStr);
      const parts = cleanTime.split(":");
      if (parts.length >= 2) {
        const inHours = parseInt(parts[0], 10);
        const inMins = parseInt(parts[1], 10);
        if (!isNaN(inHours) && !isNaN(inMins)) {
          if (checkinDateStr && checkinDateStr !== "วันนี้" && checkinDateStr !== "-") {
            const parsedDate = parseDeadlineDate(checkinDateStr);
            if (parsedDate) {
              inDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), inHours, inMins, 0, 0);
            }
          }
          if (!inDate) {
            inDate = new Date();
            inDate.setHours(inHours, inMins, 0, 0);
          }
        }
      }
    }

    if (!inDate) return "ตามเวลาปฏิบัติงาน";

    const now = new Date();
    let diffMs = now.getTime() - inDate.getTime();
    if (diffMs < 0) diffMs = 0;

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      if (diffHours > 0) {
        return `${diffDays} วัน ${diffHours} ชม.`;
      }
      return `${diffDays} วัน`;
    }
    if (diffHours > 0) {
      return `${diffHours} ชม. ${diffMinutes} นาที`;
    }
    if (diffMinutes > 0) {
      return `${diffMinutes} นาที`;
    }
    return "เพิ่งเริ่มงาน";
  } catch (e) {
    return "ตามเวลาปฏิบัติงาน";
  }
}

// -------------------------------------------------------------
// SUBMIT: PROGRESS UPDATE (MODE 1: งานยังไม่เสร็จ)
// -------------------------------------------------------------
let isSubmittingProgress = false;
let isSubmittingCheckout = false;

export async function submitProgressOnly({
  activeItem,
  noteText,
  closerName,
  totalPhotosCount = 0,
  onComplete
}) {
  if (isSubmittingProgress) return;

  if (!activeItem) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เลือกงาน",
      message: "กรุณาเลือกงานที่ต้องการอัปเดต"
    });
    return;
  }

  isSubmittingProgress = true;
  const updateBtn = document.getElementById("submitUpdateBtn");
  if (updateBtn) {
    updateBtn.disabled = true;
    updateBtn.className = "w-full bg-slate-400 text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm cursor-wait transition-all flex items-center justify-center space-x-2 select-none";
    updateBtn.innerHTML = `<span>⏳ กำลังบันทึกความคืบหน้า...</span>`;
  }

  // 1. Snapshot and clear photos immediately so user cannot double-submit the same photos
  const photosToUpload = [...checkoutPhotos];
  clearCheckoutPhotos();
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(fi => { fi.value = ''; });

  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("th-TH");
    const entryType = isDailyCheckoutMode ? "daily_checkout" : "progress";
    const modePrefix = isDailyCheckoutMode ? `เช็กเอาต์รายวัน • คืบหน้า ${updatePercent}%` : `คืบหน้า ${updatePercent}%: ${updateStatus}`;
    const defaultNote = isDailyCheckoutMode ? 'เช็กเอาต์จบงานวันนี้ (พรุ่งนี้ทำต่อ)' : 'อัปเดตงานตามขั้นตอน';
    const updateEntry = `[${modePrefix}] ${noteText.trim() || defaultNote} (โดย ${closerName || 'ผู้ปฏิบัติงาน'} เมื่อ ${dateStr} ${timeStr})`;

    const newTotalPhotos = totalPhotosCount + photosToUpload.length;

    // 2. Send Progress Flex Card with totalPhotos
    const flexCard = createProgressFlexCard({
      id: activeItem.id,
      taskId: activeItem.taskId || activeItem.id,
      taskTitle: activeItem.task,
      techs: activeItem.techs,
      progress: updatePercent,
      status: isDailyCheckoutMode ? "เช็กเอาต์รายวัน (พรุ่งนี้ทำต่อ)" : updateStatus,
      note: noteText.trim() || defaultNote,
      updateBy: closerName || "ผู้ปฏิบัติงาน",
      updateTime: timeStr,
      photoCount: photosToUpload.length,
      totalPhotos: newTotalPhotos
    });

    // 3. Sync to Supabase Database & Timeline
    const apiRes = await updateTaskProgressApi({
      taskId: activeItem.taskId || activeItem.id,
      taskTitle: activeItem.task,
      progress: updatePercent,
      status: updateStatus,
      note: noteText.trim() || defaultNote,
      updateBy: closerName || "ผู้ปฏิบัติงาน",
      updateEntry: updateEntry,
      photos: photosToUpload,
      type: entryType
    });

    if (onComplete) onComplete({
      id: activeItem.id,
      task: activeItem.task,
      status: updateStatus,
      progress: updatePercent,
      latestUpdate: updateEntry,
      photos: photosToUpload,
      historyItem: apiRes?.historyItem,
      isDailyCheckout: isDailyCheckoutMode,
      lineShared: false
    });

    // 4. Prompt to Share to LINE (Direct User Gesture - Prevents Chrome Popup Block on PC)
    showSharePromptDialog({
      title: isDailyCheckoutMode
        ? `เช็กเอาต์จบงานวันนี้สำเร็จ! (คืบหน้า ${updatePercent}%)`
        : `บันทึกความคืบหน้าสำเร็จ! (${updatePercent}%)`,
      message: isDailyCheckoutMode
        ? `ระบบบันทึกเวลาออกงานของวันนี้ พร้อมรูปภาพ (${photosToUpload.length} รูป) เรียบร้อยแล้ว พรุ่งนี้สามารถกด "▶️ เช็กอินทำต่อ" ได้ทันที!\n\nต้องการส่งการ์ดสรุปวันนี้เข้ากลุ่ม LINE หรือไม่?`
        : `ระบบบันทึกความคืบหน้าและอัปโหลดรูปภาพ (${photosToUpload.length} รูป) เรียบร้อยแล้ว\n\nต้องการส่งการ์ดสรุปเข้ากลุ่ม LINE ตอนนี้หรือไม่?`,
      shareBtnText: "💬 เลือกกลุ่ม LINE และส่งการ์ดสรุป",
      skipBtnText: "เสร็จสิ้น / ไว้แชร์ทีหลัง",
      onShare: () => {
        triggerLiffShare(flexCard, "อัปเดตความคืบหน้างานและส่งเข้า LINE สำเร็จ!");
      }
    });
  } catch (err) {
    console.error("submitProgressOnly error:", err);
    showAppAlert({
      type: "error",
      title: "เกิดข้อผิดพลาด",
      message: "ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง"
    });
  } finally {
    isSubmittingProgress = false;
    updateCheckoutSubmitButtonsState();
  }
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
  if (isSubmittingCheckout) return;

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

  isSubmittingCheckout = true;
  const checkoutBtn = document.getElementById("submitCheckoutBtn");
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.className = "w-full bg-slate-400 text-white font-bold py-3.5 px-4 rounded-xl text-xs md:text-sm cursor-wait transition-all flex items-center justify-center space-x-2 select-none";
    checkoutBtn.innerHTML = `<span>⏳ กำลังบันทึกปิดงาน...</span>`;
  }

  const photosToUpload = [...checkoutPhotos];
  clearCheckoutPhotos();
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(fi => { fi.value = ''; });

  try {
    const now = new Date();
    const outTimeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    const durationStr = calculateDuration(activeItem.time, activeItem.date, activeItem.createdAt);

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
      closedBy: closerName || "ผู้ปฏิบัติงาน",
      photoCount: photosToUpload.length,
      photos: photosToUpload.map(p => ({ name: p.name, base64: p.base64, sizeKb: p.sizeKb }))
    };

    // 1. Flex Message with individual member durations
    let memberDurations = [];
    try {
      const linkedTask = state.tasksList.find(t => (activeItem.taskId && t.id === activeItem.taskId) || t.id === activeItem.id || t.title === activeItem.task);
      const memberStatuses = getTaskMemberStatuses(linkedTask || activeItem, activeItem);
      memberDurations = memberStatuses.map(m => {
        const dLabel = m.durationLabel || (m.hasCheckedOut ? 'ทำเสร็จใน 1 วัน' : 'ร่วมปฏิบัติงาน');
        return {
          name: m.fullName,
          duration: dLabel,
          status: m.hasCheckedOut ? 'ปิดหน้าที่แล้ว' : (m.hasCheckedIn ? 'ปฏิบัติงาน' : 'รอดำเนินการ')
        };
      });
    } catch (e) {
      console.warn("Could not calculate memberDurations for flex card:", e);
    }

    const flexCard = createCheckoutFlexCard({
      id: activeItem.id,
      task: activeItem.task,
      techs: activeItem.techs,
      inTime: formatGasTime(activeItem.time),
      outTime: outTimeStr,
      duration: durationStr,
      outcome: selectedOutcome,
      note: noteText.trim() || "",
      photoCount: photosToUpload.length,
      memberDurations
    });

    // 2. Realtime sync to GAS / Supabase
    saveCheckoutApi(payload);

    if (onComplete) onComplete(payload);

    // 3. Prompt to Share to LINE (Direct User Gesture - Prevents Chrome Popup Block on PC)
    showSharePromptDialog({
      title: "บันทึกปิดงานสำเร็จ! (100%)",
      message: `ระบบบันทึกปิดงานและอัปโหลดรูปภาพ (${photosToUpload.length} รูป) เรียบร้อยแล้ว\n\nต้องการส่งการ์ดสรุปปิดงานเข้ากลุ่ม LINE ตอนนี้หรือไม่?`,
      shareBtnText: "💬 เลือกกลุ่ม LINE และส่งสรุปปิดงาน",
      skipBtnText: "เสร็จสิ้น / ไว้แชร์ทีหลัง",
      onShare: () => {
        triggerLiffShare(flexCard, "ปิดงานและส่งสรุปผลงานเข้า LINE สำเร็จ!");
      }
    });
  } catch (err) {
    console.error("submitCheckoutForm error:", err);
    showAppAlert({
      type: "error",
      title: "เกิดข้อผิดพลาด",
      message: "ไม่สามารถบันทึกปิดงานได้ กรุณาลองใหม่อีกครั้ง"
    });
  } finally {
    isSubmittingCheckout = false;
    updateCheckoutSubmitButtonsState();
  }
}

export function setCheckoutOutcome(outcome) {
  state.selectedCheckoutOutcome = outcome;
  const outcomes = [
    { key: "ปฏิบัติงานเรียบร้อย", activeClass: "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs ring-1 ring-emerald-400" },
    { key: "ติดปัญหา", activeClass: "bg-rose-50 border-rose-500 text-rose-800 shadow-2xs ring-1 ring-rose-400" }
  ];
  outcomes.forEach(oc => {
    const btn = document.getElementById(`outcomeBtn-${oc.key}`);
    if (btn) btn.className = oc.key === outcome ? `py-2.5 px-3 rounded-xl border text-xs font-bold text-left transition-all ${oc.activeClass}` : "py-2.5 px-3 rounded-xl border text-xs font-medium text-left transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
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

