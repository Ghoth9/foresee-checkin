/**
 * Task Loop Members & Multi-tech Status Helper
 * Tracks individual check-in and checkout / duty completion status
 * for each assignee in a collaborative multi-person task.
 */

import { state } from '../modules/state.js';
import { matchesOperator } from '../modules/tasks.js';

export function getTaskMemberStatuses(task, activeItem = null) {
  try {
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
        checkinRecords.push({ techs: pTechs, checkedInBy: ph.by || (pTechs.length === 1 ? pTechs[0] : null), time: ph.time, date: ph.date, createdAt: ph.createdAt || ph.created_at || null });
      }
      if (ph.type === 'duty_complete' || ph.type === 'close' || (ph.status === 'เสร็จสิ้น' && ph.tech)) {
        dutyCompleteRecords.push({
          tech: ph.tech || ph.by || '',
          time: ph.time,
          date: ph.date,
          note: ph.note || '',
          createdAt: ph.createdAt || ph.created_at || null
        });
      }
    });

    return techs.map(techFullName => {
      let shortName = techFullName.replace(/K\./g, '').split('(')[0].trim();
      if (!shortName) shortName = techFullName;

      const matchedCheckins = checkinRecords.filter(cr =>
        (cr.checkedInBy && (matchesOperator(cr.checkedInBy, techFullName) || matchesOperator(cr.checkedInBy, shortName))) ||
        (cr.techs && cr.techs.some(t => matchesOperator(t, techFullName) || matchesOperator(t, shortName)))
      );
      const latestCheckin = matchedCheckins.length > 0 ? matchedCheckins[matchedCheckins.length - 1] : null;

      const matchedDuties = dutyCompleteRecords.filter(dr =>
        matchesOperator(dr.tech, techFullName) || matchesOperator(dr.tech, shortName)
      );
      const latestDuty = matchedDuties.length > 0 ? matchedDuties[matchedDuties.length - 1] : null;

      let hasCheckedIn = false;
      let hasCheckedOut = false;

      if (latestCheckin && latestDuty) {
        const tIn = latestCheckin.createdAt ? new Date(latestCheckin.createdAt).getTime() : 0;
        const tOut = latestDuty.createdAt ? new Date(latestDuty.createdAt).getTime() : 0;
        if (tIn > tOut) {
          hasCheckedIn = true;
          hasCheckedOut = false;
        } else {
          hasCheckedIn = true;
          hasCheckedOut = true;
        }
      } else if (latestCheckin) {
        hasCheckedIn = true;
        hasCheckedOut = false;
      } else if (latestDuty) {
        hasCheckedIn = true;
        hasCheckedOut = true;
      }

      const checkinTime = latestCheckin
        ? `${latestCheckin.date && latestCheckin.date !== 'วันนี้' ? latestCheckin.date + ' ' : ''}${latestCheckin.time || ''} น.`
        : null;

      const checkoutTime = latestDuty
        ? `${latestDuty.date && latestDuty.date !== 'วันนี้' ? latestDuty.date + ' ' : ''}${latestDuty.time || ''} น.`
        : null;

      // Calculate working days / duration for this person
      let durationLabel = null;
      let daysWorked = 0;
      if (latestCheckin && latestDuty) {
        try {
          const tIn = latestCheckin.createdAt ? new Date(latestCheckin.createdAt).getTime() : null;
          const tOut = latestDuty.createdAt ? new Date(latestDuty.createdAt).getTime() : null;
          if (tIn && tOut && tOut >= tIn) {
            const diffDays = Math.floor((tOut - tIn) / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(((tOut - tIn) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            if (diffDays > 0) {
              daysWorked = diffDays + 1;
              durationLabel = `ทำเสร็จใน ${diffDays + 1} วัน (${diffDays} วัน ${diffHours} ชม.)`;
            } else {
              daysWorked = 1;
              durationLabel = diffHours > 0 ? `ทำเสร็จใน 1 วัน (${diffHours} ชม.)` : `ทำเสร็จใน 1 วัน`;
            }
          } else {
            daysWorked = 1;
            durationLabel = `ทำเสร็จใน 1 วัน`;
          }
        } catch (e) {
          daysWorked = 1;
          durationLabel = `ทำเสร็จใน 1 วัน`;
        }
      } else if (latestDuty) {
        daysWorked = 1;
        durationLabel = `ทำเสร็จใน 1 วัน`;
      }

      let status = 'pending';
      let statusLabel = 'ยังไม่เช็กอิน';
      if (hasCheckedOut) {
        status = 'completed';
        statusLabel = `เช็กเอาต์แล้ว (${checkoutTime})${durationLabel ? ` • ${durationLabel}` : ''}`;
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
        checkoutNote: latestDuty ? latestDuty.note : '',
        durationLabel,
        daysWorked,
        status,
        statusLabel
      };
    });
  } catch (err) {
    console.warn("getTaskMemberStatuses error:", err);
    return [];
  }
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

export function matchTechName(techs, targetName) {
  if (!targetName || !techs) return false;
  const tArr = Array.isArray(techs) ? techs : [techs];
  return tArr.some(t => {
    if (!t) return false;
    return matchesOperator(t, targetName);
  });
}

export function enableSmoothHorizontalDragScroll(container) {
  if (!container || container._hasSmoothDrag) return;
  container._hasSmoothDrag = true;
  container.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0 && container.scrollWidth > container.clientWidth) {
      e.preventDefault();
      container.scrollBy({ left: e.deltaY * 1.5, behavior: "auto" });
    }
  }, { passive: false });
  let isDown = false, startX = 0, scrollLeft = 0, dragDistance = 0;
  container.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    isDown = true; dragDistance = 0; startX = e.pageX - container.offsetLeft; scrollLeft = container.scrollLeft;
  });
  window.addEventListener("mouseup", () => { isDown = false; });
  container.addEventListener("mouseleave", () => { isDown = false; });
  container.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    const walk = e.pageX - container.offsetLeft - startX;
    dragDistance += Math.abs(walk);
    if (Math.abs(walk) > 3) { e.preventDefault(); container.scrollLeft = scrollLeft - walk; }
  });
  container.addEventListener("click", (e) => {
    if (dragDistance > 8) { e.stopPropagation(); e.preventDefault(); dragDistance = 0; }
  }, true);
}

export function renderActiveTaskPhotos(activeItem) {
  const container = document.getElementById("activeTaskExistingPhotosContainer");
  const grid = document.getElementById("activeTaskPhotosGrid");
  const badge = document.getElementById("activeTaskPhotosBadge");
  if (!container || !grid) return;

  if (!activeItem) {
    container.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  const photosList = getUniquePhotosForActiveTask(activeItem);

  if (photosList.length === 0) {
    container.classList.add("hidden");
    grid.innerHTML = "";
    return;
  }

  container.classList.remove("hidden");
  if (badge) badge.innerText = `${photosList.length} รูป`;

  grid.innerHTML = photosList.map((p, idx) => `
    <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 cursor-pointer shadow-2xs hover:ring-2 hover:ring-blue-500 transition-all bg-slate-100 group select-none"
         onclick="window.openImageLightbox('${p.src.replace(/'/g, "\\'")}', '${p.caption.replace(/'/g, "\\'")}', '${activeItem.id}')">
      <img src="${p.src}" class="w-full h-full object-cover pointer-events-none" alt="รูปที่ ${idx + 1}" loading="lazy" draggable="false">
      <div class="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/0 transition-colors flex items-center justify-center pointer-events-none">
        <svg class="w-4 h-4 text-white drop-shadow opacity-80 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
      </div>
      <button type="button" onclick="event.stopPropagation(); window.deletePhotoFromTask('${p.src.replace(/'/g, "\\'")}', '${activeItem.id}')" class="absolute top-1 right-1 w-5 h-5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md opacity-85 hover:opacity-100 hover:scale-110 transition-all z-10 cursor-pointer" title="ลบรูปนี้">
        ✕
      </button>
      <div class="absolute bottom-0 inset-x-0 bg-slate-900/60 text-[9px] text-white text-center py-0.2 pointer-events-none">
        #${idx + 1}
      </div>
    </div>
  `).join("");

  enableSmoothHorizontalDragScroll(grid);
}

