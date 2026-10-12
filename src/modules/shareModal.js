/**
 * LINE Share Task Modal Module (แชร์การ์ดสรุปงานเข้า LINE)
 * Allows user to choose between Assignment, Check-in, or Progress Update Flex Card.
 */

import { state, getEffectiveOperatorName } from './state.js';
import { formatGasTime } from '../utils/date.js';
import { showAppAlert } from '../utils/dialog.js';
import { 
  createAssignTaskFlexCard, 
  createProgressFlexCard, 
  createCheckinFlexCard, 
  createCheckoutFlexCard,
  createExtendDeadlineFlexCard,
  triggerLiffShare, 
  getLineUserName 
} from '../liff/line.js';
import { getUniquePhotosForActiveTask, formatLatestNoteText, collectTaskActivityLogs } from './checkoutList.js';
import { calculateDuration } from './checkout.js';

let currentShareTaskItem = null;

export function openShareTaskLineModal(activeId) {
  const item = state.activeTasks.find(a => a.id === activeId);
  if (!item) return;
  currentShareTaskItem = item;

  const modal = document.getElementById("shareTaskLineModal");
  const subtitle = document.getElementById("shareModalTaskSubtitle");
  const displayTaskId = item.taskId || item.id;
  if (subtitle) subtitle.innerText = `${displayTaskId} • ${item.task}`;

  const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);
  const isRealCheckin = (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00";

  // Check-in option badge & desc
  const checkinBadge = document.getElementById("shareOptionCheckinBadge");
  const checkinDesc = document.getElementById("shareOptionCheckinDesc");
  if (checkinBadge && checkinDesc) {
    if (isRealCheckin) {
      checkinBadge.className = "text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800";
      checkinBadge.innerText = `เช็กอินแล้ว ${formatGasTime(item.time)} น.`;
      checkinDesc.innerText = `แจ้งว่าผู้ปฏิบัติงานเข้างานแล้ว เวลา ${formatGasTime(item.time)} น.`;
    } else {
      checkinBadge.className = "text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800";
      checkinBadge.innerText = `ยังไม่เช็กอิน`;
      checkinDesc.innerText = `งานนี้ยังไม่มีการกดเช็กอินจริง (หากเลือกจะแชร์เวลา ณ ปัจจุบัน)`;
    }
  }

  // Progress option badge & desc
  const progBadge = document.getElementById("shareOptionProgressBadge");
  const progDesc = document.getElementById("shareOptionProgressDesc");
  if (progBadge && progDesc) {
    progBadge.innerText = `${itemProg}%`;
    progDesc.innerText = itemProg > 0 
      ? `รายงานความคืบหน้าปัจจุบัน (${itemProg}%) และบันทึกล่าสุด` 
      : `สถานะปัจจุบัน 0% (ยังไม่มีการบันทึกความคืบหน้า)`;
  }

  if (modal) modal.classList.remove("hidden");
}

export function closeShareTaskLineModal() {
  const modal = document.getElementById("shareTaskLineModal");
  if (modal) modal.classList.add("hidden");
}

export async function submitShareTaskChoice(choiceType) {
  if (!currentShareTaskItem) return;
  const item = currentShareTaskItem;
  closeShareTaskLineModal();

  const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const displayTaskId = item.taskId || item.id;
  const itemProg = item.progress !== undefined ? item.progress : (linkedTask?.progress || 0);
  const uniquePhotos = getUniquePhotosForActiveTask(item);
  const techList = Array.isArray(item.techs) ? item.techs.join(", ") : (item.techs || "ผู้ปฏิบัติงานทั่วไป");
  const rawNote = linkedTask?.latestUpdate || item.note;
  const cleanNote = formatLatestNoteText(rawNote);

  let flexCard = null;
  let confirmMsg = "";

  if (choiceType === "assign") {
    const tObj = linkedTask || {};
    flexCard = createAssignTaskFlexCard({
      id: displayTaskId,
      title: item.task,
      category: tObj.category || "งานทั่วไป",
      priority: tObj.priority || "ปกติ",
      customer: tObj.customer || { name: item.task },
      techs: item.techs,
      startDate: tObj.startDate || item.date || "วันนี้",
      deadline: tObj.deadline || "-",
      desc: tObj.desc || cleanNote || "มอบหมายงานใหม่"
    });
    confirmMsg = `แชร์ข้อมูลมอบหมายงาน ${item.task} เข้า LINE สำเร็จ!`;
  } else if (choiceType === "progress") {
    const currentOp = getEffectiveOperatorName();
    flexCard = createProgressFlexCard({
      id: item.id,
      taskId: item.taskId || item.id,
      taskTitle: item.task,
      techs: item.techs,
      progress: itemProg,
      status: item.status || "กำลังทำ",
      note: cleanNote || "อัปเดตสถานะงานปัจจุบัน",
      updateBy: currentOp || getLineUserName() || techList,
      updateTime: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      photoCount: uniquePhotos.length,
      totalPhotos: uniquePhotos.length
    });
    confirmMsg = `แชร์อัปเดตความคืบหน้างาน ${item.task} เข้า LINE สำเร็จ!`;
  } else if (choiceType === "checkin") {
    const isRealCheckin = (item.isCheckedIn === true || item.id.startsWith("CHK-")) && !!item.time && item.time !== "09:00";
    const checkinTime = isRealCheckin ? formatGasTime(item.time) : new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    flexCard = createCheckinFlexCard({
      id: item.id,
      taskId: item.taskId || item.id,
      task: item.task,
      techs: item.techs,
      time: checkinTime,
      coords: item.coords,
      mapUrl: item.mapUrl,
      photoCount: uniquePhotos.length
    });
    confirmMsg = `แชร์ข้อมูลเช็กอินงาน ${item.task} เข้า LINE สำเร็จ!`;
  }

  if (flexCard) {
    await triggerLiffShare(flexCard, confirmMsg);
  }
}

/**
 * Share an individual activity log / movement to LINE.
 * Supports sharing specific check-ins, progress updates, extensions, and close logs.
 */
export async function shareActivityLogToLine(activeId, logIndex) {
  const item = state.activeTasks.find(a => a.id === activeId);
  if (!item) {
    showAppAlert({
      type: "warning",
      title: "ไม่พบข้อมูลงาน",
      message: "ไม่พบข้อมูลรายการงานที่ต้องการแชร์ครับ"
    });
    return;
  }

  const linkedTask = state.tasksList.find(t => (item.taskId && t.id === item.taskId) || t.id === item.id || t.title === item.task);
  const activityLogs = collectTaskActivityLogs(item, linkedTask);
  const log = activityLogs[logIndex];
  if (!log) {
    showAppAlert({
      type: "warning",
      title: "ไม่พบกิจกรรม",
      message: "ไม่พบข้อมูลประวัติกิจกรรมที่ต้องการแชร์ครับ"
    });
    return;
  }

  let flexCard = null;
  let confirmMsg = "";

  const displayTaskId = item.taskId || item.id;
  const taskTitle = item.task;
  const photoCount = Array.isArray(log.photos) ? log.photos.length : 0;
  const logTech = log.tech || getEffectiveOperatorName() || getLineUserName() || "ผู้ปฏิบัติงาน";

  if (log.type === "checkin") {
    flexCard = createCheckinFlexCard({
      id: item.id,
      taskId: displayTaskId,
      task: taskTitle,
      techs: logTech,
      time: log.time || "-",
      coords: item.coords,
      mapUrl: item.mapUrl,
      photoCount: photoCount
    });
    confirmMsg = `แชร์การเช็กอินของ "${logTech}" เข้า LINE สำเร็จ!`;
  } else if (log.type === "close") {
    flexCard = createCheckoutFlexCard({
      id: item.id,
      task: taskTitle,
      techs: logTech,
      inTime: item.time,
      outTime: log.time || "-",
      duration: calculateDuration(item.time, item.date, item.createdAt),
      outcome: log.status || "เสร็จสิ้น",
      note: log.note && log.note !== "-" ? log.note : "บันทึกปิดงาน 100%",
      photoCount: photoCount
    });
    confirmMsg = `แชร์การปิดงานของ "${taskTitle}" เข้า LINE สำเร็จ!`;
  } else if (log.type === "extend") {
    flexCard = createExtendDeadlineFlexCard({
      taskId: displayTaskId,
      taskTitle: taskTitle,
      oldDeadline: item.deadline || "-",
      newDeadline: log.time || "-",
      reason: log.note || "ขอขยายเวลาปฏิบัติงาน",
      requestBy: logTech
    });
    confirmMsg = `แชร์การขอขยายเวลาของ "${taskTitle}" เข้า LINE สำเร็จ!`;
  } else {
    // update / progress
    const cleanNote = log.note && log.note !== "-" ? log.note : (log.label || "อัปเดตความคืบหน้า");
    flexCard = createProgressFlexCard({
      id: item.id,
      taskId: displayTaskId,
      taskTitle: taskTitle,
      techs: item.techs,
      progress: log.progress !== undefined ? Number(log.progress) : (item.progress || 0),
      status: log.status || "กำลังทำ",
      note: cleanNote,
      updateBy: logTech,
      updateTime: log.time || "-",
      photoCount: photoCount,
      totalPhotos: photoCount
    });
    confirmMsg = `แชร์อัปเดตกิจกรรม (${log.label}) เข้า LINE สำเร็จ!`;
  }

  if (flexCard) {
    await triggerLiffShare(flexCard, confirmMsg);
  }
}
