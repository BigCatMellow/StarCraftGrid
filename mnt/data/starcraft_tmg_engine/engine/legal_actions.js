import { getEligibleMovementUnits } from "./activation.js";
import { validateHold, validateMove, validateDisengage } from "./movement.js";
import { validateDeploy } from "./deployment.js";

export function getLegalActionsForPlayer(state, playerId) {
  const units = getEligibleMovementUnits(state, playerId);
  const actions = [];
  if (state.activePlayer === playerId && !state.players[playerId].hasPassedThisPhase) {
    actions.push({ type: "PASS_PHASE", enabled: true });
  }
  for (const unit of units) {
    actions.push(...getLegalActionsForUnit(state, playerId, unit.id));
  }
  return actions;
}

export function getLegalActionsForUnit(state, playerId, unitId) {
  const unit = state.units[unitId];
  if (!unit || unit.owner !== playerId) return [];
  const descriptors = [];
  if (unit.status.location === "reserves") {
    descriptors.push({ type: "DEPLOY_UNIT", unitId, enabled: true, uiHints: { requiresBoardClick: true } });
    return descriptors;
  }
  descriptors.push({ type: "HOLD_UNIT", unitId, enabled: validateHold(state, playerId, unitId).ok });
  descriptors.push({ type: "MOVE_UNIT", unitId, enabled: !unit.status.engaged, uiHints: { requiresBoardClick: true } });
  descriptors.push({ type: "DISENGAGE_UNIT", unitId, enabled: unit.status.engaged, uiHints: { requiresBoardClick: true } });
  return descriptors;
}

export function getLegalMoveDestinations(state, playerId, unitId, leadingModelId) {
  const unit = state.units[unitId];
  const leader = unit.models[leadingModelId];
  const points = [];
  for (let x = 0.5; x < state.board.widthInches; x += 1) {
    for (let y = 0.5; y < state.board.heightInches; y += 1) {
      const path = [{ x: leader.x, y: leader.y }, { x, y }];
      const validation = validateMove(state, playerId, unitId, leadingModelId, path);
      if (validation.ok) points.push({ x, y });
    }
  }
  return points;
}

export function getLegalDeployDestinations(state, playerId, unitId, leadingModelId) {
  const points = [];
  const entrySide = state.deployment.entryEdges[playerId].side;
  const entryX = entrySide === "west" ? 0 : state.board.widthInches;
  for (let x = 0.5; x < state.board.widthInches; x += 1) {
    for (let y = 0.5; y < state.board.heightInches; y += 1) {
      const entryPoint = entrySide === "west" || entrySide === "east" ? { x: entryX, y } : { x, y: entrySide === "north" ? 0 : state.board.heightInches };
      const path = [entryPoint, { x, y }];
      const validation = validateDeploy(state, playerId, unitId, leadingModelId, entryPoint, path);
      if (validation.ok) points.push({ x, y, entryPoint });
    }
  }
  return points;
}

export function getLegalDisengageDestinations(state, playerId, unitId, leadingModelId) {
  const unit = state.units[unitId];
  const leader = unit.models[leadingModelId];
  const points = [];
  for (let x = 0.5; x < state.board.widthInches; x += 1) {
    for (let y = 0.5; y < state.board.heightInches; y += 1) {
      const path = [{ x: leader.x, y: leader.y }, { x, y }];
      const validation = validateDisengage(state, playerId, unitId, leadingModelId, path);
      if (validation.ok) points.push({ x, y });
    }
  }
  return points;
}
