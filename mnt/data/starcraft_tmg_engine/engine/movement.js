import { appendLog } from "./state.js";
import { markUnitActivatedForCurrentPhase, markUnitActivatedForMovement, endActivationAndPassTurn, isUnitEligibleForCurrentPhaseActivation } from "./activation.js";
import { pointInBoard, pathLength, pathBlockedForCircle, pathTravelCost, gridDistance, circleOverlapsTerrain, circleOverlapsCircle, distance } from "./geometry.js";
import { autoArrangeModels, applyModelPlacementsAndResolveCoherency } from "./coherency.js";
import { refreshAllSupply } from "./supply.js";
import { getModifiedValue } from "./effects.js";

const ENGAGEMENT_RANGE = 1;

function getEnemyId(playerId) {
  return playerId === "playerA" ? "playerB" : "playerA";
}

function getModel(unit, modelId) {
  if (!unit.models[modelId]) throw new Error(`Unknown model ${modelId} in unit ${unit.id}`);
  return unit.models[modelId];
}

function updateUnitEngagementStatus(state) {
  for (const unit of Object.values(state.units)) {
    unit.status.engaged = false;
  }

  const battlefieldUnits = Object.values(state.units).filter(unit => unit.status.location === "battlefield" && unit.tags.includes("Ground"));
  for (let i = 0; i < battlefieldUnits.length; i += 1) {
    for (let j = i + 1; j < battlefieldUnits.length; j += 1) {
      const a = battlefieldUnits[i];
      const b = battlefieldUnits[j];
      if (a.owner === b.owner) continue;
      let engaged = false;
      for (const aModel of Object.values(a.models)) {
        if (!aModel.alive || aModel.x == null || aModel.y == null) continue;
        for (const bModel of Object.values(b.models)) {
          if (!bModel.alive || bModel.x == null || bModel.y == null) continue;
          const edgeDistance = distance(aModel, bModel) - a.base.radiusInches - b.base.radiusInches;
          if (edgeDistance <= ENGAGEMENT_RANGE + 1e-6) {
            engaged = true;
            break;
          }
        }
        if (engaged) break;
      }
      if (engaged) {
        a.status.engaged = true;
        b.status.engaged = true;
      }
    }
  }
}

function validateShared(state, playerId, unitId) {
  const unit = state.units[unitId];
  if (!unit) return { ok: false, code: "UNKNOWN_UNIT", message: "Unit not found." };
  if (!isUnitEligibleForCurrentPhaseActivation(state, unitId)) return { ok: false, code: "UNIT_NOT_ELIGIBLE", message: "Unit is not eligible to activate." };
  if (unit.owner !== playerId) return { ok: false, code: "WRONG_OWNER", message: "You do not control that unit." };
  return { ok: true, unit };
}

function overlappingModelsAtPoint(state, unit, point, ignoreModelIds = new Set()) {
  for (const otherUnit of Object.values(state.units)) {
    for (const otherModel of Object.values(otherUnit.models)) {
      if (!otherModel.alive || otherModel.x == null || otherModel.y == null || ignoreModelIds.has(otherModel.id)) continue;
      if (circleOverlapsCircle(point, unit.base.radiusInches, { x: otherModel.x, y: otherModel.y }, otherUnit.base.radiusInches)) return otherModel.id;
    }
  }
  return null;
}

function pointWithinEnemyGroundEngagement(state, unit, point) {
  for (const otherUnit of Object.values(state.units)) {
    if (otherUnit.owner === unit.owner || !otherUnit.tags.includes("Ground")) continue;
    for (const otherModel of Object.values(otherUnit.models)) {
      if (!otherModel.alive || otherModel.x == null || otherModel.y == null) continue;
      const edgeDistance = distance(point, otherModel) - unit.base.radiusInches - otherUnit.base.radiusInches;
      if (edgeDistance < ENGAGEMENT_RANGE - 1e-6) return true;
    }
  }
  return false;
}

function getEngagedEnemyUnits(state, unit) {
  const enemies = new Set();
  for (const otherUnit of Object.values(state.units)) {
    if (otherUnit.owner === unit.owner) continue;
    let engaged = false;
    for (const model of Object.values(unit.models)) {
      if (!model.alive || model.x == null || model.y == null) continue;
      for (const otherModel of Object.values(otherUnit.models)) {
        if (!otherModel.alive || otherModel.x == null || otherModel.y == null) continue;
        const edgeDistance = distance(model, otherModel) - unit.base.radiusInches - otherUnit.base.radiusInches;
        if (edgeDistance <= ENGAGEMENT_RANGE + 1e-6) {
          engaged = true;
          break;
        }
      }
      if (engaged) break;
    }
    if (engaged) enemies.add(otherUnit.id);
  }
  return [...enemies].map(id => state.units[id]);
}

function finalPointFromPath(path) {
  return path[path.length - 1];
}

function getMovementCost(state, path) {
  if (state.rules?.gridMode) return gridDistance(path[0], path[path.length - 1]);
  return pathTravelCost(path, state.board.terrain);
}

export function validateHold(state, playerId, unitId) {
  const shared = validateShared(state, playerId, unitId);
  if (!shared.ok) return shared;
  if (shared.unit.status.location !== "battlefield") return { ok: false, code: "NOT_ON_BATTLEFIELD", message: "Only battlefield units can Hold." };
  return { ok: true };
}

export function resolveHold(state, playerId, unitId) {
  const validation = validateHold(state, playerId, unitId);
  if (!validation.ok) return validation;
  const unit = state.units[unitId];
  unit.status.stationary = true;
  markUnitActivatedForCurrentPhase(state, unitId);
  appendLog(state, "action", `${unit.name} holds position.`);
  endActivationAndPassTurn(state);
  return { ok: true, state, events: [{ type: "unit_held", payload: { unitId } }] };
}

export function validateMove(state, playerId, unitId, leadingModelId, path, modelPlacements = null) {
  const shared = validateShared(state, playerId, unitId);
  if (!shared.ok) return shared;
  const unit = shared.unit;
  if (state.phase !== "movement") return { ok: false, code: "WRONG_PHASE", message: "Move is only available in the Movement Phase." };
  if (unit.status.location !== "battlefield") return { ok: false, code: "NOT_ON_BATTLEFIELD", message: "Unit is not on the battlefield." };
  if (unit.status.engaged) return { ok: false, code: "UNIT_ENGAGED", message: "Engaged units cannot make a normal Move." };
  if (!path || path.length < 2) return { ok: false, code: "NO_PATH", message: "Move requires a path." };
  const leader = getModel(unit, leadingModelId);
  if (leader.x == null || leader.y == null) return { ok: false, code: "INVALID_LEADER", message: "Leading model must be on the battlefield." };
  const start = path[0];
  if (Math.abs(start.x - leader.x) > 0.01 || Math.abs(start.y - leader.y) > 0.01) return { ok: false, code: "BAD_PATH_START", message: "Path must begin at the leader's current position." };
  const modifiedSpeed = getModifiedValue(state, {
    timing: "movement_move",
    unitId: unit.id,
    key: "unit.speed",
    baseValue: unit.speed
  }).value;
  const travelCost = getMovementCost(state, path);
  if (travelCost - modifiedSpeed > 1e-6) return { ok: false, code: "TOO_FAR", message: `${unit.name} can only move ${modifiedSpeed}" (difficult terrain costs extra movement).` };
  const ignore = new Set(unit.modelIds);
  if (pathBlockedForCircle(path, unit.base.radiusInches, state, ignore)) return { ok: false, code: "PATH_BLOCKED", message: "Path crosses blocked ground, terrain, or bases." };
  const end = finalPointFromPath(path);
  if (!pointInBoard(end, state.board, unit.base.radiusInches)) return { ok: false, code: "OFF_BOARD", message: "Leading model must end fully on the battlefield." };
  if (circleOverlapsTerrain(end, unit.base.radiusInches, state.board.terrain)) return { ok: false, code: "TERRAIN_OVERLAP", message: "Leading model cannot end overlapping impassable terrain." };
  if (overlappingModelsAtPoint(state, unit, end, ignore)) return { ok: false, code: "BASE_OVERLAP", message: "Leading model would overlap another base." };
  if (pointWithinEnemyGroundEngagement(state, unit, end)) return { ok: false, code: "ENDS_ENGAGED", message: "Normal Move cannot end within 1\" of an enemy ground unit." };
  const placements = modelPlacements ?? autoArrangeModels(state, unitId, end);
  return { ok: true, derived: { placements, end } };
}

export function resolveMove(state, playerId, unitId, leadingModelId, path, modelPlacements = null) {
  const validation = validateMove(state, playerId, unitId, leadingModelId, path, modelPlacements);
  if (!validation.ok) return validation;
  const unit = state.units[unitId];
  unit.leadingModelId = leadingModelId;
  const leader = unit.models[leadingModelId];
  leader.x = validation.derived.end.x;
  leader.y = validation.derived.end.y;
  const coherency = applyModelPlacementsAndResolveCoherency(state, unitId, validation.derived.placements);
  unit.status.stationary = false;
  markUnitActivatedForMovement(state, unitId);
  updateUnitEngagementStatus(state);
  refreshAllSupply(state);
  const removedText = coherency.removedModelIds.length ? ` ${coherency.removedModelIds.length} model(s) could not be set and were removed.` : "";
  const coherencyText = coherency.outOfCoherency ? " Unit is out of coherency." : "";
  appendLog(state, "action", `${unit.name} moves ${pathLength(path).toFixed(1)}".${removedText}${coherencyText}`);
  endActivationAndPassTurn(state);
  return { ok: true, state, events: [{ type: "unit_moved", payload: { unitId } }] };
}

export function validateDisengage(state, playerId, unitId, leadingModelId, path, modelPlacements = null) {
  const shared = validateShared(state, playerId, unitId);
  if (!shared.ok) return shared;
  const unit = shared.unit;
  if (state.phase !== "movement") return { ok: false, code: "WRONG_PHASE", message: "Disengage is only available in the Movement Phase." };
  if (unit.status.location !== "battlefield") return { ok: false, code: "NOT_ON_BATTLEFIELD", message: "Unit is not on the battlefield." };
  if (!unit.status.engaged) return { ok: false, code: "NOT_ENGAGED", message: "Only engaged units can Disengage." };
  if (!path || path.length < 2) return { ok: false, code: "NO_PATH", message: "Disengage requires a path." };
  const leader = getModel(unit, leadingModelId);
  if (leader.x == null || leader.y == null) return { ok: false, code: "INVALID_LEADER", message: "Leading model must be on the battlefield." };
  const modifiedSpeed = getModifiedValue(state, {
    timing: "movement_disengage",
    unitId: unit.id,
    key: "unit.speed",
    baseValue: unit.speed
  }).value;
  const travelCost = getMovementCost(state, path);
  if (travelCost - modifiedSpeed > 1e-6) return { ok: false, code: "TOO_FAR", message: `${unit.name} can only move ${modifiedSpeed}" (difficult terrain costs extra movement).` };
  const ignore = new Set(unit.modelIds);
  if (pathBlockedForCircle(path, unit.base.radiusInches, state, ignore)) return { ok: false, code: "PATH_BLOCKED", message: "Path crosses blocked ground, terrain, or bases." };
  const end = finalPointFromPath(path);
  if (!pointInBoard(end, state.board, unit.base.radiusInches)) return { ok: false, code: "OFF_BOARD", message: "Leading model must end fully on the battlefield." };
  const placements = modelPlacements ?? autoArrangeModels(state, unitId, end);
  const engagedEnemies = getEngagedEnemyUnits(state, unit);
  const enemySupplyTotal = engagedEnemies.reduce((total, enemy) => total + enemy.currentSupplyValue, 0);
  const tacticalMass = unit.currentSupplyValue > enemySupplyTotal;
  return { ok: true, derived: { end, placements, tacticalMass, engagedEnemies } };
}

export function resolveDisengage(state, playerId, unitId, leadingModelId, path, modelPlacements = null) {
  const validation = validateDisengage(state, playerId, unitId, leadingModelId, path, modelPlacements);
  if (!validation.ok) return validation;
  const unit = state.units[unitId];
  unit.leadingModelId = leadingModelId;
  const leader = unit.models[leadingModelId];
  leader.x = validation.derived.end.x;
  leader.y = validation.derived.end.y;
  const coherency = applyModelPlacementsAndResolveCoherency(state, unitId, validation.derived.placements);
  updateUnitEngagementStatus(state);
  const stillEngaged = pointWithinEnemyGroundEngagement(state, unit, { x: leader.x, y: leader.y });
  if (stillEngaged) {
    leader.alive = false;
    leader.x = null;
    leader.y = null;
    appendLog(state, "action", `${unit.name} failed to break clear; the leading model was removed during Disengage.`);
  }

  for (const modelId of unit.modelIds) {
    if (modelId === leadingModelId) continue;
    const model = unit.models[modelId];
    if (!model.alive || model.x == null || model.y == null) continue;
    if (pointWithinEnemyGroundEngagement(state, unit, { x: model.x, y: model.y })) {
      model.alive = false;
      model.x = null;
      model.y = null;
      appendLog(state, "info", `${unit.name} loses a model that could not clear engagement during Disengage.`);
    }
  }

  if (!validation.derived.tacticalMass) {
    unit.status.cannotRangedAttackNextAssault = true;
    unit.status.cannotChargeNextAssault = true;
  } else {
    unit.status.cannotRangedAttackNextAssault = false;
    unit.status.cannotChargeNextAssault = false;
  }

  unit.status.stationary = false;
  markUnitActivatedForMovement(state, unitId);
  updateUnitEngagementStatus(state);
  refreshAllSupply(state);
  appendLog(state, "action", `${unit.name} disengages.${validation.derived.tacticalMass ? " Tactical Mass ignores the next-Assault penalty." : " It cannot Ranged Attack or Charge in the next Assault Phase."}${coherency.outOfCoherency ? " Unit is out of coherency." : ""}`);
  endActivationAndPassTurn(state);
  return { ok: true, state, events: [{ type: "unit_disengaged", payload: { unitId } }] };
}

export function refreshEngagement(state) {
  updateUnitEngagementStatus(state);
}
