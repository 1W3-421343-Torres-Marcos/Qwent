import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createAIView,
  createInitialGameState,
  decideAction,
  recalculateBoard,
  type CardDefinition,
  type CardInstance,
  type GameState,
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

function baseMatch(seed = 88): GameState {
  return createInitialGameState({
    rngSeed: seed,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'Humano Norte',
      faction: decks[0]!.faction,
      leader: null,
      deckCardIds: decks[0]!.cardIds,
    },
    player2: {
      name: 'IA Nilfgaard',
      faction: decks[1]!.faction,
      leader: null,
      deckCardIds: decks[1]!.cardIds,
    },
  });
}

describe('AIPlayerView & Bot Heuristics (F4.2)', () => {
  it('createAIView hides opponent hand, opponent deck cards, and real bot draw order', () => {
    const state = baseMatch(123);
    const view = createAIView(state, 'PLAYER_2');

    expect(view.opponent.handCount).toBe(state.players.PLAYER_1.hand.length);
    expect(view.opponent.deckCount).toBe(state.players.PLAYER_1.deck.length);
    expect('hand' in view.opponent).toBe(false);
    expect('deck' in view.opponent).toBe(false);
    expect('rngSeed' in view).toBe(false);

    const realDeckOrder = state.players.PLAYER_2.deck.map((c) => c.definitionId);
    expect(view.me.myDeckCount).toBe(realDeckOrder.length);
    expect(view.me.myDeckCardIds).toEqual([...realDeckOrder].sort());
    expect(view.me.myDeckCardIds).not.toEqual(realDeckOrder);
  });

  it('passes immediately in R1 when opponent passed and bot is ahead or tied as Nilfgaard', () => {
    let state = baseMatch();
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_2',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          faction: 'NORTHERN_REALMS',
          passed: true,
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_c', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          faction: 'NILFGAARD',
          hand: [inst('bot_cahir', 'ng_cahir')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('bot_u', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
      },
    });

    // Tied 5 vs 5, Nilfgaard bot wins tie -> passes immediately without wasting Cahir
    const action = decideAction(createAIView(state, 'PLAYER_2'));
    expect(action).toEqual({ type: 'PASS_TURN', playerId: 'PLAYER_2' });
  });

  it('does NOT pass on a tie when opponent is Nilfgaard and tries to win when ahead is reachable', () => {
    let state = baseMatch();
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_2',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          faction: 'NILFGAARD',
          passed: true,
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_c', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          faction: 'NORTHERN_REALMS',
          hand: [inst('bot_cahir', 'ng_cahir')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('bot_u', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
      },
    });

    // Tied 5 vs 5, opponent is Nilfgaard (opponent wins tie) -> bot plays Cahir to take lead 11 vs 5
    const action = decideAction(createAIView(state, 'PLAYER_2'));
    expect(action).toEqual({
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'bot_cahir',
      targetRow: 'CLOSE_COMBAT',
    });
  });

  it('avoids suicidal Scorch and self-damaging Weather, prioritizing Spy for card advantage', () => {
    let state = baseMatch();
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_2',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_ves', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [
            inst('bot_scorch', 'sp_scorch'), // Would burn bot's own 10 archer!
            inst('bot_frost', 'sp_biting_frost'), // Bot has 6 in Close Combat vs P1 5 -> hurts bot more!
            inst('bot_spy', 'ng_stefan_skellen'), // Draws 2 cards -> strong R1 play
          ],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('bot_cahir', 'ng_cahir')], hornCard: null, totalStrength: 6 },
            RANGED: {
              cards: [inst('bot_archer', 'ng_black_infantry_archer')],
              hornCard: null,
              totalStrength: 10,
            },
          },
        },
      },
    });

    const action = decideAction(createAIView(state, 'PLAYER_2'));
    expect(action).toEqual({
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'bot_spy',
      targetRow: 'CLOSE_COMBAT',
    });
  });

  it('handles MULLIGAN swaps (excess Muster copies) and PENDING_SELECTION (MEDIC_DISCARD & AGILE_ROW)', () => {
    const mulliganState = createInitialGameState({
      rngSeed: 10,
      catalog,
      player1: { name: 'P1', faction: 'NORTHERN_REALMS', deckCardIds: decks[0]!.cardIds },
      player2: { name: 'Bot', faction: 'NILFGAARD', deckCardIds: decks[1]!.cardIds },
    });
    const customMulligan: GameState = {
      ...mulliganState,
      activePlayer: 'PLAYER_2',
      players: {
        ...mulliganState.players,
        PLAYER_2: {
          ...mulliganState.players.PLAYER_2,
          hand: [
            inst('m1', 'nt_gaunter_darkness'),
            inst('m2', 'nt_gaunter_darkness'),
            inst('m3', 'nt_geralt_of_rivia'),
          ],
        },
      },
    };
    const swapAction = decideAction(createAIView(customMulligan, 'PLAYER_2'));
    expect(swapAction).toEqual({
      type: 'MULLIGAN_SWAP',
      playerId: 'PLAYER_2',
      instanceId: 'm1',
    });

    // MEDIC_DISCARD picks Spy over weak unit
    let medicState = baseMatch();
    medicState = {
      ...medicState,
      phase: 'PENDING_SELECTION',
      activePlayer: 'PLAYER_2',
      pendingSelection: {
        type: 'MEDIC_DISCARD',
        playerId: 'PLAYER_2',
        eligibleInstanceIds: ['disc_weak', 'disc_spy'],
      },
      players: {
        ...medicState.players,
        PLAYER_2: {
          ...medicState.players.PLAYER_2,
          discard: [inst('disc_weak', 'ng_nausicaa_cavalry'), inst('disc_spy', 'ng_stefan_skellen')],
        },
      },
    };
    expect(decideAction(createAIView(medicState, 'PLAYER_2'))).toEqual({
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      targetInstanceId: 'disc_spy',
    });

    // AGILE_ROW avoids frosted CLOSE_COMBAT and chooses RANGED
    let agileState = baseMatch();
    const agileUnit = inst('rev_olgierd', 'nt_olgierd_von_everec');
    agileState = {
      ...agileState,
      phase: 'PENDING_SELECTION',
      activePlayer: 'PLAYER_2',
      weather: { frost: { card: inst('w_f', 'sp_biting_frost'), owner: 'PLAYER_1' }, fog: null, rain: null },
      pendingSelection: {
        type: 'AGILE_ROW',
        playerId: 'PLAYER_2',
        instanceId: agileUnit.instanceId,
        card: agileUnit,
        allowedRows: agileUnit.card.allowedRows,
      },
    };
    expect(decideAction(createAIView(agileState, 'PLAYER_2'))).toEqual({
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      targetRow: 'RANGED',
    });
  });

  it('handles SCOIATAEL_START_CHOICE, LEADER_TARGET, and USE_LEADER tactics', () => {
    // 1. Scoia'tael bot yields Round 1 start to opponent for card advantage
    const stState = createInitialGameState({
      rngSeed: 12,
      catalog,
      skipMulligan: true,
      player1: { name: 'P1', faction: 'NORTHERN_REALMS', deckCardIds: decks[0]!.cardIds },
      player2: { name: 'BotST', faction: 'SCOIATAEL', deckCardIds: decks[0]!.cardIds },
    });
    expect(stState.phase).toBe('PENDING_SELECTION');
    expect(decideAction(createAIView(stState, 'PLAYER_2'))).toEqual({
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      startingPlayer: 'PLAYER_1',
    });

    // 2. LEADER_TARGET chooses Spy from discard
    const emhyrSteal: CardDefinition = {
      id: 'leader_emhyr_steal',
      name: 'Emhyr',
      faction: 'NILFGAARD',
      type: 'LEADER',
      baseStrength: 0,
      isHero: false,
      allowedRows: [],
      ability: null,
      leaderAbility: 'STEAL_ENEMY_DISCARD_TO_HAND',
      maxCopies: 1,
      description: 'Steal',
    };
    const leaderTargetState: GameState = {
      ...baseMatch(),
      phase: 'PENDING_SELECTION',
      activePlayer: 'PLAYER_2',
      pendingSelection: {
        type: 'LEADER_TARGET',
        playerId: 'PLAYER_2',
        leaderAbility: 'STEAL_ENEMY_DISCARD_TO_HAND',
        source: 'OPPONENT_DISCARD',
        eligibleInstanceIds: ['p1_unit', 'p1_spy'],
      },
      players: {
        ...baseMatch().players,
        PLAYER_1: {
          ...baseMatch().players.PLAYER_1,
          discard: [inst('p1_unit', 'nr_ves'), inst('p1_spy', 'nr_prince_stennis')],
        },
        PLAYER_2: {
          ...baseMatch().players.PLAYER_2,
          leader: emhyrSteal,
          leaderUsed: true,
        },
      },
    };
    expect(decideAction(createAIView(leaderTargetState, 'PLAYER_2'))).toEqual({
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      targetInstanceId: 'p1_spy',
    });

    // 3. USE_LEADER chosen when horn doubles a stacked Siege row strongly
    const foltestHorn: CardDefinition = {
      id: 'leader_foltest_siege',
      name: 'Foltest Siege',
      faction: 'NORTHERN_REALMS',
      type: 'LEADER',
      baseStrength: 0,
      isHero: false,
      allowedRows: [],
      ability: null,
      leaderAbility: 'HORN_SIEGE_LEADER',
      maxCopies: 1,
      description: 'Double Siege',
    };
    let useLeaderState = baseMatch();
    useLeaderState = recalculateBoard({
      ...useLeaderState,
      activePlayer: 'PLAYER_2',
      players: {
        ...useLeaderState.players,
        PLAYER_2: {
          ...useLeaderState.players.PLAYER_2,
          leader: foltestHorn,
          leaderUsed: false,
          hand: [inst('p2_small', 'nr_ves')],
          rows: {
            ...useLeaderState.players.PLAYER_2.rows,
            SIEGE: {
              cards: [inst('s1', 'nr_ballista'), inst('s2', 'nr_trebuchet')],
              hornCard: null,
              totalStrength: 12,
            },
          },
        },
      },
    });
    expect(decideAction(createAIView(useLeaderState, 'PLAYER_2'))).toEqual({
      type: 'USE_LEADER',
      playerId: 'PLAYER_2',
    });
  });

  it('differentiates NOVICE, TAVERNER, and MASTER difficulties and handles Skellige Mardroeme/Storm/Crach tactics', () => {
    const skStarter = decks.find((d) => d.faction === 'SKELLIGE')!;
    const skMatch = createInitialGameState({
      rngSeed: 321,
      catalog,
      skipMulligan: true,
      player1: { name: 'P1', faction: 'NORTHERN_REALMS', deckCardIds: decks[0]!.cardIds },
      player2: {
        name: 'BotSK',
        faction: 'SKELLIGE',
        leader: catalog.find((c) => c.id === 'sk_leader_crach_an_craite') ?? null,
        deckCardIds: skStarter.cardIds,
      },
    });

    // 1. MASTER swaps nt_roach during Mulligan, while NOVICE skips weak/Roach swaps when at <=1 swap
    const mulliganViewState: GameState = {
      ...skMatch,
      phase: 'MULLIGAN',
      activePlayer: 'PLAYER_2',
      players: {
        ...skMatch.players,
        PLAYER_2: {
          ...skMatch.players.PLAYER_2,
          mulligansRemaining: 1,
          mulliganDone: false,
          hand: [inst('p2_roach', 'nt_roach'), inst('p2_ger', 'nt_geralt_of_rivia')],
        },
      },
    };
    const mulliganView = createAIView(mulliganViewState, 'PLAYER_2');
    expect(decideAction(mulliganView, 'NOVICE')).toEqual({
      type: 'FINISH_MULLIGAN',
      playerId: 'PLAYER_2',
    });
    expect(decideAction(mulliganView, 'MASTER')).toEqual({
      type: 'MULLIGAN_SWAP',
      playerId: 'PLAYER_2',
      instanceId: 'p2_roach',
    });

    // 2. Bot prioritizes Mardroeme on Close row with Berserker present
    const mardroemeState = recalculateBoard({
      ...skMatch,
      activePlayer: 'PLAYER_2',
      players: {
        ...skMatch.players,
        PLAYER_2: {
          ...skMatch.players.PLAYER_2,
          hand: [inst('p2_mard', 'sk_mardroeme'), inst('p2_vanilla', 'sk_donar_an_hindar')],
          rows: {
            ...skMatch.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('p2_bers', 'sk_berserker')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });
    expect(decideAction(createAIView(mardroemeState, 'PLAYER_2'), 'MASTER')).toEqual({
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_mard',
      targetRow: 'CLOSE_COMBAT',
    });

    // 3. NOVICE picks a suboptimal legal action when multiple positive plays exist
    const multiPlayState = recalculateBoard({
      ...skMatch,
      roundNumber: 1,
      activePlayer: 'PLAYER_2',
      players: {
        PLAYER_1: {
          ...skMatch.players.PLAYER_1,
          hand: [inst('p1_a', 'nr_ves'), inst('p1_b', 'nr_ballista'), inst('p1_c', 'nr_catapult')],
        },
        PLAYER_2: {
          ...skMatch.players.PLAYER_2,
          hand: [
            inst('p2_hero', 'nt_geralt_of_rivia'),
            inst('p2_mid', 'sk_blueboy_lugos'),
            inst('p2_small', 'sk_udalryk'),
          ],
        },
      },
    });
    const multiView = createAIView(multiPlayState, 'PLAYER_2');
    const masterAction = decideAction(multiView, 'MASTER');
    const noviceAction = decideAction(multiView, 'NOVICE');
    expect(masterAction).toEqual({
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_hero',
      targetRow: 'CLOSE_COMBAT',
    });
    expect(noviceAction.type).toBe('PLAY_CARD');
    expect(noviceAction).not.toEqual(masterAction);
  });
});
