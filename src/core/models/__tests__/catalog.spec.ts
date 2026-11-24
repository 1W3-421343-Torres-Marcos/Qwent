import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawStarterDecks from '../../../assets/data/starter-decks.json';
import {
  PLAYABLE_FACTIONS,
  validateCatalog,
  validateDeck,
  validateStarterDeck,
  type CardDefinition,
  type StarterDeckDefinition,
} from '../../index';

describe('Catalog & Starter Decks Integrity (F5.2)', () => {
  const cards = rawCards as readonly CardDefinition[];
  const decks = rawStarterDecks as readonly StarterDeckDefinition[];

  it('validates cards.json schema with all 4 playable factions and leaders', () => {
    expect(cards.length).toBeGreaterThanOrEqual(60);

    const result = validateCatalog(cards);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);

    for (const faction of PLAYABLE_FACTIONS) {
      expect(cards.some((c) => c.type === 'LEADER' && c.faction === faction)).toBe(true);
      expect(cards.some((c) => c.type === 'UNIT' && c.faction === faction)).toBe(true);
    }
  });

  it('includes Heroes, all 3 Weathers, Clear Weather, Horn, and all F3 abilities', () => {
    expect(cards.some((c) => c.isHero)).toBe(true);
    expect(cards.some((c) => c.ability === 'WEATHER_FROST')).toBe(true);
    expect(cards.some((c) => c.ability === 'WEATHER_FOG')).toBe(true);
    expect(cards.some((c) => c.ability === 'WEATHER_RAIN')).toBe(true);
    expect(cards.some((c) => c.ability === 'WEATHER_CLEAR')).toBe(true);
    expect(cards.some((c) => c.type === 'SPECIAL' && c.ability === 'COMMANDERS_HORN')).toBe(true);
    expect(cards.some((c) => c.type === 'UNIT' && c.ability === 'COMMANDERS_HORN')).toBe(true);
    expect(cards.some((c) => c.ability === 'TIGHT_BOND')).toBe(true);
    expect(cards.some((c) => c.ability === 'MORALE_BOOST')).toBe(true);
    expect(cards.some((c) => c.ability === 'MUSTER')).toBe(true);
    expect(cards.some((c) => c.type === 'UNIT' && c.allowedRows.length > 1)).toBe(true);
    expect(cards.some((c) => c.ability === 'SPY')).toBe(true);
    expect(cards.some((c) => c.ability === 'DECOY')).toBe(true);
    expect(cards.some((c) => c.ability === 'MEDIC')).toBe(true);
    expect(cards.some((c) => c.ability === 'SCORCH')).toBe(true);
    expect(cards.some((c) => c.ability === 'SCORCH_ROW')).toBe(true);
  });

  it('validates all 5 playable faction starter decks with real leaders against TW3 rules', () => {
    expect(decks.length).toBe(5);
    const catalogMap = new Map(cards.map((c) => [c.id, c]));

    for (const faction of PLAYABLE_FACTIONS) {
      expect(decks.some((d) => d.faction === faction)).toBe(true);
    }

    for (const deck of decks) {
      const starterCheck = validateStarterDeck(deck, catalogMap);
      expect(starterCheck.errors).toEqual([]);
      expect(starterCheck.valid).toBe(true);
      expect(deck.leaderId).not.toBeNull();

      const fullDeckCheck = validateDeck(deck.cardIds, deck.leaderId, deck.faction, cards);
      expect(fullDeckCheck.errors).toEqual([]);
      expect(fullDeckCheck.valid).toBe(true);
      expect(fullDeckCheck.unitCount).toBeGreaterThanOrEqual(22);
      expect(fullDeckCheck.specialCount).toBeLessThanOrEqual(10);
    }
  });
});
