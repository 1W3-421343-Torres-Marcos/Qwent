import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PLAYABLE_FACTIONS, QWENT_PHASE, type PlayableFactionId } from '../core';
import { BoardPageComponent } from './features/board/board-page.component';
import { DeckBuilderPageComponent } from './features/deck-builder/deck-builder-page.component';
import { DeckStorageService } from './services/deck-storage.service';
import { GameFacadeService, type GameMode } from './services/game-facade.service';
import { FactionEmblemComponent } from './shared/components/faction-emblem.component';
import { FACTION_META } from './shared/constants/faction-meta';

type ScreenView = 'MENU' | 'DECK_BUILDER' | 'BOARD';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BoardPageComponent, DeckBuilderPageComponent, FactionEmblemComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (screen() === 'BOARD') {
      <app-board-page (exitToMenu)="screen.set('MENU')" />
    } @else if (screen() === 'DECK_BUILDER') {
      <app-deck-builder-page (closed)="screen.set('MENU')" />
    } @else {
      <main
        class="flex h-dvh w-screen items-center justify-center overflow-hidden bg-tavern-dark text-parchment p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]"
      >
        <section
          class="qwent-wood-surface mx-4 flex w-full max-w-2xl flex-col items-center gap-3 rounded-xl border-2 border-bronze px-6 py-4 text-center shadow-2xl"
        >
          <div class="flex flex-wrap items-center justify-center gap-2">
            <span
              class="rounded border border-gold/60 bg-row-leather px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-gold"
            >
              Fase {{ phase }} — Release Offline
            </span>
            <span
              class="rounded border border-bronze bg-tavern-dark/80 px-3 py-0.5 text-[11px] font-medium text-parchment/80"
            >
              100% Offline • TW3 Clásico
            </span>
          </div>

          <header>
            <h1 class="font-serif text-3xl sm:text-4xl font-extrabold tracking-[0.2em] text-gold-bright drop-shadow">
              QWENT
            </h1>
          </header>

          <!-- Player & Opponent Faction / Deck Quick Selector -->
          <div class="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="rounded-lg border border-gold/60 bg-tavern-dark/85 p-2.5 text-left">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  <span class="h-3.5 w-3.5" [class]="factionAccent(deckStorage.selectedPlayerFaction())">
                    <app-faction-emblem [faction]="deckStorage.selectedPlayerFaction()" />
                  </span>
                  <span>Tu Facción (J1)</span>
                </span>
                <select
                  [value]="deckStorage.selectedPlayerFaction()"
                  (change)="onPlayerFactionChange($event)"
                  aria-label="Seleccionar facción del jugador"
                  class="min-h-[34px] rounded border border-bronze bg-board-wood px-2 py-0.5 text-xs font-bold text-parchment focus:border-gold-bright focus:outline-none"
                >
                  @for (faction of factions; track faction) {
                    <option [value]="faction">{{ factionLabel(faction) }}</option>
                  }
                </select>
              </div>
              <p class="mt-1 truncate text-[11px] font-semibold text-gold-bright">
                ♛ {{ playerLeaderName() }} · {{ playerCardCount() }} cartas
              </p>
              <p class="mt-0.5 line-clamp-1 text-[10px] text-parchment/70">
                {{ playerPassive() }}
              </p>
            </div>

            <div class="rounded-lg border border-bronze/70 bg-tavern-dark/85 p-2.5 text-left">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-parchment/75">
                  <span class="h-3.5 w-3.5" [class]="factionAccent(deckStorage.selectedOpponentFaction())">
                    <app-faction-emblem [faction]="deckStorage.selectedOpponentFaction()" />
                  </span>
                  <span>Rival / IA (J2)</span>
                </span>
                <select
                  [value]="deckStorage.selectedOpponentFaction()"
                  (change)="onOpponentFactionChange($event)"
                  aria-label="Seleccionar facción del rival"
                  class="min-h-[34px] rounded border border-bronze bg-board-wood px-2 py-0.5 text-xs font-bold text-parchment focus:border-gold-bright focus:outline-none"
                >
                  @for (faction of factions; track faction) {
                    <option [value]="faction">{{ factionLabel(faction) }}</option>
                  }
                </select>
              </div>
              <p class="mt-1 truncate text-[11px] font-semibold text-parchment">
                ♛ {{ opponentLeaderName() }} · {{ opponentCardCount() }} cartas
              </p>
              <p class="mt-0.5 line-clamp-1 text-[10px] text-parchment/70">
                {{ opponentPassive() }}
              </p>
            </div>
          </div>

          <div class="mt-1 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              (click)="startMatch('VS_AI')"
              class="min-h-[48px] rounded-lg border-2 border-gold-bright bg-gold/25 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gold-bright shadow-lg transition active:scale-95"
            >
              Jugar vs. IA (1P)
            </button>
            <button
              type="button"
              (click)="startMatch('LOCAL_2P')"
              class="min-h-[48px] rounded-lg border border-bronze bg-tavern-dark px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-parchment transition hover:border-gold active:scale-95"
            >
              Local 2 Jugadores
            </button>
            <button
              type="button"
              (click)="screen.set('DECK_BUILDER')"
              class="min-h-[48px] rounded-lg border border-gold/60 bg-row-leather px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gold transition hover:border-gold-bright active:scale-95"
            >
              Constructor de Mazos
            </button>
          </div>
        </section>
      </main>
    }
  `,
})
export class AppComponent {
  private readonly facade = inject(GameFacadeService);
  readonly deckStorage = inject(DeckStorageService);

  readonly phase = QWENT_PHASE;
  readonly factions = PLAYABLE_FACTIONS;
  readonly screen = signal<ScreenView>('MENU');

  readonly playerLeaderName = computed(() => {
    const deck = this.deckStorage.getDeckForFaction(this.deckStorage.selectedPlayerFaction());
    return this.deckStorage.getLeaderDefinition(deck.leaderId)?.name ?? 'Sin líder';
  });

  readonly opponentLeaderName = computed(() => {
    const deck = this.deckStorage.getDeckForFaction(this.deckStorage.selectedOpponentFaction());
    return this.deckStorage.getLeaderDefinition(deck.leaderId)?.name ?? 'Sin líder';
  });

  readonly playerCardCount = computed(
    () => this.deckStorage.getDeckForFaction(this.deckStorage.selectedPlayerFaction()).cardIds.length,
  );

  readonly opponentCardCount = computed(
    () => this.deckStorage.getDeckForFaction(this.deckStorage.selectedOpponentFaction()).cardIds.length,
  );

  readonly playerPassive = computed(
    () => FACTION_META[this.deckStorage.selectedPlayerFaction()].passiveSummary,
  );

  readonly opponentPassive = computed(
    () => FACTION_META[this.deckStorage.selectedOpponentFaction()].passiveSummary,
  );

  factionLabel(faction: PlayableFactionId): string {
    return FACTION_META[faction].label;
  }

  factionAccent(faction: PlayableFactionId): string {
    return FACTION_META[faction].accentClass;
  }

  onPlayerFactionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PlayableFactionId;
    this.deckStorage.setPlayerFaction(value);
  }

  onOpponentFactionChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as PlayableFactionId;
    this.deckStorage.setOpponentFaction(value);
  }

  startMatch(mode: GameMode): void {
    this.facade.startNewMatch(mode);
    this.screen.set('BOARD');
  }
}
