import type { GameAction } from '../models/actions';
import type { AIPlayerView } from './ai-view';
import {
  generatePlayCandidates,
  pickAgileRow,
  pickMedicTarget,
  pickMulliganSwap,
  shouldBotPass,
} from './heuristics';

/**
 * Pure bot decision entry point reading ONLY filtered AIPlayerView (never raw GameState).
 */
export function decideAction(view: AIPlayerView): GameAction {
  const botId = view.me.id;

  if (view.phase === 'MULLIGAN') {
    const swapId = pickMulliganSwap(view);
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
  }

  if (view.phase === 'ROUND_END') {
    return { type: 'ADVANCE_ROUND' };
  }

  const candidates = generatePlayCandidates(view);
  const bestCandidate = candidates[0];

  if (shouldBotPass(view, bestCandidate)) {
    return {
      type: 'PASS_TURN',
      playerId: botId,
    };
  }

  return bestCandidate!.action;
}
