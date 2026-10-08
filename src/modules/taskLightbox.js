/**
 * Image Lightbox & Pan/Zoom Module
 * Handles full-screen image inspection with mouse and touch gestures (pinch, drag, zoom).
 */

import { state } from './state.js';
import { showAppAlert, showAppConfirm } from '../utils/dialog.js';
import { deletePhotoFromSupabaseApi } from '../api/supabase.js';

let currentZoom = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let initialPinchDistance = 0;
let initialPinchZoom = 1;
let lastTapTime = 0;
let isLightboxGesturesInit = false;
let currentLightboxSrc = null;
let currentLightboxTaskId = null;
let onDeletePhotoCallback = null;

let mouseDownX = 0;
let mouseDownY = 0;
let mouseDownTime = 0;

export function setOnDeletePhotoCallback(fn) {
  onDeletePhotoCallback = fn;
}

export function clampPan(x, y, zoom) {
  if (zoom <= 1) return { x: 0, y: 0 };
  const viewport = document.getElementById("lightboxViewport");
  const img = document.getElementById("lightboxImg");
  if (!viewport || !img) return { x: 0, y: 0 };

  const vpW = viewport.clientWidth || window.innerWidth;
  const vpH = viewport.clientHeight || (window.innerHeight * 0.75);
  const renderedW = (img.offsetWidth || (vpW * 0.8)) * zoom;
  const renderedH = (img.offsetHeight || (vpH * 0.8)) * zoom;

  // Allow generous margin so user can pan comfortably beyond image borders
  const marginX = Math.max(160, vpW * 0.4);
  const marginY = Math.max(160, vpH * 0.4);

  const maxPanX = Math.max(marginX, (renderedW - vpW) / 2 + marginX);
  const maxPanY = Math.max(marginY, (renderedH - vpH) / 2 + marginY);

  return {
    x: Math.max(-maxPanX, Math.min(maxPanX, x)),
    y: Math.max(-maxPanY, Math.min(maxPanY, y))
  };
}

export function updateLightboxTransform(animate = true) {
  const img = document.getElementById("lightboxImg");
  const percentElem = document.getElementById("lightboxZoomPercent");
  const viewport = document.getElementById("lightboxViewport");
  if (!img) return;

  if (animate) {
    img.style.transition = "transform 0.18s cubic-bezier(0.2, 0, 0.2, 1)";
  } else {
    img.style.transition = "none";
  }

  img.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  if (percentElem) {
    percentElem.innerText = `${Math.round(currentZoom * 100)}%`;
  }
  if (viewport) {
    viewport.style.cursor = currentZoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in";
  }
}

export function zoomLightbox(delta) {
  const newZoom = Math.min(5, Math.max(1, currentZoom + delta));
  currentZoom = Math.round(newZoom * 10) / 10;
  if (currentZoom <= 1) {
    panX = 0;
    panY = 0;
  } else {
    const clamped = clampPan(panX, panY, currentZoom);
    panX = clamped.x;
    panY = clamped.y;
  }
  updateLightboxTransform(true);
}

export function resetLightboxZoom() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateLightboxTransform(true);
}

export function initLightboxGestures() {
  if (isLightboxGesturesInit) return;
  const viewport = document.getElementById("lightboxViewport");
  const img = document.getElementById("lightboxImg");
  if (!viewport || !img) return;
  isLightboxGesturesInit = true;

  // Mouse wheel zoom
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    zoomLightbox(delta);
  }, { passive: false });

  // Mouse Drag / Pan / Click Zoom
  viewport.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    mouseDownTime = Date.now();
    startDragX = e.clientX - panX;
    startDragY = e.clientY - panY;
    viewport.style.cursor = currentZoom > 1 ? "grabbing" : "zoom-in";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    if (currentZoom > 1) {
      const clamped = clampPan(e.clientX - startDragX, e.clientY - startDragY, currentZoom);
      panX = clamped.x;
      panY = clamped.y;
      updateLightboxTransform(false);
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const moveDist = Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY);
    const duration = Date.now() - mouseDownTime;

    // Single click (not dragging): toggle zoom smoothly
    if (moveDist < 6 && duration < 350) {
      if (currentZoom <= 1.05) {
        currentZoom = 2.2;
        const vpRect = viewport.getBoundingClientRect();
        const clickOffsetX = (vpRect.left + vpRect.width / 2) - e.clientX;
        const clickOffsetY = (vpRect.top + vpRect.height / 2) - e.clientY;
        const clamped = clampPan(clickOffsetX * 1.2, clickOffsetY * 1.2, currentZoom);
        panX = clamped.x;
        panY = clamped.y;
        updateLightboxTransform(true);
      } else {
        resetLightboxZoom();
      }
    } else {
      updateLightboxTransform(false);
    }
    viewport.style.cursor = currentZoom > 1 ? "grab" : "zoom-in";
  });

  // Touch: Pinch to zoom & Pan
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistance = Math.hypot(dx, dy);
      initialPinchZoom = currentZoom;
    } else if (e.touches.length === 1 && currentZoom > 1) {
      isDragging = true;
      startDragX = e.touches[0].clientX - panX;
      startDragY = e.touches[0].clientY - panY;
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && initialPinchDistance > 0) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / initialPinchDistance;
      const newZ = Math.min(5, Math.max(1, Math.round(initialPinchZoom * factor * 10) / 10));
      currentZoom = newZ;
      const clamped = clampPan(panX, panY, currentZoom);
      panX = clamped.x;
      panY = clamped.y;
      updateLightboxTransform(false);
    } else if (e.touches.length === 1 && isDragging && currentZoom > 1) {
      e.preventDefault();
      const clamped = clampPan(e.touches[0].clientX - startDragX, e.touches[0].clientY - startDragY, currentZoom);
      panX = clamped.x;
      panY = clamped.y;
      updateLightboxTransform(false);
    }
  }, { passive: false });

  viewport.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = 0;
    }
    if (e.touches.length === 0) {
      isDragging = false;
      const now = Date.now();
      if (now - lastTapTime < 300) {
        if (currentZoom > 1.2) {
          resetLightboxZoom();
        } else {
          currentZoom = 2.2;
          panX = 0;
          panY = 0;
          updateLightboxTransform(true);
        }
        lastTapTime = 0;
      } else {
        lastTapTime = now;
      }
    }
  }, { passive: true });
}

export function openImageLightbox(src, caption = "", taskId = null) {
  const modal = document.getElementById("imageLightboxModal");
  const img = document.getElementById("lightboxImg");
  const cap = document.getElementById("lightboxCaption");
  const dl = document.getElementById("lightboxDownloadBtn");
  if (!modal || !img) return;

  currentLightboxSrc = src;
  currentLightboxTaskId = taskId;

  initLightboxGestures();
  resetLightboxZoom();

  img.src = src;
  if (cap) cap.innerText = caption;
  if (dl) dl.href = src;
  modal.classList.remove("hidden");
}

export function closeImageLightbox() {
  const modal = document.getElementById("imageLightboxModal");
  if (modal) modal.classList.add("hidden");
  resetLightboxZoom();
}

export function deleteCurrentLightboxImage() {
  if (!currentLightboxSrc) return;
  if (typeof onDeletePhotoCallback === "function") {
    onDeletePhotoCallback(currentLightboxSrc, currentLightboxTaskId);
  }
}
window.deleteCurrentLightboxImage = deleteCurrentLightboxImage;

export function deletePhotoFromTask(photoSrc, activeTaskId) {
  if (!photoSrc) return;
  showAppConfirm({
    title: "ยืนยันการลบรูปภาพ",
    message: "คุณต้องการลบรูปภาพนี้ออกจากรายการงานหรือไม่?",
    confirmText: "ลบรูปภาพ",
    cancelText: "ยกเลิก",
    isDanger: true,
    onConfirm: async () => {
      closeImageLightbox();

      const activeItem = state.activeTasks.find(a => a.id === activeTaskId || (a.taskId && a.taskId === activeTaskId));
      const targetTaskId = activeItem?.taskId || activeTaskId;
      const linkedTask = state.tasksList.find(t => (targetTaskId && t.id === targetTaskId) || t.id === activeTaskId || (activeItem && t.title === activeItem.task));

      if (activeItem && Array.isArray(activeItem.photos)) {
        activeItem.photos = activeItem.photos.filter(p => {
          const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
          return src !== photoSrc;
        });
        localStorage.setItem("fs_active_tasks", JSON.stringify(state.activeTasks));
      }

      if (linkedTask) {
        if (Array.isArray(linkedTask.progressHistory)) {
          linkedTask.progressHistory.forEach(h => {
            if (Array.isArray(h.photos)) {
              h.photos = h.photos.filter(p => {
                const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
                return src !== photoSrc;
              });
            }
          });
        }
        if (linkedTask.customer && Array.isArray(linkedTask.customer.progress_history)) {
          linkedTask.customer.progress_history.forEach(h => {
            if (Array.isArray(h.photos)) {
              h.photos = h.photos.filter(p => {
                const src = p.dataUrl || p.base64 || p.url || (typeof p === "string" ? p : null);
                return src !== photoSrc;
              });
            }
          });
        }
        localStorage.setItem("fs_tasks", JSON.stringify(state.tasksList));
      }

      if (activeItem && typeof window.renderActiveTaskPhotos === "function") {
        window.renderActiveTaskPhotos(activeItem);
      }
      if (typeof window.renderActiveCheckoutList === "function") {
        window.renderActiveCheckoutList();
      }
      if (typeof window.renderTasksListScoped === "function") {
        window.renderTasksListScoped();
      }

      deletePhotoFromSupabaseApi(photoSrc, targetTaskId, activeItem?.id);

      showAppAlert({
        type: "success",
        title: "ลบรูปภาพสำเร็จ",
        message: "ลบรูปภาพออกจากระบบเรียบร้อยแล้ว"
      });
    }
  });
}

