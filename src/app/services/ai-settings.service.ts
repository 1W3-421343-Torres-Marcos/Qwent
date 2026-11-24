import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_AI_DIFFICULTY,
  isValidAIDifficulty,
  type AIDifficulty,
} from '../../core';

const STORAGE_KEY = 'qwent.ai.v1';

interface StoredAiSettingsV1 {
  readonly version: 1;
  readonly difficulty: AIDifficulty;
}

@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  readonly difficulty = signal<AIDifficulty>(this.loadInitialDifficulty());

  setDifficulty(next: AIDifficulty): void {
    if (!isValidAIDifficulty(next)) {
      return;
    }
    this.difficulty.set(next);
    this.persist(next);
  }

  private loadInitialDifficulty(): AIDifficulty {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return DEFAULT_AI_DIFFICULTY;
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_AI_DIFFICULTY;
      const parsed = JSON.parse(raw) as Partial<StoredAiSettingsV1> | null;
      if (!parsed || parsed.version !== 1 || !isValidAIDifficulty(parsed.difficulty)) {
        return DEFAULT_AI_DIFFICULTY;
      }
      return parsed.difficulty;
    } catch {
      return DEFAULT_AI_DIFFICULTY;
    }
  }

  private persist(difficulty: AIDifficulty): void {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return;
      const payload: StoredAiSettingsV1 = {
        version: 1,
        difficulty,
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Safe offline fallback if localStorage is unavailable
    }
  }
}
