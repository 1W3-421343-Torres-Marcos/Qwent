import type { LeaderAbilityType, PlayerId } from '../models/types';
import type { GameState } from '../models/game-state';

function isCancelledByAnyLeader(state: GameState): boolean {
  return (
    state.players.PLAYER_1.leader?.leaderAbility === 'CANCEL_ENEMY_LEADER' ||
    state.players.PLAYER_2.leader?.leaderAbility === 'CANCEL_ENEMY_LEADER'
  );
}

/**
 * Checks whether a global match-wide passive leader ability (Hearts of Stone)
 * is currently active for either player and not nullified by CANCEL_ENEMY_LEADER.
 */
export function isPassiveLeaderActive(state: GameState, ability: LeaderAbilityType): boolean {
  if (isCancelledByAnyLeader(state)) {
    return false;
  }

  return (
    state.players.PLAYER_1.leader?.leaderAbility === ability ||
    state.players.PLAYER_2.leader?.leaderAbility === ability
  );
}

/**
 * Checks whether a per-player passive leader ability (such as King Bran's HALF_WEATHER_PENALTY)
 * is currently active for `playerId` and not nullified by CANCEL_ENEMY_LEADER.
 */
export function isPlayerPassiveLeaderActive(
  state: GameState,
  playerId: PlayerId,
  ability: LeaderAbilityType,
): boolean {
  if (isCancelledByAnyLeader(state)) {
    return false;
  }

  return state.players[playerId].leader?.leaderAbility === ability;
}
