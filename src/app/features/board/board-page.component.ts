import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import type { FactionId, PlayerState } from '../../../core';
import { FeedbackService } from '../../services/feedback.service';
import { GameFacadeService, type VisualEffectType } from '../../services/game-facade.service';
import { AbilityIconComponent } from '../../shared/components/card-icons.component';
import { CardDetailComponent } from '../../shared/components/card-detail.component';
import { DeckBackComponent } from '../../shared/components/deck-back.component';
import { FactionEmblemComponent } from '../../shared/components/faction-emblem.component';
import { createSpriteFallbackTracker } from '../../shared/constants/card-art';
import { FACTION_META } from '../../shared/constants/faction-meta';
import { BoardBannerComponent } from './components/board-banner.component';
import { BoardOverlaysComponent } from './components/board-overlays.component';
import { BoardRowComponent } from './components/board-row.component';
import { HandBarComponent } from './components/hand-bar.component';

const HOLD_TO_PASS_MS = 600;

const VISUAL_FX_CLASS_MAP: Readonly<Partial<Record<VisualEffectType, string>>> = {
  SCORCH: 'qwent-scorch-overlay',
  HORN: 'qwent-horn-overlay',
  WEATHER_FROST: 'qwent-frost-overlay',
  WEATHER_FOG: 'qwent-fog-overlay',
  WEATHER_RAIN: 'qwent-rain-overlay',
  WEATHER_CLEAR: 'qwent-clear-overlay',
  HERO: 'qwent-hero-overlay',
  MEDIC: 'qwent-medic-overlay',
  MUSTER: 'qwent-muster-overlay',
};

const WEATHER_BOX_SLOTS = [
  {
    key: 'frost',
    ability: 'WEATHER_FROST',
    cardId: 'sp_biting_frost',
    label: 'Escarcha helada',
    activeClass:
      'border-weather-frost bg-weather-frost/20 text-weather-frost shadow-[0_0_8px_rgba(56,189,248,0.4)]',
  },
  {
    key: 'fog',
    ability: 'WEATHER_FOG',
    cardId: 'sp_impenetrable_fog',
    label: 'Niebla impenetrable',
    activeClass:
      'border-weather-fog bg-weather-fog/20 text-weather-fog shadow-[0_0_8px_rgba(203,213,225,0.35)]',
  },
  {
    key: 'rain',
    ability: 'WEATHER_RAIN',
    cardId: 'sp_torrential_rain',
    label: 'Lluvia torrencial',
    activeClass:
      'border-weather-rain bg-weather-rain/20 text-weather-rain shadow-[0_0_8px_rgba(96,165,250,0.4)]',
  },
] as const;

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [
    BoardBannerComponent,
    BoardRowComponent,
    HandBarComponent,
    BoardOverlaysComponent,
    CardDetailComponent,
    DeckBackComponent,
    AbilityIconComponent,
    FactionEmblemComponent,
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
          class="qwent-wood-surface flex h-full min-h-0 flex-col justify-between rounded-lg border border-bronze/70 p-1.5"
        >
          <!-- Opponent Status (Top) -->
          <section
            class="rounded border bg-tavern-dark/85 p-1.5 transition"
            [class]="
              facade.state().activePlayer === facade.topPlayer().id
                ? 'border-gold-bright ring-1 ring-gold-bright/50'
                : 'border-bronze/60'
            "
          >
            <div class="flex items-center justify-between gap-1">
              <div class="min-w-0">
                <div class="flex items-center gap-1">
                  <span class="h-3.5 w-3.5 shrink-0" [class]="factionAccent(facade.topPlayer().faction)">
                    <app-faction-emblem [faction]="facade.topPlayer().faction" />
                  </span>
                  <p class="truncate text-[10px] font-bold uppercase tracking-wider text-parchment/80">
                    {{ facade.topPlayer().name }}
                  </p>
                </div>
                <div class="mt-0.5 flex items-center gap-1">
                  @for (gemIdx of [0, 1]; track gemIdx) {
                    <span
                      class="h-2.5 w-2.5 rounded-full border border-black/60"
                      [class]="gemClass(facade.topPlayer(), gemIdx)"
                    ></span>
                  }
                  @if (facade.topPlayer().passed) {
                    <span class="ml-1 rounded bg-bronze/40 px-1 text-[9px] font-bold text-gold">
                      PASÓ
                    </span>
                  }
                </div>
              </div>
              <div class="flex items-center gap-1">
                @if (topIsLeading()) {
                  <span
                    title="Ganando la ronda"
                    class="qwent-crown-pulse text-sm leading-none text-gold-bright drop-shadow"
                  >
                    ♛
                  </span>
                }
                <span
                  class="qwent-num-shadow font-serif text-[clamp(1.25rem,4.2vh,2rem)] font-extrabold text-parchment"
                >
                  {{ facade.topPlayer().totalScore }}
                </span>
              </div>
            </div>
            <p class="mt-0.5 text-[10px] text-parchment/70">
              Mano rival: <span class="font-bold text-parchment">{{ facade.topPlayer().hand.length }}</span>
            </p>
            @if (facade.topPlayer().leader; as topLeader) {
              <button
                type="button"
                (click)="$event.stopPropagation(); facade.inspectLeader(facade.topPlayer().id)"
                class="mt-1 flex w-full items-center justify-between gap-1 rounded border border-bronze/50 bg-row-leather/80 px-1.5 py-0.5 text-left text-[9px] hover:border-gold"
              >
                <div class="flex min-w-0 items-center gap-1.5">
                  @if (art.hasSprite(topLeader.id)) {
                    <img
                      [src]="art.spritePath(topLeader.id)"
                      [alt]="topLeader.name"
                      decoding="async"
                      (error)="art.markFailed(topLeader.id)"
                      class="h-6 w-5 shrink-0 rounded-sm border border-gold/50 object-cover object-top"
                    />
                  } @else {
                    <span class="shrink-0 text-gold">♛</span>
                  }
                  <span class="truncate font-semibold text-parchment/90">{{ topLeader.name }}</span>
                </div>
                <span
                  class="shrink-0 rounded px-1 font-bold uppercase"
                  [class]="facade.topPlayer().leaderUsed ? 'text-parchment/45' : 'text-gold'"
                >
                  {{ facade.topPlayer().leaderUsed ? 'Usado' : 'Listo' }}
                </span>
              </button>
            }
          </section>

          <!-- Shared Weather Box (Exact Center of Left Column) -->
          <section class="rounded border border-bronze bg-tavern-dark/90 p-1.5">
            <p class="mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-parchment/60">
              Clima activo
            </p>
            <div class="grid grid-cols-3 gap-1">
              @for (slot of weatherSlots; track slot.key) {
                @let weatherEntry = facade.state().weather[slot.key];
                @let isActive = weatherEntry !== null;
                @let activeSpriteId = weatherEntry ? weatherEntry.card.definitionId : slot.cardId;
                <div
                  class="relative flex h-10 items-center justify-center overflow-hidden rounded border transition"
                  [class]="isActive ? slot.activeClass : 'border-bronze/40 text-parchment/25'"
                  [class.cursor-pointer]="isActive"
                  (click)="onWeatherSlotClick($event, weatherEntry?.card ?? null)"
                  [title]="weatherEntry ? weatherEntry.card.card.name : slot.label"
                >
                  @if (isActive && art.hasSprite(activeSpriteId)) {
                    <img
                      [src]="art.spritePath(activeSpriteId)"
                      [alt]="weatherEntry ? weatherEntry.card.card.name : slot.label"
                      decoding="async"
                      (error)="art.markFailed(activeSpriteId)"
                      class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                    />
                    <span
                      class="relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-tavern-dark/80 p-0.5 shadow"
                    >
                      <app-ability-icon [ability]="weatherEntry?.card?.card?.ability ?? slot.ability" />
                    </span>
                  } @else {
                    <span class="h-5 w-5"><app-ability-icon [ability]="slot.ability" /></span>
                  }
                </div>
              }
            </div>
          </section>

          <!-- Bottom Player Status -->
          <section
            class="rounded border bg-tavern-dark/90 p-1.5 transition"
            [class]="
              facade.state().activePlayer === facade.bottomPlayer().id
                ? 'border-gold-bright ring-1 ring-gold-bright/50'
                : 'border-gold/60'
            "
          >
            <div class="flex items-center justify-between gap-1">
              <div class="min-w-0">
                <div class="flex items-center gap-1">
                  <span class="h-3.5 w-3.5 shrink-0" [class]="factionAccent(facade.bottomPlayer().faction)">
                    <app-faction-emblem [faction]="facade.bottomPlayer().faction" />
                  </span>
                  <p class="truncate text-[10px] font-bold uppercase tracking-wider text-gold">
                    {{ facade.bottomPlayer().name }}
                  </p>
                </div>
                <div class="mt-0.5 flex items-center gap-1">
                  @for (gemIdx of [0, 1]; track gemIdx) {
                    <span
                      class="h-2.5 w-2.5 rounded-full border border-black/60"
                      [class]="gemClass(facade.bottomPlayer(), gemIdx)"
                    ></span>
                  }
                  @if (facade.bottomPlayer().passed) {
                    <span class="ml-1 rounded bg-bronze/40 px-1 text-[9px] font-bold text-gold">
                      PASÓ
                    </span>
                  }
                </div>
              </div>
              <div class="flex items-center gap-1">
                @if (bottomIsLeading()) {
                  <span
                    title="Ganando la ronda"
                    class="qwent-crown-pulse text-sm leading-none text-gold-bright drop-shadow"
                  >
                    ♛
                  </span>
                }
                <span
                  class="qwent-num-shadow font-serif text-[clamp(1.25rem,4.2vh,2rem)] font-extrabold text-gold-bright"
                >
                  {{ facade.bottomPlayer().totalScore }}
                </span>
              </div>
            </div>
            <p class="mt-0.5 text-[10px] text-parchment/75">
              Tu mano: <span class="font-bold text-parchment">{{ facade.bottomPlayer().hand.length }}</span>
              · Ronda {{ facade.state().roundNumber }}/3
            </p>
            @if (facade.bottomPlayer().leader; as bottomLeader) {
              <button
                type="button"
                (click)="$event.stopPropagation(); facade.inspectLeader(facade.bottomPlayer().id)"
                class="mt-1 flex min-h-[32px] w-full items-center justify-between gap-1 rounded border px-1.5 py-1 text-left text-[10px] transition active:scale-95"
                [class]="
                  facade.canUseBottomLeader()
                    ? 'border-gold-bright bg-gold/20 text-gold-bright hover:bg-gold/30'
                    : 'border-bronze/50 bg-row-leather/80 text-parchment/75'
                "
              >
                <div class="flex min-w-0 items-center gap-1.5">
                  @if (art.hasSprite(bottomLeader.id)) {
                    <img
                      [src]="art.spritePath(bottomLeader.id)"
                      [alt]="bottomLeader.name"
                      decoding="async"
                      (error)="art.markFailed(bottomLeader.id)"
                      class="h-6 w-5 shrink-0 rounded-sm border border-gold/50 object-cover object-top"
                    />
                  } @else {
                    <span class="shrink-0">♛</span>
                  }
                  <span class="truncate font-bold">{{ bottomLeader.name }}</span>
                </div>
                <span class="shrink-0 text-[9px] font-extrabold uppercase">
                  {{
                    facade.bottomPlayer().leaderUsed
                      ? 'Usado'
                      : facade.canUseBottomLeader()
                        ? 'Activar'
                        : 'Pasivo'
                  }}
                </span>
              </button>
            }
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
          class="qwent-wood-surface flex h-full min-h-0 flex-col justify-between rounded-lg border border-bronze/70 p-1.5"
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
            <app-deck-back
              [faction]="facade.topPlayer().faction"
              [count]="facade.topPlayer().deck.length"
            />
          </div>

          <!-- Center Badge & Feedback Toggles -->
          <div class="flex flex-col items-center gap-1 text-center">
            <span
              class="inline-block rounded border border-bronze/60 bg-tavern-dark/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gold"
            >
              v1.7.0
            </span>
            <div class="grid grid-cols-2 gap-1">
              <button
                type="button"
                (click)="feedback.toggleSound()"
                [attr.aria-label]="feedback.soundEnabled() ? 'Silenciar efectos' : 'Activar efectos'"
                title="Efectos (SFX)"
                class="flex h-7 w-7 items-center justify-center rounded border text-xs transition active:scale-95"
                [class]="
                  feedback.soundEnabled()
                    ? 'border-gold/70 bg-tavern-dark/90 text-gold-bright'
                    : 'border-bronze/40 bg-tavern-dark/60 text-parchment/45'
                "
              >
                {{ feedback.soundEnabled() ? '♪' : '✕' }}
              </button>
              <button
                type="button"
                (click)="feedback.toggleMusic()"
                [attr.aria-label]="feedback.musicEnabled() ? 'Silenciar música' : 'Activar música'"
                title="Música de taberna"
                class="flex h-7 w-7 items-center justify-center rounded border text-xs transition active:scale-95"
                [class]="
                  feedback.musicEnabled()
                    ? 'border-gold/70 bg-tavern-dark/90 text-gold-bright'
                    : 'border-bronze/40 bg-tavern-dark/60 text-parchment/45'
                "
              >
                {{ feedback.musicEnabled() ? '♫' : '—' }}
              </button>
              <button
                type="button"
                (click)="feedback.nextTrack()"
                [disabled]="!feedback.musicEnabled()"
                aria-label="Cambiar pista musical"
                title="Siguiente tema"
                class="flex h-7 w-7 items-center justify-center rounded border border-bronze/50 bg-tavern-dark/90 text-[10px] text-parchment/90 transition hover:border-gold active:scale-95 disabled:opacity-40"
              >
                ⏭
              </button>
              <button
                type="button"
                (click)="feedback.toggleHaptics()"
                [attr.aria-label]="feedback.hapticsEnabled() ? 'Desactivar vibración' : 'Activar vibración'"
                title="Vibración"
                class="flex h-7 w-7 items-center justify-center rounded border text-xs transition active:scale-95"
                [class]="
                  feedback.hapticsEnabled()
                    ? 'border-gold/70 bg-tavern-dark/90 text-gold-bright'
                    : 'border-bronze/40 bg-tavern-dark/60 text-parchment/45'
                "
              >
                {{ feedback.hapticsEnabled() ? '≈' : '–' }}
              </button>
            </div>
            <button
              type="button"
              (click)="requestExitMatch()"
              aria-label="Salir de la partida"
              class="min-h-[28px] w-full rounded border border-strength-nerf/60 bg-tavern-dark/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-parchment/90 transition hover:border-strength-nerf hover:text-strength-nerf active:scale-95"
            >
              Salir
            </button>
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
            <app-deck-back
              [faction]="facade.bottomPlayer().faction"
              [count]="facade.bottomPlayer().deck.length"
            />

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

      <!-- Non-blocking TW3 Center Banners -->
      <app-board-banner [banner]="facade.activeBanner()" />

      <!-- Floating Brief Preview of AI's Last Card / Leader Play -->
      @if (facade.aiPlayPreview(); as preview) {
        @for (item of [preview]; track item.id) {
          <div
            class="qwent-ai-preview-enter pointer-events-none fixed left-[19%] top-3 z-30 flex w-52 items-center gap-2 overflow-hidden rounded-lg border-2 bg-board-wood/95 p-1.5 shadow-2xl backdrop-blur-sm"
            [class]="item.card.isHero ? 'border-gold-bright qwent-hero-frame' : 'border-bronze'"
          >
            <span
              class="relative flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-gold/50 bg-tavern-dark"
            >
              @if (art.hasSprite(item.card.id)) {
                <img
                  [src]="art.spritePath(item.card.id)"
                  [alt]="item.card.name"
                  decoding="async"
                  (error)="art.markFailed(item.card.id)"
                  class="h-full w-full object-cover object-top"
                />
              } @else {
                <span class="h-5 w-5" [class]="factionAccent(item.card.faction)">
                  <app-faction-emblem [faction]="item.card.faction" />
                </span>
              }
              <span
                class="qwent-num-shadow absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-bronze bg-tavern-dark/95 text-[9px] font-extrabold text-parchment"
              >
                {{
                  item.card.type === 'LEADER'
                    ? '♛'
                    : item.card.type === 'SPECIAL'
                      ? '★'
                      : item.card.baseStrength
                }}
              </span>
            </span>
            <div class="min-w-0 flex-1 text-left">
              <p class="text-[9px] font-bold uppercase tracking-wider text-gold">{{ item.label }}</p>
              <p class="truncate text-xs font-extrabold text-parchment">{{ item.card.name }}</p>
              <p class="line-clamp-1 text-[9px] text-parchment/75">
                {{ item.card.ability ?? item.card.leaderAbility ?? item.card.description }}
              </p>
            </div>
          </div>
        }
      }

      <!-- Non-blocking GPU Visual Effects Overlay -->
      @if (visualEffectClass(); as fxClass) {
        <div class="pointer-events-none fixed inset-0 z-20" [class]="fxClass"></div>
      }

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
            [playButtonLabel]="facade.inspectorConfirmLabel()"
            (closed)="facade.closeInspector()"
            (playRequested)="facade.playSelectedFromInspector($event)"
          />
        </div>
      }

      <!-- Overlays: 2P Turn Handoff, Mulligan, Medic/Leader Discard, Scoia'tael, Round/Match End -->
      <app-board-overlays
        [state]="facade.state()"
        [activePlayer]="facade.state().players[facade.state().activePlayer]"
        [turnHandoffPending]="facade.turnHandoffPending()"
        [isHumanTurn]="facade.isHumanTurn()"
        [discardPlayer]="facade.discardModalPlayer()"
        [medicChoices]="facade.medicDiscardChoices()"
        [leaderChoices]="facade.leaderTargetChoices()"
        (handoffConfirmed)="facade.confirmTurnHandoff()"
        (advanceRoundRequested)="facade.advanceRound()"
        (newMatchRequested)="facade.startNewMatch()"
        (menuRequested)="exitToMenu.emit()"
        (discardClosed)="facade.closeDiscardModal()"
        (cardInspected)="onInspectFromBoard($event)"
        (medicTargetSelected)="facade.selectMedicTarget($event)"
        (leaderTargetSelected)="facade.selectLeaderTarget($event)"
        (scoiataelStarterSelected)="facade.selectScoiataelStarter($event)"
        (mulliganSwapRequested)="facade.mulliganSwap($event)"
        (finishMulliganRequested)="facade.finishMulligan()"
      />
      <!-- Exit Match Confirmation Modal -->
      @if (exitConfirmOpen()) {
        <div
          (click)="cancelExitMatch()"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            (click)="$event.stopPropagation()"
            class="w-full max-w-sm rounded-xl border-2 border-bronze bg-board-wood p-5 text-center shadow-2xl"
          >
            <p class="text-[11px] font-bold uppercase tracking-widest text-gold">Abandonar duelo</p>
            <h3 class="mt-1 font-serif text-xl font-extrabold text-parchment">
              ¿Salir de la partida?
            </h3>
            <p class="mt-1.5 text-xs text-parchment/80">
              La partida actual se abandonará y volverás al menú principal.
            </p>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                (click)="cancelExitMatch()"
                class="min-h-[44px] rounded-lg border border-bronze bg-tavern-dark px-3 py-2 text-xs font-bold uppercase tracking-wider text-parchment transition hover:border-gold active:scale-95"
              >
                Seguir jugando
              </button>
              <button
                type="button"
                (click)="confirmExitMatch()"
                class="min-h-[44px] rounded-lg border-2 border-strength-nerf bg-strength-nerf/20 px-3 py-2 text-xs font-bold uppercase tracking-wider text-parchment transition hover:bg-strength-nerf/35 active:scale-95"
              >
                Salir al menú
              </button>
            </div>
          </div>
        </div>
      }
    </main>
  `,
})
export class BoardPageComponent {
  readonly facade = inject(GameFacadeService);
  readonly feedback = inject(FeedbackService);
  private readonly destroyRef = inject(DestroyRef);

  readonly exitToMenu = output<void>();
  readonly holdProgress = signal(0);
  readonly exitConfirmOpen = signal(false);
  readonly weatherSlots = WEATHER_BOX_SLOTS;
  readonly art = createSpriteFallbackTracker();
  readonly topIsLeading = computed(
    () => this.facade.topPlayer().totalScore > this.facade.bottomPlayer().totalScore,
  );
  readonly bottomIsLeading = computed(
    () => this.facade.bottomPlayer().totalScore > this.facade.topPlayer().totalScore,
  );
  readonly visualEffectClass = computed(() => {
    const fx = this.facade.visualEffect();
    return fx ? (VISUAL_FX_CLASS_MAP[fx] ?? null) : null;
  });
  private holdIntervalId: ReturnType<typeof setInterval> | null = null;
  private holdStartTimestamp = 0;

  readonly playableChecker = (instanceId: string): boolean => this.facade.canPlayFromHand(instanceId);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelHoldPass();
      this.facade.abandonMatch();
    });
  }

  onBackdropClick(): void {
    this.facade.clearSelection();
  }

  requestExitMatch(): void {
    this.feedback.play('tap');
    this.cancelHoldPass();
    this.exitConfirmOpen.set(true);
  }

  cancelExitMatch(): void {
    this.feedback.play('tap');
    this.exitConfirmOpen.set(false);
  }

  confirmExitMatch(): void {
    this.feedback.play('tap');
    this.exitConfirmOpen.set(false);
    this.cancelHoldPass();
    this.facade.abandonMatch();
    this.exitToMenu.emit();
  }

  factionAccent(faction: FactionId): string {
    return FACTION_META[faction].accentClass;
  }

  gemClass(player: PlayerState, gemIdx: number): string {
    if (gemIdx < player.gems) {
      return 'bg-gem-ruby shadow-[0_0_6px_rgba(220,38,38,0.85)]';
    }
    if (gemIdx === player.gems && this.facade.lostGemPlayers().includes(player.id)) {
      return 'qwent-gem-break bg-gem-ash';
    }
    return 'bg-gem-ash';
  }

  onOwnRowSelected(rowType: Parameters<GameFacadeService['onOwnRowTap']>[0]): void {
    this.facade.onOwnRowTap(rowType);
  }

  onInspectFromBoard(card: Parameters<GameFacadeService['inspectCard']>[0]): void {
    this.facade.inspectCard(card);
  }

  onWeatherSlotClick(
    event: Event,
    card: Parameters<GameFacadeService['inspectCard']>[0] | null,
  ): void {
    if (!card) return;
    event.stopPropagation();
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
