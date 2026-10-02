/**
 * High-accuracy GPS Geolocation utility
 */

let currentLat = null;
let currentLng = null;
let currentAccuracy = null;
let gpsWatchId = null;

export function getCurrentCoords() {
  return {
    lat: currentLat,
    lng: currentLng,
    accuracy: currentAccuracy,
    isReady: currentLat !== null && currentLng !== null
  };
}

export function getMapUrl(lat, lng) {
  if (!lat || !lng) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function requestLocation(onUpdate) {
  if (!navigator.geolocation) {
    if (onUpdate) onUpdate({ error: "อุปกรณ์ไม่รองรับ GPS" });
    return;
  }

  // Phase 1: Fast cache lookup
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentLat = Number(pos.coords.latitude.toFixed(6));
      currentLng = Number(pos.coords.longitude.toFixed(6));
      currentAccuracy = Math.round(pos.coords.accuracy);
      if (onUpdate) onUpdate({ lat: currentLat, lng: currentLng, accuracy: currentAccuracy, isReady: true });
    },
    (err) => {
      console.warn("Fast GPS lookup:", err.message);
    },
    { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 }
  );

  // Phase 2: High precision watch
  if (gpsWatchId !== null) {
    try { navigator.geolocation.clearWatch(gpsWatchId); } catch(e) {}
  }

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      currentLat = Number(pos.coords.latitude.toFixed(6));
      currentLng = Number(pos.coords.longitude.toFixed(6));
      currentAccuracy = Math.round(pos.coords.accuracy);
      if (onUpdate) onUpdate({ lat: currentLat, lng: currentLng, accuracy: currentAccuracy, isReady: true });
    },
    (err) => {
      console.warn("GPS Watch error:", err);
      if (currentLat === null && onUpdate) {
        onUpdate({ error: "กำลังรอสัญญาณ GPS", isReady: false });
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}
