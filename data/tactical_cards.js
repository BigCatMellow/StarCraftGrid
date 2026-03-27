export const TACTICAL_CARDS = {
  focused_fire: {
    id: 'focused_fire',
    name: 'Focused Fire',
    phase: 'assault',
    target: 'friendly_battlefield_unit',
    effect: {
      timings: ['combat_resolve_attack'],
      modifiers: [
        { key: 'weapon.hitTarget', operation: 'add', value: -1, priority: 0 }
      ],
      duration: { type: 'rounds', remaining: 1 }
    }
  },
  rapid_relocation: {
    id: 'rapid_relocation',
    name: 'Rapid Relocation',
    phase: 'movement',
    target: 'friendly_battlefield_unit',
    effect: {
      timings: ['movement_move', 'movement_disengage'],
      modifiers: [
        { key: 'unit.speed', operation: 'add', value: 1, priority: 0 }
      ],
      duration: { type: 'phase_starts', phase: 'assault', remaining: 1 }
    }
  }
};

export function getTacticalCard(cardId) {
  const card = TACTICAL_CARDS[cardId];
  if (!card) throw new Error(`Unknown tactical card: ${cardId}`);
  return card;
}
