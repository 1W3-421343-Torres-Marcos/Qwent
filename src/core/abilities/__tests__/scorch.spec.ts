import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  canPlayCard,
  createInitialGameState,
  dispatch,
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

function baseMatch(seed = 77): GameState {
  return createInitialGameState({
    rngSeed: seed,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'Norte',
      faction: decks[0]!.faction,
      leader: null,
      deckCardIds: decks[0]!.cardIds,
    },
    player2: {
      name: 'Nilfgaard',
      faction: decks[1]!.faction,
      leader: null,
      deckCardIds: decks[1]!.cardIds,
    },
  });
}

describe('F3.3 Scorch & Scorch Row Edge Cases', () => {
  it('SCORCH global evaluates effective strength across both sides, destroys all ties (including own), ignores Heroes/Decoys, and recalculates', () => {
    let state = baseMatch();
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_scorch', 'sp_scorch')],
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: {
              cards: [
                inst('p1_geralt', 'nt_geralt_of_rivia'), // 15 Hero (immune)
                inst('p1_ves', 'nr_ves'), // 5 -> Horned to 10 (tied max!)
                inst('p1_decoy', 'sp_decoy'), // 0 Decoy (immune)
              ],
              hornCard: inst('p1_horn', 'sp_commanders_horn'),
              totalStrength: 0,
            },
            SIEGE: {
              cards: [
                inst('p1_expert', 'nr_kaedweni_siege_expert'), // 1 Morale
                inst('p1_ballista', 'nr_ballista'), // 6 + 1 Morale = 7
              ],
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
          rows: {
            ...state.players.PLAYER_2.rows,
            RANGED: {
              cards: [
                inst('p2_archer', 'ng_black_infantry_archer'), // 10 (tied max!)
                inst('p2_tibor', 'ng_tibor_eggebracht'), // 10 Hero (immune)
              ],
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });

    expect(state.players.PLAYER_1.totalScore).toBe(15 + 10 + 0 + 1 + 7); // 33
    expect(state.players.PLAYER_2.totalScore).toBe(20);

    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_scorch',
    });

    // Both Ves (10 on P1) and Black Infantry Archer (10 on P2) destroyed to their own side's discards;
    // Scorch goes to P1's discard; Geralt (15 Hero), Tibor (10 Hero), and Decoy remain untouched.
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual([
      'p1_geralt',
      'p1_decoy',
    ]);
    expect(state.players.PLAYER_2.rows.RANGED.cards.map((c) => c.instanceId)).toEqual(['p2_tibor']);
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_scorch', 'p1_ves']);
    expect(state.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(['p2_archer']);
    expect(state.players.PLAYER_1.totalScore).toBe(15 + 1 + 7);
    expect(state.players.PLAYER_2.totalScore).toBe(10);
  });

  it('SCORCH global can be played with zero non-Hero units on board and recalculates survivors when Morale/Bond units die', () => {
    let state = baseMatch();
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_scorch_empty', 'sp_scorch')],
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: {
              cards: [inst('p1_roche', 'nr_vernon_roche')], // Hero only
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
        },
      },
    });

    expect(canPlayCard(state, 'PLAYER_1', 'p1_scorch_empty')).toBe(true);
    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_scorch_empty',
    });
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['p1_scorch_empty']);
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['p1_roche']);

    // Also verify Tight Bond recalculation when one high-strength Bond unit dies? Let's test Morale Boost death:
    // P2 has Olgierd (6) + Cahir (6+1=7) -> Olgierd dies at 6? No, Cahir is 7 and dies, or two units:
    // Two Blue Stripes (4*2=8 each) vs Ves (5): Scorch kills BOTH Blue Stripes (8), leaving 0.
    // Let's test Morale unit boosted by Horn to become highest (Olgierd 6 * 2 = 12) next to Cahir (6 + 1 = 7 * 2 = 14) —
    // If Olgierd is NOT doubled (6) and opponent has 5 + Morale(6) -> wait:
    // If P2 has Olgierd(6) alone = 6 and P2 had Ves(5+1=6) -> tie 6! Both die!
    // What if P2 has Olgierd(6) + ally(2+1=3) -> Olgierd is highest (6) and dies -> ally recalculates from 3 back to 2!
    let moraleState = baseMatch();
    moraleState = recalculateBoard({
      ...moraleState,
      activePlayer: 'PLAYER_1',
      players: {
        ...moraleState.players,
        PLAYER_1: {
          ...moraleState.players.PLAYER_1,
          hand: [inst('p1_scorch2', 'sp_scorch')],
        },
        PLAYER_2: {
          ...moraleState.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
          rows: {
            ...moraleState.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [
                inst('p2_olgierd', 'nt_olgierd_von_everec'), // 6 Morale (max!)
                inst('p2_cavalry', 'ng_nausicaa_cavalry'), // 2 + 1 = 3
              ],
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });
    expect(moraleState.players.PLAYER_2.totalScore).toBe(9);

    moraleState = dispatch(moraleState, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_scorch2',
    });
    // Olgierd dies, Cavalry immediately drops from 3 back to base 2
    expect(moraleState.players.PLAYER_2.rows.CLOSE_COMBAT.cards.map((c) => c.effectiveStrength)).toEqual([2]);
    expect(moraleState.players.PLAYER_2.totalScore).toBe(2);
  });

  it('SCORCH_ROW does not trigger below 10, triggers at >= 10 even with Heroes reaching threshold, and ignores Heroes/Decoys', () => {
    // Case A: Opponent mirror row < 10 -> no destruction
    let belowState = baseMatch();
    belowState = recalculateBoard({
      ...belowState,
      activePlayer: 'PLAYER_1',
      players: {
        ...belowState.players,
        PLAYER_1: {
          ...belowState.players.PLAYER_1,
          hand: [inst('p1_villen', 'nt_villentretenmerth')],
        },
        PLAYER_2: {
          ...belowState.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
          rows: {
            ...belowState.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [inst('p2_skellen', 'ng_stefan_skellen')], // 9 < 10
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });
    belowState = dispatch(belowState, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_villen',
    });
    expect(belowState.players.PLAYER_2.rows.CLOSE_COMBAT.cards).toHaveLength(1);

    // Case B: Opponent mirror row = 16 using Hero (10) + non-Hero (6) + Decoy (0) -> threshold met, only 6 destroyed!
    let heroAssistState = baseMatch();
    heroAssistState = recalculateBoard({
      ...heroAssistState,
      activePlayer: 'PLAYER_1',
      players: {
        ...heroAssistState.players,
        PLAYER_1: {
          ...heroAssistState.players.PLAYER_1,
          hand: [inst('p1_villen', 'nt_villentretenmerth')],
        },
        PLAYER_2: {
          ...heroAssistState.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
          rows: {
            ...heroAssistState.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [
                inst('p2_letho', 'ng_letho_of_gulet'), // 10 Hero (immune)
                inst('p2_cahir1', 'ng_cahir'), // 6 (max non-Hero)
                inst('p2_cahir2', 'ng_cahir'), // 6 (tied max non-Hero)
                inst('p2_decoy', 'sp_decoy'), // 0 (immune)
              ],
              hornCard: null,
              totalStrength: 0,
            },
            RANGED: {
              cards: [inst('p2_archer', 'ng_black_infantry_archer')], // 10 on RANGED (untouched!)
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });
    heroAssistState = dispatch(heroAssistState, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_villen',
    });
    expect(heroAssistState.players.PLAYER_2.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual([
      'p2_letho',
      'p2_decoy',
    ]);
    expect(heroAssistState.players.PLAYER_2.rows.RANGED.cards.map((c) => c.instanceId)).toEqual([
      'p2_archer',
    ]);
    expect(heroAssistState.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual([
      'p2_cahir1',
      'p2_cahir2',
    ]);

    // Case C: Opponent mirror row >= 10 composed ONLY of Heroes -> nothing destroyed!
    let heroesOnlyState = baseMatch();
    heroesOnlyState = recalculateBoard({
      ...heroesOnlyState,
      activePlayer: 'PLAYER_1',
      players: {
        ...heroesOnlyState.players,
        PLAYER_1: {
          ...heroesOnlyState.players.PLAYER_1,
          hand: [inst('p1_villen', 'nt_villentretenmerth')],
        },
        PLAYER_2: {
          ...heroesOnlyState.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
          rows: {
            ...heroesOnlyState.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [
                inst('p2_letho', 'ng_letho_of_gulet'), // 10 Hero
                inst('p2_geralt', 'nt_geralt_of_rivia'), // 15 Hero
              ],
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });
    heroesOnlyState = dispatch(heroesOnlyState, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_villen',
    });
    expect(heroesOnlyState.players.PLAYER_2.rows.CLOSE_COMBAT.cards).toHaveLength(2);
    expect(heroesOnlyState.players.PLAYER_2.discard).toHaveLength(0);
  });

  it('SCORCH_ROW triggers when Villentretenmerth is revived via MEDIC', () => {
    let state = baseMatch();
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_med', 'nr_dun_banner_medic')],
          discard: [inst('p1_villen_disc', 'nt_villentretenmerth')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [inst('p2_cahir_a', 'ng_cahir'), inst('p2_cahir_b', 'ng_cahir')], // 12 total
              hornCard: null,
              totalStrength: 0,
            },
          },
        },
      },
    });

    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_med' });
    state = dispatch(state, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_1',
      targetInstanceId: 'p1_villen_disc',
    });

    expect(state.phase).toBe('PLAYING');
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual([
      'p1_villen_disc',
    ]);
    expect(state.players.PLAYER_2.rows.CLOSE_COMBAT.cards).toHaveLength(0);
    expect(state.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(['p2_cahir_a', 'p2_cahir_b']);
  });
});
