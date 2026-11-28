import { DestroyRef, Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { FeedbackService } from './feedback.service';
import { InputBridgeService } from './input-bridge.service';
import { isTextEntryTarget } from '../shared/utils/input-bridge.utils';
import {
  findNearestFocusable,
  findNextFocusable,
  getActiveFocusScope,
  isFocusScopeAllowed,
  popFocusScope,
  pushFocusScope,
  type FocusDirection,
  type FocusRect,
  type FocusScope,
  type FocusScopeStack,
  type FocusableRegion,
} from '../shared/utils/spatial-focus.utils';

interface FocusEntry {
  readonly id: string;
  readonly element: HTMLElement;
  groupId: string;
  scopeId: string;
  explicitScopeId?: string;
  initialFocus: boolean;
  rect: FocusRect;
}

interface FocusReturnPoint {
  readonly id: string;
  readonly rect: FocusRect;
  readonly groupId: string;
  readonly scopeId: string;
}

@Injectable({ providedIn: 'root' })
export class SpatialFocusService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly inputBridge = inject(InputBridgeService);
  private readonly feedback = inject(FeedbackService);
  private readonly entries = new Map<string, FocusEntry>();
  private readonly scopeReturnFocus = new Map<string, FocusReturnPoint | null>();
  private scopeStack: FocusScopeStack = [];
  private sequence = 0;
  private activeFocusId: string | null = null;
  private lastFocusedElement: HTMLElement | null = null;

  readonly cancelRequested = new Subject<void>();
  readonly menuRequested = new Subject<void>();
  private readonly onTabKeyDown = (event: KeyboardEvent): void => {
    if (
      event.key !== 'Tab' ||
      this.inputBridge.inputMode() !== 'controller' ||
      isTextEntryTarget(event.target) ||
      !getActiveFocusScope(this.scopeStack)?.trapsFocus
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.cycleFocus(event.shiftKey);
  };

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.onTabKeyDown, true);
    }
    const modeSubscription = this.inputBridge.modeChanges.subscribe((mode) => {
      if (mode === 'touch') {
        this.clearVisualFocus();
      }
    });
    const subscription = this.inputBridge.commands.subscribe((event) => {
      if (event.command === 'UP' || event.command === 'DOWN' || event.command === 'LEFT' || event.command === 'RIGHT') {
        this.moveFocus(event.command);
      } else if (event.command === 'CONFIRM') {
        this.activateFocusedElement(event.source);
      } else if (event.command === 'ZONE_PREV' || event.command === 'ZONE_NEXT') {
        this.cycleFocus(event.command === 'ZONE_PREV');
      } else if (event.command === 'CANCEL') {
        this.cancelRequested.next();
      } else if (event.command === 'MENU') {
        this.menuRequested.next();
      }
    });
    this.destroyRef.onDestroy(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', this.onTabKeyDown, true);
      }
      modeSubscription.unsubscribe();
      subscription.unsubscribe();
      this.clearVisualFocus();
      this.cancelRequested.complete();
      this.menuRequested.complete();
    });
  }

  register(
    element: HTMLElement,
    groupId = 'default',
    explicitScopeId?: string,
    initialFocus = false,
  ): string {
    const id = `qwent-focus-${++this.sequence}`;
    const scopeId = explicitScopeId ?? this.scopeIdFor(element);
    this.entries.set(id, {
      id,
      element,
      groupId,
      scopeId,
      explicitScopeId,
      initialFocus,
      rect: this.readRect(element),
    });

    if (this.activeFocusId === null && this.inputBridge.inputMode() === 'controller') {
      this.focusElement(id);
    }
    return id;
  }

  updateEntry(
    id: string,
    groupId: string,
    explicitScopeId?: string,
    initialFocus = false,
  ): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.groupId = groupId;
    entry.explicitScopeId = explicitScopeId;
    entry.initialFocus = initialFocus;
    entry.scopeId = explicitScopeId ?? this.scopeIdFor(entry.element);

    if (this.inputBridge.inputMode() === 'controller') {
      const active = this.activeFocusId ? this.entries.get(this.activeFocusId) : undefined;
      if (!active || !this.isAvailable(active)) {
        const activeScope = getActiveFocusScope(this.scopeStack);
        if (activeScope) {
          this.focusFirstInScope(activeScope.id);
        } else {
          const first = this.availableEntries()[0];
          if (first) this.focusElement(first.id);
        }
      }
    }
  }

  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.element.removeAttribute('data-qwent-focused');
    if (this.lastFocusedElement === entry.element) {
      this.lastFocusedElement = null;
    }
    this.entries.delete(id);

    if (this.activeFocusId !== id || this.inputBridge.inputMode() !== 'controller') {
      if (this.activeFocusId === id) this.activeFocusId = null;
      return;
    }
    this.activeFocusId = null;
    const fallback = this.findFallback(entry);
    if (fallback) this.focusElement(fallback.id);
  }

  focus(id: string): void {
    this.focusElement(id);
  }

  clearVisualFocus(): void {
    this.clearFocusedAttribute();
    if (this.activeFocusId) {
      this.entries.get(this.activeFocusId)?.element.removeAttribute('data-qwent-focused');
    }
  }

  focusFirstInScope(scopeId: string): void {
    const activeScope = getActiveFocusScope(this.scopeStack);
    const candidates = this.availableEntries().filter(
      (entry) =>
        entry.scopeId === scopeId ||
        (activeScope?.id === scopeId &&
          activeScope.focusGroup !== undefined &&
          entry.groupId === activeScope.focusGroup),
    );
    const candidate = candidates.find((entry) => entry.initialFocus) ?? candidates[0];
    if (candidate) this.focusElement(candidate.id);
  }

  openScope(scope: FocusScope): void {
    const activeEntry = this.activeFocusId ? this.entries.get(this.activeFocusId) : undefined;
    this.scopeReturnFocus.set(
      scope.id,
      activeEntry
        ? {
            id: activeEntry.id,
            rect: this.readRect(activeEntry.element),
            groupId: activeEntry.groupId,
            scopeId: this.resolveScopeId(activeEntry),
          }
        : null,
    );
    this.scopeStack = pushFocusScope(this.scopeStack, scope);
    if (scope.trapsFocus && this.inputBridge.inputMode() === 'controller') {
      queueMicrotask(() => this.focusFirstInScope(scope.id));
    }
  }

  updateScope(scope: FocusScope): void {
    const index = this.scopeStack.findIndex((entry) => entry.id === scope.id);
    if (index === -1) return;
    this.scopeStack = [
      ...this.scopeStack.slice(0, index),
      scope,
      ...this.scopeStack.slice(index + 1),
    ];
    if (scope.trapsFocus && this.inputBridge.inputMode() === 'controller') {
      queueMicrotask(() => this.focusFirstInScope(scope.id));
    }
  }

  closeScope(scopeId: string): void {
    this.scopeStack = popFocusScope(this.scopeStack, scopeId);
    const returnPoint = this.scopeReturnFocus.get(scopeId);
    this.scopeReturnFocus.delete(scopeId);

    const returnEntry = returnPoint ? this.entries.get(returnPoint.id) : undefined;
    if (returnEntry && this.isAvailable(returnEntry)) {
      this.focusElement(returnEntry.id);
      return;
    }

    if (this.inputBridge.inputMode() === 'controller') {
      if (returnPoint) {
        const candidates = this.availableEntries();
        const regions = candidates.map((entry) => this.toRegion(entry));
        const returnScopeId = returnEntry ? this.resolveScopeId(returnEntry) : returnPoint.scopeId;
        const nearest =
          findNearestFocusable(returnPoint.rect, regions, returnScopeId, returnPoint.groupId) ??
          findNearestFocusable(returnPoint.rect, regions, returnScopeId) ??
          findNearestFocusable(returnPoint.rect, regions, this.currentScopeId());
        if (nearest) {
          this.focusElement(nearest);
          return;
        }
      }
      const activeScope = getActiveFocusScope(this.scopeStack);
      if (activeScope) {
        const prevActive = this.activeFocusId;
        this.focusFirstInScope(activeScope.id);
        if (this.activeFocusId !== prevActive) return;
      }
      this.clearVisualFocus();
      this.activeFocusId = null;
    } else {
      this.clearVisualFocus();
    }
  }

  activate(element: HTMLElement, source: 'keyboard' | 'gamepad' | 'system' = 'system'): void {
    if (typeof HTMLSelectElement !== 'undefined' && element instanceof HTMLSelectElement) {
      this.activateSelect(element);
      return;
    }
    if (element.hasAttribute('data-qwent-pass')) {
      if (source === 'keyboard') this.inputBridge.beginPassHold('keyboard-confirm');
      if (source === 'gamepad') this.inputBridge.beginPassHold('gamepad-confirm');
      return;
    }
    element.click();
  }

  setTargetingScope(enabled: boolean): void {
    const scopeId = 'qwent-preplay-targets';
    const isOpen = this.scopeStack.some((scope) => scope.id === scopeId);
    if (enabled && !isOpen) {
      this.openScope({ id: scopeId, trapsFocus: true, focusGroup: 'play-target' });
    } else if (!enabled && isOpen) {
      this.closeScope(scopeId);
    }
  }

  getActiveFocusId(): string | null {
    return this.activeFocusId;
  }

  private moveFocus(direction: FocusDirection): void {
    if (typeof document !== 'undefined' && isTextEntryTarget(document.activeElement)) return;
    const candidates = this.availableEntries();
    const current = candidates.find((entry) => entry.id === this.activeFocusId);
    if (!current) {
      const activeEntry = this.activeFocusId ? this.entries.get(this.activeFocusId) : undefined;
      if (
        activeEntry &&
        activeEntry.element.isConnected &&
        activeEntry.element.getClientRects().length > 0 &&
        isFocusScopeAllowed(this.resolveScopeId(activeEntry), this.scopeStack, activeEntry.groupId)
      ) {
        const regions = candidates.map((entry) => this.toRegion(entry));
        const originRegion: FocusableRegion = {
          ...this.toRegion(activeEntry),
          disabled: false,
        };
        const directionalId = findNextFocusable(activeEntry.id, direction, [...regions, originRegion]);
        if (directionalId) {
          this.focusElement(directionalId);
          return;
        }
        const nearestId =
          findNearestFocusable(activeEntry.rect, regions, activeEntry.scopeId, activeEntry.groupId) ??
          findNearestFocusable(activeEntry.rect, regions, activeEntry.scopeId);
        if (nearestId) {
          this.focusElement(nearestId);
          return;
        }
      }
      const first = candidates.find((entry) => entry.initialFocus) ?? candidates[0];
      if (first) this.focusElement(first.id);
      return;
    }
    const nextId = findNextFocusable(current.id, direction, candidates.map((entry) => this.toRegion(entry)));
    if (nextId) this.focusElement(nextId);
  }

  private cycleFocus(reverse: boolean): void {
    const activeTrap = [...this.scopeStack].reverse().find((scope) => scope.trapsFocus);
    const candidates = this.availableEntries().filter(
      (entry) => activeTrap?.focusGroup === undefined || entry.groupId === activeTrap.focusGroup,
    );
    if (candidates.length === 0) return;
    const currentIndex = candidates.findIndex((entry) => entry.id === this.activeFocusId);
    if (currentIndex === -1) {
      const first = candidates.find((entry) => entry.initialFocus) ?? candidates[0];
      if (first) this.focusElement(first.id);
      return;
    }
    const nextIndex =
      (currentIndex + (reverse ? -1 : 1) + candidates.length) % candidates.length;
    this.focusElement(candidates[nextIndex]!.id);
  }

  private activateFocusedElement(source: 'keyboard' | 'gamepad' | 'system'): void {
    if (typeof document !== 'undefined' && isTextEntryTarget(document.activeElement)) return;
    const entry = this.activeFocusId ? this.entries.get(this.activeFocusId) : undefined;
    if (!entry || !this.isAvailable(entry)) {
      const scopeId = getActiveFocusScope(this.scopeStack)?.id;
      const candidates = this.availableEntries();
      const scopeCandidates = scopeId
        ? candidates.filter((candidate) => candidate.scopeId === scopeId)
        : candidates;
      const first =
        scopeCandidates.find((candidate) => candidate.initialFocus) ??
        scopeCandidates[0] ??
        candidates[0];
      if (first) this.focusElement(first.id);
      return;
    }

    this.activate(entry.element, source);
  }

  private activateSelect(select: HTMLSelectElement): void {
    if (select.disabled || select.options.length === 0) return;
    const options = Array.from(select.options).filter(
      (option) => !option.disabled && !option.hidden && !option.parentElement?.hasAttribute('disabled'),
    );
    if (options.length === 0) return;

    const current = select.selectedIndex;
    const next = options.find((option) => option.index > current) ?? options[0];
    if (next.index === current) return;
    select.value = next.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private focusElement(id: string): void {
    const entry = this.entries.get(id);
    if (!entry || !this.isAvailable(entry)) return;
    const changed = this.activeFocusId !== id;
    this.clearFocusedAttribute(entry.element);
    this.activeFocusId = id;
    this.lastFocusedElement = entry.element;
    entry.element.setAttribute('data-qwent-focused', 'true');
    entry.element.focus({ preventScroll: true });
    entry.element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (changed) {
      this.feedback.play('tap');
    }
  }

  private clearFocusedAttribute(except?: HTMLElement): void {
    if (this.lastFocusedElement && this.lastFocusedElement !== except) {
      this.lastFocusedElement.removeAttribute('data-qwent-focused');
      this.lastFocusedElement = null;
    }
  }

  recordFocus(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.activeFocusId = id;
    if (this.inputBridge.inputMode() === 'controller') {
      this.clearFocusedAttribute(entry.element);
      this.lastFocusedElement = entry.element;
      entry.element.setAttribute('data-qwent-focused', 'true');
    }
  }

  private findFallback(previous: FocusEntry): FocusEntry | undefined {
    const candidates = this.availableEntries();
    const regions = candidates.map((entry) => this.toRegion(entry));
    const prevScopeId = this.resolveScopeId(previous);
    const sameGroupId = findNearestFocusable(previous.rect, regions, prevScopeId, previous.groupId);
    const sameScopeId =
      sameGroupId ?? findNearestFocusable(previous.rect, regions, prevScopeId);
    const fallbackId =
      sameScopeId ??
      findNearestFocusable(previous.rect, regions, this.currentScopeId(), undefined);
    return fallbackId ? candidates.find((entry) => entry.id === fallbackId) : candidates[0];
  }

  private availableEntries(): FocusEntry[] {
    return Array.from(this.entries.values())
      .filter((entry) => this.isAvailable(entry))
      .sort((a, b) => {
        const left = this.readRect(a.element);
        const right = this.readRect(b.element);
        return left.top - right.top || left.left - right.left || a.id.localeCompare(b.id);
      });
  }

  private isAvailable(entry: FocusEntry): boolean {
    const scopeId = this.resolveScopeId(entry);
    const scopeAllows = isFocusScopeAllowed(scopeId, this.scopeStack, entry.groupId);
    const element = entry.element;
    return (
      scopeAllows &&
      element.isConnected &&
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-disabled') !== 'true' &&
      element.getClientRects().length > 0
    );
  }

  private toRegion(entry: FocusEntry): FocusableRegion {
    entry.rect = this.readRect(entry.element);
    const scopeId = this.resolveScopeId(entry);
    return {
      id: entry.id,
      rect: entry.rect,
      scopeId,
      groupId: entry.groupId,
      disabled:
        entry.element.hasAttribute('disabled') ||
        entry.element.getAttribute('aria-disabled') === 'true',
    };
  }

  private resolveScopeId(entry: FocusEntry): string {
    const scopeId = entry.explicitScopeId ?? this.scopeIdFor(entry.element);
    entry.scopeId = scopeId;
    return scopeId;
  }

  private readRect(element: HTMLElement): FocusRect {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }

  private scopeIdFor(element: HTMLElement): string {
    return element.closest<HTMLElement>('[data-qwent-focus-scope]')?.dataset['qwentFocusScope'] ?? 'root';
  }

  private currentScopeId(): string {
    return getActiveFocusScope(this.scopeStack)?.id ?? 'root';
  }
}
