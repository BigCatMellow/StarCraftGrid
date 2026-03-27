import {
  getLegalActionsForPlayer,
  getLegalDeployDestinations,
  getLegalMoveDestinations,
  getLegalDisengageDestinations
} from "../engine/legal_actions.js";
import { autoArrangeModels } from "../engine/coherency.js";
import { distance } from "../engine/geometry.js";

function getOpponent(playerId) {
  return playerId === "playerA" ? "playerB" : "playerA";
}

function nearestEnemyPoint(state, playerId) {
  const enemyUnits = Object.values(state.units).filter(
    unit => unit.owner === getOpponent(playerId) && unit.status.location === "battlefield"
  );
  if (!enemyUnits.length) return { x: state.board.widthInches / 2, y: state.board.heightInches / 2 };
  const points = enemyUnits.flatMap(unit =>
    Object.values(unit.models)
      .filter(m => m.alive && m.x != null && m.y != null)
      .map(m => ({ x: m.x, y: m.y }))
  );
  if (!points.length) return { x: state.board.widthInches / 2, y: state.board.heightInches / 2 };
  return points.sort((a, b) => a.x - b.x)[Math.floor(points.length / 2)];
}

function chooseUnitPriority(state, unitIds) {
  return [...unitIds].sort((a, b) => state.units[b].currentSupplyValue - state.units[a].currentSupplyValue);
}

function chooseClosestPoint(points, target) {
  if (!points.length) return null;
  let best = points[0];
  let bestDistance = distance(points[0], target);
  for (const point of points.slice(1)) {
    const d = distance(point, target);
    if (d < bestDistance) {
      best = point;
      bestDistance = d;
    }
  }
  return best;
}

function chooseFarthestPoint(points, target) {
  if (!points.length) return null;
  let best = points[0];
  let bestDistance = distance(points[0], target);
  for (const point of points.slice(1)) {
    const d = distance(point, target);
    if (d > bestDistance) {
      best = point;
      bestDistance = d;
    }
  }
  return best;
}

function tryBuildDeployAction(state, playerId, enemyCenter, unitId) {
  const unit = state.units[unitId];
  const legalPoints = getLegalDeployDestinations(state, playerId, unitId, unit.leadingModelId);
  const chosen = chooseClosestPoint(legalPoints, enemyCenter);
  if (!chosen) return null;
  return {
    type: "DEPLOY_UNIT",
    payload: {
      playerId,
      unitId,
      leadingModelId: unit.leadingModelId,
      entryPoint: chosen.entryPoint,
      path: [chosen.entryPoint, { x: chosen.x, y: chosen.y }],
      modelPlacements: autoArrangeModels(state, unitId, chosen)
    }
  };
}

function tryBuildDisengageAction(state, playerId, enemyCenter, unitId) {
  const unit = state.units[unitId];
  const legalPoints = getLegalDisengageDestinations(state, playerId, unitId, unit.leadingModelId);
  const chosen = chooseFarthestPoint(legalPoints, enemyCenter);
  if (!chosen) return null;
  const leader = unit.models[unit.leadingModelId];
  return {
    type: "DISENGAGE_UNIT",
    payload: {
      playerId,
      unitId,
      leadingModelId: unit.leadingModelId,
      path: [{ x: leader.x, y: leader.y }, { x: chosen.x, y: chosen.y }],
      modelPlacements: autoArrangeModels(state, unit.id, chosen)
    }
  };
}

function tryBuildMoveAction(state, playerId, enemyCenter, unitId) {
  const unit = state.units[unitId];
  const legalPoints = getLegalMoveDestinations(state, playerId, unitId, unit.leadingModelId);
  const chosen = chooseClosestPoint(legalPoints, enemyCenter);
  if (!chosen) return null;
  const leader = unit.models[unit.leadingModelId];
  return {
    type: "MOVE_UNIT",
    payload: {
      playerId,
      unitId,
      leadingModelId: unit.leadingModelId,
      path: [{ x: leader.x, y: leader.y }, { x: chosen.x, y: chosen.y }],
      modelPlacements: autoArrangeModels(state, unit.id, chosen)
    }
  };
}

export function chooseMovementPhaseAction(state, playerId) {
  const actions = getLegalActionsForPlayer(state, playerId);
  const enemyCenter = nearestEnemyPoint(state, playerId);

  const deployUnits = chooseUnitPriority(
    state,
    actions.filter(action => action.type === "DEPLOY_UNIT" && action.enabled).map(action => action.unitId)
  );
  for (const unitId of deployUnits) {
    const deployAction = tryBuildDeployAction(state, playerId, enemyCenter, unitId);
    if (deployAction) return deployAction;
  }

  const battlefieldUnits = Object.values(state.units).filter(
    unit => unit.owner === playerId && unit.status.location === "battlefield" && !unit.status.movementActivated
  );

  const engaged = battlefieldUnits.filter(unit => unit.status.engaged);
  for (const unit of engaged) {
    const disengageAction = tryBuildDisengageAction(state, playerId, enemyCenter, unit.id);
    if (disengageAction) return disengageAction;
  }

  const movers = battlefieldUnits.filter(unit => !unit.status.engaged);
  let orderedMovers = [...movers].sort((a, b) => {
    const aLeader = a.models[a.leadingModelId];
    const bLeader = b.models[b.leadingModelId];
    return distance(aLeader, enemyCenter) - distance(bLeader, enemyCenter);
  });
  for (const unit of orderedMovers) {
    const moveAction = tryBuildMoveAction(state, playerId, enemyCenter, unit.id);
    if (moveAction) return moveAction;
  }

  const holders = battlefieldUnits.filter(unit => !unit.status.engaged);
  if (holders.length) {
    return { type: "HOLD_UNIT", payload: { playerId, unitId: holders[0].id } };
  }

  return { type: "PASS_PHASE", payload: { playerId } };
}

export async function performBotTurn(store, playerId) {
  const action = chooseMovementPhaseAction(store.getState(), playerId);
  return store.dispatch(action);
}
