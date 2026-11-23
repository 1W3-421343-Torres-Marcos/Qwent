import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  validateDeck,
  type CardDefinition,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

describe('Deck Validator (F5.3)', () => {
  it('validates a legal Northern Realms deck with 22 units, 10 specials, neutral cards, and valid leader', () => {
    const nrDeck = decks.find((d) => d.faction === 'NORTHERN_REALMS')!;
    const unitPool = nrDeck.cardIds.filter((id) => {
      const card = catalog.find((c) => c.id === id);
      return card?.type === 'UNIT';
    });
    const exactly22Units = unitPool.slice(0, 22);
    const tenSpecials = [
      'sp_decoy',
      'sp_decoy',
      'sp_decoy',
      'sp_scorch',
      'sp_scorch',
      'sp_commanders_horn',
      'sp_commanders_horn',
      'sp_biting_frost',
      'sp_impenetrable_fog',
      'sp_clear_weather',
    ];

    const result = validateDeck(
      [...exactly22Units, ...tenSpecials],
      'nr_leader_foltest_siege_master',
      'NORTHERN_REALMS',
      catalog,
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.unitCount).toBe(22);
    expect(result.specialCount).toBe(10);
    expect(result.totalCards).toBe(32);
    expect(result.heroCount).toBeGreaterThan(0);
    expect(result.totalStrength).toBeGreaterThan(0);
  });

  it('rejects < 22 units and > 10 special cards', () => {
    const nrDeck = decks.find((d) => d.faction === 'NORTHERN_REALMS')!;
    const units = nrDeck.cardIds.filter(
      (id) => catalog.find((c) => c.id === id)?.type === 'UNIT',
    );
    const twentyOneUnits = units.slice(0, 21);
    const elevenSpecials = [
      'sp_decoy',
      'sp_decoy',
      'sp_decoy',
      'sp_scorch',
      'sp_scorch',
      'sp_scorch',
      'sp_commanders_horn',
      'sp_commanders_horn',
      'sp_commanders_horn',
      'sp_biting_frost',
      'sp_clear_weather',
    ];

    const result = validateDeck(
      [...twentyOneUnits, ...elevenSpecials],
      'nr_leader_foltest_siege_master',
      'NORTHERN_REALMS',
      catalog,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('MIN_UNITS');
    expect(result.errors.map((e) => e.code)).toContain('MAX_SPECIALS');
  });

  it('rejects missing/wrong-faction leader, leader inside deck, cross-faction units, unknown cards, and maxCopies overflow', () => {
    const nrDeck = decks.find((d) => d.faction === 'NORTHERN_REALMS')!;
    const result = validateDeck(
      [
        ...nrDeck.cardIds,
        'ng_cahir', // Cross-faction
        'nr_blue_stripes_commando', // 4th copy (maxCopies: 3)
        'nr_leader_foltest_lord_commander', // Leader in deck cardIds
        'card_does_not_exist',
      ],
      'mo_leader_eredin_commander', // Wrong faction leader
      'NORTHERN_REALMS',
      catalog,
    );

    const codes = result.errors.map((e) => e.code);
    expect(result.valid).toBe(false);
    expect(codes).toContain('INVALID_LEADER');
    expect(codes).toContain('INVALID_FACTION');
    expect(codes).toContain('MAX_COPIES_EXCEEDED');
    expect(codes).toContain('LEADER_IN_DECK');
    expect(codes).toContain('UNKNOWN_CARD');

    const missingLeader = validateDeck(nrDeck.cardIds, null, 'NORTHERN_REALMS', catalog);
    expect(missingLeader.valid).toBe(false);
    expect(missingLeader.errors.map((e) => e.code)).toContain('MISSING_LEADER');
  });
});
