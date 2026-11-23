import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createInitialGameState,
  dispatch,
  getOpponentId,
  type CardDefinition,
  type GameState,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function createTestMatch(seed = 12345, leader1: CardDefinition | null = null): GameState {
  const deck1 = decks[0]!;
  const deck2 = decks[1]!;

  return createInitialGameState({
    rngSeed: seed,
    catalog,
    player1: {
      name: 'Reinos del Norte',
      faction: deck1.faction,
      leader: leader1,
      deckCardIds: deck1.cardIds,
    },
    player2: {
      name: 'Nilfgaard',
      faction: deck2.faction,
      leader: null,
      deckCardIds: deck2.cardIds,
    },
  });
}

describe('Match State Machine & Round Flow (F2.3)', () => {
  it('deals 10 cards, assigns 2 gems, and flips a deterministic starting coin for Round 1', () => {
    const stateA = createTestMatch(777);
    const stateB = createTestMatch(777);

    expect(stateA).toEqual(stateB);
    expect(stateA.phase).toBe('PLAYING');
    expect(stateA.roundNumber).toBe(1);
    expect(stateA.players.PLAYER_1.hand).toHaveLength(10);
    expect(stateA.players.PLAYER_2.hand).toHaveLength(10);
    expect(stateA.players.PLAYER_1.deck).toHaveLength(21);
    expect(stateA.players.PLAYER_2.deck).toHaveLength(21);
    expect(stateA.players.PLAYER_1.gems).toBe(2);
    expect(stateA.players.PLAYER_2.gems).toBe(2);
    expect(['PLAYER_1', 'PLAYER_2']).toContain(stateA.activePlayer);
  });

  it('tracks weather owners, clears all weather to owners discards, and handles idempotent repeats', () => {
    const frostDef = catalog.find((c) => c.ability === 'WEATHER_FROST')!;
    const fogDef = catalog.find((c) => c.ability === 'WEATHER_FOG')!;
    const clearDef = catalog.find((c) => c.ability === 'WEATHER_CLEAR')!;
    const unitDef = catalog.find((c) => c.id === 'nr_ves')!;

    let state = createTestMatch(1);
    // Inject deterministic hands for test precision
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            { instanceId: 'p1_frost1', definitionId: frostDef.id, card: frostDef, effectiveStrength: 0 },
            { instanceId: 'p1_clear', definitionId: clearDef.id, card: clearDef, effectiveStrength: 0 },
            { instanceId: 'p1_unit', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 },
          ],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [
            { instanceId: 'p2_frost2', definitionId: frostDef.id, card: frostDef, effectiveStrength: 0 },
            { instanceId: 'p2_fog', definitionId: fogDef.id, card: fogDef, effectiveStrength: 0 },
          ],
        },
      },
    };

    // P1 plays Frost
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_frost1' });
    expect(state.weather.frost?.owner).toBe('PLAYER_1');

    // P2 plays duplicate Frost -> slot remains P1's, P2's duplicate goes to P2 discard
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_frost2' });
    expect(state.weather.frost?.card.instanceId).toBe('p1_frost1');
    expect(state.players.PLAYER_2.discard.map((c) => c.instanceId)).toContain('p2_frost2');

    // P1 plays unit under Frost -> effectiveStrength is 1
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_unit' });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.totalStrength).toBe(1);

    // P2 plays Fog
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_fog' });
    expect(state.weather.fog?.owner).toBe('PLAYER_2');

    // P1 plays Clear Weather -> Frost returns to P1 discard, Fog to P2 discard, Clear to P1 discard, unit restores to 5
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_clear' });
    expect(state.weather).toEqual({ frost: null, fog: null, rain: null });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.totalStrength).toBe(5);
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_frost1', 'p1_clear']);
    expect(state.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(['p2_frost2', 'p2_fog']);
  });

  it('allows Commander Horn on an empty row, blocks occupied horn slot, and moves hornCard to discard at round end', () => {
    const hornDef = catalog.find((c) => c.type === 'SPECIAL' && c.ability === 'COMMANDERS_HORN')!;
    const unitDef = catalog.find((c) => c.id === 'nr_ves')!;

    let state = createTestMatch(2);
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            { instanceId: 'p1_horn1', definitionId: hornDef.id, card: hornDef, effectiveStrength: 0 },
            { instanceId: 'p1_horn2', definitionId: hornDef.id, card: hornDef, effectiveStrength: 0 },
            { instanceId: 'p1_unit', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 },
          ],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [{ instanceId: 'p2_unit', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 }],
        },
      },
    };

    // Play Horn on empty CLOSE_COMBAT row -> allowed
    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_horn1',
      targetRow: 'CLOSE_COMBAT',
    });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.hornCard?.instanceId).toBe('p1_horn1');

    // P2 passes
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });

    // P1 tries to play second Horn on same row -> rejected (state unchanged)
    const blocked = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_horn2',
      targetRow: 'CLOSE_COMBAT',
    });
    expect(blocked).toBe(state);

    // P1 plays unit on doubled empty row -> immediately 10
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_unit' });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.totalStrength).toBe(10);

    // P1 passes -> ROUND_END -> ADVANCE_ROUND moves both unit and hornCard to P1 discard
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    expect(state.phase).toBe('ROUND_END');
    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.phase).toBe('PLAYING');
    expect(state.roundNumber).toBe(2);
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.hornCard).toBeNull();
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_unit', 'p1_horn1']);
    expect(state.activePlayer).toBe('PLAYER_1'); // Winner of R1 starts R2
  });

  it('auto-passes at 0 hand cards when no unused leader exists, but does NOT auto-pass when unused leader exists', () => {
    const unitDef = catalog.find((c) => c.id === 'nr_ves')!;
    const mockLeader: CardDefinition = {
      id: 'leader_test',
      name: 'Foltest Test',
      faction: 'NORTHERN_REALMS',
      type: 'LEADER',
      baseStrength: 0,
      isHero: false,
      allowedRows: [],
      ability: null,
      leaderAbility: 'TEST_LEADER',
      maxCopies: 1,
      description: 'Test leader',
    };

    // Case A: leader is null -> auto-passes immediately after last hand card
    let stateNoLeader = createTestMatch(3, null);
    stateNoLeader = {
      ...stateNoLeader,
      activePlayer: 'PLAYER_1',
      players: {
        ...stateNoLeader.players,
        PLAYER_1: {
          ...stateNoLeader.players.PLAYER_1,
          hand: [{ instanceId: 'p1_last', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 }],
        },
        PLAYER_2: {
          ...stateNoLeader.players.PLAYER_2,
          hand: [{ instanceId: 'p2_hold', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 }],
        },
      },
    };
    stateNoLeader = dispatch(stateNoLeader, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_last',
    });
    expect(stateNoLeader.players.PLAYER_1.hand).toHaveLength(0);
    expect(stateNoLeader.players.PLAYER_1.passed).toBe(true);

    // Case B: unused leader exists -> does NOT auto-pass with 0 cards
    let stateWithLeader = createTestMatch(3, mockLeader);
    stateWithLeader = {
      ...stateWithLeader,
      activePlayer: 'PLAYER_1',
      players: {
        ...stateWithLeader.players,
        PLAYER_1: {
          ...stateWithLeader.players.PLAYER_1,
          hand: [{ instanceId: 'p1_last', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 }],
        },
        PLAYER_2: {
          ...stateWithLeader.players.PLAYER_2,
          hand: [{ instanceId: 'p2_hold', definitionId: unitDef.id, card: unitDef, effectiveStrength: 5 }],
        },
      },
    };
    stateWithLeader = dispatch(stateWithLeader, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_last',
    });
    expect(stateWithLeader.players.PLAYER_1.hand).toHaveLength(0);
    expect(stateWithLeader.players.PLAYER_1.passed).toBe(false);
  });

  it('plays a complete 3-round match without auto-drawing between rounds and handles draw gem loss & match end', () => {
    const unit5 = catalog.find((c) => c.id === 'nr_ves')!;
    const unit6 = catalog.find((c) => c.id === 'nr_ballista')!;

    let state = createTestMatch(99);
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            { instanceId: 'p1_a', definitionId: unit5.id, card: unit5, effectiveStrength: 5 },
            { instanceId: 'p1_b', definitionId: unit6.id, card: unit6, effectiveStrength: 6 },
          ],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [
            { instanceId: 'p2_a', definitionId: unit5.id, card: unit5, effectiveStrength: 5 },
            { instanceId: 'p2_b', definitionId: unit5.id, card: unit5, effectiveStrength: 5 },
          ],
        },
      },
    };

    // Round 1: Both pass at 0-0 (DRAW -> both lose 1 gem -> gems 1 vs 1)
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(state.phase).toBe('ROUND_END');
    expect(state.players.PLAYER_1.gems).toBe(1);
    expect(state.players.PLAYER_2.gems).toBe(1);
    expect(state.roundHistory[0]?.winner).toBe('DRAW');

    // Advance to Round 2: hands are NOT refilled; starter resolved deterministically via rngSeed
    const handCountP1Before = state.players.PLAYER_1.hand.length;
    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.roundNumber).toBe(2);
    expect(state.players.PLAYER_1.hand).toHaveLength(handCountP1Before);

    const starter = state.activePlayer;
    const second = getOpponentId(starter);
    // Starter plays a card, second passes, starter passes -> starter wins R2 -> loser hits 0 gems -> MATCH_END
    const starterCard = state.players[starter].hand[0]!;
    state = dispatch(state, { type: 'PLAY_CARD', playerId: starter, instanceId: starterCard.instanceId });
    state = dispatch(state, { type: 'PASS_TURN', playerId: second });
    state = dispatch(state, { type: 'PASS_TURN', playerId: starter });

    expect(state.phase).toBe('MATCH_END');
    expect(state.winner).toBe(starter);
    expect(state.players[second].gems).toBe(0);
    expect(state.players[starter].gems).toBe(1);
  });
});
