import { ROW_TYPES, type CardInstance, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState, WeatherState } from '../models/game-state';
import { nextRng } from '../engine/prng';
import { recalculateBoard } from '../scoring/calculate-strength';
import { isPassiveLeaderActive } from './passive-leaders';
import { transformBerserkerInstance } from './skellige-tokens';

/**
 * Collects unique active weather cards per owner across frost/fog/rain (deduplicating Skellige Storm).
 */
export function collectWeatherSlotDiscards(
  weather: WeatherState,
): Readonly<Record<PlayerId, readonly CardInstance[]>> {
  const p1Cards: CardInstance[] = [];
  const p2Cards: CardInstance[] = [];
  const seenInstanceIds = new Set<string>();

  for (const key of ['frost', 'fog', 'rain'] as const) {
    const slot = weather[key];
    if (slot === null || seenInstanceIds.has(slot.card.instanceId)) {
      continue;
    }
    seenInstanceIds.add(slot.card.instanceId);
    if (slot.owner === 'PLAYER_1') {
      p1Cards.push(slot.card);
    } else {
      p2Cards.push(slot.card);
    }
  }

  return { PLAYER_1: p1Cards, PLAYER_2: p2Cards };
}

function getOpponent(playerId: PlayerId): PlayerId {
  return playerId === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
}

/**
 * Draws up to `count` cards from the player's deck into their hand without error if fewer remain.
 */
export function drawCards(player: PlayerState, count: number): PlayerState {
  if (count <= 0 || player.deck.length === 0) {
    return player;
  }
  const drawn = player.deck.slice(0, count);
  const remainingDeck = player.deck.slice(count);
  return {
    ...player,
    hand: [...player.hand, ...drawn],
    deck: remainingDeck,
  };
}

/**
 * Checks whether a card on the player's board is a valid target for Decoy (non-Hero, non-Decoy).
 */
export function isValidDecoyTarget(instance: CardInstance): boolean {
  return !instance.card.isHero && instance.card.ability !== 'DECOY';
}

/**
 * Checks whether the player currently controls at least one valid Decoy target on the board.
 */
export function hasValidDecoyTarget(player: PlayerState): boolean {
  return ROW_TYPES.some((row) => player.rows[row].cards.some(isValidDecoyTarget));
}

/**
 * Places a Spy on the opponent's matching row and draws up to 2 cards for the acting player.
 */
export function resolveSpy(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  remainingHand: readonly CardInstance[],
  targetRow: RowType,
): GameState {
  const opponentId = getOpponent(playerId);
  const actingWithHand: PlayerState = {
    ...state.players[playerId],
    hand: remainingHand,
  };
  const actingAfterDraw = drawCards(actingWithHand, 2);

  const opponent = state.players[opponentId];
  const opponentRow = opponent.rows[targetRow];

  const nextOpponent: PlayerState = {
    ...opponent,
    rows: {
      ...opponent.rows,
      [targetRow]: {
        ...opponentRow,
        cards: [...opponentRow.cards, instance],
      },
    },
  };

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: actingAfterDraw,
      [opponentId]: nextOpponent,
    },
  });
}

/**
 * Replaces an eligible own non-Hero, non-Decoy board unit with Decoy (strength 0) and returns it to hand.
 */
export function resolveDecoy(
  state: GameState,
  playerId: PlayerId,
  decoyInstance: CardInstance,
  remainingHand: readonly CardInstance[],
  decoyTargetInstanceId: string,
): GameState {
  const player = state.players[playerId];
  let foundRow: RowType | null = null;
  let foundIndex = -1;
  let targetInstance: CardInstance | null = null;

  for (const rowType of ROW_TYPES) {
    const idx = player.rows[rowType].cards.findIndex((c) => c.instanceId === decoyTargetInstanceId);
    if (idx !== -1) {
      foundRow = rowType;
      foundIndex = idx;
      targetInstance = player.rows[rowType].cards[idx]!;
      break;
    }
  }

  if (foundRow === null || targetInstance === null || !isValidDecoyTarget(targetInstance)) {
    return state;
  }

  const row = player.rows[foundRow];
  const decoyToken: CardInstance = {
    ...decoyInstance,
    effectiveStrength: 0,
  };
  const updatedRowCards = row.cards.map((c, index) => (index === foundIndex ? decoyToken : c));
  const returnedCard: CardInstance = {
    ...targetInstance,
    effectiveStrength: targetInstance.card.baseStrength,
  };

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: [...remainingHand, returnedCard],
        rows: {
          ...player.rows,
          [foundRow]: {
            ...row,
            cards: updatedRowCards,
          },
        },
      },
    },
  });
}

/**
 * Summons all matching `musterGroup` unit copies from the player's hand and deck (never discard)
 * in a single non-recursive pass.
 */
export function resolveMuster(
  state: GameState,
  playerId: PlayerId,
  musterGroup: string,
  preferredRow?: RowType,
): GameState {
  const player = state.players[playerId];
  const isMatch = (c: CardInstance): boolean =>
    c.card.type === 'UNIT' && c.card.musterGroup === musterGroup;

  const fromHand = player.hand.filter(isMatch);
  const fromDeck = player.deck.filter(isMatch);
  const summoned = [...fromHand, ...fromDeck];

  if (summoned.length === 0) {
    return state;
  }

  const remainingHand = player.hand.filter((c) => !isMatch(c));
  const remainingDeck = player.deck.filter((c) => !isMatch(c));

  const nextRows: Record<RowType, PlayerState['rows'][RowType]> = {
    CLOSE_COMBAT: player.rows.CLOSE_COMBAT,
    RANGED: player.rows.RANGED,
    SIEGE: player.rows.SIEGE,
  };

  for (const unit of summoned) {
    const targetRow: RowType =
      preferredRow && unit.card.allowedRows.includes(preferredRow)
        ? preferredRow
        : unit.card.allowedRows[0]!;
    const currentRow = nextRows[targetRow];
    nextRows[targetRow] = {
      ...currentRow,
      cards: [...currentRow.cards, unit],
    };
  }

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: remainingHand,
        deck: remainingDeck,
        rows: nextRows,
      },
    },
  });
}

function resolveMedicEntry(state: GameState, playerId: PlayerId): GameState {
  const player = state.players[playerId];
  const eligible = player.discard.filter((c) => c.card.type === 'UNIT' && !c.card.isHero);
  if (eligible.length === 0) {
    return state;
  }

  if (isPassiveLeaderActive(state, 'RANDOMIZE_REVIVES')) {
    const rng = nextRng(state.rngSeed);
    const chosen = eligible[Math.floor(rng.value * eligible.length)]!;
    const nextState: GameState = {
      ...state,
      rngSeed: rng.nextSeed,
    };
    return reviveUnitFromDiscard(nextState, playerId, chosen.instanceId);
  }

  return {
    ...state,
    phase: 'PENDING_SELECTION',
    pendingSelection: {
      type: 'MEDIC_DISCARD',
      playerId,
      eligibleInstanceIds: eligible.map((c) => c.instanceId),
    },
  };
}

/**
 * Checks whether a board unit is eligible for Scorch destruction (non-Hero, non-Decoy).
 */
export function isScorchVulnerable(instance: CardInstance): boolean {
  return !instance.card.isHero && instance.card.ability !== 'DECOY';
}

function destroyMatchingUnitsInPlayerRows(
  player: PlayerState,
  predicate: (card: CardInstance, rowType: RowType) => boolean,
): PlayerState {
  const destroyed: CardInstance[] = [];
  const nextRows: Record<RowType, PlayerState['rows'][RowType]> = {
    CLOSE_COMBAT: player.rows.CLOSE_COMBAT,
    RANGED: player.rows.RANGED,
    SIEGE: player.rows.SIEGE,
  };

  for (const rowType of ROW_TYPES) {
    const row = player.rows[rowType];
    const survivors: CardInstance[] = [];
    for (const card of row.cards) {
      if (predicate(card, rowType)) {
        destroyed.push({ ...card, effectiveStrength: card.card.baseStrength });
      } else {
        survivors.push(card);
      }
    }
    if (survivors.length !== row.cards.length) {
      nextRows[rowType] = {
        ...row,
        cards: survivors,
      };
    }
  }

  if (destroyed.length === 0) {
    return player;
  }

  return {
    ...player,
    rows: nextRows,
    discard: [...player.discard, ...destroyed],
  };
}

/**
 * Marks `mardroemeActive` on `targetRow` for the remainder of the round and transforms
 * any Berserker units in that row into Vildkaarl / Young Vildkaarl tokens.
 */
export function resolveMardroemeOnRow(
  state: GameState,
  playerId: PlayerId,
  targetRow: RowType,
): GameState {
  const player = state.players[playerId];
  const row = player.rows[targetRow];
  const transformedCards = row.cards.map((card) =>
    card.card.ability === 'BERSERKER' ? transformBerserkerInstance(card) : card,
  );

  return recalculateBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        rows: {
          ...player.rows,
          [targetRow]: {
            ...row,
            cards: transformedCards,
            mardroemeActive: true,
          },
        },
      },
    },
  });
}

function applyScorchGlobalToBoard(state: GameState): GameState {
  const preparedState = recalculateBoard(state);

  let maxStrength = 0;
  for (const side of ['PLAYER_1', 'PLAYER_2'] as const) {
    for (const rowType of ROW_TYPES) {
      for (const unit of preparedState.players[side].rows[rowType].cards) {
        if (isScorchVulnerable(unit) && unit.effectiveStrength > maxStrength) {
          maxStrength = unit.effectiveStrength;
        }
      }
    }
  }

  if (maxStrength <= 0) {
    return preparedState;
  }

  const isTarget = (unit: CardInstance): boolean =>
    isScorchVulnerable(unit) && unit.effectiveStrength === maxStrength;

  return recalculateBoard({
    ...preparedState,
    players: {
      PLAYER_1: destroyMatchingUnitsInPlayerRows(preparedState.players.PLAYER_1, isTarget),
      PLAYER_2: destroyMatchingUnitsInPlayerRows(preparedState.players.PLAYER_2, isTarget),
    },
  });
}

/**
 * Resolves global Scorch: sends Scorch to caster's discard, finds highest effective strength
 * among non-Hero, non-Decoy units on both sides, destroys all tied units to their side's discard,
 * and recalculates the board immediately.
 */
export function resolveScorchGlobal(
  state: GameState,
  playerId: PlayerId,
  scorchInstance: CardInstance,
  remainingHand: readonly CardInstance[],
): GameState {
  const caster = state.players[playerId];
  return applyScorchGlobalToBoard({
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...caster,
        hand: remainingHand,
        discard: [...caster.discard, scorchInstance],
      },
    },
  });
}

/**
 * Resolves row Scorch (Villentretenmerth): checks opponent's mirror row total >= 10
 * (Heroes count toward threshold), destroys highest non-Hero, non-Decoy units in that row,
 * and recalculates immediately.
 */
export function resolveScorchRow(
  state: GameState,
  playerId: PlayerId,
  placedRow: RowType,
): GameState {
  const recalculated = recalculateBoard(state);
  const opponentId = getOpponent(playerId);
  const opponent = recalculated.players[opponentId];
  const mirrorRow = opponent.rows[placedRow];

  if (mirrorRow.totalStrength < 10) {
    return recalculated;
  }

  let maxStrength = 0;
  for (const unit of mirrorRow.cards) {
    if (isScorchVulnerable(unit) && unit.effectiveStrength > maxStrength) {
      maxStrength = unit.effectiveStrength;
    }
  }

  if (maxStrength <= 0) {
    return recalculated;
  }

  const updatedOpponent = destroyMatchingUnitsInPlayerRows(
    opponent,
    (unit, rowType) =>
      rowType === placedRow && isScorchVulnerable(unit) && unit.effectiveStrength === maxStrength,
  );

  return recalculateBoard({
    ...recalculated,
    players: {
      ...recalculated.players,
      [opponentId]: updatedOpponent,
    },
  });
}

/**
 * Resolves entry abilities for a unit just placed onto `placedRow`.
 */
export function resolveUnitEntry(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
  placedRow: RowType,
): GameState {
  if (instance.card.ability === 'MUSTER' && instance.card.musterGroup) {
    return resolveMuster(state, playerId, instance.card.musterGroup, placedRow);
  }
  if (instance.card.ability === 'MEDIC') {
    return resolveMedicEntry(state, playerId);
  }
  if (instance.card.ability === 'SCORCH_ROW') {
    return resolveScorchRow(state, playerId, placedRow);
  }
  if (instance.card.ability === 'SCORCH') {
    return applyScorchGlobalToBoard(state);
  }
  if (instance.card.ability === 'MARDROEME') {
    return resolveMardroemeOnRow(state, playerId, placedRow);
  }
  if (instance.card.ability === 'BERSERKER' && state.players[playerId].rows[placedRow].mardroemeActive) {
    return resolveMardroemeOnRow(state, playerId, placedRow);
  }
  return state;
}

function placeRevivedUnitOnRow(
  state: GameState,
  playerId: PlayerId,
  revived: CardInstance,
  targetRow: RowType,
): GameState {
  const player = state.players[playerId];
  const currentRow = player.rows[targetRow];

  const placedState = recalculateBoard({
    ...state,
    phase: 'PLAYING',
    pendingSelection: null,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        rows: {
          ...player.rows,
          [targetRow]: {
            ...currentRow,
            cards: [...currentRow.cards, revived],
          },
        },
      },
    },
  });

  return resolveUnitEntry(placedState, playerId, revived, targetRow);
}

function reviveUnitFromDiscard(
  state: GameState,
  playerId: PlayerId,
  targetInstanceId: string,
): GameState {
  const player = state.players[playerId];
  const revived = player.discard.find((c) => c.instanceId === targetInstanceId);
  if (!revived || revived.card.type !== 'UNIT' || revived.card.isHero) {
    return state;
  }

  const stateWithoutDiscard: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        discard: player.discard.filter((c) => c.instanceId !== targetInstanceId),
      },
    },
  };

  if (revived.card.ability === 'SPY') {
    const spyState = resolveSpy(
      stateWithoutDiscard,
      playerId,
      revived,
      stateWithoutDiscard.players[playerId].hand,
      revived.card.allowedRows[0]!,
    );
    return {
      ...spyState,
      phase: 'PLAYING',
      pendingSelection: null,
    };
  }

  if (revived.card.allowedRows.length > 1) {
    return {
      ...stateWithoutDiscard,
      phase: 'PENDING_SELECTION',
      pendingSelection: {
        type: 'AGILE_ROW',
        playerId,
        instanceId: revived.instanceId,
        card: revived,
        allowedRows: revived.card.allowedRows,
      },
    };
  }

  return placeRevivedUnitOnRow(
    stateWithoutDiscard,
    playerId,
    revived,
    revived.card.allowedRows[0]!,
  );
}

/**
 * Resolves MEDIC target selection: first removes the unit from discard, then routes Spies,
 * Agile units (via AGILE_ROW pending selection), or single-row units + chained abilities.
 */
export function resolveMedicSelection(
  state: GameState,
  playerId: PlayerId,
  targetInstanceId: string,
): GameState {
  const pending = state.pendingSelection;
  if (
    state.phase !== 'PENDING_SELECTION' ||
    pending?.type !== 'MEDIC_DISCARD' ||
    pending.playerId !== playerId ||
    !pending.eligibleInstanceIds.includes(targetInstanceId)
  ) {
    return state;
  }

  return reviveUnitFromDiscard(state, playerId, targetInstanceId);
}

/**
 * Resolves AGILE_ROW pending selection for a unit revived by Medic.
 */
export function resolveAgileSelection(
  state: GameState,
  playerId: PlayerId,
  targetRow: RowType,
): GameState {
  const pending = state.pendingSelection;
  if (
    state.phase !== 'PENDING_SELECTION' ||
    pending?.type !== 'AGILE_ROW' ||
    pending.playerId !== playerId ||
    !pending.allowedRows.includes(targetRow)
  ) {
    return state;
  }

  return placeRevivedUnitOnRow(state, playerId, pending.card, targetRow);
}
