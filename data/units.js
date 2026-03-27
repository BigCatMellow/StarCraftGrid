export const UNIT_DATA = {
  marine_squad: {
    id: "marine_squad",
    name: "Marines",
    tags: ["Ground", "Infantry", "Ranged"],
    abilities: ["combat_squad"],
    speed: 6,
    size: 1,
    base: { shape: "circle", diameterMm: 25, radiusInches: 0.5 },
    startingModelCount: 6,
    woundsPerModel: 1,
    defense: {
      toughness: 3,
      armorSave: 4,
      invulnerableSave: null
    },
    rangedWeapons: [
      {
        id: "gauss_rifle",
        name: "Gauss Rifle",
        rangeInches: 15,
        shotsPerModel: 1,
        hitTarget: 4,
        strength: 4,
        armorPenetration: 1,
        damage: 1,
        keywords: ["rapid_fire"]
      }
    ],
    meleeWeapons: [
      {
        id: "combat_knife",
        name: "Combat Knife",
        attacksPerModel: 1,
        hitTarget: 5,
        strength: 3,
        armorPenetration: 0,
        damage: 1,
        keywords: []
      }
    ],
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
    abilities: ["stabilized_platform"],
    speed: 5,
    size: 2,
    base: { shape: "circle", diameterMm: 50, radiusInches: 1 },
    startingModelCount: 1,
    woundsPerModel: 4,
    defense: {
      toughness: 6,
      armorSave: 3,
      invulnerableSave: 5
    },
    rangedWeapons: [
      {
        id: "phase_disruptor",
        name: "Phase Disruptor",
        rangeInches: 18,
        shotsPerModel: 4,
        hitTarget: 4,
        strength: 7,
        armorPenetration: 2,
        damage: 2,
        keywords: ["piercing"]
      }
    ],
    meleeWeapons: [
      {
        id: "stomp",
        name: "Stomp",
        attacksPerModel: 2,
        hitTarget: 4,
        strength: 6,
        armorPenetration: 1,
        damage: 1,
        keywords: ["brutal"]
      }
    ],
    supplyProfile: [
      { minModels: 1, supply: 3 },
      { minModels: 0, supply: 0 }
    ]
  },
  zealot_squad: {
    id: "zealot_squad",
    name: "Zealots",
    tags: ["Ground", "Infantry", "Melee", "Psionic"],
    abilities: ["charge"],
    speed: 7,
    size: 1,
    base: { shape: "circle", diameterMm: 32, radiusInches: 0.6 },
    startingModelCount: 4,
    woundsPerModel: 2,
    defense: {
      toughness: 4,
      armorSave: 4,
      invulnerableSave: 5
    },
    rangedWeapons: [],
    meleeWeapons: [
      {
        id: "psi_blades",
        name: "Psi Blades",
        attacksPerModel: 2,
        hitTarget: 4,
        strength: 5,
        armorPenetration: 2,
        damage: 1,
        keywords: ["precise"]
      }
    ],
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
    tags: ["Ground", "Biological", "Swarm", "Light", "Infantry"],
    abilities: ["swarm_tactics"],
    speed: 8,
    size: 1,
    base: { shape: "circle", diameterMm: 25, radiusInches: 0.45 },
    startingModelCount: 8,
    woundsPerModel: 1,
    defense: {
      toughness: 3,
      armorSave: 6,
      invulnerableSave: null
    },
    rangedWeapons: [],
    meleeWeapons: [
      {
        id: "claws",
        name: "Claws",
        attacksPerModel: 2,
        hitTarget: 4,
        strength: 3,
        armorPenetration: 0,
        damage: 1,
        keywords: ["anti_infantry"]
      }
    ],
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

  const rangedWeapons = template.rangedWeapons?.map(weapon => ({ ...weapon })) ?? [];

  return {
    id: unitId,
    owner,
    templateId,
    name: template.name,
    leadingModelId: modelIds[0] ?? null,
    modelIds,
    models,
    tags: [...template.tags],
    abilities: [...(template.abilities ?? [])],
    speed: template.speed,
    size: template.size,
    base: { ...template.base },
    defense: { ...template.defense },
    rangedWeapons,
    meleeWeapons: template.meleeWeapons?.map(weapon => ({ ...weapon })) ?? [],
    ranged: rangedWeapons.length
      ? {
          rangeInches: rangedWeapons[0].rangeInches,
          shotsPerModel: rangedWeapons[0].shotsPerModel,
          hitTarget: rangedWeapons[0].hitTarget
        }
      : null,
    supplyProfile: [...template.supplyProfile],
    currentSupplyValue: computeCurrentSupplyValue(template, template.startingModelCount),
    status: {
      location: "reserves",
      movementActivated: false,
      assaultActivated: false,
      combatActivated: false,
      engaged: false,
      outOfCoherency: false,
      stationary: false,
      cannotRangedAttackNextAssault: false,
      cannotRangedAttackThisAssault: false,
      cannotChargeNextAssault: false,
      cannotChargeThisAssault: false,
      overwatchUsedThisRound: false
    },
    activationMarkers: []
  };
}
