import type { LeaderAbilityType } from '../models/types';
import type { GameState } from '../models/game-state';

/**
 * Checks whether a global match-wide passive leader ability (Hearts of Stone)
 * is currently active for either player and not nullified by CANCEL_ENEMY_LEADER.
 */
export function isPassiveLeaderActive(state: GameState, ability: LeaderAbilityType): boolean {
  const p1Ability = state.players.PLAYER_1.leader?.leaderAbility;
  const p2Ability = state.players.PLAYER_2.leader?.leaderAbility;

  if (p1Ability === 'CANCEL_ENEMY_LEADER' || p2Ability === 'CANCEL_ENEMY_LEADER') {
    return false;
  }

  return p1Ability === ability || p2Ability === ability;
}
