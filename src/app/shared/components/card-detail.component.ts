import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { CardInstance, RowType } from '../../../core';
import { getCardSpritePath } from '../constants/card-art';
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
      class="qwent-wood-surface fixed right-3 top-1/2 z-[55] w-60 -translate-y-1/2 rounded-xl border-2 border-bronze p-3 text-parchment shadow-2xl backdrop-blur-sm"
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

      <!-- Local TW3 portrait showcase with offline SVG faction emblem fallback -->
      <div
        class="relative mt-2 flex h-36 items-end overflow-hidden rounded-lg border border-bronze/60 bg-tavern-dark/85"
      >
        @if (hasSprite()) {
          <img
            [src]="spriteUrl()"
            [alt]="card().card.name"
            decoding="async"
            (error)="markSpriteFailed(spriteUrl())"
            class="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
          />
          <span
            class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent"
          ></span>
        } @else {
          <span
            class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-35"
            [class]="factionAccentClass()"
          >
            <span class="h-16 w-16"><app-faction-emblem [faction]="card().card.faction" /></span>
          </span>
        }

        <div class="relative z-10 flex w-full flex-wrap items-center justify-between gap-2 px-2.5 py-2">
          <span class="h-5 w-5 shrink-0 opacity-90" [class]="factionAccentClass()">
            <app-faction-emblem [faction]="card().card.faction" />
          </span>
          <div class="flex flex-wrap items-center justify-end gap-2">
            @for (row of card().card.allowedRows; track row) {
              <div class="flex items-center gap-1 rounded bg-tavern-dark/80 px-1.5 py-0.5 text-[11px] font-medium text-parchment">
                <span class="h-3.5 w-3.5 text-gold"><app-row-icon [row]="row" /></span>
                <span>{{ rowLabel(row) }}</span>
              </div>
            } @empty {
              <span class="rounded bg-tavern-dark/80 px-1.5 py-0.5 text-[11px] text-parchment/90">
                {{ card().card.type === 'LEADER' ? 'Carta de Líder' : 'Carta especial global' }}
              </span>
            }
          </div>
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

  readonly failedSpriteUrl = signal<string | null>(null);
  readonly spriteUrl = computed(() =>
    getCardSpritePath(this.card().card.id, this.card().instanceId),
  );
  readonly hasSprite = computed(() => this.failedSpriteUrl() !== this.spriteUrl());

  readonly factionName = computed(() => FACTION_META[this.card().card.faction].label);
  readonly factionAccentClass = computed(() => FACTION_META[this.card().card.faction].accentClass);

  markSpriteFailed(url: string): void {
    this.failedSpriteUrl.set(url);
  }

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
