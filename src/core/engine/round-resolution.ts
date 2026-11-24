import { ROW_TYPES, type CardDefinition, type CardInstance, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState, RoundResult } from '../models/game-state';
import { collectWeatherSlotDiscards } from '../abilities/ability-resolver';
import {
  applyNorthernRealmsWinDraw,
  applySkelligeRound3Revive,
  resolveRoundWinnerWithFactions,
  selectMonstersCarryover,
} from '../abilities/factions';
import { LEADER_HORN_DEFINITION_ID } from '../abilities/leaders';
import { HEMDALL_CARD, KAMBI_CARD_ID } from '../abilities/skellige-tokens';
import { recalculateBoard } from '../scoring/calculate-strength';
import { nextRng } from './prng';
import { createEmptyRows, createEmptyWeather } from './setup';

const COW_CARD_ID = 'nt_cow';

const BOVINE_DEFENSE_FORCE_CARD: CardDefinition = {
  id: 'nt_bovine_defense_force',
  name: 'Fuerza de Defensa Bovina',
  faction: 'NEUTRAL',
  type: 'UNIT',
  baseStrength: 8,
  isHero: false,
  allowedRows: ['CLOSE_COMBAT'],
  ability: null,
  maxCopies: 1,
  description: 'Invocada por La Vaca al ser descartada al final de la ronda (Fuerza 8).',
};

function spawnAvengerTokens(
  discardedCards: readonly CardInstance[],
  playerId: PlayerId,
  nextRoundNumber: number,
): readonly CardInstance[] {
  const tokens: CardInstance[] = [];
  for (const card of discardedCards) {
    if (card.definitionId === COW_CARD_ID) {
      tokens.push({
        instanceId: `avenger_bovine_${playerId}_r${nextRoundNumber}_${tokens.length}`,
        definitionId: BOVINE_DEFENSE_FORCE_CARD.id,
        card: BOVINE_DEFENSE_FORCE_CARD,
        effectiveStrength: BOVINE_DEFENSE_FORCE_CARD.baseStrength,
      });
    } else if (card.definitionId === KAMBI_CARD_ID) {
      tokens.push({
        instanceId: `avenger_hemdall_${playerId}_r${nextRoundNumber}_${tokens.length}`,
        definitionId: HEMDALL_CARD.id,
        card: HEMDALL_CARD,
        effectiveStrength: HEMDALL_CARD.baseStrength,
      });
    }
  }
  return tokens;
}

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

  const weatherDiscards = collectWeatherSlotDiscards(state.weather);

  const p1Monsters = selectMonstersCarryover(p1, state.rngSeed);
  const p2Monsters = selectMonstersCarryover(p2, p1Monsters.nextSeed);
  const nextRoundNumber = (state.roundNumber + 1) as 1 | 2 | 3;

  const preparePlayerForNextRound = (
    player: PlayerState,
    kept: { readonly rowType: RowType; readonly card: CardInstance } | null,
    playerWeatherDiscards: readonly CardInstance[],
    wonPreviousRound: boolean,
  ): PlayerState => {
    const discardedFromBoard = collectPlayerBoardCardsToDiscard(
      player,
      kept?.card.instanceId ?? null,
    );
    const avengerTokens = spawnAvengerTokens(discardedFromBoard, player.id, nextRoundNumber);

    const rows = createEmptyRows();
    const closeCombatCards: CardInstance[] = [];
    if (kept?.rowType === 'CLOSE_COMBAT') {
      closeCombatCards.push(kept.card);
    }
    closeCombatCards.push(...avengerTokens);

    const nextRows = {
      ...rows,
      ...(kept && kept.rowType !== 'CLOSE_COMBAT'
        ? {
            [kept.rowType]: {
              ...rows[kept.rowType],
              cards: [kept.card],
            },
          }
        : {}),
      CLOSE_COMBAT: {
        ...rows.CLOSE_COMBAT,
        cards: closeCombatCards,
      },
    };

    return applyNorthernRealmsWinDraw(
      {
        ...player,
        passed: false,
        rows: nextRows,
        totalScore: 0,
        discard: [...player.discard, ...discardedFromBoard, ...playerWeatherDiscards],
      },
      wonPreviousRound,
    );
  };

  let p1Next = preparePlayerForNextRound(
    p1,
    p1Monsters.kept,
    weatherDiscards.PLAYER_1,
    lastRound?.winner === 'PLAYER_1',
  );
  let p2Next = preparePlayerForNextRound(
    p2,
    p2Monsters.kept,
    weatherDiscards.PLAYER_2,
    lastRound?.winner === 'PLAYER_2',
  );

  let nextSeed = p2Monsters.nextSeed;

  if (nextRoundNumber === 3) {
    const p1Skellige = applySkelligeRound3Revive(p1Next, nextSeed);
    p1Next = p1Skellige.player;
    const p2Skellige = applySkelligeRound3Revive(p2Next, p1Skellige.nextSeed);
    p2Next = p2Skellige.player;
    nextSeed = p2Skellige.nextSeed;
  }

  let startingPlayer: PlayerId;

  if (lastRound && lastRound.winner !== 'DRAW') {
    startingPlayer = lastRound.winner;
  } else {
    const coinFlip = nextRng(nextSeed);
    nextSeed = coinFlip.nextSeed;
    startingPlayer = coinFlip.value < 0.5 ? 'PLAYER_1' : 'PLAYER_2';
  }

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
