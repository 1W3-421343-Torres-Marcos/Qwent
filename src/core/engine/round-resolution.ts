import { ROW_TYPES, type CardInstance, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState, RoundResult, WeatherSlot } from '../models/game-state';
import {
  applyNorthernRealmsWinDraw,
  resolveRoundWinnerWithFactions,
  selectMonstersCarryover,
} from '../abilities/factions';
import { LEADER_HORN_DEFINITION_ID } from '../abilities/leaders';
import { recalculateBoard } from '../scoring/calculate-strength';
import { nextRng } from './prng';
import { createEmptyRows, createEmptyWeather } from './setup';

/**
 * Returns the opponent PlayerId for a given player.
 */
export function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
}

function collectPlayerBoardCardsToDiscard(
  player: PlayerState,
  keptInstanceId: string | null,
): readonly CardInstance[] {
  const toDiscard: CardInstance[] = [];
  for (const rowType of ROW_TYPES) {
    const row = player.rows[rowType];
    for (const card of row.cards) {
      if (card.instanceId !== keptInstanceId) {
        toDiscard.push({ ...card, effectiveStrength: card.card.baseStrength });
      }
    }
    if (row.hornCard !== null && row.hornCard.definitionId !== LEADER_HORN_DEFINITION_ID) {
      toDiscard.push(row.hornCard);
    }
  }
  return toDiscard;
}

function collectWeatherSlotsToDiscard(
  weatherSlots: readonly (WeatherSlot | null)[],
): Readonly<Record<PlayerId, readonly CardInstance[]>> {
  const p1Cards: CardInstance[] = [];
  const p2Cards: CardInstance[] = [];

  for (const slot of weatherSlots) {
    if (slot === null) continue;
    if (slot.owner === 'PLAYER_1') {
      p1Cards.push(slot.card);
    } else {
      p2Cards.push(slot.card);
    }
  }

  return { PLAYER_1: p1Cards, PLAYER_2: p2Cards };
}

/**
 * Evaluates round scores, deducts gems, records history, and enters ROUND_END or MATCH_END.
 */
export function resolveRound(state: GameState): GameState {
  const p1 = state.players.PLAYER_1;
  const p2 = state.players.PLAYER_2;

  const roundWinner = resolveRoundWinnerWithFactions(p1, p2);

  const p1Gems = roundWinner === 'PLAYER_1' ? p1.gems : Math.max(0, p1.gems - 1);
  const p2Gems = roundWinner === 'PLAYER_2' ? p2.gems : Math.max(0, p2.gems - 1);

  const result: RoundResult = {
    roundNumber: state.roundNumber,
    winner: roundWinner,
    scores: {
      PLAYER_1: p1.totalScore,
      PLAYER_2: p2.totalScore,
    },
  };

  let matchWinner: PlayerId | 'DRAW' | null = null;
  let nextPhase: GameState['phase'] = 'ROUND_END';

  if (p1Gems === 0 && p2Gems === 0) {
    nextPhase = 'MATCH_END';
    matchWinner = 'DRAW';
  } else if (p1Gems === 0) {
    nextPhase = 'MATCH_END';
    matchWinner = 'PLAYER_2';
  } else if (p2Gems === 0) {
    nextPhase = 'MATCH_END';
    matchWinner = 'PLAYER_1';
  }

  return {
    ...state,
    phase: nextPhase,
    winner: matchWinner,
    roundHistory: [...state.roundHistory, result],
    players: {
      PLAYER_1: { ...p1, gems: p1Gems },
      PLAYER_2: { ...p2, gems: p2Gems },
    },
  };
}

/**
 * Clears board cards and weather slots into their owners' discards and starts the next round without drawing cards.
 */
export function advanceToNextRound(state: GameState): GameState {
  if (state.phase !== 'ROUND_END' || state.roundNumber >= 3) {
    return state;
  }

  const p1 = state.players.PLAYER_1;
  const p2 = state.players.PLAYER_2;
  const lastRound = state.roundHistory[state.roundHistory.length - 1];

  const weatherDiscards = collectWeatherSlotsToDiscard([
    state.weather.frost,
    state.weather.fog,
    state.weather.rain,
  ]);

  const p1Monsters = selectMonstersCarryover(p1, state.rngSeed);
  const p2Monsters = selectMonstersCarryover(p2, p1Monsters.nextSeed);

  const buildCarryoverRows = (
    kept: { readonly rowType: RowType; readonly card: CardInstance } | null,
  ) => {
    const rows = createEmptyRows();
    if (!kept) {
      return rows;
    }
    return {
      ...rows,
      [kept.rowType]: {
        ...rows[kept.rowType],
        cards: [kept.card],
      },
    };
  };

  const p1BaseNext: PlayerState = {
    ...p1,
    passed: false,
    rows: buildCarryoverRows(p1Monsters.kept),
    totalScore: 0,
    discard: [
      ...p1.discard,
      ...collectPlayerBoardCardsToDiscard(p1, p1Monsters.kept?.card.instanceId ?? null),
      ...weatherDiscards.PLAYER_1,
    ],
  };

  const p2BaseNext: PlayerState = {
    ...p2,
    passed: false,
    rows: buildCarryoverRows(p2Monsters.kept),
    totalScore: 0,
    discard: [
      ...p2.discard,
      ...collectPlayerBoardCardsToDiscard(p2, p2Monsters.kept?.card.instanceId ?? null),
      ...weatherDiscards.PLAYER_2,
    ],
  };

  const p1Next = applyNorthernRealmsWinDraw(p1BaseNext, lastRound?.winner === 'PLAYER_1');
  const p2Next = applyNorthernRealmsWinDraw(p2BaseNext, lastRound?.winner === 'PLAYER_2');

  let nextSeed = p2Monsters.nextSeed;
  let startingPlayer: PlayerId;

  if (lastRound && lastRound.winner !== 'DRAW') {
    startingPlayer = lastRound.winner;
  } else {
    const coinFlip = nextRng(nextSeed);
    nextSeed = coinFlip.nextSeed;
    startingPlayer = coinFlip.value < 0.5 ? 'PLAYER_1' : 'PLAYER_2';
  }

  const nextRoundNumber = (state.roundNumber + 1) as 1 | 2 | 3;

  return recalculateBoard({
    ...state,
    phase: 'PLAYING',
    roundNumber: nextRoundNumber,
    activePlayer: startingPlayer,
    rngSeed: nextSeed,
    weather: createEmptyWeather(),
    pendingSelection: null,
    players: {
      PLAYER_1: p1Next,
      PLAYER_2: p2Next,
    },
  });
}
