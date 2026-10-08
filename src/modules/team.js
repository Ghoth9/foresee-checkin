/**
 * Team & Role Management Module (จัดการสิทธิ์และทีมงาน)
 * Handles Admin/Technician roles, auto-binding LINE accounts, role simulation,
 * Admin PIN unlock, member management, and technician chips.
 */

import { state } from './state.js';
import { 
  bindTechnicianLineUserApi, 
  updateTechnicianRoleApi, 
  addNewTechnicianWithRoleApi, 
  addNewTechnicianApi, 
  deleteTechnicianApi 
} from '../api/supabase.js';
import { 
  isLineLoggedIn, 
  getLineUserProfile, 
  getLineUserName, 
  getLineUserId 
} from '../liff/line.js';
import { showAppAlert, showAppConfirm } from '../utils/dialog.js';
import { renderTechFilterChips, renderAssignTechChips } from './tasks.js';
import { renderActiveCheckoutList, renderTodayLogs } from './checkoutList.js';
import { openSelectOperatorModal } from './operator.js';

export const MASTER_ADMIN_PIN = "8888";
let currentTeamRoleFilter = "all";

export function isCurrentUserAdmin() {
  return state.currentUserRole === "admin";
}

export function isUserAdminActual() {
  if (sessionStorage.getItem("fs_admin_override") === "true") return true;
  if (state.currentLinkedTech && state.currentLinkedTech.role === "admin") return true;
  if (isLineLoggedIn()) {
    const profile = getLineUserProfile();
    if (profile && profile.userId) {
      const match = state.techniciansList.find(t => t.line_user_id === profile.userId);
      if (match && match.role === "admin") return true;
      const dName = (profile.displayName || "").toLowerCase();
      if (dName.includes("nonmarn") || dName.includes("baipor") || dName.includes("ใบปอ") || dName.includes("อาร์ม") || dName.includes("arm")) return true;
    }
  }
  return false;
}

export async function resolveUserRole() {
  // 1. Identify LINE Login Profile and perform Auto-Bind
  let matchedTech = null;
  if (isLineLoggedIn()) {
    const profile = getLineUserProfile();
    if (profile && profile.userId) {
      // Find match in techniciansList by line_user_id
      let match = state.techniciansList.find(t => t.line_user_id === profile.userId);

      // If not found by line_user_id, match by displayName keywords
      if (!match) {
        const dName = (profile.displayName || "").toLowerCase();
        if (dName.includes("nonmarn")) {
          match = state.techniciansList.find(t => t.name && t.name.toLowerCase().includes("nonmarn"));
        } else if (dName.includes("baipor") || dName.includes("ใบปอ") || dName.includes("095-8188897") || dName.includes("สุพิชชาญาต์")) {
          match = state.techniciansList.find(t => (t.name && (t.name.includes("ใบปอ") || t.name.includes("สุพิชชาญาต์"))));
        } else if (dName.includes("arm") || dName.includes("อาร์ม") || dName.includes("ชัยวัฒน์")) {
          match = state.techniciansList.find(t => t.name && (t.name.includes("อาร์ม") || t.name.includes("ชัยวัฒน์")));
        }

        // Or match against any technician's nickname
        if (!match) {
          match = state.techniciansList.find(t => {
            if (!t.name) return false;
            const pureName = t.name.replace(/K\./g, '').split('(')[0].trim().toLowerCase();
            return pureName && pureName.length > 1 && dName.includes(pureName);
          });
        }

        // Auto-bind line_user_id to this technician in Supabase
        if (match && !match.line_user_id) {
          match.line_user_id = profile.userId;
          bindTechnicianLineUserApi(match.id, profile.userId);
        }
      }

      if (match) {
        state.currentLinkedTech = match;
        matchedTech = match;
      }
    }
  }

  // 2. Fallback to localStorage operator profile (for PC, iPad, or when not auto-matched)
  if (!matchedTech) {
    const storedId = localStorage.getItem("fs_current_operator_id");
    const storedName = localStorage.getItem("fs_current_operator_name");
    if (storedId || storedName) {
      const match = state.techniciansList.find(t => (storedId && t.id === storedId) || (storedName && t.name === storedName));
      if (match) {
        state.currentLinkedTech = match;
        matchedTech = match;
      }
    }
  }

  // Persist matched operator and auto-select in check-in form
  if (matchedTech) {
    state.currentLinkedTech = matchedTech;
    localStorage.setItem("fs_current_operator_id", matchedTech.id);
    localStorage.setItem("fs_current_operator_name", matchedTech.name);
    if (!state.selectedCheckinTechs || state.selectedCheckinTechs.length === 0) {
      state.selectedCheckinTechs = [matchedTech.name];
      renderCheckinTechChips();
    }
  }

  // 3. Determine actual role
  let actualRole = "technician";
  if (matchedTech && matchedTech.role === "admin") {
    actualRole = "admin";
  } else if (sessionStorage.getItem("fs_admin_override") === "true") {
    actualRole = "admin";
  }

  // 4. Check active simulation (persisted in sessionStorage)
  const sim = sessionStorage.getItem("fs_simulated_role");
  if (sim) {
    state.simulatedRole = sim;
    state.currentUserRole = sim;
    applyRolePermissionsUI(state.currentUserRole, state.currentLinkedTech);
    if (typeof window.renderTasksListScoped === "function") window.renderTasksListScoped();
    if (typeof window.renderAssignedTasksBannerScoped === "function") window.renderAssignedTasksBannerScoped();
    renderActiveCheckoutList();
    renderTodayLogs();
    return;
  }

  // 5. Normal role application
  state.currentUserRole = actualRole;
  applyRolePermissionsUI(state.currentUserRole, state.currentLinkedTech);
  if (typeof window.renderTasksListScoped === "function") window.renderTasksListScoped();
  if (typeof window.renderAssignedTasksBannerScoped === "function") window.renderAssignedTasksBannerScoped();
  renderActiveCheckoutList();
  renderTodayLogs();

  // 6. If no operator has been chosen yet, and not admin override -> prompt selection
  if (!state.currentLinkedTech && !isUserAdminActual() && !sessionStorage.getItem("fs_operator_prompted")) {
    sessionStorage.setItem("fs_operator_prompted", "true");
    setTimeout(() => {
      if (!state.currentLinkedTech && !isUserAdminActual()) {
        openSelectOperatorModal();
      }
    }, 400);
  }
}

export function switchSimulatedRole(mode) {
  if (mode === "admin") {
    sessionStorage.removeItem("fs_simulated_role");
    state.simulatedRole = null;
    state.currentUserRole = "admin";
  } else {
    sessionStorage.setItem("fs_simulated_role", "technician");
    state.simulatedRole = "technician";
    state.currentUserRole = "technician";
  }

  closeRoleDropdownMenu();
  applyRolePermissionsUI(state.currentUserRole, state.currentLinkedTech);

  // Switch to appropriate primary workspace
  if (typeof window.switchTab === "function") {
    if (mode === "admin") {
      window.switchTab("tasks");
    } else {
      window.switchTab("checkin");
    }
  }

  if (typeof window.renderTasksListScoped === "function") window.renderTasksListScoped();
  if (typeof window.renderAssignedTasksBannerScoped === "function") window.renderAssignedTasksBannerScoped();
  renderActiveCheckoutList();
  renderTodayLogs();

  showAppAlert({
    type: "info",
    title: mode === "admin" ? "สลับเป็น: เมนูแอดมิน 👑" : "สลับเป็น: เมนูผู้ปฏิบัติงาน 👤",
    message: mode === "admin"
      ? "แสดงผลเมนูแอดมินเต็มรูปแบบ (จัดการงาน, มอบหมายงาน, ตรวจสอบงาน, จัดการสิทธิ์ทีม)"
      : "แสดงผลเมนูผู้ปฏิบัติงานหน้างาน (เช็กอิน, อัปเดตงาน, ปิดงาน ซ่อนปุ่มแอดมินทั้งหมด)"
  });
}

export function toggleRoleDropdownMenu() {
  const menu = document.getElementById("userRoleDropdownMenu");
  if (!menu) return;
  menu.classList.toggle("hidden");
}

export function closeRoleDropdownMenu() {
  const menu = document.getElementById("userRoleDropdownMenu");
  if (menu) menu.classList.add("hidden");
}

export function handleRoleBadgeClick() {
  toggleRoleDropdownMenu();
}

export function applyRolePermissionsUI(role, techObj) {
  const isAdmin = role === "admin";

  // 1. Header Role Badge
  const badge = document.getElementById("userRoleBadge");
  const icon = document.getElementById("userRoleIcon");
  const text = document.getElementById("userRoleText");
  const adminTeamBtn = document.getElementById("adminManageTeamBtn");
  const assignTaskHeaderBtn = document.getElementById("assignTaskHeaderBtn");

  if (badge && icon && text) {
    if (isAdmin) {
      icon.innerText = "👑";
      const cleanName = techObj?.name ? techObj.name.replace(/K\./g, '').split(' ')[0] : (getLineUserName() || "แอดมิน");
      const shortName = cleanName && cleanName.length > 8 ? cleanName.slice(0, 7) + '…' : cleanName;
      text.innerText = `แอดมิน: ${shortName}`;
      badge.className = "flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl font-bold border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 shadow-2xs transition-all active:scale-95 cursor-pointer whitespace-nowrap flex-shrink-0";
      badge.title = "คุณมีสิทธิ์แอดมิน (แตะเพื่อสลับมุมมองหรือจัดการสิทธิ์)";
    } else {
      icon.innerText = "👤";
      const cleanName = techObj?.name ? techObj.name.replace(/K\./g, '').split(' ')[0] : (getLineUserName() || "ทั่วไป");
      const shortName = cleanName && cleanName.length > 8 ? cleanName.slice(0, 7) + '…' : cleanName;
      text.innerText = `ผู้ปฏิบัติงาน: ${shortName}`;
      badge.className = "flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-xl font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-2xs transition-all active:scale-95 cursor-pointer whitespace-nowrap flex-shrink-0";
      badge.title = "เข้าสู่ระบบในฐานะผู้ปฏิบัติงาน (แตะเพื่อปลดล็อกแอดมินหรือสลับมุมมอง)";
    }
  }

  // 2. Dropdown checks
  const checkAdmin = document.getElementById("roleCheckAdmin");
  const checkTech = document.getElementById("roleCheckTech");
  if (checkAdmin) {
    if (isAdmin) checkAdmin.classList.remove("hidden");
    else checkAdmin.classList.add("hidden");
  }
  if (checkTech) {
    if (!isAdmin) checkTech.classList.remove("hidden");
    else checkTech.classList.add("hidden");
  }

  // 3. Simulated role banner
  const banner = document.getElementById("simulatedRoleBanner");
  if (banner) {
    if (!isAdmin && (isUserAdminActual() || sessionStorage.getItem("fs_admin_override") === "true")) {
      banner.classList.remove("hidden");
      banner.classList.add("flex");
    } else {
      banner.classList.add("hidden");
      banner.classList.remove("flex");
    }
  }

  // 4. Header Actions Visibility
  if (adminTeamBtn) {
    if (isAdmin) {
      adminTeamBtn.classList.remove("hidden");
      adminTeamBtn.classList.add("flex");
    } else {
      adminTeamBtn.classList.add("hidden");
      adminTeamBtn.classList.remove("flex");
    }
  }

  if (assignTaskHeaderBtn) {
    assignTaskHeaderBtn.classList.remove("hidden");
    assignTaskHeaderBtn.classList.add("flex");
  }

  const assignTaskSectionBtn = document.getElementById("assignTaskSectionBtn");
  if (assignTaskSectionBtn) {
    assignTaskSectionBtn.classList.remove("hidden");
  }

  const manageTechSectionBtn = document.getElementById("manageTechSectionBtn");
  if (manageTechSectionBtn) {
    if (isAdmin) {
      manageTechSectionBtn.classList.remove("hidden");
    } else {
      manageTechSectionBtn.classList.add("hidden");
    }
  }

  // 5. Separate Navigation Bars between Admin and Operator
  const adminNav = document.getElementById("adminNavTabs");
  const operatorNav = document.getElementById("operatorNavTabs");
  const adminMobNav = document.getElementById("adminMobileTabs");
  const operatorMobNav = document.getElementById("operatorMobileTabs");

  if (isAdmin) {
    if (adminNav) { adminNav.classList.remove("hidden"); adminNav.classList.add("md:flex"); }
    if (operatorNav) { operatorNav.classList.add("hidden"); operatorNav.classList.remove("md:flex"); }
    if (adminMobNav) { adminMobNav.className = "grid md:hidden grid-cols-3 gap-1 bg-slate-300 p-1 rounded-xl text-xs font-bold text-slate-700 shadow-inner"; }
    if (operatorMobNav) { operatorMobNav.className = "hidden md:hidden"; }
  } else {
    if (adminNav) { adminNav.classList.add("hidden"); adminNav.classList.remove("md:flex"); }
    if (operatorNav) { operatorNav.classList.remove("hidden"); operatorNav.classList.add("md:flex"); }
    if (adminMobNav) { adminMobNav.className = "hidden md:hidden"; }
    if (operatorMobNav) { operatorMobNav.className = "grid md:hidden grid-cols-3 gap-1 bg-slate-300 p-1 rounded-xl text-xs font-bold text-slate-700 shadow-inner"; }
  }

  // 6. Header Subtitle and Role Badge
  const appRoleBadgeTitle = document.getElementById("appRoleBadgeTitle");
  if (appRoleBadgeTitle) {
    appRoleBadgeTitle.innerText = isAdmin ? "ADMIN" : "FIELD 2.0";
    appRoleBadgeTitle.className = isAdmin
      ? "text-[9px] bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap"
      : "text-[9px] bg-slate-900 text-white font-extrabold px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap";
  }
  const appSubtitle = document.getElementById("appHeaderSubtitle");
  if (appSubtitle) {
    appSubtitle.innerText = isAdmin ? "ระบบจัดการ & มอบหมายงาน" : "ระบบบันทึกงาน & เช็กอิน";
  }

  // 7. Task Detail Modal Controls
  const deleteBtn = document.getElementById("detailModalDeleteBtn");
  const saveBtn = document.getElementById("detailModalSaveBtn");
  const notice = document.getElementById("detailModalTechNotice");
  if (deleteBtn) {
    if (isAdmin) deleteBtn.classList.remove("hidden");
    else deleteBtn.classList.add("hidden");
  }
  if (saveBtn) {
    if (isAdmin) saveBtn.classList.remove("hidden");
    else saveBtn.classList.add("hidden");
  }
  if (notice) {
    if (isAdmin) {
      notice.classList.add("hidden");
      notice.classList.remove("flex");
    } else {
      notice.classList.remove("hidden");
      notice.classList.add("flex");
    }
  }

  // 8. Clear all checkins button in Checkout tab
  const clearAllBtn = document.getElementById("clearAllCheckinsBtn");
  if (clearAllBtn) {
    if (isAdmin && state.activeTasks.length > 0) {
      clearAllBtn.classList.remove("hidden");
    } else {
      clearAllBtn.classList.add("hidden");
    }
  }

  // 9. Section Headings for Tasks
  const taskTitle = document.getElementById("tasksSectionTitle");
  const taskDesc = document.getElementById("tasksSectionDesc");
  if (taskTitle) {
    taskTitle.innerText = isAdmin ? "งานมอบหมายและติดตามงาน" : "รายการงานที่ได้รับมอบหมาย";
  }
  if (taskDesc) {
    const opName = (techObj || state.currentLinkedTech)?.name;
    taskDesc.innerText = isAdmin
      ? "จัดการภาระงาน CCTV และมอบหมายผู้ปฏิบัติงานที่รับผิดชอบ"
      : (opName ? `รายการงานที่คุณ (${opName}) ได้รับมอบหมายและต้องอัปเดตความคืบหน้า` : "ตรวจสอบรายละเอียดงานและกำหนดส่งของทีมผู้ปฏิบัติงาน");
  }

  // 10. Dropdown Operator Name & Role Control visibility
  const dropOpName = document.getElementById("dropdownCurrentOperatorName");
  if (dropOpName) {
    dropOpName.innerText = (techObj || state.currentLinkedTech)?.name || "ยังไม่ได้เลือกชื่อ";
  }

  const adminControls = document.getElementById("roleDropdownAdminControls");
  const unlockSection = document.getElementById("roleDropdownUnlockAdminSection");
  const isRealAdmin = isUserAdminActual() || sessionStorage.getItem("fs_admin_override") === "true";
  if (adminControls && unlockSection) {
    if (isRealAdmin) {
      adminControls.classList.remove("hidden");
      unlockSection.classList.add("hidden");
    } else {
      adminControls.classList.add("hidden");
      unlockSection.classList.remove("hidden");
    }
  }

  // 11. Company-wide Technician Filter row visibility (Admin only)
  const techFilterRow = document.getElementById("taskTechFilterRow");
  if (techFilterRow) {
    if (isAdmin) {
      techFilterRow.classList.remove("hidden");
    } else {
      techFilterRow.classList.add("hidden");
    }
  }

  renderTodayLogs();
  renderActiveCheckoutList();
}

export function openAdminPinModal() {
  const el = document.getElementById("adminPinModal");
  const input = document.getElementById("adminPinInput");
  if (input) input.value = "";
  if (el) el.classList.remove("hidden");
  if (input) input.focus();
}

export function closeAdminPinModal() {
  const el = document.getElementById("adminPinModal");
  if (el) el.classList.add("hidden");
}

export function submitAdminPinUnlock() {
  const input = document.getElementById("adminPinInput");
  const pin = input ? input.value.trim() : "";
  if (pin === MASTER_ADMIN_PIN || pin === "8888") {
    sessionStorage.setItem("fs_admin_override", "true");
    state.currentUserRole = "admin";
    closeAdminPinModal();
    applyRolePermissionsUI("admin", { name: "ผู้ดูแลระบบ (Admin)", role: "admin" });
    showAppAlert({
      type: "success",
      title: "ปลดล็อกสิทธิ์แอดมินสำเร็จ",
      message: "ยินดีต้อนรับ เข้าสู่โหมดแอดมินเต็มรูปแบบ สามารถมอบหมายงาน แก้ไข ลบงาน จัดการสิทธิ์ และสลับมุมมองหน้าจอได้ทันทีครับ 👑"
    });
  } else {
    showAppAlert({
      type: "warning",
      title: "รหัส PIN ไม่ถูกต้อง",
      message: "กรุณาระบุรหัส PIN ผู้ดูแลระบบให้ถูกต้อง"
    });
  }
}

export function openTeamRoleModal() {
  if (state.currentUserRole !== "admin" && !isUserAdminActual()) {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงส่วนจัดการทีมงานได้"
    });
    return;
  }
  renderTeamRoleList();
  const el = document.getElementById("teamRoleModal");
  if (el) el.classList.remove("hidden");
}

export function closeTeamRoleModal() {
  const el = document.getElementById("teamRoleModal");
  if (el) el.classList.add("hidden");
}

export function setTeamRoleFilter(filter) {
  currentTeamRoleFilter = filter;
  const tabAdmin = document.getElementById("teamFilterTabAdmin");
  const tabTech = document.getElementById("teamFilterTabTech");
  const tabAll = document.getElementById("teamFilterTabAll");

  if (tabAdmin && tabTech && tabAll) {
    if (filter === "admin") {
      tabAdmin.className = "py-1.5 rounded-lg transition-all bg-amber-400 text-slate-950 shadow-2xs font-extrabold flex items-center justify-center space-x-1 cursor-pointer";
      tabTech.className = "py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-1 cursor-pointer";
      tabAll.className = "py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-1 cursor-pointer";
    } else if (filter === "technician") {
      tabAdmin.className = "py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-1 cursor-pointer";
      tabTech.className = "py-1.5 rounded-lg transition-all bg-white text-slate-900 shadow-2xs font-extrabold flex items-center justify-center space-x-1 cursor-pointer";
      tabAll.className = "py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-1 cursor-pointer";
    } else {
      tabAdmin.className = "py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-1 cursor-pointer";
      tabTech.className = "py-1.5 rounded-lg transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-1 cursor-pointer";
      tabAll.className = "py-1.5 rounded-lg transition-all bg-white text-slate-900 shadow-2xs font-extrabold flex items-center justify-center space-x-1 cursor-pointer";
    }
  }

  renderTeamRoleList();
}

function renderMemberCard(tech, currentLineId) {
  const isAdmin = tech.role === "admin";
  const isLineLinked = !!tech.line_user_id;
  const isLinkedToMe = isLineLinked && currentLineId && tech.line_user_id === currentLineId;

  return `
    <div class="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
      <div class="min-w-0">
        <div class="flex items-center space-x-1.5 flex-wrap">
          <span class="font-bold text-xs text-slate-900 truncate">${tech.name}</span>
          ${isAdmin ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">👑 แอดมิน</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">👤 ผู้ปฏิบัติงาน</span>`}
          ${isLinkedToMe ? `<span class="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">บัญชีของคุณ</span>` : ''}
        </div>
        <div class="text-[11px] text-slate-400 mt-1 flex items-center space-x-2 flex-wrap gap-y-1">
          <span>📞 ${tech.phone || '-'}</span>
          <span>•</span>
          ${isLineLinked ? `
            <span class="text-emerald-600 font-semibold flex items-center space-x-1">
              <span>🟢 เชื่อม LINE แล้ว</span>
              <button type="button" onclick="window.unbindTechLineUser('${tech.id}')" class="text-slate-400 hover:text-rose-600 text-[10px] ml-1 p-0.5 rounded hover:bg-rose-50 cursor-pointer" title="ยกเลิกการผูก LINE">✕ ยกเลิกผูก</button>
            </span>
          ` : `
            <span class="text-slate-400">⚪ ยังไม่ผูก LINE</span>
          `}
        </div>
      </div>

      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <div class="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs">
          <button type="button" onclick="window.handleChangeMemberRole('${tech.id}', 'technician')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${!isAdmin ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-400 hover:text-slate-700'}" title="กำหนดสิทธิ์เป็นผู้ปฏิบัติงาน">
            👤 ผู้ปฏิบัติงาน
          </button>
          <button type="button" onclick="window.handleChangeMemberRole('${tech.id}', 'admin')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${isAdmin ? 'bg-amber-400 text-slate-950 shadow-2xs' : 'text-slate-400 hover:text-amber-700'}" title="กำหนดสิทธิ์เป็นแอดมิน">
            👑 แอดมิน
          </button>
        </div>
        <button type="button" onclick="window.handleDeleteMember('${tech.name}', '${tech.id}')" class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer" title="ลบสมาชิก">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `;
}

export function renderTeamRoleList() {
  const container = document.getElementById("teamRoleListContainer");
  const countEl = document.getElementById("teamRoleCount");
  if (!container) return;

  const adminList = state.techniciansList.filter(t => t.role === "admin");
  const techList = state.techniciansList.filter(t => t.role !== "admin");

  const adminCountEl = document.getElementById("teamFilterAdminCount");
  const techCountEl = document.getElementById("teamFilterTechCount");
  const allCountEl = document.getElementById("teamFilterAllCount");

  if (adminCountEl) adminCountEl.innerText = adminList.length;
  if (techCountEl) techCountEl.innerText = techList.length;
  if (allCountEl) allCountEl.innerText = state.techniciansList.length;
  if (countEl) countEl.innerText = state.techniciansList.length;

  if (state.techniciansList.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-400 text-center py-4">ยังไม่มีรายชื่อสมาชิกในระบบ</div>`;
    return;
  }

  const currentLineId = getLineUserId();

  if (currentTeamRoleFilter === "admin") {
    if (adminList.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">ไม่มีสมาชิกในกลุ่มแอดมิน</div>`;
    } else {
      container.innerHTML = `<div class="space-y-2">${adminList.map(t => renderMemberCard(t, currentLineId)).join("")}</div>`;
    }
  } else if (currentTeamRoleFilter === "technician") {
    if (techList.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">ไม่มีสมาชิกในกลุ่มผู้ปฏิบัติงาน</div>`;
    } else {
      container.innerHTML = `<div class="space-y-2">${techList.map(t => renderMemberCard(t, currentLineId)).join("")}</div>`;
    }
  } else {
    container.innerHTML = `
      <div class="space-y-3">
        <!-- 1. ADMINS GROUP -->
        <div class="space-y-1.5">
          <div class="flex items-center space-x-2 px-1">
            <span class="text-[11px] font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
              <span>👑</span>
              <span>กลุ่มผู้ดูแลระบบ / แอดมิน (${adminList.length} คน)</span>
            </span>
            <div class="h-px bg-amber-200 flex-1"></div>
          </div>
          <div class="space-y-1.5">
            ${adminList.length === 0 ? `<div class="text-xs text-slate-400 p-2 text-center bg-slate-50 rounded-lg">ยังไม่มีผู้ดูแลระบบ</div>` : adminList.map(t => renderMemberCard(t, currentLineId)).join("")}
          </div>
        </div>

        <!-- 2. OPERATORS GROUP -->
        <div class="space-y-1.5 pt-2">
          <div class="flex items-center space-x-2 px-1">
            <span class="text-[11px] font-black text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md flex items-center space-x-1">
              <span>👤</span>
              <span>กลุ่มผู้ปฏิบัติงาน (${techList.length} คน)</span>
            </span>
            <div class="h-px bg-slate-200 flex-1"></div>
          </div>
          <div class="space-y-1.5">
            ${techList.length === 0 ? `<div class="text-xs text-slate-400 p-2 text-center bg-slate-50 rounded-lg">ยังไม่มีผู้ปฏิบัติงาน</div>` : techList.map(t => renderMemberCard(t, currentLineId)).join("")}
          </div>
        </div>
      </div>
    `;
  }
}

export function setNewMemberRole(role) {
  const input = document.getElementById("newMemberRoleSelect");
  const btnTech = document.getElementById("newMemberRoleBtnTech");
  const btnAdmin = document.getElementById("newMemberRoleBtnAdmin");
  if (input) input.value = role;
  if (btnTech && btnAdmin) {
    if (role === "admin") {
      btnAdmin.className = "py-1.5 rounded-lg transition-all bg-amber-400 text-slate-950 shadow-2xs font-bold flex items-center justify-center space-x-1 cursor-pointer";
      btnTech.className = "py-1.5 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1 cursor-pointer";
    } else {
      btnTech.className = "py-1.5 rounded-lg transition-all bg-white text-slate-900 shadow-2xs font-bold flex items-center justify-center space-x-1 cursor-pointer";
      btnAdmin.className = "py-1.5 rounded-lg transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center space-x-1 cursor-pointer";
    }
  }
}

export async function bindCurrentLineUserToTech(techId) {
  const profile = getLineUserProfile();
  if (!profile || !profile.userId) {
    showAppAlert({
      type: "warning",
      title: "ยังไม่ได้เข้าสู่ระบบ LINE",
      message: "กรุณากดเข้าสู่ระบบ LINE ก่อนดำเนินการผูกบัญชีครับ"
    });
    return;
  }
  const res = await bindTechnicianLineUserApi(techId, profile.userId);
  if (res.success) {
    const tech = state.techniciansList.find(t => t.id === techId);
    if (tech) tech.line_user_id = profile.userId;
    showAppAlert({
      type: "success",
      title: "ผูกบัญชี LINE สำเร็จ!",
      message: `เชื่อมต่อบัญชี LINE "${profile.displayName}" เข้ากับ "${tech?.name || ''}" เรียบร้อยแล้ว 🟢`
    });
    if (typeof window.refreshFromSupabase === "function") {
      window.refreshFromSupabase(true);
    }
  } else {
    showAppAlert({
      type: "warning",
      title: "เกิดข้อผิดพลาด",
      message: res.error || "ไม่สามารถผูกบัญชี LINE ได้"
    });
  }
}

export async function unbindTechLineUser(techId) {
  showAppConfirm({
    title: "ยืนยันยกเลิกการผูกบัญชี LINE",
    message: "คุณต้องการยกเลิกการผูกบัญชี LINE ของสมาชิกท่านนี้หรือไม่?",
    confirmText: "ยกเลิกการผูก",
    cancelText: "ปิด",
    isDanger: true,
    onConfirm: async () => {
      const res = await bindTechnicianLineUserApi(techId, null);
      if (res.success) {
        const tech = state.techniciansList.find(t => t.id === techId);
        if (tech) tech.line_user_id = null;
        showAppAlert({
          type: "info",
          title: "ยกเลิกการผูก LINE สำเร็จ",
          message: "ยกเลิกการผูกบัญชีเรียบร้อยแล้ว"
        });
        if (typeof window.refreshFromSupabase === "function") {
          window.refreshFromSupabase(true);
        }
      }
    }
  });
}

export async function handleChangeMemberRole(techId, newRole) {
  const target = state.techniciansList.find(t => t.id === techId);
  if (target && target.role === newRole) return;

  const res = await updateTechnicianRoleApi(techId, newRole);
  if (res.success) {
    if (target) target.role = newRole;
    showAppAlert({
      type: "success",
      title: "อัปเดตสิทธิ์สำเร็จ",
      message: `เปลี่ยนสิทธิ์ของ "${target?.name || ''}" เป็น ${newRole === 'admin' ? 'แอดมิน' : 'ผู้ปฏิบัติงาน'} เรียบร้อยแล้ว`
    });
    renderTeamRoleList();
    resolveUserRole();
  } else {
    showAppAlert({
      type: "warning",
      title: "เกิดข้อผิดพลาด",
      message: res.error || "ไม่สามารถอัปเดตสิทธิ์ได้"
    });
  }
}

export async function submitAddNewMember() {
  const nameInput = document.getElementById("newMemberNameInput");
  const roleSelect = document.getElementById("newMemberRoleSelect");
  const name = nameInput ? nameInput.value.trim() : "";
  const role = roleSelect ? roleSelect.value : "technician";

  if (!name) {
    showAppAlert({
      type: "warning",
      title: "กรุณาระบุชื่อสมาชิก",
      message: "กรุณากรอกชื่อ-สกุล หรือชื่อเล่นของสมาชิกใหม่"
    });
    return;
  }

  const res = await addNewTechnicianWithRoleApi(name, "-", role);
  if (res.success) {
    if (nameInput) nameInput.value = "";
    setNewMemberRole("technician");
    showAppAlert({
      type: "success",
      title: "เพิ่มสมาชิกสำเร็จ",
      message: `บันทึก "${name}" เข้าสู่ระบบเรียบร้อยแล้ว`
    });
    if (typeof window.refreshFromSupabase === "function") {
      window.refreshFromSupabase(true);
    }
  } else {
    showAppAlert({
      type: "warning",
      title: "บันทึกไม่สำเร็จ",
      message: res.error || "ไม่สามารถเพิ่มสมาชิกได้"
    });
  }
}

export async function handleDeleteMember(techName, techId) {
  showAppConfirm({
    title: "ยืนยันการลบสมาชิก",
    message: `คุณต้องการลบ "${techName}" ออกจากระบบหรือไม่?`,
    confirmText: "ลบสมาชิก",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: async () => {
      const res = await deleteTechnicianApi(techName);
      if (res.success) {
        showAppAlert({
          type: "success",
          title: "ลบสมาชิกสำเร็จ",
          message: `ลบ "${techName}" ออกจากระบบเรียบร้อยแล้ว`
        });
        if (typeof window.refreshFromSupabase === "function") {
          window.refreshFromSupabase(true);
        }
      } else {
        showAppAlert({
          type: "warning",
          title: "เกิดข้อผิดพลาด",
          message: res.error || "ไม่สามารถลบสมาชิกได้"
        });
      }
    }
  });
}

// -------------------------------------------------------------
// CHECK-IN TECH CHIPS & LEGACY TECHNICIAN MODAL
// -------------------------------------------------------------
export function renderCheckinTechChips() {
  const container = document.getElementById("checkinTechChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  if (state.selectedCheckinTechs.length === 0 && state.currentLinkedTech && state.currentLinkedTech.name) {
    state.selectedCheckinTechs = [state.currentLinkedTech.name];
  }

  const sorted = [...state.allTechnicians].sort((a, b) => {
    const aSel = state.selectedCheckinTechs.includes(a);
    const bSel = state.selectedCheckinTechs.includes(b);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return a.localeCompare(b, 'th');
  });

  sorted.forEach(tName => {
    const isSelected = state.selectedCheckinTechs.includes(tName);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
      isSelected
        ? "bg-slate-900 text-white font-bold shadow-xs ring-1 ring-slate-800"
        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-2xs"
    }`;
    btn.innerHTML = `${isSelected ? '<span>✓</span>' : ''}<span>${tName}</span>`;
    btn.onclick = () => {
      if (state.selectedCheckinTechs.includes(tName)) {
        state.selectedCheckinTechs = state.selectedCheckinTechs.filter(t => t !== tName);
      } else {
        state.selectedCheckinTechs.push(tName);
      }
      renderCheckinTechChips();
    };
    container.appendChild(btn);
  });
}

export function setCheckinTechs(techs) {
  state.selectedCheckinTechs = [...techs];
  renderCheckinTechChips();
}

export function openManageTechModal() {
  if (state.currentUserRole !== "admin" && !isUserAdminActual()) {
    showAppAlert({
      type: "warning",
      title: "สงวนสิทธิ์เฉพาะแอดมิน (Admin Only)",
      message: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์จัดการทีมงานครับ"
    });
    return;
  }
  openTeamRoleModal();
}

export function closeManageTechModal() {
  const modal = document.getElementById("manageTechModal");
  if (modal) modal.classList.add("hidden");
}

export function renderManageTechList() {
  const container = document.getElementById("manageTechListContainer");
  const countLabel = document.getElementById("techCountLabel");
  if (countLabel) countLabel.innerText = `${state.allTechnicians.length} คน`;
  if (!container) return;
  container.innerHTML = "";

  state.allTechnicians.forEach((name, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs";
    row.innerHTML = `
      <div class="flex items-center space-x-2.5">
        <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">${idx + 1}</span>
        <span class="font-bold text-slate-800">${name}</span>
      </div>
      <button type="button" onclick="window.deleteTech('${name}')" title="ลบรายชื่อผู้ปฏิบัติงานนี้" class="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1 text-[11px] font-semibold border border-rose-200 active:scale-95 cursor-pointer">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        <span>ลบ</span>
      </button>
    `;
    container.appendChild(row);
  });
}

export async function confirmAddTech() {
  const input = document.getElementById("newTechNameInput");
  const name = input ? input.value.trim() : "";
  if (!name) return;
  if (state.allTechnicians.includes(name)) {
    showAppAlert({
      type: "warning",
      title: "มีชื่อนี้แล้ว",
      message: `มีชื่อ "${name}" อยู่ในระบบแล้ว`
    });
    return;
  }
  state.allTechnicians.push(name);
  try {
    localStorage.setItem("fs_technicians", JSON.stringify(state.allTechnicians));
  } catch (e) {}

  if (input) input.value = "";
  renderManageTechList();
  renderCheckinTechChips();
  renderTechFilterChips(state.tasksList, state.allTechnicians);
  renderAssignTechChips(state.allTechnicians);

  addNewTechnicianApi(name);

  showAppAlert({
    type: "success",
    title: "เพิ่มผู้ปฏิบัติงานสำเร็จ",
    message: `เพิ่ม "${name}" เข้าสู่ระบบทีมผู้ปฏิบัติงานเรียบร้อยแล้ว`
  });
}

export async function deleteTech(name) {
  if (state.allTechnicians.length <= 1) {
    showAppAlert({
      type: "warning",
      title: "ไม่สามารถลบได้",
      message: "ต้องมีรายชื่อผู้ปฏิบัติงานอย่างน้อย 1 คนในระบบ"
    });
    return;
  }

  showAppConfirm({
    title: "ยืนยันการลบรายชื่อผู้ปฏิบัติงาน",
    message: `คุณต้องการลบ "${name}" ออกจากระบบทีมผู้ปฏิบัติงานหรือไม่?`,
    confirmText: "ลบผู้ปฏิบัติงานคนนี้",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: () => {
      state.allTechnicians = state.allTechnicians.filter(t => t !== name);
      state.selectedCheckinTechs = state.selectedCheckinTechs.filter(t => t !== name);
      try {
        localStorage.setItem("fs_technicians", JSON.stringify(state.allTechnicians));
      } catch(e) {}

      renderManageTechList();
      renderCheckinTechChips();
      renderTechFilterChips(state.tasksList, state.allTechnicians);
      renderAssignTechChips(state.allTechnicians);
      if (typeof window.renderTasksListScoped === "function") {
        window.renderTasksListScoped();
      }

      deleteTechnicianApi(name);

      showAppAlert({
        type: "success",
        title: "ลบสำเร็จ",
        message: `ลบ "${name}" ออกจากระบบเรียบร้อยแล้ว`
      });
    }
  });
}
