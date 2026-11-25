import { PLAYABLE_FACTIONS, type CardDefinition, type PlayableFactionId } from '../models/types';

export interface RandomLoadout {
  readonly faction: PlayableFactionId;
  readonly leaderId: string;
}

/** Fuente de azar inyectada: devuelve un número en el rango [0, 1). */
export type RandomSource = () => number;

function pickIndex(rng: RandomSource, length: number): number {
  const index = Math.floor(rng() * length);
  return Math.min(Math.max(index, 0), length - 1);
}

/** Elige un líder al azar de la facción indicada, o `null` si no tiene líderes en el catálogo. */
export function pickRandomLeaderId(
  faction: PlayableFactionId,
  catalog: readonly CardDefinition[],
  rng: RandomSource,
): string | null {
  const leaders = catalog.filter((card) => card.type === 'LEADER' && card.faction === faction);
  if (leaders.length === 0) return null;
  return leaders[pickIndex(rng, leaders.length)].id;
}

/**
 * Sortea una facción jugable (solo entre las que tienen líderes) y uno de sus líderes.
 * Función pura: el azar se inyecta, el Core nunca usa `Math.random()`.
 */
export function pickRandomLoadout(
  catalog: readonly CardDefinition[],
  rng: RandomSource,
): RandomLoadout | null {
  const candidates = PLAYABLE_FACTIONS.filter((faction) =>
    catalog.some((card) => card.type === 'LEADER' && card.faction === faction),
  );
  if (candidates.length === 0) return null;
  const faction = candidates[pickIndex(rng, candidates.length)];
  const leaderId = pickRandomLeaderId(faction, catalog, rng);
  return leaderId === null ? null : { faction, leaderId };
}
