import { appendLog } from "./state.js";
import { markUnitActivatedForMovement, endActivationAndPassTurn, isUnitEligibleForMovementActivation } from "./activation.js";
import { moveUnitToBattlefield } from "./reserves.js";
import { pointOnEntryEdge, pointInsideEnemyZoneOfInfluence, pathLength, pathBlockedForCircle, pointInBoard, circleOverlapsTerrain, circleOverlapsCircle } from "./geometry.js";
import { autoArrangeModels, applyModelPlacementsAndResolveCoherency } from "./coherency.js";
import { refreshAllSupply, validateDeploySupply } from "./supply.js";
import { refreshEngagement } from "./movement.js";

function validateShared(state, playerId, unitId) {
  const unit = state.units[unitId];
  if (!unit) return { ok: false, code: "UNKNOWN_UNIT", message: "Unit not found." };
  if (unit.owner !== playerId) return { ok: false, code: "WRONG_OWNER", message: "You do not control that unit." };
  if (!isUnitEligibleForMovementActivation(state, unitId)) return { ok: false, code: "UNIT_NOT_ELIGIBLE", message: "Unit is not eligible to activate." };
  if (unit.status.location !== "reserves") return { ok: false, code: "NOT_IN_RESERVES", message: "Only reserve units can Deploy." };
  return { ok: true, unit };
}

function overlapsAnyModel(state, unit, point, ignoreIds = new Set()) {
  for (const otherUnit of Object.values(state.units)) {
    for (const model of Object.values(otherUnit.models)) {
      if (!model.alive || model.x == null || model.y == null || ignoreIds.has(model.id)) continue;
      if (circleOverlapsCircle(point, unit.base.radiusInches, { x: model.x, y: model.y }, otherUnit.base.radiusInches)) return true;
    }
  }
  return false;
}

export function getLegalEntryEdgeSegments(state, playerId) {
  const side = state.deployment.entryEdges[playerId]?.side;
  const maxX = state.board.widthInches;
  const maxY = state.board.heightInches;
  if (side === "west") return [{ start: { x: 0, y: 0 }, end: { x: 0, y: maxY } }];
  if (side === "east") return [{ start: { x: maxX, y: 0 }, end: { x: maxX, y: maxY } }];
  if (side === "north") return [{ start: { x: 0, y: 0 }, end: { x: maxX, y: 0 } }];
  if (side === "south") return [{ start: { x: 0, y: maxY }, end: { x: maxX, y: maxY } }];
  return [];
}

export function validateDeploy(state, playerId, unitId, leadingModelId, entryPoint, path, modelPlacements = null) {
  const shared = validateShared(state, playerId, unitId);
  if (!shared.ok) return shared;
  const unit = shared.unit;
  const supplyValidation = validateDeploySupply(state, playerId, unitId);
  if (!supplyValidation.ok) return { ok: false, code: "SUPPLY_BLOCKED", message: supplyValidation.reason };
  if (!pointOnEntryEdge(state.deployment, playerId, entryPoint)) return { ok: false, code: "BAD_ENTRY_EDGE", message: "Entry point must be on your entry edge." };
  if (!path || path.length < 2) return { ok: false, code: "NO_PATH", message: "Deploy requires a path." };
  const start = path[0];
  if (Math.abs(start.x - entryPoint.x) > 0.01 || Math.abs(start.y - entryPoint.y) > 0.01) return { ok: false, code: "PATH_ENTRY_MISMATCH", message: "Path must start at the chosen entry point." };
  if (pathLength(path) - unit.speed > 1e-6) return { ok: false, code: "TOO_FAR", message: `${unit.name} can only deploy ${unit.speed}" from the edge.` };
  const side = state.deployment.entryEdges[playerId].side;
  const adjustedStart = { ...entryPoint };
  if (side === "west") adjustedStart.x = unit.base.radiusInches;
  if (side === "east") adjustedStart.x = state.board.widthInches - unit.base.radiusInches;
  if (side === "north") adjustedStart.y = unit.base.radiusInches;
  if (side === "south") adjustedStart.y = state.board.heightInches - unit.base.radiusInches;
  const collisionPath = [adjustedStart, ...path.slice(1)];
  if (pathBlockedForCircle(collisionPath, unit.base.radiusInches, state, new Set(unit.modelIds))) return { ok: false, code: "PATH_BLOCKED", message: "Path crosses blocked ground, terrain, or bases." };
  const end = path[path.length - 1];
  if (!pointInBoard(end, state.board, unit.base.radiusInches)) return { ok: false, code: "OFF_BOARD", message: "Leading model must end fully on the battlefield." };
  if (circleOverlapsTerrain(end, unit.base.radiusInches, state.board.terrain)) return { ok: false, code: "TERRAIN_OVERLAP", message: "Leading model cannot end overlapping impassable terrain." };
  if (overlapsAnyModel(state, unit, end)) return { ok: false, code: "BASE_OVERLAP", message: "Leading model would overlap an existing base." };
  if (pointInsideEnemyZoneOfInfluence(state, playerId, end, unit.base.radiusInches)) return { ok: false, code: "ZONE_OF_INFLUENCE", message: "Deploy cannot end inside the opponent's zone of influence." };
  const placements = modelPlacements ?? autoArrangeModels(state, unitId, end);
  return { ok: true, derived: { end, placements } };
}

export function resolveDeploy(state, playerId, unitId, leadingModelId, entryPoint, path, modelPlacements = null) {
  const validation = validateDeploy(state, playerId, unitId, leadingModelId, entryPoint, path, modelPlacements);
  if (!validation.ok) return validation;
  const unit = state.units[unitId];
  moveUnitToBattlefield(state, unitId);
  unit.leadingModelId = leadingModelId;
  const leader = unit.models[leadingModelId];
  leader.x = validation.derived.end.x;
  leader.y = validation.derived.end.y;
  const coherency = applyModelPlacementsAndResolveCoherency(state, unitId, validation.derived.placements);
  unit.status.stationary = false;
  unit.status.outOfCoherency = coherency.outOfCoherency;
  markUnitActivatedForMovement(state, unitId);
  refreshEngagement(state);
  refreshAllSupply(state);
  appendLog(state, "action", `${unit.name} deploys from reserves.${coherency.outOfCoherency ? " Unit is out of coherency." : ""}`);
  endActivationAndPassTurn(state);
  return { ok: true, state, events: [{ type: "unit_deployed", payload: { unitId } }] };
}
