import { ROW_TYPES, type AbilityType, type CardInstance, type LeaderAbilityType, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState, WeatherState } from '../models/game-state';
import { shuffleDeterministic } from '../engine/prng';
import { recalculateBoard, recalculatePlayer } from '../scoring/calculate-strength';
import { collectWeatherSlotDiscards, drawCards, resolveScorchRow } from './ability-resolver';
import { isPassiveLeaderActive, isPlayerPassiveLeaderActive } from './passive-leaders';

export const LEADER_HORN_DEFINITION_ID = 'leader_horn_effect' as const;

const WEATHER_KEY_BY_LEADER: Readonly<Partial<Record<LeaderAbilityType, { key: keyof WeatherState; ability: AbilityType }>>> = {
  PLAY_FROST_FROM_DECK: { key: 'frost', ability: 'WEATHER_FROST' },
  PLAY_FOG_FROM_DECK: { key: 'fog', ability: 'WEATHER_FOG' },
  PLAY_RAIN_FROM_DECK: { key: 'rain', ability: 'WEATHER_RAIN' },
};

const HORN_ROW_BY_LEADER: Readonly<Partial<Record<LeaderAbilityType, RowType>>> = {
  HORN_CLOSE_LEADER: 'CLOSE_COMBAT',
  HORN_RANGED_LEADER: 'RANGED',
  HORN_SIEGE_LEADER: 'SIEGE',
};

function getOpponent(playerId: PlayerId): PlayerId {
  return playerId === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
}

/**
 * Applies start-of-match passive leader abilities:
 * 1) CANCEL_ENEMY_LEADER disables both players' leaders before other start passives.
 * 2) DRAW_EXTRA_CARD_START draws 1 extra opening card if not cancelled, marking leader as used.
 * 3) RANDOMIZE_REVIVES / DOUBLE_SPY_STRENGTH mark their passive leaders as started/used.
 */
export function applyPassiveStartLeaders(
  p1: PlayerState,
  p2: PlayerState,
): { readonly p1: PlayerState; readonly p2: PlayerState } {
  const p1Cancels = p1.leader?.leaderAbility === 'CANCEL_ENEMY_LEADER';
  const p2Cancels = p2.leader?.leaderAbility === 'CANCEL_ENEMY_LEADER';

  let nextP1: PlayerState = p1Cancels || p2Cancels ? { ...p1, leaderUsed: true } : p1;
  let nextP2: PlayerState = p1Cancels || p2Cancels ? { ...p2, leaderUsed: true } : p2;

  const isStartPassive = (ability?: LeaderAbilityType): boolean =>
    ability === 'DRAW_EXTRA_CARD_START' ||
    ability === 'RANDOMIZE_REVIVES' ||
    ability === 'DOUBLE_SPY_STRENGTH' ||
    ability === 'HALF_WEATHER_PENALTY';

  if (isStartPassive(nextP1.leader?.leaderAbility) && !nextP1.leaderUsed) {
    nextP1 =
      nextP1.leader?.leaderAbility === 'DRAW_EXTRA_CARD_START'
        ? { ...drawCards(nextP1, 1), leaderUsed: true }
        : { ...nextP1, leaderUsed: true };
  }
  if (isStartPassive(nextP2.leader?.leaderAbility) && !nextP2.leaderUsed) {
    nextP2 =
      nextP2.leader?.leaderAbility === 'DRAW_EXTRA_CARD_START'
        ? { ...drawCards(nextP2, 1), leaderUsed: true }
        : { ...nextP2, leaderUsed: true };
  }

  return { p1: nextP1, p2: nextP2 };
}

/**
 * Checks whether `playerId` can legally activate their leader ability right now.
 */
export function canUseLeader(state: GameState, playerId: PlayerId): boolean {
  if (state.phase !== 'PLAYING' || state.activePlayer !== playerId) {
    return false;
  }

  const player = state.players[playerId];
  if (player.passed || !player.leader || player.leaderUsed || !player.leader.leaderAbility) {
    return false;
  }

  const ability = player.leader.leaderAbility;
  if (
    ability === 'CANCEL_ENEMY_LEADER' ||
    ability === 'DRAW_EXTRA_CARD_START' ||
    ability === 'RANDOMIZE_REVIVES' ||
    ability === 'DOUBLE_SPY_STRENGTH' ||
    ability === 'HALF_WEATHER_PENALTY'
  ) {
    return false;
  }

  const weatherConfig = WEATHER_KEY_BY_LEADER[ability];
  if (weatherConfig) {
    return player.deck.some((c) => c.card.ability === weatherConfig.ability);
  }

  const hornRow = HORN_ROW_BY_LEADER[ability];
  if (hornRow) {
    return player.rows[hornRow].hornCard === null;
  }

  if (ability === 'REVIVE_OWN_DISCARD_TO_HAND') {
    return player.discard.some((c) => c.card.type === 'UNIT' && !c.card.isHero);
  }

  if (ability === 'STEAL_ENEMY_DISCARD_TO_HAND') {
    const opponent = state.players[getOpponent(playerId)];
    return opponent.discard.some((c) => c.card.type === 'UNIT' && !c.card.isHero);
  }

  if (ability === 'OPTIMIZE_AGILE_ROWS') {
    return ROW_TYPES.some((row) =>
      player.rows[row].cards.some((c) => !c.card.isHero && c.card.allowedRows.length > 1),
    );
  }

  if (ability === 'SHUFFLE_DISCARDS_TO_DECK') {
    return state.players.PLAYER_1.discard.length > 0 || state.players.PLAYER_2.discard.length > 0;
  }

  return (
    ability === 'CLEAR_WEATHER_LEADER' ||
    ability === 'SCORCH_ENEMY_CLOSE_10' ||
    ability === 'SCORCH_ENEMY_RANGED_10' ||
    ability === 'SCORCH_ENEMY_SIEGE_10'
  );
}

/**
 * Resolves a player's Leader activation (once per match) and recalculates the board
 * or opens PENDING_SELECTION (LEADER_TARGET) when discard choice is needed.
 */
export function resolveLeaderUse(state: GameState, playerId: PlayerId): GameState {
  if (!canUseLeader(state, playerId)) {
    return state;
  }

  const player = state.players[playerId];
  const leader = player.leader!;
  const ability = leader.leaderAbility!;

  const baseState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        leaderUsed: true,
      },
    },
  };

  const weatherConfig = WEATHER_KEY_BY_LEADER[ability];
  if (weatherConfig) {
    const updatedPlayer = baseState.players[playerId];
    const matchIndex = updatedPlayer.deck.findIndex((c) => c.card.ability === weatherConfig.ability);
    if (matchIndex === -1) {
      return state;
    }

    const chosenWeather = updatedPlayer.deck[matchIndex]!;
    const remainingDeck = updatedPlayer.deck.filter((_, index) => index !== matchIndex);
    const slotOccupied = baseState.weather[weatherConfig.key] !== null;

    const nextWeather: WeatherState = slotOccupied
      ? baseState.weather
      : {
          ...baseState.weather,
          [weatherConfig.key]: { card: chosenWeather, owner: playerId },
        };

    return recalculateBoard({
      ...baseState,
      weather: nextWeather,
      players: {
        ...baseState.players,
        [playerId]: {
          ...updatedPlayer,
          deck: remainingDeck,
          discard: slotOccupied ? [...updatedPlayer.discard, chosenWeather] : updatedPlayer.discard,
        },
      },
    });
  }

  if (ability === 'CLEAR_WEATHER_LEADER') {
    const weatherDiscards = collectWeatherSlotDiscards(baseState.weather);

    return recalculateBoard({
      ...baseState,
      weather: { frost: null, fog: null, rain: null },
      players: {
        PLAYER_1: {
          ...baseState.players.PLAYER_1,
          discard: [...baseState.players.PLAYER_1.discard, ...weatherDiscards.PLAYER_1],
        },
        PLAYER_2: {
          ...baseState.players.PLAYER_2,
          discard: [...baseState.players.PLAYER_2.discard, ...weatherDiscards.PLAYER_2],
        },
      },
    });
  }

  const hornRow = HORN_ROW_BY_LEADER[ability];
  if (hornRow) {
    const updatedPlayer = baseState.players[playerId];
    const currentRow = updatedPlayer.rows[hornRow];
    if (currentRow.hornCard !== null) {
      return state;
    }

    const syntheticHorn: CardInstance = {
      instanceId: `${LEADER_HORN_DEFINITION_ID}_${playerId}_${hornRow}`,
      definitionId: LEADER_HORN_DEFINITION_ID,
      card: {
        id: LEADER_HORN_DEFINITION_ID,
        name: leader.name,
        faction: updatedPlayer.faction,
        type: 'SPECIAL',
        baseStrength: 0,
        isHero: false,
        allowedRows: [hornRow],
        ability: 'COMMANDERS_HORN',
        maxCopies: 1,
        description: leader.description,
      },
      effectiveStrength: 0,
    };

    return recalculateBoard({
      ...baseState,
      players: {
        ...baseState.players,
        [playerId]: {
          ...updatedPlayer,
          rows: {
            ...updatedPlayer.rows,
            [hornRow]: {
              ...currentRow,
              hornCard: syntheticHorn,
            },
          },
        },
      },
    });
  }

  if (ability === 'SCORCH_ENEMY_CLOSE_10') {
    return resolveScorchRow(baseState, playerId, 'CLOSE_COMBAT');
  }

  if (ability === 'SCORCH_ENEMY_RANGED_10') {
    return resolveScorchRow(baseState, playerId, 'RANGED');
  }

  if (ability === 'SCORCH_ENEMY_SIEGE_10') {
    return resolveScorchRow(baseState, playerId, 'SIEGE');
  }

  if (ability === 'OPTIMIZE_AGILE_ROWS') {
    return resolveOptimizeAgileRows(baseState, playerId);
  }

  if (ability === 'SHUFFLE_DISCARDS_TO_DECK') {
    const p1State = baseState.players.PLAYER_1;
    const p2State = baseState.players.PLAYER_2;
    if (p1State.discard.length === 0 && p2State.discard.length === 0) {
      return state;
    }

    const p1Reset = p1State.discard.map((c) => ({ ...c, effectiveStrength: c.card.baseStrength }));
    const p2Reset = p2State.discard.map((c) => ({ ...c, effectiveStrength: c.card.baseStrength }));
    const p1Shuffled = shuffleDeterministic([...p1State.deck, ...p1Reset], baseState.rngSeed);
    const p2Shuffled = shuffleDeterministic([...p2State.deck, ...p2Reset], p1Shuffled.nextSeed);

    return {
      ...baseState,
      rngSeed: p2Shuffled.nextSeed,
      players: {
        PLAYER_1: {
          ...p1State,
          deck: p1Shuffled.items,
          discard: [],
        },
        PLAYER_2: {
          ...p2State,
          deck: p2Shuffled.items,
          discard: [],
        },
      },
    };
  }

  if (ability === 'REVIVE_OWN_DISCARD_TO_HAND' || ability === 'STEAL_ENEMY_DISCARD_TO_HAND') {
    const source = ability === 'REVIVE_OWN_DISCARD_TO_HAND' ? 'OWN_DISCARD' : 'OPPONENT_DISCARD';
    const sourcePlayer =
      source === 'OWN_DISCARD' ? baseState.players[playerId] : baseState.players[getOpponent(playerId)];
    const eligible = sourcePlayer.discard.filter((c) => c.card.type === 'UNIT' && !c.card.isHero);

    if (eligible.length === 0) {
      return state;
    }

    return {
      ...baseState,
      phase: 'PENDING_SELECTION',
      pendingSelection: {
        type: 'LEADER_TARGET',
        playerId,
        leaderAbility: ability,
        source,
        eligibleInstanceIds: eligible.map((c) => c.instanceId),
      },
    };
  }

  return state;
}

/**
 * Completes a LEADER_TARGET selection by moving the chosen non-Hero unit from the source
 * discard pile into the activating player's hand.
 */
export function resolveLeaderTargetSelection(
  state: GameState,
  playerId: PlayerId,
  targetInstanceId: string,
): GameState {
  const pending = state.pendingSelection;
  if (
    state.phase !== 'PENDING_SELECTION' ||
    pending?.type !== 'LEADER_TARGET' ||
    pending.playerId !== playerId ||
    !pending.eligibleInstanceIds.includes(targetInstanceId)
  ) {
    return state;
  }

  const sourcePlayerId: PlayerId = pending.source === 'OWN_DISCARD' ? playerId : getOpponent(playerId);
  const sourcePlayer = state.players[sourcePlayerId];
  const chosen = sourcePlayer.discard.find((c) => c.instanceId === targetInstanceId);
  if (!chosen || chosen.card.type !== 'UNIT' || chosen.card.isHero) {
    return state;
  }

  const filteredDiscard = sourcePlayer.discard.filter((c) => c.instanceId !== targetInstanceId);
  const restoredCard: CardInstance = {
    ...chosen,
    effectiveStrength: chosen.card.baseStrength,
  };

  if (sourcePlayerId === playerId) {
    return {
      ...state,
      phase: 'PLAYING',
      pendingSelection: null,
      players: {
        ...state.players,
        [playerId]: {
          ...sourcePlayer,
          discard: filteredDiscard,
          hand: [...sourcePlayer.hand, restoredCard],
        },
      },
    };
  }

  const actingPlayer = state.players[playerId];
  return {
    ...state,
    phase: 'PLAYING',
    pendingSelection: null,
    players: {
      ...state.players,
      [sourcePlayerId]: {
        ...sourcePlayer,
        discard: filteredDiscard,
      },
      [playerId]: {
        ...actingPlayer,
        hand: [...actingPlayer.hand, restoredCard],
      },
    },
  };
}

function moveUnitBetweenRows(
  rows: Readonly<Record<RowType, PlayerState['rows'][RowType]>>,
  unit: CardInstance,
  fromRow: RowType,
  toRow: RowType,
): Readonly<Record<RowType, PlayerState['rows'][RowType]>> {
  return {
    ...rows,
    [fromRow]: {
      ...rows[fromRow],
      cards: rows[fromRow].cards.filter((c) => c.instanceId !== unit.instanceId),
    },
    [toRow]: {
      ...rows[toRow],
      cards: [...rows[toRow].cards, unit],
    },
  };
}

/**
 * Purely moves each non-Hero Agile unit on `player`'s board to the allowed row
 * that strictly maximizes the player's total score under `weather` and `doubleSpyStrength`.
 */
export function optimizeAgilePlayerRows(
  player: PlayerState,
  weather: WeatherState,
  doubleSpyStrength: boolean,
  halfWeatherPenalty = false,
): PlayerState {
  let currentPlayer = recalculatePlayer(player, weather, doubleSpyStrength, halfWeatherPenalty);

  const agileUnits: CardInstance[] = [];
  for (const rowType of ROW_TYPES) {
    for (const card of currentPlayer.rows[rowType].cards) {
      if (!card.card.isHero && card.card.allowedRows.length > 1) {
        agileUnits.push(card);
      }
    }
  }

  for (const agile of agileUnits) {
    let sourceRow: RowType | null = null;
    for (const rowType of ROW_TYPES) {
      if (currentPlayer.rows[rowType].cards.some((c) => c.instanceId === agile.instanceId)) {
        sourceRow = rowType;
        break;
      }
    }
    if (sourceRow === null) {
      continue;
    }

    let bestScore = currentPlayer.totalScore;
    let bestRows = currentPlayer.rows;

    for (const candidateRow of agile.card.allowedRows) {
      if (candidateRow === sourceRow) {
        continue;
      }
      const candidateRows = moveUnitBetweenRows(currentPlayer.rows, agile, sourceRow, candidateRow);
      const candidateScore = recalculatePlayer(
        { ...currentPlayer, rows: candidateRows },
        weather,
        doubleSpyStrength,
        halfWeatherPenalty,
      ).totalScore;
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestRows = candidateRows;
      }
    }

    if (bestRows !== currentPlayer.rows) {
      currentPlayer = recalculatePlayer(
        { ...currentPlayer, rows: bestRows },
        weather,
        doubleSpyStrength,
        halfWeatherPenalty,
      );
    }
  }

  return currentPlayer;
}

function resolveOptimizeAgileRows(state: GameState, playerId: PlayerId): GameState {
  const doubleSpyStrength = isPassiveLeaderActive(state, 'DOUBLE_SPY_STRENGTH');
  const halfWeatherPenalty = isPlayerPassiveLeaderActive(state, playerId, 'HALF_WEATHER_PENALTY');
  const currentPlayer = optimizeAgilePlayerRows(
    state.players[playerId],
    state.weather,
    doubleSpyStrength,
    halfWeatherPenalty,
  );

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: currentPlayer,
    },
  });
}
