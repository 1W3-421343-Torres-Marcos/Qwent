import { describe, expect, it } from 'vitest';
import rawCards from '../../../assets/data/cards.json';
import rawDecks from '../../../assets/data/starter-decks.json';
import {
  createInitialGameState,
  dispatch,
  type CardDefinition,
  type FactionId,
  type GameState,
  type StarterDeckDefinition,
} from '../../index';

const catalog = rawCards as readonly CardDefinition[];
const decks = rawDecks as readonly StarterDeckDefinition[];

function setupCowMatch(p1Faction: FactionId = 'NORTHERN_REALMS'): GameState {
  const cowDef = catalog.find((c) => c.id === 'nt_cow')!;
  const vesDef = catalog.find((c) => c.id === 'nr_ves')!;
  const deck1 = decks[0]!;
  const deck2 = decks[1]!;

  const base = createInitialGameState({
    rngSeed: 101,
    catalog,
    skipMulligan: true,
    player1: {
      name: 'J1',
      faction: p1Faction,
      leader: null,
      deckCardIds: deck1.cardIds,
    },
    player2: {
      name: 'J2',
      faction: 'NILFGAARD',
      leader: null,
      deckCardIds: deck2.cardIds,
    },
  });

  return {
    ...base,
    activePlayer: 'PLAYER_1',
    players: {
      ...base.players,
      PLAYER_1: {
        ...base.players.PLAYER_1,
        hand: [
          { instanceId: 'p1_cow', definitionId: cowDef.id, card: cowDef, effectiveStrength: 0 },
          { instanceId: 'p1_ves', definitionId: vesDef.id, card: vesDef, effectiveStrength: 5 },
        ],
      },
      PLAYER_2: {
        ...base.players.PLAYER_2,
        hand: [
          { instanceId: 'p2_ves', definitionId: vesDef.id, card: vesDef, effectiveStrength: 5 },
        ],
      },
    },
  };
}

describe('Cow Avenger Rule (nt_cow -> Bovine Defense Force, U2.4)', () => {
  it('spawns Bovine Defense Force (strength 8) in CLOSE_COMBAT for Round 2 when Cow goes to discard', () => {
    let state = setupCowMatch('NORTHERN_REALMS');

    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_cow' });
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.definitionId)).toContain('nt_cow');
    expect(state.players.PLAYER_1.totalScore).toBe(0);

    // P2 wins Round 1 (5 vs 0) -> P1 loses 1 gem -> ADVANCE_ROUND
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_ves' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });
    expect(state.phase).toBe('ROUND_END');

    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.phase).toBe('PLAYING');
    expect(state.roundNumber).toBe(2);

    // Cow went to discard; Chort (nt_bovine_defense_force, strength 8) entered CLOSE_COMBAT
    expect(state.players.PLAYER_1.discard.map((c) => c.definitionId)).toContain('nt_cow');
    const closeCards = state.players.PLAYER_1.rows.CLOSE_COMBAT.cards;
    expect(closeCards).toHaveLength(1);
    expect(closeCards[0]!.definitionId).toBe('nt_bovine_defense_force');
    expect(closeCards[0]!.effectiveStrength).toBe(8);
    expect(state.players.PLAYER_1.totalScore).toBe(8);
  });

  it('does not spawn Chort prematurely if Monsters carryover keeps Cow itself on the board', () => {
    let state = setupCowMatch('MONSTERS');

    // Only Cow on Monsters board -> Monsters passive guarantees Cow stays on RANGED
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_1', instanceId: 'p1_cow' });
    state = dispatch(state, { type: 'PLAY_CARD', playerId: 'PLAYER_2', instanceId: 'p2_ves' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_1' });
    state = dispatch(state, { type: 'PASS_TURN', playerId: 'PLAYER_2' });

    state = dispatch(state, { type: 'ADVANCE_ROUND' });
    expect(state.players.PLAYER_1.rows.RANGED.cards.map((c) => c.definitionId)).toEqual(['nt_cow']);
    expect(state.players.PLAYER_1.rows.CLOSE_COMBAT.cards).toHaveLength(0);
    expect(state.players.PLAYER_1.discard.map((c) => c.definitionId)).not.toContain('nt_cow');
  });
});
