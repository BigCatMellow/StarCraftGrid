import { createInitialGameState } from "../engine/state.js";
import { beginGame } from "../engine/phases.js";
import { dispatch as engineDispatch } from "../engine/reducer.js";
import { bindInputHandlers, beginMoveInteraction, beginDeployInteraction, beginDisengageInteraction, cancelCurrentInteraction } from "./input.js";
import { renderAll } from "./renderer.js";
import { autoArrangeModels } from "../engine/coherency.js";
import { performBotTurn } from "../ai/bot.js";
import { screenToBoardPoint } from "./board.js";

const DEFAULT_SETUP = {
  missionId: "take_and_hold",
  deploymentId: "crossfire",
  firstPlayerMarkerHolder: "playerA",
  armyA: [
    { id: "blue_marines_1", templateId: "marine_squad" },
    { id: "blue_marines_2", templateId: "marine_squad" },
    { id: "blue_dragoon_1", templateId: "dragoon" }
  ],
  armyB: [
    { id: "red_zealots_1", templateId: "zealot_squad" },
    { id: "red_zealots_2", templateId: "zealot_squad" },
    { id: "red_zerglings_1", templateId: "zergling_squad" }
  ]
};

function createStore(initialState) {
  let state = initialState;
  const listeners = [];
  return {
    getState() { return state; },
    dispatch(action) {
      const result = engineDispatch(state, action);
      if (result.ok) {
        state = result.state;
        listeners.forEach(listener => listener(state, result.events ?? []));
      }
      return result;
    },
    replaceState(nextState) {
      state = nextState;
      listeners.forEach(listener => listener(state, []));
    },
    subscribe(listener) {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }
  };
}

const uiState = {
  selectedUnitId: null,
  mode: null,
  previewPath: null,
  previewUnit: null,
  locked: false,
  lastError: null
};

let store;

function buildInitialState() {
  const state = createInitialGameState(DEFAULT_SETUP);
  beginGame(state);
  return state;
}

function selectUnit(unitId) {
  uiState.selectedUnitId = unitId;
  cancelCurrentInteraction(uiState);
  rerender();
}

function getSelectedUnit(state) {
  return uiState.selectedUnitId ? state.units[uiState.selectedUnitId] : null;
}

function getModeText() {
  if (uiState.lastError) return uiState.lastError;
  if (uiState.mode === "deploy") return "Deploy mode: click on the board to choose the leader's final position.";
  if (uiState.mode === "move") return "Move mode: click on the board to choose the leader's destination.";
  if (uiState.mode === "disengage") return "Disengage mode: click on the board to choose the fallback position.";
  return "Select a reserve or battlefield unit, then choose an action.";
}

function rerender() {
  const handlers = {
    onUnitSelect: selectUnit,
    onBoardClick: handleBoardClick,
    onModelClick: (unitId) => selectUnit(unitId),
    buildActionButtons,
    getModeText
  };
  renderAll(store.getState(), uiState, handlers);
}

function showError(message) {
  uiState.lastError = message;
  rerender();
  window.clearTimeout(showError.timer);
  showError.timer = window.setTimeout(() => {
    uiState.lastError = null;
    rerender();
  }, 2600);
}

function actionButton(label, className, onClick, disabled = false) {
  const button = document.createElement("button");
  button.className = `btn ${className}`;
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function buildActionButtons() {
  const state = store.getState();
  const unit = getSelectedUnit(state);
  const buttons = [];

  if (!unit) return buttons;

  buttons.push(actionButton("Cancel", "secondary", () => {
    cancelCurrentInteraction(uiState);
    rerender();
  }, !uiState.mode));

  if (state.activePlayer !== "playerA") return buttons;
  if (unit.owner !== "playerA") return buttons;
  if (unit.status.movementActivated) return buttons;

  if (unit.status.location === "reserves") {
    buttons.unshift(actionButton("Deploy", "primary", () => {
      beginDeployInteraction(state, uiState, unit.id);
      rerender();
    }));
    return buttons;
  }

  buttons.unshift(actionButton("Hold", "secondary", () => {
    const result = store.dispatch({ type: "HOLD_UNIT", payload: { playerId: "playerA", unitId: unit.id } });
    if (!result.ok) showError(result.message);
  }));

  buttons.unshift(actionButton("Move", "primary", () => {
    beginMoveInteraction(state, uiState, unit.id);
    rerender();
  }, unit.status.engaged));

  buttons.unshift(actionButton("Disengage", "warn", () => {
    beginDisengageInteraction(state, uiState, unit.id);
    rerender();
  }, !unit.status.engaged));

  return buttons;
}

function computeDeployEntryPoint(state, point) {
  const side = state.deployment.entryEdges.playerA.side;
  if (side === "west") return { x: 0, y: point.y };
  if (side === "east") return { x: state.board.widthInches, y: point.y };
  if (side === "north") return { x: point.x, y: 0 };
  return { x: point.x, y: state.board.heightInches };
}

function handleBoardClick(point) {
  const state = store.getState();
  const unit = getSelectedUnit(state);
  if (!unit || state.activePlayer !== "playerA") return;

  if (uiState.mode === "deploy") {
    const entryPoint = computeDeployEntryPoint(state, point);
    const path = [entryPoint, point];
    const result = store.dispatch({
      type: "DEPLOY_UNIT",
      payload: {
        playerId: "playerA",
        unitId: unit.id,
        leadingModelId: unit.leadingModelId,
        entryPoint,
        path,
        modelPlacements: autoArrangeModels(state, unit.id, point)
      }
    });
    if (!result.ok) return showError(result.message);
    cancelCurrentInteraction(uiState);
    rerender();
    return;
  }

  if (uiState.mode === "move") {
    const leader = unit.models[unit.leadingModelId];
    const path = [{ x: leader.x, y: leader.y }, point];
    const result = store.dispatch({
      type: "MOVE_UNIT",
      payload: {
        playerId: "playerA",
        unitId: unit.id,
        leadingModelId: unit.leadingModelId,
        path,
        modelPlacements: autoArrangeModels(state, unit.id, point)
      }
    });
    if (!result.ok) return showError(result.message);
    cancelCurrentInteraction(uiState);
    rerender();
    return;
  }

  if (uiState.mode === "disengage") {
    const leader = unit.models[unit.leadingModelId];
    const path = [{ x: leader.x, y: leader.y }, point];
    const result = store.dispatch({
      type: "DISENGAGE_UNIT",
      payload: {
        playerId: "playerA",
        unitId: unit.id,
        leadingModelId: unit.leadingModelId,
        path,
        modelPlacements: autoArrangeModels(state, unit.id, point)
      }
    });
    if (!result.ok) return showError(result.message);
    cancelCurrentInteraction(uiState);
    rerender();
  }
}

async function maybeRunBot() {
  if (uiState.locked) return;
  const state = store.getState();
  if (state.activePlayer !== "playerB" || state.phase !== "movement") return;
  uiState.locked = true;
  rerender();
  await new Promise(resolve => setTimeout(resolve, 420));
  const result = await performBotTurn(store, "playerB");
  if (!result.ok) showError(result.message);
  uiState.locked = false;
  rerender();
  if (store.getState().activePlayer === "playerB" && store.getState().phase === "movement") {
    maybeRunBot();
  }
}

function resetGame() {
  uiState.selectedUnitId = null;
  cancelCurrentInteraction(uiState);
  const nextState = buildInitialState();
  store.replaceState(nextState);
}

function controller() {
  return {
    onNewGame: resetGame,
    onPass: () => {
      const result = store.dispatch({ type: "PASS_PHASE", payload: { playerId: "playerA" } });
      if (!result.ok) showError(result.message);
    }
  };
}


function updatePreviewFromPoint(point) {
  const state = store.getState();
  const unit = getSelectedUnit(state);
  if (!unit) return;
  if (uiState.mode === "deploy") {
    const entryPoint = computeDeployEntryPoint(state, point);
    uiState.previewPath = { path: [entryPoint, point] };
    uiState.previewUnit = { unitId: unit.id, leader: point, placements: autoArrangeModels(state, unit.id, point) };
  }
  if (uiState.mode === "move" || uiState.mode === "disengage") {
    const leader = unit.models[unit.leadingModelId];
    uiState.previewPath = { path: [{ x: leader.x, y: leader.y }, point] };
    uiState.previewUnit = { unitId: unit.id, leader: point, placements: autoArrangeModels(state, unit.id, point) };
  }
}

function wirePreviewEvents() {
  const svg = document.getElementById("battlefield");
  svg.addEventListener("mousemove", event => {
    if (!uiState.mode) return;
    const point = screenToBoardPoint(svg, event.clientX, event.clientY);
    updatePreviewFromPoint(point);
    rerender();
  });
  svg.addEventListener("mouseleave", () => {
    if (!uiState.mode) return;
    uiState.previewPath = null;
    uiState.previewUnit = null;
    rerender();
  });
}

function init() {
  store = createStore(buildInitialState());
  bindInputHandlers(store, controller());
  store.subscribe(() => {
    rerender();
    maybeRunBot();
  });
  rerender();
  wirePreviewEvents();
}

init();
