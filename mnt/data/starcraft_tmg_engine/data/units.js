export const UNIT_DATA = {
  marine_squad: {
    id: "marine_squad",
    name: "Marines",
    tags: ["Ground", "Infantry", "Ranged"],
    speed: 6,
    size: 1,
    base: { shape: "circle", diameterMm: 25, radiusInches: 0.5 },
    startingModelCount: 6,
    woundsPerModel: 1,
    supplyProfile: [
      { minModels: 5, supply: 2 },
      { minModels: 3, supply: 1 },
      { minModels: 1, supply: 0 },
      { minModels: 0, supply: 0 }
    ]
  },
  dragoon: {
    id: "dragoon",
    name: "Dragoon",
    tags: ["Ground", "Mechanical", "Armoured"],
    speed: 5,
    size: 2,
    base: { shape: "circle", diameterMm: 50, radiusInches: 1 },
    startingModelCount: 1,
    woundsPerModel: 4,
    supplyProfile: [
      { minModels: 1, supply: 2 },
      { minModels: 0, supply: 0 }
    ]
  },
  zealot_squad: {
    id: "zealot_squad",
    name: "Zealots",
    tags: ["Ground", "Infantry", "Melee", "Psionic"],
    speed: 7,
    size: 1,
    base: { shape: "circle", diameterMm: 32, radiusInches: 0.6 },
    startingModelCount: 4,
    woundsPerModel: 2,
    supplyProfile: [
      { minModels: 3, supply: 2 },
      { minModels: 2, supply: 1 },
      { minModels: 1, supply: 0 },
      { minModels: 0, supply: 0 }
    ]
  },
  zergling_squad: {
    id: "zergling_squad",
    name: "Zerglings",
    tags: ["Ground", "Biological", "Swarm", "Light"],
    speed: 8,
    size: 1,
    base: { shape: "circle", diameterMm: 25, radiusInches: 0.45 },
    startingModelCount: 8,
    woundsPerModel: 1,
    supplyProfile: [
      { minModels: 6, supply: 2 },
      { minModels: 4, supply: 1 },
      { minModels: 1, supply: 0 },
      { minModels: 0, supply: 0 }
    ]
  }
};

export function getUnitTemplate(templateId) {
  const template = UNIT_DATA[templateId];
  if (!template) throw new Error(`Unknown unit template: ${templateId}`);
  return template;
}

export function computeCurrentSupplyValue(template, aliveModelCount) {
  const sorted = [...template.supplyProfile].sort((a, b) => b.minModels - a.minModels);
  for (const bracket of sorted) {
    if (aliveModelCount >= bracket.minModels) return bracket.supply;
  }
  return 0;
}

export function createUnitStateFromTemplate(templateId, owner, unitId) {
  const template = getUnitTemplate(templateId);
  const models = {};
  const modelIds = [];
  for (let i = 0; i < template.startingModelCount; i += 1) {
    const id = `${unitId}_m${i + 1}`;
    modelIds.push(id);
    models[id] = {
      id,
      alive: true,
      x: null,
      y: null,
      elevation: "ground",
      woundsRemaining: template.woundsPerModel
    };
  }
  return {
    id: unitId,
    owner,
    templateId,
    name: template.name,
    leadingModelId: modelIds[0] ?? null,
    modelIds,
    models,
    tags: [...template.tags],
    speed: template.speed,
    size: template.size,
    base: { ...template.base },
    supplyProfile: [...template.supplyProfile],
    currentSupplyValue: computeCurrentSupplyValue(template, template.startingModelCount),
    status: {
      location: "reserves",
      movementActivated: false,
      engaged: false,
      outOfCoherency: false,
      stationary: false,
      cannotRangedAttackNextAssault: false,
      cannotChargeNextAssault: false
    },
    activationMarkers: []
  };
}
