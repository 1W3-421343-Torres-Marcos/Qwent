export const AI_DIFFICULTIES = ['NOVICE', 'TAVERNER', 'MASTER'] as const;

export type AIDifficulty = (typeof AI_DIFFICULTIES)[number];

export const DEFAULT_AI_DIFFICULTY: AIDifficulty = 'TAVERNER';

export const AI_DIFFICULTY_LABELS: Readonly<Record<AIDifficulty, string>> = {
  NOVICE: 'Novato',
  TAVERNER: 'Tabernero',
  MASTER: 'Maestro',
};

/**
 * Checks whether a deserialized value is a supported AI difficulty preset.
 */
export function isValidAIDifficulty(value: unknown): value is AIDifficulty {
  return typeof value === 'string' && AI_DIFFICULTIES.includes(value as AIDifficulty);
}
