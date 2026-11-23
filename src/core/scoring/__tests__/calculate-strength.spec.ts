import { describe, expect, it } from 'vitest';
import type { CardDefinition, CardInstance, GameState, RowState, WeatherState } from '../../index';
import { calculateRowStrength, recalculateBoard } from '../../index';

function makeUnit(
  instanceId: string,
  baseStrength: number,
  overrides: Partial<CardDefinition> = {},
): CardInstance {
  const card: CardDefinition = {
    id: `def_${instanceId}`,
    name: `Card ${instanceId}`,
    faction: 'NORTHERN_REALMS',
    type: 'UNIT',
    baseStrength,
    isHero: false,
    allowedRows: ['CLOSE_COMBAT'],
    ability: null,
    maxCopies: 3,
    description: '',
    ...overrides,
  };
  return {
    instanceId,
    definitionId: card.id,
    card,
    effectiveStrength: baseStrength,
  };
}

function makeSpecial(instanceId: string, ability: CardDefinition['ability']): CardInstance {
  const card: CardDefinition = {
    id: `sp_${instanceId}`,
    name: `Special ${instanceId}`,
    faction: 'NEUTRAL',
    type: 'SPECIAL',
    baseStrength: 0,
    isHero: false,
    allowedRows: ['CLOSE_COMBAT', 'RANGED', 'SIEGE'],
    ability,
    maxCopies: 3,
    description: '',
  };
  return {
    instanceId,
    definitionId: card.id,
    card,
    effectiveStrength: 0,
  };
}

function emptyRow(cards: readonly CardInstance[] = [], hornCard: CardInstance | null = null): RowState {
  return { cards, hornCard, totalStrength: 0 };
}

function createMockState(
  p1Close: RowState,
  p2Close: RowState,
  weather: WeatherState = { frost: null, fog: null, rain: null },
  p1Ranged: RowState = emptyRow(),
  p2Siege: RowState = emptyRow(),
): GameState {
  return {
    phase: 'PLAYING',
    roundNumber: 1,
    activePlayer: 'PLAYER_1',
    rngSeed: 1,
    weather,
    pendingSelection: null,
    roundHistory: [],
    winner: null,
    players: {
      PLAYER_1: {
        id: 'PLAYER_1',
        name: 'Jugador 1',
        faction: 'NORTHERN_REALMS',
        leader: null,
        leaderUsed: false,
        gems: 2,
        passed: false,
        hand: [],
        deck: [],
        discard: [],
        rows: {
          CLOSE_COMBAT: p1Close,
          RANGED: p1Ranged,
          SIEGE: emptyRow(),
        },
        totalScore: 0,
        mulligansRemaining: 0,
      },
      PLAYER_2: {
        id: 'PLAYER_2',
        name: 'Jugador 2',
        faction: 'NILFGAARD',
        leader: null,
        leaderUsed: false,
        gems: 2,
        passed: false,
        hand: [],
        deck: [],
        discard: [],
        rows: {
          CLOSE_COMBAT: p2Close,
          RANGED: emptyRow(),
          SIEGE: p2Siege,
        },
        totalScore: 0,
        mulligansRemaining: 0,
      },
    },
  };
}

describe('Dynamic Strength Scoring Engine (F2.2)', () => {
  it('computes normal units without mutating baseStrength', () => {
    const unitA = makeUnit('u1', 5);
    const unitB = makeUnit('u2', 6);
    const row = calculateRowStrength(emptyRow([unitA, unitB]), false);

    expect(row.totalStrength).toBe(11);
    expect(row.cards.map((c) => c.effectiveStrength)).toEqual([5, 6]);
    expect(unitA.card.baseStrength).toBe(5);
    expect(unitB.card.baseStrength).toBe(6);
  });

  it('keeps Heroes immune to weather and Commander Horn', () => {
    const hero = makeUnit('h1', 15, { isHero: true });
    const normal = makeUnit('n1', 6);
    const horn = makeSpecial('horn', 'COMMANDERS_HORN');
    const row = calculateRowStrength(emptyRow([hero, normal], horn), true);

    expect(row.cards[0]?.effectiveStrength).toBe(15);
    expect(row.cards[1]?.effectiveStrength).toBe(2);
    expect(row.totalStrength).toBe(17);
  });

  it('applies frost, fog, and rain symmetrically to both sides and clears cleanly', () => {
    const frostCard = makeSpecial('frost', 'WEATHER_FROST');
    const fogCard = makeSpecial('fog', 'WEATHER_FOG');
    const rainCard = makeSpecial('rain', 'WEATHER_RAIN');

    const p1Close = emptyRow([makeUnit('p1c', 8)]);
    const p2Close = emptyRow([makeUnit('p2c', 10)]);
    const p1Ranged = emptyRow([makeUnit('p1r', 6, { allowedRows: ['RANGED'] })]);
    const p2Siege = emptyRow([makeUnit('p2s', 9, { allowedRows: ['SIEGE'] })]);

    const weathered = recalculateBoard(
      createMockState(
        p1Close,
        p2Close,
        {
          frost: { card: frostCard, owner: 'PLAYER_1' },
          fog: { card: fogCard, owner: 'PLAYER_2' },
          rain: { card: rainCard, owner: 'PLAYER_1' },
        },
        p1Ranged,
        p2Siege,
      ),
    );

    expect(weathered.players.PLAYER_1.rows.CLOSE_COMBAT.totalStrength).toBe(1);
    expect(weathered.players.PLAYER_1.rows.RANGED.totalStrength).toBe(1);
    expect(weathered.players.PLAYER_1.totalScore).toBe(2);

    expect(weathered.players.PLAYER_2.rows.CLOSE_COMBAT.totalStrength).toBe(1);
    expect(weathered.players.PLAYER_2.rows.SIEGE.totalStrength).toBe(1);
    expect(weathered.players.PLAYER_2.totalScore).toBe(2);

    const cleared = recalculateBoard({
      ...weathered,
      weather: { frost: null, fog: null, rain: null },
    });

    expect(cleared.players.PLAYER_1.totalScore).toBe(14);
    expect(cleared.players.PLAYER_2.totalScore).toBe(19);
    expect(cleared.players.PLAYER_1.rows.CLOSE_COMBAT.cards[0]?.card.baseStrength).toBe(8);
  });

  it('handles Commander Horn slot, Horn unit non-self-doubling, and x2 cap', () => {
    const hornUnit = makeUnit('dandelion', 2, { ability: 'COMMANDERS_HORN' });
    const ally = makeUnit('ally', 5);

    // Horn unit alone with ally: ally doubles (5 -> 10), Horn unit stays 2
    const withHornUnit = calculateRowStrength(emptyRow([hornUnit, ally]), false);
    expect(withHornUnit.cards.map((c) => c.effectiveStrength)).toEqual([2, 10]);
    expect(withHornUnit.totalStrength).toBe(12);

    // Horn unit + Horn card in slot: Horn unit NOW doubles (2 -> 4), ally stays capped at x2 (5 -> 10, never x4)
    const hornSlotCard = makeSpecial('horn_slot', 'COMMANDERS_HORN');
    const withSlotToo = calculateRowStrength(emptyRow([hornUnit, ally], hornSlotCard), false);
    expect(withSlotToo.cards.map((c) => c.effectiveStrength)).toEqual([4, 10]);
    expect(withSlotToo.totalStrength).toBe(14);

    // Two Horn units in same row: each doubles the other, capped at x2
    const secondHornUnit = makeUnit('horn2', 3, { ability: 'COMMANDERS_HORN' });
    const twoHorns = calculateRowStrength(emptyRow([hornUnit, secondHornUnit, ally]), false);
    expect(twoHorns.cards.map((c) => c.effectiveStrength)).toEqual([4, 6, 10]);
    expect(twoHorns.totalStrength).toBe(20);
  });

  it('combines Weather + Commander Horn so base becomes 1 then doubles to 2', () => {
    const unit = makeUnit('u_strong', 10);
    const hornCard = makeSpecial('horn', 'COMMANDERS_HORN');
    const row = calculateRowStrength(emptyRow([unit], hornCard), true);

    expect(row.cards[0]?.effectiveStrength).toBe(2);
    expect(row.totalStrength).toBe(2);
  });

  it('applies strict pipeline: base -> Weather(1) -> Tight Bond -> Morale (+1 to others only) -> Horn -> Heroes/Decoy immune', () => {
    const bondA = makeUnit('b1', 4, { ability: 'TIGHT_BOND', bondGroup: 'blue_stripes' });
    const bondB = makeUnit('b2', 4, { ability: 'TIGHT_BOND', bondGroup: 'blue_stripes' });
    const moraleA = makeUnit('m1', 1, { ability: 'MORALE_BOOST' });
    const moraleB = makeUnit('m2', 6, { ability: 'MORALE_BOOST' });
    const hero = makeUnit('h1', 10, { isHero: true });
    const decoy = makeSpecial('d1', 'DECOY');
    const hornSlot = makeSpecial('horn', 'COMMANDERS_HORN');

    // No weather:
    // bondA/B: (4 * 2 + 2) * 2 = 20 each
    // moraleA: (1 + 1) * 2 = 4 (does NOT boost itself)
    // moraleB: (6 + 1) * 2 = 14 (does NOT boost itself)
    // hero: 10 (immune)
    // decoy: 0 (immune)
    const clearRow = calculateRowStrength(
      emptyRow([bondA, bondB, moraleA, moraleB, hero, decoy], hornSlot),
      false,
    );
    expect(clearRow.cards.map((c) => c.effectiveStrength)).toEqual([20, 20, 4, 14, 10, 0]);
    expect(clearRow.totalStrength).toBe(68);

    // With weather active:
    // bondA/B: (1 * 2 + 2) * 2 = 8 each
    // moraleA/B: (1 + 1) * 2 = 4 each
    // hero: 10, decoy: 0
    const frostRow = calculateRowStrength(
      emptyRow([bondA, bondB, moraleA, moraleB, hero, decoy], hornSlot),
      true,
    );
    expect(frostRow.cards.map((c) => c.effectiveStrength)).toEqual([8, 8, 4, 4, 10, 0]);
    expect(frostRow.totalStrength).toBe(34);
  });
});
