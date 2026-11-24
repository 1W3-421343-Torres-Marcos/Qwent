import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createInitialGameState,
  type CardDefinition,
  type CardInstance,
  type FactionId,
  type GameState,
  type StarterDeckDefinition,
} from '../../../core';
import {
  buildAiPlayLabel,
  detectLostGemPlayers,
  detectNilfgaardTieBanner,
  detectRoundAdvanceBanners,
} from '../board-events.utils';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function createMockState(p1Faction: FactionId = 'NORTHERN_REALMS', p2Faction: FactionId = 'NILFGAARD'): GameState {
  const deck1 = decks[0]!;
  const deck2 = decks[1]!;
  const base = createInitialGameState({
    rngSeed: 42,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'Tú',
      faction: p1Faction,
      leader: catalog.find((c) => c.id === deck1.leaderId) ?? null,
      deckCardIds: deck1.cardIds,
    },
    player2: {
      name: 'IA',
      faction: p2Faction,
      leader: catalog.find((c) => c.id === deck2.leaderId) ?? null,
      deckCardIds: deck2.cardIds,
    },
  });
  return { ...base, roundNumber: 1 };
}

describe('Board Live Event Helpers (U4)', () => {
  it('detectRoundAdvanceBanners emits round start, NR extra draw, Monsters carryover, and Cow Avenger', () => {
    const ves = catalog.find((c) => c.id === 'nr_ves')!;
    const nekker = catalog.find((c) => c.id === 'mo_nekker')!;
    const bovine: CardDefinition = {
      id: 'nt_bovine_defense_force',
      name: 'Fuerza de Defensa Bovina',
      faction: 'NEUTRAL',
      type: 'UNIT',
      baseStrength: 8,
      isHero: false,
      allowedRows: ['CLOSE_COMBAT'],
      ability: null,
      maxCopies: 1,
      description: 'Token Chort',
    };

    const prev = createMockState('NORTHERN_REALMS', 'MONSTERS');
    const keptMonster: CardInstance = {
      instanceId: 'mo_kept_1',
      definitionId: nekker.id,
      card: nekker,
      effectiveStrength: 2,
    };
    const chortToken: CardInstance = {
      instanceId: 'avenger_bovine_1',
      definitionId: bovine.id,
      card: bovine,
      effectiveStrength: 8,
    };
    const extraCard: CardInstance = {
      instanceId: 'nr_extra',
      definitionId: ves.id,
      card: ves,
      effectiveStrength: 5,
    };

    const next: GameState = {
      ...prev,
      roundNumber: 2,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...prev.players.PLAYER_1,
          hand: [...prev.players.PLAYER_1.hand, extraCard],
          rows: {
            ...prev.players.PLAYER_1.rows,
            CLOSE_COMBAT: { ...prev.players.PLAYER_1.rows.CLOSE_COMBAT, cards: [chortToken] },
          },
        },
        PLAYER_2: {
          ...prev.players.PLAYER_2,
          rows: {
            ...prev.players.PLAYER_2.rows,
            CLOSE_COMBAT: { ...prev.players.PLAYER_2.rows.CLOSE_COMBAT, cards: [keptMonster] },
          },
        },
      },
    };

    const banners = detectRoundAdvanceBanners(prev, next, 'PLAYER_1');
    const titles = banners.map((b) => b.title);
    expect(titles).toContain('Ronda 2');
    expect(titles).toContain('Reinos del Norte');
    expect(titles).toContain('¡Vengador!');
    expect(titles).toContain('Pasiva de Monstruos');
    expect(banners.find((b) => b.title === 'Ronda 2')?.subtitle).toBe('Empiezas tú');
  });

  it('detectNilfgaardTieBanner detects Nilfgaard tie-break win and ignores normal wins or draws', () => {
    const base = createMockState('NORTHERN_REALMS', 'NILFGAARD');

    const tieWinState: GameState = {
      ...base,
      phase: 'ROUND_END',
      roundHistory: [{ roundNumber: 1, winner: 'PLAYER_2', scores: { PLAYER_1: 15, PLAYER_2: 15 } }],
    };
    const banner = detectNilfgaardTieBanner(tieWinState);
    expect(banner?.title).toBe('Pasiva de Nilfgaard');
    expect(banner?.subtitle).toContain('IA');

    const normalWin: GameState = {
      ...base,
      phase: 'ROUND_END',
      roundHistory: [{ roundNumber: 1, winner: 'PLAYER_1', scores: { PLAYER_1: 20, PLAYER_2: 15 } }],
    };
    expect(detectNilfgaardTieBanner(normalWin)).toBeNull();

    const mirrorDraw: GameState = {
      ...base,
      phase: 'ROUND_END',
      roundHistory: [{ roundNumber: 1, winner: 'DRAW', scores: { PLAYER_1: 15, PLAYER_2: 15 } }],
    };
    expect(detectNilfgaardTieBanner(mirrorDraw)).toBeNull();
  });

  it('detectLostGemPlayers identifies players whose gems decreased', () => {
    const prev = createMockState();
    const oneLost: GameState = {
      ...prev,
      players: {
        ...prev.players,
        PLAYER_2: { ...prev.players.PLAYER_2, gems: 1 },
      },
    };
    expect(detectLostGemPlayers(prev, oneLost)).toEqual(['PLAYER_2']);

    const bothLost: GameState = {
      ...prev,
      players: {
        PLAYER_1: { ...prev.players.PLAYER_1, gems: 1 },
        PLAYER_2: { ...prev.players.PLAYER_2, gems: 1 },
      },
    };
    expect(detectLostGemPlayers(prev, bothLost)).toEqual(['PLAYER_1', 'PLAYER_2']);
    expect(detectLostGemPlayers(prev, prev)).toEqual([]);
  });

  it('buildAiPlayLabel classifies Leader, Special, Hero and standard Unit cards', () => {
    const leader = catalog.find((c) => c.type === 'LEADER')!;
    const special = catalog.find((c) => c.type === 'SPECIAL')!;
    const hero = catalog.find((c) => c.isHero)!;
    const unit = catalog.find((c) => c.type === 'UNIT' && !c.isHero)!;

    expect(buildAiPlayLabel(leader)).toBe('IA activó Líder');
    expect(buildAiPlayLabel(special)).toBe('IA jugó especial');
    expect(buildAiPlayLabel(hero)).toBe('IA jugó Héroe');
    expect(buildAiPlayLabel(unit)).toBe('IA jugó unidad');
  });
});
