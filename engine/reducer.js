import { passPhase } from "./activation.js";
import { resolveHold, resolveMove, resolveDisengage } from "./movement.js";
import { resolveDeploy } from "./deployment.js";
import { resolveRun, resolveDeclareRangedAttack, resolveDeclareCharge } from "./assault.js";
import { resolvePlayCard } from "./cards.js";
import { cloneState } from "./state.js";

export function dispatch(state, action) {
  const working = cloneState(state);
  switch (action.type) {
    case "PASS_PHASE":
      return passPhase(working, action.payload.playerId);
    case "HOLD_UNIT":
      return resolveHold(working, action.payload.playerId, action.payload.unitId);
    case "MOVE_UNIT":
      return resolveMove(working, action.payload.playerId, action.payload.unitId, action.payload.leadingModelId, action.payload.path, action.payload.modelPlacements);
    case "DISENGAGE_UNIT":
      return resolveDisengage(working, action.payload.playerId, action.payload.unitId, action.payload.leadingModelId, action.payload.path, action.payload.modelPlacements);
    case "DEPLOY_UNIT":
      return resolveDeploy(working, action.payload.playerId, action.payload.unitId, action.payload.leadingModelId, action.payload.entryPoint, action.payload.path, action.payload.modelPlacements);
    case "RUN_UNIT":
      return resolveRun(working, action.payload.playerId, action.payload.unitId, action.payload.leadingModelId, action.payload.path, action.payload.modelPlacements);
    case "DECLARE_RANGED_ATTACK":
      return resolveDeclareRangedAttack(working, action.payload.playerId, action.payload.unitId, action.payload.targetId ?? null);
    case "DECLARE_CHARGE":
      return resolveDeclareCharge(working, action.payload.playerId, action.payload.unitId, action.payload.targetId ?? null);
    case "PLAY_CARD":
      return resolvePlayCard(working, action.payload.playerId, action.payload.cardInstanceId, action.payload.targetUnitId ?? null);
    default:
      return { ok: false, code: "UNKNOWN_ACTION", message: `Unknown action type: ${action.type}` };
  }
}
