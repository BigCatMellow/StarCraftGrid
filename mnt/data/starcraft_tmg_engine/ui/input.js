import { autoArrangeModels } from "../engine/coherency.js";

export function bindInputHandlers(store, controller) {
  document.getElementById("newGameBtn").addEventListener("click", controller.onNewGame);
  document.getElementById("passBtn").addEventListener("click", controller.onPass);
}

export function beginMoveInteraction(state, uiState, unitId) {
  const unit = state.units[unitId];
  const leader = unit.models[unit.leadingModelId];
  uiState.mode = "move";
  uiState.previewPath = { path: [{ x: leader.x, y: leader.y }, { x: leader.x, y: leader.y }] };
  uiState.previewUnit = { unitId, leader: { x: leader.x, y: leader.y }, placements: autoArrangeModels(state, unitId, leader) };
}

export function beginDeployInteraction(state, uiState, unitId) {
  uiState.mode = "deploy";
  uiState.previewPath = null;
  uiState.previewUnit = null;
}

export function beginDisengageInteraction(state, uiState, unitId) {
  const unit = state.units[unitId];
  const leader = unit.models[unit.leadingModelId];
  uiState.mode = "disengage";
  uiState.previewPath = { path: [{ x: leader.x, y: leader.y }, { x: leader.x, y: leader.y }] };
  uiState.previewUnit = { unitId, leader: { x: leader.x, y: leader.y }, placements: autoArrangeModels(state, unitId, leader) };
}

export function confirmCurrentInteraction() {}
export function cancelCurrentInteraction(uiState) {
  uiState.mode = null;
  uiState.previewPath = null;
  uiState.previewUnit = null;
}
