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
import { saveCheckinApi } from '../api/gas.js';
import { formatThaiDateDisplay } from '../utils/date.js';

let checkinPhotos = [];
let selectedAssignedTaskId = null;

export function getCheckinPhotos() {
  return checkinPhotos;
}

export function clearCheckinPhotos() {
  checkinPhotos = [];
  renderPhotoPreviews();
}

export function renderAssignedTasksBanner(tasksList, allTechnicians, onSelectTask) {
  const container = document.getElementById("assignedTasksCheckinContainer");
  if (!container) return;

  // Filter tasks that are in progress or pending
  const pendingTasks = tasksList.filter(t => t.status !== "เสร็จสิ้น");

  if (pendingTasks.length === 0) {
    container.innerHTML = `
      <div class="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center">
        ไม่มีงานมอบหมายค้างอยู่ สามารถกรอกสถานที่เพื่อเช็กอินงานทั่วไปได้เลย
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs">
        <span class="font-bold text-slate-800 flex items-center space-x-1.5">
          <span>📋</span>
          <span>งานที่ได้รับมอบหมาย (แตะเพื่อเช็กอินทันที):</span>
        </span>
        <span class="text-[11px] text-blue-600 font-semibold">${pendingTasks.length} งาน</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-0.5 no-scrollbar">
        ${pendingTasks.map(task => {
          const isSelected = selectedAssignedTaskId === task.id;
          const techList = Array.isArray(task.techs) ? task.techs.join(", ") : (task.techs || "ช่างทั่วไป");
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
              ${task.desc && task.desc !== '-' ? `<div class="text-xs text-slate-500 line-clamp-1 mt-0.5">${task.desc}</div>` : ''}
              <div class="text-xs text-slate-600 mt-2 font-medium flex items-center space-x-1">
                <span>👷 ช่าง:</span>
                <strong class="text-slate-800 truncate">${techList}</strong>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function selectAssignedTask(taskId, tasksList, setSelectedTechsCallback) {
  const task = tasksList.find(t => t.id === taskId);
  if (!task) return;

  if (selectedAssignedTaskId === taskId) {
    // Deselect if already selected
    selectedAssignedTaskId = null;
    const locInput = document.getElementById("fieldLocationInput");
    const noteInput = document.getElementById("fieldNoteInput");
    if (locInput) locInput.value = "";
    if (noteInput) noteInput.value = "";
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
    alert("แนบรูปได้สูงสุด 5 รูปแล้ว");
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
    if (checkinPhotos.length > 0) {
      countBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700";
    } else {
      countBadge.className = "text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500";
    }
  }

  container.innerHTML = "";
  checkinPhotos.forEach((photo, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group flex-shrink-0";
    thumb.innerHTML = `
      <img src="${photo.dataUrl}" class="w-full h-full object-cover" alt="photo ${idx + 1}">
      <button type="button" onclick="window.removeCheckinPhoto(${idx})" class="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-600 text-white rounded-full text-xs flex items-center justify-center shadow-xs hover:bg-rose-700">
        ×
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[9px] text-white text-center py-0.2">
        ${photo.sizeKb}KB
      </div>
    `;
    container.appendChild(thumb);
  });
}

export async function submitCheckinForm({ selectedTechs, selectedJobType, customJobType, locationText, noteText, onComplete }) {
  if (selectedTechs.length === 0) {
    alert("กรุณาเลือกทีมช่างอย่างน้อย 1 คน");
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
    alert("กรุณากรอกสถานที่ / ไซต์งาน หรือเลือกงานมอบหมาย");
    return;
  }

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
    photoCount: checkinPhotos.length,
    photos: checkinPhotos.map(p => ({ name: p.name, base64: p.base64, sizeKb: p.sizeKb }))
  };

  // 1. Send LINE Flex Card
  const flexCard = createCheckinFlexCard({
    id: checkinId,
    task: finalJobTitle,
    techs: selectedTechs,
    time: timeStr,
    coords: coords.isReady ? `${coords.lat}, ${coords.lng}` : null,
    mapUrl: mapUrl,
    photoCount: checkinPhotos.length,
    taskId: selectedAssignedTaskId
  });

  // 2. Realtime sync to Google Apps Script
  saveCheckinApi(checkinRecord);

  // 3. Share to LINE Group
  await triggerLiffShare(flexCard, "เช็กอินเข้าหน้างานและส่งการ์ดเข้า LINE สำเร็จ!");

  // Reset form
  clearCheckinPhotos();
  selectedAssignedTaskId = null;
  if (onComplete) onComplete(checkinRecord);
}
