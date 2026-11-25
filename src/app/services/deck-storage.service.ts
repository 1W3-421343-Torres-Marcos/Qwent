import { Injectable, computed, signal } from '@angular/core';
import rawCards from '../../assets/data/cards.json';
import rawStarterDecks from '../../assets/data/starter-decks.json';
import {
  PLAYABLE_FACTIONS,
  pickRandomLoadout,
  validateDeck,
  type CardDefinition,
  type PlayableFactionId,
  type RandomSource,
  type StarterDeckDefinition,
} from '../../core';

export interface SavedDeckData {
  readonly faction: PlayableFactionId;
  readonly leaderId: string;
  readonly cardIds: readonly string[];
}

interface StoredPayloadV1 {
  readonly version: 1;
  readonly selectedPlayerFaction: PlayableFactionId;
  readonly selectedOpponentFaction: PlayableFactionId;
  readonly decks: Partial<Record<PlayableFactionId, SavedDeckData>>;
  /** Líder sorteado para el jugador (no altera los mazos guardados). */
  readonly playerLeaderOverride?: string | null;
  /** Líder sorteado para el rival (no altera los mazos guardados). */
  readonly opponentLeaderOverride?: string | null;
}

const STORAGE_KEY = 'qwent.decks.v1';

@Injectable({ providedIn: 'root' })
export class DeckStorageService {
  readonly catalog = rawCards as readonly CardDefinition[];
  private readonly starterDecksList = rawStarterDecks as readonly StarterDeckDefinition[];

  private readonly starterByFaction: Readonly<Record<PlayableFactionId, SavedDeckData>> =
    this.buildStarterMap();

  private readonly initialPayload = this.loadInitialPayload();

  readonly selectedPlayerFaction = signal<PlayableFactionId>(
    this.initialPayload.selectedPlayerFaction,
  );
  readonly selectedOpponentFaction = signal<PlayableFactionId>(
    this.initialPayload.selectedOpponentFaction,
  );
  readonly decksByFaction = signal<Readonly<Record<PlayableFactionId, SavedDeckData>>>(
    this.resolveAllDecks(this.initialPayload.decks),
  );

  private readonly playerLeaderOverride = signal<string | null>(
    this.sanitizeLeaderOverride(
      this.initialPayload.playerLeaderOverride,
      this.initialPayload.selectedPlayerFaction,
    ),
  );
  private readonly opponentLeaderOverride = signal<string | null>(
    this.sanitizeLeaderOverride(
      this.initialPayload.opponentLeaderOverride,
      this.initialPayload.selectedOpponentFaction,
    ),
  );

  /** Líder efectivo del jugador: el sorteado o, si no hay, el del mazo guardado de su facción. */
  readonly playerLeaderId = computed(
    () =>
      this.playerLeaderOverride() ??
      this.decksByFaction()[this.selectedPlayerFaction()].leaderId,
  );

  /** Líder efectivo del rival: el sorteado o, si no hay, el del mazo guardado de su facción. */
  readonly opponentLeaderId = computed(
    () =>
      this.opponentLeaderOverride() ??
      this.decksByFaction()[this.selectedOpponentFaction()].leaderId,
  );

  getDeckForFaction(faction: PlayableFactionId): SavedDeckData {
    return this.decksByFaction()[faction];
  }

  getStarterDeck(faction: PlayableFactionId): SavedDeckData {
    return this.starterByFaction[faction];
  }

  getLeadersForFaction(faction: PlayableFactionId): readonly CardDefinition[] {
    return this.catalog.filter((card) => card.type === 'LEADER' && card.faction === faction);
  }

  getLeaderDefinition(leaderId: string | null): CardDefinition | null {
    if (!leaderId) return null;
    const found = this.catalog.find((card) => card.id === leaderId && card.type === 'LEADER');
    return found ?? null;
  }

  saveDeck(
    faction: PlayableFactionId,
    leaderId: string,
    cardIds: readonly string[],
  ): boolean {
    const check = validateDeck(cardIds, leaderId, faction, this.catalog);
    if (!check.valid) {
      return false;
    }

    const nextDecks: Readonly<Record<PlayableFactionId, SavedDeckData>> = {
      ...this.decksByFaction(),
      [faction]: {
        faction,
        leaderId,
        cardIds: [...cardIds],
      },
    };
    this.decksByFaction.set(nextDecks);
    this.clearLeaderOverridesFor(faction);
    this.persist();
    return true;
  }

  resetFactionToStarter(faction: PlayableFactionId): SavedDeckData {
    const starter = this.starterByFaction[faction];
    const nextDecks: Readonly<Record<PlayableFactionId, SavedDeckData>> = {
      ...this.decksByFaction(),
      [faction]: {
        faction,
        leaderId: starter.leaderId,
        cardIds: [...starter.cardIds],
      },
    };
    this.decksByFaction.set(nextDecks);
    this.clearLeaderOverridesFor(faction);
    this.persist();
    return this.decksByFaction()[faction];
  }

  setPlayerFaction(faction: PlayableFactionId): void {
    this.selectedPlayerFaction.set(faction);
    this.playerLeaderOverride.set(null);
    this.persist();
  }

  setOpponentFaction(faction: PlayableFactionId): void {
    this.selectedOpponentFaction.set(faction);
    this.opponentLeaderOverride.set(null);
    this.persist();
  }

  /** Sortea facción y líder del jugador. No modifica los mazos guardados. */
  randomizePlayerLoadout(rng: RandomSource): void {
    const loadout = pickRandomLoadout(this.catalog, rng);
    if (!loadout) return;
    this.selectedPlayerFaction.set(loadout.faction);
    this.playerLeaderOverride.set(loadout.leaderId);
    this.persist();
  }

  /** Sortea facción y líder del rival. No modifica los mazos guardados. */
  randomizeOpponentLoadout(rng: RandomSource): void {
    const loadout = pickRandomLoadout(this.catalog, rng);
    if (!loadout) return;
    this.selectedOpponentFaction.set(loadout.faction);
    this.opponentLeaderOverride.set(loadout.leaderId);
    this.persist();
  }

  /** Si el usuario edita el mazo de una facción, su líder pasa a ser el del mazo y no el sorteado. */
  private clearLeaderOverridesFor(faction: PlayableFactionId): void {
    if (this.selectedPlayerFaction() === faction) this.playerLeaderOverride.set(null);
    if (this.selectedOpponentFaction() === faction) this.opponentLeaderOverride.set(null);
  }

  private sanitizeLeaderOverride(
    leaderId: string | null | undefined,
    faction: PlayableFactionId,
  ): string | null {
    if (typeof leaderId !== 'string') return null;
    const leader = this.catalog.find((card) => card.id === leaderId);
    return leader && leader.type === 'LEADER' && leader.faction === faction ? leaderId : null;
  }

  private buildStarterMap(): Readonly<Record<PlayableFactionId, SavedDeckData>> {
    const result = {} as Record<PlayableFactionId, SavedDeckData>;
    for (const faction of PLAYABLE_FACTIONS) {
      const starter = this.starterDecksList.find((d) => d.faction === faction);
      const fallbackLeader =
        starter?.leaderId ??
        this.catalog.find((c) => c.type === 'LEADER' && c.faction === faction)?.id ??
        '';
      result[faction] = {
        faction,
        leaderId: fallbackLeader,
        cardIds: starter ? [...starter.cardIds] : [],
      };
    }
    return result;
  }

  private isPlayableFaction(value: unknown): value is PlayableFactionId {
    return typeof value === 'string' && PLAYABLE_FACTIONS.includes(value as PlayableFactionId);
  }

  private resolveAllDecks(
    stored: Partial<Record<PlayableFactionId, SavedDeckData>> | undefined,
  ): Readonly<Record<PlayableFactionId, SavedDeckData>> {
    const result = {} as Record<PlayableFactionId, SavedDeckData>;
    for (const faction of PLAYABLE_FACTIONS) {
      const candidate = stored?.[faction];
      if (
        candidate &&
        typeof candidate.leaderId === 'string' &&
        Array.isArray(candidate.cardIds) &&
        validateDeck(candidate.cardIds, candidate.leaderId, faction, this.catalog).valid
      ) {
        result[faction] = {
          faction,
          leaderId: candidate.leaderId,
          cardIds: [...candidate.cardIds],
        };
      } else {
        result[faction] = this.starterByFaction[faction];
      }
    }
    return result;
  }

  private loadInitialPayload(): StoredPayloadV1 {
    const defaults: StoredPayloadV1 = {
      version: 1,
      selectedPlayerFaction: 'NORTHERN_REALMS',
      selectedOpponentFaction: 'NILFGAARD',
      decks: {},
    };

    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return defaults;
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as Partial<StoredPayloadV1> | null;
      if (!parsed || parsed.version !== 1) return defaults;

      return {
        version: 1,
        selectedPlayerFaction: this.isPlayableFaction(parsed.selectedPlayerFaction)
          ? parsed.selectedPlayerFaction
          : 'NORTHERN_REALMS',
        selectedOpponentFaction: this.isPlayableFaction(parsed.selectedOpponentFaction)
          ? parsed.selectedOpponentFaction
          : 'NILFGAARD',
        decks: parsed.decks && typeof parsed.decks === 'object' ? parsed.decks : {},
        playerLeaderOverride:
          typeof parsed.playerLeaderOverride === 'string' ? parsed.playerLeaderOverride : null,
        opponentLeaderOverride:
          typeof parsed.opponentLeaderOverride === 'string' ? parsed.opponentLeaderOverride : null,
      };
    } catch {
      return defaults;
    }
  }

  private persist(): void {
    try {
      const storage = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!storage) return;
      const payload: StoredPayloadV1 = {
        version: 1,
        selectedPlayerFaction: this.selectedPlayerFaction(),
        selectedOpponentFaction: this.selectedOpponentFaction(),
        decks: this.decksByFaction(),
        playerLeaderOverride: this.playerLeaderOverride(),
        opponentLeaderOverride: this.opponentLeaderOverride(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Safe offline fallback if WebView storage quota is unavailable
    }
  }
}
