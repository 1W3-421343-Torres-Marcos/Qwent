import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import type { CardDefinition } from '../types';

const catalog = rawCards as readonly CardDefinition[];

describe('Descripciones de cartas (U9.3)', () => {
  it('toda carta tiene una descripción no vacía para la tarjeta de inspección', () => {
    const missing = catalog.filter((card) => card.description.trim().length === 0);
    expect(missing.map((card) => card.id)).toEqual([]);
  });

  it('toda carta con habilidad describe qué hace (mínimo 10 caracteres)', () => {
    const terse = catalog.filter(
      (card) => card.ability !== undefined && card.description.trim().length < 10,
    );
    expect(terse.map((card) => card.id)).toEqual([]);
  });

  it('todo líder describe su habilidad', () => {
    const leaders = catalog.filter((card) => card.type === 'LEADER');
    expect(leaders.length).toBeGreaterThan(0);
    for (const leader of leaders) {
      expect(leader.description.trim().length).toBeGreaterThan(10);
    }
  });
});
