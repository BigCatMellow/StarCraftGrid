import { renderTopPanel, renderReserveTray, renderSelectedUnit, renderActionButtons, renderTacticalCards, renderLog } from "./panels.js";
import { renderBoard } from "./board.js";

export function renderAll(state, uiState, handlers) {
  renderTopPanel(state);
  renderReserveTray(state, uiState, handlers.onUnitSelect);
  renderSelectedUnit(state, uiState);
  renderActionButtons(handlers.buildActionButtons());
  renderTacticalCards(state, handlers.buildCardButtons());
  renderLog(state);
  renderBoard(state, uiState, handlers);
  document.getElementById("modeBanner").textContent = handlers.getModeText();
  document.getElementById("passBtn").disabled = !(state.activePlayer === "playerA" && ["movement", "assault", "combat"].includes(state.phase) && !state.players.playerA.hasPassedThisPhase);
}
