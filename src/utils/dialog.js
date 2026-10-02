/**
 * In-App Dialog & Confirmation Modal
 * Replaces native browser alert() and confirm() with styled Tailwind modals
 */

let pendingConfirmResolve = null;

export function showAppAlert({ title = "แจ้งเตือน", message = "", type = "info", onOk = null }) {
  const modal = document.getElementById("appDialogModal");
  const iconContainer = document.getElementById("appDialogIconContainer");
  const titleEl = document.getElementById("appDialogTitle");
  const messageEl = document.getElementById("appDialogMessage");
  const buttonsContainer = document.getElementById("appDialogButtonsContainer");

  if (!modal || !titleEl || !messageEl || !buttonsContainer) {
    window.alert(message || title);
    if (onOk) onOk();
    return;
  }

  // Icons & Colors
  const typeMap = {
    info: { icon: "ℹ️", bg: "bg-blue-50 text-blue-600 border border-blue-200" },
    success: { icon: "✅", bg: "bg-emerald-50 text-emerald-600 border border-emerald-200" },
    warning: { icon: "⚠️", bg: "bg-amber-50 text-amber-600 border border-amber-200" },
    error: { icon: "❌", bg: "bg-rose-50 text-rose-600 border border-rose-200" }
  };

  const currentType = typeMap[type] || typeMap.info;
  if (iconContainer) {
    iconContainer.className = `w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-2xs ${currentType.bg}`;
    iconContainer.innerText = currentType.icon;
  }

  titleEl.innerText = title;
  messageEl.innerText = message;

  buttonsContainer.innerHTML = `
    <button type="button" id="appDialogOkBtn" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-2xs active:scale-95">
      ตกลง
    </button>
  `;

  const okBtn = document.getElementById("appDialogOkBtn");
  if (okBtn) {
    okBtn.onclick = () => {
      closeAppDialog();
      if (onOk) onOk();
    };
  }

  modal.classList.remove("hidden");
}

export function showAppConfirm({
  title = "ยืนยันการทำรายการ",
  message = "",
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  isDanger = false,
  onConfirm = null,
  onCancel = null
}) {
  return new Promise((resolve) => {
    const modal = document.getElementById("appDialogModal");
    const iconContainer = document.getElementById("appDialogIconContainer");
    const titleEl = document.getElementById("appDialogTitle");
    const messageEl = document.getElementById("appDialogMessage");
    const buttonsContainer = document.getElementById("appDialogButtonsContainer");

    if (!modal || !titleEl || !messageEl || !buttonsContainer) {
      const res = window.confirm(message || title);
      if (res && onConfirm) onConfirm();
      if (!res && onCancel) onCancel();
      resolve(res);
      return;
    }

    if (iconContainer) {
      if (isDanger) {
        iconContainer.className = "w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-2xs bg-rose-50 text-rose-600 border border-rose-200";
        iconContainer.innerText = "🗑️";
      } else {
        iconContainer.className = "w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-2xs bg-amber-50 text-amber-600 border border-amber-200";
        iconContainer.innerText = "❓";
      }
    }

    titleEl.innerText = title;
    messageEl.innerText = message;

    const confirmBtnClass = isDanger
      ? "bg-rose-600 hover:bg-rose-700 text-white font-bold"
      : "bg-blue-600 hover:bg-blue-700 text-white font-bold";

    buttonsContainer.innerHTML = `
      <button type="button" id="appDialogCancelBtn" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors">
        ${cancelText}
      </button>
      <button type="button" id="appDialogConfirmBtn" class="flex-1 ${confirmBtnClass} py-2.5 px-4 rounded-xl text-xs transition-all shadow-2xs active:scale-95">
        ${confirmText}
      </button>
    `;

    const cancelBtn = document.getElementById("appDialogCancelBtn");
    const confirmBtn = document.getElementById("appDialogConfirmBtn");

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        closeAppDialog();
        if (onCancel) onCancel();
        resolve(false);
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        closeAppDialog();
        if (onConfirm) onConfirm();
        resolve(true);
      };
    }

    modal.classList.remove("hidden");
  });
}

export function closeAppDialog() {
  const modal = document.getElementById("appDialogModal");
  if (modal) modal.classList.add("hidden");
}

// Global window exposure
if (typeof window !== "undefined") {
  window.showAppAlert = showAppAlert;
  window.showAppConfirm = showAppConfirm;
  window.closeAppDialog = closeAppDialog;
}
