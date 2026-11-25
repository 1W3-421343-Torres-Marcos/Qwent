import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import { PLAYABLE_FACTIONS, type CardDefinition } from '../../models/types';
import { pickRandomLeaderId, pickRandomLoadout } from '../random-loadout';

const catalog = rawCards as readonly CardDefinition[];

function sequence(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('pickRandomLoadout (U8.1)', () => {
  it('es determinista con el mismo RNG', () => {
    const a = pickRandomLoadout(catalog, sequence([0.3, 0.6]));
    const b = pickRandomLoadout(catalog, sequence([0.3, 0.6]));
    expect(a).toEqual(b);
  });

  it('el líder sorteado siempre es de la facción sorteada', () => {
    for (let i = 0; i < 200; i++) {
      const seed = (i * 0.6180339887) % 1;
      const loadout = pickRandomLoadout(catalog, sequence([seed, (seed * 7) % 1]));
      expect(loadout).not.toBeNull();
      const leader = catalog.find((c) => c.id === loadout?.leaderId);
      expect(leader?.type).toBe('LEADER');
      expect(leader?.faction).toBe(loadout?.faction);
    }
  });

  it('cubre las 5 facciones jugables y todos los líderes de cada una', () => {
    const factions = new Set<string>();
    const leaders = new Set<string>();
    for (let f = 0; f < 5; f++) {
      for (let l = 0; l < 5; l++) {
        const loadout = pickRandomLoadout(catalog, sequence([(f + 0.5) / 5, (l + 0.5) / 5]));
        if (loadout) {
          factions.add(loadout.faction);
          leaders.add(loadout.leaderId);
        }
      }
    }
    expect([...factions].sort()).toEqual([...PLAYABLE_FACTIONS].sort());
    expect(leaders.size).toBe(catalog.filter((c) => c.type === 'LEADER').length);
  });

  it('tolera valores extremos del RNG (0 y casi 1)', () => {
    expect(pickRandomLoadout(catalog, () => 0)).not.toBeNull();
    expect(pickRandomLoadout(catalog, () => 0.9999999)).not.toBeNull();
  });

  it('devuelve null si el catálogo no tiene líderes', () => {
    expect(pickRandomLoadout([], () => 0.5)).toBeNull();
    expect(pickRandomLeaderId('MONSTERS', [], () => 0.5)).toBeNull();
  });

  it('pickRandomLeaderId elige solo líderes de la facción pedida', () => {
    const id = pickRandomLeaderId('SKELLIGE', catalog, () => 0.5);
    const leader = catalog.find((c) => c.id === id);
    expect(leader?.faction).toBe('SKELLIGE');
  });
});
