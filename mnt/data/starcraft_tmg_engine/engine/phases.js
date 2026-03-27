import { appendLog } from "./state.js";
import { refreshAllSupply } from "./supply.js";

export function runStartOfRoundHooks() {
  return [];
}

export function beginGame(state) {
  refreshAllSupply(state);
  appendLog(state, "info", "All units begin in reserves. Deploy as supply allows.");
  return { ok: true, state, events: [] };
}

export function beginRound(state) {
  state.phase = "movement";
  state.activePlayer = state.firstPlayerMarkerHolder;
  state.players.playerA.hasPassedThisPhase = false;
  state.players.playerB.hasPassedThisPhase = false;
  for (const unit of Object.values(state.units)) unit.status.movementActivated = false;
  refreshAllSupply(state);
  appendLog(state, "phase", `Round ${state.round} begins. Movement Phase active.`);
  return { ok: true, state, events: runStartOfRoundHooks(state) };
}

export function beginMovementPhase(state) {
  state.phase = "movement";
  state.activePlayer = state.firstPlayerMarkerHolder;
  state.players.playerA.hasPassedThisPhase = false;
  state.players.playerB.hasPassedThisPhase = false;
  refreshAllSupply(state);
  return { ok: true, state, events: [] };
}

export function endMovementPhase(state) {
  appendLog(state, "phase", "Movement Phase complete. Assault, Combat, and Cleanup are placeholders in this build, so the game advances to the next round.");
  if (state.round >= state.mission.roundLimit) {
    appendLog(state, "phase", "Final round reached. Start a new game to continue testing.");
    return { ok: true, state, events: [{ type: "game_final_round_reached", payload: {} }] };
  }
  state.round += 1;
  return beginRound(state);
}

export function advanceToNextPhase(state) {
  if (state.phase === "movement") return endMovementPhase(state);
  return { ok: true, state, events: [] };
}
