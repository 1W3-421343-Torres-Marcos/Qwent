import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createInitialGameState,
  dispatch,
  type CardDefinition,
  type GameState,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function createMulliganMatch(seed = 2026): GameState {
  return createInitialGameState({
    rngSeed: seed,
    catalog,
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

describe('Initial Mulligan Phase (F4.1)', () => {
  it('starts in MULLIGAN with 2 mulligans remaining per player and finishes into PLAYING deterministically', () => {
    const stateA = createMulliganMatch(555);
    const stateB = createMulliganMatch(555);

    expect(stateA).toEqual(stateB);
    expect(stateA.phase).toBe('MULLIGAN');
    expect(stateA.activePlayer).toBe('PLAYER_1');
    expect(stateA.players.PLAYER_1.mulligansRemaining).toBe(2);
    expect(stateA.players.PLAYER_1.mulliganDone).toBe(false);
    expect(stateA.players.PLAYER_2.mulligansRemaining).toBe(2);
    expect(stateA.players.PLAYER_2.mulliganDone).toBe(false);
  });

  it('swaps up to 2 cards, returns swapped cards back to shuffled deck (never discard), and auto-advances player', () => {
    let state = createMulliganMatch(101);
    const firstSwap = state.players.PLAYER_1.hand[0]!;
    const expectedTopReplacement = state.players.PLAYER_1.deck[0]!;
    const originalDeckLen = state.players.PLAYER_1.deck.length;

    // 1st swap by PLAYER_1
    state = dispatch(state, {
      type: 'MULLIGAN_SWAP',
      playerId: 'PLAYER_1',
      instanceId: firstSwap.instanceId,
    });

    expect(state.phase).toBe('MULLIGAN');
    expect(state.activePlayer).toBe('PLAYER_1');
    expect(state.players.PLAYER_1.mulligansRemaining).toBe(1);
    expect(state.players.PLAYER_1.hand[0]?.instanceId).toBe(expectedTopReplacement.instanceId);
    expect(state.players.PLAYER_1.hand.map((c) => c.instanceId)).not.toContain(firstSwap.instanceId);
    expect(state.players.PLAYER_1.discard).toHaveLength(0);
    expect(state.players.PLAYER_1.deck).toHaveLength(originalDeckLen);
    expect(state.players.PLAYER_1.deck.map((c) => c.instanceId)).toContain(firstSwap.instanceId);

    // 2nd swap by PLAYER_1 -> automatically marks P1 done and switches to PLAYER_2
    const secondSwap = state.players.PLAYER_1.hand[3]!;
    state = dispatch(state, {
      type: 'MULLIGAN_SWAP',
      playerId: 'PLAYER_1',
      instanceId: secondSwap.instanceId,
    });

    expect(state.phase).toBe('MULLIGAN');
    expect(state.players.PLAYER_1.mulligansRemaining).toBe(0);
    expect(state.players.PLAYER_1.mulliganDone).toBe(true);
    expect(state.players.PLAYER_1.discard).toHaveLength(0);
    expect(state.players.PLAYER_1.deck.map((c) => c.instanceId)).toContain(secondSwap.instanceId);
    expect(state.activePlayer).toBe('PLAYER_2');

    // Attempt 3rd swap by PLAYER_1 -> rejected
    const blocked = dispatch(state, {
      type: 'MULLIGAN_SWAP',
      playerId: 'PLAYER_1',
      instanceId: state.players.PLAYER_1.hand[0]!.instanceId,
    });
    expect(blocked).toBe(state);

    // PLAYER_2 finishes early with 0 swaps -> enters PLAYING with deterministic starting player
    state = dispatch(state, { type: 'FINISH_MULLIGAN', playerId: 'PLAYER_2' });
    expect(state.phase).toBe('PLAYING');
    expect(state.players.PLAYER_2.mulliganDone).toBe(true);
    expect(['PLAYER_1', 'PLAYER_2']).toContain(state.activePlayer);
  });

  it('rejects MULLIGAN_SWAP if deck is empty and allows FINISH_MULLIGAN directly', () => {
    let state = createMulliganMatch(303);
    state = {
      ...state,
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          deck: [],
        },
      },
    };

    const cannotSwap = dispatch(state, {
      type: 'MULLIGAN_SWAP',
      playerId: 'PLAYER_1',
      instanceId: state.players.PLAYER_1.hand[0]!.instanceId,
    });
    expect(cannotSwap).toBe(state);

    state = dispatch(state, { type: 'FINISH_MULLIGAN', playerId: 'PLAYER_1' });
    expect(state.activePlayer).toBe('PLAYER_2');
    state = dispatch(state, { type: 'FINISH_MULLIGAN', playerId: 'PLAYER_2' });
    expect(state.phase).toBe('PLAYING');
  });
});
