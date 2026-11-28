import '@angular/compiler';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackService } from '../feedback.service';
import { InputBridgeService } from '../input-bridge.service';
import { SpatialFocusService } from '../spatial-focus.service';

interface RectInit {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

class FakeClassList {
  private readonly classes = new Set<string>();

  toggle(name: string, force?: boolean): boolean {
    if (force === true) {
      this.classes.add(name);
      return true;
    }
    if (force === false) {
      this.classes.delete(name);
      return false;
    }
    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }
    this.classes.add(name);
    return true;
  }

  contains(name: string): boolean {
    return this.classes.has(name);
  }
}

class FakeElement {
  isConnected = true;
  visible = true;
  clickCount = 0;
  focusCount = 0;
  scrollCount = 0;
  parent: FakeElement | null = null;
  readonly dataset: Record<string, string> = {};
  private readonly attrs = new Map<string, string>();

  constructor(
    readonly tagName: string,
    private rect: RectInit,
    private readonly onFocusCallback?: (el: FakeElement) => void,
  ) {}

  setRect(rect: RectInit): void {
    this.rect = rect;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name === 'data-qwent-focus-scope') {
      this.dataset['qwentFocusScope'] = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
    if (name === 'data-qwent-focus-scope') {
      delete this.dataset['qwentFocusScope'];
    }
  }

  closest(selector: string): FakeElement | null {
    if (selector !== '[data-qwent-focus-scope]') return null;
    let current: FakeElement | null = this;
    while (current) {
      if (current.hasAttribute('data-qwent-focus-scope') || current.dataset['qwentFocusScope']) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  getClientRects(): readonly RectInit[] {
    return this.visible ? [this.rect] : [];
  }

  getBoundingClientRect(): RectInit {
    return this.rect;
  }

  focus(): void {
    this.focusCount += 1;
    this.onFocusCallback?.(this);
  }

  scrollIntoView(): void {
    this.scrollCount += 1;
  }

  click(): void {
    this.clickCount += 1;
  }
}

type Listener = (event: unknown) => void;

function createDomEnvironment() {
  const docListeners = new Map<string, Set<Listener>>();
  const winListeners = new Map<string, Set<Listener>>();
  const classList = new FakeClassList();
  let rafCallback: (() => void) | null = null;
  let rafSeq = 0;

  const doc = {
    activeElement: null as FakeElement | null,
    documentElement: { classList },
    addEventListener(type: string, fn: Listener): void {
      const set = docListeners.get(type) ?? new Set<Listener>();
      set.add(fn);
      docListeners.set(type, set);
    },
    removeEventListener(type: string, fn: Listener): void {
      docListeners.get(type)?.delete(fn);
    },
    dispatch(type: string, event: unknown): void {
      for (const fn of docListeners.get(type) ?? []) {
        fn(event);
      }
    },
  };

  const win = {
    QwentNative: undefined as { exitApp: () => void; isTelevision?: () => boolean } | undefined,
    addEventListener(type: string, fn: Listener): void {
      const set = winListeners.get(type) ?? new Set<Listener>();
      set.add(fn);
      winListeners.set(type, set);
    },
    removeEventListener(type: string, fn: Listener): void {
      winListeners.get(type)?.delete(fn);
    },
    dispatch(type: string, event: unknown): void {
      for (const fn of winListeners.get(type) ?? []) {
        fn(event);
      }
    },
    requestAnimationFrame(cb: () => void): number {
      rafCallback = cb;
      return ++rafSeq;
    },
    cancelAnimationFrame(): void {
      rafCallback = null;
    },
    flushAnimationFrame(): void {
      const cb = rafCallback;
      rafCallback = null;
      cb?.();
    },
  };

  const makeEl = (tag: string, rect: RectInit, parent?: FakeElement): FakeElement => {
    const el = new FakeElement(tag, rect, (focused) => {
      doc.activeElement = focused;
    });
    if (parent) el.parent = parent;
    return el;
  };

  return { doc, win, classList, makeEl };
}

describe('SpatialFocusService & InputBridgeService (TV/Controller Regression)', () => {
  let destroyCallbacks: Array<() => void>;
  let env: ReturnType<typeof createDomEnvironment>;

  beforeEach(() => {
    destroyCallbacks = [];
    env = createDomEnvironment();
    vi.stubGlobal('document', env.doc);
    vi.stubGlobal('window', env.win);
    vi.stubGlobal('HTMLSelectElement', class FakeHTMLSelectElement {});
  });

  afterEach(() => {
    for (const cb of destroyCallbacks) cb();
    vi.unstubAllGlobals();
  });

  function createServices() {
    const destroyRef: DestroyRef = {
      onDestroy(callback: () => void): () => void {
        destroyCallbacks.push(callback);
        return callback;
      },
    };
    const baseInjector = Injector.create({
      providers: [
        { provide: DestroyRef, useValue: destroyRef },
        { provide: FeedbackService, useValue: { play: vi.fn() } },
      ],
    });
    const inputBridge = runInInjectionContext(baseInjector, () => new InputBridgeService());
    const fullInjector = Injector.create({
      parent: baseInjector,
      providers: [{ provide: InputBridgeService, useValue: inputBridge }],
    });
    const spatialFocus = runInInjectionContext(fullInjector, () => new SpatialFocusService());
    return { inputBridge, spatialFocus };
  }

  function dispatchKey(
    key: string,
    options: Partial<{ type: string; code: string; keyCode: number; repeat: boolean; target: unknown }> = {},
  ): void {
    env.doc.dispatch(options.type ?? 'keydown', {
      type: options.type ?? 'keydown',
      key,
      code: options.code ?? '',
      keyCode: options.keyCode ?? 0,
      repeat: options.repeat ?? false,
      target: options.target ?? env.doc,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
  }

  it('activates controller mode automatically on Android TV and keeps touch mode elsewhere', () => {
    const phone = createServices();
    expect(phone.inputBridge.inputMode()).toBe('touch');
    expect(env.classList.contains('qwent-controller-mode')).toBe(false);

    env.win.QwentNative = { exitApp: vi.fn(), isTelevision: () => true };
    const tv = createServices();
    expect(tv.inputBridge.inputMode()).toBe('controller');
    expect(env.classList.contains('qwent-controller-mode')).toBe(true);
  });

  it('resolves scopeId dynamically even when data-qwent-focus-scope is applied after child registration', async () => {
    env.win.QwentNative = { exitApp: vi.fn(), isTelevision: () => true };
    const { spatialFocus } = createServices();

    const scopeContainer = env.makeEl('MAIN', { left: 0, top: 0, right: 800, bottom: 600 });
    const btnTop = env.makeEl('BUTTON', { left: 100, top: 100, right: 200, bottom: 140 }, scopeContainer);
    const btnPlay = env.makeEl('BUTTON', { left: 100, top: 200, right: 200, bottom: 240 }, scopeContainer);

    spatialFocus.openScope({ id: 'main-menu', trapsFocus: true });
    const topId = spatialFocus.register(btnTop as unknown as HTMLElement);
    const playId = spatialFocus.register(btnPlay as unknown as HTMLElement, 'default', undefined, true);

    // Simulates Angular @HostBinding setting data-qwent-focus-scope after child ngOnInit.
    scopeContainer.setAttribute('data-qwent-focus-scope', 'main-menu');
    await Promise.resolve();

    expect(spatialFocus.getActiveFocusId()).toBe(playId);
    expect(btnPlay.getAttribute('data-qwent-focused')).toBe('true');

    dispatchKey('ArrowUp');
    expect(spatialFocus.getActiveFocusId()).toBe(topId);
    expect(btnTop.getAttribute('data-qwent-focused')).toBe('true');
    expect(btnPlay.hasAttribute('data-qwent-focused')).toBe(false);

    dispatchKey('Enter');
    expect(btnTop.clickCount).toBe(1);
  });

  it('updates focus group dynamically for targeting scopes and cleans visual focus on touch', async () => {
    env.win.QwentNative = { exitApp: vi.fn(), isTelevision: () => true };
    const { spatialFocus } = createServices();

    const boardHost = env.makeEl('MAIN', { left: 0, top: 0, right: 1280, bottom: 720 });
    boardHost.setAttribute('data-qwent-focus-scope', 'board');
    const rowEl = env.makeEl('DIV', { left: 200, top: 300, right: 800, bottom: 380 }, boardHost);
    const handCard = env.makeEl('BUTTON', { left: 400, top: 600, right: 460, bottom: 700 }, boardHost);

    spatialFocus.openScope({ id: 'board', trapsFocus: true });
    const rowId = spatialFocus.register(rowEl as unknown as HTMLElement, 'board-row');
    const handId = spatialFocus.register(handCard as unknown as HTMLElement, 'hand', undefined, true);
    await Promise.resolve();

    expect(spatialFocus.getActiveFocusId()).toBe(handId);

    spatialFocus.setTargetingScope(true);
    spatialFocus.updateEntry(rowId, 'play-target');
    await Promise.resolve();

    expect(spatialFocus.getActiveFocusId()).toBe(rowId);
    expect(rowEl.getAttribute('data-qwent-focused')).toBe('true');

    dispatchKey('Enter');
    expect(rowEl.clickCount).toBe(1);

    spatialFocus.updateEntry(rowId, 'board-row');
    spatialFocus.setTargetingScope(false);
    expect(spatialFocus.getActiveFocusId()).toBe(handId);

    env.win.dispatch('pointerdown', { pointerType: 'touch' });
    expect(env.classList.contains('qwent-controller-mode')).toBe(false);
    expect(handCard.hasAttribute('data-qwent-focused')).toBe(false);
  });

  it('avoids activating disabled elements and recovers directional focus cleanly', async () => {
    env.win.QwentNative = { exitApp: vi.fn(), isTelevision: () => true };
    const { spatialFocus } = createServices();

    const host = env.makeEl('DIV', { left: 0, top: 0, right: 500, bottom: 500 });
    host.setAttribute('data-qwent-focus-scope', 'deck');
    const first = env.makeEl('BUTTON', { left: 20, top: 20, right: 120, bottom: 60 }, host);
    const second = env.makeEl('BUTTON', { left: 20, top: 80, right: 120, bottom: 120 }, host);

    spatialFocus.openScope({ id: 'deck', trapsFocus: true });
    const firstId = spatialFocus.register(first as unknown as HTMLElement);
    const secondId = spatialFocus.register(second as unknown as HTMLElement);
    await Promise.resolve();

    expect(spatialFocus.getActiveFocusId()).toBe(firstId);
    first.setAttribute('disabled', '');

    dispatchKey('Enter');
    expect(first.clickCount).toBe(0);
    expect(spatialFocus.getActiveFocusId()).toBe(secondId);

    // Force active focus back onto a disabled button and test directional recovery.
    spatialFocus.recordFocus(firstId);
    dispatchKey('ArrowDown');
    expect(spatialFocus.getActiveFocusId()).toBe(secondId);
  });

  it('reads buttons from non-standard gamepads and respects document.activeElement text inputs', () => {
    const fakeGamepad = {
      index: 0,
      mapping: '',
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, (_, idx) => ({
        pressed: idx === 0,
        value: idx === 0 ? 1 : 0,
      })),
    };
    vi.stubGlobal('navigator', {
      getGamepads: () => [fakeGamepad],
    });

    const { inputBridge } = createServices();
    const received: string[] = [];
    inputBridge.commands.subscribe((cmd) => received.push(cmd.command));

    env.win.flushAnimationFrame();
    expect(received).toContain('CONFIRM');

    const inputEl = env.makeEl('INPUT', { left: 0, top: 0, right: 100, bottom: 30 });
    env.doc.activeElement = inputEl;
    dispatchKey('x', { code: 'KeyX', target: env.doc });
    expect(received).not.toContain('LEADER');
  });
});
