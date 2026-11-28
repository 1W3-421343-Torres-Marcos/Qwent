import { describe, expect, it } from 'vitest';
import {
  findNearestFocusable,
  findNextFocusable,
  getActiveFocusScope,
  isFocusScopeAllowed,
  popFocusScope,
  pushFocusScope,
  type FocusableRegion,
} from '../spatial-focus.utils';

const regions: readonly FocusableRegion[] = [
  { id: 'left', rect: { left: 0, top: 0, right: 40, bottom: 40 }, scopeId: 'board', groupId: 'hand' },
  { id: 'center', rect: { left: 50, top: 0, right: 90, bottom: 40 }, scopeId: 'board', groupId: 'hand' },
  { id: 'below', rect: { left: 50, top: 50, right: 90, bottom: 90 }, scopeId: 'board' },
  { id: 'modal', rect: { left: 55, top: 5, right: 95, bottom: 45 }, scopeId: 'modal' },
  { id: 'disabled', rect: { left: 100, top: 0, right: 140, bottom: 40 }, scopeId: 'board', disabled: true },
];

describe('spatial-focus.utils', () => {
  it('selects the nearest candidate in the requested direction within the same scope', () => {
    expect(findNextFocusable('left', 'RIGHT', regions)).toBe('center');
    expect(findNextFocusable('center', 'DOWN', regions)).toBe('below');
    expect(findNextFocusable('center', 'RIGHT', regions)).toBeNull();
    expect(findNextFocusable('missing', 'RIGHT', regions)).toBeNull();
  });

  it('restores focus to the closest enabled neighbor in the same scope and group', () => {
    const remaining = regions.filter((region) => region.id !== 'center');
    expect(
      findNearestFocusable(
        { left: 50, top: 0, right: 90, bottom: 40 },
        remaining,
        'board',
        'hand',
      ),
    ).toBe('left');
    expect(
      findNearestFocusable(
        { left: 100, top: 0, right: 140, bottom: 40 },
        regions,
        'board',
      ),
    ).toBe('center');
  });

  it('pushes and removes focus scopes immutably and restricts a trapping scope', () => {
    const initial = [{ id: 'root', trapsFocus: false }] as const;
    const withModal = pushFocusScope(initial, { id: 'modal', trapsFocus: true });

    expect(getActiveFocusScope(withModal)?.id).toBe('modal');
    expect(isFocusScopeAllowed('modal', withModal)).toBe(true);
    expect(isFocusScopeAllowed('root', withModal)).toBe(false);
    expect(popFocusScope(withModal, 'modal')).toEqual(initial);
    expect(initial).toHaveLength(1);
  });

  it('does not trap focus when the active scope is non-modal', () => {
    const stack = pushFocusScope([], { id: 'section', trapsFocus: false });
    expect(isFocusScopeAllowed('outside', stack)).toBe(true);
  });

  it('allows only the designated target group inside a trapping focus scope', () => {
    const stack = pushFocusScope([], {
      id: 'selection',
      trapsFocus: true,
      focusGroup: 'play-target',
    });
    expect(isFocusScopeAllowed('board', stack, 'play-target')).toBe(true);
    expect(isFocusScopeAllowed('board', stack, 'hand')).toBe(false);
  });
});
