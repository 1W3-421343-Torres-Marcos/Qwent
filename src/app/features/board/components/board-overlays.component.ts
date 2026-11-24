import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { CardInstance, GameState, PlayerId, PlayerState } from '../../../../core';
import { AbilityIconComponent, RowIconComponent } from '../../../shared/components/card-icons.component';
import { FactionEmblemComponent } from '../../../shared/components/faction-emblem.component';
import { createSpriteFallbackTracker } from '../../../shared/constants/card-art';

@Component({
  selector: 'app-board-overlays',
  standalone: true,
  imports: [AbilityIconComponent, RowIconComponent, FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Opaque 2P Turn Handoff Overlay -->
    @if (
      turnHandoffPending() &&
      (state().phase === 'PLAYING' || state().phase === 'MULLIGAN' || state().phase === 'PENDING_SELECTION')
    ) {
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

    <!-- Initial Mulligan Modal (human player only) -->
    @if (state().phase === 'MULLIGAN' && !turnHandoffPending() && isHumanTurn()) {
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
                class="relative flex min-h-[108px] flex-col justify-between overflow-hidden rounded-lg border bg-tavern-dark/90 p-2 text-left transition hover:border-gold-bright active:scale-95 disabled:opacity-60"
                [class.border-gold-bright]="card.card.isHero"
                [class.border-bronze]="!card.card.isHero"
              >
                @if (art.hasSprite(card.card.id, card.instanceId)) {
                  <img
                    [src]="art.spritePath(card.card.id, card.instanceId)"
                    [alt]="card.card.name"
                    loading="lazy"
                    decoding="async"
                    (error)="art.markFailed(card.card.id, card.instanceId)"
                    class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                  />
                  <span
                    class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/65 to-black/25"
                  ></span>
                } @else {
                  <span
                    class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15 text-gold"
                  >
                    <span class="h-10 w-10"><app-faction-emblem [faction]="card.card.faction" /></span>
                  </span>
                }

                <div class="relative z-10 flex items-start justify-between gap-1">
                  <span
                    class="qwent-num-shadow flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-tavern-dark/90 text-xs font-extrabold"
                    [class.border-gold-bright]="card.card.isHero"
                    [class.text-gold-bright]="card.card.isHero"
                    [class.border-bronze]="!card.card.isHero"
                    [class.text-strength-normal]="!card.card.isHero"
                  >
                    {{ card.card.type === 'SPECIAL' ? '★' : card.card.baseStrength }}
                  </span>

                  <div class="flex items-center gap-1">
                    @if (card.card.allowedRows.length > 0 && card.card.type === 'UNIT') {
                      <span class="flex h-4 w-4 items-center justify-center rounded-full bg-tavern-dark/80 p-0.5 text-parchment/90">
                        <app-row-icon [row]="card.card.allowedRows.length > 1 ? 'AGILE' : card.card.allowedRows[0]!" />
                      </span>
                    }
                    @if (card.card.ability; as ability) {
                      <span class="flex h-4 w-4 items-center justify-center rounded-full bg-tavern-dark/85 p-0.5 text-gold-bright">
                        <app-ability-icon [ability]="ability" />
                      </span>
                    }
                  </div>
                </div>

                <div class="relative z-10">
                  <p class="qwent-num-shadow line-clamp-2 text-[11px] font-bold leading-tight text-parchment">
                    {{ card.card.name }}
                  </p>
                  <p class="mt-0.5 line-clamp-1 text-[9px] text-parchment/75">
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

          <div class="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              (click)="menuRequested.emit()"
              class="min-h-[48px] rounded-lg border border-bronze bg-tavern-dark px-4 py-3 text-sm font-bold uppercase tracking-wider text-parchment transition active:scale-95"
            >
              Menú Principal
            </button>
            <button
              type="button"
              (click)="newMatchRequested.emit()"
              class="min-h-[48px] rounded-lg border-2 border-gold-bright bg-gold/25 px-4 py-3 text-sm font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
            >
              Nueva Partida
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Medic Resurrection Target Selector (human player only) -->
    @if (
      state().phase === 'PENDING_SELECTION' &&
      state().pendingSelection?.type === 'MEDIC_DISCARD' &&
      !turnHandoffPending() &&
      isHumanTurn()
    ) {
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
                class="relative flex min-h-[68px] items-center gap-2 overflow-hidden rounded-lg border border-bronze bg-tavern-dark/90 p-2 text-left transition hover:border-gold-bright active:scale-95"
              >
                @if (art.hasSprite(card.card.id, card.instanceId)) {
                  <img
                    [src]="art.spritePath(card.card.id, card.instanceId)"
                    [alt]="card.card.name"
                    loading="lazy"
                    decoding="async"
                    (error)="art.markFailed(card.card.id, card.instanceId)"
                    class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                  />
                  <span
                    class="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/45"
                  ></span>
                }
                <span
                  class="qwent-num-shadow relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/70 bg-row-leather/95 text-sm font-extrabold text-strength-normal"
                >
                  {{ card.card.baseStrength }}
                </span>
                <div class="relative z-10 min-w-0 flex-1">
                  <p class="qwent-num-shadow truncate text-xs font-bold text-parchment">{{ card.card.name }}</p>
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

    <!-- Leader Discard Target Selector (human player only) -->
    @if (leaderPending(); as leaderSel) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div
          class="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-xl border-2 border-gold-bright bg-board-wood p-4 shadow-2xl"
        >
          <div class="border-b border-bronze/60 pb-2 text-center">
            <p class="text-[11px] font-bold uppercase tracking-widest text-gold">
              Habilidad de Líder · {{ leaderSel.source === 'OWN_DISCARD' ? 'Tu descarte' : 'Descarte rival' }}
            </p>
            <h3 class="font-serif text-lg font-extrabold text-parchment">
              Elige una unidad no-Héroe para llevar a tu mano
            </h3>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            @for (card of leaderChoices(); track card.instanceId) {
              <button
                type="button"
                (click)="leaderTargetSelected.emit(card.instanceId)"
                class="relative flex min-h-[68px] items-center gap-2 overflow-hidden rounded-lg border border-bronze bg-tavern-dark/90 p-2 text-left transition hover:border-gold-bright active:scale-95"
              >
                @if (art.hasSprite(card.card.id, card.instanceId)) {
                  <img
                    [src]="art.spritePath(card.card.id, card.instanceId)"
                    [alt]="card.card.name"
                    loading="lazy"
                    decoding="async"
                    (error)="art.markFailed(card.card.id, card.instanceId)"
                    class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                  />
                  <span
                    class="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/45"
                  ></span>
                }
                <span
                  class="qwent-num-shadow relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/70 bg-row-leather/95 text-sm font-extrabold text-strength-normal"
                >
                  {{ card.card.baseStrength }}
                </span>
                <div class="relative z-10 min-w-0 flex-1">
                  <p class="qwent-num-shadow truncate text-xs font-bold text-parchment">{{ card.card.name }}</p>
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

    <!-- Scoia'tael Start Choice Modal (human player only) -->
    @if (scoiataelPending(); as stChoice) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm">
        <div class="w-full max-w-md rounded-xl border-2 border-gold-bright bg-board-wood p-6 text-center shadow-2xl">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gold">
            Pasiva Scoia'tael
          </p>
          <h3 class="mt-2 font-serif text-xl font-extrabold text-parchment">
            ¿Quién comienza la Ronda 1?
          </h3>
          <p class="mt-1 text-xs text-parchment/75">
            {{ activePlayer().name }} puede ceder el primer turno para obtener ventaja de información.
          </p>

          <div class="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              (click)="scoiataelStarterSelected.emit(stChoice.playerId)"
              class="min-h-[48px] rounded-lg border border-bronze bg-tavern-dark px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-parchment transition hover:border-gold active:scale-95"
            >
              Empiezo yo
            </button>
            <button
              type="button"
              (click)="scoiataelStarterSelected.emit(opponentOf(stChoice.playerId))"
              class="min-h-[48px] rounded-lg border-2 border-gold-bright bg-gold/25 px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
            >
              Empieza el rival
            </button>
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
              <div class="relative flex min-h-[56px] items-center gap-2 overflow-hidden rounded border border-bronze/60 bg-tavern-dark/80 p-2 text-xs">
                @if (art.hasSprite(card.card.id, card.instanceId)) {
                  <img
                    [src]="art.spritePath(card.card.id, card.instanceId)"
                    [alt]="card.card.name"
                    loading="lazy"
                    decoding="async"
                    (error)="art.markFailed(card.card.id, card.instanceId)"
                    class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                  />
                  <span
                    class="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/45"
                  ></span>
                }
                <span
                  class="qwent-num-shadow relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-bronze bg-tavern-dark/90 font-bold"
                >
                  {{ card.card.type === 'SPECIAL' ? '★' : card.card.baseStrength }}
                </span>
                <span class="qwent-num-shadow relative z-10 line-clamp-2 text-parchment">{{ card.card.name }}</span>
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
  readonly isHumanTurn = input(true);
  readonly discardPlayer = input<PlayerState | null>(null);
  readonly medicChoices = input<readonly CardInstance[]>([]);
  readonly leaderChoices = input<readonly CardInstance[]>([]);

  readonly handoffConfirmed = output<void>();
  readonly advanceRoundRequested = output<void>();
  readonly newMatchRequested = output<void>();
  readonly menuRequested = output<void>();
  readonly discardClosed = output<void>();
  readonly medicTargetSelected = output<string>();
  readonly leaderTargetSelected = output<string>();
  readonly scoiataelStarterSelected = output<PlayerId>();
  readonly mulliganSwapRequested = output<string>();
  readonly finishMulliganRequested = output<void>();

  readonly art = createSpriteFallbackTracker();

  readonly leaderPending = computed(() => {
    const s = this.state();
    if (s.phase !== 'PENDING_SELECTION' || this.turnHandoffPending() || !this.isHumanTurn()) {
      return null;
    }
    return s.pendingSelection?.type === 'LEADER_TARGET' ? s.pendingSelection : null;
  });

  readonly scoiataelPending = computed(() => {
    const s = this.state();
    if (s.phase !== 'PENDING_SELECTION' || this.turnHandoffPending() || !this.isHumanTurn()) {
      return null;
    }
    return s.pendingSelection?.type === 'SCOIATAEL_START_CHOICE' ? s.pendingSelection : null;
  });

  opponentOf(playerId: PlayerId): PlayerId {
    return playerId === 'PLAYER_1' ? 'PLAYER_2' : 'PLAYER_1';
  }

  winnerName(winner: PlayerId | 'DRAW' | null | undefined): string {
    if (!winner || winner === 'DRAW') {
      return 'Empate';
    }
    return this.state().players[winner].name;
  }
}
