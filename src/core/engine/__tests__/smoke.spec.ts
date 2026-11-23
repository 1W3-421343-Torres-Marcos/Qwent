import { describe, expect, it } from 'vitest';
import { nextRng, QWENT_PHASE, shuffleDeterministic } from '../../index';

describe('Core Engine F4 Smoke & Deterministic PRNG', () => {
  it('exposes the current phase constant without Angular dependencies', () => {
    expect(QWENT_PHASE).toBe('F4');
  });

  it('produces deterministic values in [0, 1) for a fixed seed', () => {
    const firstRunA = nextRng(12345);
    const secondRunA = nextRng(firstRunA.nextSeed);

    const firstRunB = nextRng(12345);
    const secondRunB = nextRng(firstRunB.nextSeed);

    expect(firstRunA).toEqual(firstRunB);
    expect(secondRunA).toEqual(secondRunB);
    expect(firstRunA.value).toBeGreaterThanOrEqual(0);
    expect(firstRunA.value).toBeLessThan(1);
    expect(secondRunA.value).toBeGreaterThanOrEqual(0);
    expect(secondRunA.value).toBeLessThan(1);
    expect(firstRunA.nextSeed).not.toBe(12345);
  });

  it('shuffles deterministically without mutating the source array', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

    const resultA = shuffleDeterministic(original, 42);
    const resultB = shuffleDeterministic(original, 42);
    const resultOther = shuffleDeterministic(original, 99);

    expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(resultA).toEqual(resultB);
    expect([...resultA.items].sort((a, b) => a - b)).toEqual([...original]);
    expect(resultA.items).not.toEqual(resultOther.items);
  });
});
