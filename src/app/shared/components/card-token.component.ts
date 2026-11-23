import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { CardInstance } from '../../../core';
import { FACTION_META } from '../constants/faction-meta';
import { AbilityIconComponent } from './card-icons.component';
import { FactionEmblemComponent } from './faction-emblem.component';

@Component({
  selector: 'app-card-token',
  standalone: true,
  imports: [AbilityIconComponent, FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="cardClicked.emit(card())"
      [title]="card().card.name"
      class="qwent-card-enter relative flex h-full aspect-[3/4] shrink-0 flex-col justify-between overflow-hidden rounded border p-0.5 transition active:scale-95"
      [class]="containerClasses()"
    >
      <!-- Optional local sprite with transparent SVG faction emblem fallback -->
      @if (spritePath(); as sprite) {
        @if (!spriteFailed()) {
          <img
            [src]="sprite"
            [alt]="card().card.name"
            (error)="spriteFailed.set(true)"
            class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
          />
        }
      }
      @if (!spritePath() || spriteFailed()) {
        <span
          class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-15"
          [class]="emblemAccentClass()"
        >
          <span class="h-7 w-7"><app-faction-emblem [faction]="card().card.faction" /></span>
        </span>
      }

      <!-- Top-left strength badge -->
      <span
        class="qwent-num-shadow relative z-10 flex h-5 w-5 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[clamp(0.75rem,2.5vh,1.05rem)] font-extrabold leading-none shadow"
        [class]="badgeClasses()"
      >
        {{ card().effectiveStrength }}
      </span>

      <!-- Minimal inner name strip -->
      <span class="relative z-10 line-clamp-1 px-0.5 text-center text-[8px] font-medium leading-tight text-parchment/90">
        {{ card().card.name }}
      </span>

      <!-- Bottom-right: ONLY ability icon if present (never row icon on board tokens) -->
      <div class="relative z-10 flex h-3.5 justify-end">
        @if (card().card.ability; as ability) {
          <span
            class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-tavern-dark/90 p-0.5 text-gold-bright"
          >
            <app-ability-icon [ability]="ability" />
          </span>
        }
      </div>
    </button>
  `,
})
export class CardTokenComponent {
  readonly card = input.required<CardInstance>();
  readonly isSelectableTarget = input(false);
  readonly spritePath = input<string | null>(null);
  readonly cardClicked = output<CardInstance>();

  readonly spriteFailed = signal(false);

  readonly emblemAccentClass = computed(() => FACTION_META[this.card().card.faction].accentClass);

  readonly containerClasses = computed(() => {
    if (this.isSelectableTarget()) {
      return 'border-2 border-gold-bright ring-2 ring-gold-bright animate-pulse bg-gold/20 shadow-lg shadow-gold/30 cursor-pointer';
    }
    const def = this.card().card;
    if (def.isHero) {
      return 'qwent-hero-frame border-2 border-gold-bright ring-1 ring-gold bg-tavern-dark';
    }
    const meta = FACTION_META[def.faction];
    return `${meta.borderClass} ${meta.surfaceClass}`;
  });

  readonly badgeClasses = computed(() => {
    const instance = this.card();
    const { isHero, baseStrength } = instance.card;
    if (isHero) {
      return 'bg-tavern-dark text-gold-bright ring-1 ring-gold-bright';
    }
    if (instance.effectiveStrength > baseStrength) {
      return 'bg-tavern-dark/95 text-strength-buff ring-1 ring-strength-buff/60';
    }
    if (instance.effectiveStrength < baseStrength) {
      return 'bg-tavern-dark/95 text-strength-nerf ring-1 ring-strength-nerf/60';
    }
    return 'bg-tavern-dark/95 text-strength-normal ring-1 ring-bronze';
  });
}
