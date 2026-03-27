import { getObjectiveControlSnapshot } from "../engine/objectives.js";
import { pathLength, pathTravelCost } from "../engine/geometry.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function createSvgElement(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function boardToSvgClass(playerId) {
  return playerId === "playerA" ? "playerA" : "playerB";
}

function addGrid(svg, width, height) {
  for (let x = 0; x <= width; x += 1) {
    svg.appendChild(createSvgElement("line", { x1: x, y1: 0, x2: x, y2: height, class: x === width / 2 ? "board-centerline" : "board-grid-line" }));
  }
  for (let y = 0; y <= height; y += 1) {
    svg.appendChild(createSvgElement("line", { x1: 0, y1: y, x2: width, y2: y, class: y === height / 2 ? "board-centerline" : "board-grid-line" }));
  }
}

function addZones(svg, state) {
  const depth = state.deployment.zoneOfInfluenceDepth;
  const left = createSvgElement("rect", { x: 0, y: 0, width: depth, height: state.board.heightInches, class: "edge-zone playerA" });
  const right = createSvgElement("rect", { x: state.board.widthInches - depth, y: 0, width: depth, height: state.board.heightInches, class: "edge-zone playerB" });
  svg.append(left, right);
}

function addTerrain(svg, terrain) {
  for (const piece of terrain) {
    svg.appendChild(createSvgElement("rect", {
      x: piece.rect.minX,
      y: piece.rect.minY,
      width: piece.rect.maxX - piece.rect.minX,
      height: piece.rect.maxY - piece.rect.minY,
      class: piece.impassable ? "terrain-block" : "terrain-cover"
    }));
  }
}

function addObjectives(svg, objectives, controlSnapshot) {
  for (const objective of objectives) {
    const result = controlSnapshot[objective.id];
    let ringClass = "objective-ring neutral";
    if (result?.contested) ringClass = "objective-ring contested";
    if (result?.controller === "playerA") ringClass = "objective-ring playerA";
    if (result?.controller === "playerB") ringClass = "objective-ring playerB";
    svg.appendChild(createSvgElement("circle", { cx: objective.x, cy: objective.y, r: 0.75, class: "objective-marker" }));
    svg.appendChild(createSvgElement("circle", { cx: objective.x, cy: objective.y, r: 2, class: ringClass }));
  }
}

function addPathPreview(svg, preview) {
  if (!preview?.path || preview.path.length < 2) return;
  const d = preview.path.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  svg.appendChild(createSvgElement("path", { d, class: "path-preview" }));

  const totalDistance = pathLength(preview.path);
  if (totalDistance <= 0.01) return;
  const movementCost = preview.state?.board?.terrain ? pathTravelCost(preview.path, preview.state.board.terrain) : totalDistance;
  const start = preview.path[0];
  const end = preview.path[preview.path.length - 1];
  const labelX = (start.x + end.x) / 2;
  const labelY = (start.y + end.y) / 2 - 0.45;

  const label = createSvgElement("text", { x: labelX, y: labelY, class: "path-preview-label" });
  label.textContent = movementCost - totalDistance > 0.05
    ? `${totalDistance.toFixed(1)}" (cost ${movementCost.toFixed(1)}")`
    : `${totalDistance.toFixed(1)}"`;
  svg.appendChild(label);
}

function addSelection(svg, state, uiState) {
  if (!uiState.selectedUnitId) return;
  const unit = state.units[uiState.selectedUnitId];
  if (!unit || unit.status.location !== "battlefield") return;
  const leader = unit.models[unit.leadingModelId];
  if (!leader || leader.x == null || leader.y == null) return;
  svg.appendChild(createSvgElement("circle", {
    cx: leader.x,
    cy: leader.y,
    r: unit.base.radiusInches + 0.35,
    class: "selection-ring"
  }));
}

function addPreviewUnit(svg, state, uiState) {
  if (!uiState.previewUnit) return;
  const unit = state.units[uiState.previewUnit.unitId];
  if (!unit) return;
  const { leader, placements } = uiState.previewUnit;
  const leaderCircle = createSvgElement("circle", {
    cx: leader.x,
    cy: leader.y,
    r: unit.base.radiusInches,
    class: "deploy-preview"
  });
  svg.appendChild(leaderCircle);
  for (const placement of placements) {
    svg.appendChild(createSvgElement("circle", {
      cx: placement.x,
      cy: placement.y,
      r: unit.base.radiusInches,
      class: "deploy-preview"
    }));
  }
}

function addUnits(svg, state, uiState, onModelClick) {
  for (const unit of Object.values(state.units)) {
    if (unit.status.location !== "battlefield") continue;
    for (const modelId of unit.modelIds) {
      const model = unit.models[modelId];
      if (!model.alive || model.x == null || model.y == null) continue;
      if (unit.tags.includes("Ground")) {
        svg.appendChild(createSvgElement("circle", {
          cx: model.x,
          cy: model.y,
          r: unit.base.radiusInches + 1,
          class: "engagement-ring"
        }));
      }
      const circle = createSvgElement("circle", {
        cx: model.x,
        cy: model.y,
        r: unit.base.radiusInches,
        class: `model ${boardToSvgClass(unit.owner)} ${modelId === unit.leadingModelId ? "leader" : ""}`,
        "data-unit-id": unit.id,
        "data-model-id": modelId,
        "data-owner": unit.owner
      });
      circle.addEventListener("click", event => {
        event.stopPropagation();
        onModelClick(unit.id, modelId);
      });
      svg.appendChild(circle);
      const text = createSvgElement("text", { x: model.x, y: model.y, class: "model-text" });
      text.textContent = `${modelId === unit.leadingModelId ? "L" : ""}${unit.currentSupplyValue}`;
      svg.appendChild(text);
    }
  }
}

export function screenToBoardPoint(svg, clientX, clientY) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
  return { x: Math.max(0, Math.min(36, transformed.x)), y: Math.max(0, Math.min(36, transformed.y)) };
}

export function renderLegalOverlay() {}

export function renderUnitGhost() {}

export function renderBoard(state, uiState, handlers) {
  const svg = document.getElementById("battlefield");
  svg.innerHTML = "";
  const controlSnapshot = getObjectiveControlSnapshot(state);
  addZones(svg, state);
  addGrid(svg, state.board.widthInches, state.board.heightInches);
  addTerrain(svg, state.board.terrain);
  addObjectives(svg, state.deployment.missionMarkers, controlSnapshot);
  addPathPreview(svg, uiState.previewPath);
  addSelection(svg, state, uiState);
  addPreviewUnit(svg, state, uiState);
  addUnits(svg, state, uiState, handlers.onModelClick);

  svg.onclick = event => {
    const point = screenToBoardPoint(svg, event.clientX, event.clientY);
    handlers.onBoardClick(point);
  };
}
