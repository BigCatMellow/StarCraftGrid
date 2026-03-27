function formatPlayerName(playerId) {
  return playerId === "playerA" ? "Blue" : "Red";
}

function formatSupply(pool) {
  return pool === Infinity ? "∞" : String(pool);
}

function buildUnitCard(unit, selectedUnitId, onClick) {
  const div = document.createElement("div");
  div.className = `unit-card ${selectedUnitId === unit.id ? "selected" : ""}`;
  div.addEventListener("click", () => onClick(unit.id));
  div.innerHTML = `
    <div class="unit-card-row">
      <span class="unit-name">${unit.name}</span>
      <span class="phase-chip">Supply ${unit.currentSupplyValue}</span>
    </div>
    <div class="badge-row">
      <span class="badge ${unit.owner}">${formatPlayerName(unit.owner)}</span>
      <span class="badge">Speed ${unit.speed}</span>
      <span class="badge">Models ${unit.modelIds.filter(id => unit.models[id].alive).length}</span>
      ${unit.status.engaged ? '<span class="badge warn">Engaged</span>' : ''}
      ${unit.status.outOfCoherency ? '<span class="badge warn">Out of Coherency</span>' : ''}
      ${unit.status.movementActivated ? '<span class="badge good">Activated</span>' : ''}
    </div>
  `;
  return div;
}

export function renderTopPanel(state) {
  const battleState = document.getElementById("battleState");
  const playerSupply = `${getPlayerSupply(state, "playerA")} / ${formatSupply(state.players.playerA.supplyPool)}`;
  const enemySupply = `${getPlayerSupply(state, "playerB")} / ${formatSupply(state.players.playerB.supplyPool)}`;
  battleState.innerHTML = `
    <div class="label">Round</div><div class="value">${state.round} / ${state.mission.roundLimit}</div>
    <div class="label">Phase</div><div class="value">${titleCase(state.phase)}</div>
    <div class="label">Active Player</div><div class="value">${formatPlayerName(state.activePlayer)}</div>
    <div class="label">First Player Marker</div><div class="value">${formatPlayerName(state.firstPlayerMarkerHolder)}</div>
    <div class="label">Mission</div><div class="value">${state.mission.name}</div>
    <div class="label">Deployment</div><div class="value">${state.deployment.name}</div>
  `;
  document.getElementById("playerSupplyText").textContent = playerSupply;
  document.getElementById("enemySupplyText").textContent = enemySupply;
  document.getElementById("playerSupplyFill").style.width = `${fillPercent(state, "playerA")}%`;
  document.getElementById("enemySupplyFill").style.width = `${fillPercent(state, "playerB")}%`;
  const turnBanner = document.getElementById("turnBanner");
  turnBanner.textContent = `${formatPlayerName(state.activePlayer)} Player Active`;
  turnBanner.className = `turn-banner ${state.activePlayer}`;
}

function getPlayerSupply(state, playerId) {
  return state.players[playerId].battlefieldUnitIds.reduce((total, unitId) => total + state.units[unitId].currentSupplyValue, 0);
}

function fillPercent(state, playerId) {
  const pool = state.players[playerId].supplyPool;
  if (pool === Infinity) return 100;
  if (pool <= 0) return 0;
  return Math.min(100, (getPlayerSupply(state, playerId) / pool) * 100);
}

function titleCase(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function renderUnitList(containerId, units, state, uiState, onClick) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!units.length) {
    container.innerHTML = '<div class="empty-state">None.</div>';
    return;
  }
  units.forEach(unit => container.appendChild(buildUnitCard(unit, uiState.selectedUnitId, onClick)));
}

export function renderReserveTray(state, uiState, onSelect) {
  renderUnitList("playerReserves", state.players.playerA.reserveUnitIds.map(id => state.units[id]), state, uiState, onSelect);
  renderUnitList("enemyReserves", state.players.playerB.reserveUnitIds.map(id => state.units[id]), state, uiState, onSelect);
  renderUnitList("playerBattlefield", state.players.playerA.battlefieldUnitIds.map(id => state.units[id]), state, uiState, onSelect);
  renderUnitList("enemyBattlefield", state.players.playerB.battlefieldUnitIds.map(id => state.units[id]), state, uiState, onSelect);
}

export function renderSelectedUnit(state, uiState) {
  const panel = document.getElementById("selectedUnitPanel");
  const unit = uiState.selectedUnitId ? state.units[uiState.selectedUnitId] : null;
  if (!unit) {
    panel.innerHTML = '<div class="empty-state">No unit selected.</div>';
    return;
  }
  const alive = unit.modelIds.filter(id => unit.models[id].alive).length;
  panel.innerHTML = `
    <div class="selected-panel-title">${unit.name}</div>
    <div class="badge-row">
      <span class="badge ${unit.owner}">${formatPlayerName(unit.owner)}</span>
      <span class="badge">${unit.status.location}</span>
      ${unit.status.engaged ? '<span class="badge warn">Engaged</span>' : ''}
      ${unit.status.outOfCoherency ? '<span class="badge warn">Out of Coherency</span>' : ''}
    </div>
    <div class="selected-stats">
      <div class="selected-stat"><div class="k">Speed</div><div class="v">${unit.speed}</div></div>
      <div class="selected-stat"><div class="k">Supply</div><div class="v">${unit.currentSupplyValue}</div></div>
      <div class="selected-stat"><div class="k">Models Alive</div><div class="v">${alive}</div></div>
      <div class="selected-stat"><div class="k">Leading Model</div><div class="v">${unit.leadingModelId.replace(`${unit.id}_`, "")}</div></div>
    </div>
  `;
}

export function renderActionButtons(buttons) {
  const container = document.getElementById("actionButtons");
  container.innerHTML = "";
  if (!buttons.length) {
    container.innerHTML = '<div class="empty-state">No actions available.</div>';
    return;
  }
  buttons.forEach(button => container.appendChild(button));
}

export function renderLog(state) {
  const panel = document.getElementById("logPanel");
  panel.innerHTML = "";
  state.log.forEach(entry => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = `<div class="meta">Round ${entry.round} • ${titleCase(entry.phase)} • ${entry.type}</div><div>${entry.text}</div>`;
    panel.appendChild(div);
  });
}
