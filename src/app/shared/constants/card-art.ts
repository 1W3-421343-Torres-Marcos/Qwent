import { signal } from '@angular/core';
import { getCardSpritePath } from './card-art.utils';

export { getCardSpritePath };

/**
 * Tracks failed local portrait loads by resolved asset path so missing assets fall back cleanly to SVG emblems.
 */
export function createSpriteFallbackTracker() {
  const failedUrls = signal<ReadonlySet<string>>(new Set());

  return {
    spritePath: (cardId: string, instanceId?: string): string =>
      getCardSpritePath(cardId, instanceId),
    hasSprite: (cardId: string, instanceId?: string): boolean =>
      !failedUrls().has(getCardSpritePath(cardId, instanceId)),
    markFailed: (cardId: string, instanceId?: string): void => {
      const url = getCardSpritePath(cardId, instanceId);
      failedUrls.update((prev) => {
        if (prev.has(url)) return prev;
        const next = new Set(prev);
        next.add(url);
        return next;
      });
    },
  };
}
