/**
 * Field Check-out Module (บันทึกปิดงาน)
 */

import { compressMultipleFiles } from '../utils/compressor.js';
import { createCheckoutFlexCard, triggerLiffShare } from '../liff/line.js';
import { saveCheckoutApi } from '../api/gas.js';

let checkoutPhotos = [];
let currentCheckoutItem = null;

export function getCheckoutPhotos() {
  return checkoutPhotos;
}

export function clearCheckoutPhotos() {
  checkoutPhotos = [];
  renderCheckoutPhotoPreviews();
}

export async function handleCheckoutPhotoUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const currentCount = checkoutPhotos.length;
  const remainingSlots = 5 - currentCount;
  if (remainingSlots <= 0) {
    alert("แนบรูปได้สูงสุด 5 รูปแล้ว");
    return;
  }

  const newCompressed = await compressMultipleFiles(files, remainingSlots);
  checkoutPhotos = [...checkoutPhotos, ...newCompressed].slice(0, 5);
  renderCheckoutPhotoPreviews();
  event.target.value = "";
}

export function removeCheckoutPhoto(index) {
  checkoutPhotos.splice(index, 1);
  renderCheckoutPhotoPreviews();
}

export function renderCheckoutPhotoPreviews() {
  const container = document.getElementById("checkoutPhotoPreviewsContainer");
  const countBadge = document.getElementById("checkoutPhotoCountBadge");
  if (!container) return;

  if (countBadge) {
    countBadge.innerText = `${checkoutPhotos.length}/5 รูป`;
  }

  container.innerHTML = "";
  checkoutPhotos.forEach((photo, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group flex-shrink-0";
    thumb.innerHTML = `
      <img src="${photo.dataUrl}" class="w-full h-full object-cover" alt="photo ${idx + 1}">
      <button type="button" onclick="window.removeCheckoutPhoto(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600 text-white rounded-full text-xs flex items-center justify-center shadow-xs hover:bg-rose-700">
        ×
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[9px] text-white text-center py-0.2">
        ${photo.sizeKb}KB
      </div>
    `;
    container.appendChild(thumb);
  });
}

export function calculateDuration(checkinTimeStr) {
  if (!checkinTimeStr || checkinTimeStr === "-") return "-";
  try {
    const now = new Date();
    const parts = checkinTimeStr.split(":");
    const inHours = parseInt(parts[0], 10);
    const inMins = parseInt(parts[1], 10);

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
    return "-";
  }
}

export async function submitCheckoutForm({
  activeItem,
  selectedOutcome,
  noteText,
  closerName,
  onComplete
}) {
  if (!activeItem) {
    alert("กรุณาเลือกงานที่ต้องการปิด");
    return;
  }
  if (!selectedOutcome) {
    alert("กรุณาเลือกผลการปฏิบัติงาน");
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
    inTime: activeItem.time,
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
    inTime: activeItem.time,
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
