import type { CardDefinition, CardInstance } from '../models/types';

export const KAMBI_CARD_ID = 'sk_kambi' as const;
export const BERSERKER_CARD_ID = 'sk_berserker' as const;
export const YOUNG_BERSERKER_CARD_ID = 'sk_young_berserker' as const;

export const HEMDALL_CARD: CardDefinition = {
  id: 'sk_hemdall',
  name: 'Hemdall',
  faction: 'SKELLIGE',
  type: 'UNIT',
  baseStrength: 11,
  isHero: true,
  allowedRows: ['CLOSE_COMBAT'],
  ability: null,
  maxCopies: 1,
  description: 'Héroe. Invocado por Kambi al entrar al descarte al finalizar una ronda (Fuerza 11).',
};

export const VILDKAARL_CARD: CardDefinition = {
  id: 'sk_vildkaarl',
  name: 'Vildkaarl',
  faction: 'SKELLIGE',
  type: 'UNIT',
  baseStrength: 14,
  isHero: false,
  allowedRows: ['CLOSE_COMBAT'],
  ability: 'MORALE_BOOST',
  maxCopies: 1,
  description: 'Transformado por Mardroeme. Inyección de moral: suma +1 a las demás unidades normales de su fila.',
};

export const YOUNG_VILDKAARL_CARD: CardDefinition = {
  id: 'sk_young_vildkaarl',
  name: 'Joven Vildkaarl',
  faction: 'SKELLIGE',
  type: 'UNIT',
  baseStrength: 8,
  isHero: false,
  allowedRows: ['RANGED'],
  ability: 'TIGHT_BOND',
  bondGroup: 'young_vildkaarl',
  maxCopies: 3,
  description: 'Transformado por Mardroeme. Vínculo estrecho: multiplica su fuerza por cada copia igual en la fila.',
};

/**
 * Transforms Berserker and Young Berserker unit instances into Vildkaarl / Young Vildkaarl tokens.
 */
export function transformBerserkerInstance(instance: CardInstance): CardInstance {
  if (instance.definitionId === BERSERKER_CARD_ID) {
    return {
      instanceId: instance.instanceId,
      definitionId: VILDKAARL_CARD.id,
      card: VILDKAARL_CARD,
      effectiveStrength: VILDKAARL_CARD.baseStrength,
    };
  }
  if (instance.definitionId === YOUNG_BERSERKER_CARD_ID) {
    return {
      instanceId: instance.instanceId,
      definitionId: YOUNG_VILDKAARL_CARD.id,
      card: YOUNG_VILDKAARL_CARD,
      effectiveStrength: YOUNG_VILDKAARL_CARD.baseStrength,
    };
  }
  return instance;
}
