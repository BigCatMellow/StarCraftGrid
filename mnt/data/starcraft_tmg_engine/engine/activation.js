import { appendLog } from "./state.js";
import { advanceToNextPhase } from "./phases.js";

export function isUnitEligibleForMovementActivation(state, unitId) {
  const unit = state.units[unitId];
  if (!unit) return false;
  if (state.phase !== "movement") return false;
  if (unit.owner !== state.activePlayer) return false;
  if (unit.status.movementActivated) return false;
  if (state.players[unit.owner].hasPassedThisPhase) return false;
  return unit.status.location === "battlefield" || unit.status.location === "reserves";
}

export function getEligibleMovementUnits(state, playerId) {
  return Object.values(state.units).filter(unit => unit.owner === playerId && !unit.status.movementActivated && !state.players[playerId].hasPassedThisPhase);
}

export function markUnitActivatedForMovement(state, unitId) {
  const unit = state.units[unitId];
  unit.status.movementActivated = true;
  unit.activationMarkers = unit.activationMarkers.filter(marker => marker.phase !== "movement");
  unit.activationMarkers.push({ phase: "movement", state: "activated" });
}

export function clearMovementActivationFlagsForNewRound(state) {
  for (const unit of Object.values(state.units)) {
    unit.status.movementActivated = false;
    unit.activationMarkers = unit.activationMarkers.filter(marker => marker.phase !== "movement");
  }
}

export function canPlayerPass(state, playerId) {
  return state.phase === "movement" && state.activePlayer === playerId && !state.players[playerId].hasPassedThisPhase;
}

function getOpponent(playerId) {
  return playerId === "playerA" ? "playerB" : "playerA";
}

export function endActivationAndPassTurn(state) {
  const opponent = getOpponent(state.activePlayer);
  if (!state.players[opponent].hasPassedThisPhase) {
    state.activePlayer = opponent;
  }
}

export function passPhase(state, playerId) {
  if (!canPlayerPass(state, playerId)) {
    return { ok: false, code: "INVALID_PASS", message: "That player cannot pass right now." };
  }

  const player = state.players[playerId];
  player.hasPassedThisPhase = true;

  if (state.firstPlayerMarkerHolder !== playerId && !state.players[getOpponent(playerId)].hasPassedThisPhase) {
    state.firstPlayerMarkerHolder = playerId;
    appendLog(state, "info", `${playerId === "playerA" ? "Blue" : "Red"} player passes first and claims the First Player Marker for the next phase.`);
  } else {
    appendLog(state, "info", `${playerId === "playerA" ? "Blue" : "Red"} player passes.`);
  }

  for (const unitId of player.battlefieldUnitIds) {
    if (!state.units[unitId].status.movementActivated) markUnitActivatedForMovement(state, unitId);
  }

  const opponentId = getOpponent(playerId);
  if (state.players[opponentId].hasPassedThisPhase) {
    return advanceToNextPhase(state);
  }

  state.activePlayer = opponentId;
  return { ok: true, state, events: [{ type: "player_passed", payload: { playerId } }] };
}
