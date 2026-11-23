import { ROW_TYPES, type CardDefinition, type CardInstance, type FactionId, type PlayerId, type RowType } from '../models/types';
import type { GameState, PlayerState, RowState, WeatherState } from '../models/game-state';
import { resolveRound1StartState } from '../abilities/factions';
import { applyPassiveStartLeaders } from '../abilities/leaders';
import { shuffleDeterministic } from './prng';

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
  readonly skipMulligan?: boolean;
}

const INITIAL_HAND_SIZE = 10;
const INITIAL_GEMS = 2;
const MAX_MULLIGANS = 2;

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
  skipMulligan: boolean,
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
      mulligansRemaining: skipMulligan ? 0 : MAX_MULLIGANS,
      mulliganDone: skipMulligan,
    },
    nextSeed: shuffled.nextSeed,
  };
}

/**
 * Creates a clean initial GameState with shuffled decks, 10-card hands, 2 gems,
 * and either initial MULLIGAN phase (default) or PLAYING with deterministic R1 coin flip.
 */
export function createInitialGameState(config: MatchSetupConfig): GameState {
  const catalogById = new Map(config.catalog.map((card) => [card.id, card]));
  const skipMulligan = config.skipMulligan ?? false;

  const p1Init = initializePlayerState('PLAYER_1', config.player1, catalogById, config.rngSeed, skipMulligan);
  const p2Init = initializePlayerState('PLAYER_2', config.player2, catalogById, p1Init.nextSeed, skipMulligan);
  const withStartLeaders = applyPassiveStartLeaders(p1Init.player, p2Init.player);

  void ROW_TYPES;

  const baseState: GameState = {
    phase: 'MULLIGAN',
    roundNumber: 1,
    activePlayer: 'PLAYER_1',
    rngSeed: p2Init.nextSeed,
    players: {
      PLAYER_1: withStartLeaders.p1,
      PLAYER_2: withStartLeaders.p2,
    },
    weather: createEmptyWeather(),
    pendingSelection: null,
    roundHistory: [],
    winner: null,
  };

  if (skipMulligan) {
    return resolveRound1StartState(baseState);
  }

  return baseState;
}
