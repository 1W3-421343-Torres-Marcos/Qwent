import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  canUseLeader,
  createInitialGameState,
  dispatch,
  recalculateBoard,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type LeaderAbilityType,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function byId(id: string): CardDefinition {
  const found = catalog.find((c) => c.id === id);
  if (!found) throw new Error(`Missing test card: ${id}`);
  return found;
}

function inst(instanceId: string, cardId: string): CardInstance {
  const card = byId(cardId);
  return {
    instanceId,
    definitionId: card.id,
    card,
    effectiveStrength: card.baseStrength,
  };
}

function makeLeader(
  id: string,
  faction: Exclude<CardDefinition['faction'], 'NEUTRAL'>,
  leaderAbility: LeaderAbilityType,
): CardDefinition {
  return {
    id,
    name: `Leader ${leaderAbility}`,
    faction,
    type: 'LEADER',
    baseStrength: 0,
    isHero: false,
    allowedRows: [],
    ability: null,
    leaderAbility,
    maxCopies: 1,
    description: leaderAbility,
  };
}

function createLeaderMatch(
  leader1: CardDefinition | null,
  leader2: CardDefinition | null = null,
  seed = 123,
): GameState {
  const deckA = decks[0]!;
  return createInitialGameState({
    rngSeed: seed,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'P1',
      faction: leader1 ? leader1.faction : 'NORTHERN_REALMS',
      leader: leader1,
      deckCardIds: deckA.cardIds,
    },
    player2: {
      name: 'P2',
      faction: leader2 ? leader2.faction : 'NILFGAARD',
      leader: leader2,
      deckCardIds: deckA.cardIds,
    },
  });
}

describe('F5.1 Leader Abilities', () => {
  it('allows leader use once per match, refuses duplicate uses, and preserves no auto-pass with 0 cards until leader is used', () => {
    const foltestHorn = makeLeader('l_horn', 'NORTHERN_REALMS', 'HORN_SIEGE_LEADER');
    let state = createLeaderMatch(foltestHorn);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_ballista', 'nr_ballista')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'nr_ves')],
        },
      },
    });

    // Play last hand card -> 0 cards left, unused leader exists -> does NOT auto-pass
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_ballista' });
    expect(state.players.PLAYER_1.hand).toHaveLength(0);
    expect(state.players.PLAYER_1.passed).toBe(false);

    // P2 passes, now P1 activates HORN_SIEGE_LEADER -> Ballista doubles 6 -> 12, then P1 auto-passes
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(canUseLeader(state, 'PLAYER_1')).toBe(true);
    state = dispatch(state, { type: 'USE_LEADER', playerId: 'PLAYER_1' });

    expect(state.phase).toBe('ROUND_END');
    expect(state.players.PLAYER_1.leaderUsed).toBe(true);
    expect(state.players.PLAYER_1.totalScore).toBe(12);

    // Advance to R2: synthetic leader horn did not enter discard, and leader remains used
    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_ballista']);
    expect(canUseLeader(state, 'PLAYER_1')).toBe(false);
    expect(dispatch(state, { type: 'USE_LEADER', playerId: 'PLAYER_1' })).toBe(state);
  });

  it('plays weather from deck and clears active weather cleanly to owners discards', () => {
    const frostLeader = makeLeader('l_frost', 'MONSTERS', 'PLAY_FROST_FROM_DECK');
    const clearLeader = makeLeader('l_clear', 'NORTHERN_REALMS', 'CLEAR_WEATHER_LEADER');

    let state = createLeaderMatch(frostLeader, clearLeader);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_h', 'nr_ves')],
          deck: [inst('p1_frost_deck', 'sp_biting_frost')],
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_u', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_h', 'nr_ves')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [inst('p2_u', 'ng_black_infantry_archer')],
              hornCard: null,
              totalStrength: 10,
            },
          },
        },
      },
    });

    state = dispatch(state, { type: 'USE_LEADER', playerId: 'PLAYER_1' });
    expect(state.weather.frost?.card.instanceId).toBe('p1_frost_deck');
    expect(state.weather.frost?.owner).toBe('PLAYER_1');
    expect(state.players.PLAYER_1.deck).toHaveLength(0);
    expect(state.players.PLAYER_2.totalScore).toBe(1);

    state = dispatch(state, { type: 'USE_LEADER', playerId: 'PLAYER_2' });
    expect(state.weather).toEqual({ frost: null, fog: null, rain: null });
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_frost_deck']);
    expect(state.players.PLAYER_2.totalScore).toBe(10);
  });

  it('supports SCORCH_ENEMY_CLOSE_10 and discard-to-hand LEADER_TARGET (own & opponent)', () => {
    const scorchLeader = makeLeader('l_scorch', 'NORTHERN_REALMS', 'SCORCH_ENEMY_CLOSE_10');
    const stealLeader = makeLeader('l_steal', 'NILFGAARD', 'STEAL_ENEMY_DISCARD_TO_HAND');

    let state = createLeaderMatch(scorchLeader, stealLeader);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_h', 'nr_ves')],
          discard: [inst('p1_hero_disc', 'nt_geralt_of_rivia')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_h', 'nr_ves')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [inst('p2_strong', 'nr_esterad_thyssen'), inst('p2_cahir', 'ng_cahir')], // 10 Hero + 6 = 16
              hornCard: null,
              totalStrength: 16,
            },
          },
        },
      },
    });

    // Enemy Close is 16 >= 10, destroys highest non-Hero (Cahir 6) while keeping Hero (10)
    state = dispatch(state, { type: 'USE_LEADER', playerId: 'PLAYER_1' });
    expect(state.players.PLAYER_2.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['p2_strong']);
    expect(state.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(['p2_cahir']);

    // Now simulate STEAL_ENEMY_DISCARD_TO_HAND ignoring Hero in P1 discard
    const reviveLeader = makeLeader('l_revive', 'NILFGAARD', 'REVIVE_OWN_DISCARD_TO_HAND');
    let targetState: GameState = {
      ...state,
      activePlayer: 'PLAYER_2',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          discard: [inst('p1_hero', 'nt_geralt_of_rivia'), inst('p1_spy', 'nr_prince_stennis')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          leader: stealLeader,
          leaderUsed: false,
          discard: [inst('p2_unit_own', 'ng_cahir')],
        },
      },
    };

    targetState = dispatch(targetState, { type: 'USE_LEADER', playerId: 'PLAYER_2' });
    expect(targetState.phase).toBe('PENDING_SELECTION');
    expect(targetState.pendingSelection).toEqual({
      type: 'LEADER_TARGET',
      playerId: 'PLAYER_2',
      leaderAbility: 'STEAL_ENEMY_DISCARD_TO_HAND',
      source: 'OPPONENT_DISCARD',
      eligibleInstanceIds: ['p1_spy'],
    });

    targetState = dispatch(targetState, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      targetInstanceId: 'p1_spy',
    });
    expect(targetState.phase).toBe('PLAYING');
    expect(targetState.activePlayer).toBe('PLAYER_1');
    expect(targetState.players.PLAYER_2.hand.map((c) => c.instanceId)).toContain('p1_spy');
    expect(targetState.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_hero']);

    // Verify REVIVE_OWN_DISCARD_TO_HAND preserves both hand and discard when source === playerId
    let ownReviveState: GameState = {
      ...targetState,
      activePlayer: 'PLAYER_2',
      players: {
        ...targetState.players,
        PLAYER_2: {
          ...targetState.players.PLAYER_2,
          leader: reviveLeader,
          leaderUsed: false,
        },
      },
    };
    ownReviveState = dispatch(ownReviveState, { type: 'USE_LEADER', playerId: 'PLAYER_2' });
    ownReviveState = dispatch(ownReviveState, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      targetInstanceId: 'p2_unit_own',
    });
    expect(ownReviveState.players.PLAYER_2.discard).toHaveLength(0);
    expect(ownReviveState.players.PLAYER_2.hand.map((c) => c.instanceId)).toContain('p2_unit_own');
  });

  it('applies DRAW_EXTRA_CARD_START at match start and CANCEL_ENEMY_LEADER blocks enemy active and start passives', () => {
    const drawStartLeader = makeLeader('l_daisy', 'NORTHERN_REALMS', 'DRAW_EXTRA_CARD_START');
    const cancelLeader = makeLeader('l_cancel', 'NILFGAARD', 'CANCEL_ENEMY_LEADER');

    const withDraw = createLeaderMatch(drawStartLeader, null, 5);
    expect(withDraw.players.PLAYER_1.hand).toHaveLength(11);
    expect(withDraw.players.PLAYER_1.deck).toHaveLength(20);
    expect(withDraw.players.PLAYER_1.leaderUsed).toBe(true);

    const cancelled = createLeaderMatch(drawStartLeader, cancelLeader, 5);
    expect(cancelled.players.PLAYER_1.hand).toHaveLength(10);
    expect(cancelled.players.PLAYER_1.leaderUsed).toBe(true);
    expect(cancelled.players.PLAYER_2.leaderUsed).toBe(true);
  });
});
