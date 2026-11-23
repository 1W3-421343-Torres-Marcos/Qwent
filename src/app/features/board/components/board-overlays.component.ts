import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { CardInstance, GameState, PlayerId, PlayerState } from '../../../../core';
import { AbilityIconComponent, RowIconComponent } from '../../../shared/components/card-icons.component';

@Component({
  selector: 'app-board-overlays',
  standalone: true,
  imports: [AbilityIconComponent, RowIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Opaque 2P Turn Handoff Overlay -->
    @if (turnHandoffPending() && (state().phase === 'PLAYING' || state().phase === 'MULLIGAN')) {
      <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-tavern-dark/[0.98] p-6 text-center backdrop-blur-md"
      >
        <div class="max-w-md rounded-xl border-2 border-gold/70 bg-board-wood px-8 py-6 shadow-2xl">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gold">Cambio de turno</p>
          <h2 class="mt-2 font-serif text-2xl font-extrabold text-parchment">
            {{ activePlayer().name }}
          </h2>
          <p class="mt-2 text-sm text-parchment/80">
            Pasa el dispositivo al jugador activo antes de revelar su mano.
          </p>
          <p class="mt-1 text-xs text-parchment/60">
            Ronda {{ state().roundNumber }} · Cartas en mano: {{ activePlayer().hand.length }}
          </p>
          <button
            type="button"
            (click)="handoffConfirmed.emit()"
            class="mt-5 min-h-[48px] w-full rounded-lg border-2 border-gold-bright bg-gold/25 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
          >
            Mostrar mano y jugar
          </button>
        </div>
      </div>
    }

    <!-- Initial Mulligan Modal -->
    @if (state().phase === 'MULLIGAN' && !turnHandoffPending()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm">
        <div
          class="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-xl border-2 border-gold/80 bg-board-wood p-4 shadow-2xl"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-bronze/60 pb-2">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-widest text-gold">
                Mulligan Inicial · {{ activePlayer().name }}
              </p>
              <h3 class="font-serif text-base sm:text-lg font-extrabold text-parchment">
                Toca hasta 2 cartas para devolverlas al mazo y robar reemplazos
              </h3>
            </div>
            <span
              class="rounded border border-gold/60 bg-tavern-dark px-3 py-1 text-xs font-bold text-gold-bright"
            >
              Cambios restantes: {{ activePlayer().mulligansRemaining }}/2
            </span>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-5">
            @for (card of activePlayer().hand; track card.instanceId) {
              <button
                type="button"
                (click)="mulliganSwapRequested.emit(card.instanceId)"
                [disabled]="activePlayer().mulligansRemaining <= 0 || activePlayer().deck.length === 0"
                class="flex min-h-[76px] flex-col justify-between rounded-lg border bg-tavern-dark/90 p-2 text-left transition hover:border-gold-bright active:scale-95 disabled:opacity-60"
                [class.border-gold-bright]="card.card.isHero"
                [class.border-bronze]="!card.card.isHero"
              >
                <div class="flex items-start justify-between gap-1">
                  <span
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold"
                    [class.border-gold-bright]="card.card.isHero"
                    [class.text-gold-bright]="card.card.isHero"
                    [class.border-bronze]="!card.card.isHero"
                    [class.text-strength-normal]="!card.card.isHero"
                  >
                    {{ card.card.type === 'SPECIAL' ? '★' : card.card.baseStrength }}
                  </span>

                  <div class="flex items-center gap-1">
                    @if (card.card.allowedRows.length > 0 && card.card.type === 'UNIT') {
                      <span class="h-4 w-4 text-parchment/80">
                        <app-row-icon [row]="card.card.allowedRows.length > 1 ? 'AGILE' : card.card.allowedRows[0]!" />
                      </span>
                    }
                    @if (card.card.ability; as ability) {
                      <span class="h-4 w-4 text-gold-bright">
                        <app-ability-icon [ability]="ability" />
                      </span>
                    }
                  </div>
                </div>

                <div>
                  <p class="line-clamp-2 text-[11px] font-bold leading-tight text-parchment">
                    {{ card.card.name }}
                  </p>
                  <p class="mt-0.5 line-clamp-1 text-[9px] text-parchment/65">
                    {{ card.card.ability ?? 'Unidad estándar' }}
                  </p>
                </div>
              </button>
            }
          </div>

          <div class="mt-3 flex justify-end border-t border-bronze/60 pt-2">
            <button
              type="button"
              (click)="finishMulliganRequested.emit()"
              class="min-h-[44px] rounded-lg border-2 border-gold-bright bg-gold/25 px-6 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
            >
              Confirmar mano y comenzar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Round End Overlay -->
    @if (state().phase === 'ROUND_END') {
      @let lastRound = state().roundHistory[state().roundHistory.length - 1];
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-xl border-2 border-bronze bg-board-wood p-6 text-center shadow-2xl">
          <p class="text-xs font-bold uppercase tracking-widest text-gold">
            Fin de Ronda {{ lastRound?.roundNumber ?? state().roundNumber }}
          </p>
          <h2 class="mt-1 font-serif text-2xl font-extrabold text-parchment">
            @if (lastRound?.winner === 'DRAW') {
              Empate de Ronda
            } @else if (lastRound) {
              Gana {{ winnerName(lastRound.winner) }}
            }
          </h2>

          <div class="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-bronze/60 bg-tavern-dark/80 p-3">
            <div>
              <p class="text-xs text-parchment/70">{{ state().players.PLAYER_1.name }}</p>
              <p class="text-2xl font-extrabold text-parchment">{{ lastRound?.scores?.PLAYER_1 ?? 0 }}</p>
              <p class="text-[11px] text-gem-ruby">Gemas: {{ state().players.PLAYER_1.gems }}</p>
            </div>
            <div>
              <p class="text-xs text-parchment/70">{{ state().players.PLAYER_2.name }}</p>
              <p class="text-2xl font-extrabold text-parchment">{{ lastRound?.scores?.PLAYER_2 ?? 0 }}</p>
              <p class="text-[11px] text-gem-ruby">Gemas: {{ state().players.PLAYER_2.gems }}</p>
            </div>
          </div>

          <button
            type="button"
            (click)="advanceRoundRequested.emit()"
            class="mt-5 min-h-[48px] w-full rounded-lg border-2 border-gold-bright bg-gold/25 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
          >
            Siguiente Ronda
          </button>
        </div>
      </div>
    }

    <!-- Match End Overlay -->
    @if (state().phase === 'MATCH_END') {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-xl border-2 border-gold-bright bg-board-wood p-6 text-center shadow-2xl">
          <p class="text-xs font-bold uppercase tracking-widest text-gold">Fin de la Partida</p>
          <h2 class="mt-1 font-serif text-3xl font-extrabold text-gold-bright">
            @if (state().winner === 'DRAW' || state().winner === null) {
              Empate Global
            } @else {
              Victoria: {{ winnerName(state().winner) }}
            }
          </h2>

          <div class="mt-4 space-y-1.5 rounded-lg border border-bronze/60 bg-tavern-dark/85 p-3 text-xs">
            @for (round of state().roundHistory; track round.roundNumber) {
              <div class="flex items-center justify-between border-b border-bronze/30 pb-1 last:border-b-0 last:pb-0">
                <span class="font-semibold text-parchment/80">Ronda {{ round.roundNumber }}</span>
                <span class="font-mono text-parchment">
                  {{ round.scores.PLAYER_1 }} vs {{ round.scores.PLAYER_2 }}
                </span>
                <span class="font-semibold text-gold">
                  {{ winnerName(round.winner) }}
                </span>
              </div>
            }
          </div>

          <button
            type="button"
            (click)="newMatchRequested.emit()"
            class="mt-5 min-h-[48px] w-full rounded-lg border-2 border-gold-bright bg-gold/25 px-6 py-3 text-sm font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
          >
            Nueva Partida
          </button>
        </div>
      </div>
    }

    <!-- Medic Resurrection Target Selector -->
    @if (state().phase === 'PENDING_SELECTION' && state().pendingSelection?.type === 'MEDIC_DISCARD') {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div
          class="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-xl border-2 border-gold-bright bg-board-wood p-4 shadow-2xl"
        >
          <div class="border-b border-bronze/60 pb-2 text-center">
            <p class="text-[11px] font-bold uppercase tracking-widest text-gold">Habilidad Médico</p>
            <h3 class="font-serif text-lg font-extrabold text-parchment">
              Elige una unidad de tu descarte para revivir
            </h3>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            @for (card of medicChoices(); track card.instanceId) {
              <button
                type="button"
                (click)="medicTargetSelected.emit(card.instanceId)"
                class="flex min-h-[56px] items-center gap-2 rounded-lg border border-bronze bg-tavern-dark/90 p-2 text-left transition hover:border-gold-bright active:scale-95"
              >
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/70 bg-row-leather text-sm font-extrabold text-strength-normal"
                >
                  {{ card.card.baseStrength }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-bold text-parchment">{{ card.card.name }}</p>
                  @if (card.card.ability; as ability) {
                    <div class="mt-0.5 flex items-center gap-1 text-[10px] text-gold-bright">
                      <span class="h-3 w-3"><app-ability-icon [ability]="ability" /></span>
                      <span class="truncate">{{ ability }}</span>
                    </div>
                  }
                </div>
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- Discard Pile Modal -->
    @if (discardPlayer(); as player) {
      <div
        (click)="discardClosed.emit()"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      >
        <div
          (click)="$event.stopPropagation()"
          class="flex max-h-[85dvh] w-full max-w-xl flex-col rounded-xl border-2 border-bronze bg-board-wood p-4 shadow-2xl"
        >
          <div class="flex items-center justify-between border-b border-bronze/60 pb-2">
            <h3 class="font-serif text-lg font-bold text-parchment">
              Descarte · {{ player.name }} ({{ player.discard.length }})
            </h3>
            <button
              type="button"
              (click)="discardClosed.emit()"
              class="flex h-11 w-11 items-center justify-center rounded-lg text-parchment hover:bg-row-leather"
            >
              ✕
            </button>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            @for (card of player.discard; track card.instanceId) {
              <div class="flex items-center gap-2 rounded border border-bronze/60 bg-tavern-dark/80 p-2 text-xs">
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-bronze font-bold"
                >
                  {{ card.card.type === 'SPECIAL' ? '★' : card.card.baseStrength }}
                </span>
                <span class="line-clamp-2 text-parchment">{{ card.card.name }}</span>
              </div>
            } @empty {
              <p class="col-span-full py-6 text-center text-sm text-parchment/60">
                Pila de descarte vacía.
              </p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class BoardOverlaysComponent {
  readonly state = input.required<GameState>();
  readonly activePlayer = input.required<PlayerState>();
  readonly turnHandoffPending = input.required<boolean>();
  readonly discardPlayer = input<PlayerState | null>(null);
  readonly medicChoices = input<readonly CardInstance[]>([]);

  readonly handoffConfirmed = output<void>();
  readonly advanceRoundRequested = output<void>();
  readonly newMatchRequested = output<void>();
  readonly discardClosed = output<void>();
  readonly medicTargetSelected = output<string>();
  readonly mulliganSwapRequested = output<string>();
  readonly finishMulliganRequested = output<void>();

  winnerName(winner: PlayerId | 'DRAW' | null | undefined): string {
    if (!winner || winner === 'DRAW') {
      return 'Empate';
    }
    return this.state().players[winner].name;
  }
}
