import { ROW_TYPES, type RowType } from '../models/types';
import type { CardInstance } from '../models/types';
import type { GameState, PlayerState, RowState, WeatherState } from '../models/game-state';
import { isPassiveLeaderActive } from '../abilities/passive-leaders';

const ROW_TO_WEATHER_KEY: Readonly<Record<RowType, keyof WeatherState>> = {
  CLOSE_COMBAT: 'frost',
  RANGED: 'fog',
  SIEGE: 'rain',
};

/**
 * Checks whether the corresponding weather effect is active for a row type.
 */
export function isWeatherActiveForRow(weather: WeatherState, rowType: RowType): boolean {
  const weatherKey = ROW_TO_WEATHER_KEY[rowType];
  return weather[weatherKey] !== null;
}

function countByBondGroup(cards: readonly CardInstance[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const instance of cards) {
    if (!instance.card.isHero && instance.card.ability === 'TIGHT_BOND' && instance.card.bondGroup) {
      const group = instance.card.bondGroup;
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }
  return counts;
}

function calculateUnitStrength(
  instance: CardInstance,
  weatherActive: boolean,
  bondCounts: ReadonlyMap<string, number>,
  moraleCount: number,
  hornUnitCount: number,
  hasHornCard: boolean,
  doubleSpyStrength: boolean,
): number {
  const { card } = instance;
  if (card.isHero) {
    return card.baseStrength;
  }
  if (card.ability === 'DECOY') {
    return 0;
  }

  // Step 1 & 2: Base strength or reduced to 1 under active weather
  let value = weatherActive ? 1 : card.baseStrength;

  // Step 2b: Passive leader Eredin the Treacherous doubles non-Hero Spy strength on both sides
  if (doubleSpyStrength && card.ability === 'SPY') {
    value *= 2;
  }

  // Step 3: Tight Bond multiplies by matching group units in the row
  if (card.ability === 'TIGHT_BOND' && card.bondGroup) {
    const groupCount = bondCounts.get(card.bondGroup) ?? 1;
    value *= groupCount;
  }

  // Step 4: Morale Boost adds +1 for every other Morale Boost unit in the row
  const selfMorale = card.ability === 'MORALE_BOOST' ? 1 : 0;
  value += Math.max(0, moraleCount - selfMorale);

  // Step 5: Commander's Horn doubles (x2 cap), never self-doubling via unit ability alone
  const isSelfHornUnit = card.type === 'UNIT' && card.ability === 'COMMANDERS_HORN';
  const hasOtherHornUnit = hornUnitCount - (isSelfHornUnit ? 1 : 0) > 0;
  if (hasHornCard || hasOtherHornUnit) {
    value *= 2;
  }

  return value;
}

/**
 * Recalculates effective strength for every unit in a row and the row total without mutating baseStrength.
 */
export function calculateRowStrength(
  row: RowState,
  weatherActive: boolean,
  doubleSpyStrength = false,
): RowState {
  const bondCounts = countByBondGroup(row.cards);
  let moraleCount = 0;
  let hornUnitCount = 0;

  for (const instance of row.cards) {
    if (instance.card.isHero) continue;
    if (instance.card.ability === 'MORALE_BOOST') {
      moraleCount++;
    }
    if (instance.card.type === 'UNIT' && instance.card.ability === 'COMMANDERS_HORN') {
      hornUnitCount++;
    }
  }

  const hasHornCard = row.hornCard !== null;
  let totalStrength = 0;

  const updatedCards = row.cards.map((instance) => {
    const effectiveStrength = calculateUnitStrength(
      instance,
      weatherActive,
      bondCounts,
      moraleCount,
      hornUnitCount,
      hasHornCard,
      doubleSpyStrength,
    );
    totalStrength += effectiveStrength;
    return {
      ...instance,
      effectiveStrength,
    };
  });

  return {
    ...row,
    cards: updatedCards,
    totalStrength,
  };
}

/**
 * Recalculates all three rows and total score for a single player.
 */
export function recalculatePlayer(
  player: PlayerState,
  weather: WeatherState,
  doubleSpyStrength = false,
): PlayerState {
  const closeRow = calculateRowStrength(
    player.rows.CLOSE_COMBAT,
    isWeatherActiveForRow(weather, 'CLOSE_COMBAT'),
    doubleSpyStrength,
  );
  const rangedRow = calculateRowStrength(
    player.rows.RANGED,
    isWeatherActiveForRow(weather, 'RANGED'),
    doubleSpyStrength,
  );
  const siegeRow = calculateRowStrength(
    player.rows.SIEGE,
    isWeatherActiveForRow(weather, 'SIEGE'),
    doubleSpyStrength,
  );

  const rows: Readonly<Record<RowType, RowState>> = {
    CLOSE_COMBAT: closeRow,
    RANGED: rangedRow,
    SIEGE: siegeRow,
  };

  let totalScore = 0;
  for (const rowType of ROW_TYPES) {
    totalScore += rows[rowType].totalStrength;
  }

  return {
    ...player,
    rows,
    totalScore,
  };
}

/**
 * Immutably recalculates effective strengths, row totals, and global player scores across the board.
 */
export function recalculateBoard(state: GameState): GameState {
  const doubleSpyStrength = isPassiveLeaderActive(state, 'DOUBLE_SPY_STRENGTH');

  return {
    ...state,
    players: {
      PLAYER_1: recalculatePlayer(state.players.PLAYER_1, state.weather, doubleSpyStrength),
      PLAYER_2: recalculatePlayer(state.players.PLAYER_2, state.weather, doubleSpyStrength),
    },
  };
}
