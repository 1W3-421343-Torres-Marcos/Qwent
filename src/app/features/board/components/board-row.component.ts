import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { CardInstance, RowState, RowType } from '../../../../core';
import { AbilityIconComponent, RowIconComponent } from '../../../shared/components/card-icons.component';
import { CardTokenComponent } from '../../../shared/components/card-token.component';
import { createSpriteFallbackTracker } from '../../../shared/constants/card-art';

const ROW_WEATHER_CLASSES: Readonly<Record<RowType, string>> = {
  CLOSE_COMBAT: 'bg-weather-frost/15 ring-1 ring-inset ring-weather-frost/50',
  RANGED: 'bg-weather-fog/15 ring-1 ring-inset ring-weather-fog/50',
  SIEGE: 'bg-weather-rain/15 ring-1 ring-inset ring-weather-rain/50',
};

@Component({
  selector: 'app-board-row',
  standalone: true,
  imports: [RowIconComponent, AbilityIconComponent, CardTokenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      (click)="onRowContainerClick()"
      class="relative flex h-full min-h-0 items-center gap-1.5 rounded border px-1.5 py-0.5 transition"
      [class]="rowContainerClasses()"
    >
      @if (weatherActive()) {
        <span
          class="pointer-events-none absolute inset-0 overflow-hidden rounded"
          [class]="weatherOverlayClass()"
        ></span>
      }
      <!-- 1. Left: Row Total Badge -->
      <div
        class="qwent-num-shadow flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border border-bronze bg-tavern-dark/95 font-serif text-[clamp(0.95rem,3.2vh,1.4rem)] font-extrabold text-parchment shadow"
      >
        {{ row().totalStrength }}
      </div>

      <!-- 2. Square Commander's Horn Slot -->
      <button
        type="button"
        (click)="onHornSlotClick($event)"
        [disabled]="!isSelectable() && !row().hornCard"
        aria-label="Ranura de Cuerno del Comandante"
        class="relative flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center overflow-hidden rounded border transition"
        [class]="hornSlotClasses()"
      >
        @if (row().hornCard) {
          @if (art.hasSprite('sp_commanders_horn')) {
            <img
              [src]="art.spritePath('sp_commanders_horn')"
              alt="Cuerno del Comandante"
              decoding="async"
              (error)="art.markFailed('sp_commanders_horn')"
              class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
            />
            <span
              class="relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-tavern-dark/80 p-0.5 text-gold-bright shadow"
            >
              <app-ability-icon ability="COMMANDERS_HORN" />
            </span>
          } @else {
            <span class="h-5 w-5 text-gold-bright">
              <app-ability-icon ability="COMMANDERS_HORN" />
            </span>
          }
        } @else {
          <span class="h-4 w-4 text-bronze/60">
            <app-ability-icon ability="COMMANDERS_HORN" />
          </span>
        }
      </button>

      <!-- 3. Horizontal Card Lane with Row Icon Watermark -->
      <div class="relative flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden py-0.5">
        <span
          class="pointer-events-none absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 text-parchment/10"
        >
          <app-row-icon [row]="rowType()" />
        </span>

        @for (card of row().cards; track card.instanceId) {
          <app-card-token
            class="h-full shrink-0"
            [card]="card"
            [isSelectableTarget]="isCardDecoyTarget(card)"
            (cardClicked)="onTokenClicked($event)"
            (click)="$event.stopPropagation()"
          />
        }
      </div>
    </div>
  `,
})
export class BoardRowComponent {
  readonly rowType = input.required<RowType>();
  readonly row = input.required<RowState>();
  readonly weatherActive = input(false);
  readonly isSelectable = input(false);
  readonly highlightHornSlot = input(false);
  readonly decoySelecting = input(false);

  readonly rowSelected = output<RowType>();
  readonly unitTargeted = output<CardInstance>();
  readonly cardInspected = output<CardInstance>();

  readonly art = createSpriteFallbackTracker();

  readonly rowContainerClasses = computed(() => {
    const base = this.weatherActive()
      ? ROW_WEATHER_CLASSES[this.rowType()]
      : 'qwent-leather-row border-bronze/50';

    if (this.isSelectable()) {
      return `${base} cursor-pointer border-gold-bright ring-2 ring-gold-bright/70 bg-gold/10`;
    }
    return `${base} border-bronze/50`;
  });

  readonly hornSlotClasses = computed(() => {
    if (this.row().hornCard !== null) {
      return 'border-gold-bright bg-gold/20 shadow-inner';
    }
    if (this.isSelectable() && this.highlightHornSlot()) {
      return 'border-gold-bright bg-gold/25 ring-2 ring-gold-bright animate-pulse';
    }
    return 'border-bronze/50 bg-tavern-dark/60';
  });

  weatherOverlayClass(): string {
    if (this.rowType() === 'CLOSE_COMBAT') return 'qwent-row-frost';
    if (this.rowType() === 'RANGED') return 'qwent-row-fog';
    return 'qwent-row-rain';
  }

  onRowContainerClick(): void {
    if (this.isSelectable()) {
      this.rowSelected.emit(this.rowType());
    }
  }

  onHornSlotClick(event: Event): void {
    event.stopPropagation();
    if (!this.isSelectable()) {
      const horn = this.row().hornCard;
      if (horn) {
        this.cardInspected.emit(horn);
      }
      return;
    }
    this.rowSelected.emit(this.rowType());
  }

  isCardDecoyTarget(card: CardInstance): boolean {
    return this.decoySelecting() && !card.card.isHero && card.card.ability !== 'DECOY';
  }

  onTokenClicked(card: CardInstance): void {
    if (this.isCardDecoyTarget(card)) {
      this.unitTargeted.emit(card);
      return;
    }
    if (this.isSelectable()) {
      this.rowSelected.emit(this.rowType());
      return;
    }
    this.cardInspected.emit(card);
  }
}
