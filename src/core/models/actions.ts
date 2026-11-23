import type { PlayerId, RowType } from './types';

export type GameAction =
  | {
      readonly type: 'PLAY_CARD';
      readonly playerId: PlayerId;
      readonly instanceId: string;
      readonly targetRow?: RowType;
      readonly decoyTargetInstanceId?: string;
    }
  | {
      readonly type: 'PASS_TURN';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'USE_LEADER';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'SELECT_TARGET';
      readonly playerId: PlayerId;
      readonly targetInstanceId?: string;
      readonly targetRow?: RowType;
      readonly startingPlayer?: PlayerId;
    }
  | {
      readonly type: 'MULLIGAN_SWAP';
      readonly playerId: PlayerId;
      readonly instanceId: string;
    }
  | {
      readonly type: 'FINISH_MULLIGAN';
      readonly playerId: PlayerId;
    }
  | {
      readonly type: 'ADVANCE_ROUND';
    };
