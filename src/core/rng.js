/**
 * Deterministic pseudo-random generator (mulberry32).
 * Everything procedural in the game -- map props, enemy spawns, spread --
 * comes from this so runs are reproducible from a seed.
 */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string ("red-canyon") into a stable 32-bit seed. */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  const next = typeof seed === 'number' ? mulberry32(seed) : mulberry32(hashString(String(seed)));
  const rng = {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    /** Pick a random element of a non-empty array. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
  return rng;
}
