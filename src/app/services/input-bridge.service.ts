import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import {
  createInputCommandFilterState,
  createPassEndEvent,
  filterInputCommand,
  isTextEntryTarget,
  normalizeGamepadSnapshot,
  normalizeKeyboardEvent,
  type InputCommandEvent,
  type InputCommandFilterState,
  type InputSource,
} from '../shared/utils/input-bridge.utils';

type PassHoldId =
  | 'keyboard-y'
  | 'gamepad-y'
  | 'keyboard-confirm'
  | 'gamepad-confirm'
  | 'touch-pointer';
export type InputMode = 'touch' | 'controller';

declare global {
  interface Window {
    QwentNative?: {
      exitApp: () => void;
      isTelevision?: () => boolean;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class InputBridgeService {
  private readonly destroyRef = inject(DestroyRef);
  private filterState: InputCommandFilterState = createInputCommandFilterState();
  private readonly activePassHolds = new Set<string>();
  private activeGamepadIndex: number | null = null;
  private previousGamepadButtons: readonly boolean[] = [];
  private animationFrameId: number | null = null;

  readonly inputMode = signal<InputMode>('touch');
  readonly modeChanges = new Subject<InputMode>();
  readonly commands = new Subject<InputCommandEvent>();

  private readonly onKeyDown = (event: KeyboardEvent): void => this.handleKeyboardEvent(event);
  private readonly onKeyUp = (event: KeyboardEvent): void => this.handleKeyboardEvent(event);
  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') {
      this.setInputMode('touch');
      this.cancelPassHolds();
    }
  };
  private readonly onWindowBlur = (): void => this.cancelPassHolds();
  private readonly onNativeBack = (): void => {
    this.commands.next({
      command: 'CANCEL',
      source: 'system',
      timestamp: this.now(),
    });
  };
  private readonly onGamepadConnected = (event: GamepadEvent): void => {
    if (this.activeGamepadIndex === null) {
      this.activeGamepadIndex = event.gamepad.index;
      this.previousGamepadButtons = [];
      this.startGamepadPolling();
    }
  };
  private readonly onGamepadDisconnected = (event: GamepadEvent): void => {
    this.cancelPassHolds();
    if (this.activeGamepadIndex !== event.gamepad.index) return;
    this.activeGamepadIndex = this.findConnectedGamepad()?.index ?? null;
    this.previousGamepadButtons = [];
    if (this.activeGamepadIndex === null) {
      this.stopGamepadPolling();
    }
  };

  constructor() {
    if (typeof window === 'undefined') return;

    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('qwent-native-back', this.onNativeBack);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);

    this.activeGamepadIndex = this.findConnectedGamepad()?.index ?? null;
    if (this.activeGamepadIndex !== null) {
      this.startGamepadPolling();
    }
    if (window.QwentNative?.isTelevision?.() === true) {
      this.setInputMode('controller');
    }

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', this.onKeyDown, true);
      document.removeEventListener('keyup', this.onKeyUp, true);
      window.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('blur', this.onWindowBlur);
      window.removeEventListener('qwent-native-back', this.onNativeBack);
      window.removeEventListener('gamepadconnected', this.onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
      this.stopGamepadPolling();
      this.cancelPassHolds();
      this.modeChanges.complete();
      this.commands.complete();
    });
  }

  beginPassHold(holdId: PassHoldId): void {
    const source: InputSource = holdId.startsWith('keyboard') ? 'keyboard' : 'gamepad';
    this.processInputEvent({
      command: 'PASS_START',
      source,
      timestamp: this.now(),
      holdId,
    });
  }

  endPassHold(holdId: PassHoldId): void {
    const source: InputSource = holdId.startsWith('keyboard') ? 'keyboard' : 'gamepad';
    this.processInputEvent({
      command: 'PASS_END',
      source,
      timestamp: this.now(),
      holdId,
    });
  }

  beginTouchPassHold(): void {
    this.processInputEvent({
      command: 'PASS_START',
      source: 'system',
      timestamp: this.now(),
      holdId: 'touch-pointer',
    });
  }

  endTouchPassHold(): void {
    this.processInputEvent({
      command: 'PASS_END',
      source: 'system',
      timestamp: this.now(),
      holdId: 'touch-pointer',
    });
  }

  private handleKeyboardEvent(event: KeyboardEvent): void {
    const activeTarget = typeof document !== 'undefined' ? document.activeElement : null;
    const isTextEntry = isTextEntryTarget(event.target) || isTextEntryTarget(activeTarget);
    if (event.type === 'keydown' && event.key === 'Tab' && !isTextEntry) {
      this.setInputMode('controller');
      return;
    }

    const effectiveTarget = isTextEntryTarget(event.target)
      ? event.target
      : isTextEntryTarget(activeTarget)
        ? activeTarget
        : event.target;
    const command = normalizeKeyboardEvent(
      {
        type: event.type,
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        repeat: event.repeat,
        target: effectiveTarget,
      },
      this.now(),
    );
    if (!command) return;
    if (event.type === 'keydown' && !isTextEntry) {
      event.preventDefault();
    }
    this.processInputEvent(command);
  }

  private processInputEvent(event: InputCommandEvent): void {
    if (event.source !== 'system') {
      this.setInputMode('controller');
    }

    if (event.source !== 'system') {
      const filtered = filterInputCommand(event, this.filterState);
      this.filterState = filtered.state;
      if (!filtered.accepted) return;
    }

    if (event.command === 'PASS_START') {
      const holdId = event.holdId ?? `${event.source}-hold`;
      if (this.activePassHolds.has(holdId)) return;
      const wasInactive = this.activePassHolds.size === 0;
      this.activePassHolds.add(holdId);
      if (wasInactive) this.commands.next(event);
      return;
    }

    if (event.command === 'PASS_END') {
      if (event.source === 'system') {
        if (event.holdId) {
          if (!this.activePassHolds.delete(event.holdId) || this.activePassHolds.size > 0) return;
          this.commands.next(event);
        } else {
          this.cancelPassHolds();
        }
        return;
      }
      const holdId = event.holdId ?? `${event.source}-hold`;
      if (!this.activePassHolds.delete(holdId) || this.activePassHolds.size > 0) return;
      this.commands.next(event);
      return;
    }

    this.commands.next(event);
  }

  private cancelPassHolds(): void {
    const event = createPassEndEvent(this.activePassHolds.size > 0, this.now());
    this.activePassHolds.clear();
    if (event) this.commands.next(event);
  }

  private setInputMode(mode: InputMode): void {
    const previous = this.inputMode();
    this.inputMode.set(mode);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('qwent-controller-mode', mode === 'controller');
    }
    if (previous !== mode) {
      this.modeChanges.next(mode);
    }
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private findConnectedGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    return Array.from(navigator.getGamepads()).find((gamepad) => gamepad !== null) ?? null;
  }

  private startGamepadPolling(): void {
    if (this.animationFrameId !== null || typeof window === 'undefined') return;
    this.animationFrameId = window.requestAnimationFrame(this.pollGamepad);
  }

  private stopGamepadPolling(): void {
    if (this.animationFrameId === null || typeof window === 'undefined') return;
    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  private readonly pollGamepad = (): void => {
    this.animationFrameId = null;
    const gamepad = this.getActiveGamepad();
    if (!gamepad) {
      this.cancelPassHolds();
      this.activeGamepadIndex = this.findConnectedGamepad()?.index ?? null;
      this.previousGamepadButtons = [];
      if (this.activeGamepadIndex !== null) {
        this.startGamepadPolling();
      }
      return;
    }

    const result = normalizeGamepadSnapshot(
      {
        axes: gamepad.axes,
        buttons: gamepad.buttons,
      },
      this.previousGamepadButtons,
      this.now(),
    );
    for (const event of result.events) {
      this.processInputEvent(event);
    }
    this.previousGamepadButtons = result.pressedButtons;
    this.startGamepadPolling();
  };

  private getActiveGamepad(): Gamepad | null {
    if (
      this.activeGamepadIndex === null ||
      typeof navigator === 'undefined' ||
      typeof navigator.getGamepads !== 'function'
    ) {
      return null;
    }
    return (
      Array.from(navigator.getGamepads()).find(
        (gamepad) => gamepad !== null && gamepad.index === this.activeGamepadIndex,
      ) ?? null
    );
  }
}
