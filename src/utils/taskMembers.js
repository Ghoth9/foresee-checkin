/**
 * Task Loop Members & Multi-tech Status Helper
 * Tracks individual check-in and checkout / duty completion status
 * for each assignee in a collaborative multi-person task.
 */

import { state } from '../modules/state.js';
import { matchesOperator } from '../modules/tasks.js';

export function getTaskMemberStatuses(task, activeItem = null) {
  if (!task) return [];
  const techs = Array.isArray(task.techs)
    ? task.techs
    : (typeof task.techs === 'string' ? task.techs.split(',').map(s => s.trim()).filter(Boolean) : []);

  if (techs.length === 0) return [];

  const act = activeItem || (state.activeTasks || []).find(a => a.taskId === task.id || a.id === task.id || a.task === task.title);

  // 1. Collect all checkin records for this task
  const checkinRecords = [];
  function splitTechs(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.flatMap(v => typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [v]);
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [val];
  }

  if (act && Array.isArray(act.checkinSessions)) {
    act.checkinSessions.forEach(cs => {
      const cTechs = splitTechs(cs.techs || cs.checkedInBy);
      checkinRecords.push({ techs: cTechs, checkedInBy: cs.checkedInBy || (cTechs.length === 1 ? cTechs[0] : null), time: cs.time, date: cs.date });
    });
  }
  if (act && (act.isCheckedIn || act.id?.startsWith('CHK-')) && act.time) {
    const cTechs = splitTechs(act.techs || act.checkedInBy);
    checkinRecords.push({ techs: cTechs, checkedInBy: act.checkedInBy || (cTechs.length === 1 ? cTechs[0] : null), time: act.time, date: act.date });
  }
  (state.dailyLogs || []).forEach(dl => {
    if ((dl.taskId === task.id || dl.id === task.id) && dl.time) {
      const cTechs = splitTechs(dl.techs || dl.checkedInBy);
      checkinRecords.push({ techs: cTechs, checkedInBy: dl.checkedInBy || (cTechs.length === 1 ? cTechs[0] : null), time: dl.time, date: dl.date });
    }
  });

  // 2. Collect all checkout / duty completion records
  const dutyCompleteRecords = [];
  const cust = (task && typeof task.customer === 'object') ? task.customer : {};
  const progressHist = Array.isArray(task.progressHistory)
    ? task.progressHistory
    : (Array.isArray(cust.progress_history) ? cust.progress_history : []);

  progressHist.forEach(ph => {
    if (ph.type === 'checkin' && ph.time) {
      const pTechs = splitTechs(ph.tech || ph.by);
      checkinRecords.push({ techs: pTechs, checkedInBy: ph.by || (pTechs.length === 1 ? pTechs[0] : null), time: ph.time, date: ph.date });
    }
    if (ph.type === 'duty_complete' || ph.type === 'close' || (ph.status === 'เสร็จสิ้น' && ph.tech)) {
      dutyCompleteRecords.push({
        tech: ph.tech || ph.by || '',
        time: ph.time,
        date: ph.date,
        note: ph.note || ''
      });
    }
  });

  return techs.map(techFullName => {
    let shortName = techFullName.replace(/K\./g, '').split('(')[0].trim();
    if (!shortName) shortName = techFullName;

    // Match checkin: prioritize specific checkedInBy, fallback to unique tech match
    let matchedCheckin = checkinRecords.find(cr =>
      cr.checkedInBy && (matchesOperator(cr.checkedInBy, techFullName) || matchesOperator(cr.checkedInBy, shortName))
    );

    if (!matchedCheckin) {
      matchedCheckin = checkinRecords.find(cr => {
        if (cr.checkedInBy && !matchesOperator(cr.checkedInBy, techFullName) && !matchesOperator(cr.checkedInBy, shortName)) {
          return false; // Checked in by someone else explicitly
        }
        return cr.techs.some(t => matchesOperator(t, techFullName) || matchesOperator(t, shortName));
      });
    }

    const matchedDuty = dutyCompleteRecords.find(dr =>
      matchesOperator(dr.tech, techFullName) || matchesOperator(dr.tech, shortName)
    );

    const hasCheckedIn = !!matchedCheckin;
    const hasCheckedOut = !!matchedDuty;

    const checkinTime = matchedCheckin
      ? `${matchedCheckin.date && matchedCheckin.date !== 'วันนี้' ? matchedCheckin.date + ' ' : ''}${matchedCheckin.time || ''} น.`
      : null;

    const checkoutTime = matchedDuty
      ? `${matchedDuty.date && matchedDuty.date !== 'วันนี้' ? matchedDuty.date + ' ' : ''}${matchedDuty.time || ''} น.`
      : null;

    let status = 'pending';
    let statusLabel = 'ยังไม่เช็กอิน';
    if (hasCheckedOut) {
      status = 'completed';
      statusLabel = `เช็กเอาต์แล้ว (${checkoutTime})`;
    } else if (hasCheckedIn) {
      status = 'in_progress';
      statusLabel = `เช็กอินแล้ว (${checkinTime})`;
    }

    return {
      fullName: techFullName,
      shortName,
      hasCheckedIn,
      checkinTime,
      hasCheckedOut,
      checkoutTime,
      checkoutNote: matchedDuty ? matchedDuty.note : '',
      status,
      statusLabel
    };
  });
}

export function getUniquePhotosForActiveTask(activeItem) {
  if (!activeItem) return [];
  const linkedTask = state.tasksList.find(t =>
    (activeItem.taskId && t.id === activeItem.taskId) ||
    t.id === activeItem.id ||
    t.title === activeItem.task
  );

  const photosList = [];
  if (Array.isArray(activeItem.photos)) {
    activeItem.photos.forEach((p, idx) => {
      const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
      if (src) photosList.push({ src, caption: `${activeItem.task} • รูปเช็กอิน #${idx + 1}` });
    });
  }

  if (linkedTask && Array.isArray(linkedTask.progressHistory)) {
    linkedTask.progressHistory.forEach(h => {
      if (Array.isArray(h.photos)) {
        h.photos.forEach((hp, idx) => {
          const src = hp.dataUrl || hp.base64 || hp.url || (typeof hp === "string" ? hp : null);
          if (src) photosList.push({ src, caption: `${linkedTask.title} • ความคืบหน้า ${h.progress || 0}% (${h.time || ''} โดย ${h.by || h.tech || 'ผู้ปฏิบัติงาน'}) #${idx + 1}` });
        });
      }
    });
  }
  return photosList;
}

export function formatLatestNoteText(rawText) {
  if (!rawText || rawText === '-') return '';
  let cleaned = rawText;
  if (cleaned.includes(' | ')) {
    const parts = cleaned.split(' | ').filter(Boolean);
    cleaned = parts[parts.length - 1].trim();
  }
  return cleaned
    .replace(/ติดตั้งเสร็จเรียบร้อย\s*ทดสอบภาพชัดเจนทุกจุด/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ทดสอบภาพชัดเจนทุกจุด/g, 'ปฏิบัติงานเรียบร้อย')
    .replace(/ผู้ปฏิบัติงานหน้างาน/g, 'ผู้ปฏิบัติงาน')
    .trim();
}

export function collectTaskActivityLogs(item, linkedTask) {
  const allLogs = [];

  // 1. Checkin sessions from item
  if (Array.isArray(item.checkinSessions) && item.checkinSessions.length > 0) {
    item.checkinSessions.forEach(cs => {
      const techNames = cs.checkedInBy || (Array.isArray(cs.techs) ? cs.techs.join(", ") : "ผู้ปฏิบัติงาน");
      allLogs.push({
        id: cs.id, type: "checkin", label: "เช็กอินเข้าเริ่มงาน", time: cs.time || "-", date: cs.date || "วันนี้",
        tech: techNames, note: cs.note && cs.note !== "-" ? cs.note : "บันทึกเวลาเข้าปฏิบัติงานหน้างาน",
        photos: Array.isArray(cs.photos) ? cs.photos : [], createdAt: cs.createdAt || null
      });
    });
  } else if ((item.isCheckedIn === true || item.id?.startsWith("CHK-")) && item.time) {
    allLogs.push({
      id: item.id, type: "checkin", label: "เช็กอินเข้าเริ่มงาน", time: item.time || "-", date: item.date || "วันนี้",
      tech: item.checkedInBy || (Array.isArray(item.techs) ? item.techs.join(", ") : "ผู้ปฏิบัติงาน"),
      note: item.note && item.note !== "-" ? item.note : "บันทึกเวลาเข้าปฏิบัติงานหน้างาน",
      photos: Array.isArray(item.photos) ? item.photos : [], createdAt: item.createdAt || null
    });
  }

  // 2. Progress history from linkedTask
  if (linkedTask) {
    const rawHist = linkedTask.progressHistory || linkedTask.customer?.progress_history || [];
    if (Array.isArray(rawHist)) {
      rawHist.forEach(ph => {
        if (ph.type === "checkin" && allLogs.some(l => l.type === "checkin" && l.time === ph.time && l.tech === ph.tech)) {
          return;
        }
        let type = ph.type;
        let label = "อัปเดตความคืบหน้า";
        if (type === "duty_complete") {
          label = `🏁 เช็กเอาต์หน้าที่ (${ph.tech || 'ผู้ปฏิบัติงาน'})`;
        } else if (type === "close" || ph.status === "เสร็จสิ้น" || Number(ph.progress) === 100) {
          type = "close";
          label = "ปิดงาน 100%";
        } else if (type === "extend" || ph.status === "ขอขยายเวลา") {
          type = "extend";
          label = "ขอขยายเวลา";
        } else if (type === "checkin") {
          label = "เช็กอินเข้าเริ่มงาน";
        } else {
          label = `อัปเดตงาน (${ph.progress || 0}%)`;
        }

        allLogs.push({
          id: ph.id || `HIST-${Date.now().toString(36)}`, type: type || "update", label, progress: ph.progress,
          status: ph.status, time: ph.time || "-", date: ph.date || "วันนี้", tech: ph.tech || ph.by || "ผู้ปฏิบัติงาน",
          note: ph.note || "-", photos: Array.isArray(ph.photos) ? ph.photos : [], createdAt: ph.createdAt || null
        });
      });
    }
  }

  allLogs.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  return allLogs;
}
