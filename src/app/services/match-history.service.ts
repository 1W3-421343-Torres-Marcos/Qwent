import { Injectable, computed, signal } from '@angular/core';
import type { AIDifficulty, GameState } from '../../core';
import {
  MATCH_HISTORY_STORAGE_KEY,
  appendHistoryEntry,
  buildMatchHistoryEntry,
  computeHistoryStats,
  parseStoredHistory,
  serializeStoredHistory,
  type MatchHistoryEntry,
  type MatchHistoryMode,
} from './match-history.utils';

@Injectable({ providedIn: 'root' })
export class MatchHistoryService {
  private readonly entriesSignal = signal<readonly MatchHistoryEntry[]>(this.loadFromStorage());

  readonly entries = this.entriesSignal.asReadonly();
  readonly stats = computed(() => computeHistoryStats(this.entriesSignal()));

  recordCompletedMatch(state: GameState, mode: MatchHistoryMode, aiDifficulty?: AIDifficulty): void {
    const entry = buildMatchHistoryEntry(state, mode, undefined, aiDifficulty);
    const updated = appendHistoryEntry(this.entriesSignal(), entry);
    this.entriesSignal.set(updated);
    this.saveToStorage(updated);
  }

  clearHistory(): void {
    this.entriesSignal.set([]);
    this.saveToStorage([]);
  }

  private loadFromStorage(): readonly MatchHistoryEntry[] {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return [];
      return parseStoredHistory(storage.getItem(MATCH_HISTORY_STORAGE_KEY));
    } catch {
      return [];
    }
  }

  private saveToStorage(entries: readonly MatchHistoryEntry[]): void {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return;
      storage.setItem(MATCH_HISTORY_STORAGE_KEY, serializeStoredHistory(entries));
    } catch {
      // Ignore offline storage quota/permission errors
    }
  }
}
