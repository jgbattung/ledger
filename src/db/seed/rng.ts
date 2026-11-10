/**
 * Deterministic PRNG for the dev seed (mulberry32). The same seed always
 * yields the same sequence, so seeded history is reproducible for a given
 * anchor time. Nothing in `src/db/seed/` may use the platform RNG.
 */

export const DEFAULT_SEED = 0x1ed6e5

export type Rng = {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** True with probability `p`. */
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
}

export function createRng(seed: number = DEFAULT_SEED): Rng {
  let state = seed >>> 0

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  }
}
