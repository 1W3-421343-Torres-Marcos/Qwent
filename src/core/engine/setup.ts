import { ROW_TYPES, type CardDefinition, type CardInstance, type FactionId, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState, RowState, WeatherState } from '../models/game-state';
import { nextRng, shuffleDeterministic } from './prng';

export interface PlayerSetupConfig {
  readonly id?: PlayerId;
  readonly name: string;
  readonly faction: Exclude<FactionId, 'NEUTRAL'>;
  readonly leader?: CardDefinition | null;
  readonly deckCardIds: readonly string[];
}

export interface MatchSetupConfig {
  readonly player1: PlayerSetupConfig;
  readonly player2: PlayerSetupConfig;
  readonly catalog: readonly CardDefinition[];
  readonly rngSeed: number;
}

const INITIAL_HAND_SIZE = 10;
const INITIAL_GEMS = 2;

export function createEmptyRows(): Readonly<Record<RowType, RowState>> {
  return {
    CLOSE_COMBAT: { cards: [], hornCard: null, totalStrength: 0 },
    RANGED: { cards: [], hornCard: null, totalStrength: 0 },
    SIEGE: { cards: [], hornCard: null, totalStrength: 0 },
  };
}

export function createEmptyWeather(): WeatherState {
  return {
    frost: null,
    fog: null,
    rain: null,
  };
}

function buildDeckInstances(
  playerId: PlayerId,
  cardIds: readonly string[],
  catalogById: ReadonlyMap<string, CardDefinition>,
): readonly CardInstance[] {
  return cardIds.map((definitionId, index) => {
    const card = catalogById.get(definitionId);
    if (!card) {
      throw new Error(`Carta desconocida "${definitionId}" al inicializar mazo de ${playerId}.`);
    }
    return {
      instanceId: `${playerId}_${index + 1}_${card.id}`,
      definitionId: card.id,
      card,
      effectiveStrength: card.baseStrength,
    };
  });
}

function initializePlayerState(
  playerId: PlayerId,
  config: PlayerSetupConfig,
  catalogById: ReadonlyMap<string, CardDefinition>,
  seed: number,
): { readonly player: PlayerState; readonly nextSeed: number } {
  const rawDeck = buildDeckInstances(playerId, config.deckCardIds, catalogById);
  const shuffled = shuffleDeterministic(rawDeck, seed);
  const hand = shuffled.items.slice(0, INITIAL_HAND_SIZE);
  const deck = shuffled.items.slice(INITIAL_HAND_SIZE);

  return {
    player: {
      id: playerId,
      name: config.name,
      faction: config.faction,
      leader: config.leader ?? null,
      leaderUsed: false,
      gems: INITIAL_GEMS,
      passed: false,
      hand,
      deck,
      discard: [],
      rows: createEmptyRows(),
      totalScore: 0,
      mulligansRemaining: 0,
    },
    nextSeed: shuffled.nextSeed,
  };
}

/**
 * Creates a clean initial GameState with shuffled decks, 10-card hands, 2 gems, and deterministic R1 coin flip.
 */
export function createInitialGameState(config: MatchSetupConfig): GameState {
  const catalogById = new Map(config.catalog.map((card) => [card.id, card]));

  const p1Init = initializePlayerState('PLAYER_1', config.player1, catalogById, config.rngSeed);
  const p2Init = initializePlayerState('PLAYER_2', config.player2, catalogById, p1Init.nextSeed);
  const coinFlip = nextRng(p2Init.nextSeed);
  const startingPlayer: PlayerId = coinFlip.value < 0.5 ? 'PLAYER_1' : 'PLAYER_2';

  // Touch ROW_TYPES to guarantee deterministic ordering invariant if needed
  void ROW_TYPES;

  return {
    phase: 'PLAYING',
    roundNumber: 1,
    activePlayer: startingPlayer,
    rngSeed: coinFlip.nextSeed,
    players: {
      PLAYER_1: p1Init.player,
      PLAYER_2: p2Init.player,
    },
    weather: createEmptyWeather(),
    pendingSelection: null,
    roundHistory: [],
    winner: null,
  };
}
