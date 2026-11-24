import { ROW_TYPES, type AbilityType, type CardInstance, type LeaderAbilityType, type PlayerId, type RowType } from '../models/types';
import type { GameAction } from '../models/actions';
import type { PlayerState, RowState, WeatherState } from '../models/game-state';
import { isScorchVulnerable, isValidDecoyTarget } from '../abilities/ability-resolver';
import { optimizeAgilePlayerRows } from '../abilities/leaders';
import { calculateRowStrength, isWeatherActiveForRow } from '../scoring/calculate-strength';
import type { AIPlayerView } from './ai-view';

export interface ScoredPlayCandidate {
  readonly action: Extract<GameAction, { type: 'PLAY_CARD' | 'USE_LEADER' }>;
  readonly tacticalScore: number;
  readonly netPointSwing: number;
}

const WEATHER_KEY_BY_ABILITY: Readonly<Partial<Record<AbilityType, keyof WeatherState>>> = {
  WEATHER_FROST: 'frost',
  WEATHER_FOG: 'fog',
  WEATHER_RAIN: 'rain',
};

const WEATHER_ROW_BY_ABILITY: Readonly<Partial<Record<AbilityType, RowType>>> = {
  WEATHER_FROST: 'CLOSE_COMBAT',
  WEATHER_FOG: 'RANGED',
  WEATHER_RAIN: 'SIEGE',
};

function sumRowTotals(
  rows: Readonly<Record<RowType, RowState>>,
  weather: WeatherState,
  doubleSpyStrength = false,
): number {
  let total = 0;
  for (const rowType of ROW_TYPES) {
    total += calculateRowStrength(
      rows[rowType],
      isWeatherActiveForRow(weather, rowType),
      doubleSpyStrength,
    ).totalStrength;
  }
  return total;
}

function countHandWeatherDuplicates(hand: readonly CardInstance[]): ReadonlyMap<AbilityType, number> {
  const counts = new Map<AbilityType, number>();
  for (const c of hand) {
    if (
      c.card.ability === 'WEATHER_FROST' ||
      c.card.ability === 'WEATHER_FOG' ||
      c.card.ability === 'WEATHER_RAIN'
    ) {
      counts.set(c.card.ability, (counts.get(c.card.ability) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Selects a sub-optimal card instanceId to swap during MULLIGAN, or null to keep hand.
 */
export function pickMulliganSwap(view: AIPlayerView): string | null {
  if (view.me.mulligansRemaining <= 0 || view.me.myDeckCount <= 0) {
    return null;
  }

  const hand = view.me.hand;
  const musterCounts = new Map<string, number>();
  for (const c of hand) {
    if (c.card.ability === 'MUSTER' && c.card.musterGroup) {
      musterCounts.set(c.card.musterGroup, (musterCounts.get(c.card.musterGroup) ?? 0) + 1);
    }
  }

  // 1. Excess Muster copies in hand (playing 1 already summons the rest)
  const extraMuster = hand.find(
    (c) => c.card.ability === 'MUSTER' && c.card.musterGroup && (musterCounts.get(c.card.musterGroup) ?? 0) > 1,
  );
  if (extraMuster) {
    return extraMuster.instanceId;
  }

  // 2. Duplicate weather cards
  const weatherCounts = countHandWeatherDuplicates(hand);
  const dupWeather = hand.find(
    (c) => c.card.ability !== null && (weatherCounts.get(c.card.ability) ?? 0) > 1,
  );
  if (dupWeather) {
    return dupWeather.instanceId;
  }

  // 3. Weakest vanilla unit <= 2 strength
  const weakVanilla = [...hand]
    .filter((c) => c.card.type === 'UNIT' && !c.card.isHero && c.card.ability === null && c.card.baseStrength <= 2)
    .sort((a, b) => a.card.baseStrength - b.card.baseStrength)[0];
  if (weakVanilla) {
    return weakVanilla.instanceId;
  }

  return null;
}

function scoreDiscardCandidate(view: AIPlayerView, candidate: CardInstance): number {
  let score = candidate.card.baseStrength;
  if (candidate.card.ability === 'SPY') {
    score = 26 + (view.me.myDeckCount >= 2 ? 18 : view.me.myDeckCount * 7) - candidate.card.baseStrength;
  } else if (candidate.card.ability === 'MEDIC') {
    score += 14;
  } else if (candidate.card.ability === 'SCORCH_ROW') {
    const mirrorRow = view.opponent.rows[candidate.card.allowedRows[0]!];
    score += mirrorRow.totalStrength >= 10 ? 20 : 2;
  } else if (candidate.card.ability === 'MUSTER' && candidate.card.musterGroup) {
    const hasDeckMatch = view.me.myDeckCardIds.length > 0;
    score += hasDeckMatch ? 8 : 0;
  } else if (candidate.card.ability === 'TIGHT_BOND' && candidate.card.bondGroup) {
    const row = view.me.rows[candidate.card.allowedRows[0]!];
    const mates = row.cards.filter((u) => u.card.bondGroup === candidate.card.bondGroup).length;
    score += mates * candidate.card.baseStrength * 2;
  } else if (candidate.card.ability === 'COMMANDERS_HORN') {
    score += 8;
  }
  return score;
}

function pickBestDiscardUnit(
  view: AIPlayerView,
  pool: readonly CardInstance[],
  eligibleIds: readonly string[],
): string {
  const eligible = pool.filter((c) => eligibleIds.includes(c.instanceId));
  let best = eligible[0]!;
  let bestScore = -Infinity;

  for (const candidate of eligible) {
    const score = scoreDiscardCandidate(view, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best.instanceId;
}

/**
 * Picks the best unit to revive from discard during MEDIC_DISCARD pending selection.
 */
export function pickMedicTarget(view: AIPlayerView, eligibleIds: readonly string[]): string {
  return pickBestDiscardUnit(view, view.me.discard, eligibleIds);
}

/**
 * Picks the best discard unit for LEADER_TARGET (own or opponent discard).
 */
export function pickLeaderDiscardTarget(
  view: AIPlayerView,
  source: 'OWN_DISCARD' | 'OPPONENT_DISCARD',
  eligibleIds: readonly string[],
): string {
  const pool = source === 'OWN_DISCARD' ? view.me.discard : view.opponent.discard;
  return pickBestDiscardUnit(view, pool, eligibleIds);
}

/**
 * Selects Round 1 starter when the bot controls Scoia'tael: forces opponent to open for card advantage.
 */
export function pickScoiataelStarter(view: AIPlayerView): PlayerId {
  return view.opponent.id;
}

/**
 * Picks the strongest allowed row for an Agile unit (considering weather and row synergies).
 */
export function pickAgileRow(
  view: AIPlayerView,
  card: CardInstance,
  allowedRows: readonly RowType[],
): RowType {
  let bestRow = allowedRows[0]!;
  let bestDelta = -Infinity;

  for (const rowType of allowedRows) {
    const currentRow = view.me.rows[rowType];
    const weatherActive = isWeatherActiveForRow(view.weather, rowType);
    const simulatedRow = calculateRowStrength(
      { ...currentRow, cards: [...currentRow.cards, card] },
      weatherActive,
      view.doubleSpyStrength,
    );
    const delta = simulatedRow.totalStrength - currentRow.totalStrength;
    if (delta > bestDelta) {
      bestDelta = delta;
      bestRow = rowType;
    }
  }

  return bestRow;
}

function evaluateScorchGlobal(view: AIPlayerView): number {
  let maxStrength = 0;
  for (const sideRows of [view.me.rows, view.opponent.rows]) {
    for (const rowType of ROW_TYPES) {
      for (const unit of sideRows[rowType].cards) {
        if (isScorchVulnerable(unit) && unit.effectiveStrength > maxStrength) {
          maxStrength = unit.effectiveStrength;
        }
      }
    }
  }

  if (maxStrength <= 0) {
    return -40;
  }

  let ownLoss = 0;
  let oppLoss = 0;
  for (const rowType of ROW_TYPES) {
    for (const unit of view.me.rows[rowType].cards) {
      if (isScorchVulnerable(unit) && unit.effectiveStrength === maxStrength) {
        ownLoss += unit.effectiveStrength;
      }
    }
    for (const unit of view.opponent.rows[rowType].cards) {
      if (isScorchVulnerable(unit) && unit.effectiveStrength === maxStrength) {
        oppLoss += unit.effectiveStrength;
      }
    }
  }

  const net = oppLoss - ownLoss;
  return net > 0 ? net * 1.45 : -50;
}

function evaluateWeatherCard(view: AIPlayerView, ability: AbilityType): { score: number; swing: number } {
  const weatherKey = WEATHER_KEY_BY_ABILITY[ability];
  const rowType = WEATHER_ROW_BY_ABILITY[ability];
  if (!weatherKey || !rowType || view.weather[weatherKey] !== null) {
    return { score: -100, swing: 0 };
  }

  const oppBefore = view.opponent.rows[rowType].totalStrength;
  const meBefore = view.me.rows[rowType].totalStrength;
  const oppAfter = calculateRowStrength(
    view.opponent.rows[rowType],
    true,
    view.doubleSpyStrength,
  ).totalStrength;
  const meAfter = calculateRowStrength(
    view.me.rows[rowType],
    true,
    view.doubleSpyStrength,
  ).totalStrength;

  const swing = oppBefore - oppAfter - (meBefore - meAfter);
  return {
    score: swing > 2 ? swing * 1.25 : -30,
    swing,
  };
}

function evaluateClearWeather(view: AIPlayerView): { score: number; swing: number } {
  if (view.weather.frost === null && view.weather.fog === null && view.weather.rain === null) {
    return { score: -100, swing: 0 };
  }

  const clearWeather: WeatherState = { frost: null, fog: null, rain: null };
  const myAfter = sumRowTotals(view.me.rows, clearWeather, view.doubleSpyStrength);
  const oppAfter = sumRowTotals(view.opponent.rows, clearWeather, view.doubleSpyStrength);
  const swing = myAfter - view.me.totalScore - (oppAfter - view.opponent.totalScore);

  return {
    score: swing > 2 ? swing * 1.25 : -30,
    swing,
  };
}

function evaluateDecoyTarget(view: AIPlayerView, target: CardInstance): { score: number; swing: number } {
  const lostStrength = target.effectiveStrength;
  if (target.card.ability === 'SPY') {
    return { score: 34 - lostStrength * 0.2, swing: -lostStrength };
  }
  if (target.card.ability === 'MEDIC' && view.me.discard.some((c) => c.card.type === 'UNIT' && !c.card.isHero)) {
    return { score: 20 - lostStrength * 0.4, swing: -lostStrength };
  }
  if (target.card.ability === 'SCORCH_ROW' && view.opponent.rows.CLOSE_COMBAT.totalStrength >= 10) {
    return { score: 18 - lostStrength * 0.3, swing: -lostStrength };
  }
  return { score: -15 - lostStrength, swing: -lostStrength };
}

function scoreUnitPlacement(view: AIPlayerView, instance: CardInstance, targetRow: RowType): ScoredPlayCandidate {
  const { card } = instance;
  if (card.ability === 'SPY') {
    const oppRow = view.opponent.rows[targetRow];
    const oppSimulated = calculateRowStrength(
      { ...oppRow, cards: [...oppRow.cards, instance] },
      isWeatherActiveForRow(view.weather, targetRow),
      view.doubleSpyStrength,
    );
    const oppGain = oppSimulated.totalStrength - oppRow.totalStrength;
    const drawBonus = view.me.myDeckCount >= 2 ? 26 : view.me.myDeckCount * 10;
    const roundFactor = view.roundNumber <= 2 ? 6 : 0;
    return {
      action: { type: 'PLAY_CARD', playerId: view.me.id, instanceId: instance.instanceId, targetRow },
      tacticalScore: drawBonus + roundFactor - oppGain * 0.7,
      netPointSwing: -oppGain,
    };
  }

  const currentRow = view.me.rows[targetRow];
  const weatherActive = isWeatherActiveForRow(view.weather, targetRow);
  const simulated = calculateRowStrength(
    { ...currentRow, cards: [...currentRow.cards, instance] },
    weatherActive,
    view.doubleSpyStrength,
  );
  const rowGain = simulated.totalStrength - currentRow.totalStrength;
  let score = rowGain;

  if (card.ability === 'MUSTER' && card.musterGroup) {
    const extraHand = view.me.hand.filter(
      (c) => c.instanceId !== instance.instanceId && c.card.musterGroup === card.musterGroup,
    ).length;
    score += extraHand * 4 + (view.me.myDeckCount > 0 ? 8 : 0);
  } else if (card.ability === 'MEDIC') {
    const hasMedicTarget = view.me.discard.some((c) => c.card.type === 'UNIT' && !c.card.isHero);
    score += hasMedicTarget ? 13 : -2;
  } else if (card.ability === 'SCORCH_ROW') {
    const mirror = view.opponent.rows[targetRow];
    if (mirror.totalStrength >= 10) {
      let maxOpp = 0;
      for (const u of mirror.cards) {
        if (isScorchVulnerable(u) && u.effectiveStrength > maxOpp) {
          maxOpp = u.effectiveStrength;
        }
      }
      score += maxOpp * 1.4;
    }
  }

  // In Round 1, mildly prefer preserving 10+ Hero cards when weaker plays suffice
  if (card.isHero && view.roundNumber === 1 && view.me.gems === 2) {
    score -= 2;
  }

  return {
    action: { type: 'PLAY_CARD', playerId: view.me.id, instanceId: instance.instanceId, targetRow },
    tacticalScore: score,
    netPointSwing: rowGain,
  };
}

function evaluateLeaderCandidate(view: AIPlayerView): ScoredPlayCandidate | null {
  if (!view.me.canUseLeader || !view.me.leader?.leaderAbility) {
    return null;
  }

  const ability: LeaderAbilityType = view.me.leader.leaderAbility;
  const action: Extract<GameAction, { type: 'USE_LEADER' }> = {
    type: 'USE_LEADER',
    playerId: view.me.id,
  };

  if (
    ability === 'HORN_CLOSE_LEADER' ||
    ability === 'HORN_RANGED_LEADER' ||
    ability === 'HORN_SIEGE_LEADER'
  ) {
    const rowType: RowType =
      ability === 'HORN_CLOSE_LEADER'
        ? 'CLOSE_COMBAT'
        : ability === 'HORN_RANGED_LEADER'
          ? 'RANGED'
          : 'SIEGE';
    const row = view.me.rows[rowType];
    const dummyHorn: CardInstance = {
      instanceId: 'eval_leader_horn',
      definitionId: 'leader_horn_effect',
      card: view.me.leader,
      effectiveStrength: 0,
    };
    const afterHorn = calculateRowStrength(
      { ...row, hornCard: dummyHorn },
      isWeatherActiveForRow(view.weather, rowType),
      view.doubleSpyStrength,
    );
    const gain = afterHorn.totalStrength - row.totalStrength;
    return {
      action,
      tacticalScore: gain >= 6 ? gain * 1.15 : -20,
      netPointSwing: gain,
    };
  }

  if (ability === 'CLEAR_WEATHER_LEADER') {
    const evalClear = evaluateClearWeather(view);
    return {
      action,
      tacticalScore: evalClear.score,
      netPointSwing: evalClear.swing,
    };
  }

  if (
    ability === 'PLAY_FROST_FROM_DECK' ||
    ability === 'PLAY_FOG_FROM_DECK' ||
    ability === 'PLAY_RAIN_FROM_DECK'
  ) {
    const mappedWeather: AbilityType =
      ability === 'PLAY_FROST_FROM_DECK'
        ? 'WEATHER_FROST'
        : ability === 'PLAY_FOG_FROM_DECK'
          ? 'WEATHER_FOG'
          : 'WEATHER_RAIN';
    const evalWeather = evaluateWeatherCard(view, mappedWeather);
    return {
      action,
      tacticalScore: evalWeather.score,
      netPointSwing: evalWeather.swing,
    };
  }

  if (
    ability === 'SCORCH_ENEMY_CLOSE_10' ||
    ability === 'SCORCH_ENEMY_RANGED_10' ||
    ability === 'SCORCH_ENEMY_SIEGE_10'
  ) {
    const rowType: RowType =
      ability === 'SCORCH_ENEMY_CLOSE_10'
        ? 'CLOSE_COMBAT'
        : ability === 'SCORCH_ENEMY_RANGED_10'
          ? 'RANGED'
          : 'SIEGE';
    const mirror = view.opponent.rows[rowType];
    if (mirror.totalStrength < 10) {
      return { action, tacticalScore: -35, netPointSwing: 0 };
    }
    let maxOpp = 0;
    for (const unit of mirror.cards) {
      if (isScorchVulnerable(unit) && unit.effectiveStrength > maxOpp) {
        maxOpp = unit.effectiveStrength;
      }
    }
    return {
      action,
      tacticalScore: maxOpp > 0 ? maxOpp * 1.4 : -35,
      netPointSwing: maxOpp,
    };
  }

  if (ability === 'OPTIMIZE_AGILE_ROWS') {
    const selfSnapshot: PlayerState = {
      id: view.me.id,
      name: 'bot',
      faction: view.me.faction,
      leader: view.me.leader,
      leaderUsed: view.me.leaderUsed,
      gems: view.me.gems,
      passed: view.me.passed,
      hand: view.me.hand,
      deck: [],
      discard: view.me.discard,
      rows: view.me.rows,
      totalScore: view.me.totalScore,
      mulligansRemaining: view.me.mulligansRemaining,
      mulliganDone: view.me.mulliganDone,
    };
    const optimized = optimizeAgilePlayerRows(selfSnapshot, view.weather, view.doubleSpyStrength);
    const gain = optimized.totalScore - view.me.totalScore;
    return {
      action,
      tacticalScore: gain > 0 ? gain * 1.35 : -35,
      netPointSwing: gain,
    };
  }

  if (ability === 'REVIVE_OWN_DISCARD_TO_HAND' || ability === 'STEAL_ENEMY_DISCARD_TO_HAND') {
    const pool =
      ability === 'REVIVE_OWN_DISCARD_TO_HAND' ? view.me.discard : view.opponent.discard;
    const eligible = pool.filter((c) => c.card.type === 'UNIT' && !c.card.isHero);
    if (eligible.length === 0) {
      return null;
    }
    let bestValue = 0;
    for (const candidate of eligible) {
      bestValue = Math.max(bestValue, scoreDiscardCandidate(view, candidate));
    }
    return {
      action,
      tacticalScore: 14 + bestValue * 0.65,
      netPointSwing: 0,
    };
  }

  return null;
}

/**
 * Generates and scores all legal PLAY_CARD and USE_LEADER candidates visible in AIPlayerView.
 */
export function generatePlayCandidates(view: AIPlayerView): readonly ScoredPlayCandidate[] {
  const candidates: ScoredPlayCandidate[] = [];
  const leaderCandidate = evaluateLeaderCandidate(view);
  if (leaderCandidate) {
    candidates.push(leaderCandidate);
  }

  for (const instance of view.me.hand) {
    const { card } = instance;
    if (card.type === 'UNIT') {
      for (const rowType of card.allowedRows) {
        candidates.push(scoreUnitPlacement(view, instance, rowType));
      }
      continue;
    }

    if (card.type === 'SPECIAL') {
      if (card.ability === 'COMMANDERS_HORN') {
        for (const rowType of ROW_TYPES) {
          const row = view.me.rows[rowType];
          if (row.hornCard !== null) continue;
          const afterHorn = calculateRowStrength(
            { ...row, hornCard: instance },
            isWeatherActiveForRow(view.weather, rowType),
            view.doubleSpyStrength,
          );
          const gain = afterHorn.totalStrength - row.totalStrength;
          candidates.push({
            action: { type: 'PLAY_CARD', playerId: view.me.id, instanceId: instance.instanceId, targetRow: rowType },
            tacticalScore: gain > 0 ? gain * 1.15 : -20,
            netPointSwing: gain,
          });
        }
      } else if (card.ability === 'DECOY') {
        for (const rowType of ROW_TYPES) {
          for (const unit of view.me.rows[rowType].cards) {
            if (!isValidDecoyTarget(unit)) continue;
            const evalResult = evaluateDecoyTarget(view, unit);
            candidates.push({
              action: {
                type: 'PLAY_CARD',
                playerId: view.me.id,
                instanceId: instance.instanceId,
                decoyTargetInstanceId: unit.instanceId,
              },
              tacticalScore: evalResult.score,
              netPointSwing: evalResult.swing,
            });
          }
        }
      } else if (card.ability === 'SCORCH') {
        const scorchScore = evaluateScorchGlobal(view);
        candidates.push({
          action: { type: 'PLAY_CARD', playerId: view.me.id, instanceId: instance.instanceId },
          tacticalScore: scorchScore,
          netPointSwing: Math.max(0, scorchScore),
        });
      } else if (card.ability === 'WEATHER_CLEAR') {
        const clearEval = evaluateClearWeather(view);
        candidates.push({
          action: { type: 'PLAY_CARD', playerId: view.me.id, instanceId: instance.instanceId },
          tacticalScore: clearEval.score,
          netPointSwing: clearEval.swing,
        });
      } else if (
        card.ability === 'WEATHER_FROST' ||
        card.ability === 'WEATHER_FOG' ||
        card.ability === 'WEATHER_RAIN'
      ) {
        const weatherEval = evaluateWeatherCard(view, card.ability);
        candidates.push({
          action: { type: 'PLAY_CARD', playerId: view.me.id, instanceId: instance.instanceId },
          tacticalScore: weatherEval.score,
          netPointSwing: weatherEval.swing,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.tacticalScore - a.tacticalScore);
}

/**
 * Evaluates whether the bot should pass the current round based on card advantage,
 * round context, and Nilfgaard tie-win passive awareness.
 */
export function shouldBotPass(
  view: AIPlayerView,
  bestCandidate: ScoredPlayCandidate | undefined,
): boolean {
  if (!bestCandidate) {
    return true;
  }

  const botWinsTie = view.me.faction === 'NILFGAARD' && view.opponent.faction !== 'NILFGAARD';
  const oppWinsTie = view.opponent.faction === 'NILFGAARD' && view.me.faction !== 'NILFGAARD';
  const scoreDiff = view.me.totalScore - view.opponent.totalScore;
  const isAhead = scoreDiff > 0 || (scoreDiff === 0 && botWinsTie);
  const isTrailing = scoreDiff < 0 || (scoreDiff === 0 && oppWinsTie);

  // Opponent already passed: simple mathematical & card-advantage resolution
  if (view.opponent.passed) {
    if (isAhead) {
      return true;
    }
    if (isTrailing && view.roundNumber === 1 && view.me.gems === 2) {
      const deficit = -scoreDiff + (oppWinsTie ? 1 : 0);
      const canPassLeadInOnePlay = bestCandidate.netPointSwing >= deficit;
      // If deficit is huge (> 15) and best play cannot catch up in 1 card, concede R1 to keep hand
      if (deficit > 15 && !canPassLeadInOnePlay) {
        return true;
      }
      // If all plays are negative/harmful (e.g. useless weather/scorch) -> pass
      if (bestCandidate.tacticalScore <= 0) {
        return true;
      }
    }
    // In elimination rounds (me.gems === 1 or R3), never pass while behind if any constructive play exists
    if (bestCandidate.tacticalScore <= 0 && bestCandidate.netPointSwing <= 0) {
      return true;
    }
    return false;
  }

  // Opponent has NOT passed yet:
  // Round 1: concede early if falling far behind (> 16 pts) without card-advantage play
  if (
    view.roundNumber === 1 &&
    view.me.gems === 2 &&
    scoreDiff < -16 &&
    view.me.hand.length <= view.opponent.handCount &&
    bestCandidate.tacticalScore < 18
  ) {
    return true;
  }

  // Round 2 after winning Round 1 (up 2 gems vs 1): preserve cards if behind in hand count
  if (
    view.roundNumber === 2 &&
    view.me.gems === 2 &&
    view.opponent.gems === 1 &&
    view.me.hand.length < view.opponent.handCount &&
    view.me.totalScore > 0 &&
    bestCandidate.tacticalScore < 15
  ) {
    return true;
  }

  return false;
}
