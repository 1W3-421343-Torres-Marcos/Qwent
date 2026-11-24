import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import {
  PLAYABLE_FACTIONS,
  validateDeck,
  type CardDefinition,
  type FactionId,
  type PlayableFactionId,
} from '../../../core';
import { DeckStorageService } from '../../services/deck-storage.service';
import { FeedbackService } from '../../services/feedback.service';
import { AbilityIconComponent, RowIconComponent } from '../../shared/components/card-icons.component';
import { FactionEmblemComponent } from '../../shared/components/faction-emblem.component';
import { createSpriteFallbackTracker } from '../../shared/constants/card-art';
import { FACTION_META } from '../../shared/constants/faction-meta';

type CollectionFilter = 'ALL' | 'CLOSE_COMBAT' | 'RANGED' | 'SIEGE' | 'SPECIAL';

interface DeckGroupEntry {
  readonly card: CardDefinition;
  readonly count: number;
}

const FILTER_OPTIONS: ReadonlyArray<{ readonly id: CollectionFilter; readonly label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'CLOSE_COMBAT', label: 'Cuerpo' },
  { id: 'RANGED', label: 'Distancia' },
  { id: 'SIEGE', label: 'Asedio' },
  { id: 'SPECIAL', label: 'Especiales' },
];

@Component({
  selector: 'app-deck-builder-page',
  standalone: true,
  imports: [AbilityIconComponent, RowIconComponent, FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="flex h-dvh w-screen flex-col overflow-hidden bg-tavern-dark text-parchment p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
    >
      <!-- Top Bar: Factions + Actions -->
      <header class="qwent-wood-surface flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-bronze/70 px-3 py-1.5">
        <div class="flex items-center gap-1.5 overflow-x-auto">
          @for (faction of factions; track faction) {
            <button
              type="button"
              (click)="selectFaction(faction)"
              class="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold uppercase tracking-wide transition active:scale-95"
              [class]="
                activeFaction() === faction
                  ? 'border-gold-bright bg-gold/25 text-gold-bright'
                  : 'border-bronze/60 bg-tavern-dark/80 text-parchment/80 hover:border-gold/70'
              "
            >
              <span class="h-3.5 w-3.5" [class]="factionAccent(faction)">
                <app-faction-emblem [faction]="faction" />
              </span>
              <span>{{ factionLabel(faction) }}</span>
            </button>
          }
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            (click)="resetStarter()"
            class="min-h-[38px] rounded-lg border border-bronze/70 bg-tavern-dark px-2.5 py-1 text-[11px] font-bold uppercase text-parchment/85 hover:border-gold active:scale-95"
          >
            Restaurar
          </button>
          <button
            type="button"
            (click)="saveCurrentDeck()"
            [disabled]="!validation().valid"
            class="min-h-[38px] rounded-lg border-2 border-gold-bright bg-gold/25 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gold-bright transition active:scale-95 disabled:opacity-40"
          >
            {{ saveMessage() || 'Guardar Mazo' }}
          </button>
          <button
            type="button"
            (click)="closed.emit()"
            class="min-h-[38px] rounded-lg border border-bronze bg-row-leather px-3 py-1 text-[11px] font-bold uppercase text-parchment hover:border-gold active:scale-95"
          >
            Volver
          </button>
        </div>
      </header>

      <!-- Leader Selector & Live Validation Bar -->
      <section class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-bronze/50 bg-tavern-dark/95 px-3 py-1.5 text-xs">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          @if (selectedLeader(); as leader) {
            <span
              class="relative flex h-10 w-[30px] shrink-0 items-center justify-center overflow-hidden rounded border border-gold/60 bg-tavern-dark"
            >
              @if (art.hasSprite(leader.id)) {
                <img
                  [src]="art.spritePath(leader.id)"
                  [alt]="leader.name"
                  decoding="async"
                  (error)="art.markFailed(leader.id)"
                  class="h-full w-full object-cover object-top"
                />
              } @else {
                <span class="h-4 w-4 text-gold"><app-faction-emblem [faction]="leader.faction" /></span>
              }
            </span>
          }
          <label for="leader-select" class="shrink-0 font-bold uppercase tracking-wider text-gold">
            ♛ Líder:
          </label>
          <select
            id="leader-select"
            [value]="draftLeaderId()"
            (change)="onLeaderSelect($event)"
            class="min-h-[36px] max-w-[230px] rounded border border-bronze bg-board-wood px-2 py-1 text-xs font-semibold text-parchment focus:border-gold-bright focus:outline-none"
          >
            @for (leader of factionLeaders(); track leader.id) {
              <option [value]="leader.id">{{ leader.name }}</option>
            }
          </select>
          @if (selectedLeader(); as leader) {
            <span class="hidden truncate text-[11px] text-parchment/75 lg:inline">
              {{ leader.description }}
            </span>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span
            class="rounded border px-2 py-0.5"
            [class]="
              validation().unitCount >= 22
                ? 'border-strength-buff/70 bg-strength-buff/15 text-strength-buff'
                : 'border-strength-nerf bg-strength-nerf/20 text-strength-nerf'
            "
          >
            Unidades: {{ validation().unitCount }}/22+
          </span>
          <span
            class="rounded border px-2 py-0.5"
            [class]="
              validation().specialCount <= 10
                ? 'border-gold/60 bg-board-wood text-parchment'
                : 'border-strength-nerf bg-strength-nerf/20 text-strength-nerf'
            "
          >
            Especiales: {{ validation().specialCount }}/10
          </span>
          <span class="rounded border border-bronze/60 bg-board-wood px-2 py-0.5 text-gold-bright">
            Héroes: {{ validation().heroCount }}
          </span>
          <span class="rounded border border-bronze/60 bg-board-wood px-2 py-0.5 text-parchment">
            Fuerza: {{ validation().totalStrength }}
          </span>
        </div>
      </section>

      <!-- 2-Column Split: Collection (Left) vs Current Deck (Right) -->
      <section class="grid min-h-0 flex-1 grid-cols-2 gap-2 p-2">
        <!-- Available Collection -->
        <div class="flex min-h-0 flex-col rounded-lg border border-bronze/70 bg-board-wood p-2">
          <div class="flex flex-wrap items-center justify-between gap-1 border-b border-bronze/50 pb-1.5">
            <h2 class="text-xs font-extrabold uppercase tracking-wider text-gold">
              Colección disponible (toca para agregar)
            </h2>
            <div class="flex flex-wrap gap-1">
              @for (filter of filters; track filter.id) {
                <button
                  type="button"
                  (click)="activeFilter.set(filter.id)"
                  class="min-h-[30px] rounded border px-2 py-0.5 text-[10px] font-bold uppercase transition"
                  [class]="
                    activeFilter() === filter.id
                      ? 'border-gold-bright bg-gold/25 text-gold-bright'
                      : 'border-bronze/50 bg-tavern-dark/70 text-parchment/75 hover:border-gold'
                  "
                >
                  {{ filter.label }}
                </button>
              }
            </div>
          </div>

          <div class="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            @for (card of filteredCollection(); track card.id) {
              @let inDeck = copyCountMap().get(card.id) ?? 0;
              <button
                type="button"
                (click)="addCard(card)"
                [disabled]="inDeck >= card.maxCopies"
                class="flex min-h-[46px] w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition active:scale-[0.99] disabled:opacity-45"
                [class]="
                  card.isHero
                    ? 'border-gold-bright/70 bg-tavern-dark/90 hover:border-gold-bright'
                    : 'border-bronze/60 bg-tavern-dark/80 hover:border-gold'
                "
              >
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class="relative flex h-10 w-[30px] shrink-0 items-center justify-center overflow-hidden rounded border bg-tavern-dark"
                    [class]="card.isHero ? 'border-gold-bright/80' : 'border-bronze/60'"
                  >
                    @if (art.hasSprite(card.id)) {
                      <img
                        [src]="art.spritePath(card.id)"
                        [alt]="card.name"
                        loading="lazy"
                        decoding="async"
                        (error)="art.markFailed(card.id)"
                        class="h-full w-full object-cover object-top"
                      />
                    } @else {
                      <span class="h-4 w-4" [class]="factionAccent(card.faction)">
                        <app-faction-emblem [faction]="card.faction" />
                      </span>
                    }
                  </span>
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold"
                    [class]="
                      card.isHero
                        ? 'border-gold-bright text-gold-bright'
                        : 'border-bronze text-strength-normal'
                    "
                  >
                    {{ card.type === 'SPECIAL' ? '★' : card.baseStrength }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-parchment">{{ card.name }}</p>
                    <div class="flex items-center gap-1.5 text-[10px] text-parchment/65">
                      @if (card.type === 'UNIT' && card.allowedRows.length > 0) {
                        <span class="h-3.5 w-3.5 text-parchment/80">
                          <app-row-icon [row]="card.allowedRows.length > 1 ? 'AGILE' : card.allowedRows[0]!" />
                        </span>
                      }
                      @if (card.ability; as ability) {
                        <span class="h-3.5 w-3.5 text-gold-bright">
                          <app-ability-icon [ability]="ability" />
                        </span>
                      }
                      <span class="truncate">{{ card.faction === 'NEUTRAL' ? 'Neutral' : factionLabel(activeFaction()) }}</span>
                    </div>
                  </div>
                </div>

                <span class="shrink-0 rounded border border-bronze/60 bg-row-leather px-2 py-0.5 text-[11px] font-extrabold text-gold">
                  {{ inDeck }}/{{ card.maxCopies }}
                </span>
              </button>
            }
          </div>
        </div>

        <!-- Current Deck -->
        <div class="flex min-h-0 flex-col rounded-lg border border-bronze/70 bg-board-wood p-2">
          <div class="flex items-center justify-between border-b border-bronze/50 pb-1.5">
            <h2 class="text-xs font-extrabold uppercase tracking-wider text-gold">
              Mazo actual · {{ validation().totalCards }} cartas (toca para quitar)
            </h2>
            <span
              class="rounded px-2 py-0.5 text-[10px] font-extrabold uppercase"
              [class]="
                validation().valid
                  ? 'bg-strength-buff/20 text-strength-buff'
                  : 'bg-strength-nerf/20 text-strength-nerf'
              "
            >
              {{ validation().valid ? 'Válido' : 'Incompleto' }}
            </span>
          </div>

          @if (!validation().valid && validation().errors.length > 0) {
            <div class="mt-1.5 rounded border border-strength-nerf/70 bg-strength-nerf/15 px-2 py-1 text-[11px] text-parchment">
              {{ validation().errors[0].message }}
            </div>
          }

          <div class="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            @for (entry of groupedDeck(); track entry.card.id) {
              <button
                type="button"
                (click)="removeCard(entry.card.id)"
                class="flex min-h-[46px] w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left transition hover:border-strength-nerf active:scale-[0.99]"
                [class]="
                  entry.card.isHero
                    ? 'border-gold-bright/70 bg-tavern-dark/90'
                    : 'border-bronze/60 bg-tavern-dark/80'
                "
              >
                <div class="flex min-w-0 items-center gap-2">
                  <span
                    class="relative flex h-10 w-[30px] shrink-0 items-center justify-center overflow-hidden rounded border bg-tavern-dark"
                    [class]="entry.card.isHero ? 'border-gold-bright/80' : 'border-bronze/60'"
                  >
                    @if (art.hasSprite(entry.card.id)) {
                      <img
                        [src]="art.spritePath(entry.card.id)"
                        [alt]="entry.card.name"
                        loading="lazy"
                        decoding="async"
                        (error)="art.markFailed(entry.card.id)"
                        class="h-full w-full object-cover object-top"
                      />
                    } @else {
                      <span class="h-4 w-4" [class]="factionAccent(entry.card.faction)">
                        <app-faction-emblem [faction]="entry.card.faction" />
                      </span>
                    }
                  </span>
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold"
                    [class]="
                      entry.card.isHero
                        ? 'border-gold-bright text-gold-bright'
                        : 'border-bronze text-strength-normal'
                    "
                  >
                    {{ entry.card.type === 'SPECIAL' ? '★' : entry.card.baseStrength }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-xs font-bold text-parchment">{{ entry.card.name }}</p>
                    <p class="truncate text-[10px] text-parchment/65">
                      {{ entry.card.ability ?? (entry.card.isHero ? 'Héroe' : 'Unidad estándar') }}
                    </p>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <span class="rounded border border-gold/50 bg-row-leather px-2 py-0.5 text-xs font-extrabold text-gold-bright">
                    x{{ entry.count }}
                  </span>
                  <span class="text-xs font-bold text-strength-nerf">−</span>
                </div>
              </button>
            } @empty {
              <p class="py-8 text-center text-xs text-parchment/60">
                Tu mazo está vacío. Toca cartas a la izquierda para agregarlas.
              </p>
            }
          </div>
        </div>
      </section>
    </main>
  `,
})
export class DeckBuilderPageComponent {
  private readonly storage = inject(DeckStorageService);
  private readonly feedback = inject(FeedbackService);

  readonly closed = output<void>();
  readonly art = createSpriteFallbackTracker();
  readonly factions = PLAYABLE_FACTIONS;
  readonly filters = FILTER_OPTIONS;

  readonly activeFaction = signal<PlayableFactionId>(this.storage.selectedPlayerFaction());
  readonly activeFilter = signal<CollectionFilter>('ALL');
  readonly saveMessage = signal('');

  private readonly initialDeck = this.storage.getDeckForFaction(this.activeFaction());
  readonly draftLeaderId = signal<string>(this.initialDeck.leaderId);
  readonly draftCardIds = signal<readonly string[]>([...this.initialDeck.cardIds]);

  readonly factionLeaders = computed(() => this.storage.getLeadersForFaction(this.activeFaction()));

  readonly selectedLeader = computed(
    () => this.factionLeaders().find((l) => l.id === this.draftLeaderId()) ?? null,
  );

  readonly validation = computed(() =>
    validateDeck(
      this.draftCardIds(),
      this.draftLeaderId(),
      this.activeFaction(),
      this.storage.catalog,
    ),
  );

  readonly copyCountMap = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const id of this.draftCardIds()) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  });

  readonly availableCollection = computed(() => {
    const faction = this.activeFaction();
    return this.storage.catalog
      .filter((c) => c.type !== 'LEADER' && (c.faction === faction || c.faction === 'NEUTRAL'))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'UNIT' ? -1 : 1;
        if (b.baseStrength !== a.baseStrength) return b.baseStrength - a.baseStrength;
        return a.name.localeCompare(b.name, 'es');
      });
  });

  readonly filteredCollection = computed(() => {
    const filter = this.activeFilter();
    const cards = this.availableCollection();
    if (filter === 'ALL') return cards;
    if (filter === 'SPECIAL') return cards.filter((c) => c.type === 'SPECIAL');
    return cards.filter((c) => c.type === 'UNIT' && c.allowedRows.includes(filter));
  });

  readonly groupedDeck = computed<readonly DeckGroupEntry[]>(() => {
    const counts = this.copyCountMap();
    const byId = new Map(this.storage.catalog.map((c) => [c.id, c]));
    const entries: DeckGroupEntry[] = [];

    for (const [id, count] of counts.entries()) {
      const card = byId.get(id);
      if (card) {
        entries.push({ card, count });
      }
    }

    return entries.sort((a, b) => {
      if (a.card.type !== b.card.type) return a.card.type === 'UNIT' ? -1 : 1;
      if (b.card.baseStrength !== a.card.baseStrength) {
        return b.card.baseStrength - a.card.baseStrength;
      }
      return a.card.name.localeCompare(b.card.name, 'es');
    });
  });

  factionLabel(faction: PlayableFactionId): string {
    return FACTION_META[faction].shortLabel;
  }

  factionAccent(faction: FactionId): string {
    return FACTION_META[faction].accentClass;
  }

  selectFaction(faction: PlayableFactionId): void {
    this.activeFaction.set(faction);
    const saved = this.storage.getDeckForFaction(faction);
    this.draftLeaderId.set(saved.leaderId);
    this.draftCardIds.set([...saved.cardIds]);
    this.saveMessage.set('');
    this.feedback.play('tap');
  }

  onLeaderSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.draftLeaderId.set(select.value);
    this.saveMessage.set('');
    this.feedback.play('tap');
  }

  addCard(card: CardDefinition): void {
    const currentCount = this.copyCountMap().get(card.id) ?? 0;
    if (currentCount >= card.maxCopies) return;
    this.draftCardIds.set([...this.draftCardIds(), card.id]);
    this.saveMessage.set('');
    this.feedback.play('deckTap');
  }

  removeCard(cardId: string): void {
    const ids = [...this.draftCardIds()];
    const idx = ids.lastIndexOf(cardId);
    if (idx === -1) return;
    ids.splice(idx, 1);
    this.draftCardIds.set(ids);
    this.saveMessage.set('');
    this.feedback.play('deckTap');
  }

  resetStarter(): void {
    const starter = this.storage.resetFactionToStarter(this.activeFaction());
    this.draftLeaderId.set(starter.leaderId);
    this.draftCardIds.set([...starter.cardIds]);
    this.saveMessage.set('Restaurado');
    this.feedback.play('redraw');
  }

  saveCurrentDeck(): void {
    const saved = this.storage.saveDeck(
      this.activeFaction(),
      this.draftLeaderId(),
      this.draftCardIds(),
    );
    if (saved) {
      this.storage.setPlayerFaction(this.activeFaction());
      this.saveMessage.set('¡Guardado!');
      this.feedback.play('cardClose');
    }
  }
}
