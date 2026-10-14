/**
 * Enterprise Excel / CSV Report Exporter for Foresee Workplace
 * Generates beautiful, well-formatted CSV reports with UTF-8 BOM
 * and clean columns, ready to open in Microsoft Excel without gibberish (ต่างดาว).
 */

import { state } from './state.js';
import { getTaskMemberStatuses } from '../utils/taskMembers.js';
import { formatThaiDateDisplay, formatGasTime } from '../utils/date.js';
import { showAppAlert } from '../utils/dialog.js';

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports completed work history & tasks summary to Excel-compatible CSV
 */
export function exportWorkReportToExcel(scope = "history") {
  try {
    const isHistory = scope === "history";
    const now = new Date();
    const dateFormatted = now.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
    const filename = isHistory 
      ? `Foresee_รายงานประวัติงานเสร็จสิ้น_${dateFormatted}.csv`
      : `Foresee_รายงานสรุปงานทั้งหมด_${dateFormatted}.csv`;

    let rows = [];

    // 1. Report Title & Header Metadata
    rows.push([escapeCsvField("บริษัท ฟอร์ซี เทคโนโลยี จำกัด (FORESEE TECHNOLOGY CO., LTD.)")]);
    rows.push([escapeCsvField(isHistory ? "รายงานสรุปประวัติการปฏิบัติงานที่เสร็จสิ้น" : "รายงานสรุปภาระงานและผู้ปฏิบัติงานทั้งหมด")]);
    rows.push([escapeCsvField(`วันที่ออกรายงาน: ${now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })} เวลา ${now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`)]);
    rows.push([]); // Blank row

    if (isHistory) {
      // Columns for History
      const headers = [
        "ลำดับ",
        "รหัสงาน (Task ID)",
        "ชื่องาน / ไซต์งาน",
        "ผู้ปฏิบัติงาน",
        "วันที่ปฏิบัติงาน",
        "เวลาเข้างาน",
        "เวลาปิดงาน",
        "รวมเวลาทำงาน",
        "ระยะเวลาปฏิบัติงานรายคน (แยกรายบุคคล)",
        "ผลการปฏิบัติงาน",
        "รายละเอียด / หมายเหตุ",
        "จำนวนรูปถ่าย",
        "ผู้บันทึกปิดงาน"
      ];
      rows.push(headers.map(escapeCsvField));

      const logs = state.dailyLogs || [];
      if (logs.length === 0) {
        showAppAlert({
          type: "info",
          title: "ไม่มีข้อมูลสำหรับออกรายงาน",
          message: "ยังไม่มีรายการประวัติงานที่ทำเสร็จในระบบครับ"
        });
        return;
      }

      logs.forEach((log, idx) => {
        const linkedTask = state.tasksList.find(t => (log.taskId && t.id === log.taskId) || t.id === log.id || t.title === log.task);
        const memberStatuses = getTaskMemberStatuses(linkedTask || log, log);
        
        // Detailed per-person breakdown string
        const memberDurationsStr = memberStatuses.length > 0 
          ? memberStatuses.map(m => `${m.fullName}: ${m.durationLabel || (m.hasCheckedOut ? 'ทำเสร็จใน 1 วัน' : 'ร่วมปฏิบัติงาน')}`).join(" | ")
          : "-";

        const techsStr = Array.isArray(log.techs) ? log.techs.join(", ") : (log.techs || "ผู้ปฏิบัติงาน");
        const photosCount = Array.isArray(log.photos) ? log.photos.length : 0;

        rows.push([
          escapeCsvField(idx + 1),
          escapeCsvField(log.taskId || log.id || "-"),
          escapeCsvField(log.task || "-"),
          escapeCsvField(techsStr),
          escapeCsvField(log.date || "-"),
          escapeCsvField(log.checkinTime || log.time || "-"),
          escapeCsvField(log.checkoutTime || "-"),
          escapeCsvField(log.duration || "-"),
          escapeCsvField(memberDurationsStr),
          escapeCsvField(log.outcome || log.status || "เสร็จสิ้น"),
          escapeCsvField(log.note || "-"),
          escapeCsvField(`${photosCount} รูป`),
          escapeCsvField(log.closerName || log.closedBy || "-")
        ]);
      });
    } else {
      // Columns for All Active & Current Tasks
      const headers = [
        "ลำดับ",
        "รหัสงาน",
        "สถานะ",
        "ความคืบหน้า (%)",
        "ชื่องาน / ภาระงาน",
        "ผู้ปฏิบัติงานที่รับผิดชอบ",
        "สถานะส่งงานรายบุคคล (แยกคน)",
        "กำหนดส่งงาน",
        "ผู้มอบหมาย",
        "วันที่สร้างงาน",
        "อัปเดตล่าสุด"
      ];
      rows.push(headers.map(escapeCsvField));

      const tasks = state.tasksList || [];
      tasks.forEach((t, idx) => {
        const memberStatuses = getTaskMemberStatuses(t);
        const memberStatusStr = memberStatuses.length > 0
          ? memberStatuses.map(m => `${m.fullName}: ${m.statusLabel || (m.hasCheckedOut ? 'จบหน้าที่แล้ว' : 'กำลังทำ')}`).join(" | ")
          : "-";

        const techsStr = Array.isArray(t.techs) ? t.techs.join(", ") : (t.techs || t.assignee || "-");

        rows.push([
          escapeCsvField(idx + 1),
          escapeCsvField(t.id || "-"),
          escapeCsvField(t.status || "กำลังทำ"),
          escapeCsvField(`${t.progress || 0}%`),
          escapeCsvField(t.title || "-"),
          escapeCsvField(techsStr),
          escapeCsvField(memberStatusStr),
          escapeCsvField(formatThaiDateDisplay(t.deadline)),
          escapeCsvField(t.assignedBy || t.creator || "-"),
          escapeCsvField(t.date || "-"),
          escapeCsvField(t.latestUpdate || "-")
        ]);
      });
    }

    // 2. Generate CSV content with UTF-8 BOM (\uFEFF) so Excel on Windows parses Thai perfectly
    const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showAppAlert({
      type: "success",
      title: "ดาวน์โหลดรายงานสำเร็จ",
      message: `สร้างไฟล์รายงาน "${filename}" เรียบร้อยแล้ว สามารถเปิดใน Microsoft Excel ได้ทันทีโดยไม่ติดปัญหาภาษาต่างดาวครับ`
    });
  } catch (err) {
    console.error("exportWorkReportToExcel error:", err);
    showAppAlert({
      type: "error",
      title: "ไม่สามารถส่งออกรายงานได้",
      message: err.message || "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel"
    });
  }
}
