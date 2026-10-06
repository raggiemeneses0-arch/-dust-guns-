/**
 * Enemy archetypes and wave planning. `planWave()` is a pure function:
 * give it a wave number and a map and it tells you exactly who shows up.
 */

export const ENEMY_TYPES = {
  bandit: {
    id: 'bandit',
    name: 'Bandit',
    hp: 42,
    speed: 96,
    radius: 14,
    damage: 9,
    fireRate: 1150,
    bulletSpeed: 430,
    accuracy: 0.13,
    preferredRange: 210,
    minRange: 130,
    coins: 12,
    xp: 1,
    behaviour: 'strafe',
    palette: { coat: '#7b4a3a', hat: '#4c3126', skin: '#cf9a6b', accent: '#d9d2c0' },
    blurb: 'Six-shooter and bad manners.',
  },
  gunslinger: {
    id: 'gunslinger',
    name: 'Gunslinger',
    hp: 34,
    speed: 128,
    radius: 13,
    damage: 7,
    fireRate: 620,
    bulletSpeed: 520,
    accuracy: 0.07,
    preferredRange: 260,
    minRange: 160,
    coins: 18,
    behaviour: 'circle',
    palette: { coat: '#3f5c6b', hat: '#233039', skin: '#d9a06b', accent: '#c9d7e0' },
    blurb: 'Fast hands. Keep moving.',
  },
  thug: {
    id: 'thug',
    name: 'Shotgun Thug',
    hp: 78,
    speed: 82,
    radius: 16,
    damage: 8,
    pellets: 5,
    spread: 0.22,
    fireRate: 1500,
    bulletSpeed: 400,
    accuracy: 0.1,
    preferredRange: 150,
    minRange: 70,
    coins: 24,
    behaviour: 'charge',
    palette: { coat: '#5d4a2f', hat: '#3a2c1a', skin: '#c08a58', accent: '#b8a277' },
    blurb: 'Close range hurts.',
  },
  sniper: {
    id: 'sniper',
    name: 'Ridge Sniper',
    hp: 46,
    speed: 64,
    radius: 14,
    damage: 26,
    fireRate: 2300,
    bulletSpeed: 900,
    accuracy: 0.02,
    preferredRange: 520,
    minRange: 340,
    telegraph: 0.85,
    coins: 28,
    behaviour: 'kite',
    palette: { coat: '#4a4f3c', hat: '#2e3327', skin: '#d09462', accent: '#8d9a78' },
    blurb: 'Watches the red dot. Then run.',
  },
  brute: {
    id: 'brute',
    name: 'Dynamite Brute',
    hp: 190,
    speed: 66,
    radius: 20,
    damage: 30,
    splash: 90,
    fireRate: 2600,
    bulletSpeed: 330,
    accuracy: 0.09,
    preferredRange: 200,
    minRange: 120,
    coins: 48,
    behaviour: 'advance',
    palette: { coat: '#6b3b2a', hat: '#402118', skin: '#c58a55', accent: '#d05a3a' },
    blurb: 'Throws dynamite. Do not stand still.',
  },
  boss: {
    id: 'boss',
    name: 'The Bandit King',
    hp: 1150,
    speed: 74,
    radius: 26,
    damage: 18,
    pellets: 3,
    spread: 0.16,
    fireRate: 900,
    bulletSpeed: 520,
    accuracy: 0.08,
    preferredRange: 280,
    minRange: 150,
    coins: 400,
    bounty: 2,
    isBoss: true,
    behaviour: 'boss',
    palette: { coat: '#2a1d2e', hat: '#15101a', skin: '#cf9a6b', accent: '#e0b34a' },
    blurb: 'Every territory has one. This is yours.',
  },
};

const ENEMY_INDEX = new Map(Object.values(ENEMY_TYPES).map((e) => [e.id, e]));

export function getEnemyType(id) {
  return ENEMY_INDEX.get(id) ?? ENEMY_TYPES.bandit;
}

export const ENEMY_IDS = Object.keys(ENEMY_TYPES);

/** Which archetypes a map is allowed to roll from. */
const MAP_ROSTER = {
  'main-street': ['bandit', 'gunslinger', 'thug'],
  'saloon-alley': ['bandit', 'gunslinger', 'thug', 'sniper'],
  'ghost-town': ['bandit', 'gunslinger', 'thug', 'sniper', 'brute'],
  'red-canyon': ['gunslinger', 'sniper', 'thug', 'brute', 'bandit'],
  'rail-yard': ['gunslinger', 'sniper', 'brute', 'thug', 'bandit'],
  'sunset-mesa': ['sniper', 'brute', 'gunslinger', 'thug', 'bandit'],
};

export function rosterFor(mapId) {
  return MAP_ROSTER[mapId] ?? MAP_ROSTER['main-street'];
}

/**
 * Deterministic wave composition. Returns a list of spawn orders:
 *   { type, count, delay }  delay = seconds after the wave starts.
 * The last wave of a map always closes with the boss.
 */
export function planWave(wave, map) {
  const w = Math.max(1, Math.floor(wave));
  const roster = rosterFor(map.id);
  const orders = [];

  const isFinal = w >= map.waves;
  const budget = 4 + Math.round(w * 1.65);

  // Weights grow so nastier types show up later.
  const weights = {
    bandit: Math.max(1, 10 - w * 0.6),
    gunslinger: w >= 2 ? 3 + w * 0.5 : 0,
    thug: w >= 3 ? 2 + w * 0.45 : 0,
    sniper: w >= 4 ? 1.6 + w * 0.5 : 0,
    brute: w >= 5 ? 1 + w * 0.4 : 0,
  };

  const pool = roster.filter((t) => (weights[t] ?? 0) > 0);
  const active = pool.length ? pool : ['bandit'];
  const totalWeight = active.reduce((sum, t) => sum + weights[t], 0);

  // Simple LCG so planWave is reproducible without needing an rng instance.
  let seed = (w * 2654435761 + hash(map.id)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let remaining = budget;
  let group = 0;
  while (remaining > 0) {
    let roll = rnd() * totalWeight;
    let type = active[0];
    for (const t of active) {
      roll -= weights[t];
      if (roll <= 0) {
        type = t;
        break;
      }
    }
    const count = Math.min(remaining, 1 + Math.floor(rnd() * (1 + Math.min(3, Math.floor(w / 2)))));
    orders.push({ type, count, delay: group * (w < 3 ? 5.5 : 4.2) });
    remaining -= count;
    group += 1;
    if (group > 12) break;
  }

  if (isFinal) {
    orders.push({ type: 'boss', count: 1, delay: 2 });
  }

  return orders;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function totalEnemiesIn(orders) {
  return orders.reduce((n, o) => n + o.count, 0);
}

/**
 * How a given archetype's stats scale for a wave + map.
 * HP and damage climb gently; coins scale with the map reward modifier.
 */
export function scaleEnemy(type, wave, map) {
  const hpScale = (1 + 0.13 * (wave - 1)) * map.enemyScale;
  const dmgScale = (1 + 0.05 * (wave - 1)) * (0.7 + map.enemyScale * 0.3);
  return {
    hp: Math.round(type.hp * hpScale),
    damage: Math.round(type.damage * dmgScale),
    speed: type.speed * (1 + 0.012 * (wave - 1)),
    coins: Math.round(type.coins * map.rewardScale),
  };
}
