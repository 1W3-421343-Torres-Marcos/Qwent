import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { CardInstance } from '../../../../core';
import { AbilityIconComponent, RowIconComponent } from '../../../shared/components/card-icons.component';

@Component({
  selector: 'app-hand-bar',
  standalone: true,
  imports: [RowIconComponent, AbilityIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex h-full w-full items-center justify-center gap-1 overflow-x-auto overflow-y-hidden rounded border border-bronze/60 bg-tavern-dark/90 px-2 py-1"
    >
      @for (card of hand(); track card.instanceId) {
        <button
          type="button"
          (click)="cardTapped.emit(card)"
          [class.ring-2]="selectedInstanceId() === card.instanceId"
          [class.ring-gold-bright]="selectedInstanceId() === card.instanceId"
          [class.-translate-y-1]="selectedInstanceId() === card.instanceId"
          [class.opacity-45]="!isPlayableFn()(card.instanceId)"
          [class.border-gold-bright]="card.card.isHero"
          [class.border-bronze]="!card.card.isHero"
          class="relative flex h-full aspect-[3/4] shrink-0 flex-col justify-between rounded border bg-board-wood p-1 text-left transition active:scale-95"
        >
          <!-- Strength & Row Icon -->
          <div class="flex items-start justify-between gap-0.5">
            <span
              class="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border text-[10px] sm:text-xs font-extrabold leading-none"
              [class.border-gold-bright]="card.card.isHero"
              [class.text-gold-bright]="card.card.isHero"
              [class.border-bronze]="!card.card.isHero"
              [class.text-strength-normal]="!card.card.isHero"
            >
              {{ card.card.type === 'SPECIAL' ? '★' : card.card.baseStrength }}
            </span>

            @if (card.card.allowedRows.length > 0 && card.card.type === 'UNIT') {
              <span class="h-3.5 w-3.5 text-parchment/85">
                <app-row-icon [row]="card.card.allowedRows.length > 1 ? 'AGILE' : card.card.allowedRows[0]!" />
              </span>
            }
          </div>

          <span class="line-clamp-2 text-center text-[8px] sm:text-[9px] font-medium leading-tight text-parchment">
            {{ card.card.name }}
          </span>

          <div class="flex h-3.5 items-center justify-end">
            @if (card.card.ability; as ability) {
              <span class="h-3.5 w-3.5 text-gold-bright">
                <app-ability-icon [ability]="ability" />
              </span>
            }
          </div>
        </button>
      } @empty {
        <p class="text-xs text-parchment/60">Sin cartas en mano</p>
      }
    </div>
  `,
})
export class HandBarComponent {
  readonly hand = input.required<readonly CardInstance[]>();
  readonly selectedInstanceId = input<string | null>(null);
  readonly isPlayableFn = input.required<(instanceId: string) => boolean>();
  readonly cardTapped = output<CardInstance>();
}
