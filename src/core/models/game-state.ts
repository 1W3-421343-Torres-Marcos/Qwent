import type { CardDefinition, CardInstance, FactionId, LeaderAbilityType, PlayerId, RowType } from './types';

export type GamePhase =
  | 'MULLIGAN'
  | 'PLAYING'
  | 'PENDING_SELECTION'
  | 'ROUND_END'
  | 'MATCH_END';

export interface RowState {
  readonly cards: readonly CardInstance[];
  readonly hornCard: CardInstance | null;
  readonly totalStrength: number;
  readonly mardroemeActive?: boolean;
}

export interface WeatherSlot {
  readonly card: CardInstance;
  readonly owner: PlayerId;
}

export interface WeatherState {
  readonly frost: WeatherSlot | null;
  readonly fog: WeatherSlot | null;
  readonly rain: WeatherSlot | null;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly faction: Exclude<FactionId, 'NEUTRAL'>;
  readonly leader: CardDefinition | null;
  readonly leaderUsed: boolean;
  readonly gems: number;
  readonly passed: boolean;
  readonly hand: readonly CardInstance[];
  readonly deck: readonly CardInstance[];
  readonly discard: readonly CardInstance[];
  readonly rows: Readonly<Record<RowType, RowState>>;
  readonly totalScore: number;
  readonly mulligansRemaining: number;
  readonly mulliganDone: boolean;
}

export interface RoundResult {
  readonly roundNumber: 1 | 2 | 3;
  readonly winner: PlayerId | 'DRAW';
  readonly scores: Readonly<Record<PlayerId, number>>;
}

export type PendingSelection =
  | { readonly type: 'MEDIC_DISCARD'; readonly playerId: PlayerId; readonly eligibleInstanceIds: readonly string[] }
  | {
      readonly type: 'AGILE_ROW';
      readonly playerId: PlayerId;
      readonly instanceId: string;
      readonly card: CardInstance;
      readonly allowedRows: readonly RowType[];
    }
  | { readonly type: 'HORN_ROW'; readonly playerId: PlayerId; readonly instanceId: string }
  | {
      readonly type: 'LEADER_TARGET';
      readonly playerId: PlayerId;
      readonly leaderAbility: LeaderAbilityType;
      readonly source: 'OWN_DISCARD' | 'OPPONENT_DISCARD';
      readonly eligibleInstanceIds: readonly string[];
    }
  | { readonly type: 'SCOIATAEL_START_CHOICE'; readonly playerId: PlayerId };

export interface GameState {
  readonly phase: GamePhase;
  readonly roundNumber: 1 | 2 | 3;
  readonly activePlayer: PlayerId;
  readonly rngSeed: number;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly weather: WeatherState;
  readonly pendingSelection: PendingSelection | null;
  readonly roundHistory: readonly RoundResult[];
  readonly winner: PlayerId | 'DRAW' | null;
}
