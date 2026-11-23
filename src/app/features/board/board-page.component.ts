import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { GameFacadeService } from '../../services/game-facade.service';
import { AbilityIconComponent } from '../../shared/components/card-icons.component';
import { CardDetailComponent } from '../../shared/components/card-detail.component';
import { BoardOverlaysComponent } from './components/board-overlays.component';
import { BoardRowComponent } from './components/board-row.component';
import { HandBarComponent } from './components/hand-bar.component';

const HOLD_TO_PASS_MS = 600;

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [
    BoardRowComponent,
    HandBarComponent,
    BoardOverlaysComponent,
    CardDetailComponent,
    AbilityIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      (click)="onBackdropClick()"
      class="h-dvh w-screen overflow-hidden bg-tavern-dark text-parchment p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
    >
      <div class="grid h-full w-full grid-cols-[18%_68%_14%] gap-1 p-1">
        <!-- LEFT ZONE (18%): Profiles, Gems, Global Scores, Hand Counts & Shared Weather Box -->
        <aside
          class="flex h-full min-h-0 flex-col justify-between rounded-lg border border-bronze/70 bg-board-wood p-1.5"
        >
          <!-- Opponent Status (Top) -->
          <section class="rounded border border-bronze/60 bg-tavern-dark/80 p-1.5">
            <div class="flex items-center justify-between gap-1">
              <div class="min-w-0">
                <p class="truncate text-[10px] font-bold uppercase tracking-wider text-parchment/70">
                  {{ facade.topPlayer().name }}
                </p>
                <div class="mt-0.5 flex items-center gap-1">
                  @for (gemIdx of [0, 1]; track gemIdx) {
                    <span
                      class="h-2.5 w-2.5 rounded-full border border-black/60"
                      [class.bg-gem-ruby]="gemIdx < facade.topPlayer().gems"
                      [class.bg-gem-ash]="gemIdx >= facade.topPlayer().gems"
                    ></span>
                  }
                  @if (facade.topPlayer().passed) {
                    <span class="ml-1 rounded bg-bronze/40 px-1 text-[9px] font-bold text-gold">
                      PASÓ
                    </span>
                  }
                </div>
              </div>
              <span
                class="font-serif text-[clamp(1.2rem,4vh,1.9rem)] font-extrabold tabular-nums text-parchment"
              >
                {{ facade.topPlayer().totalScore }}
              </span>
            </div>
            <p class="mt-0.5 text-[10px] text-parchment/70">
              Mano rival: <span class="font-bold text-parchment">{{ facade.topPlayer().hand.length }}</span>
            </p>
          </section>

          <!-- Shared Weather Box (Exact Center of Left Column) -->
          <section class="rounded border border-bronze bg-tavern-dark/90 p-1.5">
            <p class="mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-parchment/60">
              Clima activo
            </p>
            <div class="grid grid-cols-3 gap-1">
              <div
                class="flex h-9 items-center justify-center rounded border"
                [class]="
                  facade.state().weather.frost !== null
                    ? 'border-weather-frost bg-weather-frost/20 text-weather-frost'
                    : 'border-bronze/40 text-parchment/25'
                "
                title="Escarcha helada"
              >
                <span class="h-5 w-5"><app-ability-icon ability="WEATHER_FROST" /></span>
              </div>
              <div
                class="flex h-9 items-center justify-center rounded border"
                [class]="
                  facade.state().weather.fog !== null
                    ? 'border-weather-fog bg-weather-fog/20 text-weather-fog'
                    : 'border-bronze/40 text-parchment/25'
                "
                title="Niebla impenetrable"
              >
                <span class="h-5 w-5"><app-ability-icon ability="WEATHER_FOG" /></span>
              </div>
              <div
                class="flex h-9 items-center justify-center rounded border"
                [class]="
                  facade.state().weather.rain !== null
                    ? 'border-weather-rain bg-weather-rain/20 text-weather-rain'
                    : 'border-bronze/40 text-parchment/25'
                "
                title="Lluvia torrencial"
              >
                <span class="h-5 w-5"><app-ability-icon ability="WEATHER_RAIN" /></span>
              </div>
            </div>
          </section>

          <!-- Bottom Player Status -->
          <section class="rounded border border-gold/60 bg-tavern-dark/90 p-1.5">
            <div class="flex items-center justify-between gap-1">
              <div class="min-w-0">
                <p class="truncate text-[10px] font-bold uppercase tracking-wider text-gold">
                  {{ facade.bottomPlayer().name }}
                </p>
                <div class="mt-0.5 flex items-center gap-1">
                  @for (gemIdx of [0, 1]; track gemIdx) {
                    <span
                      class="h-2.5 w-2.5 rounded-full border border-black/60"
                      [class.bg-gem-ruby]="gemIdx < facade.bottomPlayer().gems"
                      [class.bg-gem-ash]="gemIdx >= facade.bottomPlayer().gems"
                    ></span>
                  }
                  @if (facade.bottomPlayer().passed) {
                    <span class="ml-1 rounded bg-bronze/40 px-1 text-[9px] font-bold text-gold">
                      PASÓ
                    </span>
                  }
                </div>
              </div>
              <span
                class="font-serif text-[clamp(1.2rem,4vh,1.9rem)] font-extrabold tabular-nums text-gold-bright"
              >
                {{ facade.bottomPlayer().totalScore }}
              </span>
            </div>
            <p class="mt-0.5 text-[10px] text-parchment/75">
              Tu mano: <span class="font-bold text-parchment">{{ facade.bottomPlayer().hand.length }}</span>
              · Ronda {{ facade.state().roundNumber }}/3
            </p>
          </section>
        </aside>

        <!-- CENTER ZONE (68%): 6 Symmetrical Combat Rows + Hand Tray -->
        <section class="flex h-full min-h-0 flex-col gap-[3px]">
          <!-- Opponent 3 rows (Siege, Ranged, Close Combat) -->
          <div class="grid min-h-0 flex-1 grid-rows-3 gap-[3px]">
            <app-board-row
              rowType="SIEGE"
              [row]="facade.topPlayer().rows.SIEGE"
              [weatherActive]="facade.state().weather.rain !== null"
              (cardInspected)="onInspectFromBoard($event)"
            />
            <app-board-row
              rowType="RANGED"
              [row]="facade.topPlayer().rows.RANGED"
              [weatherActive]="facade.state().weather.fog !== null"
              (cardInspected)="onInspectFromBoard($event)"
            />
            <app-board-row
              rowType="CLOSE_COMBAT"
              [row]="facade.topPlayer().rows.CLOSE_COMBAT"
              [weatherActive]="facade.state().weather.frost !== null"
              (cardInspected)="onInspectFromBoard($event)"
            />
          </div>

          <!-- Central Horizontal Divider -->
          <div class="h-[2px] w-full shrink-0 bg-bronze"></div>

          <!-- Player 3 rows (Close Combat, Ranged, Siege) -->
          <div class="grid min-h-0 flex-1 grid-rows-3 gap-[3px]">
            <app-board-row
              rowType="CLOSE_COMBAT"
              [row]="facade.bottomPlayer().rows.CLOSE_COMBAT"
              [weatherActive]="facade.state().weather.frost !== null"
              [isSelectable]="facade.isOwnRowSelectable('CLOSE_COMBAT')"
              [highlightHornSlot]="facade.isSelectingHornTarget()"
              [decoySelecting]="facade.isSelectingDecoyTarget()"
              (rowSelected)="onOwnRowSelected($event)"
              (unitTargeted)="facade.onOwnUnitTap($event)"
              (cardInspected)="onInspectFromBoard($event)"
            />
            <app-board-row
              rowType="RANGED"
              [row]="facade.bottomPlayer().rows.RANGED"
              [weatherActive]="facade.state().weather.fog !== null"
              [isSelectable]="facade.isOwnRowSelectable('RANGED')"
              [highlightHornSlot]="facade.isSelectingHornTarget()"
              [decoySelecting]="facade.isSelectingDecoyTarget()"
              (rowSelected)="onOwnRowSelected($event)"
              (unitTargeted)="facade.onOwnUnitTap($event)"
              (cardInspected)="onInspectFromBoard($event)"
            />
            <app-board-row
              rowType="SIEGE"
              [row]="facade.bottomPlayer().rows.SIEGE"
              [weatherActive]="facade.state().weather.rain !== null"
              [isSelectable]="facade.isOwnRowSelectable('SIEGE')"
              [highlightHornSlot]="facade.isSelectingHornTarget()"
              [decoySelecting]="facade.isSelectingDecoyTarget()"
              (rowSelected)="onOwnRowSelected($event)"
              (unitTargeted)="facade.onOwnUnitTap($event)"
              (cardInspected)="onInspectFromBoard($event)"
            />
          </div>

          <!-- Hand Tray directly beneath own Siege row -->
          <div class="h-[19vh] min-h-[72px] shrink-0" (click)="$event.stopPropagation()">
            <app-hand-bar
              [hand]="facade.bottomPlayer().hand"
              [selectedInstanceId]="facade.selectedInstanceId()"
              [isPlayableFn]="playableChecker"
              (cardTapped)="facade.onHandCardTap($event)"
            />
          </div>
        </section>

        <!-- RIGHT ZONE (14%): Discard/Deck Stacks & Hold-to-Pass Button -->
        <aside
          class="flex h-full min-h-0 flex-col justify-between rounded-lg border border-bronze/70 bg-board-wood p-1.5"
          (click)="$event.stopPropagation()"
        >
          <!-- Opponent Piles (Top) -->
          <div class="flex flex-col gap-1">
            <button
              type="button"
              (click)="facade.openDiscardModal(facade.topPlayer().id)"
              class="flex min-h-[44px] flex-col items-center justify-center rounded border border-bronze/60 bg-tavern-dark/80 px-1 py-1 text-[10px] hover:border-gold"
            >
              <span class="text-parchment/70">Descarte</span>
              <span class="font-bold text-parchment">{{ facade.topPlayer().discard.length }}</span>
            </button>
            <div
              class="flex h-9 flex-col items-center justify-center rounded border border-bronze/40 bg-row-leather/80 px-1 text-[10px]"
            >
              <span class="text-parchment/70">Mazo</span>
              <span class="font-bold text-parchment">{{ facade.topPlayer().deck.length }}</span>
            </div>
          </div>

          <!-- Center Badge -->
          <div class="text-center">
            <span
              class="inline-block rounded border border-bronze/60 bg-tavern-dark/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold"
            >
              {{ facade.phaseLabel }}
            </span>
          </div>

          <!-- Active Player Piles & Hold-to-Pass (Lower Third) -->
          <div class="flex flex-col gap-1.5">
            <button
              type="button"
              (click)="facade.openDiscardModal(facade.bottomPlayer().id)"
              class="flex min-h-[44px] flex-col items-center justify-center rounded border border-bronze/60 bg-tavern-dark/80 px-1 py-1 text-[10px] hover:border-gold"
            >
              <span class="text-parchment/70">Descarte</span>
              <span class="font-bold text-parchment">{{ facade.bottomPlayer().discard.length }}</span>
            </button>
            <div
              class="flex h-9 flex-col items-center justify-center rounded border border-bronze/40 bg-row-leather/80 px-1 text-[10px]"
            >
              <span class="text-parchment/70">Mazo</span>
              <span class="font-bold text-parchment">{{ facade.bottomPlayer().deck.length }}</span>
            </div>

            <!-- Hold-to-Pass (600ms) Ergonomic Thumb Button -->
            <button
              type="button"
              (pointerdown)="startHoldPass()"
              (pointerup)="cancelHoldPass()"
              (pointerleave)="cancelHoldPass()"
              (pointercancel)="cancelHoldPass()"
              [disabled]="
                facade.turnHandoffPending() ||
                facade.isTransitioningTurn() ||
                facade.isAiThinking() ||
                !facade.isHumanTurn() ||
                facade.bottomPlayer().passed
              "
              class="relative min-h-[48px] w-full overflow-hidden rounded-lg border-2 border-gold/70 bg-tavern-dark px-1 py-2 text-[11px] font-extrabold uppercase tracking-wide text-gold disabled:opacity-45"
            >
              <span
                class="pointer-events-none absolute inset-y-0 left-0 bg-gold/40 transition-none"
                [style.width.%]="holdProgress()"
              ></span>
              <span class="relative z-10 leading-tight">
                {{ holdProgress() > 0 ? 'Manteniendo...' : 'Pasar' }}
              </span>
            </button>
          </div>
        </aside>
      </div>

      <!-- AI Thinking Indicator -->
      @if (facade.isAiThinking()) {
        <div
          class="fixed left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gold/70 bg-tavern-dark/95 px-4 py-1.5 text-xs font-bold tracking-wider text-gold shadow-xl"
        >
          <span class="h-2 w-2 animate-ping rounded-full bg-gold-bright"></span>
          <span>{{ facade.state().phase === 'MULLIGAN' ? 'IA revisando mano...' : 'IA pensando jugada...' }}</span>
        </div>
      }

      <!-- Target Selection Floating Prompt -->
      @if (facade.selectionPrompt(); as prompt) {
        <div
          (click)="$event.stopPropagation()"
          class="fixed left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gold-bright bg-tavern-dark/95 px-4 py-1.5 text-xs font-semibold text-gold-bright shadow-xl"
        >
          <span>{{ prompt }}</span>
          @if (facade.canCancelSelection()) {
            <button
              type="button"
              (click)="facade.clearSelection()"
              class="min-h-[44px] min-w-[44px] rounded border border-bronze bg-board-wood px-3 py-1 text-[11px] text-parchment hover:border-gold"
            >
              Cancelar
            </button>
          }
        </div>
      }

      <!-- Floating Card Detail Inspector (never fixed inside 14% right column) -->
      @if (facade.inspectedCard(); as inspected) {
        <div (click)="$event.stopPropagation()">
          <app-card-detail
            [card]="inspected"
            [canConfirmPlay]="facade.inspectorCanConfirmPlay()"
            (closed)="facade.closeInspector()"
            (playRequested)="facade.playSelectedFromInspector($event)"
          />
        </div>
      }

      <!-- Overlays: 2P Turn Handoff, Mulligan, Medic Discard, Round End, Match End, Discard Pile -->
      <app-board-overlays
        [state]="facade.state()"
        [activePlayer]="facade.state().players[facade.state().activePlayer]"
        [turnHandoffPending]="facade.turnHandoffPending()"
        [isHumanTurn]="facade.isHumanTurn()"
        [discardPlayer]="facade.discardModalPlayer()"
        [medicChoices]="facade.medicDiscardChoices()"
        (handoffConfirmed)="facade.confirmTurnHandoff()"
        (advanceRoundRequested)="facade.advanceRound()"
        (newMatchRequested)="facade.startNewMatch()"
        (menuRequested)="exitToMenu.emit()"
        (discardClosed)="facade.closeDiscardModal()"
        (medicTargetSelected)="facade.selectMedicTarget($event)"
        (mulliganSwapRequested)="facade.mulliganSwap($event)"
        (finishMulliganRequested)="facade.finishMulligan()"
      />
    </main>
  `,
})
export class BoardPageComponent {
  readonly facade = inject(GameFacadeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly exitToMenu = output<void>();
  readonly holdProgress = signal(0);
  private holdIntervalId: ReturnType<typeof setInterval> | null = null;
  private holdStartTimestamp = 0;

  readonly playableChecker = (instanceId: string): boolean => this.facade.canPlayFromHand(instanceId);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelHoldPass();
    });
  }

  onBackdropClick(): void {
    this.facade.clearSelection();
  }

  onOwnRowSelected(rowType: Parameters<GameFacadeService['onOwnRowTap']>[0]): void {
    this.facade.onOwnRowTap(rowType);
  }

  onInspectFromBoard(card: Parameters<GameFacadeService['inspectCard']>[0]): void {
    this.facade.inspectCard(card);
  }

  startHoldPass(): void {
    if (
      this.facade.turnHandoffPending() ||
      this.facade.isTransitioningTurn() ||
      this.facade.isAiThinking() ||
      !this.facade.isHumanTurn() ||
      this.facade.bottomPlayer().passed ||
      this.facade.state().phase !== 'PLAYING'
    ) {
      return;
    }

    this.cancelHoldPass();
    this.holdStartTimestamp = Date.now();
    this.holdProgress.set(5);

    this.holdIntervalId = setInterval(() => {
      const elapsed = Date.now() - this.holdStartTimestamp;
      const percent = Math.min(100, Math.round((elapsed / HOLD_TO_PASS_MS) * 100));
      this.holdProgress.set(percent);

      if (elapsed >= HOLD_TO_PASS_MS) {
        this.cancelHoldPass();
        this.facade.passTurn();
      }
    }, 30);
  }

  cancelHoldPass(): void {
    if (this.holdIntervalId !== null) {
      clearInterval(this.holdIntervalId);
      this.holdIntervalId = null;
    }
    this.holdProgress.set(0);
  }
}
