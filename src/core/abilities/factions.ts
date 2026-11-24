import { ROW_TYPES, type CardInstance, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState } from '../models/game-state';
import { nextRng } from '../engine/prng';
import { drawCards } from './ability-resolver';

export interface MonstersCarryoverResult {
  readonly kept: { readonly rowType: RowType; readonly card: CardInstance } | null;
  readonly nextSeed: number;
}

export interface SkelligeReviveResult {
  readonly player: PlayerState;
  readonly revivedCount: number;
  readonly nextSeed: number;
}

/**
 * Resolves the round winner applying Nilfgaard's faction passive:
 * Nilfgaard wins tied rounds, except in a Nilfgaard vs. Nilfgaard mirror where a tie remains DRAW.
 */
export function resolveRoundWinnerWithFactions(
  p1: PlayerState,
  p2: PlayerState,
): PlayerId | 'DRAW' {
  if (p1.totalScore > p2.totalScore) {
    return 'PLAYER_1';
  }
  if (p2.totalScore > p1.totalScore) {
    return 'PLAYER_2';
  }

  const p1Nilf = p1.faction === 'NILFGAARD';
  const p2Nilf = p2.faction === 'NILFGAARD';

  if (p1Nilf && !p2Nilf) {
    return 'PLAYER_1';
  }
  if (p2Nilf && !p1Nilf) {
    return 'PLAYER_2';
  }
  return 'DRAW';
}

/**
 * Applies Northern Realms' faction passive: draws 1 bonus card when winning a round.
 */
export function applyNorthernRealmsWinDraw(player: PlayerState, wonLastRound: boolean): PlayerState {
  if (!wonLastRound || player.faction !== 'NORTHERN_REALMS') {
    return player;
  }
  return drawCards(player, 1);
}

/**
 * Applies Monsters' faction passive using deterministic PRNG:
 * selects 1 random non-Hero, non-Decoy unit from the player's board rows to carry over.
 */
export function selectMonstersCarryover(player: PlayerState, rngSeed: number): MonstersCarryoverResult {
  if (player.faction !== 'MONSTERS') {
    return { kept: null, nextSeed: rngSeed };
  }

  const eligible: Array<{ readonly rowType: RowType; readonly card: CardInstance }> = [];
  for (const rowType of ROW_TYPES) {
    for (const card of player.rows[rowType].cards) {
      if (!card.card.isHero && card.card.ability !== 'DECOY') {
        eligible.push({ rowType, card });
      }
    }
  }

  if (eligible.length === 0) {
    return { kept: null, nextSeed: rngSeed };
  }

  const step = nextRng(rngSeed);
  const chosenIndex = Math.min(eligible.length - 1, Math.floor(step.value * eligible.length));
  return {
    kept: eligible[chosenIndex]!,
    nextSeed: step.nextSeed,
  };
}

/**
 * Resolves who starts Round 1 using Scoia'tael's faction passive:
 * if exactly 1 player is SCOIATAEL, enters PENDING_SELECTION (SCOIATAEL_START_CHOICE);
 * otherwise (0 or mirror SCOIATAEL vs. SCOIATAEL), resolves deterministically via rngSeed coin flip.
 */
export function resolveRound1StartState(state: GameState): GameState {
  const p1Scoia = state.players.PLAYER_1.faction === 'SCOIATAEL';
  const p2Scoia = state.players.PLAYER_2.faction === 'SCOIATAEL';

  if (p1Scoia !== p2Scoia) {
    const chooser: PlayerId = p1Scoia ? 'PLAYER_1' : 'PLAYER_2';
    return {
      ...state,
      phase: 'PENDING_SELECTION',
      activePlayer: chooser,
      pendingSelection: {
        type: 'SCOIATAEL_START_CHOICE',
        playerId: chooser,
      },
    };
  }

  const coinFlip = nextRng(state.rngSeed);
  const startingPlayer: PlayerId = coinFlip.value < 0.5 ? 'PLAYER_1' : 'PLAYER_2';
  return {
    ...state,
    phase: 'PLAYING',
    activePlayer: startingPlayer,
    rngSeed: coinFlip.nextSeed,
    pendingSelection: null,
  };
}

/**
 * Applies Skellige's Round 3 faction passive using deterministic PRNG:
 * revives up to 2 random non-Hero units from discard directly onto their rows.
 */
export function applySkelligeRound3Revive(
  player: PlayerState,
  rngSeed: number,
): SkelligeReviveResult {
  if (player.faction !== 'SKELLIGE') {
    return { player, revivedCount: 0, nextSeed: rngSeed };
  }

  let currentPool = player.discard.filter((c) => c.card.type === 'UNIT' && !c.card.isHero);
  if (currentPool.length === 0) {
    return { player, revivedCount: 0, nextSeed: rngSeed };
  }

  let currentSeed = rngSeed;
  const revived: CardInstance[] = [];
  const countToRevive = Math.min(2, currentPool.length);

  for (let i = 0; i < countToRevive; i++) {
    const step = nextRng(currentSeed);
    currentSeed = step.nextSeed;
    const chosenIndex = Math.min(currentPool.length - 1, Math.floor(step.value * currentPool.length));
    const chosen = currentPool[chosenIndex]!;
    revived.push(chosen);
    currentPool = currentPool.filter((c) => c.instanceId !== chosen.instanceId);
  }

  const revivedIds = new Set(revived.map((c) => c.instanceId));
  const nextDiscard = player.discard.filter((c) => !revivedIds.has(c.instanceId));
  const nextRows: Record<RowType, PlayerState['rows'][RowType]> = {
    CLOSE_COMBAT: player.rows.CLOSE_COMBAT,
    RANGED: player.rows.RANGED,
    SIEGE: player.rows.SIEGE,
  };

  for (const unit of revived) {
    const rowType = unit.card.allowedRows[0] ?? 'CLOSE_COMBAT';
    const currentRow = nextRows[rowType];
    nextRows[rowType] = {
      ...currentRow,
      cards: [...currentRow.cards, { ...unit, effectiveStrength: unit.card.baseStrength }],
    };
  }

  return {
    player: {
      ...player,
      discard: nextDiscard,
      rows: nextRows,
    },
    revivedCount: revived.length,
    nextSeed: currentSeed,
  };
}
