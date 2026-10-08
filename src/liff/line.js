/**
 * LINE LIFF Integration & Flex Message Generator
 */

export const MY_LIFF_ID = "2011782806-0If1jko9";

let liffProfile = null;

export async function initLiff() {
  if (typeof liff === "undefined") {
    console.warn("LINE LIFF SDK not loaded");
    return false;
  }
  try {
    await liff.init({ liffId: MY_LIFF_ID });
    await liff.ready;
    if (liff.isLoggedIn()) {
      try {
        liffProfile = await liff.getProfile();
      } catch (e) {
        console.warn("Could not get LIFF profile:", e);
      }
    }
    return true;
  } catch (err) {
    console.warn("LIFF init error:", err);
    return false;
  }
}

export function isLineLoggedIn() {
  return typeof liff !== "undefined" && liff.isLoggedIn();
}

export function getLineUserName() {
  return liffProfile ? liffProfile.displayName : null;
}

export function getLineUserProfile() {
  return liffProfile;
}

export function getLineUserId() {
  return liffProfile ? liffProfile.userId : null;
}

export function loginLine() {
  if (typeof liff !== "undefined" && !liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
  }
}

export function logoutLine() {
  if (typeof liff !== "undefined" && liff.isLoggedIn()) {
    liff.logout();
    window.location.reload();
  }
}

import { showAppAlert } from '../utils/dialog.js';

export async function triggerLiffShare(flexCard, successMessage = "แชร์เข้าห้องแชท LINE สำเร็จ!") {
  if (typeof liff === "undefined") {
    showAppAlert({
      type: "warning",
      title: "ไม่พบ LINE SDK",
      message: "ไม่สามารถเรียกใช้งาน LINE SDK ได้บนเบราว์เซอร์นี้ กรุณาเปิดผ่านลิงก์ LIFF ใน LINE ครับ"
    });
    return { success: false, reason: "no_sdk" };
  }

  try {
    await liff.ready;
    if (!liff.isLoggedIn()) {
      showAppAlert({
        type: "info",
        title: "ยังไม่ได้เข้าสู่ระบบ LINE",
        message: "ระบบบันทึกข้อมูลเข้าฐานข้อมูลแล้วครับ แต่ยังไม่ได้ส่งการ์ดเข้ากลุ่ม LINE เนื่องจากยังไม่ได้เข้าสู่ระบบ LINE บนอุปกรณ์นี้\n\nกด 'ตกลง' เพื่อเข้าสู่ระบบ LINE และแชร์การ์ดเข้ากลุ่มได้ทันทีครับ",
        onOk: () => liff.login({ redirectUri: window.location.href })
      });
      return { success: false, reason: "not_logged_in" };
    }

    // 1. Prioritize Share Target Picker so technician can select their team group chat
    if (liff.isApiAvailable("shareTargetPicker")) {
      try {
        const res = await liff.shareTargetPicker([flexCard]);
        if (res) {
          showAppAlert({
            type: "success",
            title: "ส่งข้อมูลเข้า LINE สำเร็จ",
            message: successMessage
          });
          return { success: true, method: "shareTargetPicker" };
        }
        return { success: false, reason: "cancelled" };
      } catch (pickerErr) {
        console.warn("shareTargetPicker error:", pickerErr);
        showAppAlert({
          type: "warning",
          title: "เบราว์เซอร์บล็อกป็อปอัป (Pop-up Blocked)",
          message: "Google Chrome บนคอมพิวเตอร์ได้บล็อกหน้าต่างเลือกกลุ่ม LINE ครับ\n\n👉 วิธีแก้ไข:\n1. สังเกตไอคอนป็อปอัป 🚫 ตรงขวาสุดของแถบที่อยู่ URL ด้านบน\n2. คลิกไอคอนแล้วเลือก 'อนุญาตป็อปอัปและเปลี่ยนเส้นทางเสมอ'\n3. จากนั้นกดปุ่มแชร์เข้า LINE ใหม่อีกครั้งครับ"
        });
        return { success: false, reason: "picker_error", error: pickerErr?.message };
      }
    }

    // 2. Fallback: if inside LINE client and shareTargetPicker is not available, send directly
    if (liff.isInClient()) {
      try {
        await liff.sendMessages([flexCard]);
        showAppAlert({
          type: "success",
          title: "ส่งข้อมูลเข้า LINE สำเร็จ",
          message: successMessage
        });
        return { success: true, method: "sendMessages" };
      } catch (sendErr) {
        console.warn("sendMessages fallback failed:", sendErr);
        showAppAlert({
          type: "error",
          title: "ส่งเข้า LINE ไม่สำเร็จ",
          message: sendErr.message || "ไม่สามารถส่งข้อความเข้าห้องแชทได้"
        });
        return { success: false, reason: "send_error", error: sendErr.message };
      }
    }

    showAppAlert({
      type: "info",
      title: "ระบบไม่รองรับ Share Target Picker",
      message: "เบราว์เซอร์นี้ไม่รองรับการส่งการ์ดเข้ากลุ่มภายนอก กรุณาเปิดผ่านแอป LINE หรืออนุญาตสิทธิ์ใน LINE Developers Console ครับ"
    });
    return { success: false, reason: "not_supported" };
  } catch (err) {
    console.warn("LIFF share error:", err);
    showAppAlert({
      type: "error",
      title: "เกิดข้อผิดพลาดในการแชร์",
      message: err.message || "ไม่สามารถส่งข้อมูลเข้า LINE ได้"
    });
    return { success: false, reason: "error", error: err.message };
  }
}

// -------------------------------------------------------------
// FLEX MESSAGE GENERATORS
// -------------------------------------------------------------

export function createCheckinFlexCard({ id, task, techs, time, coords, mapUrl, photoCount = 0, taskId = null }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ผู้ปฏิบัติงานทั่วไป");
  const updateDeepLink = `https://liff.line.me/${MY_LIFF_ID}?tab=checkout&action=update&id=${encodeURIComponent(id)}&task=${encodeURIComponent(task)}&techs=${encodeURIComponent(techList)}&time=${encodeURIComponent(time)}&taskId=${encodeURIComponent(taskId || '')}`;
  const checkoutDeepLink = `https://liff.line.me/${MY_LIFF_ID}?tab=checkout&action=close&id=${encodeURIComponent(id)}&task=${encodeURIComponent(task)}&techs=${encodeURIComponent(techList)}&time=${encodeURIComponent(time)}&taskId=${encodeURIComponent(taskId || '')}`;

  const footerContents = [
    {
      type: "button",
      style: "primary",
      height: "sm",
      color: "#0F172A",
      margin: "xs",
      action: {
        type: "uri",
        label: "📊 อัปเดตความคืบหน้า",
        uri: updateDeepLink
      }
    },
    {
      type: "button",
      style: "primary",
      color: "#2563EB",
      height: "sm",
      margin: "xs",
      action: {
        type: "uri",
        label: "🏁 บันทึกปิดงานเมื่อเสร็จ",
        uri: checkoutDeepLink
      }
    }
  ];

  return {
    type: "flex",
    altText: `[เช็กอินหน้างาน] ${task} โดย ${techList}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0F172A",
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "FORESEE CCTV SERVICE", weight: "bold", color: "#94A3B8", size: "xxs", flex: 6 },
              { type: "text", text: id, color: "#38BDF8", size: "xs", align: "end", weight: "bold", flex: 4 }
            ]
          },
          {
            type: "text",
            text: "📍 เช็กอินถึงหน้างานแล้ว",
            weight: "bold",
            color: "#FFFFFF",
            size: "lg",
            margin: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ผู้ปฏิบัติงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: techList, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "งาน/สถานที่", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: task, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "เวลาเช็กอิน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `${time} น.`, size: "xs", weight: "bold", color: "#16A34A", flex: 6 }
            ]
          },
          ...(photoCount > 0 ? [{
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "ภาพหน้างาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `📸 แนบรูป ${photoCount} ภาพ`, size: "xs", weight: "bold", color: "#2563EB", flex: 6 }
            ]
          }] : []),
          ...(mapUrl ? [{
            type: "box",
            layout: "horizontal",
            margin: "sm",
            contents: [
              {
                type: "button",
                style: "link",
                height: "sm",
                action: {
                  type: "uri",
                  label: "🗺️ ดูพิกัดบน Google Maps",
                  uri: mapUrl
                }
              }
            ]
          }] : [])
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        paddingTop: "0px",
        contents: footerContents
      }
    }
  };
}

export function createProgressFlexCard({ id, taskId, taskTitle, techs, progress, status, note, updateBy, updateTime, photoCount = 0, totalPhotos = 0 }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ผู้ปฏิบัติงานทั่วไป");
  const cardId = id || taskId || '';
  const updateDeepLink = `https://liff.line.me/${MY_LIFF_ID}?tab=checkout&action=update&id=${encodeURIComponent(cardId)}&taskId=${encodeURIComponent(taskId || '')}&task=${encodeURIComponent(taskTitle)}&techs=${encodeURIComponent(techList)}`;
  const closeDeepLink = `https://liff.line.me/${MY_LIFF_ID}?tab=checkout&action=close&id=${encodeURIComponent(cardId)}&taskId=${encodeURIComponent(taskId || '')}&task=${encodeURIComponent(taskTitle)}&techs=${encodeURIComponent(techList)}`;

  const displayCount = totalPhotos > 0 ? totalPhotos : photoCount;
  const photoButtonLabel = displayCount > 0 
    ? `📸 ดูรูปหน้างาน (${displayCount} รูป) & ไทม์ไลน์` 
    : `📸 ดูรูปหน้างาน & ไทม์ไลน์`;

  return {
    type: "flex",
    altText: `[อัปเดตงาน CCTV] ${taskTitle} (${status} ${progress}%)`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1E3A8A",
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "FORESEE CCTV SERVICE", weight: "bold", color: "#BFDBFE", size: "xxs", flex: 6 },
              { type: "text", text: `${progress}%`, color: "#38BDF8", size: "sm", align: "end", weight: "bold", flex: 4 }
            ]
          },
          {
            type: "text",
            text: "📊 อัปเดตความคืบหน้างาน",
            weight: "bold",
            color: "#FFFFFF",
            size: "lg",
            margin: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "18px",
        contents: [
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ผู้ปฏิบัติงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: techList, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ชื่องาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: taskTitle, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "สถานะ", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `${status} (${progress}%)`, size: "xs", weight: "bold", color: "#2563EB", flex: 6 }
            ]
          },
          ...(photoCount > 0 ? [{
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ภาพหน้างาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `📸 แนบรูปเพิ่มรอบนี้ ${photoCount} ภาพ`, size: "xs", weight: "bold", color: "#2563EB", flex: 6 }
            ]
          }] : (totalPhotos > 0 ? [{
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ภาพหน้างาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `📸 มีภาพในระบบแล้ว ${totalPhotos} ภาพ`, size: "xs", weight: "bold", color: "#2563EB", flex: 6 }
            ]
          }] : [])),
          {
            type: "box", layout: "vertical", margin: "md", contents: [
              { type: "text", text: "รายละเอียดความคืบหน้า:", size: "xs", color: "#64748B", weight: "bold" },
              { type: "text", text: `"${note || 'อัปเดตความคืบหน้าตามแผนงาน'}"`, size: "xs", color: "#0F172A", wrap: true, margin: "xs" },
              { type: "text", text: `โดย ${updateBy || 'ผู้ปฏิบัติงานหน้างาน'} • ${updateTime}`, size: "xxs", color: "#94A3B8", margin: "xs" }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        paddingTop: "0px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#2563EB",
            height: "sm",
            margin: "xs",
            action: {
              type: "uri",
              label: photoButtonLabel,
              uri: `https://liff.line.me/${MY_LIFF_ID}?tab=tasks&taskId=${encodeURIComponent(taskId || id || '')}&subtab=timeline`
            }
          },
          {
            type: "button",
            style: "primary",
            color: "#0F172A",
            height: "sm",
            margin: "xs",
            action: {
              type: "uri",
              label: "📊 อัปเดตความคืบหน้าต่อ",
              uri: updateDeepLink
            }
          },
          {
            type: "button",
            style: "primary",
            color: "#059669",
            height: "sm",
            margin: "xs",
            action: {
              type: "uri",
              label: "🏁 บันทึกปิดงานเมื่อเสร็จ",
              uri: closeDeepLink
            }
          }
        ]
      }
    }
  };
}

export function createCheckoutFlexCard({ id, task, techs, inTime, outTime, duration, outcome, note, photoCount = 0 }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ผู้ปฏิบัติงานทั่วไป");
  const isProblem = outcome === "ติดปัญหา";

  const headerBg = isProblem ? "#B91C1C" : "#065F46";
  const headerSubColor = isProblem ? "#FECACA" : "#A7F3D0";
  const headerIdColor = isProblem ? "#FCA5A5" : "#6EE7B7";
  const headerTitle = isProblem ? "⚠️ ปิดงานไม่สำเร็จ (ติดปัญหาหน้างาน)" : "🏁 ปิดงานและส่งมอบเรียบร้อย";
  const altText = isProblem ? `[ติดปัญหาหน้างาน] ${task} โดย ${techList}` : `[ปิดงานสำเร็จ] ${task} โดย ${techList}`;

  return {
    type: "flex",
    altText: altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerBg,
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "FORESEE CCTV SERVICE", weight: "bold", color: headerSubColor, size: "xxs", flex: 6 },
              { type: "text", text: id, color: headerIdColor, size: "xs", align: "end", weight: "bold", flex: 4 }
            ]
          },
          {
            type: "text",
            text: headerTitle,
            weight: "bold",
            color: "#FFFFFF",
            size: "lg",
            margin: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "18px",
        contents: [
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ผู้ปฏิบัติงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: techList, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ชื่องาน/ไซต์", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: task, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "เวลาปฏิบัติงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `${inTime} - ${outTime} น.`, size: "xs", weight: "bold", color: "#0F172A", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "รวมระยะเวลา", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: duration || "ตามเวลาปฏิบัติงาน", size: "xs", weight: "bold", color: isProblem ? "#DC2626" : "#059669", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ผลการทำงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: isProblem ? "⚠️ ติดปัญหา" : (outcome || "ติดตั้งเรียบร้อย"), size: "xs", weight: "bold", color: isProblem ? "#DC2626" : "#0F172A", wrap: true, flex: 6 }
            ]
          },
          ...(photoCount > 0 ? [{
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: isProblem ? "ภาพหน้างาน" : "ภาพส่งมอบ", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `📸 แนบรูป${isProblem ? 'หน้างาน' : 'ส่งมอบ'} ${photoCount} ภาพ`, size: "xs", weight: "bold", color: isProblem ? "#DC2626" : "#059669", flex: 6 }
            ]
          }] : []),
          ...(note ? [{
            type: "box", layout: "vertical", margin: "xs", contents: [
              { type: "text", text: isProblem ? `🚨 ปัญหาที่พบ: ${note}` : `หมายเหตุ: ${note}`, size: "xs", color: isProblem ? "#B91C1C" : "#64748B", weight: isProblem ? "bold" : "regular", wrap: true }
            ]
          }] : [])
        ]
      }
    }
  };
}

export function createExtendDeadlineFlexCard({ taskId, taskTitle, oldDeadline, newDeadline, reason, requestBy }) {
  return {
    type: "flex",
    altText: `[ขอขยายเวลาปฏิบัติงาน] ${taskTitle} -> ${newDeadline}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#B45309",
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "FORESEE CCTV SERVICE", weight: "bold", color: "#FDE68A", size: "xxs", flex: 6 },
              { type: "text", text: taskId || "", color: "#FEF3C7", size: "xs", align: "end", weight: "bold", flex: 4 }
            ]
          },
          {
            type: "text",
            text: "⏰ แจ้งขอขยายเวลางาน",
            weight: "bold",
            color: "#FFFFFF",
            size: "lg",
            margin: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "18px",
        contents: [
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ชื่องาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: taskTitle, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "กำหนดเดิม", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: oldDeadline || "-", size: "xs", color: "#DC2626", weight: "bold", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ขอขยายเป็น", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: newDeadline || "-", size: "xs", color: "#D97706", weight: "bold", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ผู้ขอขยายเวลา", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: requestBy || "ผู้ปฏิบัติงานหน้างาน", size: "xs", weight: "bold", color: "#0F172A", flex: 6 }
            ]
          },
          {
            type: "box", layout: "vertical", margin: "md", contents: [
              { type: "text", text: "เหตุผลความจำเป็น:", size: "xs", color: "#64748B", weight: "bold" },
              { type: "text", text: `"${reason}"`, size: "xs", color: "#0F172A", wrap: true, margin: "xs" }
            ]
          }
        ]
      }
    }
  };
}

export function createAssignTaskFlexCard({ id, title, category, priority, customer, techs, startDate, deadline, desc }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ผู้ปฏิบัติงานทั่วไป");
  const isUrgent = (priority || "").includes("ด่วน");
  const headerBg = isUrgent ? "#991B1B" : "#1E3A8A";
  const custName = customer?.name || "-";
  const custPhone = customer?.phone || "-";
  const custAddress = customer?.address || "-";

  return {
    type: "flex",
    altText: `[มอบหมายงาน CCTV] ${title} ถึง ${techList}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerBg,
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "FORESEE WORKPLACE", weight: "bold", color: "#93C5FD", size: "xxs", flex: 6 },
              { type: "text", text: priority || "ปกติ", color: "#FFFFFF", size: "xs", align: "end", weight: "bold", flex: 4 }
            ]
          },
          {
            type: "text",
            text: "📋 มอบหมายงานใหม่",
            weight: "bold",
            color: "#FFFFFF",
            size: "lg",
            margin: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "18px",
        contents: [
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "รหัสงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: id, size: "xs", weight: "bold", color: "#0F172A", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ผู้รับผิดชอบ", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: techList, size: "xs", weight: "bold", color: "#1D4ED8", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ประเภทงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: category || "ติดตั้งงานใหม่", size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ลูกค้า / เบอร์", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `${custName} (${custPhone})`, size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "สถานที่หน้างาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: custAddress, size: "xs", color: "#334155", wrap: true, flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ช่วงเวลางาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `${startDate} ถึง ${deadline}`, size: "xs", color: "#334155", flex: 6 }
            ]
          },
          ...(desc ? [{
            type: "box", layout: "vertical", margin: "xs", contents: [
              { type: "text", text: `รายละเอียด: ${desc}`, size: "xs", color: "#64748B", wrap: true }
            ]
          }] : [])
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "12px",
        paddingTop: "0px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1E3A8A",
            height: "sm",
            action: {
              type: "uri",
              label: "📍 แตะเพื่อเปิดเช็กอินงานนี้",
              uri: `https://liff.line.me/${MY_LIFF_ID}?tab=checkin&taskId=${encodeURIComponent(id)}`
            }
          }
        ]
      }
    }
  };
}
