import { Injectable, signal } from '@angular/core';

export type FeedbackCue = 'tap' | 'cardPlay' | 'horn' | 'weather' | 'scorch' | 'pass' | 'roundEnd';

interface FeedbackSettingsPayload {
  readonly version: 1;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

const SETTINGS_STORAGE_KEY = 'qwent.settings.v1';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly initial = this.loadSettings();
  readonly soundEnabled = signal<boolean>(this.initial.soundEnabled);
  readonly hapticsEnabled = signal<boolean>(this.initial.hapticsEnabled);

  private audioCtx: AudioContext | null = null;

  toggleSound(): void {
    this.soundEnabled.set(!this.soundEnabled());
    this.persistSettings();
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
        cardPlay: 16,
        horn: [18, 25, 22],
        weather: 24,
        scorch: [30, 35, 45],
        pass: 22,
        roundEnd: [25, 35, 30],
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
          this.beep(ctx, 520, 'sine', now, 0.045, 0.03);
          break;
        case 'cardPlay':
          this.beep(ctx, 220, 'triangle', now, 0.08, 0.055);
          this.beep(ctx, 330, 'sine', now + 0.025, 0.07, 0.035);
          break;
        case 'horn':
          this.beep(ctx, 293.66, 'triangle', now, 0.14, 0.06);
          this.beep(ctx, 440, 'triangle', now + 0.08, 0.18, 0.06);
          break;
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
        case 'roundEnd':
          this.beep(ctx, 392, 'triangle', now, 0.12, 0.05);
          this.beep(ctx, 523.25, 'triangle', now + 0.1, 0.2, 0.055);
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
        hapticsEnabled: this.hapticsEnabled(),
      };
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors offline
    }
  }
}
