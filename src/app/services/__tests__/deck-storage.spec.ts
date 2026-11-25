import { beforeEach, describe, expect, it } from 'vitest';
import '@angular/compiler';
import { DeckStorageService } from '../deck-storage.service';

class MemoryStorage {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function installStorage(initial?: unknown): MemoryStorage {
  const storage = new MemoryStorage();
  if (initial !== undefined) storage.setItem('qwent.decks.v1', JSON.stringify(initial));
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  return storage;
}

describe('DeckStorageService: facción y líder aleatorios (U8.2)', () => {
  beforeEach(() => {
    installStorage();
  });

  it('sin sorteo usa el líder del mazo de la facción', () => {
    const service = new DeckStorageService();
    const deck = service.getDeckForFaction(service.selectedPlayerFaction());
    expect(service.playerLeaderId()).toBe(deck.leaderId);
  });

  it('randomizePlayerLoadout elige facción y un líder de esa facción sin tocar los mazos', () => {
    const service = new DeckStorageService();
    const decksBefore = service.decksByFaction();
    service.randomizePlayerLoadout(() => 0.99);
    const leader = service.getLeaderDefinition(service.playerLeaderId());
    expect(leader?.faction).toBe(service.selectedPlayerFaction());
    expect(service.decksByFaction()).toBe(decksBefore);
  });

  it('randomizeOpponentLoadout no afecta al jugador', () => {
    const service = new DeckStorageService();
    const playerFaction = service.selectedPlayerFaction();
    const playerLeader = service.playerLeaderId();
    service.randomizeOpponentLoadout(() => 0.5);
    expect(service.selectedPlayerFaction()).toBe(playerFaction);
    expect(service.playerLeaderId()).toBe(playerLeader);
    const oppLeader = service.getLeaderDefinition(service.opponentLeaderId());
    expect(oppLeader?.faction).toBe(service.selectedOpponentFaction());
  });

  it('cambiar la facción a mano descarta el líder sorteado', () => {
    const service = new DeckStorageService();
    service.randomizePlayerLoadout(() => 0.7);
    service.setPlayerFaction('MONSTERS');
    expect(service.playerLeaderId()).toBe(service.getDeckForFaction('MONSTERS').leaderId);
  });

  it('el sorteo persiste y se restaura, pero los mazos guardados no cambian', () => {
    const storage = installStorage();
    const first = new DeckStorageService();
    first.randomizeOpponentLoadout(() => 0.42);
    const expectedLeader = first.opponentLeaderId();
    const expectedFaction = first.selectedOpponentFaction();

    const raw = JSON.parse(storage.getItem('qwent.decks.v1') as string);
    expect(raw.opponentLeaderOverride).toBe(expectedLeader);

    const second = new DeckStorageService();
    expect(second.selectedOpponentFaction()).toBe(expectedFaction);
    expect(second.opponentLeaderId()).toBe(expectedLeader);
  });

  it('ignora un líder guardado que no pertenece a la facción (datos corruptos)', () => {
    installStorage({
      version: 1,
      selectedPlayerFaction: 'MONSTERS',
      selectedOpponentFaction: 'NILFGAARD',
      decks: {},
      playerLeaderOverride: 'ng_leader_emhyr_relentless',
      opponentLeaderOverride: 'no_existe',
    });
    const service = new DeckStorageService();
    expect(service.playerLeaderId()).toBe(service.getDeckForFaction('MONSTERS').leaderId);
    expect(service.opponentLeaderId()).toBe(service.getDeckForFaction('NILFGAARD').leaderId);
  });

  it('editar el mazo de la facción activa vuelve al líder del mazo', () => {
    const service = new DeckStorageService();
    service.randomizePlayerLoadout(() => 0.1);
    const faction = service.selectedPlayerFaction();
    const starter = service.getStarterDeck(faction);
    service.resetFactionToStarter(faction);
    expect(service.playerLeaderId()).toBe(starter.leaderId);
  });
});
