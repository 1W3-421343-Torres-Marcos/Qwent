import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import type { FactionId } from '../../../core';
import { FeedbackService } from '../../services/feedback.service';
import { MatchHistoryService } from '../../services/match-history.service';
import {
  computeHistoryStats,
  type MatchHistoryMode,
  type MatchOutcome,
} from '../../services/match-history.utils';
import { FactionEmblemComponent } from '../../shared/components/faction-emblem.component';
import { FACTION_META } from '../../shared/constants/faction-meta';

type HistoryFilter = 'ALL' | MatchHistoryMode;

const FILTER_OPTIONS: ReadonlyArray<{ readonly id: HistoryFilter; readonly label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'VS_AI', label: 'vs. IA' },
  { id: 'LOCAL_2P', label: 'Local 2P' },
];

const OUTCOME_META: Readonly<Record<MatchOutcome, { readonly label: string; readonly badgeClass: string }>> = {
  WIN: {
    label: 'Victoria',
    badgeClass: 'border-strength-buff/70 bg-strength-buff/15 text-strength-buff',
  },
  LOSS: {
    label: 'Derrota',
    badgeClass: 'border-strength-nerf/70 bg-strength-nerf/15 text-strength-nerf',
  },
  DRAW: {
    label: 'Empate',
    badgeClass: 'border-gold/70 bg-gold/15 text-gold-bright',
  },
};

@Component({
  selector: 'app-match-history-page',
  standalone: true,
  imports: [FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="flex h-dvh w-screen flex-col overflow-hidden bg-tavern-dark text-parchment p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
    >
      <!-- Top Header -->
      <header class="qwent-wood-surface flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-bronze/70 px-3 py-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="font-serif text-base sm:text-lg font-extrabold uppercase tracking-wider text-gold-bright">
            Historial de Partidas
          </h1>
          <div class="flex items-center gap-1">
            @for (filter of filters; track filter.id) {
              <button
                type="button"
                (click)="setFilter(filter.id)"
                class="min-h-[34px] rounded border px-2.5 py-1 text-[11px] font-bold uppercase transition active:scale-95"
                [class]="
                  activeFilter() === filter.id
                    ? 'border-gold-bright bg-gold/25 text-gold-bright'
                    : 'border-bronze/50 bg-tavern-dark/80 text-parchment/75 hover:border-gold'
                "
              >
                {{ filter.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          @if (historyService.entries().length > 0) {
            @if (confirmClear()) {
              <span class="text-[11px] font-semibold text-parchment/85">¿Borrar todo?</span>
              <button
                type="button"
                (click)="confirmClearHistory()"
                class="min-h-[36px] rounded-lg border border-strength-nerf bg-strength-nerf/25 px-2.5 py-1 text-[11px] font-bold uppercase text-parchment transition active:scale-95"
              >
                Sí, borrar
              </button>
              <button
                type="button"
                (click)="cancelClearHistory()"
                class="min-h-[36px] rounded-lg border border-bronze/70 bg-tavern-dark px-2.5 py-1 text-[11px] font-bold uppercase text-parchment/80 transition active:scale-95"
              >
                Cancelar
              </button>
            } @else {
              <button
                type="button"
                (click)="requestClearHistory()"
                class="min-h-[36px] rounded-lg border border-strength-nerf/60 bg-tavern-dark px-2.5 py-1 text-[11px] font-bold uppercase text-parchment/85 transition hover:border-strength-nerf hover:text-strength-nerf active:scale-95"
              >
                Borrar historial
              </button>
            }
          }

          <button
            type="button"
            (click)="goBack()"
            class="min-h-[36px] rounded-lg border border-bronze bg-row-leather px-3 py-1 text-[11px] font-bold uppercase text-parchment hover:border-gold active:scale-95"
          >
            Volver
          </button>
        </div>
      </header>

      <!-- Summary Stats Strip -->
      <section class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-bronze/50 bg-tavern-dark/95 px-3 py-1.5 text-[11px] font-bold">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rounded border border-bronze/60 bg-board-wood px-2.5 py-0.5 text-parchment">
            Partidas: {{ filteredStats().total }}
          </span>
          <span class="rounded border border-strength-buff/60 bg-strength-buff/15 px-2.5 py-0.5 text-strength-buff">
            Victorias: {{ filteredStats().wins }}
          </span>
          <span class="rounded border border-strength-nerf/60 bg-strength-nerf/15 px-2.5 py-0.5 text-strength-nerf">
            Derrotas: {{ filteredStats().losses }}
          </span>
          <span class="rounded border border-gold/60 bg-gold/15 px-2.5 py-0.5 text-gold-bright">
            Empates: {{ filteredStats().draws }}
          </span>
        </div>

        <span class="rounded border border-gold/70 bg-board-wood px-2.5 py-0.5 text-gold-bright">
          % Victoria (J1): {{ filteredStats().winRate }}%
        </span>
      </section>

      <!-- Scrollable Matches List -->
      <section class="min-h-0 flex-1 overflow-y-auto p-3">
        <div class="mx-auto flex max-w-4xl flex-col gap-2">
          @for (entry of filteredEntries(); track entry.id) {
            <article class="rounded-lg border border-bronze/70 bg-board-wood p-2.5 shadow">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-bronze/40 pb-1.5">
                <div class="flex items-center gap-2">
                  <span
                    class="rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                    [class]="outcomeBadge(entry.outcomeForP1)"
                  >
                    {{ outcomeLabel(entry.outcomeForP1) }}
                  </span>
                  <span class="rounded border border-bronze/50 bg-tavern-dark/80 px-2 py-0.5 text-[10px] font-semibold text-parchment/85">
                    {{ entry.mode === 'VS_AI' ? 'vs. IA' : 'Local 2P' }}
                  </span>
                </div>
                <time class="text-[11px] font-medium text-parchment/65">
                  {{ formatDate(entry.playedAtIso) }}
                </time>
              </div>

              <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <!-- Player 1 -->
                <div class="flex min-w-0 items-center gap-2">
                  <span class="h-5 w-5 shrink-0" [class]="factionAccent(entry.player1.faction)">
                    <app-faction-emblem [faction]="entry.player1.faction" />
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-gold-bright">
                      {{ entry.player1.name }}
                    </p>
                    <p class="truncate text-[10px] text-parchment/70">
                      {{ factionName(entry.player1.faction) }} · ♛ {{ entry.player1.leaderName }}
                    </p>
                  </div>
                </div>

                <!-- Round Scores -->
                <div class="flex flex-wrap items-center justify-center gap-1.5">
                  @for (round of entry.rounds; track round.roundNumber) {
                    <span
                      class="qwent-num-shadow rounded border border-bronze/60 bg-tavern-dark/90 px-2 py-0.5 text-[11px] font-bold text-parchment"
                    >
                      R{{ round.roundNumber }}: {{ round.p1Score }} - {{ round.p2Score }}
                    </span>
                  }
                </div>

                <!-- Player 2 -->
                <div class="flex min-w-0 items-center gap-2 sm:flex-row-reverse sm:text-right">
                  <span class="h-5 w-5 shrink-0" [class]="factionAccent(entry.player2.faction)">
                    <app-faction-emblem [faction]="entry.player2.faction" />
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-parchment">
                      {{ entry.player2.name }}
                    </p>
                    <p class="truncate text-[10px] text-parchment/70">
                      {{ factionName(entry.player2.faction) }} · ♛ {{ entry.player2.leaderName }}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          } @empty {
            <div class="rounded-xl border border-bronze/50 bg-board-wood/70 px-6 py-10 text-center">
              <p class="font-serif text-base font-bold text-gold">
                Sin partidas registradas aún
              </p>
              <p class="mt-1 text-xs text-parchment/70">
                Completa una partida contra la IA o en modo local 2P para ver aquí los resultados y puntajes por ronda.
              </p>
            </div>
          }
        </div>
      </section>
    </main>
  `,
})
export class MatchHistoryPageComponent {
  readonly historyService = inject(MatchHistoryService);
  private readonly feedback = inject(FeedbackService);

  readonly closed = output<void>();
  readonly filters = FILTER_OPTIONS;
  readonly activeFilter = signal<HistoryFilter>('ALL');
  readonly confirmClear = signal(false);

  readonly filteredEntries = computed(() => {
    const filter = this.activeFilter();
    const all = this.historyService.entries();
    return filter === 'ALL' ? all : all.filter((entry) => entry.mode === filter);
  });

  readonly filteredStats = computed(() => computeHistoryStats(this.filteredEntries()));

  setFilter(filter: HistoryFilter): void {
    this.feedback.play('tap');
    this.activeFilter.set(filter);
  }

  requestClearHistory(): void {
    this.feedback.play('tap');
    this.confirmClear.set(true);
  }

  cancelClearHistory(): void {
    this.feedback.play('tap');
    this.confirmClear.set(false);
  }

  confirmClearHistory(): void {
    this.feedback.play('tap');
    this.confirmClear.set(false);
    this.historyService.clearHistory();
  }

  goBack(): void {
    this.feedback.play('tap');
    this.closed.emit();
  }

  outcomeLabel(outcome: MatchOutcome): string {
    return OUTCOME_META[outcome].label;
  }

  outcomeBadge(outcome: MatchOutcome): string {
    return OUTCOME_META[outcome].badgeClass;
  }

  factionName(faction: FactionId): string {
    return FACTION_META[faction].shortLabel;
  }

  factionAccent(faction: FactionId): string {
    return FACTION_META[faction].accentClass;
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month} · ${hours}:${minutes}`;
  }
}
