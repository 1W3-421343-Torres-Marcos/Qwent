import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AI_DIFFICULTIES,
  AI_DIFFICULTY_LABELS,
  PLAYABLE_FACTIONS,
  QWENT_PHASE,
  type AIDifficulty,
  type PlayableFactionId,
} from '../core';
import { BoardPageComponent } from './features/board/board-page.component';
import { DeckBuilderPageComponent } from './features/deck-builder/deck-builder-page.component';
import { MatchHistoryPageComponent } from './features/history/match-history-page.component';
import { AiSettingsService } from './services/ai-settings.service';
import { DeckStorageService } from './services/deck-storage.service';
import { FeedbackService } from './services/feedback.service';
import { GameFacadeService, type GameMode } from './services/game-facade.service';
import { MatchHistoryService } from './services/match-history.service';
import { FactionEmblemComponent } from './shared/components/faction-emblem.component';
import { FACTION_META } from './shared/constants/faction-meta';

type ScreenView = 'MENU' | 'DECK_BUILDER' | 'BOARD' | 'HISTORY';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BoardPageComponent, DeckBuilderPageComponent, MatchHistoryPageComponent, FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (screen() === 'BOARD') {
      <app-board-page (exitToMenu)="screen.set('MENU')" />
    } @else if (screen() === 'DECK_BUILDER') {
      <app-deck-builder-page (closed)="screen.set('MENU')" />
    } @else if (screen() === 'HISTORY') {
      <app-match-history-page (closed)="screen.set('MENU')" />
    } @else {
      <main
        class="flex h-dvh w-screen items-center justify-center overflow-hidden bg-tavern-dark text-parchment p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
      >
        <section
          class="qwent-wood-surface mx-4 flex w-full max-w-3xl flex-col items-center gap-3 rounded-xl border-2 border-bronze px-6 py-4 text-center shadow-2xl"
        >
          <div class="flex flex-wrap items-center justify-center gap-2">
            <span
              class="rounded border border-gold/60 bg-row-leather px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-gold"
            >
              v1.7.0 — Release Offline
            </span>
            <span
              class="rounded border border-bronze bg-tavern-dark/80 px-3 py-0.5 text-[11px] font-medium text-parchment/80"
            >
              100% Offline • TW3 Clásico
            </span>
          </div>

          <header>
            <h1 class="font-serif text-3xl sm:text-4xl font-extrabold tracking-[0.2em] text-gold-bright drop-shadow">
              QWENT
            </h1>
          </header>

          <!-- Player & Opponent Faction / Deck Quick Selector -->
          <div class="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="rounded-lg border border-gold/60 bg-tavern-dark/85 p-2.5 text-left">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  <span class="h-3.5 w-3.5" [class]="factionAccent(deckStorage.selectedPlayerFaction())">
                    <app-faction-emblem [faction]="deckStorage.selectedPlayerFaction()" />
                  </span>
                  <span>Tu Facción (J1)</span>
                </span>
                <select
                  [value]="deckStorage.selectedPlayerFaction()"
                  (change)="onPlayerFactionChange($event)"
                  aria-label="Seleccionar facción del jugador"
                  class="min-h-[34px] rounded border border-bronze bg-board-wood px-2 py-0.5 text-xs font-bold text-parchment focus:border-gold-bright focus:outline-none"
                >
                  @for (faction of factions; track faction) {
                    <option [value]="faction">{{ factionLabel(faction) }}</option>
                  }
                </select>
              </div>
              <p class="mt-1 truncate text-[11px] font-semibold text-gold-bright">
                ♛ {{ playerLeaderName() }} · {{ playerCardCount() }} cartas
              </p>
              <p class="mt-0.5 line-clamp-1 text-[10px] text-parchment/70">
                {{ playerPassive() }}
              </p>
            </div>

            <div class="rounded-lg border border-bronze/70 bg-tavern-dark/85 p-2.5 text-left">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-parchment/75">
                  <span class="h-3.5 w-3.5" [class]="factionAccent(deckStorage.selectedOpponentFaction())">
                    <app-faction-emblem [faction]="deckStorage.selectedOpponentFaction()" />
                  </span>
                  <span>Rival / IA (J2)</span>
                </span>
                <select
                  [value]="deckStorage.selectedOpponentFaction()"
                  (change)="onOpponentFactionChange($event)"
                  aria-label="Seleccionar facción del rival"
                  class="min-h-[34px] rounded border border-bronze bg-board-wood px-2 py-0.5 text-xs font-bold text-parchment focus:border-gold-bright focus:outline-none"
                >
                  @for (faction of factions; track faction) {
                    <option [value]="faction">{{ factionLabel(faction) }}</option>
                  }
                </select>
              </div>
              <p class="mt-1 truncate text-[11px] font-semibold text-parchment">
                ♛ {{ opponentLeaderName() }} · {{ opponentCardCount() }} cartas
              </p>
              <p class="mt-0.5 line-clamp-1 text-[10px] text-parchment/70">
                {{ opponentPassive() }}
              </p>
              <div class="mt-1.5 flex items-center justify-between gap-1.5 border-t border-bronze/40 pt-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-parchment/70">
                  Dificultad IA
                </span>
                <div class="flex items-center gap-1" role="group" aria-label="Seleccionar dificultad de IA">
                  @for (level of aiDifficulties; track level) {
                    <button
                      type="button"
                      (click)="selectAiDifficulty(level)"
                      class="min-h-[28px] rounded border px-2 py-0.5 text-[10px] font-bold transition active:scale-95"
                      [class]="
                        aiSettings.difficulty() === level
                          ? 'border-gold-bright bg-gold/25 text-gold-bright'
                          : 'border-bronze/60 bg-board-wood text-parchment/75 hover:border-gold'
                      "
                    >
                      {{ aiDifficultyLabel(level) }}
                    </button>
                  }
                </div>
              </div>
            </div>
          </div>

          <div class="mt-1 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              (click)="startMatch('VS_AI')"
              class="min-h-[48px] rounded-lg border-2 border-gold-bright bg-gold/25 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gold-bright shadow-lg transition active:scale-95"
            >
              Jugar vs. IA (1P)
            </button>
            <button
              type="button"
              (click)="startMatch('LOCAL_2P')"
              class="min-h-[48px] rounded-lg border border-bronze bg-tavern-dark px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-parchment transition hover:border-gold active:scale-95"
            >
              Local 2 Jugadores
            </button>
            <button
              type="button"
              (click)="openScreen('DECK_BUILDER')"
              class="min-h-[48px] rounded-lg border border-gold/60 bg-row-leather px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-gold transition hover:border-gold-bright active:scale-95"
            >
              Constructor de Mazos
            </button>
            <button
              type="button"
              (click)="openScreen('HISTORY')"
              class="min-h-[48px] rounded-lg border border-bronze/80 bg-tavern-dark/90 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-parchment transition hover:border-gold active:scale-95"
            >
              Historial ({{ matchHistory.stats().total }})
            </button>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <button
              type="button"
              (click)="feedback.toggleSound()"
              class="min-h-[36px] rounded-full border px-3 py-1 font-semibold transition active:scale-95"
              [class]="
                feedback.soundEnabled()
                  ? 'border-gold/70 bg-tavern-dark/90 text-gold-bright'
                  : 'border-bronze/50 bg-tavern-dark/60 text-parchment/60'
              "
            >
              SFX: {{ feedback.soundEnabled() ? 'Activo' : 'Silencio' }}
            </button>
            <button
              type="button"
              (click)="feedback.toggleMusic()"
              class="min-h-[36px] rounded-full border px-3 py-1 font-semibold transition active:scale-95"
              [class]="
                feedback.musicEnabled()
                  ? 'border-gold/70 bg-tavern-dark/90 text-gold-bright'
                  : 'border-bronze/50 bg-tavern-dark/60 text-parchment/60'
              "
            >
              Música: {{ feedback.musicEnabled() ? 'Activa' : 'Silencio' }}
            </button>
            <button
              type="button"
              (click)="feedback.nextTrack()"
              [disabled]="!feedback.musicEnabled()"
              title="Cambiar tema musical"
              class="min-h-[36px] rounded-full border border-bronze/60 bg-tavern-dark/90 px-3 py-1 font-semibold text-parchment/90 transition hover:border-gold active:scale-95 disabled:opacity-45"
            >
              ⏭ Tema {{ feedback.currentTrackIndex() + 1 }}/4
            </button>
            <button
              type="button"
              (click)="feedback.toggleHaptics()"
              class="min-h-[36px] rounded-full border px-3 py-1 font-semibold transition active:scale-95"
              [class]="
                feedback.hapticsEnabled()
                  ? 'border-gold/70 bg-tavern-dark/90 text-gold-bright'
                  : 'border-bronze/50 bg-tavern-dark/60 text-parchment/60'
              "
            >
              Vibración: {{ feedback.hapticsEnabled() ? 'Activa' : 'Desactivada' }}
            </button>
          </div>
        </section>
      </main>
    }
  `,
})
export class AppComponent {
  private readonly facade = inject(GameFacadeService);
  readonly aiSettings = inject(AiSettingsService);
  readonly deckStorage = inject(DeckStorageService);
  readonly feedback = inject(FeedbackService);
  readonly matchHistory = inject(MatchHistoryService);

  readonly phase = QWENT_PHASE;
  readonly factions = PLAYABLE_FACTIONS;
  readonly aiDifficulties = AI_DIFFICULTIES;
  readonly screen = signal<ScreenView>('MENU');

  readonly playerLeaderName = computed(() => {
    const deck = this.deckStorage.getDeckForFaction(this.deckStorage.selectedPlayerFaction());
    return this.deckStorage.getLeaderDefinition(deck.leaderId)?.name ?? 'Sin líder';
  });

  readonly opponentLeaderName = computed(() => {
    const deck = this.deckStorage.getDeckForFaction(this.deckStorage.selectedOpponentFaction());
    return this.deckStorage.getLeaderDefinition(deck.leaderId)?.name ?? 'Sin líder';
  });

  readonly playerCardCount = computed(
    () => this.deckStorage.getDeckForFaction(this.deckStorage.selectedPlayerFaction()).cardIds.length,
  );

  readonly opponentCardCount = computed(
    () => this.deckStorage.getDeckForFaction(this.deckStorage.selectedOpponentFaction()).cardIds.length,
  );

  readonly playerPassive = computed(
    () => FACTION_META[this.deckStorage.selectedPlayerFaction()].passiveSummary,
  );

  readonly opponentPassive = computed(
    () => FACTION_META[this.deckStorage.selectedOpponentFaction()].passiveSummary,
  );

  factionLabel(faction: PlayableFactionId): string {
    return FACTION_META[faction].label;
  }

  factionAccent(faction: PlayableFactionId): string {
    return FACTION_META[faction].accentClass;
  }

  onPlayerFactionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PlayableFactionId;
    this.deckStorage.setPlayerFaction(value);
  }

  onOpponentFactionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PlayableFactionId;
    this.deckStorage.setOpponentFaction(value);
  }

  aiDifficultyLabel(level: AIDifficulty): string {
    return AI_DIFFICULTY_LABELS[level];
  }

  selectAiDifficulty(level: AIDifficulty): void {
    this.feedback.play('tap');
    this.aiSettings.setDifficulty(level);
  }

  openScreen(target: Exclude<ScreenView, 'BOARD'>): void {
    this.feedback.play('tap');
    this.screen.set(target);
  }

  startMatch(mode: GameMode): void {
    this.facade.startNewMatch(mode);
    this.screen.set('BOARD');
  }
}
