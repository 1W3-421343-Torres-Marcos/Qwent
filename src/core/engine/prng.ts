export interface RngStep {
  readonly value: number;
  readonly nextSeed: number;
}

export interface ShuffleResult<T> {
  readonly items: readonly T[];
  readonly nextSeed: number;
}

/**
 * Generates the next deterministic pseudo-random number in [0, 1) using Mulberry32.
 */
export function nextRng(seed: number): RngStep {
  const nextSeed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(nextSeed ^ (nextSeed >>> 15), 1 | nextSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextSeed };
}

/**
 * Returns a shuffled copy of `items` using deterministic Fisher-Yates and `nextRng`.
 */
export function shuffleDeterministic<T>(items: readonly T[], seed: number): ShuffleResult<T> {
  const copy = [...items];
  let currentSeed = seed;

  for (let i = copy.length - 1; i > 0; i--) {
    const step = nextRng(currentSeed);
    currentSeed = step.nextSeed;
    const j = Math.floor(step.value * (i + 1));
    const temp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = temp;
  }

  return { items: copy, nextSeed: currentSeed };
}
