/**
 * Google Apps Script (GAS) API Client
 */

export const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwW3sYzsOBG848qgTl_KCF2IW9CfkPqlyT6Q5Acr8efP_ZmZtsFR5Q_ILSz4Ts25q8Q/exec";

export async function fetchInitialData() {
  try {
    const resp = await fetch(GAS_API_URL, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
    return await resp.json();
  } catch (err) {
    console.warn("fetchInitialData error:", err);
    return null;
  }
}

export async function postToGas(action, payload = {}) {
  try {
    const bodyData = JSON.stringify({
      action,
      ...payload
    });
    const resp = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: bodyData
    });
    return await resp.json();
  } catch (err) {
    console.warn(`postToGas (${action}) error:`, err);
    return { success: false, error: err.toString() };
  }
}

export function saveCheckinApi(data) {
  return postToGas("saveCheckin", data);
}

export function saveCheckoutApi(data) {
  return postToGas("saveCheckout", data);
}

export function saveTaskApi(data) {
  return postToGas("saveTask", data);
}

export function updateTaskProgressApi(data) {
  return postToGas("updateTaskProgress", data);
}

export function extendTaskDeadlineApi(data) {
  return postToGas("extendTaskDeadline", data);
}

export function addNewTechnicianApi(name) {
  return postToGas("addNewTechnician", { name });
}

export function deleteTechnicianApi(name) {
  return postToGas("deleteTechnician", { name });
}

export function deleteCheckinApi(id) {
  return postToGas("deleteCheckin", { id });
}

export function deleteTaskApi(id) {
  return postToGas("deleteTask", { id });
}
