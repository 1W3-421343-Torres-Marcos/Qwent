import type { FactionId, PlayableFactionId } from '../../../core';

export interface FactionDisplayMeta {
  readonly id: FactionId;
  readonly label: string;
  readonly shortLabel: string;
  readonly passiveSummary: string;
  readonly borderClass: string;
  readonly surfaceClass: string;
  readonly accentClass: string;
}

export const FACTION_META: Readonly<Record<FactionId, FactionDisplayMeta>> = {
  NORTHERN_REALMS: {
    id: 'NORTHERN_REALMS',
    label: 'Reinos del Norte',
    shortLabel: 'Norte',
    passiveSummary: 'Roba 1 carta adicional al ganar una ronda.',
    borderClass: 'border-blue-400/75',
    surfaceClass: 'bg-northern/35',
    accentClass: 'text-blue-300',
  },
  NILFGAARD: {
    id: 'NILFGAARD',
    label: 'Imperio Nilfgaardiano',
    shortLabel: 'Nilfgaard',
    passiveSummary: 'Gana las rondas empatadas (salvo espejo).',
    borderClass: 'border-yellow-500/80',
    surfaceClass: 'bg-nilfgaard/90',
    accentClass: 'text-yellow-400',
  },
  MONSTERS: {
    id: 'MONSTERS',
    label: 'Monstruos',
    shortLabel: 'Monstruos',
    passiveSummary: 'Conserva 1 unidad aleatoria no-Héroe entre rondas.',
    borderClass: 'border-red-400/75',
    surfaceClass: 'bg-monsters/35',
    accentClass: 'text-red-300',
  },
  SCOIATAEL: {
    id: 'SCOIATAEL',
    label: "Scoia'tael",
    shortLabel: "Scoia'tael",
    passiveSummary: 'Elige quién empieza la Ronda 1 (salvo espejo).',
    borderClass: 'border-green-400/75',
    surfaceClass: 'bg-scoiatael/35',
    accentClass: 'text-green-300',
  },
  NEUTRAL: {
    id: 'NEUTRAL',
    label: 'Neutral',
    shortLabel: 'Neutral',
    passiveSummary: 'Disponible para todas las facciones.',
    borderClass: 'border-stone-400/70',
    surfaceClass: 'bg-neutral/40',
    accentClass: 'text-stone-300',
  },
};

export function getPlayableFactionMeta(faction: PlayableFactionId): FactionDisplayMeta {
  return FACTION_META[faction];
}
