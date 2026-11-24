import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FactionId } from '../../../core';
import { FACTION_META } from '../constants/faction-meta';
import { FactionEmblemComponent } from './faction-emblem.component';

const DECK_BACK_STYLES: Readonly<Record<FactionId, string>> = {
  NORTHERN_REALMS: 'border-blue-400/75 bg-gradient-to-b from-blue-950 via-slate-900 to-tavern-dark',
  NILFGAARD: 'border-yellow-500/80 bg-gradient-to-b from-zinc-900 via-neutral-950 to-black',
  MONSTERS: 'border-red-500/75 bg-gradient-to-b from-red-950 via-stone-950 to-tavern-dark',
  SCOIATAEL: 'border-emerald-500/75 bg-gradient-to-b from-emerald-950 via-stone-900 to-tavern-dark',
  SKELLIGE: 'border-purple-400/75 bg-gradient-to-b from-purple-950 via-stone-950 to-tavern-dark',
  NEUTRAL: 'border-bronze/75 bg-gradient-to-b from-board-wood to-tavern-dark',
};

@Component({
  selector: 'app-deck-back',
  standalone: true,
  imports: [FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative flex h-11 flex-col items-center justify-between overflow-hidden rounded border px-1 py-0.5 shadow"
      [class]="containerClass()"
      [attr.aria-label]="'Mazo ' + label() + ': ' + count() + ' cartas'"
    >
      <!-- Subtle TW3 inner filigree border -->
      <span class="pointer-events-none absolute inset-[2px] rounded-sm border border-gold/25"></span>

      <!-- Centered faction emblem watermark -->
      <span
        class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30"
        [class]="accentClass()"
      >
        <span class="h-6 w-6"><app-faction-emblem [faction]="faction()" /></span>
      </span>

      <span class="relative z-10 text-[8px] font-bold uppercase tracking-wider text-parchment/80">
        Mazo
      </span>
      <span
        class="qwent-num-shadow relative z-10 rounded bg-black/70 px-1.5 text-[11px] font-extrabold leading-tight text-gold-bright"
      >
        {{ count() }}
      </span>
    </div>
  `,
})
export class DeckBackComponent {
  readonly faction = input.required<FactionId>();
  readonly count = input.required<number>();

  readonly label = computed(() => FACTION_META[this.faction()].shortLabel);
  readonly accentClass = computed(() => FACTION_META[this.faction()].accentClass);
  readonly containerClass = computed(() => {
    const base = DECK_BACK_STYLES[this.faction()];
    return this.count() === 0 ? `${base} opacity-45 border-dashed` : base;
  });
}
