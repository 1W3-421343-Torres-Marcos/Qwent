export const QWENT_PHASE = 'F6' as const;

export type PlayerId = 'PLAYER_1' | 'PLAYER_2';

export type RowType = 'CLOSE_COMBAT' | 'RANGED' | 'SIEGE';

export const ROW_TYPES: readonly RowType[] = ['CLOSE_COMBAT', 'RANGED', 'SIEGE'];

export type FactionId =
  | 'NORTHERN_REALMS'
  | 'NILFGAARD'
  | 'MONSTERS'
  | 'SCOIATAEL'
  | 'NEUTRAL';

export type PlayableFactionId = Exclude<FactionId, 'NEUTRAL'>;

export const PLAYABLE_FACTIONS: readonly PlayableFactionId[] = [
  'NORTHERN_REALMS',
  'NILFGAARD',
  'MONSTERS',
  'SCOIATAEL',
];

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

export const LEADER_ABILITY_TYPES = [
  'PLAY_FROST_FROM_DECK',
  'PLAY_FOG_FROM_DECK',
  'PLAY_RAIN_FROM_DECK',
  'CLEAR_WEATHER_LEADER',
  'HORN_CLOSE_LEADER',
  'HORN_RANGED_LEADER',
  'HORN_SIEGE_LEADER',
  'SCORCH_ENEMY_CLOSE_10',
  'SCORCH_ENEMY_SIEGE_10',
  'REVIVE_OWN_DISCARD_TO_HAND',
  'STEAL_ENEMY_DISCARD_TO_HAND',
  'DRAW_EXTRA_CARD_START',
  'CANCEL_ENEMY_LEADER',
] as const;

export type LeaderAbilityType = (typeof LEADER_ABILITY_TYPES)[number];

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
