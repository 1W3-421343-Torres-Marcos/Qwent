import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { CardInstance } from '../../../../core';
import { AbilityIconComponent, RowIconComponent } from '../../../shared/components/card-icons.component';
import { FactionEmblemComponent } from '../../../shared/components/faction-emblem.component';
import { createSpriteFallbackTracker } from '../../../shared/constants/card-art';
import { FACTION_META } from '../../../shared/constants/faction-meta';

@Component({
  selector: 'app-hand-bar',
  standalone: true,
  imports: [RowIconComponent, AbilityIconComponent, FactionEmblemComponent],
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
          [class.qwent-hero-frame]="card.card.isHero"
          [class.border-bronze]="!card.card.isHero"
          class="relative flex h-full aspect-[3/4] shrink-0 flex-col justify-between overflow-hidden rounded border p-1 text-left transition active:scale-95"
          [class]="cardSurfaceClass(card)"
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
              class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20"
            ></span>
          } @else {
            <span
              class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15"
              [class]="factionAccent(card)"
            >
              <span class="h-7 w-7"><app-faction-emblem [faction]="card.card.faction" /></span>
            </span>
          }

          <!-- Strength & Row Icon -->
          <div class="relative z-10 flex items-start justify-between gap-0.5">
            <span
              class="qwent-num-shadow flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border bg-tavern-dark/90 text-[10px] sm:text-xs font-extrabold leading-none"
              [class.border-gold-bright]="card.card.isHero"
              [class.text-gold-bright]="card.card.isHero"
              [class.border-bronze]="!card.card.isHero"
              [class.text-strength-normal]="!card.card.isHero"
            >
              {{ card.card.type === 'SPECIAL' ? '★' : card.card.baseStrength }}
            </span>

            @if (card.card.allowedRows.length > 0 && card.card.type === 'UNIT') {
              <span class="flex h-4 w-4 items-center justify-center rounded-full bg-tavern-dark/80 p-0.5 text-parchment/95">
                <app-row-icon [row]="card.card.allowedRows.length > 1 ? 'AGILE' : card.card.allowedRows[0]!" />
              </span>
            }
          </div>

          <span class="qwent-num-shadow relative z-10 line-clamp-2 text-center text-[8px] sm:text-[9px] font-semibold leading-tight text-parchment">
            {{ card.card.name }}
          </span>

          <div class="relative z-10 flex h-3.5 items-center justify-end">
            @if (card.card.ability; as ability) {
              <span class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-tavern-dark/90 p-0.5 text-gold-bright">
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

  readonly art = createSpriteFallbackTracker();

  cardSurfaceClass(card: CardInstance): string {
    return card.card.isHero ? 'bg-tavern-dark' : FACTION_META[card.card.faction].surfaceClass;
  }

  factionAccent(card: CardInstance): string {
    return FACTION_META[card.card.faction].accentClass;
  }
}
