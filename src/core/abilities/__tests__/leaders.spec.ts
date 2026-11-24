import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  canUseLeader,
  createInitialGameState,
  dispatch,
  isPassiveLeaderActive,
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

describe('U6.1 Hearts of Stone 5th Leaders', () => {
  it('supports SCORCH_ENEMY_RANGED_10 when enemy Ranged >= 10 and ignores rows < 10', () => {
    const foltestRanged = byId('nr_leader_foltest_son_of_medell');
    let belowState = createLeaderMatch(foltestRanged);
    belowState = recalculateBoard({
      ...belowState,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...belowState.players.PLAYER_1,
          hand: [inst('p1_h', 'nr_ves')],
        },
        PLAYER_2: {
          ...belowState.players.PLAYER_2,
          hand: [inst('p2_h', 'nr_ves')],
          rows: {
            ...belowState.players.PLAYER_2.rows,
            RANGED: { cards: [inst('p2_alb', 'ng_albrich'), inst('p2_put', 'ng_puttkammer')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });

    belowState = dispatch(belowState, { type: 'USE_LEADER', playerId: 'PLAYER_1' });
    expect(belowState.players.PLAYER_2.rows.RANGED.cards.map((c) => c.instanceId)).toEqual(['p2_alb', 'p2_put']);
    expect(belowState.players.PLAYER_2.discard).toHaveLength(0);

    let scorchState = createLeaderMatch(foltestRanged);
    scorchState = recalculateBoard({
      ...scorchState,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...scorchState.players.PLAYER_1,
          hand: [inst('p1_h2', 'nr_ves')],
        },
        PLAYER_2: {
          ...scorchState.players.PLAYER_2,
          hand: [inst('p2_h2', 'nr_ves')],
          rows: {
            ...scorchState.players.PLAYER_2.rows,
            RANGED: {
              cards: [inst('p2_phil', 'nr_philippa_eilhart'), inst('p2_assire', 'ng_assire_var_anahid')], // 10 Hero + 6 = 16
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });

    scorchState = dispatch(scorchState, { type: 'USE_LEADER', playerId: 'PLAYER_1' });
    expect(scorchState.players.PLAYER_2.rows.RANGED.cards.map((c) => c.instanceId)).toEqual(['p2_phil']);
    expect(scorchState.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(['p2_assire']);
  });

  it('applies RANDOMIZE_REVIVES deterministically for both players unless cancelled by CANCEL_ENEMY_LEADER', () => {
    const emhyrInvader = byId('ng_leader_emhyr_invader');
    const emhyrCancel = byId('ng_leader_emhyr_white_flame');

    const setupWithEmhyr = (enemyLeader: CardDefinition | null, seed: number): GameState => {
      const base = createLeaderMatch(emhyrInvader, enemyLeader, seed);
      return recalculateBoard({
        ...base,
        activePlayer: 'PLAYER_2',
        players: {
          ...base.players,
          PLAYER_1: {
            ...base.players.PLAYER_1,
            hand: [inst('p1_hold', 'nr_ves')],
          },
          PLAYER_2: {
            ...base.players.PLAYER_2,
            hand: [inst('p2_medic', 'nr_dun_banner_medic')],
            discard: [
              inst('d_ves', 'nr_ves'),
              inst('d_ball', 'nr_ballista'),
              inst('d_cahir', 'ng_cahir'),
            ],
          },
        },
      });
    };

    const s1 = setupWithEmhyr(null, 42);
    expect(s1.players.PLAYER_1.leaderUsed).toBe(true);
    expect(canUseLeader(s1, 'PLAYER_1')).toBe(false);
    expect(isPassiveLeaderActive(s1, 'RANDOMIZE_REVIVES')).toBe(true);

    const afterMedicA = dispatch(s1, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_medic' });
    const afterMedicB = dispatch(setupWithEmhyr(null, 42), {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_medic',
    });

    expect(afterMedicA.phase).toBe('PLAYING');
    expect(afterMedicA.pendingSelection).toBeNull();
    expect(afterMedicA.players.PLAYER_2.discard).toHaveLength(2);
    expect(afterMedicA.rngSeed).not.toBe(s1.rngSeed);
    expect(afterMedicA.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(
      afterMedicB.players.PLAYER_2.discard.map((c) => c.instanceId),
    );

    const cancelled = setupWithEmhyr(emhyrCancel, 42);
    expect(isPassiveLeaderActive(cancelled, 'RANDOMIZE_REVIVES')).toBe(false);
    const afterCancelledMedic = dispatch(cancelled, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_medic',
    });
    expect(afterCancelledMedic.phase).toBe('PENDING_SELECTION');
    expect(afterCancelledMedic.pendingSelection?.type).toBe('MEDIC_DISCARD');
  });

  it('applies DOUBLE_SPY_STRENGTH on both sides, composes with weather/horn, and disables under CANCEL_ENEMY_LEADER', () => {
    const eredinSpy = byId('mo_leader_eredin_treacherous');
    const emhyrCancel = byId('ng_leader_emhyr_white_flame');

    let state = createLeaderMatch(eredinSpy, null, 99);
    expect(state.players.PLAYER_1.leaderUsed).toBe(true);
    expect(isPassiveLeaderActive(state, 'DOUBLE_SPY_STRENGTH')).toBe(true);

    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      weather: {
        frost: { card: inst('w_frost', 'sp_biting_frost'), owner: 'PLAYER_1' },
        fog: null,
        rain: null,
      },
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_spy', 'nr_prince_stennis'), inst('p1_elf', 'nt_mysterious_elf')],
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_shil', 'ng_shilard_fitz_oesterlen')], hornCard: null, totalStrength: 0 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_horn', 'sp_commanders_horn')],
          rows: {
            ...state.players.PLAYER_2.rows,
            RANGED: { cards: [inst('p2_stefan', 'ng_stefan_skellen')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });

    // Clear weather on Ranged: Stefan (9) * 2 = 18; Frost on Close: Shilard 1 * 2 = 2
    expect(state.players.PLAYER_2.rows.RANGED.cards[0]?.effectiveStrength).toBe(18);
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(2);

    // P1 plays Stennis (5) onto Frosted P2 Close -> 1 * 2 = 2; P2 plays Horn -> 2 * 2 = 4
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_spy' });
    expect(state.players.PLAYER_2.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(2);

    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_horn',
      targetRow: 'CLOSE_COMBAT',
    });
    expect(state.players.PLAYER_2.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(4);

    // Hero Spy remains 0
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_elf' });
    const elfOnP2 = state.players.PLAYER_2.rows.CLOSE_COMBAT.cards.find((c) => c.instanceId === 'p1_elf');
    expect(elfOnP2?.effectiveStrength).toBe(0);

    // Under CANCEL_ENEMY_LEADER, Spies revert to normal strength
    let cancelled = createLeaderMatch(eredinSpy, emhyrCancel, 99);
    expect(isPassiveLeaderActive(cancelled, 'DOUBLE_SPY_STRENGTH')).toBe(false);
    cancelled = recalculateBoard({
      ...cancelled,
      players: {
        ...cancelled.players,
        PLAYER_2: {
          ...cancelled.players.PLAYER_2,
          rows: {
            ...cancelled.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('p1_stennis_norm', 'nr_prince_stennis')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });
    expect(cancelled.players.PLAYER_2.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(5);
  });

  it('optimizes non-Hero Agile row placements with OPTIMIZE_AGILE_ROWS without moving optimal or Hero units', () => {
    const hopeLeader = byId('st_leader_francesca_hope');
    let emptyBoard = createLeaderMatch(hopeLeader, null, 7);
    emptyBoard = { ...emptyBoard, phase: 'PLAYING', pendingSelection: null, activePlayer: 'PLAYER_1' };
    expect(canUseLeader(emptyBoard, 'PLAYER_1')).toBe(false);

    let state = recalculateBoard({
      ...emptyBoard,
      weather: {
        frost: { card: inst('w_frost', 'sp_biting_frost'), owner: 'PLAYER_2' },
        fog: null,
        rain: null,
      },
      players: {
        PLAYER_1: {
          ...emptyBoard.players.PLAYER_1,
          hand: [inst('p1_h', 'nr_ves')],
          rows: {
            CLOSE_COMBAT: {
              cards: [
                inst('ag_scout', 'st_dol_blathanna_scout'), // 6 Agile -> currently 1 in Frost
                inst('ag_harpy', 'mo_harpy'), // 2 Agile -> currently 1 in Frost
                inst('hero_kayran', 'mo_kayran'), // 8 Hero Agile -> stays in Close
              ],
              hornCard: null,
              totalStrength: 0,
            },
            RANGED: {
              cards: [inst('ag_opt', 'st_vrihedd_brigade')], // 5 Agile -> already 10 with Horn
              hornCard: inst('ranged_horn', 'sp_commanders_horn'),
              totalStrength: 0,
            },
            SIEGE: { cards: [], hornCard: null, totalStrength: 0 },
          },
        },
        PLAYER_2: {
          ...emptyBoard.players.PLAYER_2,
          hand: [inst('p2_h', 'nr_ves')],
        },
      },
    });

    expect(canUseLeader(state, 'PLAYER_1')).toBe(true);
    expect(state.players.PLAYER_1.totalScore).toBe(20); // 10 (Close) + 10 (Ranged)

    state = dispatch(state, { type: 'USE_LEADER', playerId: 'PLAYER_1' });

    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['hero_kayran']);
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual([
      'ag_opt',
      'ag_scout',
      'ag_harpy',
    ]);
    // 8 (Kayran) + (5 + 6 + 2) * 2 = 8 + 26 = 34
    expect(state.players.PLAYER_1.totalScore).toBe(34);
  });
});
