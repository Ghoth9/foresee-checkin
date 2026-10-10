/**
 * Operator Selection Modal Module (เลือกตัวตนผู้ปฏิบัติงาน)
 * Strictly allows selecting non-admin field operators for personalized views.
 */

import { state } from './state.js';
import { showAppAlert } from '../utils/dialog.js';

let selectOperatorSearchQuery = "";

export function openSelectOperatorModal() {
  const el = document.getElementById("selectOperatorModal");
  if (!el) return;
  selectOperatorSearchQuery = "";
  const input = document.getElementById("selectOperatorSearchInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("selectOperatorSearchClearBtn");
  if (clearBtn) clearBtn.classList.add("hidden");
  renderSelectOperatorList();
  el.classList.remove("hidden");
}

export function closeSelectOperatorModal() {
  const el = document.getElementById("selectOperatorModal");
  if (el) el.classList.add("hidden");
}

export function filterSelectOperatorList(query) {
  selectOperatorSearchQuery = (query || "").trim().toLowerCase();
  const clearBtn = document.getElementById("selectOperatorSearchClearBtn");
  if (clearBtn) {
    if (selectOperatorSearchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }
  renderSelectOperatorList();
}

export function clearSelectOperatorSearch() {
  const input = document.getElementById("selectOperatorSearchInput");
  if (input) input.value = "";
  filterSelectOperatorList("");
}

export function renderSelectOperatorList() {
  const listEl = document.getElementById("selectOperatorListContainer");
  if (!listEl) return;

  // STRICT SECURITY: Only display field operators (non-admin)! Admins must NEVER be in this public list!
  let list = (state.techniciansList || []).filter(t => t.role !== "admin");
  if (selectOperatorSearchQuery) {
    list = list.filter(t => t.name && t.name.toLowerCase().includes(selectOperatorSearchQuery));
  }

  if (list.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-6 text-xs text-slate-400">
        ไม่พบรายชื่อผู้ปฏิบัติงานที่ตรงกับ "${selectOperatorSearchQuery}"
      </div>
    `;
    return;
  }

  const currentName = state.currentLinkedTech?.name;

  listEl.innerHTML = list.map(tech => {
    const isCurrent = currentName === tech.name;
    return `
      <div onclick="window.chooseOperatorProfile('${tech.id}')" class="p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 shadow-2xs hover:scale-[1.01] active:scale-[0.99] ${
        isCurrent 
          ? 'bg-blue-50 border-2 border-blue-600 ring-2 ring-blue-100' 
          : 'bg-white hover:bg-slate-50 border-slate-200'
      }">
        <div class="min-w-0 flex items-center space-x-2">
          <div class="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
            👤
          </div>
          <div class="min-w-0">
            <div class="font-bold text-xs text-slate-900 truncate">${tech.name}</div>
            <div class="text-[10px] text-slate-500">👤 ผู้ปฏิบัติงาน</div>
          </div>
        </div>
        <button type="button" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
          isCurrent 
            ? 'bg-blue-600 text-white shadow-2xs' 
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        }">
          ${isCurrent ? '✓ กำลังใช้งาน' : 'เลือกฉัน'}
        </button>
      </div>
    `;
  }).join("");
}

export async function chooseOperatorProfile(techId) {
  const tech = state.techniciansList.find(t => t.id === techId);
  if (!tech) return;

  // STRICT GUARD: Admin accounts cannot be chosen via operator modal!
  if (tech.role === "admin") {
    showAppAlert({
      type: "warning",
      title: "ไม่อนุญาต",
      message: "บัญชีผู้ดูแลระบบ (Admin) ไม่สามารถเลือกใช้งานผ่านหน้านี้ได้ครับ ต้องเข้าสู่ระบบด้วย LINE หรือยืนยัน PIN ผู้ดูแลระบบเท่านั้น"
    });
    return;
  }

  // Check if current user is an actual Admin
  const isActualAdmin = (typeof window.isUserAdminActual === "function" && window.isUserAdminActual()) ||
    (typeof window.isCurrentUserAdmin === "function" && window.isCurrentUserAdmin()) ||
    (state.currentUserRole === "admin");

  if (isActualAdmin) {
    // 🛡️ ADMIN PREVIEW / SIMULATION MODE (SANDBOX):
    // 1. NEVER bind admin's LINE to this technician in Supabase!
    // 2. NEVER overwrite localStorage admin identity!
    // 3. Store purely as simulated operator in session
    state.simulatedOperator = tech;
    sessionStorage.setItem("fs_simulated_operator_id", tech.id);
    sessionStorage.setItem("fs_simulated_operator_name", tech.name);
    state.simulatedRole = "technician";
    sessionStorage.setItem("fs_simulated_role", "technician");
    state.currentUserRole = "technician";
    state.currentLinkedTech = tech;
    state.selectedCheckinTechs = [tech.name];

    closeSelectOperatorModal();

    if (typeof window.applyRolePermissionsUI === "function") {
      window.applyRolePermissionsUI("technician", tech);
    }
    if (typeof window.updateTeamRoleBanner === "function") {
      window.updateTeamRoleBanner();
    }
    if (typeof window.renderCheckinTechChips === "function") window.renderCheckinTechChips();
    if (typeof window.renderTasksListScoped === "function") window.renderTasksListScoped();
    if (typeof window.renderAssignedTasksBannerScoped === "function") window.renderAssignedTasksBannerScoped();
    if (typeof window.renderActiveCheckoutList === "function") window.renderActiveCheckoutList();
    if (typeof window.renderTodayLogs === "function") window.renderTodayLogs();
    return;
  }

  state.currentLinkedTech = tech;
  localStorage.setItem("fs_current_operator_id", tech.id);
  localStorage.setItem("fs_current_operator_name", tech.name);

  // Auto-select their own name in check-in form
  state.selectedCheckinTechs = [tech.name];

  closeSelectOperatorModal();

  if (typeof window.resolveUserRole === "function") {
    await window.resolveUserRole();
  }

  if (typeof window.renderCheckinTechChips === "function") {
    window.renderCheckinTechChips();
  }
  if (typeof window.renderTasksListScoped === "function") {
    window.renderTasksListScoped();
  }
  if (typeof window.renderAssignedTasksBannerScoped === "function") {
    window.renderAssignedTasksBannerScoped();
  }
  if (typeof window.renderActiveCheckoutList === "function") {
    window.renderActiveCheckoutList();
  }
  if (typeof window.renderTodayLogs === "function") {
    window.renderTodayLogs();
  }

  showAppAlert({
    type: "success",
    title: "บันทึกตัวตนสำเร็จ",
    message: `คุณเข้าใช้งานในฐานะ "${tech.name}" เรียบร้อยแล้ว ระบบจะแสดงเฉพาะงานที่คุณได้รับมอบหมายครับ 👍`
  });
}
