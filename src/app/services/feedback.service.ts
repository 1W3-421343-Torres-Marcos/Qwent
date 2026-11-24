import { Injectable, signal } from '@angular/core';

export type FeedbackCue =
  | 'tap'
  | 'deckTap'
  | 'cardPlay'
  | 'cardClose'
  | 'cardRanged'
  | 'cardSiege'
  | 'hero'
  | 'bond'
  | 'morale'
  | 'horn'
  | 'mardroeme'
  | 'medic'
  | 'muster'
  | 'spy'
  | 'decoy'
  | 'scorch'
  | 'frost'
  | 'fog'
  | 'rain'
  | 'clearWeather'
  | 'weather'
  | 'pass'
  | 'draw'
  | 'redraw'
  | 'turnMe'
  | 'turnOp'
  | 'roundStart'
  | 'roundWin'
  | 'roundLose'
  | 'roundEnd'
  | 'gameStart'
  | 'gameWin'
  | 'gameLose';

interface FeedbackSettingsPayload {
  readonly version: 1;
  readonly soundEnabled: boolean;
  readonly musicEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

const SETTINGS_STORAGE_KEY = 'qwent.settings.v1';
const SFX_VOLUME = 0.65;
const BGM_VOLUME = 0.28;

const SFX_PATH_MAP: Readonly<Record<FeedbackCue, string>> = {
  tap: 'assets/audio/sfx/ui_card.mp3',
  deckTap: 'assets/audio/sfx/ui_card_bank.mp3',
  cardPlay: 'assets/audio/sfx/common_close.mp3',
  cardClose: 'assets/audio/sfx/common_close.mp3',
  cardRanged: 'assets/audio/sfx/common_ranged.mp3',
  cardSiege: 'assets/audio/sfx/common_siege.mp3',
  hero: 'assets/audio/sfx/hero.mp3',
  bond: 'assets/audio/sfx/bond.mp3',
  morale: 'assets/audio/sfx/morale.mp3',
  horn: 'assets/audio/sfx/horn.mp3',
  mardroeme: 'assets/audio/sfx/mardroeme.mp3',
  medic: 'assets/audio/sfx/medic.mp3',
  muster: 'assets/audio/sfx/muster.mp3',
  spy: 'assets/audio/sfx/spy.mp3',
  decoy: 'assets/audio/sfx/decoy.mp3',
  scorch: 'assets/audio/sfx/scorch.mp3',
  frost: 'assets/audio/sfx/frost.mp3',
  fog: 'assets/audio/sfx/fog.mp3',
  rain: 'assets/audio/sfx/rain.mp3',
  clearWeather: 'assets/audio/sfx/clear.mp3',
  weather: 'assets/audio/sfx/frost.mp3',
  pass: 'assets/audio/sfx/pass.mp3',
  draw: 'assets/audio/sfx/draw.mp3',
  redraw: 'assets/audio/sfx/redraw.mp3',
  turnMe: 'assets/audio/sfx/turn_me.mp3',
  turnOp: 'assets/audio/sfx/turn_op.mp3',
  roundStart: 'assets/audio/sfx/round1_start.mp3',
  roundWin: 'assets/audio/sfx/round_win.mp3',
  roundLose: 'assets/audio/sfx/round_lose.mp3',
  roundEnd: 'assets/audio/sfx/round_win.mp3',
  gameStart: 'assets/audio/sfx/game_start.mp3',
  gameWin: 'assets/audio/sfx/game_win.mp3',
  gameLose: 'assets/audio/sfx/game_lose.mp3',
};

export const BGM_PLAYLIST: readonly string[] = [
  'assets/audio/music/tavern_1.mp3',
  'assets/audio/music/tavern_2.mp3',
  'assets/audio/music/tavern_3.mp3',
  'assets/audio/music/tavern_4.mp3',
];

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly initial = this.loadSettings();
  readonly soundEnabled = signal<boolean>(this.initial.soundEnabled);
  readonly musicEnabled = signal<boolean>(this.initial.musicEnabled);
  readonly hapticsEnabled = signal<boolean>(this.initial.hapticsEnabled);
  readonly currentTrackIndex = signal<number>(0);

  private audioCtx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private pausedByVisibility = false;

  constructor() {
    this.setupAudioLifecycle();
  }

  toggleSound(): void {
    this.soundEnabled.set(!this.soundEnabled());
    this.persistSettings();
  }

  toggleMusic(): void {
    const next = !this.musicEnabled();
    this.musicEnabled.set(next);
    this.persistSettings();

    if (next) {
      this.startOrResumeMusic();
    } else {
      this.pauseMusic();
    }
  }

  nextTrack(): void {
    const nextIdx = (this.currentTrackIndex() + 1) % BGM_PLAYLIST.length;
    this.currentTrackIndex.set(nextIdx);
    if (this.bgmAudio) {
      this.bgmAudio.src = BGM_PLAYLIST[nextIdx]!;
      this.bgmAudio.load();
    }
    if (this.musicEnabled()) {
      this.startOrResumeMusic();
    }
  }

  toggleHaptics(): void {
    this.hapticsEnabled.set(!this.hapticsEnabled());
    this.persistSettings();
  }

  play(cue: FeedbackCue): void {
    if (this.hapticsEnabled()) {
      this.triggerHaptic(cue);
    }
    if (this.soundEnabled()) {
      this.playSfx(cue);
    }
    if (this.musicEnabled()) {
      this.startOrResumeMusic();
    }
  }

  private setupAudioLifecycle(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const onVisibilityChange = (): void => {
      if (!this.bgmAudio) return;
      if (document.hidden) {
        if (!this.bgmAudio.paused) {
          this.pausedByVisibility = true;
          this.bgmAudio.pause();
        }
      } else if (this.pausedByVisibility && this.musicEnabled()) {
        this.pausedByVisibility = false;
        this.startOrResumeMusic();
      }
    };

    const onFirstGesture = (): void => {
      if (this.musicEnabled()) {
        this.startOrResumeMusic(() => {
          document.removeEventListener('pointerdown', onFirstGesture);
          document.removeEventListener('keydown', onFirstGesture);
        });
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('pointerdown', onFirstGesture, { passive: true });
    document.addEventListener('keydown', onFirstGesture);
  }

  private ensureBgmAudio(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') {
      return null;
    }
    if (!this.bgmAudio) {
      const audio = new Audio(BGM_PLAYLIST[this.currentTrackIndex()]!);
      audio.volume = BGM_VOLUME;
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        this.nextTrack();
      });
      this.bgmAudio = audio;
    }
    return this.bgmAudio;
  }

  private startOrResumeMusic(onStarted?: () => void): void {
    if (!this.musicEnabled()) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const audio = this.ensureBgmAudio();
    if (!audio) return;

    if (!audio.paused) {
      onStarted?.();
      return;
    }

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        void playPromise
          .then(() => {
            this.pausedByVisibility = false;
            onStarted?.();
          })
          .catch(() => undefined);
      } else {
        onStarted?.();
      }
    } catch {
      // Safe fallback when WebView blocks audio
    }
  }

  private pauseMusic(): void {
    this.pausedByVisibility = false;
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.pause();
    }
  }

  private playSfx(cue: FeedbackCue): void {
    if (typeof Audio === 'undefined') {
      this.triggerTone(cue);
      return;
    }

    try {
      const sfx = new Audio(SFX_PATH_MAP[cue]);
      sfx.volume = SFX_VOLUME;
      sfx.onerror = () => this.triggerTone(cue);
      const promise = sfx.play();
      if (promise && typeof promise.catch === 'function') {
        void promise.catch(() => undefined);
      }
    } catch {
      this.triggerTone(cue);
    }
  }

  private triggerHaptic(cue: FeedbackCue): void {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return;
      }
      const pattern: Record<FeedbackCue, number | number[]> = {
        tap: 10,
        deckTap: 10,
        cardPlay: 16,
        cardClose: 18,
        cardRanged: 14,
        cardSiege: 22,
        hero: [18, 22, 26],
        bond: [12, 18, 16],
        morale: [14, 18, 16],
        mardroeme: [16, 18, 28],
        horn: [18, 25, 22],
        medic: [15, 22, 20],
        muster: [14, 14, 20],
        spy: 15,
        decoy: 14,
        scorch: [30, 35, 45],
        frost: 24,
        fog: 22,
        rain: 24,
        clearWeather: [16, 20, 16],
        weather: 24,
        pass: 22,
        draw: 12,
        redraw: 14,
        turnMe: 16,
        turnOp: 12,
        roundStart: [16, 24, 16],
        roundWin: [22, 28, 32],
        roundLose: 30,
        roundEnd: [25, 35, 30],
        gameStart: [18, 24, 24],
        gameWin: [24, 30, 40],
        gameLose: [35, 30, 35],
      };
      navigator.vibrate(pattern[cue]);
    } catch {
      // Safe fallback on browsers without vibration permission
    }
  }

  private triggerTone(cue: FeedbackCue): void {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtor = window.AudioContext;
      if (!AudioCtor) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtor();
      }
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined);
      }

      const now = ctx.currentTime;
      switch (cue) {
        case 'tap':
        case 'deckTap':
          this.beep(ctx, 520, 'sine', now, 0.045, 0.03);
          break;
        case 'horn':
        case 'hero':
          this.beep(ctx, 293.66, 'triangle', now, 0.14, 0.06);
          this.beep(ctx, 440, 'triangle', now + 0.08, 0.18, 0.06);
          break;
        case 'frost':
        case 'fog':
        case 'rain':
        case 'weather':
          this.beep(ctx, 310, 'sine', now, 0.18, 0.05);
          this.beep(ctx, 195, 'sine', now + 0.06, 0.2, 0.045);
          break;
        case 'scorch':
          this.beep(ctx, 170, 'sawtooth', now, 0.22, 0.05);
          this.beep(ctx, 110, 'triangle', now + 0.05, 0.25, 0.055);
          break;
        case 'pass':
          this.beep(ctx, 260, 'sine', now, 0.11, 0.045);
          break;
        case 'roundWin':
        case 'roundEnd':
        case 'gameWin':
          this.beep(ctx, 392, 'triangle', now, 0.12, 0.05);
          this.beep(ctx, 523.25, 'triangle', now + 0.1, 0.2, 0.055);
          break;
        default:
          this.beep(ctx, 220, 'triangle', now, 0.08, 0.055);
          this.beep(ctx, 330, 'sine', now + 0.025, 0.07, 0.035);
          break;
      }
    } catch {
      // Safe fallback when Web Audio is unavailable
    }
  }

  private beep(
    ctx: AudioContext,
    freq: number,
    type: OscillatorType,
    startTime: number,
    durationSec: number,
    peakGain: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.01);
  }

  private loadSettings(): FeedbackSettingsPayload {
    const defaults: FeedbackSettingsPayload = {
      version: 1,
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
    };

    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return defaults;
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<FeedbackSettingsPayload> | null;
      if (!parsed || parsed.version !== 1) return defaults;

      return {
        version: 1,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        musicEnabled: typeof parsed.musicEnabled === 'boolean' ? parsed.musicEnabled : true,
        hapticsEnabled: typeof parsed.hapticsEnabled === 'boolean' ? parsed.hapticsEnabled : true,
      };
    } catch {
      return defaults;
    }
  }

  private persistSettings(): void {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return;
      const payload: FeedbackSettingsPayload = {
        version: 1,
        soundEnabled: this.soundEnabled(),
        musicEnabled: this.musicEnabled(),
        hapticsEnabled: this.hapticsEnabled(),
      };
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors offline
    }
  }
}
