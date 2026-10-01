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
    ["EMP-03", "สายฟ้า ดวงเจริญ", "ช่างสายฟ้า", "095-xxx-xxxx", "พร้อมรับงาน"]
  ];
  userSheet.getRange(2, 1, sampleUsers.length, userHeaders.length).setValues(sampleUsers);
  formatDataRows(userSheet, 2, sampleUsers.length, userHeaders.length);

  // --- Tasks ---
  let taskSheet = ss.getSheetByName("Tasks");
  if (!taskSheet) taskSheet = ss.insertSheet("Tasks");
  else taskSheet.clear();

  const taskHeaders = ["รหัสงาน", "ชื่องาน / รายละเอียด", "สถานที่ / ลูกค้า", "ช่างผู้รับผิดชอบ", "กำหนดส่ง", "ความสำคัญ", "วันที่สั่ง", "สถานะ"];
  taskSheet.getRange(1, 1, 1, taskHeaders.length).setValues([taskHeaders]);
  formatHeaderRow(taskSheet, taskHeaders.length, "#1D4ED8", "#FFFFFF");

  const sampleTasks = [
    ["TASK-101", "ติดตั้งกล้อง 4 ตัว บ้านคุณสมชาย", "ซอยลาซาล 32 บางนา กทม.", "ช่างกนก", "29/09/2026 17:00", "ด่วน", "29/09/2026", "กำลังทำ"],
    ["TASK-102", "ตรวจเช็คระบบ NVR บริษัท เอ็นทีพี จำกัด", "สาทร กทม.", "ช่างมณเฑียร", "30/09/2026 18:00", "ปกติ", "29/09/2026", "รอดำเนินการ"]
  ];
  taskSheet.getRange(2, 1, sampleTasks.length, taskHeaders.length).setValues(sampleTasks);
  formatDataRows(taskSheet, 2, sampleTasks.length, taskHeaders.length);

  SpreadsheetApp.flush();
  return "Setup สำเร็จเรียบร้อยแล้ว!";
}

function formatHeaderRow(sheet, numColumns, bgColor, fontColor) {
  const range = sheet.getRange(1, 1, 1, numColumns);
  range.setBackground(bgColor).setFontColor(fontColor).setFontFamily("Sarabun").setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);
}

function formatDataRows(sheet, startRow, numRows, numColumns) {
  const range = sheet.getRange(startRow, 1, numRows, numColumns);
  range.setFontFamily("Sarabun").setFontSize(9).setVerticalAlignment("middle");
  for (let r = 0; r < numRows; r++) {
    sheet.setRowHeight(startRow + r, 32);
    if (r % 2 === 1) sheet.getRange(startRow + r, 1, 1, numColumns).setBackground("#F8FAFC");
  }
}

// ====================================================================
// 2. REST API Handlers (CORS Support สำหรับเรียกจาก GitHub Pages / Vercel)
// ====================================================================

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
        const numCols = Math.min(taskSheet.getLastColumn() - 1, 7);
        if (numCols >= 3) {
          const data = taskSheet.getRange(2, 2, taskSheet.getLastRow() - 1, numCols).getValues();
          tasks = data.filter(r => (r[numCols - 1] !== "เสร็จสิ้น")).map(r => ({ title: r[0], location: r[1], tech: r[2] }));
        }
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

// เพิ่มช่างใหม่จากหน้าเว็บ
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

// ลบรายการเช็กอินรายการเดียว
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

// ลบรายการเช็กอินหลายรายการพร้อมกัน
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

// ล้างประวัติเช็กอินทั้งหมด (ลบทุกแถวข้อมูล ยกเว้นหัวตาราง)
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

// 3. ฟังก์ชันบันทึกมอบหมายงานใหม่
function saveTask(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let taskSheet = ss.getSheetByName("Tasks");
  if (!taskSheet) taskSheet = ss.insertSheet("Tasks");

  const now = new Date();
  const dateStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy");
  const taskId = "TASK-" + ("000" + Math.max(1, taskSheet.getLastRow())).slice(-3);

  const taskTitle = payload.taskTitle || "งานติดตั้งทั่วไป";
  const customerLoc = payload.customerLoc || "-";
  const technician = payload.technician || "ไม่ระบุช่าง";
  const deadline = payload.deadline || "-";
  const priority = payload.priority || "ปกติ";

  taskSheet.appendRow([taskId, taskTitle, customerLoc, technician, deadline, priority, dateStr, "รอดำเนินการ"]);
  const lastRow = taskSheet.getLastRow();
  formatDataRows(taskSheet, lastRow, 1, 8);

  const flexCard = buildTaskFlexMessage({
    taskId: taskId, taskTitle: taskTitle, customerLoc: customerLoc,
    technician: technician, deadline: deadline, priority: priority
  });

  return { success: true, taskId: taskId, flexCard: flexCard };
}

// 4. ฟังก์ชันบันทึกเช็กอินหน้างาน
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

// 5. ฟังก์ชันบันทึกเช็กเอาต์ปิดงาน
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

// 6. Flex Message Builders
function buildTaskFlexMessage(info) {
  const isUrgent = info.priority.includes("ด่วน");
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
