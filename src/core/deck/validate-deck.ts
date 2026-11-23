import type { CardDefinition, PlayableFactionId } from '../models/types';

export type DeckValidationErrorCode =
  | 'MIN_UNITS'
  | 'MAX_SPECIALS'
  | 'INVALID_FACTION'
  | 'MISSING_LEADER'
  | 'INVALID_LEADER'
  | 'MAX_COPIES_EXCEEDED'
  | 'UNKNOWN_CARD'
  | 'LEADER_IN_DECK';

export interface DeckValidationError {
  readonly code: DeckValidationErrorCode;
  readonly message: string;
  readonly cardId?: string;
}

export interface DeckValidationResult {
  readonly valid: boolean;
  readonly unitCount: number;
  readonly specialCount: number;
  readonly totalCards: number;
  readonly heroCount: number;
  readonly totalStrength: number;
  readonly errors: readonly DeckValidationError[];
}

export interface ValidateDeckOptions {
  readonly allowMissingLeader?: boolean;
}

const MIN_UNITS_REQUIRED = 22;
const MAX_SPECIALS_ALLOWED = 10;

/**
 * Pure TW3 Gwent deck validator checking unit minimum (>= 22), special limit (<= 10),
 * faction + neutral restriction, single valid faction leader, and per-card copy limits.
 */
export function validateDeck(
  cardIds: readonly string[],
  leaderId: string | null,
  faction: PlayableFactionId,
  catalog: readonly CardDefinition[],
  options: ValidateDeckOptions = {},
): DeckValidationResult {
  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const errors: DeckValidationError[] = [];
  const copyCounts = new Map<string, number>();

  let unitCount = 0;
  let specialCount = 0;
  let heroCount = 0;
  let totalStrength = 0;

  if (leaderId === null || leaderId.trim() === '') {
    if (!options.allowMissingLeader) {
      errors.push({
        code: 'MISSING_LEADER',
        message: 'Cada mazo debe incluir exactamente 1 carta de Líder.',
      });
    }
  } else {
    const leader = catalogById.get(leaderId);
    if (!leader || leader.type !== 'LEADER' || leader.faction !== faction) {
      errors.push({
        code: 'INVALID_LEADER',
        cardId: leaderId,
        message: `El Líder "${leaderId}" no pertenece a la facción ${faction}.`,
      });
    }
  }

  for (const cardId of cardIds) {
    const def = catalogById.get(cardId);
    if (!def) {
      errors.push({
        code: 'UNKNOWN_CARD',
        cardId,
        message: `Carta inexistente en el catálogo: "${cardId}".`,
      });
      continue;
    }

    if (def.type === 'LEADER') {
      errors.push({
        code: 'LEADER_IN_DECK',
        cardId,
        message: `La carta de Líder "${def.name}" debe asignarse como Líder y no dentro del mazo.`,
      });
      continue;
    }

    if (def.faction !== faction && def.faction !== 'NEUTRAL') {
      errors.push({
        code: 'INVALID_FACTION',
        cardId,
        message: `"${def.name}" (${def.faction}) no puede usarse en un mazo de ${faction}.`,
      });
    }

    const nextCount = (copyCounts.get(cardId) ?? 0) + 1;
    copyCounts.set(cardId, nextCount);
    if (nextCount > def.maxCopies) {
      errors.push({
        code: 'MAX_COPIES_EXCEEDED',
        cardId,
        message: `Exceso de copias de "${def.name}" (${nextCount}/${def.maxCopies}).`,
      });
    }

    if (def.type === 'UNIT') {
      unitCount++;
      totalStrength += def.baseStrength;
      if (def.isHero) {
        heroCount++;
      }
    } else if (def.type === 'SPECIAL') {
      specialCount++;
    }
  }

  if (unitCount < MIN_UNITS_REQUIRED) {
    errors.push({
      code: 'MIN_UNITS',
      message: `El mazo tiene ${unitCount} unidades (mínimo obligatorio: ${MIN_UNITS_REQUIRED}).`,
    });
  }

  if (specialCount > MAX_SPECIALS_ALLOWED) {
    errors.push({
      code: 'MAX_SPECIALS',
      message: `El mazo tiene ${specialCount} especiales (máximo permitido: ${MAX_SPECIALS_ALLOWED}).`,
    });
  }

  return {
    valid: errors.length === 0,
    unitCount,
    specialCount,
    totalCards: cardIds.length,
    heroCount,
    totalStrength,
    errors,
  };
}
