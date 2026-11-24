import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  AI_DIFFICULTIES,
  LEADER_ABILITY_TYPES,
  PLAYABLE_FACTIONS,
  createAIView,
  createInitialGameState,
  decideAction,
  dispatch,
  type AIDifficulty,
  type CardDefinition,
  type GameState,
  type LeaderAbilityType,
  type PlayableFactionId,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

const MAX_ACTIONS_PER_MATCH = 220;

function makeSimLeader(faction: PlayableFactionId, ability: LeaderAbilityType): CardDefinition {
  return {
    id: `sim_leader_${faction}_${ability}`,
    name: `Sim ${ability}`,
    faction,
    type: 'LEADER',
    baseStrength: 0,
    isHero: false,
    allowedRows: [],
    ability: null,
    leaderAbility: ability,
    maxCopies: 1,
    description: ability,
  };
}

function runMatchToCompletion(
  initialState: GameState,
  seed: number,
  p1Difficulty: AIDifficulty = 'TAVERNER',
  p2Difficulty: AIDifficulty = 'TAVERNER',
): { readonly finalState: GameState; readonly steps: number } {
  let state = initialState;
  let steps = 0;

  while (state.phase !== 'MATCH_END') {
    if (steps >= MAX_ACTIONS_PER_MATCH) {
      throw new Error(`Match exceeded ${MAX_ACTIONS_PER_MATCH} steps at seed=${seed}, phase=${state.phase}`);
    }

    const difficulty = state.activePlayer === 'PLAYER_1' ? p1Difficulty : p2Difficulty;
    const action =
      state.phase === 'ROUND_END'
        ? ({ type: 'ADVANCE_ROUND' } as const)
        : decideAction(createAIView(state, state.activePlayer), difficulty);

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

function simulateBotMatch(
  seed: number,
  swapFactions = false,
  p1FactionOverride?: PlayableFactionId,
  p2FactionOverride?: PlayableFactionId,
  p1Leader: CardDefinition | null = null,
  p2Leader: CardDefinition | null = null,
): { readonly finalState: GameState; readonly steps: number } {
  const deckA = swapFactions ? decks[1]! : decks[0]!;
  const deckB = swapFactions ? decks[0]! : decks[1]!;
  const f1 = p1FactionOverride ?? deckA.faction;
  const f2 = p2FactionOverride ?? deckB.faction;

  const initialState = createInitialGameState({
    rngSeed: seed,
    catalog,
    player1: {
      name: `Bot1_${f1}`,
      faction: f1,
      leader: p1Leader,
      deckCardIds: deckA.cardIds,
    },
    player2: {
      name: `Bot2_${f2}`,
      faction: f2,
      leader: p2Leader,
      deckCardIds: deckB.cardIds,
    },
  });

  return runMatchToCompletion(initialState, seed);
}

function simulateRealStarterMatch(
  seed: number,
  deckA: StarterDeckDefinition,
  deckB: StarterDeckDefinition,
  p1Difficulty: AIDifficulty = 'TAVERNER',
  p2Difficulty: AIDifficulty = 'TAVERNER',
): { readonly finalState: GameState; readonly steps: number } {
  const leaderA = deckA.leaderId ? (catalog.find((c) => c.id === deckA.leaderId) ?? null) : null;
  const leaderB = deckB.leaderId ? (catalog.find((c) => c.id === deckB.leaderId) ?? null) : null;

  const initialState = createInitialGameState({
    rngSeed: seed,
    catalog,
    player1: {
      name: `Bot1_${deckA.faction}`,
      faction: deckA.faction,
      leader: leaderA,
      deckCardIds: deckA.cardIds,
    },
    player2: {
      name: `Bot2_${deckB.faction}`,
      faction: deckB.faction,
      leader: leaderB,
      deckCardIds: deckB.cardIds,
    },
  });

  return runMatchToCompletion(initialState, seed, p1Difficulty, p2Difficulty);
}

describe('Bot vs. Bot Stress Simulation (F4.3 & F5.3)', () => {
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

  it('completes 150 multi-faction and Leader Bot vs. Bot matches covering all 5 factions & leader abilities', () => {
    for (let i = 0; i < 150; i++) {
      const f1 = PLAYABLE_FACTIONS[i % PLAYABLE_FACTIONS.length]!;
      const f2 = PLAYABLE_FACTIONS[(i + 1) % PLAYABLE_FACTIONS.length]!;
      const l1Ability = LEADER_ABILITY_TYPES[i % LEADER_ABILITY_TYPES.length]!;
      const l2Ability = LEADER_ABILITY_TYPES[(i + 5) % LEADER_ABILITY_TYPES.length]!;

      const { finalState, steps } = simulateBotMatch(
        2000 + i,
        i % 2 === 1,
        f1,
        f2,
        makeSimLeader(f1, l1Ability),
        makeSimLeader(f2, l2Ability),
      );
      expect(finalState.phase).toBe('MATCH_END');
      expect(finalState.winner).not.toBeNull();
      expect(steps).toBeLessThan(MAX_ACTIONS_PER_MATCH);
    }
  });

  it('completes 120 matches using all 5 real starter decks (incl. Skellige) and all 3 AI difficulties', () => {
    for (let i = 0; i < 120; i++) {
      const deckA = decks[i % decks.length]!;
      const deckB = decks[(i + 1 + (i % 4)) % decks.length]!;
      const diff1 = AI_DIFFICULTIES[i % AI_DIFFICULTIES.length]!;
      const diff2 = AI_DIFFICULTIES[(i + 1) % AI_DIFFICULTIES.length]!;
      const { finalState, steps } = simulateRealStarterMatch(5000 + i, deckA, deckB, diff1, diff2);
      expect(finalState.phase).toBe('MATCH_END');
      expect(finalState.winner).not.toBeNull();
      expect(steps).toBeLessThan(MAX_ACTIONS_PER_MATCH);
    }
  });
});
