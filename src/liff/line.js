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
      type: "error",
      title: "ไม่พบ LINE SDK",
      message: "ระบบไม่พบ LINE LIFF SDK ในเบราว์เซอร์นี้"
    });
    return false;
  }

  try {
    await liff.ready;
    if (!liff.isLoggedIn()) {
      showAppAlert({
        type: "warning",
        title: "กรุณาเข้าสู่ระบบ LINE",
        message: "กรุณากด 'เข้าสู่ระบบ LINE' เพื่อแชร์การ์ดเข้ากลุ่ม",
        onOk: () => liff.login({ redirectUri: window.location.href })
      });
      return false;
    }

    if (liff.isApiAvailable("shareTargetPicker")) {
      const res = await liff.shareTargetPicker([flexCard]);
      if (res) {
        return true;
      }
      return false;
    } else {
      // In-app 1-on-1 fallback
      if (liff.isInClient()) {
        await liff.sendMessages([flexCard]);
        showAppAlert({
          type: "success",
          title: "ส่งการ์ดสำเร็จ",
          message: successMessage
        });
        return true;
      } else {
        showAppAlert({
          type: "info",
          title: "แจ้งเตือน",
          message: "เบราว์เซอร์นี้ไม่รองรับการเปิด Share Target Picker ของ LINE โดยตรง"
        });
        return false;
      }
    }
  } catch (err) {
    console.warn("LIFF share error:", err);
    return false;
  }
}

// -------------------------------------------------------------
// FLEX MESSAGE GENERATORS
// -------------------------------------------------------------

export function createCheckinFlexCard({ id, task, techs, time, coords, mapUrl, photoCount = 0, taskId = null }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ช่างทั่วไป");
  const checkoutDeepLink = `https://liff.line.me/${MY_LIFF_ID}?tab=checkout&id=${encodeURIComponent(id)}&task=${encodeURIComponent(task)}&techs=${encodeURIComponent(techList)}&time=${encodeURIComponent(time)}&taskId=${encodeURIComponent(taskId || '')}`;
  const updateDeepLink = taskId ? `https://liff.line.me/${MY_LIFF_ID}?tab=tasks&action=update&taskId=${encodeURIComponent(taskId)}` : null;

  const footerContents = [];

  if (updateDeepLink) {
    footerContents.push({
      type: "button",
      style: "secondary",
      height: "sm",
      color: "#F1F5F9",
      margin: "xs",
      action: {
        type: "uri",
        label: "📊 อัปเดตความคืบหน้า",
        uri: updateDeepLink
      }
    });
  }

  footerContents.push({
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
  });

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
              { type: "text", text: "ทีมช่าง", size: "xs", color: "#64748B", flex: 4 },
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

export function createProgressFlexCard({ taskId, taskTitle, techs, progress, status, note, updateBy, updateTime }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ช่างทั่วไป");
  const checkoutDeepLink = `https://liff.line.me/${MY_LIFF_ID}?tab=checkout&taskId=${encodeURIComponent(taskId)}&task=${encodeURIComponent(taskTitle)}`;

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
              { type: "text", text: "ทีมช่าง", size: "xs", color: "#64748B", flex: 4 },
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
          {
            type: "box", layout: "vertical", margin: "md", contents: [
              { type: "text", text: "รายละเอียดความคืบหน้า:", size: "xs", color: "#64748B", weight: "bold" },
              { type: "text", text: `"${note || 'อัปเดตความคืบหน้าตามแผนงาน'}"`, size: "xs", color: "#0F172A", wrap: true, margin: "xs" },
              { type: "text", text: `โดย ${updateBy || 'ช่างหน้างาน'} • ${updateTime}`, size: "xxs", color: "#94A3B8", margin: "xs" }
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
            action: {
              type: "uri",
              label: "🏁 บันทึกปิดงาน",
              uri: checkoutDeepLink
            }
          }
        ]
      }
    }
  };
}

export function createCheckoutFlexCard({ id, task, techs, inTime, outTime, duration, outcome, note, photoCount = 0 }) {
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ช่างทั่วไป");

  return {
    type: "flex",
    altText: `[ปิดงานสำเร็จ] ${task} โดย ${techList}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#065F46",
        paddingAll: "18px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "FORESEE CCTV SERVICE", weight: "bold", color: "#A7F3D0", size: "xxs", flex: 6 },
              { type: "text", text: id, color: "#6EE7B7", size: "xs", align: "end", weight: "bold", flex: 4 }
            ]
          },
          {
            type: "text",
            text: "🏁 ปิดงานและส่งมอบเรียบร้อย",
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
              { type: "text", text: "ทีมช่าง", size: "xs", color: "#64748B", flex: 4 },
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
              { type: "text", text: duration || "ตามเวลาปฏิบัติงาน", size: "xs", weight: "bold", color: "#059669", flex: 6 }
            ]
          },
          {
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ผลการทำงาน", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: outcome || "ติดตั้งเรียบร้อย", size: "xs", weight: "bold", color: "#0F172A", wrap: true, flex: 6 }
            ]
          },
          ...(photoCount > 0 ? [{
            type: "box", layout: "horizontal", contents: [
              { type: "text", text: "ภาพส่งมอบ", size: "xs", color: "#64748B", flex: 4 },
              { type: "text", text: `📸 แนบรูปส่งมอบ ${photoCount} ภาพ`, size: "xs", weight: "bold", color: "#059669", flex: 6 }
            ]
          }] : []),
          ...(note ? [{
            type: "box", layout: "vertical", margin: "xs", contents: [
              { type: "text", text: `หมายเหตุ: ${note}`, size: "xs", color: "#64748B", wrap: true }
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
              { type: "text", text: requestBy || "ช่างหน้างาน", size: "xs", weight: "bold", color: "#0F172A", flex: 6 }
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
  const techList = Array.isArray(techs) ? techs.join(", ") : (techs || "ช่างทั่วไป");
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
