/**
 * ====================================================================
 * ระบบบันทึกเวลาช่าง & มอบหมายงานผ่าน LINE LIFF (Backend & Database API)
 * Foresee Technology Co., Ltd.
 * Google Sheets + Google Apps Script (REST API for GitHub Pages / Vercel)
 * ====================================================================
 */

// 1. ฟังก์ชันจัดแต่งและตั้งค่า Google Sheets อัตโนมัติ (กดรันครั้งแรกครั้งเดียว)
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Checkins ---
  let checkinSheet = ss.getSheetByName("Checkins");
  if (!checkinSheet) checkinSheet = ss.insertSheet("Checkins");
  else checkinSheet.clear();

  const checkinHeaders = [
    "รหัสรายการ (ID)", "วันที่", "เวลาเช็กอิน", "ชื่อช่าง", 
    "ชื่องาน / ลูกค้า", "พิกัด GPS", "แผนที่ Google Maps", 
    "เวลาเช็กเอาต์", "ระยะเวลาปฏิบัติงาน", "สถานะ"
  ];
  checkinSheet.getRange(1, 1, 1, checkinHeaders.length).setValues([checkinHeaders]);
  formatHeaderRow(checkinSheet, checkinHeaders.length, "#1E293B", "#FFFFFF");

  const sampleCheckins = [
    ["CHK-001", "29/09/2026", "09:15:00", "ช่างกนก", "ติดตั้งกล้อง 4 ตัว บ้านคุณสมชาย (บางนา)", "13.6682, 100.6341", "https://maps.google.com/?q=13.6682,100.6341", "12:45:00", "3 ชม. 30 นาที", "ปิดงานแล้ว"]
  ];
  checkinSheet.getRange(2, 1, sampleCheckins.length, checkinHeaders.length).setValues(sampleCheckins);
  formatDataRows(checkinSheet, 2, sampleCheckins.length, checkinHeaders.length);

  // --- Users ---
  let userSheet = ss.getSheetByName("Users");
  if (!userSheet) userSheet = ss.insertSheet("Users");
  else userSheet.clear();

  const userHeaders = ["รหัสช่าง", "ชื่อ-นามสกุล", "ชื่อเล่น", "เบอร์โทรศัพท์", "สถานะ"];
  userSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);
  formatHeaderRow(userSheet, userHeaders.length, "#0F766E", "#FFFFFF");

  const sampleUsers = [
    ["EMP-01", "กนกศักดิ์ กว้างจิตต์อารีย์", "ช่างกนก", "081-xxx-xxxx", "พร้อมรับงาน"],
    ["EMP-02", "มณเฑียร แซ่ตั้ง", "ช่างมณเฑียร", "089-xxx-xxxx", "พร้อมรับงาน"],
    ["EMP-03", "สายฟ้า วิชิตเดชา", "ช่างสายฟ้า", "086-xxx-xxxx", "พร้อมรับงาน"]
  ];
  userSheet.getRange(2, 1, sampleUsers.length, userHeaders.length).setValues(sampleUsers);
  formatDataRows(userSheet, 2, sampleUsers.length, userHeaders.length);

  // --- Tasks ---
  let taskSheet = ss.getSheetByName("Tasks");
  if (!taskSheet) taskSheet = ss.insertSheet("Tasks");
  else taskSheet.clear();

  ensureTaskSheetHeaders(taskSheet);

  const sampleTasks = [
    ["TASK-101", "ติดตั้งกล้อง 4 ตัว บ้านคุณสมชาย (บางนา)", "ซอยลาซาล 32 บางนา กทม.", "ช่างกนก", "28/09/2026 17:00", "เสร็จสิ้น", "28/09/2026 17:00", "-", "-"],
    ["TASK-102", "ตรวจเช็คระบบ NVR บริษัท เอ็นทีพี จำกัด", "สาทร กทม.", "ช่างมณเฑียร", "28/09/2026 18:00", "กำลังทำ", "28/09/2026 18:00", "-", "-"],
    ["TASK-103", "เดินสายสัญญาณกล้องไซต์พระราม 2", "พระราม 2 ซอย 50", "ช่างสายฟ้า", "29/09/2026 15:00", "รอดำเนินการ", "29/09/2026 15:00", "-", "-"]
  ];
  taskSheet.getRange(2, 1, sampleTasks.length, sampleTasks[0].length).setValues(sampleTasks);
  formatDataRows(taskSheet, 2, sampleTasks.length, sampleTasks[0].length);

  return "ตั้งค่าฐานข้อมูล 3 Sheets เรียบร้อยแล้ว!";
}

function ensureTaskSheetHeaders(taskSheet) {
  const taskHeaders = [
    "รหัสงาน", "ชื่องาน / ลูกค้า", "สถานที่ / พิกัด", 
    "ช่างผู้รับผิดชอบ", "กำหนดส่ง", "สถานะ", 
    "กำหนดส่งเดิม", "เหตุผลการขยายเวลา / หมายเหตุ", "ผู้ขอขยายเวลา"
  ];
  taskSheet.getRange(1, 1, 1, taskHeaders.length).setValues([taskHeaders]);
  formatHeaderRow(taskSheet, taskHeaders.length, "#1D4ED8", "#FFFFFF");
}

function doGet(e) {
  const initialData = getInitialData();
  return ContentService.createTextOutput(JSON.stringify(initialData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let result = { success: false, message: "No action" };
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action;

    if (action === "saveCheckin") {
      result = saveCheckin(payload);
    } else if (action === "saveCheckout") {
      result = saveCheckout(payload);
    } else if (action === "saveTask") {
      result = saveTask(payload);
    } else if (action === "extendTaskDeadline") {
      result = extendTaskDeadline(payload);
    } else if (action === "updateTaskProgress") {
      result = updateTaskProgress(payload);
    } else if (action === "addNewTechnician") {
      result = addNewTechnician(payload.name);
    } else if (action === "deleteCheckin") {
      result = deleteCheckin(payload.id);
    } else if (action === "deleteMultipleCheckins") {
      result = deleteMultipleCheckins(payload.ids);
    } else if (action === "clearAllCheckins") {
      result = clearAllCheckins();
    } else if (action === "getInitialData") {
      result = getInitialData();
    }
  } catch (err) {
    result = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ดึงข้อมูลรายชื่อช่างและงาน
function getInitialData() {
  let technicians = ["ช่างกนก", "ช่างมณเฑียร", "ช่างสายฟ้า"];
  let tasks = [];
  let activeCheckins = [];

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      const userSheet = ss.getSheetByName("Users");
      if (userSheet && userSheet.getLastRow() > 1) {
        const data = userSheet.getRange(2, 3, userSheet.getLastRow() - 1, 1).getValues();
        const names = data.map(r => r[0]).filter(name => name !== "");
        if (names.length > 0) technicians = names;
      }

      const taskSheet = ss.getSheetByName("Tasks");
      if (taskSheet && taskSheet.getLastRow() > 1) {
        ensureTaskSheetHeaders(taskSheet);
        const lastRow = taskSheet.getLastRow();
        const data = taskSheet.getRange(2, 1, lastRow - 1, 9).getValues();
        tasks = data.map(r => ({
          id: String(r[0] || "").trim(),
          title: String(r[1] || "").trim(),
          desc: String(r[2] || "-").trim(),
          location: String(r[2] || "-").trim(),
          techs: String(r[3] || "").split(",").map(s => s.trim()).filter(Boolean),
          deadline: String(r[4] || "-").trim(),
          status: String(r[5] || "รอดำเนินการ").trim(),
          oldDeadline: String(r[6] || "-").trim(),
          reason: String(r[7] || "-").trim(),
          updateBy: String(r[8] || "-").trim()
        }));
      }

      const checkinSheet = ss.getSheetByName("Checkins");
      if (checkinSheet && checkinSheet.getLastRow() > 1) {
        const numCols = Math.min(checkinSheet.getLastColumn(), 10);
        const data = checkinSheet.getRange(2, 1, checkinSheet.getLastRow() - 1, numCols).getValues();
        activeCheckins = data.map((r, idx) => ({
          rowId: idx + 2, id: r[0], date: r[1], time: r[2], tech: r[3], task: r[4], status: r[r.length - 1]
        })).filter(r => r.status === "กำลังปฏิบัติงาน");
      }
    }
  } catch (err) {
    console.warn("getInitialData fallback:", err);
  }

  return {
    technicians: technicians,
    tasks: tasks,
    activeCheckins: activeCheckins
  };
}

// 2. ฟังก์ชันขยายเวลากำหนดส่งงาน (Real-time Google Sheet Update)
function extendTaskDeadline(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let taskSheet = ss.getSheetByName("Tasks");
    if (!taskSheet) return { success: false, message: "Tasks sheet not found" };
    ensureTaskSheetHeaders(taskSheet);

    const taskId = String(payload.taskId || "").trim();
    const newDeadline = payload.newDeadline || "-";
    const oldDeadline = payload.oldDeadline || "-";
    const reason = payload.reason || "-";
    const updateBy = payload.updateBy || "ช่างหน้างาน";

    const data = taskSheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === taskId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      const title = String(payload.taskTitle || "").trim();
      if (title) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === title) {
            targetRow = i + 1;
            break;
          }
        }
      }
    }

    if (targetRow === -1) {
      return { success: false, message: `Task ${taskId} not found` };
    }

    // Col E (5): New Deadline
    taskSheet.getRange(targetRow, 5).setValue(newDeadline).setFontColor("#DC2626").setFontWeight("bold");

    // Col G (7): Original Deadline (keep first recorded old deadline)
    const existingOldDeadline = String(taskSheet.getRange(targetRow, 7).getValue()).trim();
    if (!existingOldDeadline || existingOldDeadline === "-" || existingOldDeadline === "") {
      taskSheet.getRange(targetRow, 7).setValue(oldDeadline || data[targetRow - 1][4]);
    }

    // Col H (8): Reason / Remarks (บันทึกเหตุผลพร้อมระบุเวลา)
    const nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM HH:mm");
    const existingNotes = String(taskSheet.getRange(targetRow, 8).getValue()).trim();
    const entry = `[เลื่อนเป็น ${newDeadline}] ${reason} (โดย ${updateBy} เมื่อ ${nowStr})`;
    const fullNotes = (existingNotes && existingNotes !== "-") ? `${existingNotes}\n${entry}` : entry;
    taskSheet.getRange(targetRow, 8).setValue(fullNotes).setWrap(true);

    // Col I (9): ผู้ขอขยายเวลา
    taskSheet.getRange(targetRow, 9).setValue(updateBy);

    formatDataRows(taskSheet, targetRow, 1, 9);
    return { success: true, taskId: taskId, newDeadline: newDeadline };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// 3. ฟังก์ชันอัปเดตความคืบหน้างาน (Real-time Google Sheet Update)
function updateTaskProgress(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let taskSheet = ss.getSheetByName("Tasks");
    if (!taskSheet) return { success: false, message: "Tasks sheet not found" };
    ensureTaskSheetHeaders(taskSheet);

    const taskId = String(payload.taskId || "").trim();
    const status = payload.status || "กำลังทำ";
    const progress = payload.progress || 0;
    const note = payload.note || "";
    const updateBy = payload.updateBy || "ช่างหน้างาน";

    const data = taskSheet.getDataRange().getValues();
    let targetRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === taskId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      const title = String(payload.taskTitle || "").trim();
      if (title) {
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === title) {
            targetRow = i + 1;
            break;
          }
        }
      }
    }

    if (targetRow === -1) {
      return { success: false, message: `Task ${taskId} not found` };
    }

    // Col F (6): Status
    const statusCell = taskSheet.getRange(targetRow, 6);
    statusCell.setValue(status).setFontWeight("bold");
    if (status === "เสร็จสิ้น") {
      statusCell.setBackground("#BBF7D0").setFontColor("#166534");
    } else if (status === "กำลังทำ") {
      statusCell.setBackground("#DBEAFE").setFontColor("#1E40AF");
    } else {
      statusCell.setBackground("#FEF08A").setFontColor("#854D0E");
    }

    // Col H (8): Append progress note if present
    if (note) {
      const nowStr = Utilities.formatDate(new Date(), "GMT+7", "dd/MM HH:mm");
      const existingNotes = String(taskSheet.getRange(targetRow, 8).getValue()).trim();
      const entry = `[คืบหน้า ${progress}%: ${status}] ${note} (โดย ${updateBy} เมื่อ ${nowStr})`;
      const fullNotes = (existingNotes && existingNotes !== "-") ? `${existingNotes}\n${entry}` : entry;
      taskSheet.getRange(targetRow, 8).setValue(fullNotes).setWrap(true);
    }

    // Col I (9): Updated By
    taskSheet.getRange(targetRow, 9).setValue(updateBy);

    formatDataRows(taskSheet, targetRow, 1, 9);
    return { success: true, taskId: taskId, status: status, progress: progress };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// 4. ฟังก์ชันบันทึกมอบหมายงานใหม่
function saveTask(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let taskSheet = ss.getSheetByName("Tasks");
    if (!taskSheet) taskSheet = ss.insertSheet("Tasks");
    ensureTaskSheetHeaders(taskSheet);

    const taskId = payload.taskId || ("TASK-" + ("000" + Math.max(1, taskSheet.getLastRow())).slice(-3));
    const taskTitle = payload.taskTitle || "งานติดตั้งทั่วไป";
    const customerLoc = payload.customerLoc || "-";
    const technician = payload.technician || "ไม่ระบุช่าง";
    const deadline = payload.deadline || "-";
    const status = payload.status || "รอดำเนินการ";

    taskSheet.appendRow([taskId, taskTitle, customerLoc, technician, deadline, status, "-", "-", "-"]);
    const lastRow = taskSheet.getLastRow();
    formatDataRows(taskSheet, lastRow, 1, 9);

    const flexCard = buildTaskFlexMessage({
      taskId: taskId, taskTitle: taskTitle, customerLoc: customerLoc,
      technician: technician, deadline: deadline, priority: status
    });

    return { success: true, taskId: taskId, flexCard: flexCard };
  } catch(err) {
    return { success: false, error: err.toString() };
  }
}

// 5. ฟังก์ชันบันทึกเช็กอินหน้างาน
function saveCheckin(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let checkinSheet = ss.getSheetByName("Checkins");
  if (!checkinSheet) checkinSheet = ss.insertSheet("Checkins");
  
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
  const timeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
  
  const id = "CHK-" + ("000" + Math.max(1, checkinSheet.getLastRow())).slice(-3);
  const techName = payload.technician || "ไม่ระบุช่าง";
  const taskName = payload.taskName || "งานทั่วไป";
  const lat = payload.lat || "0";
  const lng = payload.lng || "0";
  const gpsCoord = `${lat}, ${lng}`;
  const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
  
  checkinSheet.appendRow([id, dateStr, timeStr, techName, taskName, gpsCoord, mapUrl, "-", "-", "กำลังปฏิบัติงาน"]);
  const lastRow = checkinSheet.getLastRow();
  formatDataRows(checkinSheet, lastRow, 1, 10);
  checkinSheet.getRange(lastRow, 10).setBackground("#FEF08A").setFontColor("#854D0E").setFontWeight("bold");

  const flexCard = buildCheckinFlexMessage({
    id: id, techName: techName, taskName: taskName,
    dateStr: dateStr, timeStr: timeStr, mapUrl: mapUrl
  });

  return { success: true, id: id, flexCard: flexCard };
}

// 6. ฟังก์ชันบันทึกเช็กเอาต์ปิดงาน
function saveCheckout(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const checkinSheet = ss.getSheetByName("Checkins");
  const targetId = payload.id;
  const now = new Date();
  const outTimeStr = Utilities.formatDate(now, "GMT+7", "HH:mm:ss");
  
  const data = checkinSheet.getDataRange().getValues();
  let foundRow = -1;
  let inTimeStr = "";
  let techName = "";
  let taskName = "";

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === targetId) {
      foundRow = i + 1;
      inTimeStr = data[i][2];
      techName = data[i][3];
      taskName = data[i][4];
      break;
    }
  }

  if (foundRow === -1) return { success: false, message: "ไม่พบรหัสงานนี้" };

  const durationStr = calculateDuration(inTimeStr, outTimeStr);
  checkinSheet.getRange(foundRow, 8).setValue(outTimeStr);
  checkinSheet.getRange(foundRow, 9).setValue(durationStr);
  checkinSheet.getRange(foundRow, 10).setValue("ปิดงานแล้ว").setBackground("#BBF7D0").setFontColor("#166534").setFontWeight("bold");

  const flexCard = buildCheckoutFlexMessage({
    id: targetId, techName: techName, taskName: taskName,
    inTimeStr: inTimeStr, outTimeStr: outTimeStr, durationStr: durationStr
  });

  return { success: true, id: targetId, flexCard: flexCard };
}

function calculateDuration(start, end) {
  try {
    const sParts = start.split(":").map(Number);
    const eParts = end.split(":").map(Number);
    let diffMinutes = (eParts[0] * 60 + eParts[1]) - (sParts[0] * 60 + sParts[1]);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`;
  } catch (e) {
    return "-";
  }
}

// 7. เพิ่มช่างใหม่จากหน้าเว็บ
function addNewTechnician(name) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let userSheet = ss.getSheetByName("Users");
    if (!userSheet) userSheet = ss.insertSheet("Users");
    const newId = "EMP-" + ("00" + Math.max(1, userSheet.getLastRow())).slice(-2);
    userSheet.appendRow([newId, name, name, "-", "พร้อมรับงาน"]);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.toString() };
  }
}

// 8. ฟังก์ชันลบรายการเช็กอิน
function deleteCheckin(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const checkinSheet = ss.getSheetByName("Checkins");
    if (!checkinSheet || checkinSheet.getLastRow() <= 1) return { success: true, deleted: 0 };
    
    const data = checkinSheet.getRange(2, 1, checkinSheet.getLastRow() - 1, 1).getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === id) {
        checkinSheet.deleteRow(i + 2);
        return { success: true, deleted: 1, id: id };
      }
    }
    return { success: false, message: "ID not found" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function deleteMultipleCheckins(ids) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const checkinSheet = ss.getSheetByName("Checkins");
    if (!checkinSheet || checkinSheet.getLastRow() <= 1 || !Array.isArray(ids) || ids.length === 0) {
      return { success: true, deleted: 0 };
    }
    
    const idSet = new Set(ids);
    const data = checkinSheet.getRange(2, 1, checkinSheet.getLastRow() - 1, 1).getValues();
    let count = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (idSet.has(data[i][0])) {
        checkinSheet.deleteRow(i + 2);
        count++;
      }
    }
    return { success: true, deleted: count };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function clearAllCheckins() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const checkinSheet = ss.getSheetByName("Checkins");
    if (!checkinSheet || checkinSheet.getLastRow() <= 1) return { success: true, count: 0 };
    
    const lastRow = checkinSheet.getLastRow();
    checkinSheet.deleteRows(2, lastRow - 1);
    return { success: true, cleared: lastRow - 1 };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

// 9. Flex Message Builders
function buildTaskFlexMessage(info) {
  const isUrgent = String(info.priority || "").includes("ด่วน");
  return {
    type: "flex",
    altText: `📋 มอบหมายงาน: ${info.taskTitle} (ถึง ${info.technician})`,
    contents: {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: isUrgent ? "#DC2626" : "#1D4ED8", paddingAll: "18px",
        contents: [{
          type: "box", layout: "horizontal",
          contents: [
            { type: "text", text: isUrgent ? `🔥 ${info.priority}` : "📋 งานมอบหมายใหม่", weight: "bold", color: "#FFFFFF", size: "md", flex: 1 },
            { type: "text", text: info.taskId, weight: "bold", color: "#E0E7FF", size: "xs", align: "end" }
          ]
        }]
      },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: info.taskTitle, weight: "bold", size: "md", color: "#0F172A", wrap: true },
          { type: "separator" },
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "ช่างผู้รับผิดชอบ:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.technician, size: "xs", weight: "bold", color: "#0F172A", flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "สถานที่ / ลูกค้า:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.customerLoc, size: "xs", color: "#334155", wrap: true, flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "กำหนดส่ง:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: `⏰ ${info.deadline}`, size: "xs", weight: "bold", color: isUrgent ? "#DC2626" : "#1E40AF", flex: 5 }
          ]}
        ]
      }
    }
  };
}

function buildCheckinFlexMessage(info) {
  return {
    type: "flex",
    altText: `📍 ${info.techName} เช็กอินถึงหน้างานแล้ว (${info.timeStr})`,
    contents: {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#1D4ED8", paddingAll: "18px",
        contents: [{
          type: "box", layout: "horizontal",
          contents: [
            { type: "text", text: "📍 เช็กอินถึงหน้างานแล้ว", weight: "bold", color: "#FFFFFF", size: "md", flex: 1 },
            { type: "text", text: info.timeStr, weight: "bold", color: "#EFF6FF", size: "xs", align: "end" }
          ]
        }]
      },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "ช่างผู้รับผิดชอบ:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.techName, size: "xs", weight: "bold", color: "#0F172A", flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "งาน / ลูกค้า:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.taskName, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "วันที่:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.dateStr, size: "xs", color: "#334155", flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "สถานะ:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: "🟡 กำลังปฏิบัติงาน", size: "xs", weight: "bold", color: "#D97706", flex: 5 }
          ]}
        ]
      },
      footer: {
        type: "box", layout: "vertical",
        contents: [{
          type: "button", style: "primary", color: "#2563EB", height: "sm",
          action: { type: "uri", label: "🗺️ เปิดดูพิกัดบน Google Maps", uri: info.mapUrl }
        }]
      }
    }
  };
}

function buildCheckoutFlexMessage(info) {
  return {
    type: "flex",
    altText: `🏁 ${info.techName} เช็กเอาต์ปิดงานแล้ว (${info.outTimeStr})`,
    contents: {
      type: "bubble", size: "mega",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#166534", paddingAll: "18px",
        contents: [{
          type: "box", layout: "horizontal",
          contents: [
            { type: "text", text: "🏁 เช็กเอาต์ปิดงานเรียบร้อย", weight: "bold", color: "#FFFFFF", size: "md", flex: 1 },
            { type: "text", text: info.outTimeStr, weight: "bold", color: "#DCFCE7", size: "xs", align: "end" }
          ]
        }]
      },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "ช่างผู้รับผิดชอบ:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.techName, size: "xs", weight: "bold", color: "#0F172A", flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "งาน / ลูกค้า:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: info.taskName, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "เวลาที่ใช้หน้างาน:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: `⏱️ ${info.durationStr}`, size: "xs", weight: "bold", color: "#166534", flex: 5 }
          ]},
          { type: "box", layout: "horizontal", contents: [
            { type: "text", text: "สถานะ:", size: "xs", color: "#64748B", flex: 3 },
            { type: "text", text: "🟢 ปิดงานสำเร็จ", size: "xs", weight: "bold", color: "#166534", flex: 5 }
          ]}
        ]
      }
    }
  };
}

// Helper formatting functions
function formatHeaderRow(sheet, numCols, bgHex, fontHex) {
  const range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground(bgHex)
       .setFontColor(fontHex)
       .setFontWeight("bold")
       .setHorizontalAlignment("center")
       .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);
}

function formatDataRows(sheet, startRow, numRows, numCols) {
  if (numRows <= 0) return;
  const range = sheet.getRange(startRow, 1, numRows, numCols);
  range.setFontFamily("Sarabun")
       .setFontSize(10)
       .setVerticalAlignment("middle");
  for (let r = startRow; r < startRow + numRows; r++) {
    sheet.setRowHeight(r, 32);
  }
}
