import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  canUseLeader,
  createInitialGameState,
  dispatch,
  isPlayerPassiveLeaderActive,
  recalculateBoard,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function byId(id: string): CardDefinition {
  const found = catalog.find((c) => c.id === id);
  if (!found) throw new Error(`Missing Skellige test card: ${id}`);
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

function createSkelligeMatch(
  p1LeaderId: string | null = 'sk_leader_crach_an_craite',
  p2LeaderId: string | null = null,
  seed = 777,
): GameState {
  const skDeck = decks.find((d) => d.faction === 'SKELLIGE')!;
  const nrDeck = decks.find((d) => d.faction === 'NORTHERN_REALMS')!;
  return createInitialGameState({
    rngSeed: seed,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'P1 Skellige',
      faction: 'SKELLIGE',
      leader: p1LeaderId ? byId(p1LeaderId) : null,
      deckCardIds: skDeck.cardIds,
    },
    player2: {
      name: 'P2 Norte',
      faction: 'NORTHERN_REALMS',
      leader: p2LeaderId ? byId(p2LeaderId) : null,
      deckCardIds: nrDeck.cardIds,
    },
  });
}

describe('U7 Blood and Wine — Skellige Faction Mechanics', () => {
  it('revives up to 2 random non-Hero units deterministically at Round 3 start via Skellige passive', () => {
    const r2Ended: GameState = {
      ...createSkelligeMatch('sk_leader_crach_an_craite', null, 314),
      phase: 'ROUND_END',
      roundNumber: 2,
      roundHistory: [
        { roundNumber: 1, winner: 'PLAYER_1', scores: { PLAYER_1: 12, PLAYER_2: 6 } },
        { roundNumber: 2, winner: 'PLAYER_2', scores: { PLAYER_1: 5, PLAYER_2: 10 } },
      ],
      players: {
        ...createSkelligeMatch('sk_leader_crach_an_craite', null, 314).players,
        PLAYER_1: {
          ...createSkelligeMatch('sk_leader_crach_an_craite', null, 314).players.PLAYER_1,
          gems: 1,
          discard: [
            inst('d_hero', 'sk_hjalmar'),
            inst('d_special', 'sp_decoy'),
            inst('d_u1', 'sk_donar_an_hindar'),
            inst('d_u2', 'sk_clan_brokvar_archer'),
            inst('d_u3', 'sk_svanrige'),
          ],
        },
        PLAYER_2: {
          ...createSkelligeMatch('sk_leader_crach_an_craite', null, 314).players.PLAYER_2,
          gems: 1,
        },
      },
    };

    const r3a = dispatch(r2Ended, { type: 'ADVANCE_ROUND' });
    const r3b = dispatch(r2Ended, { type: 'ADVANCE_ROUND' });

    expect(r3a.roundNumber).toBe(3);
    expect(r3a.phase).toBe('PLAYING');
    expect(r3a.players.PLAYER_1.discard.map((c) => c.instanceId)).toContain('d_hero');
    expect(r3a.players.PLAYER_1.discard.map((c) => c.instanceId)).toContain('d_special');
    expect(r3a.players.PLAYER_1.discard).toHaveLength(3); // 1 Hero + 1 Special + 1 leftover unit
    expect(r3a.players.PLAYER_1.totalScore).toBeGreaterThan(0);

    const revivedIdsA = ['CLOSE_COMBAT', 'RANGED', 'SIEGE']
      .flatMap((row) => r3a.players.PLAYER_1.rows[row as 'CLOSE_COMBAT'].cards.map((c) => c.instanceId))
      .sort();
    const revivedIdsB = ['CLOSE_COMBAT', 'RANGED', 'SIEGE']
      .flatMap((row) => r3b.players.PLAYER_1.rows[row as 'CLOSE_COMBAT'].cards.map((c) => c.instanceId))
      .sort();
    expect(revivedIdsA).toHaveLength(2);
    expect(revivedIdsA).toEqual(revivedIdsB);
  });

  it('spawns Hemdall (11 Hero) in Close Combat when Kambi enters discard at round end', () => {
    const base = createSkelligeMatch();
    const roundEnd: GameState = {
      ...base,
      phase: 'ROUND_END',
      roundNumber: 1,
      roundHistory: [{ roundNumber: 1, winner: 'PLAYER_2', scores: { PLAYER_1: 0, PLAYER_2: 5 } }],
      players: {
        ...base.players,
        PLAYER_1: {
          ...base.players.PLAYER_1,
          gems: 1,
          rows: {
            ...base.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_kambi', 'sk_kambi')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    };

    const r2 = dispatch(roundEnd, { type: 'ADVANCE_ROUND' });
    expect(r2.roundNumber).toBe(2);
    expect(r2.players.PLAYER_1.discard.map((c) => c.definitionId)).toContain('sk_kambi');
    expect(r2.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.definitionId)).toEqual(['sk_hemdall']);
    expect(r2.players.PLAYER_1.totalScore).toBe(11);
  });

  it('transforms Berserker and Young Berserker via Mardroeme and Ermion (including late entry on row) and resets next round', () => {
    let state = createSkelligeMatch(null, null, 11);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        ...state.players,
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            inst('h_mard', 'sk_mardroeme'),
            inst('h_bers_late', 'sk_berserker'),
            inst('h_ermion', 'sk_ermion'),
          ],
          rows: {
            CLOSE_COMBAT: {
              cards: [inst('b1', 'sk_berserker'), inst('mate1', 'sk_donar_an_hindar')],
              hornCard: null,
              totalStrength: 0,
            },
            RANGED: {
              cards: [inst('yb1', 'sk_young_berserker'), inst('yb2', 'sk_young_berserker')],
              hornCard: null,
              totalStrength: 0,
            },
            SIEGE: { cards: [], hornCard: null, totalStrength: 0 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_hold1', 'nr_ves'), inst('p2_hold2', 'nr_ves'), inst('p2_hold3', 'nr_ves')],
        },
      },
    });

    // 1. Special Mardroeme on CLOSE_COMBAT transforms b1 -> sk_vildkaarl (14 + Morale +1 to Donar = 19)
    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'h_mard',
      targetRow: 'CLOSE_COMBAT',
    });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.mardroemeActive).toBe(true);
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.definitionId)).toEqual([
      'sk_vildkaarl',
      'sk_donar_an_hindar',
    ]);
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.totalStrength).toBe(19);
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toContain('h_mard');

    // P2 plays filler
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_hold1' });

    // 2. Late Berserker entering CLOSE_COMBAT transforms immediately because mardroemeActive is true
    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'h_bers_late',
      targetRow: 'CLOSE_COMBAT',
    });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.definitionId)).toEqual([
      'sk_vildkaarl',
      'sk_donar_an_hindar',
      'sk_vildkaarl',
    ]);

    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_hold2' });

    // 3. Ermion enters RANGED and transforms both Young Berserkers into Young Vildkaarls (Tight Bond 8*2 + 8*2 = 32 + 8 Hero = 40)
    state = dispatch(state, {
      type: 'PLAY_CARD',
      playerId: 'PLAYER_1',
      instanceId: 'h_ermion',
      targetRow: 'RANGED',
    });
    expect(state.players.PLAYER_1.rows.RANGED.mardroemeActive).toBe(true);
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.definitionId)).toEqual([
      'sk_young_vildkaarl',
      'sk_young_vildkaarl',
      'sk_ermion',
    ]);
    expect(state.players.PLAYER_1.rows.RANGED.totalStrength).toBe(40);

    // Next round clears mardroemeActive flag
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    const nextRound = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(nextRound.players.PLAYER_1.rows.CLOSE_COMBAT.mardroemeActive).toBeUndefined();
    expect(nextRound.players.PLAYER_1.rows.RANGED.mardroemeActive).toBeUndefined();
  });

  it('summons Shield Maidens with Cerys (mixed MUSTER + TIGHT_BOND) and triggers Clan Dimun Pirate global Scorch', () => {
    let state = createSkelligeMatch(null, null, 22);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [
            inst('h_cerys', 'sk_cerys'),
            inst('h_m1', 'sk_clan_drummond_shield_maiden'),
            inst('h_pirate', 'sk_clan_dimun_pirate'),
          ],
          deck: [inst('d_m2', 'sk_clan_drummond_shield_maiden')],
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_h', 'nr_ves')],
          rows: {
            ...state.players.PLAYER_2.rows,
            SIEGE: { cards: [inst('p2_treb', 'nr_trebuchet'), inst('p2_bal', 'nr_ballista')], hornCard: null, totalStrength: 0 }, // 6 each -> 12
          },
        },
      },
    });

    // Playing Cerys summons both Maidens (4*2 + 4*2 = 16 + 10 Cerys = 26)
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'h_cerys' });
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards.map((c) => c.definitionId)).toEqual([
      'sk_cerys',
      'sk_clan_drummond_shield_maiden',
      'sk_clan_drummond_shield_maiden',
    ]);
    expect(state.players.PLAYER_1.totalScore).toBe(26);

    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_h' });

    // Maidens are effective strength 8 (highest vulnerable on board), Pirate destroys both 8-strength Maidens on P1 board OR let's clear Pirate 6 vs 10 enemy:
    // Actually Maidens are currently 8 (> Pirate 6, > Enemy 6), verifying global unit Scorch evaluates all sides!
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'h_pirate' });
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['h_m1', 'd_m2']);
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.instanceId)).toEqual(['h_pirate']);
  });

  it('activates Skellige Storm (fog + rain) cleanly and deduplicates single discard on clear or round end', () => {
    let state = createSkelligeMatch(null, null, 33);
    state = recalculateBoard({
      ...state,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...state.players.PLAYER_1,
          hand: [inst('h_storm', 'sp_skellige_storm')],
          discard: [],
          rows: {
            CLOSE_COMBAT: { cards: [], hornCard: null, totalStrength: 0 },
            RANGED: { cards: [inst('p1_r', 'nr_crinfrid_reavers')], hornCard: null, totalStrength: 0 },
            SIEGE: { cards: [inst('p1_s', 'nr_ballista')], hornCard: null, totalStrength: 0 },
          },
        },
        PLAYER_2: {
          ...state.players.PLAYER_2,
          hand: [inst('p2_clear', 'sp_clear_weather')],
          rows: {
            CLOSE_COMBAT: { cards: [], hornCard: null, totalStrength: 0 },
            RANGED: { cards: [inst('p2_r', 'ng_black_infantry_archer')], hornCard: null, totalStrength: 0 },
            SIEGE: { cards: [inst('p2_s', 'nr_trebuchet')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });

    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'h_storm' });
    expect(state.weather.frost).toBeNull();
    expect(state.weather.fog?.card.instanceId).toBe('h_storm');
    expect(state.weather.rain?.card.instanceId).toBe('h_storm');
    expect(state.players.PLAYER_1.totalScore).toBe(2);
    expect(state.players.PLAYER_2.totalScore).toBe(2);

    // Clearing weather sends Storm to P1 discard ONCE, never twice
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_clear' });
    expect(state.weather).toEqual({ frost: null, fog: null, rain: null });
    expect(state.players.PLAYER_1.discard.map((c) => c.instanceId)).toEqual(['h_storm']);
    expect(state.players.PLAYER_2.discard.map((c) => c.instanceId)).toEqual(['p2_clear']);
  });

  it('supports Crach an Craite shuffle-discards and King Bran half weather penalty (+ cancellation)', () => {
    // 1. Crach an Craite shuffles both discards back into decks
    let crachState = createSkelligeMatch('sk_leader_crach_an_craite', null, 44);
    crachState = {
      ...crachState,
      activePlayer: 'PLAYER_1',
      players: {
        PLAYER_1: {
          ...crachState.players.PLAYER_1,
          deck: [inst('p1_d', 'sk_svanrige')],
          discard: [inst('p1_disc1', 'sk_donar_an_hindar'), inst('p1_disc2', 'sk_udalryk')],
        },
        PLAYER_2: {
          ...crachState.players.PLAYER_2,
          deck: [],
          discard: [inst('p2_disc1', 'nr_ves')],
        },
      },
    };
    expect(canUseLeader(crachState, 'PLAYER_1')).toBe(true);
    crachState = dispatch(crachState, { type: 'USE_LEADER', playerId: 'PLAYER_1' });
    expect(crachState.players.PLAYER_1.discard).toHaveLength(0);
    expect(crachState.players.PLAYER_2.discard).toHaveLength(0);
    expect(crachState.players.PLAYER_1.deck).toHaveLength(3);
    expect(crachState.players.PLAYER_2.deck).toHaveLength(1);

    // 2. King Bran halves weather loss rounded up (only for owner), unless cancelled by Emhyr White Flame
    let branState = createSkelligeMatch('sk_leader_king_bran', null, 55);
    expect(branState.players.PLAYER_1.leaderUsed).toBe(true);
    expect(isPlayerPassiveLeaderActive(branState, 'PLAYER_1', 'HALF_WEATHER_PENALTY')).toBe(true);

    branState = recalculateBoard({
      ...branState,
      weather: {
        frost: { card: inst('w_frost', 'sp_biting_frost'), owner: 'PLAYER_2' },
        fog: null,
        rain: null,
      },
      players: {
        PLAYER_1: {
          ...branState.players.PLAYER_1,
          rows: {
            ...branState.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_u', 'sk_olaf')], hornCard: null, totalStrength: 0 }, // 12 -> ceil(12/2) = 6
          },
        },
        PLAYER_2: {
          ...branState.players.PLAYER_2,
          rows: {
            ...branState.players.PLAYER_2.rows,
            CLOSE_COMBAT: { cards: [inst('p2_u', 'nr_ves')], hornCard: null, totalStrength: 0 }, // 5 -> 1
          },
        },
      },
    });
    expect(branState.players.PLAYER_1.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(6);
    expect(branState.players.PLAYER_2.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(1);

    // Also verify odd baseStrength rounds up: 5 -> ceil(5/2) = 3
    branState = recalculateBoard({
      ...branState,
      players: {
        ...branState.players,
        PLAYER_1: {
          ...branState.players.PLAYER_1,
          rows: {
            ...branState.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_u5', 'nr_ves')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });
    expect(branState.players.PLAYER_1.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(3);

    // Cancelled by White Flame -> reverts to 1
    let branCancelled = createSkelligeMatch('sk_leader_king_bran', 'ng_leader_emhyr_white_flame', 55);
    expect(isPlayerPassiveLeaderActive(branCancelled, 'PLAYER_1', 'HALF_WEATHER_PENALTY')).toBe(false);
    branCancelled = recalculateBoard({
      ...branCancelled,
      weather: {
        frost: { card: inst('w_frost', 'sp_biting_frost'), owner: 'PLAYER_2' },
        fog: null,
        rain: null,
      },
      players: {
        ...branCancelled.players,
        PLAYER_1: {
          ...branCancelled.players.PLAYER_1,
          rows: {
            ...branCancelled.players.PLAYER_1.rows,
            CLOSE_COMBAT: { cards: [inst('p1_u5c', 'nr_ves')], hornCard: null, totalStrength: 0 },
          },
        },
      },
    });
    expect(branCancelled.players.PLAYER_1.rows.CLOSE_COMBAT.cards[0]?.effectiveStrength).toBe(1);
  });
});
