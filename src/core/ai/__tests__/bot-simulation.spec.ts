import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createAIView,
  createInitialGameState,
  decideAction,
  dispatch,
  type CardDefinition,
  type GameState,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

const MAX_ACTIONS_PER_MATCH = 200;

function simulateBotMatch(
  seed: number,
  swapFactions = false,
): { readonly finalState: GameState; readonly steps: number } {
  const deckA = swapFactions ? decks[1]! : decks[0]!;
  const deckB = swapFactions ? decks[0]! : decks[1]!;

  let state = createInitialGameState({
    rngSeed: seed,
    catalog,
    player1: {
      name: `Bot1_${deckA.faction}`,
      faction: deckA.faction,
      leader: null,
      deckCardIds: deckA.cardIds,
    },
    player2: {
      name: `Bot2_${deckB.faction}`,
      faction: deckB.faction,
      leader: null,
      deckCardIds: deckB.cardIds,
    },
  });

  let steps = 0;

  while (state.phase !== 'MATCH_END') {
    if (steps >= MAX_ACTIONS_PER_MATCH) {
      throw new Error(`Match exceeded ${MAX_ACTIONS_PER_MATCH} steps at seed=${seed}, phase=${state.phase}`);
    }

    const action =
      state.phase === 'ROUND_END'
        ? ({ type: 'ADVANCE_ROUND' } as const)
        : decideAction(createAIView(state, state.activePlayer));

    const nextState = dispatch(state, action);
    if (nextState === state) {
      throw new Error(
        `Bot produced no-op/illegal action ${JSON.stringify(action)} at seed=${seed}, phase=${state.phase}`,
      );
    }

    state = nextState;
    steps++;
  }

  return { finalState: state, steps };
}

describe('Bot vs. Bot Stress Simulation (F4.3)', () => {
  it('completes 120 full matches (including Mulligan and 2–3 rounds) with zero infinite loops or illegal actions', () => {
    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;

    for (let seed = 1; seed <= 120; seed++) {
      const { finalState, steps } = simulateBotMatch(seed, false);
      expect(finalState.phase).toBe('MATCH_END');
      expect(finalState.winner).not.toBeNull();
      expect(steps).toBeGreaterThan(2);
      expect(steps).toBeLessThan(MAX_ACTIONS_PER_MATCH);
      expect(finalState.roundHistory.length).toBeGreaterThanOrEqual(2);
      expect(finalState.roundHistory.length).toBeLessThanOrEqual(3);

      if (finalState.winner === 'PLAYER_1') p1Wins++;
      else if (finalState.winner === 'PLAYER_2') p2Wins++;
      else draws++;
    }

    expect(p1Wins + p2Wins + draws).toBe(120);
  });

  it('completes 30 swapped-faction matches cleanly', () => {
    for (let seed = 1001; seed <= 1030; seed++) {
      const { finalState } = simulateBotMatch(seed, true);
      expect(finalState.phase).toBe('MATCH_END');
    }
  });
});
