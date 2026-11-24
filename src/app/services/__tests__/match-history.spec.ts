import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createInitialGameState,
  type CardDefinition,
  type GameState,
  type PlayerId,
  type StarterDeckDefinition,
} from '../../../core';
import {
  MAX_HISTORY_ENTRIES,
  appendHistoryEntry,
  buildMatchHistoryEntry,
  computeHistoryStats,
  parseStoredHistory,
  serializeStoredHistory,
  type MatchHistoryEntry,
} from '../match-history.utils';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function buildMockFinishedMatch(winner: PlayerId | 'DRAW'): GameState {
  const deck1 = decks[0]!;
  const deck2 = decks[1]!;
  const base = createInitialGameState({
    rngSeed: 555,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'Tú · Norte',
      faction: deck1.faction,
      leader: catalog.find((c) => c.id === deck1.leaderId) ?? null,
      deckCardIds: deck1.cardIds,
    },
    player2: {
      name: 'IA · Nilfgaard',
      faction: deck2.faction,
      leader: catalog.find((c) => c.id === deck2.leaderId) ?? null,
      deckCardIds: deck2.cardIds,
    },
  });

  return {
    ...base,
    phase: 'MATCH_END',
    winner,
    roundHistory: [
      { roundNumber: 1, winner: 'PLAYER_1', scores: { PLAYER_1: 24, PLAYER_2: 18 } },
      { roundNumber: 2, winner: 'PLAYER_2', scores: { PLAYER_1: 12, PLAYER_2: 20 } },
      { roundNumber: 3, winner, scores: { PLAYER_1: 31, PLAYER_2: winner === 'PLAYER_1' ? 19 : 31 } },
    ],
  };
}

describe('Offline Match History Utils (U3.2)', () => {
  it('builds entries for WIN, LOSS and DRAW with leaders and round scores', () => {
    const winState = buildMockFinishedMatch('PLAYER_1');
    const winEntry = buildMatchHistoryEntry(winState, 'VS_AI', '2026-11-24T10:00:00.000Z');
    expect(winEntry.outcomeForP1).toBe('WIN');
    expect(winEntry.mode).toBe('VS_AI');
    expect(winEntry.player1.faction).toBe('NORTHERN_REALMS');
    expect(winEntry.player2.faction).toBe('NILFGAARD');
    expect(winEntry.rounds).toHaveLength(3);
    expect(winEntry.rounds[0]).toEqual({
      roundNumber: 1,
      p1Score: 24,
      p2Score: 18,
      winner: 'PLAYER_1',
    });

    const lossEntry = buildMatchHistoryEntry(buildMockFinishedMatch('PLAYER_2'), 'LOCAL_2P', '2026-11-24T10:05:00.000Z');
    expect(lossEntry.outcomeForP1).toBe('LOSS');
    expect(lossEntry.mode).toBe('LOCAL_2P');

    const drawEntry = buildMatchHistoryEntry(buildMockFinishedMatch('DRAW'), 'VS_AI', '2026-11-24T10:10:00.000Z');
    expect(drawEntry.outcomeForP1).toBe('DRAW');
  });

  it('prepends newest entry first and caps stored matches at MAX_HISTORY_ENTRIES (50)', () => {
    let entries: readonly MatchHistoryEntry[] = [];
    const baseState = buildMockFinishedMatch('PLAYER_1');

    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i += 1) {
      const item = buildMatchHistoryEntry(baseState, 'VS_AI', `2026-11-24T10:${String(i).padStart(2, '0')}:00.000Z`);
      entries = appendHistoryEntry(entries, { ...item, id: `match_${i}` });
    }

    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(entries[0]?.id).toBe(`match_${MAX_HISTORY_ENTRIES + 4}`);
    expect(entries[MAX_HISTORY_ENTRIES - 1]?.id).toBe('match_5');
  });

  it('computes aggregate win, loss, draw stats and handles empty lists', () => {
    expect(computeHistoryStats([])).toEqual({
      total: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
    });

    const win = buildMatchHistoryEntry(buildMockFinishedMatch('PLAYER_1'), 'VS_AI', '2026-11-24T10:00:00.000Z');
    const loss = buildMatchHistoryEntry(buildMockFinishedMatch('PLAYER_2'), 'VS_AI', '2026-11-24T10:01:00.000Z');
    const draw = buildMatchHistoryEntry(buildMockFinishedMatch('DRAW'), 'LOCAL_2P', '2026-11-24T10:02:00.000Z');

    expect(computeHistoryStats([win, win, loss, draw])).toEqual({
      total: 4,
      wins: 2,
      losses: 1,
      draws: 1,
      winRate: 50,
    });
  });

  it('serializes and parses cleanly while discarding corrupted JSON or wrong versions', () => {
    const entry = buildMatchHistoryEntry(buildMockFinishedMatch('PLAYER_1'), 'VS_AI', '2026-11-24T10:00:00.000Z');
    const json = serializeStoredHistory([entry]);
    expect(parseStoredHistory(json)).toEqual([entry]);

    const skEntry = buildMatchHistoryEntry(
      {
        ...buildMockFinishedMatch('PLAYER_2'),
        players: {
          PLAYER_1: {
            ...buildMockFinishedMatch('PLAYER_2').players.PLAYER_1,
            faction: 'SKELLIGE',
          },
          PLAYER_2: buildMockFinishedMatch('PLAYER_2').players.PLAYER_2,
        },
      },
      'VS_AI',
      '2026-11-24T10:15:00.000Z',
      'MASTER',
    );
    expect(skEntry.aiDifficulty).toBe('MASTER');
    expect(skEntry.player1.faction).toBe('SKELLIGE');
    expect(parseStoredHistory(serializeStoredHistory([skEntry, entry]))).toEqual([skEntry, entry]);

    expect(parseStoredHistory(null)).toEqual([]);
    expect(parseStoredHistory('{invalid json')).toEqual([]);
    expect(parseStoredHistory(JSON.stringify({ version: 2, entries: [entry] }))).toEqual([]);
    expect(
      parseStoredHistory(
        JSON.stringify({
          version: 1,
          entries: [entry, { broken: true }],
        }),
      ),
    ).toEqual([entry]);
  });
});
