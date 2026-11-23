export const QWENT_PHASE = 'F4' as const;

export type PlayerId = 'PLAYER_1' | 'PLAYER_2';

export type RowType = 'CLOSE_COMBAT' | 'RANGED' | 'SIEGE';

export const ROW_TYPES: readonly RowType[] = ['CLOSE_COMBAT', 'RANGED', 'SIEGE'];

export type FactionId =
  | 'NORTHERN_REALMS'
  | 'NILFGAARD'
  | 'MONSTERS'
  | 'SCOIATAEL'
  | 'NEUTRAL';

export type CardType = 'UNIT' | 'SPECIAL' | 'LEADER';

export type AbilityType =
  | 'TIGHT_BOND'
  | 'MORALE_BOOST'
  | 'SPY'
  | 'MEDIC'
  | 'MUSTER'
  | 'SCORCH'
  | 'SCORCH_ROW'
  | 'DECOY'
  | 'COMMANDERS_HORN'
  | 'WEATHER_FROST'
  | 'WEATHER_FOG'
  | 'WEATHER_RAIN'
  | 'WEATHER_CLEAR';

export const ABILITY_TYPES: readonly AbilityType[] = [
  'TIGHT_BOND',
  'MORALE_BOOST',
  'SPY',
  'MEDIC',
  'MUSTER',
  'SCORCH',
  'SCORCH_ROW',
  'DECOY',
  'COMMANDERS_HORN',
  'WEATHER_FROST',
  'WEATHER_FOG',
  'WEATHER_RAIN',
  'WEATHER_CLEAR',
];

export type LeaderAbilityType = string;

export interface CardDefinition {
  readonly id: string;
  readonly name: string;
  readonly faction: FactionId;
  readonly type: CardType;
  readonly baseStrength: number;
  readonly isHero: boolean;
  readonly allowedRows: readonly RowType[];
  readonly ability: AbilityType | null;
  readonly bondGroup?: string;
  readonly musterGroup?: string;
  readonly leaderAbility?: LeaderAbilityType;
  readonly maxCopies: number;
  readonly description: string;
}

export interface CardInstance {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly card: CardDefinition;
  readonly effectiveStrength: number;
}

export interface StarterDeckDefinition {
  readonly id: string;
  readonly name: string;
  readonly faction: Exclude<FactionId, 'NEUTRAL'>;
  readonly leaderId: string | null;
  readonly cardIds: readonly string[];
}
