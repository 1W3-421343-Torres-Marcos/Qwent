export type InputCommand =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'CONFIRM'
  | 'CANCEL'
  | 'PASS_START'
  | 'PASS_END'
  | 'LEADER'
  | 'ZONE_PREV'
  | 'ZONE_NEXT'
  | 'MENU';

export type InputSource = 'keyboard' | 'gamepad' | 'system';
export type InputDirection = Extract<InputCommand, 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'>;

export interface InputCommandEvent {
  readonly command: InputCommand;
  readonly source: InputSource;
  readonly timestamp: number;
  readonly holdId?: string;
}

export type KeyboardInputEvent = Pick<
  KeyboardEvent,
  'type' | 'key' | 'code' | 'keyCode' | 'repeat' | 'target'
>;

export interface GamepadSnapshot {
  readonly axes: ArrayLike<number>;
  readonly buttons: ArrayLike<Pick<GamepadButton, 'pressed' | 'value'>>;
}

export interface GamepadInputResult {
  readonly events: readonly InputCommandEvent[];
  readonly pressedButtons: readonly boolean[];
}

export interface InputCommandFilterState {
  readonly lastAcceptedAt: Readonly<Partial<Record<InputCommand, number>>>;
  readonly lastAcceptedEvent: InputCommandEvent | null;
}

export interface InputCommandFilterOptions {
  readonly repeatIntervalMs?: number;
  readonly deduplicationWindowMs?: number;
}

export interface InputCommandFilterResult {
  readonly accepted: boolean;
  readonly state: InputCommandFilterState;
}

export const INPUT_STICK_DEAD_ZONE = 0.45;
export const INPUT_REPEAT_INTERVAL_MS = 180;
export const INPUT_DEDUPLICATION_WINDOW_MS = 50;

const KEYBOARD_DIRECTION_MAP: Readonly<Record<string, InputDirection>> = {
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  KeyW: 'UP',
  KeyS: 'DOWN',
  KeyA: 'LEFT',
  KeyD: 'RIGHT',
};

const LETTER_SHORTCUTS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'x', 'y', 'm']);
const NAVIGATION_COMMANDS = new Set<InputCommand>(['UP', 'DOWN', 'LEFT', 'RIGHT']);

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object' || !('tagName' in target)) {
    return false;
  }
  const tagName = target.tagName;
  return typeof tagName === 'string' && ['INPUT', 'TEXTAREA'].includes(tagName.toUpperCase());
}

function keyboardKeyCommand(event: KeyboardInputEvent): InputCommand | null {
  const direction = KEYBOARD_DIRECTION_MAP[event.key] ?? KEYBOARD_DIRECTION_MAP[event.code];
  if (direction) return direction;

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space') {
    return 'CONFIRM';
  }
  if (event.key === 'Select' || event.keyCode === 23) return 'CONFIRM';
  if (['Escape', 'Backspace', 'GoBack', 'BrowserBack'].includes(event.key)) return 'CANCEL';
  if (event.key.toLowerCase() === 'y' || event.code === 'KeyY') {
    return event.type === 'keyup' ? 'PASS_END' : 'PASS_START';
  }
  if (event.key.toLowerCase() === 'x' || event.code === 'KeyX') return 'LEADER';
  if (event.key.toLowerCase() === 'q' || event.code === 'KeyQ') return 'ZONE_PREV';
  if (event.key.toLowerCase() === 'e' || event.code === 'KeyE') return 'ZONE_NEXT';
  if (event.key.toLowerCase() === 'm' || event.code === 'KeyM') return 'MENU';
  return null;
}

function isLetterShortcut(event: KeyboardInputEvent): boolean {
  const key = event.key.toLowerCase();
  const codeKey = event.code.startsWith('Key') ? event.code.slice(3).toLowerCase() : '';
  return LETTER_SHORTCUTS.has(key) || LETTER_SHORTCUTS.has(codeKey);
}

/**
 * Converts a keyboard event into a semantic command without mutating state.
 */
export function normalizeKeyboardEvent(
  event: KeyboardInputEvent,
  timestamp: number,
): InputCommandEvent | null {
  if (event.type !== 'keydown' && event.type !== 'keyup') return null;

  const command = keyboardKeyCommand(event);
  if (!command) return null;

  if (isTextEntryTarget(event.target) && isLetterShortcut(event)) return null;
  if (
    event.repeat &&
    command !== 'PASS_END' &&
    (command === 'PASS_START' || !NAVIGATION_COMMANDS.has(command))
  ) {
    return null;
  }
  if (event.type === 'keyup' && command === 'CONFIRM') {
    return {
      command: 'PASS_END',
      source: 'keyboard',
      timestamp,
      holdId: 'keyboard-confirm',
    };
  }
  if (event.type === 'keyup' && command === 'PASS_END') {
    return {
      command: 'PASS_END',
      source: 'keyboard',
      timestamp,
      holdId: 'keyboard-y',
    };
  }
  if (event.type === 'keyup') return null;
  if (command === 'PASS_END') return null;

  return {
    command,
    source: 'keyboard',
    timestamp,
    ...(command === 'PASS_START' ? { holdId: 'keyboard-y' } : {}),
  };
}

function buttonPressed(button: Pick<GamepadButton, 'pressed' | 'value'> | undefined): boolean {
  return button !== undefined && (button.pressed || button.value >= 0.5);
}

function finiteAxis(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

/**
 * Converts a standard-mapped Gamepad snapshot into button edges and stick directions.
 */
export function normalizeGamepadSnapshot(
  gamepad: GamepadSnapshot,
  previousPressedButtons: readonly boolean[],
  timestamp: number,
): GamepadInputResult {
  const pressedButtons = Array.from(gamepad.buttons, buttonPressed);
  const events: InputCommandEvent[] = [];
  const emitted = new Set<InputCommand>();
  const emit = (command: InputCommand): void => {
    if (emitted.has(command)) return;
    emitted.add(command);
    events.push({ command, source: 'gamepad', timestamp });
  };

  const buttonCommands: Readonly<Record<number, InputCommand>> = {
    0: 'CONFIRM',
    1: 'CANCEL',
    2: 'LEADER',
    3: 'PASS_START',
    4: 'ZONE_PREV',
    5: 'ZONE_NEXT',
    9: 'MENU',
    12: 'UP',
    13: 'DOWN',
    14: 'LEFT',
    15: 'RIGHT',
  };

  for (const [indexText, command] of Object.entries(buttonCommands)) {
    const index = Number(indexText);
    const wasPressed = previousPressedButtons[index] ?? false;
    const isPressed = pressedButtons[index] ?? false;
    if (
      isPressed &&
      (!wasPressed || NAVIGATION_COMMANDS.has(command)) &&
      !emitted.has(command)
    ) {
      events.push({
        command,
        source: 'gamepad',
        timestamp,
        ...(command === 'PASS_START' ? { holdId: 'gamepad-y' } : {}),
      });
      emitted.add(command);
    }
    if (command === 'PASS_START' && wasPressed && !isPressed) {
      events.push({
        command: 'PASS_END',
        source: 'gamepad',
        timestamp,
        holdId: 'gamepad-y',
      });
    }
    if (command === 'CONFIRM' && wasPressed && !isPressed) {
      events.push({
        command: 'PASS_END',
        source: 'gamepad',
        timestamp,
        holdId: 'gamepad-confirm',
      });
    }
  }

  const x = finiteAxis(gamepad.axes[0]);
  const y = finiteAxis(gamepad.axes[1]);
  const horizontal = Math.abs(x) >= INPUT_STICK_DEAD_ZONE;
  const vertical = Math.abs(y) >= INPUT_STICK_DEAD_ZONE;
  if (horizontal && vertical) {
    if (Math.abs(x) >= Math.abs(y)) emit(x < 0 ? 'LEFT' : 'RIGHT');
    else emit(y < 0 ? 'UP' : 'DOWN');
  } else if (horizontal) {
    emit(x < 0 ? 'LEFT' : 'RIGHT');
  } else if (vertical) {
    emit(y < 0 ? 'UP' : 'DOWN');
  }

  return { events, pressedButtons };
}

export function createInputCommandFilterState(): InputCommandFilterState {
  return { lastAcceptedAt: {}, lastAcceptedEvent: null };
}

/**
 * Filters rapid navigation repeats and cross-device duplicate commands.
 */
export function filterInputCommand(
  event: InputCommandEvent,
  state: InputCommandFilterState,
  options: InputCommandFilterOptions = {},
): InputCommandFilterResult {
  const repeatIntervalMs = options.repeatIntervalMs ?? INPUT_REPEAT_INTERVAL_MS;
  const deduplicationWindowMs = options.deduplicationWindowMs ?? INPUT_DEDUPLICATION_WINDOW_MS;
  const lastEvent = state.lastAcceptedEvent;

  if (
    lastEvent &&
    lastEvent.command === event.command &&
    lastEvent.source !== event.source &&
    event.timestamp - lastEvent.timestamp >= 0 &&
    event.timestamp - lastEvent.timestamp <= deduplicationWindowMs
  ) {
    return { accepted: false, state };
  }

  const lastAcceptedAt = state.lastAcceptedAt[event.command];
  if (
    NAVIGATION_COMMANDS.has(event.command) &&
    lastAcceptedAt !== undefined &&
    event.timestamp - lastAcceptedAt >= 0 &&
    event.timestamp - lastAcceptedAt < repeatIntervalMs
  ) {
    return { accepted: false, state };
  }

  return {
    accepted: true,
    state: {
      lastAcceptedAt: { ...state.lastAcceptedAt, [event.command]: event.timestamp },
      lastAcceptedEvent: event,
    },
  };
}

export function createPassEndEvent(
  passIsActive: boolean,
  timestamp: number,
  source: InputSource = 'system',
): InputCommandEvent | null {
  return passIsActive ? { command: 'PASS_END', source, timestamp } : null;
}
