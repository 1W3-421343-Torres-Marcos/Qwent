import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  canPlayCard,
  createInitialGameState,
  dispatch,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function byId(id: string): CardDefinition {
  const found = catalog.find((c) => c.id === id);
  if (!found) throw new Error(`Missing test card: ${id}`);
  return found;
}

function inst(instanceId: string, cardId: string): CardInstance {
  const card = byId(cardId);
  return {
    instanceId,
    definitionId: card.id,
    card,
    effectiveStrength: card.baseStrength,
  };
}

function baseMatch(seed = 42): GameState {
  return createInitialGameState({
    rngSeed: seed,
    catalog,
    player1: {
      name: 'Norte',
      faction: decks[0]!.faction,
      leader: null,
      deckCardIds: decks[0]!.cardIds,
    },
    player2: {
      name: 'Nilfgaard',
      faction: decks[1]!.faction,
      leader: null,
      deckCardIds: decks[1]!.cardIds,
    },
  });
}

describe('F3.1 & F3.2 Abilities: Muster, Agile, Spy, Decoy & Medic', () => {
  it('MUSTER summons matching copies from BOTH hand and deck in a single pass, never from discard', () => {
    let state = baseMatch();
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            inst('p1_odimm', 'nt_gaunter_odimm'),
            inst('p1_dark_hand', 'nt_gaunter_darkness'),
            inst('p1_keep', 'nr_ves'),
          ],
          deck: [
            inst('p1_dark_deck1', 'nt_gaunter_darkness'),
            inst('p1_dark_deck2', 'nt_gaunter_darkness'),
            inst('p1_other_deck', 'nr_ballista'),
          ],
          discard: [inst('p1_dark_discard', 'nt_gaunter_darkness')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
        },
      },
    };

    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_odimm',
    });

    const p1 = state.players.PLAYER_1;
    expect(p1.rows.SIEGE.cards.map((c) => c.instanceId)).toEqual(['p1_odimm']);
    expect(p1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual([
      'p1_dark_hand',
      'p1_dark_deck1',
      'p1_dark_deck2',
    ]);
    expect(p1.hand.map((c) => c.instanceId)).toEqual(['p1_keep']);
    expect(p1.deck.map((c) => c.instanceId)).toEqual(['p1_other_deck']);
    expect(p1.discard.map((c) => c.instanceId)).toEqual(['p1_dark_discard']);
    expect(p1.totalScore).toBe(2 + 4 * 3);
  });

  it('Agile units can be placed on any allowed row and reject disallowed rows', () => {
    let state = baseMatch();
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_olgierd', 'nt_olgierd_von_everec')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
        },
      },
    };

    const rejected = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_olgierd',
      targetRow: 'SIEGE',
    });
    expect(rejected).toBe(state);

    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_olgierd',
      targetRow: 'RANGED',
    });
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual(['p1_olgierd']);
    expect(state.players.PLAYER_1.rows.RANGED.totalStrength).toBe(6);
  });

  it('SPY places unit on opponent row, draws 2/1/0 cards safely, is affected by Weather/Horn, and discards to opponent', () => {
    let state = baseMatch();
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      weather: {
        frost: { card: inst('w_frost', 'sp_biting_frost'), owner: 'PLAYER_2' },
        fog: null,
        rain: null,
      },
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            inst('p1_stennis', 'nr_prince_stennis'),
            inst('p1_elf', 'nt_mysterious_elf'),
          ],
          deck: [
            inst('p1_draw1', 'nr_ves'),
            inst('p1_draw2', 'nr_ballista'),
            inst('p1_draw3', 'nr_trebuchet'),
          ],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_decoy', 'sp_decoy'), inst('p2_hold', 'ng_cahir')],
          rows: {
            ...state.players.PLAYER_2.rows,
            CLOSE_COMBAT: {
              cards: [],
              hornCard: inst('p2_horn', 'sp_commanders_horn'),
              totalStrength: 0,
            },
          },
        },
      },
    };

    // P1 plays non-Hero Spy (base 5) onto P2's Frosted + Horned Close Combat -> 1 * 2 = 2 points for P2; P1 draws 2 cards
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_stennis' });
    expect(state.players.PLAYER_2.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['p1_stennis']);
    expect(state.players.PLAYER_2.totalScore).toBe(2);
    expect(state.players.PLAYER_1.hand.map((c) => c.instanceId)).toEqual(['p1_elf', 'p1_draw1', 'p1_draw2']);
    expect(state.players.PLAYER_1.deck.map((c) => c.instanceId)).toEqual(['p1_draw3']);

    // P2 picks up P1's non-Hero Spy using Decoy -> P2 gets Stennis into P2's hand!
    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_decoy',
      decoyTargetInstanceId: 'p1_stennis',
    });
    expect(state.players.PLAYER_2.hand.map((c) => c.instanceId)).toContain('p1_stennis');
    expect(state.players.PLAYER_2.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['p2_decoy']);

    // P1 plays Hero Spy (Mysterious Elf) with only 1 card left in deck -> draws 1 without error
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_elf' });
    expect(state.players.PLAYER_1.deck).toHaveLength(0);
    expect(state.players.PLAYER_1.hand.map((c) => c.instanceId)).toContain('p1_draw3');

    // P2 CANNOT Decoy Hero Spy (Mysterious Elf)
    const decoyOnHero = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_2',
      instanceId: 'p2_decoy',
      decoyTargetInstanceId: 'p1_elf',
    });
    expect(decoyOnHero).toBe(state);

    // P2 plays Stennis back onto P1's board and draws; P1 passes, P2 passes, Advance Round -> Stennis goes to P1 discard!
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p1_stennis' });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['p1_stennis']);
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toContain('p1_stennis');
  });

  it('DECOY cannot play with no valid own targets, rejects Hero/Decoy targets, and leaves strength 0 immune', () => {
    let state = baseMatch();
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            inst('p1_decoy1', 'sp_decoy'),
            inst('p1_decoy2', 'sp_decoy'),
            inst('p1_ves', 'nr_ves'),
          ],
          rows: {
            ...state.players.PLAYER_1.rows,
            CLOSE_COMBAT: {
              cards: [inst('p1_roche', 'nr_vernon_roche')],
              hornCard: inst('p1_horn', 'sp_commanders_horn'),
              totalStrength: 10,
            },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
        },
      },
    };

    // Only Hero on board -> DECOY cannot be played
    expect(canPlayCard(state, 'PLAYER_1', 'p1_decoy1')).toBe(false);

    // Play normal unit Ves, P2 passes, then P1 Decoys Ves
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_ves' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(state.players.PLAYER_1.totalScore).toBe(20); // Roche 10 + Ves (5*2)=10
    expect(canPlayCard(state, 'PLAYER_1', 'p1_decoy1')).toBe(true);

    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'p1_decoy1',
      decoyTargetInstanceId: 'p1_ves',
    });
    expect(state.players.PLAYER_1.totalScore).toBe(10); // Decoy stays 0 even with Horn
    expect(state.players.PLAYER_1.hand.map((c) => c.instanceId)).toContain('p1_ves');

    // Cannot target Decoy with another Decoy
    expect(canPlayCard(state, 'PLAYER_1', 'p1_decoy2', undefined, 'p1_decoy1')).toBe(false);
  });

  it('MEDIC ignores Heroes/specials, supports empty discard, and chains MEDIC -> MEDIC -> AGILE_ROW & MUSTER & SPY', () => {
    let state = baseMatch();
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            inst('p1_med_hero', 'nt_yennefer_of_vengerberg'),
            inst('p1_med_empty', 'nr_dun_banner_medic'),
          ],
          deck: [inst('p1_dark_deck', 'nt_gaunter_darkness')],
          discard: [
            inst('p1_hero_disc', 'nr_vernon_roche'),
            inst('p1_sp_disc', 'sp_scorch'),
            inst('p1_med_chain', 'nr_dun_banner_medic'),
            inst('p1_agile_disc', 'nt_olgierd_von_everec'),
          ],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_med', 'ng_etolian_auxiliary'), inst('p2_hold', 'ng_cahir')],
          deck: [inst('p2_draw1', 'ng_cahir'), inst('p2_draw2', 'ng_cahir')],
          discard: [
            inst('p2_spy_disc', 'ng_stefan_skellen'),
            inst('p2_odimm_disc', 'nt_gaunter_odimm'),
          ],
        },
      },
    };

    // P1 plays Yennefer (MEDIC) -> enters PENDING_SELECTION(MEDIC_DISCARD) with only non-Hero units (never Roche/Scorch)
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_med_hero' });
    expect(state.phase).toBe('PENDING_SELECTION');
    expect(state.activePlayer).toBe('PLAYER_1');
    expect(state.pendingSelection).toEqual({
      type: 'MEDIC_DISCARD',
      playerId: 'PLAYER_1',
      eligibleInstanceIds: ['p1_med_chain', 'p1_agile_disc'],
    });

    // Chain 1: Revive Dun Banner Medic -> removed from discard immediately, triggers second MEDIC_DISCARD without rotating turn
    state = dispatch(state, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_1',
      targetInstanceId: 'p1_med_chain',
    });
    expect(state.phase).toBe('PENDING_SELECTION');
    expect(state.activePlayer).toBe('PLAYER_1');
    expect(state.pendingSelection).toEqual({
      type: 'MEDIC_DISCARD',
      playerId: 'PLAYER_1',
      eligibleInstanceIds: ['p1_agile_disc'],
    });

    // Chain 2: Revive Agile Olgierd -> enters AGILE_ROW pending selection WITHOUT placing on board yet, turn still P1
    state = dispatch(state, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_1',
      targetInstanceId: 'p1_agile_disc',
    });
    expect(state.phase).toBe('PENDING_SELECTION');
    expect(state.activePlayer).toBe('PLAYER_1');
    expect(state.pendingSelection?.type).toBe('AGILE_ROW');
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards).toHaveLength(0);
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual(['p1_med_hero']);

    // Choose RANGED for Olgierd -> placed on RANGED, chain closes, turn rotates to P2!
    state = dispatch(state, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_1',
      targetRow: 'RANGED',
    });
    expect(state.phase).toBe('PLAYING');
    expect(state.pendingSelection).toBeNull();
    expect(state.activePlayer).toBe('PLAYER_2');
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual([
      'p1_med_hero',
      'p1_agile_disc',
    ]);

    // P2 plays Medic -> revives Spy Stefan Skellen -> enters P1's Close Combat & P2 draws 2 cards
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_med' });
    state = dispatch(state, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_2',
      targetInstanceId: 'p2_spy_disc',
    });
    expect(state.phase).toBe('PLAYING');
    expect(state.activePlayer).toBe('PLAYER_1');
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.instanceId)).toEqual(['p2_spy_disc']);
    expect(state.players.PLAYER_2.hand).toHaveLength(3); // p2_hold + 2 drawn

    // P1 plays second Medic with only Hero/Special left in discard -> plays without resurrection prompt
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_med_empty' });
    expect(state.phase).toBe('PLAYING');
    expect(state.pendingSelection).toBeNull();
    expect(state.activePlayer).toBe('PLAYER_2');
  });

  it('MEDIC -> MUSTER revives a Muster unit and triggers summoning from hand and deck', () => {
    let state = baseMatch();
    state = {
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('p1_med', 'nr_dun_banner_medic'), inst('p1_dark_hand', 'nt_gaunter_darkness')],
          deck: [inst('p1_dark_deck', 'nt_gaunter_darkness')],
          discard: [inst('p1_odimm_disc', 'nt_gaunter_odimm')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold', 'ng_cahir')],
        },
      },
    };

    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_med' });
    state = dispatch(state, {
      type: 'SELECT_TARGET',
      playerId: 'PLAYER_1',
      targetInstanceId: 'p1_odimm_disc',
    });

    expect(state.phase).toBe('PLAYING');
    expect(state.players.PLAYER_1.rows.SIEGE.cards.map((c) => c.instanceId)).toEqual([
      'p1_med',
      'p1_odimm_disc',
    ]);
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual([
      'p1_dark_hand',
      'p1_dark_deck',
    ]);
    expect(state.players.PLAYER_1.totalScore).toBe(5 + 2 + 4 + 4);
  });
});
