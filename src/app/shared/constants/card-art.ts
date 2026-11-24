import { signal } from '@angular/core';

/**
 * Returns the local bundled portrait asset path for a Qwent card definition ID.
 */
export function getCardSpritePath(cardId: string): string {
  return `assets/cards/${cardId}.jpg`;
}

/**
 * Tracks failed local portrait loads by card ID so missing assets fall back cleanly to SVG emblems.
 */
export function createSpriteFallbackTracker() {
  const failedIds = signal<ReadonlySet<string>>(new Set());

  return {
    spritePath: getCardSpritePath,
    hasSprite: (cardId: string): boolean => !failedIds().has(cardId),
    markFailed: (cardId: string): void => {
      failedIds.update((prev) => {
        if (prev.has(cardId)) return prev;
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
    },
  };
}
