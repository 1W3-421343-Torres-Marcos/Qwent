import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createInitialGameState,
  dispatch,
  recalculateBoard,
  type CardDefinition,
  type CardInstance,
  type FactionId,
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

function createFactionMatch(
  p1Faction: Exclude<FactionId, 'NEUTRAL'>,
  p2Faction: Exclude<FactionId, 'NEUTRAL'>,
  seed = 42,
): GameState {
  const deckA = decks[0]!;
  return createInitialGameState({
    rngSeed: seed,
    catalog,
    skipMulligan: true,
    player1: {
      name: `P1_${p1Faction}`,
      faction: p1Faction,
      leader: null,
      deckCardIds: deckA.cardIds,
    },
    player2: {
      name: `P2_${p2Faction}`,
      faction: p2Faction,
      leader: null,
      deckCardIds: deckA.cardIds,
    },
  });
}

describe('F5.1 Faction Passives (Northern Realms, Nilfgaard, Monsters, Scoia\'tael)', () => {
  it('Northern Realms draws +1 card on round win (only for the winner, safely on empty deck)', () => {
    let state = createFactionMatch('NORTHERN_REALMS', 'MONSTERS', 10);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_h1', 'nr_ves')],
          deck: [inst('p1_top_draw', 'nr_ballista')],
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_u', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_h1', 'nr_ves')],
          deck: [inst('p2_top', 'nr_ballista')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('p2_u', 'nr_kaedweni_siege_expert')], hornCard: null, totalStrength: 1 },
          },
        },
      },
    });

    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(state.phase).toBe('ROUND_END');
    expect(state.roundHistory[0]?.winner).toBe('PLAYER_1');

    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.players.PLAYER_1.hand.map((c) => c.instanceId)).toEqual(['p1_h1', 'p1_top_draw']);
    expect(state.players.PLAYER_1.deck).toHaveLength(0);
    // Opponent did not draw
    expect(state.players.PLAYER_2.hand).toHaveLength(1);
  });

  it('Nilfgaard wins tied rounds against other factions, but Nilfgaard vs Nilfgaard draws and both lose 1 gem', () => {
    // A: Nilfgaard vs Northern Realms tie -> Nilfgaard wins
    let vsOther = createFactionMatch('NORTHERN_REALMS', 'NILFGAARD', 20);
    vsOther = recalculateBoard({
      ...vsOther,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...vsOther.players.PLAYER_1,
          hand: [inst('p1_h', 'nr_ves')],
          rows: {
            ...vsOther.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_u', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
        PLAYER_2: {
          ...vsOther.players.PLAYER_2,
          hand: [inst('p2_h', 'ng_cahir')],
          rows: {
            ...vsOther.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('p2_u', 'nr_ves')], hornCard: null, totalStrength: 5 },
          },
        },
      },
    });

    vsOther = dispatch(vsOther, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    vsOther = dispatch(vsOther, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(vsOther.roundHistory[0]?.winner).toBe('PLAYER_2');
    expect(vsOther.players.PLAYER_1.gems).toBe(1);
    expect(vsOther.players.PLAYER_2.gems).toBe(2);

    // B: Nilfgaard vs Nilfgaard tie -> DRAW, both lose 1 gem
    let mirror = createFactionMatch('NILFGAARD', 'NILFGAARD', 21);
    mirror = recalculateBoard({
      ...mirror,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: { ...mirror.players.PLAYER_1, hand: [inst('p1_h', 'ng_cahir')] },
        PLAYER_2: { ...mirror.players.PLAYER_2, hand: [inst('p2_h', 'ng_cahir')] },
      },
    });
    mirror = dispatch(mirror, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    mirror = dispatch(mirror, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(mirror.roundHistory[0]?.winner).toBe('DRAW');
    expect(mirror.players.PLAYER_1.gems).toBe(1);
    expect(mirror.players.PLAYER_2.gems).toBe(1);
  });

  it('Monsters keeps 1 deterministic non-Hero, non-Decoy unit across round transition', () => {
    const setupBoard = (seed: number): GameState => {
      const base = createFactionMatch('MONSTERS', 'NORTHERN_REALMS', seed);
      return recalculateBoard({
        ...base,
        activePlayer: 'PLAYER_1',
        players: {
          PLAYER_1: {
            ...base.players.PLAYER_1,
            hand: [inst('p1_h', 'nr_ves')],
            rows: {
              ...base.players.PLAYER_1.rows,
              CLOSE_COMBAT: {
                cards: [
                  inst('p1_hero', 'nt_geralt_of_rivia'), // Immune Hero
                  inst('p1_decoy', 'sp_decoy'), // Excluded Decoy
                  inst('p1_unit_a', 'nr_ves'), // Eligible 5
                ],
                hornCard: null,
                totalStrength: 0,
              },
              RANGED: {
                cards: [inst('p1_unit_b', 'nr_ballista')], // Eligible 6
                hornCard: null,
                totalStrength: 0,
              },
            },
          },
          PLAYER_2: {
            ...base.players.PLAYER_2,
            hand: [inst('p2_h', 'nr_ves')],
          },
        },
      });
    };

    const run = (seed: number): GameState => {
      let s = setupBoard(seed);
      s = dispatch(s, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
      s = dispatch(s, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
      return dispatch(s, { type: 'ADVANCE_ROUND' });
    };

    const nextA = run(777);
    const nextB = run(777);
    expect(nextA).toEqual(nextB);

    const p1AllBoardUnits = [
      ...nextA.players.PLAYER_1.rows.CLOSE_COMBAT.cards,
      ...nextA.players.PLAYER_1.rows.RANGED.cards,
      ...nextA.players.PLAYER_1.rows.SIEGE.cards,
    ];
    expect(p1AllBoardUnits).toHaveLength(1);
    expect(['p1_unit_a', 'p1_unit_b']).toContain(p1AllBoardUnits[0]!.instanceId);
    expect(nextA.players.PLAYER_1.totalScore).toBe(p1AllBoardUnits[0]!.effectiveStrength);
    // Hero, Decoy, and the other eligible unit went to discard
    expect(nextA.players.PLAYER_1.discard).toHaveLength(3);
  });

  it('Scoia\'tael chooses Round 1 starter via SCOIATAEL_START_CHOICE, but mirror uses deterministic coin flip', () => {
    const single = createFactionMatch('NORTHERN_REALMS', 'SCOIATAEL', 55);
    expect(single.phase).toBe('PENDING_SELECTION');
    expect(single.activePlayer).toBe('PLAYER_2');
    expect(single.pendingSelection).toEqual({
      type: 'SCOIATAEL_START_CHOICE',
      playerId: 'PLAYER_2',
    });

    const chosen = dispatch(single, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      startingPlayer: 'PLAYER_1',
    });
    expect(chosen.phase).toBe('PLAYING');
    expect(chosen.pendingSelection).toBeNull();
    expect(chosen.activePlayer).toBe('PLAYER_1');

    // Mirror Scoia'tael vs Scoia'tael skips choice and resolves deterministically
    const mirrorA = createFactionMatch('SCOIATAEL', 'SCOIATAEL', 99);
    const mirrorB = createFactionMatch('SCOIATAEL', 'SCOIATAEL', 99);
    expect(mirrorA).toEqual(mirrorB);
    expect(mirrorA.phase).toBe('PLAYING');
    expect(mirrorA.pendingSelection).toBeNull();
    expect(['PLAYER_1', 'PLAYER_2']).toContain(mirrorA.activePlayer);
  });
});
