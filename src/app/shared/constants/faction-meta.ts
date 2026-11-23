import type { FactionId, PlayableFactionId } from '../../../core';

export interface FactionDisplayMeta {
  readonly id: FactionId;
  readonly label: string;
  readonly shortLabel: string;
  readonly passiveSummary: string;
}

export const FACTION_META: Readonly<Record<FactionId, FactionDisplayMeta>> = {
  NORTHERN_REALMS: {
    id: 'NORTHERN_REALMS',
    label: 'Reinos del Norte',
    shortLabel: 'Norte',
    passiveSummary: 'Roba 1 carta adicional al ganar una ronda.',
  },
  NILFGAARD: {
    id: 'NILFGAARD',
    label: 'Imperio Nilfgaardiano',
    shortLabel: 'Nilfgaard',
    passiveSummary: 'Gana las rondas empatadas (salvo espejo).',
  },
  MONSTERS: {
    id: 'MONSTERS',
    label: 'Monstruos',
    shortLabel: 'Monstruos',
    passiveSummary: 'Conserva 1 unidad aleatoria no-Héroe entre rondas.',
  },
  SCOIATAEL: {
    id: 'SCOIATAEL',
    label: "Scoia'tael",
    shortLabel: "Scoia'tael",
    passiveSummary: 'Elige quién empieza la Ronda 1 (salvo espejo).',
  },
  NEUTRAL: {
    id: 'NEUTRAL',
    label: 'Neutral',
    shortLabel: 'Neutral',
    passiveSummary: 'Disponible para todas las facciones.',
  },
};

export function getPlayableFactionMeta(faction: PlayableFactionId): FactionDisplayMeta {
  return FACTION_META[faction];
}
