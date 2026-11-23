import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { CardInstance } from '../../../core';
import { AbilityIconComponent } from './card-icons.component';

const FACTION_BORDER_MAP: Readonly<Record<string, string>> = {
  NORTHERN_REALMS: 'border-blue-400/70 bg-northern/35',
  NILFGAARD: 'border-yellow-500/70 bg-nilfgaard/90',
  MONSTERS: 'border-red-400/70 bg-monsters/35',
  SCOIATAEL: 'border-green-400/70 bg-scoiatael/35',
  NEUTRAL: 'border-stone-400/70 bg-neutral/40',
};

@Component({
  selector: 'app-card-token',
  standalone: true,
  imports: [AbilityIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="cardClicked.emit(card())"
      [title]="card().card.name"
      class="relative flex h-full aspect-[3/4] shrink-0 flex-col justify-between rounded border p-0.5 transition active:scale-95"
      [class]="containerClasses()"
    >
      <!-- Top-left strength badge -->
      <span
        class="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full text-[10px] sm:text-xs font-extrabold leading-none shadow"
        [class]="badgeClasses()"
      >
        {{ card().effectiveStrength }}
      </span>

      <!-- Minimal inner name strip -->
      <span class="line-clamp-1 px-0.5 text-center text-[8px] leading-tight text-parchment/85">
        {{ card().card.name }}
      </span>

      <!-- Bottom-right: ONLY ability icon if present (never row icon on board tokens) -->
      <div class="flex h-3.5 justify-end">
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
  readonly cardClicked = output<CardInstance>();

  readonly containerClasses = computed(() => {
    if (this.isSelectableTarget()) {
      return 'border-2 border-gold-bright ring-2 ring-gold-bright animate-pulse bg-gold/20 shadow-lg shadow-gold/30 cursor-pointer';
    }
    const def = this.card().card;
    if (def.isHero) {
      return 'border-2 border-gold-bright ring-1 ring-gold bg-tavern-dark shadow-md shadow-gold/25';
    }
    return FACTION_BORDER_MAP[def.faction] ?? 'border-bronze bg-row-leather';
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
