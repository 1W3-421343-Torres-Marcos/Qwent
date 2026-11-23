import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { CardInstance, RowType } from '../../../core';
import { FACTION_META } from '../constants/faction-meta';
import { AbilityIconComponent, RowIconComponent } from './card-icons.component';
import { FactionEmblemComponent } from './faction-emblem.component';

const ROW_LABEL: Readonly<Record<RowType, string>> = {
  CLOSE_COMBAT: 'Cuerpo a cuerpo',
  RANGED: 'Distancia',
  SIEGE: 'Asedio',
};

@Component({
  selector: 'app-card-detail',
  standalone: true,
  imports: [RowIconComponent, AbilityIconComponent, FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="qwent-wood-surface fixed right-3 top-1/2 z-40 w-60 -translate-y-1/2 rounded-xl border-2 border-bronze p-3 text-parchment shadow-2xl backdrop-blur-sm"
      [class.border-gold-bright]="card().card.isHero"
      [class.qwent-hero-frame]="card().card.isHero"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <span
            class="qwent-num-shadow flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base font-extrabold"
            [class]="strengthBadgeClass()"
          >
            {{
              card().card.type === 'LEADER'
                ? '♛'
                : card().card.type === 'SPECIAL'
                  ? '★'
                  : card().effectiveStrength
            }}
          </span>
          <div>
            <h3 class="text-sm font-bold leading-tight text-parchment">{{ card().card.name }}</h3>
            <p class="text-[11px] text-parchment/70">
              {{ factionName() }}
              @if (card().card.isHero) {
                · <span class="font-semibold text-gold-bright">Héroe</span>
              }
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="closed.emit()"
          aria-label="Cerrar inspector"
          class="flex h-11 w-11 -mr-2 -mt-2 shrink-0 items-center justify-center rounded-lg text-parchment/80 hover:bg-row-leather hover:text-gold"
        >
          ✕
        </button>
      </div>

      <!-- Offline SVG emblem graphic slot ready for future local sprites -->
      <div
        class="mt-2 flex h-16 items-center justify-between gap-2 rounded-lg border border-bronze/60 bg-tavern-dark/85 px-3"
      >
        <span class="h-9 w-9 shrink-0 opacity-85" [class]="factionAccentClass()">
          <app-faction-emblem [faction]="card().card.faction" />
        </span>
        <div class="flex flex-wrap items-center justify-end gap-2">
          @for (row of card().card.allowedRows; track row) {
            <div class="flex items-center gap-1 text-xs text-parchment/85">
              <span class="h-4 w-4 text-gold"><app-row-icon [row]="row" /></span>
              <span>{{ rowLabel(row) }}</span>
            </div>
          } @empty {
            <span class="text-xs text-parchment/75">
              {{ card().card.type === 'LEADER' ? 'Carta de Líder' : 'Carta especial global' }}
            </span>
          }
        </div>
      </div>

      @if (card().card.type === 'LEADER' && card().card.leaderAbility; as leaderAbility) {
        <div class="mt-2 text-xs font-semibold text-gold-bright">
          Líder · {{ leaderAbility }}
        </div>
      } @else {
        @if (card().card.ability; as ability) {
          <div class="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gold-bright">
            <span class="h-4 w-4"><app-ability-icon [ability]="ability" /></span>
            <span>{{ ability }}</span>
          </div>
        }
      }

      <p class="mt-1.5 text-xs leading-relaxed text-parchment/90">
        {{ card().card.description }}
      </p>

      @if (card().card.type === 'UNIT' && card().effectiveStrength !== card().card.baseStrength) {
        <p class="mt-1.5 text-[11px] text-parchment/65">
          Fuerza base: <span class="font-semibold text-parchment">{{ card().card.baseStrength }}</span>
        </p>
      }

      @if (canConfirmPlay()) {
        <button
          type="button"
          (click)="playRequested.emit(card())"
          class="mt-3 min-h-[44px] w-full rounded-lg border border-gold-bright bg-gold/25 px-3 py-2 text-xs font-bold uppercase tracking-wider text-gold-bright transition active:scale-95"
        >
          {{ playButtonLabel() }}
        </button>
      }
    </aside>
  `,
})
export class CardDetailComponent {
  readonly card = input.required<CardInstance>();
  readonly canConfirmPlay = input(false);
  readonly playButtonLabel = input('Jugar carta');
  readonly closed = output<void>();
  readonly playRequested = output<CardInstance>();

  readonly factionName = computed(() => FACTION_META[this.card().card.faction].label);
  readonly factionAccentClass = computed(() => FACTION_META[this.card().card.faction].accentClass);

  readonly strengthBadgeClass = computed(() => {
    const c = this.card();
    if (c.card.isHero) return 'border-gold-bright bg-tavern-dark text-gold-bright';
    if (c.effectiveStrength > c.card.baseStrength) {
      return 'border-strength-buff bg-tavern-dark text-strength-buff';
    }
    if (c.effectiveStrength < c.card.baseStrength) {
      return 'border-strength-nerf bg-tavern-dark text-strength-nerf';
    }
    return 'border-bronze bg-tavern-dark text-strength-normal';
  });

  rowLabel(row: RowType): string {
    return ROW_LABEL[row];
  }
}
