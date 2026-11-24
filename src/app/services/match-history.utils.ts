import type { FactionId, GameState, PlayerId } from '../../core';

export type MatchOutcome = 'WIN' | 'LOSS' | 'DRAW';
export type MatchHistoryMode = 'VS_AI' | 'LOCAL_2P';

export interface MatchHistoryPlayerSummary {
  readonly name: string;
  readonly faction: FactionId;
  readonly leaderName: string;
}

export interface MatchHistoryRoundEntry {
  readonly roundNumber: number;
  readonly p1Score: number;
  readonly p2Score: number;
  readonly winner: PlayerId | 'DRAW';
}

export interface MatchHistoryEntry {
  readonly id: string;
  readonly playedAtIso: string;
  readonly mode: MatchHistoryMode;
  readonly player1: MatchHistoryPlayerSummary;
  readonly player2: MatchHistoryPlayerSummary;
  readonly winner: PlayerId | 'DRAW';
  readonly outcomeForP1: MatchOutcome;
  readonly rounds: readonly MatchHistoryRoundEntry[];
}

export interface MatchHistoryStats {
  readonly total: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
}

interface StoredHistoryPayloadV1 {
  readonly version: 1;
  readonly entries: readonly MatchHistoryEntry[];
}

export const MATCH_HISTORY_STORAGE_KEY = 'qwent.history.v1';
export const MAX_HISTORY_ENTRIES = 50;

const VALID_FACTIONS: ReadonlySet<string> = new Set([
  'NORTHERN_REALMS',
  'NILFGAARD',
  'MONSTERS',
  'SCOIATAEL',
  'NEUTRAL',
]);

const VALID_WINNERS: ReadonlySet<string> = new Set(['PLAYER_1', 'PLAYER_2', 'DRAW']);

function resolveOutcomeForP1(winner: PlayerId | 'DRAW'): MatchOutcome {
  if (winner === 'PLAYER_1') return 'WIN';
  if (winner === 'PLAYER_2') return 'LOSS';
  return 'DRAW';
}

function isPlayerSummaryValid(value: unknown): value is MatchHistoryPlayerSummary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MatchHistoryPlayerSummary>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.faction === 'string' &&
    VALID_FACTIONS.has(candidate.faction) &&
    typeof candidate.leaderName === 'string'
  );
}

function isRoundEntryValid(value: unknown): value is MatchHistoryRoundEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MatchHistoryRoundEntry>;
  return (
    typeof candidate.roundNumber === 'number' &&
    Number.isFinite(candidate.roundNumber) &&
    typeof candidate.p1Score === 'number' &&
    Number.isFinite(candidate.p1Score) &&
    typeof candidate.p2Score === 'number' &&
    Number.isFinite(candidate.p2Score) &&
    typeof candidate.winner === 'string' &&
    VALID_WINNERS.has(candidate.winner)
  );
}

function isHistoryEntryValid(value: unknown): value is MatchHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MatchHistoryEntry>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.playedAtIso === 'string' &&
    (candidate.mode === 'VS_AI' || candidate.mode === 'LOCAL_2P') &&
    isPlayerSummaryValid(candidate.player1) &&
    isPlayerSummaryValid(candidate.player2) &&
    typeof candidate.winner === 'string' &&
    VALID_WINNERS.has(candidate.winner) &&
    (candidate.outcomeForP1 === 'WIN' ||
      candidate.outcomeForP1 === 'LOSS' ||
      candidate.outcomeForP1 === 'DRAW') &&
    Array.isArray(candidate.rounds) &&
    candidate.rounds.every(isRoundEntryValid)
  );
}

/**
 * Maps a completed MATCH_END GameState into an immutable offline history entry.
 */
export function buildMatchHistoryEntry(
  state: GameState,
  mode: MatchHistoryMode,
  playedAtIso = new Date().toISOString(),
): MatchHistoryEntry {
  const winner: PlayerId | 'DRAW' = state.winner ?? 'DRAW';
  const p1 = state.players.PLAYER_1;
  const p2 = state.players.PLAYER_2;

  return {
    id: `${playedAtIso}_${state.rngSeed}_${state.roundHistory.length}`,
    playedAtIso,
    mode,
    player1: {
      name: p1.name,
      faction: p1.faction,
      leaderName: p1.leader?.name ?? 'Sin líder',
    },
    player2: {
      name: p2.name,
      faction: p2.faction,
      leaderName: p2.leader?.name ?? 'Sin líder',
    },
    winner,
    outcomeForP1: resolveOutcomeForP1(winner),
    rounds: state.roundHistory.map((round) => ({
      roundNumber: round.roundNumber,
      p1Score: round.scores.PLAYER_1,
      p2Score: round.scores.PLAYER_2,
      winner: round.winner,
    })),
  };
}

/**
 * Prepends the newest match entry and enforces the MAX_HISTORY_ENTRIES cap.
 */
export function appendHistoryEntry(
  existing: readonly MatchHistoryEntry[],
  entry: MatchHistoryEntry,
): readonly MatchHistoryEntry[] {
  return [entry, ...existing].slice(0, MAX_HISTORY_ENTRIES);
}

/**
 * Aggregates win/loss/draw totals and rounded win rate percentage for a list of matches.
 */
export function computeHistoryStats(
  entries: readonly MatchHistoryEntry[],
): MatchHistoryStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const entry of entries) {
    if (entry.outcomeForP1 === 'WIN') wins += 1;
    else if (entry.outcomeForP1 === 'LOSS') losses += 1;
    else draws += 1;
  }

  const total = entries.length;
  const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
  return { total, wins, losses, draws, winRate };
}

/**
 * Parses serialized history JSON safely, returning an empty list if corrupted or invalid.
 */
export function parseStoredHistory(raw: string | null): readonly MatchHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<StoredHistoryPayloadV1> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return [];
    }
    return parsed.entries.filter(isHistoryEntryValid).slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Serializes history entries under schema version 1 for localStorage persistence.
 */
export function serializeStoredHistory(entries: readonly MatchHistoryEntry[]): string {
  const payload: StoredHistoryPayloadV1 = {
    version: 1,
    entries: entries.slice(0, MAX_HISTORY_ENTRIES),
  };
  return JSON.stringify(payload);
}
