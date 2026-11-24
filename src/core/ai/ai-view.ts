import type { CardDefinition, CardInstance, FactionId, PlayerId, RowType } from '../models/types';
import type {
  GamePhase,
  GameState,
  PendingSelection,
  PlayerState,
  RoundResult,
  RowState,
  WeatherState,
} from '../models/game-state';
import { canUseLeader } from '../abilities/leaders';
import { isPassiveLeaderActive, isPlayerPassiveLeaderActive } from '../abilities/passive-leaders';
import { getOpponentId } from '../engine/round-resolution';

export interface AIPlayerSelfView {
  readonly id: PlayerId;
  readonly faction: Exclude<FactionId, 'NEUTRAL'>;
  readonly leader: CardDefinition | null;
  readonly leaderUsed: boolean;
  readonly canUseLeader: boolean;
  readonly gems: number;
  readonly passed: boolean;
  readonly hand: readonly CardInstance[];
  readonly myDeckCount: number;
  readonly myDeckCardIds: readonly string[];
  readonly discard: readonly CardInstance[];
  readonly rows: Readonly<Record<RowType, RowState>>;
  readonly totalScore: number;
  readonly mulligansRemaining: number;
  readonly mulliganDone: boolean;
}

export interface AIOpponentView {
  readonly id: PlayerId;
  readonly faction: Exclude<FactionId, 'NEUTRAL'>;
  readonly leaderUsed: boolean;
  readonly gems: number;
  readonly passed: boolean;
  readonly handCount: number;
  readonly deckCount: number;
  readonly discard: readonly CardInstance[];
  readonly rows: Readonly<Record<RowType, RowState>>;
  readonly totalScore: number;
  readonly mulliganDone: boolean;
}

export interface AIPlayerView {
  readonly phase: GamePhase;
  readonly roundNumber: 1 | 2 | 3;
  readonly activePlayer: PlayerId;
  readonly weather: WeatherState;
  readonly doubleSpyStrength: boolean;
  readonly halfWeatherPenalty: boolean;
  readonly oppHalfWeatherPenalty: boolean;
  readonly pendingSelection: PendingSelection | null;
  readonly roundHistory: readonly RoundResult[];
  readonly me: AIPlayerSelfView;
  readonly opponent: AIOpponentView;
}

function toSelfView(player: PlayerState, leaderUsable: boolean): AIPlayerSelfView {
  // Sort deck IDs lexicographically so real draw order is never exposed to the bot
  const unorderedDeckIds = player.deck.map((c) => c.definitionId).sort();

  return {
    id: player.id,
    faction: player.faction,
    leader: player.leader,
    leaderUsed: player.leaderUsed,
    canUseLeader: leaderUsable,
    gems: player.gems,
    passed: player.passed,
    hand: player.hand,
    myDeckCount: player.deck.length,
    myDeckCardIds: unorderedDeckIds,
    discard: player.discard,
    rows: player.rows,
    totalScore: player.totalScore,
    mulligansRemaining: player.mulligansRemaining,
    mulliganDone: player.mulliganDone,
  };
}

function toOpponentView(player: PlayerState): AIOpponentView {
  return {
    id: player.id,
    faction: player.faction,
    leaderUsed: player.leaderUsed,
    gems: player.gems,
    passed: player.passed,
    handCount: player.hand.length,
    deckCount: player.deck.length,
    discard: player.discard,
    rows: player.rows,
    totalScore: player.totalScore,
    mulliganDone: player.mulliganDone,
  };
}

/**
 * Projects full GameState onto a filtered AIPlayerView that hides opponent hand,
 * opponent deck composition, and real draw order.
 */
export function createAIView(state: GameState, botId: PlayerId): AIPlayerView {
  const opponentId = getOpponentId(botId);

  return {
    phase: state.phase,
    roundNumber: state.roundNumber,
    activePlayer: state.activePlayer,
    weather: state.weather,
    doubleSpyStrength: isPassiveLeaderActive(state, 'DOUBLE_SPY_STRENGTH'),
    halfWeatherPenalty: isPlayerPassiveLeaderActive(state, botId, 'HALF_WEATHER_PENALTY'),
    oppHalfWeatherPenalty: isPlayerPassiveLeaderActive(state, opponentId, 'HALF_WEATHER_PENALTY'),
    pendingSelection: state.pendingSelection,
    roundHistory: state.roundHistory,
    me: toSelfView(state.players[botId], canUseLeader(state, botId)),
    opponent: toOpponentView(state.players[opponentId]),
  };
}
