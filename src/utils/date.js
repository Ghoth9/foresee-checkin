/**
 * Date utility functions for Foresee Checkin
 */

export function parseDeadlineDate(dStr) {
  if (!dStr || dStr === "-" || typeof dStr !== "string") return null;
  dStr = dStr.trim();
  
  // Format DD/MM/YYYY or DD/MM/YYYY HH:mm
  const dmyMatch = dStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year > 2400) year -= 543;
    return new Date(year, month, day, 23, 59, 59);
  }
  
  // Format YYYY-MM-DD
  const ymdMatch = dStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day, 23, 59, 59);
  }
  
  const parsed = new Date(dStr);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

export function getDaysRemaining(deadlineStr) {
  const d = parseDeadlineDate(deadlineStr);
  if (!d) return null;
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  
  return Math.round((targetStart - todayStart) / (1000 * 60 * 60 * 24));
}

export function isTaskOverdue(deadlineStr, isDone) {
  if (isDone) return false;
  const diffDays = getDaysRemaining(deadlineStr);
  return diffDays !== null && diffDays < 0;
}

export function getDeadlineCountdownBadge(deadlineStr, isDone) {
  if (isDone) {
    return `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 whitespace-nowrap flex-shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      <span>ปิดงานแล้ว</span>
    </span>`;
  }
  
  const diffDays = getDaysRemaining(deadlineStr);
  if (diffDays === null) return '';

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap flex-shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
      <span>เกินกำหนด ${overdue} วัน</span>
    </span>`;
  } else if (diffDays === 0) {
    return `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap flex-shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
      <span>ครบกำหนดวันนี้</span>
    </span>`;
  } else if (diffDays === 1) {
    return `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap flex-shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
      <span>ครบกำหนดพรุ่งนี้</span>
    </span>`;
  } else {
    return `<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap flex-shrink-0">
      <span>เหลืออีก ${diffDays} วัน</span>
    </span>`;
  }
}

export function formatThaiDateDisplay(ymdOrDmy) {
  if (!ymdOrDmy || ymdOrDmy === "-") return "-";
  const d = parseDeadlineDate(ymdOrDmy);
  if (!d) return ymdOrDmy;
  
  const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const thaiYear = (d.getFullYear() + 543).toString().slice(-2);
  return `${day} ${month} ${thaiYear}`;
}

export function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getSevenDaysLaterYMD() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatGasTime(val) {
  if (!val || val === "-") return "-";
  const s = String(val).trim();
  if (s.includes("T")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const h = String((d.getUTCHours() + 7) % 24).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    }
  }
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return s.length > 5 ? s.slice(0, 5) : s;
}

export function formatGasDate(val) {
  if (!val || val === "-") return "-";
  const s = String(val);
  if (s.includes("GMT") || s.includes("T")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }
  return s;
}

export function formatDisplayTime(timeStr) {
  return formatGasTime(timeStr);
}

