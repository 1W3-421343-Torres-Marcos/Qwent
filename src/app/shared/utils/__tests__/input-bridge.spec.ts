import { describe, expect, it } from 'vitest';
import {
  INPUT_DEDUPLICATION_WINDOW_MS,
  INPUT_REPEAT_INTERVAL_MS,
  INPUT_STICK_DEAD_ZONE,
  createInputCommandFilterState,
  createPassEndEvent,
  filterInputCommand,
  normalizeGamepadSnapshot,
  normalizeKeyboardEvent,
  type GamepadSnapshot,
  type KeyboardInputEvent,
} from '../input-bridge.utils';

function keyEvent(
  key: string,
  options: Partial<KeyboardInputEvent> = {},
): KeyboardInputEvent {
  return {
    type: 'keydown',
    key,
    code: '',
    keyCode: 0,
    repeat: false,
    target: null,
    ...options,
  };
}

function gamepad(
  axes: readonly number[] = [0, 0],
  pressedIndices: readonly number[] = [],
): GamepadSnapshot {
  const pressed = new Set(pressedIndices);
  return {
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressed.has(index),
      value: pressed.has(index) ? 1 : 0,
    })),
  };
}

describe('input-bridge.utils', () => {
  it('normalizes keyboard navigation, Android TV aliases and hold-to-pass edges', () => {
    expect(normalizeKeyboardEvent(keyEvent('ArrowUp'), 1)?.command).toBe('UP');
    expect(normalizeKeyboardEvent(keyEvent('w', { code: 'KeyW' }), 2)?.command).toBe('UP');
    expect(normalizeKeyboardEvent(keyEvent('ArrowDown'), 2)?.command).toBe('DOWN');
    expect(normalizeKeyboardEvent(keyEvent('a', { code: 'KeyA' }), 2)?.command).toBe('LEFT');
    expect(normalizeKeyboardEvent(keyEvent('ArrowRight'), 2)?.command).toBe('RIGHT');
    expect(normalizeKeyboardEvent(keyEvent('Select'), 3)?.command).toBe('CONFIRM');
    expect(normalizeKeyboardEvent(keyEvent('Unidentified', { keyCode: 23 }), 4)?.command).toBe('CONFIRM');
    expect(normalizeKeyboardEvent(keyEvent('Enter'), 4)?.command).toBe('CONFIRM');
    expect(normalizeKeyboardEvent(keyEvent(' '), 4)?.command).toBe('CONFIRM');
    expect(normalizeKeyboardEvent(keyEvent('Escape'), 4)?.command).toBe('CANCEL');
    expect(normalizeKeyboardEvent(keyEvent('BrowserBack'), 5)?.command).toBe('CANCEL');
    expect(normalizeKeyboardEvent(keyEvent('Backspace'), 6)?.command).toBe('CANCEL');
    expect(normalizeKeyboardEvent(keyEvent('GoBack'), 7)?.command).toBe('CANCEL');
    expect(normalizeKeyboardEvent(keyEvent('y'), 8)?.command).toBe('PASS_START');
    expect(normalizeKeyboardEvent(keyEvent('x'), 8)?.command).toBe('LEADER');
    expect(normalizeKeyboardEvent(keyEvent('q'), 8)?.command).toBe('ZONE_PREV');
    expect(normalizeKeyboardEvent(keyEvent('e'), 8)?.command).toBe('ZONE_NEXT');
    expect(normalizeKeyboardEvent(keyEvent('m'), 8)?.command).toBe('MENU');
    expect(
      normalizeKeyboardEvent(keyEvent('y', { type: 'keyup', code: 'KeyY' }), 9)?.command,
    ).toBe('PASS_END');
    expect(
      normalizeKeyboardEvent(keyEvent('Enter', { type: 'keyup' }), 10),
    ).toMatchObject({ command: 'PASS_END', holdId: 'keyboard-confirm' });
  });

  it('ignores letter shortcuts in text fields and repeated non-navigation keys', () => {
    const input = new EventTarget();
    Object.defineProperty(input, 'tagName', { value: 'INPUT' });
    const textarea = new EventTarget();
    Object.defineProperty(textarea, 'tagName', { value: 'TEXTAREA' });

    expect(normalizeKeyboardEvent(keyEvent('w', { target: input }), 1)).toBeNull();
    expect(normalizeKeyboardEvent(keyEvent('Unidentified', { code: 'KeyX', target: textarea }), 2)).toBeNull();
    expect(normalizeKeyboardEvent(keyEvent('ArrowUp', { target: input }), 2)?.command).toBe('UP');
    expect(normalizeKeyboardEvent(keyEvent('y', { repeat: true }), 3)).toBeNull();
    expect(normalizeKeyboardEvent(keyEvent('x', { repeat: true }), 4)).toBeNull();
    expect(normalizeKeyboardEvent(keyEvent('ArrowDown', { repeat: true }), 5)?.command).toBe('DOWN');
    expect(normalizeKeyboardEvent(keyEvent('Enter', { type: 'keyup' }), 6)?.command).toBe('PASS_END');
  });

  it('maps standard gamepad buttons and left stick with a 0.45 dead zone', () => {
    expect(INPUT_STICK_DEAD_ZONE).toBe(0.45);
    const first = normalizeGamepadSnapshot(gamepad([0, 0], [0, 9, 12]), [], 100);
    expect(first.events.map(({ command }) => command)).toEqual(['CONFIRM', 'MENU', 'UP']);

    expect(
      normalizeGamepadSnapshot(gamepad([INPUT_STICK_DEAD_ZONE, 0]), [], 110).events.map(
        ({ command }) => command,
      ),
    ).toEqual(['RIGHT']);

    const held = normalizeGamepadSnapshot(
      gamepad([-0.44, 0], []),
      first.pressedButtons,
      120,
    );
    expect(held.events).toContainEqual(
      expect.objectContaining({ command: 'PASS_END', holdId: 'gamepad-confirm' }),
    );

    const stick = normalizeGamepadSnapshot(
      gamepad([-0.8, 0.6], []),
      first.pressedButtons,
      140,
    );
    expect(stick.events.map(({ command }) => command)).toEqual(['PASS_END', 'LEFT']);
  });

  it('maps standard face, shoulder, start and D-pad buttons', () => {
    const result = normalizeGamepadSnapshot(gamepad([0, 0], [0, 1, 2, 4, 5, 9, 12, 13, 14, 15]), [], 1);
    expect(result.events.map(({ command }) => command)).toEqual([
      'CONFIRM',
      'CANCEL',
      'LEADER',
      'ZONE_PREV',
      'ZONE_NEXT',
      'MENU',
      'UP',
      'DOWN',
      'LEFT',
      'RIGHT',
    ]);
  });

  it('repeats held gamepad D-pad directions for the 180ms command throttle', () => {
    const pressed = normalizeGamepadSnapshot(gamepad([0, 0], [12]), [], 10);
    const held = normalizeGamepadSnapshot(gamepad([0, 0], [12]), pressed.pressedButtons, 190);
    expect(pressed.events.map(({ command }) => command)).toEqual(['UP']);
    expect(held.events.map(({ command }) => command)).toEqual(['UP']);
  });

  it('emits PASS_END when the gamepad pass button is released', () => {
    const pressed = normalizeGamepadSnapshot(gamepad([0, 0], [3]), [], 10);
    const released = normalizeGamepadSnapshot(gamepad(), pressed.pressedButtons, 20);
    expect(pressed.events.map(({ command }) => command)).toEqual(['PASS_START']);
    expect(released.events.map(({ command }) => command)).toEqual(['PASS_END']);
  });

  it('emits a pass-end edge when the confirm button is released for hold-to-pass', () => {
    const pressed = normalizeGamepadSnapshot(gamepad([0, 0], [0]), [], 10);
    const released = normalizeGamepadSnapshot(gamepad(), pressed.pressedButtons, 20);
    expect(released.events).toContainEqual(
      expect.objectContaining({ command: 'PASS_END', holdId: 'gamepad-confirm' }),
    );
  });

  it('throttles repeated directions and deduplicates cross-device commands within 50ms', () => {
    let state = createInputCommandFilterState();
    const keyboardUp = { command: 'UP', source: 'keyboard', timestamp: 100 } as const;
    const first = filterInputCommand(keyboardUp, state);
    expect(first.accepted).toBe(true);
    state = first.state;

    const duplicate = filterInputCommand(
      { command: 'UP', source: 'gamepad', timestamp: 100 + INPUT_DEDUPLICATION_WINDOW_MS },
      state,
    );
    expect(duplicate.accepted).toBe(false);

    const throttled = filterInputCommand(
      { command: 'UP', source: 'keyboard', timestamp: 100 + INPUT_REPEAT_INTERVAL_MS - 1 },
      state,
    );
    expect(throttled.accepted).toBe(false);

    const repeat = filterInputCommand(
      { command: 'UP', source: 'keyboard', timestamp: 100 + INPUT_REPEAT_INTERVAL_MS },
      state,
    );
    expect(repeat.accepted).toBe(true);

    let confirmState = createInputCommandFilterState();
    const firstConfirm = filterInputCommand(
      { command: 'CONFIRM', source: 'keyboard', timestamp: 10 },
      confirmState,
    );
    confirmState = firstConfirm.state;
    expect(
      filterInputCommand(
        { command: 'CONFIRM', source: 'gamepad', timestamp: 10 + INPUT_DEDUPLICATION_WINDOW_MS },
        confirmState,
      ).accepted,
    ).toBe(false);
    expect(
      filterInputCommand(
        { command: 'CONFIRM', source: 'gamepad', timestamp: 11 + INPUT_DEDUPLICATION_WINDOW_MS },
        confirmState,
      ).accepted,
    ).toBe(true);
  });

  it('creates a pass cancellation only when a hold is active', () => {
    expect(createPassEndEvent(false, 10)).toBeNull();
    expect(createPassEndEvent(true, 11)).toEqual({
      command: 'PASS_END',
      source: 'system',
      timestamp: 11,
    });
  });
});
