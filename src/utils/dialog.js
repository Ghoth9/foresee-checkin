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

export function showSharePromptDialog({
  title = "บันทึกข้อมูลเรียบร้อยแล้ว",
  message = "ต้องการแชร์การ์ดสรุปผลงานเข้ากลุ่ม LINE ทันทีหรือไม่?",
  shareBtnText = "💬 เลือกกลุ่ม LINE และส่งการ์ด",
  skipBtnText = "เสร็จสิ้น / ไว้แชร์ทีหลัง",
  onShare,
  onSkip
}) {
  const modal = document.getElementById("appDialogModal");
  const iconContainer = document.getElementById("appDialogIconContainer");
  const titleEl = document.getElementById("appDialogTitle");
  const messageEl = document.getElementById("appDialogMessage");
  const buttonsContainer = document.getElementById("appDialogButtonsContainer");

  if (!modal || !titleEl || !messageEl || !buttonsContainer) {
    if (onShare) onShare();
    return;
  }

  if (iconContainer) {
    iconContainer.className = "w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-2xs bg-emerald-50 text-emerald-600 border border-emerald-200";
    iconContainer.innerText = "🎉";
  }

  titleEl.innerText = title;
  messageEl.innerText = message;

  buttonsContainer.innerHTML = `
    <div class="flex flex-col space-y-2 w-full">
      <button type="button" id="appDialogShareBtn" class="w-full bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl text-xs md:text-sm transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.92 2 10.76c0 2.92 1.63 5.51 4.16 7.05-.18.66-.66 2.4-0.75 2.76-.12.44.16.44.34.32.24-.16 2.84-1.92 3.99-2.7 0.73.13 1.48.21 2.26.21 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"/></svg>
        <span>${shareBtnText}</span>
      </button>
      <button type="button" id="appDialogSkipBtn" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer">
        ${skipBtnText}
      </button>
    </div>
  `;

  const shareBtn = document.getElementById("appDialogShareBtn");
  const skipBtn = document.getElementById("appDialogSkipBtn");

  if (shareBtn) {
    shareBtn.onclick = () => {
      closeAppDialog();
      if (onShare) onShare();
    };
  }
  if (skipBtn) {
    skipBtn.onclick = () => {
      closeAppDialog();
      if (onSkip) onSkip();
    };
  }

  modal.classList.remove("hidden");
}

// Global window exposure
if (typeof window !== "undefined") {
  window.showAppAlert = showAppAlert;
  window.showAppConfirm = showAppConfirm;
  window.showSharePromptDialog = showSharePromptDialog;
  window.closeAppDialog = closeAppDialog;
}
