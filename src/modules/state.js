/**
 * Application Shared State Module
 * Central store for tasks, active checkins, logs, technicians, and user roles.
 */

export const state = {
  tasksList: [],
  activeTasks: [],
  dailyLogs: [],
  allTechnicians: [],
  techniciansList: [],
  currentLinkedTech: null,
  currentUserRole: "technician",
  simulatedRole: null,
  selectedCheckinTechs: [],
  selectedActiveCheckoutId: null,
  selectedCheckoutOutcome: "ปฏิบัติงานเรียบร้อย"
};

// Helper accessors
export function getTasksList() {
  return state.tasksList;
}

export function setTasksList(tasks) {
  state.tasksList = Array.isArray(tasks) ? tasks : [];
}

export function getActiveTasks() {
  return state.activeTasks;
}

export function setActiveTasks(actives) {
  state.activeTasks = Array.isArray(actives) ? actives : [];
}

export function getDailyLogs() {
  return state.dailyLogs;
}

export function setDailyLogs(logs) {
  state.dailyLogs = Array.isArray(logs) ? logs : [];
}

export function getAllTechnicians() {
  return state.allTechnicians;
}

export function setAllTechnicians(techs) {
  state.allTechnicians = Array.isArray(techs) ? techs : [];
}

export function getTechniciansList() {
  return state.techniciansList;
}

export function setTechniciansList(list) {
  state.techniciansList = Array.isArray(list) ? list : [];
}

export function getCurrentLinkedTech() {
  return state.currentLinkedTech;
}

export function setCurrentLinkedTech(tech) {
  state.currentLinkedTech = tech;
}

export function getCurrentUserRole() {
  return state.currentUserRole;
}

export function setCurrentUserRole(role) {
  state.currentUserRole = role;
}

export function getSimulatedRole() {
  return state.simulatedRole;
}

export function setSimulatedRole(role) {
  state.simulatedRole = role;
}

export function getSelectedCheckinTechs() {
  return state.selectedCheckinTechs;
}

export function setSelectedCheckinTechs(techs) {
  state.selectedCheckinTechs = Array.isArray(techs) ? techs : [];
}

export function getSelectedActiveCheckoutId() {
  return state.selectedActiveCheckoutId;
}

export function setSelectedActiveCheckoutId(id) {
  state.selectedActiveCheckoutId = id;
}

export function getSelectedCheckoutOutcome() {
  return state.selectedCheckoutOutcome;
}

export function setSelectedCheckoutOutcome(outcome) {
  state.selectedCheckoutOutcome = outcome;
}
