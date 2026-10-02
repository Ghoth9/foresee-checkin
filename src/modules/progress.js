/**
 * Task Progress Update Module (อัปเดตความคืบหน้าระหว่างวัน)
 */

import { createProgressFlexCard, triggerLiffShare } from '../liff/line.js';
import { updateTaskProgressApi } from '../api/gas.js';

let currentProgressTaskId = null;
let currentProgressPercent = 50;
let currentProgressStatus = "กำลังทำ";

export function openProgressModal(task) {
  if (!task) return;
  currentProgressTaskId = task.id;
  currentProgressPercent = typeof task.progress === "number" ? task.progress : 50;
  currentProgressStatus = task.status || "กำลังทำ";

  const titleElem = document.getElementById("updateTaskTitleLabel");
  if (titleElem) titleElem.innerText = task.title;

  const noteInput = document.getElementById("updateNoteInput");
  if (noteInput) noteInput.value = "";

  setProgressPercent(currentProgressPercent);
  setProgressStatus(currentProgressStatus);

  const modal = document.getElementById("updateProgressModal");
  if (modal) modal.classList.remove("hidden");
}

export function closeProgressModal() {
  const modal = document.getElementById("updateProgressModal");
  if (modal) modal.classList.add("hidden");
}

export function setProgressPercent(val) {
  currentProgressPercent = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
  const numElem = document.getElementById("updateProgressNum");
  if (numElem) numElem.innerText = `${currentProgressPercent}%`;

  const barElem = document.getElementById("updateProgressBarFill");
  if (barElem) barElem.style.width = `${currentProgressPercent}%`;

  // Highlight quick buttons
  [25, 50, 75, 90, 100].forEach(p => {
    const btn = document.getElementById(`quickProg-${p}`);
    if (btn) {
      if (p === currentProgressPercent) {
        btn.className = "py-1.5 px-2 rounded-lg text-xs font-bold border transition-all bg-blue-600 text-white border-blue-600 shadow-xs";
      } else {
        btn.className = "py-1.5 px-2 rounded-lg text-xs font-medium border transition-all bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200";
      }
    }
  });
}

export function setProgressStatus(st) {
  currentProgressStatus = st;
  const statuses = [
    { key: "กำลังทำ", activeClass: "bg-blue-600 text-white border-blue-600 shadow-xs" },
    { key: "รอดำเนินการ", activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs" },
    { key: "รออะไหล่", activeClass: "bg-purple-600 text-white border-purple-600 shadow-xs" },
    { key: "เสร็จสิ้น", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs" }
  ];

  statuses.forEach(s => {
    const btn = document.getElementById(`statusChoice-${s.key}`);
    if (btn) {
      if (s.key === st) {
        btn.className = `py-1.5 px-2 rounded-lg border text-center text-xs font-bold transition-all ${s.activeClass}`;
      } else {
        btn.className = "py-1.5 px-2 rounded-lg border text-center text-xs font-medium transition-all bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200";
      }
    }
  });
}

export async function submitProgressUpdate({ tasksList, currentLineUserName, onComplete }) {
  const task = tasksList.find(t => t.id === currentProgressTaskId);
  if (!task) return;

  const noteInput = document.getElementById("updateNoteInput");
  const note = noteInput ? noteInput.value.trim() : "";

  const now = new Date();
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  task.progress = currentProgressPercent;
  task.status = currentProgressStatus;
  if (currentProgressPercent === 100) {
    task.status = "เสร็จสิ้น";
  }

  const updateEntry = `[คืบหน้า ${currentProgressPercent}%: ${task.status}] ${note || 'อัปเดตงานตามขั้นตอน'} (โดย ${currentLineUserName || 'ช่างหน้างาน'} เมื่อ ${now.toLocaleDateString("th-TH")} ${timeStr})`;
  task.latestUpdate = updateEntry;
  task.updateBy = currentLineUserName || "ช่างหน้างาน";
  task.updateTime = timeStr;

  closeProgressModal();

  // 1. Sync to Google Apps Script
  updateTaskProgressApi({
    taskId: task.id,
    taskTitle: task.title,
    progress: currentProgressPercent,
    status: task.status,
    note: note || "-",
    updateBy: currentLineUserName || "ช่างหน้างาน",
    updateEntry: updateEntry
  });

  // 2. LINE Flex Message
  const flexCard = createProgressFlexCard({
    taskId: task.id,
    taskTitle: task.title,
    techs: task.techs,
    progress: currentProgressPercent,
    status: task.status,
    note: note,
    updateBy: currentLineUserName,
    updateTime: timeStr
  });

  await triggerLiffShare(flexCard, "อัปเดตความคืบหน้างานเข้า LINE สำเร็จ!");

  if (onComplete) onComplete(task);
}
