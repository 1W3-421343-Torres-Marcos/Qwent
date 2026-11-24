import type { GameAction } from '../models/actions';
import { DEFAULT_AI_DIFFICULTY, type AIDifficulty } from './ai-difficulty';
import type { AIPlayerView } from './ai-view';
import {
  generatePlayCandidates,
  pickAgileRow,
  pickLeaderDiscardTarget,
  pickMedicTarget,
  pickMulliganSwap,
  pickScoiataelStarter,
  selectCandidateForDifficulty,
  shouldBotPass,
} from './heuristics';

/**
 * Pure bot decision entry point reading ONLY filtered AIPlayerView (never raw GameState).
 */
export function decideAction(
  view: AIPlayerView,
  difficulty: AIDifficulty = DEFAULT_AI_DIFFICULTY,
): GameAction {
  const botId = view.me.id;

  if (view.phase === 'MULLIGAN') {
    const swapId = pickMulliganSwap(view, difficulty);
    if (swapId !== null) {
      return {
        type: 'MULLIGAN_SWAP',
        playerId: botId,
        instanceId: swapId,
      };
    }
    return {
      type: 'FINISH_MULLIGAN',
      playerId: botId,
    };
  }

  if (view.phase === 'PENDING_SELECTION' && view.pendingSelection !== null) {
    if (view.pendingSelection.type === 'MEDIC_DISCARD') {
      const targetId = pickMedicTarget(view, view.pendingSelection.eligibleInstanceIds);
      return {
        type: 'SELECT_TARGET',
        playerId: botId,
        targetInstanceId: targetId,
      };
    }
    if (view.pendingSelection.type === 'AGILE_ROW') {
      const targetRow = pickAgileRow(
        view,
        view.pendingSelection.card,
        view.pendingSelection.allowedRows,
      );
      return {
        type: 'SELECT_TARGET',
        playerId: botId,
        targetRow,
      };
    }
    if (view.pendingSelection.type === 'LEADER_TARGET') {
      const targetId = pickLeaderDiscardTarget(
        view,
        view.pendingSelection.source,
        view.pendingSelection.eligibleInstanceIds,
      );
      return {
        type: 'SELECT_TARGET',
        playerId: botId,
        targetInstanceId: targetId,
      };
    }
    if (view.pendingSelection.type === 'SCOIATAEL_START_CHOICE') {
      return {
        type: 'SELECT_TARGET',
        playerId: botId,
        startingPlayer: pickScoiataelStarter(view),
      };
    }
  }

  if (view.phase === 'ROUND_END') {
    return { type: 'ADVANCE_ROUND' };
  }

  const candidates = generatePlayCandidates(view, difficulty);
  const chosenCandidate = selectCandidateForDifficulty(view, candidates, difficulty);

  if (shouldBotPass(view, chosenCandidate, difficulty)) {
    return {
      type: 'PASS_TURN',
      playerId: botId,
    };
  }

  return chosenCandidate!.action;
}
