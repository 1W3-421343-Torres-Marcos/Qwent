export type FocusDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface FocusRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface FocusableRegion {
  readonly id: string;
  readonly rect: FocusRect;
  readonly scopeId: string;
  readonly groupId?: string;
  readonly disabled?: boolean;
}

export interface FocusScope {
  readonly id: string;
  readonly trapsFocus: boolean;
  readonly focusGroup?: string;
}

export type FocusScopeStack = readonly FocusScope[];

function center(rect: FocusRect): { readonly x: number; readonly y: number } {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

/**
 * Finds the closest region in the requested direction, remaining inside the current scope.
 */
export function findNextFocusable(
  currentId: string,
  direction: FocusDirection,
  regions: readonly FocusableRegion[],
): string | null {
  const current = regions.find((region) => region.id === currentId);
  if (!current) return null;

  const origin = center(current.rect);
  let best: { readonly id: string; readonly score: number } | null = null;
  for (const candidate of regions) {
    if (candidate.id === current.id || candidate.disabled || candidate.scopeId !== current.scopeId) {
      continue;
    }

    const destination = center(candidate.rect);
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const primary = direction === 'LEFT' || direction === 'RIGHT' ? dx : dy;
    const perpendicular = direction === 'LEFT' || direction === 'RIGHT' ? dy : dx;
    const isForward =
      direction === 'RIGHT' ? primary > 0 :
      direction === 'LEFT' ? primary < 0 :
      direction === 'DOWN' ? primary > 0 :
      primary < 0;
    if (!isForward) continue;

    const score = Math.abs(primary) + Math.abs(perpendicular) * 2;
    if (
      best === null ||
      score < best.score ||
      (score === best.score && candidate.id.localeCompare(best.id) < 0)
    ) {
      best = { id: candidate.id, score };
    }
  }
  return best?.id ?? null;
}

/**
 * Finds the nearest remaining region in the same scope and optional focus group.
 */
export function findNearestFocusable(
  originRect: FocusRect,
  regions: readonly FocusableRegion[],
  scopeId: string,
  groupId?: string,
): string | null {
  const origin = center(originRect);
  let best: { readonly id: string; readonly distance: number } | null = null;
  for (const candidate of regions) {
    if (
      candidate.disabled ||
      candidate.scopeId !== scopeId ||
      (groupId !== undefined && candidate.groupId !== groupId)
    ) {
      continue;
    }

    const destination = center(candidate.rect);
    const distance = Math.hypot(destination.x - origin.x, destination.y - origin.y);
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && candidate.id.localeCompare(best.id) < 0)
    ) {
      best = { id: candidate.id, distance };
    }
  }
  return best?.id ?? null;
}

export function pushFocusScope(stack: FocusScopeStack, scope: FocusScope): FocusScopeStack {
  return [...stack.filter((entry) => entry.id !== scope.id), scope];
}

export function popFocusScope(stack: FocusScopeStack, scopeId: string): FocusScopeStack {
  const index = stack.findIndex((scope) => scope.id === scopeId);
  if (index === -1) return stack;
  return [...stack.slice(0, index), ...stack.slice(index + 1)];
}

export function getActiveFocusScope(stack: FocusScopeStack): FocusScope | null {
  return stack[stack.length - 1] ?? null;
}

export function isFocusScopeAllowed(
  scopeId: string,
  stack: FocusScopeStack,
  groupId?: string,
): boolean {
  const activeTrap = [...stack].reverse().find((scope) => scope.trapsFocus);
  if (!activeTrap) return true;
  return (
    activeTrap.id === scopeId ||
    (activeTrap.focusGroup !== undefined && activeTrap.focusGroup === groupId)
  );
}
