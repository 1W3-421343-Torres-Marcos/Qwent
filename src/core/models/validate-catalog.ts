import {
  ABILITY_TYPES,
  LEADER_ABILITY_TYPES,
  ROW_TYPES,
  type AbilityType,
  type CardDefinition,
  type CardType,
  type FactionId,
  type LeaderAbilityType,
  type RowType,
  type StarterDeckDefinition,
} from './types';

const VALID_FACTIONS: ReadonlySet<FactionId> = new Set([
  'NORTHERN_REALMS',
  'NILFGAARD',
  'MONSTERS',
  'SCOIATAEL',
  'NEUTRAL',
]);

const VALID_CARD_TYPES: ReadonlySet<CardType> = new Set(['UNIT', 'SPECIAL', 'LEADER']);
const VALID_ROWS: ReadonlySet<RowType> = new Set(ROW_TYPES);
const VALID_ABILITIES: ReadonlySet<AbilityType> = new Set(ABILITY_TYPES);
const VALID_LEADER_ABILITIES: ReadonlySet<LeaderAbilityType> = new Set(LEADER_ABILITY_TYPES);

export interface CatalogValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates card definitions for schema integrity, unique IDs, valid enums, and row arrays.
 */
export function validateCatalog(cards: readonly CardDefinition[]): CatalogValidationResult {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const card of cards) {
    if (!card.id.trim()) {
      errors.push('Carta con id vacío.');
    } else if (seenIds.has(card.id)) {
      errors.push(`ID duplicado en catálogo: ${card.id}`);
    } else {
      seenIds.add(card.id);
    }

    if (!VALID_FACTIONS.has(card.faction)) {
      errors.push(`Facción inválida en ${card.id}: ${card.faction}`);
    }
    if (!VALID_CARD_TYPES.has(card.type)) {
      errors.push(`Tipo inválido en ${card.id}: ${card.type}`);
    }
    if (!Number.isInteger(card.baseStrength) || card.baseStrength < 0) {
      errors.push(`baseStrength inválido en ${card.id}: ${card.baseStrength}`);
    }
    if (!Array.isArray(card.allowedRows)) {
      errors.push(`allowedRows debe ser array en ${card.id}`);
    } else {
      if (card.type === 'UNIT' && card.allowedRows.length === 0) {
        errors.push(`Unidad ${card.id} debe tener al menos 1 fila en allowedRows.`);
      }
      for (const row of card.allowedRows) {
        if (!VALID_ROWS.has(row)) {
          errors.push(`Fila inválida "${row}" en ${card.id}`);
        }
      }
    }

    if (card.ability !== null && !VALID_ABILITIES.has(card.ability)) {
      errors.push(`Habilidad inválida "${card.ability}" en ${card.id}`);
    }
    if (!Number.isInteger(card.maxCopies) || card.maxCopies < 1) {
      errors.push(`maxCopies inválido en ${card.id}: ${card.maxCopies}`);
    }

    if (card.type === 'LEADER') {
      if (card.faction === 'NEUTRAL') {
        errors.push(`Líder ${card.id} no puede ser NEUTRAL.`);
      }
      if (card.baseStrength !== 0) {
        errors.push(`Líder ${card.id} debe tener baseStrength 0.`);
      }
      if (card.allowedRows.length !== 0) {
        errors.push(`Líder ${card.id} debe tener allowedRows vacío.`);
      }
      if (card.maxCopies !== 1) {
        errors.push(`Líder ${card.id} debe tener maxCopies = 1.`);
      }
      if (!card.leaderAbility || !VALID_LEADER_ABILITIES.has(card.leaderAbility)) {
        errors.push(`Líder ${card.id} tiene leaderAbility inválida: ${String(card.leaderAbility)}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a starter or custom deck against the catalog and classic TW3 deck rules.
 */
export function validateStarterDeck(
  deck: StarterDeckDefinition,
  catalogById: ReadonlyMap<string, CardDefinition>,
): CatalogValidationResult {
  const errors: string[] = [];
  const copyCounts = new Map<string, number>();
  let unitCount = 0;
  let specialCount = 0;

  if (deck.leaderId !== null) {
    const leader = catalogById.get(deck.leaderId);
    if (!leader || leader.type !== 'LEADER' || leader.faction !== deck.faction) {
      errors.push(`Líder inválido (${deck.leaderId}) para facción ${deck.faction} en ${deck.id}`);
    }
  }

  for (const cardId of deck.cardIds) {
    const def = catalogById.get(cardId);
    if (!def) {
      errors.push(`Carta inexistente "${cardId}" en mazo ${deck.id}`);
      continue;
    }
    if (def.type === 'LEADER') {
      errors.push(`Un líder (${cardId}) no puede estar dentro de cardIds en ${deck.id}`);
      continue;
    }
    if (def.faction !== deck.faction && def.faction !== 'NEUTRAL') {
      errors.push(`Facción incompatible para ${cardId} (${def.faction}) en mazo ${deck.faction}`);
    }

    const nextCount = (copyCounts.get(cardId) ?? 0) + 1;
    copyCounts.set(cardId, nextCount);
    if (nextCount > def.maxCopies) {
      errors.push(`Exceso de copias de ${cardId} (${nextCount}/${def.maxCopies}) en ${deck.id}`);
    }

    if (def.type === 'UNIT') {
      unitCount++;
    } else if (def.type === 'SPECIAL') {
      specialCount++;
    }
  }

  if (unitCount < 22) {
    errors.push(`Mazo ${deck.id} tiene ${unitCount} unidades (mínimo 22).`);
  }
  if (specialCount > 10) {
    errors.push(`Mazo ${deck.id} tiene ${specialCount} especiales (máximo 10).`);
  }

  return { valid: errors.length === 0, errors };
}
