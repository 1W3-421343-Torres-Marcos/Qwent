import { ROW_TYPES, type AbilityType, type CardInstance, type PlayerId, type RowType } from '../models/types';
import type { GameAction } from '../models/actions';
import type { GameState, PlayerState, WeatherState } from '../models/game-state';
import {
  hasValidDecoyTarget,
  isValidDecoyTarget,
  resolveAgileSelection,
  resolveDecoy,
  resolveMedicSelection,
  resolveScorchGlobal,
  resolveSpy,
  resolveUnitEntry,
} from '../abilities/ability-resolver';
import { resolveRound1StartState } from '../abilities/factions';
import { resolveLeaderTargetSelection, resolveLeaderUse } from '../abilities/leaders';
import { recalculateBoard } from '../scoring/calculate-strength';
import { shuffleDeterministic } from './prng';
import { advanceToNextRound, getOpponentId, resolveRound } from './round-resolution';
import { createEmptyWeather } from './setup';

const WEATHER_ABILITY_TO_KEY: Readonly<Partial<Record<AbilityType, keyof WeatherState>>> = {
  WEATHER_FROST: 'frost',
  WEATHER_FOG: 'fog',
  WEATHER_RAIN: 'rain',
};

/**
 * Checks whether a card instance can legally be played by `playerId` in the current state.
 */
export function canPlayCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  targetRow?: RowType,
  decoyTargetInstanceId?: string,
): boolean {
  if (state.phase !== 'PLAYING' || state.activePlayer !== playerId) {
    return false;
  }

  const player = state.players[playerId];
  if (player.passed) {
    return false;
  }

  const cardInstance = player.hand.find((c) => c.instanceId === instanceId);
  if (!cardInstance) {
    return false;
  }

  const { card } = cardInstance;
  if (card.type === 'UNIT') {
    const resolvedRow = targetRow ?? card.allowedRows[0];
    return resolvedRow !== undefined && card.allowedRows.includes(resolvedRow);
  }

  if (card.type === 'SPECIAL') {
    if (card.ability === 'COMMANDERS_HORN') {
      if (targetRow === undefined) {
        return ROW_TYPES.some((row) => player.rows[row].hornCard === null);
      }
      return ROW_TYPES.includes(targetRow) && player.rows[targetRow].hornCard === null;
    }

    if (card.ability === 'DECOY') {
      if (decoyTargetInstanceId === undefined) {
        return hasValidDecoyTarget(player);
      }
      return ROW_TYPES.some((row) =>
        player.rows[row].cards.some(
          (c) => c.instanceId === decoyTargetInstanceId && isValidDecoyTarget(c),
        ),
      );
    }

    return (
      card.ability === 'SCORCH' ||
      card.ability === 'WEATHER_FROST' ||
      card.ability === 'WEATHER_FOG' ||
      card.ability === 'WEATHER_RAIN' ||
      card.ability === 'WEATHER_CLEAR'
    );
  }

  return false;
}

function finalizeTurn(state: GameState, actingPlayerId: PlayerId): GameState {
  if (state.phase === 'PENDING_SELECTION') {
    return state;
  }

  const actingPlayer = state.players[actingPlayerId];
  const opponentId = getOpponentId(actingPlayerId);
  const opponent = state.players[opponentId];

  const shouldAutoPass =
    actingPlayer.hand.length === 0 &&
    (actingPlayer.leader === null || actingPlayer.leaderUsed);

  const finalizedActingPlayer: PlayerState = shouldAutoPass
    ? { ...actingPlayer, passed: true }
    : actingPlayer;

  const updatedState: GameState = {
    ...state,
    players: {
      ...state.players,
      [actingPlayerId]: finalizedActingPlayer,
    },
  };

  if (finalizedActingPlayer.passed && opponent.passed) {
    return resolveRound(updatedState);
  }

  return {
    ...updatedState,
    activePlayer: opponent.passed ? actingPlayerId : opponentId,
  };
}

function playUnitCard(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  remainingHand: readonly CardInstance[],
  targetRow: RowType,
): GameState {
  const player = state.players[playerId];
  const currentRow = player.rows[targetRow];

  const nextPlayer: PlayerState = {
    ...player,
    hand: remainingHand,
    rows: {
      ...player.rows,
      [targetRow]: {
        ...currentRow,
        cards: [...currentRow.cards, instance],
      },
    },
  };

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: nextPlayer,
    },
  });
}

function playWeatherCard(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  remainingHand: readonly CardInstance[],
  weatherKey: keyof WeatherState,
): GameState {
  const player = state.players[playerId];
  const slotOccupied = state.weather[weatherKey] !== null;

  const nextWeather: WeatherState = slotOccupied
    ? state.weather
    : {
        ...state.weather,
        [weatherKey]: { card: instance, owner: playerId },
      };

  const nextPlayer: PlayerState = {
    ...player,
    hand: remainingHand,
    discard: slotOccupied ? [...player.discard, instance] : player.discard,
  };

  return recalculateBoard({
    ...state,
    weather: nextWeather,
    players: {
      ...state.players,
      [playerId]: nextPlayer,
    },
  });
}

function playClearWeather(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  remainingHand: readonly CardInstance[],
): GameState {
  const p1ExtraDiscards: CardInstance[] = [];
  const p2ExtraDiscards: CardInstance[] = [];

  for (const key of ['frost', 'fog', 'rain'] as const) {
    const slot = state.weather[key];
    if (slot === null) continue;
    if (slot.owner === 'PLAYER_1') {
      p1ExtraDiscards.push(slot.card);
    } else {
      p2ExtraDiscards.push(slot.card);
    }
  }

  if (playerId === 'PLAYER_1') {
    p1ExtraDiscards.push(instance);
  } else {
    p2ExtraDiscards.push(instance);
  }

  const p1 = state.players.PLAYER_1;
  const p2 = state.players.PLAYER_2;

  return recalculateBoard({
    ...state,
    weather: createEmptyWeather(),
    players: {
      PLAYER_1: {
        ...p1,
        hand: playerId === 'PLAYER_1' ? remainingHand : p1.hand,
        discard: [...p1.discard, ...p1ExtraDiscards],
      },
      PLAYER_2: {
        ...p2,
        hand: playerId === 'PLAYER_2' ? remainingHand : p2.hand,
        discard: [...p2.discard, ...p2ExtraDiscards],
      },
    },
  });
}

function playHornSpecial(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  remainingHand: readonly CardInstance[],
  targetRow: RowType,
): GameState {
  const player = state.players[playerId];
  const currentRow = player.rows[targetRow];

  const nextPlayer: PlayerState = {
    ...player,
    hand: remainingHand,
    rows: {
      ...player.rows,
      [targetRow]: {
        ...currentRow,
        hornCard: instance,
      },
    },
  };

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: nextPlayer,
    },
  });
}

function handlePlayCard(state: GameState, action: Extract<GameAction, { type: 'PLAY_CARD' }>): GameState {
  const { playerId, instanceId, targetRow, decoyTargetInstanceId } = action;
  const player = state.players[playerId];
  const cardIndex = player.hand.findIndex((c) => c.instanceId === instanceId);
  if (cardIndex === -1 || state.phase !== 'PLAYING' || state.activePlayer !== playerId || player.passed) {
    return state;
  }

  const instance = player.hand[cardIndex]!;
  const remainingHand = player.hand.filter((c) => c.instanceId !== instanceId);
  const { card } = instance;

  if (card.type === 'UNIT') {
    const resolvedRow = targetRow ?? card.allowedRows[0];
    if (!resolvedRow || !card.allowedRows.includes(resolvedRow)) {
      return state;
    }
    if (card.ability === 'SPY') {
      const afterSpy = resolveSpy(state, playerId, instance, remainingHand, resolvedRow);
      return finalizeTurn(afterSpy, playerId);
    }
    const afterPlace = playUnitCard(state, playerId, instance, remainingHand, resolvedRow);
    const afterEntry = resolveUnitEntry(afterPlace, playerId, instance, resolvedRow);
    return finalizeTurn(afterEntry, playerId);
  }

  if (card.type === 'SPECIAL') {
    const weatherKey = card.ability ? WEATHER_ABILITY_TO_KEY[card.ability] : undefined;
    if (weatherKey) {
      const nextState = playWeatherCard(state, playerId, instance, remainingHand, weatherKey);
      return finalizeTurn(nextState, playerId);
    }

    if (card.ability === 'WEATHER_CLEAR') {
      const nextState = playClearWeather(state, playerId, instance, remainingHand);
      return finalizeTurn(nextState, playerId);
    }

    if (card.ability === 'COMMANDERS_HORN') {
      if (!targetRow || !ROW_TYPES.includes(targetRow) || player.rows[targetRow].hornCard !== null) {
        return state;
      }
      const nextState = playHornSpecial(state, playerId, instance, remainingHand, targetRow);
      return finalizeTurn(nextState, playerId);
    }

    if (card.ability === 'DECOY') {
      if (!decoyTargetInstanceId) {
        return state;
      }
      const afterDecoy = resolveDecoy(state, playerId, instance, remainingHand, decoyTargetInstanceId);
      if (afterDecoy === state) {
        return state;
      }
      return finalizeTurn(afterDecoy, playerId);
    }

    if (card.ability === 'SCORCH') {
      const afterScorch = resolveScorchGlobal(state, playerId, instance, remainingHand);
      return finalizeTurn(afterScorch, playerId);
    }
  }

  return state;
}

function handleSelectTarget(
  state: GameState,
  action: Extract<GameAction, { type: 'SELECT_TARGET' }>,
): GameState {
  if (state.phase !== 'PENDING_SELECTION' || state.pendingSelection === null) {
    return state;
  }
  if (state.pendingSelection.playerId !== action.playerId) {
    return state;
  }

  if (state.pendingSelection.type === 'SCOIATAEL_START_CHOICE') {
    if (action.startingPlayer !== 'PLAYER_1' && action.startingPlayer !== 'PLAYER_2') {
      return state;
    }
    return {
      ...state,
      phase: 'PLAYING',
      activePlayer: action.startingPlayer,
      pendingSelection: null,
    };
  }

  let nextState = state;
  if (state.pendingSelection.type === 'MEDIC_DISCARD' && action.targetInstanceId) {
    nextState = resolveMedicSelection(state, action.playerId, action.targetInstanceId);
  } else if (state.pendingSelection.type === 'AGILE_ROW' && action.targetRow) {
    nextState = resolveAgileSelection(state, action.playerId, action.targetRow);
  } else if (state.pendingSelection.type === 'LEADER_TARGET' && action.targetInstanceId) {
    nextState = resolveLeaderTargetSelection(state, action.playerId, action.targetInstanceId);
  }

  if (nextState === state) {
    return state;
  }

  return finalizeTurn(nextState, action.playerId);
}

function handlePassTurn(state: GameState, action: Extract<GameAction, { type: 'PASS_TURN' }>): GameState {
  if (state.phase !== 'PLAYING' || state.activePlayer !== action.playerId) {
    return state;
  }

  const player = state.players[action.playerId];
  if (player.passed) {
    return state;
  }

  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        passed: true,
      },
    },
  };

  return finalizeTurn(nextState, action.playerId);
}

function advanceMulliganTurn(state: GameState): GameState {
  const p1 = state.players.PLAYER_1;
  const p2 = state.players.PLAYER_2;

  if (!p1.mulliganDone) {
    return { ...state, activePlayer: 'PLAYER_1' };
  }
  if (!p2.mulliganDone) {
    return { ...state, activePlayer: 'PLAYER_2' };
  }

  return resolveRound1StartState(state);
}

function handleMulliganSwap(
  state: GameState,
  action: Extract<GameAction, { type: 'MULLIGAN_SWAP' }>,
): GameState {
  if (state.phase !== 'MULLIGAN' || state.activePlayer !== action.playerId) {
    return state;
  }

  const player = state.players[action.playerId];
  if (player.mulliganDone || player.mulligansRemaining <= 0 || player.deck.length === 0) {
    return state;
  }

  const swapIndex = player.hand.findIndex((c) => c.instanceId === action.instanceId);
  if (swapIndex === -1) {
    return state;
  }

  const swappedCard = player.hand[swapIndex]!;
  const replacement = player.deck[0]!;
  const remainingDeck = player.deck.slice(1);
  const reshuffledDeck = shuffleDeterministic([...remainingDeck, swappedCard], state.rngSeed);

  const nextHand = player.hand.map((c, index) => (index === swapIndex ? replacement : c));
  const nextRemaining = player.mulligansRemaining - 1;

  const updatedState: GameState = {
    ...state,
    rngSeed: reshuffledDeck.nextSeed,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        hand: nextHand,
        deck: reshuffledDeck.items,
        mulligansRemaining: nextRemaining,
        mulliganDone: nextRemaining === 0,
      },
    },
  };

  return advanceMulliganTurn(updatedState);
}

function handleFinishMulligan(
  state: GameState,
  action: Extract<GameAction, { type: 'FINISH_MULLIGAN' }>,
): GameState {
  if (state.phase !== 'MULLIGAN' || state.activePlayer !== action.playerId) {
    return state;
  }

  const player = state.players[action.playerId];
  if (player.mulliganDone) {
    return state;
  }

  const updatedState: GameState = {
    ...state,
    players: {
      ...state.players,
      [action.playerId]: {
        ...player,
        mulligansRemaining: 0,
        mulliganDone: true,
      },
    },
  };

  return advanceMulliganTurn(updatedState);
}

/**
 * Pure state machine reducer advancing the match from a GameAction without mutating state.
 */
export function dispatch(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'MULLIGAN_SWAP':
      return handleMulliganSwap(state, action);
    case 'FINISH_MULLIGAN':
      return handleFinishMulligan(state, action);
    case 'PLAY_CARD':
      return handlePlayCard(state, action);
    case 'SELECT_TARGET':
      return handleSelectTarget(state, action);
    case 'PASS_TURN':
      return handlePassTurn(state, action);
    case 'ADVANCE_ROUND':
      return advanceToNextRound(state);
    case 'USE_LEADER': {
      const nextState = resolveLeaderUse(state, action.playerId);
      return nextState === state ? state : finalizeTurn(nextState, action.playerId);
    }
  }
}
