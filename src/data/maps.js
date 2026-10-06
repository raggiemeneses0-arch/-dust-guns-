/**
 * Selectable maps. Each map is pure data: a palette, a set of normalised
 * structures/props (fractions of the world), and difficulty modifiers.
 * `buildMapGeometry()` turns that data into world-space geometry and is
 * deterministic for a given seed, so a map always plays the same.
 */

import { WORLD } from '../config.js';
import { makeRng } from '../core/rng.js';

export const PROP_KINDS = {
  building: { solid: true, destructible: false, label: 'Building' },
  wall: { solid: true, destructible: false, label: 'Wall' },
  mesa: { solid: true, destructible: false, label: 'Mesa' },
  train: { solid: true, destructible: false, label: 'Train Car' },
  waterTower: { solid: true, destructible: false, label: 'Water Tower' },
  rock: { solid: true, destructible: false, label: 'Rock' },
  cactus: { solid: true, destructible: false, label: 'Cactus' },
  wagon: { solid: true, destructible: false, label: 'Wagon' },
  trough: { solid: true, destructible: false, label: 'Trough' },
  crate: { solid: true, destructible: true, hp: 40, label: 'Crate' },
  barrel: { solid: true, destructible: true, hp: 25, explosive: true, label: 'Powder Keg' },
  tombstone: { solid: true, destructible: false, label: 'Tombstone' },
  bush: { solid: false, destructible: false, label: 'Brush' },
  tumbleweed: { solid: false, destructible: false, label: 'Tumbleweed' },
};

export const UNLOCK_RULES = {
  free: { kind: 'free' },
  clearMainStreet: { kind: 'clear', mapId: 'main-street', cost: 800 },
  clearSaloonAlley: { kind: 'clear', mapId: 'saloon-alley', cost: 2000 },
  clearGhostTown: { kind: 'clear', mapId: 'ghost-town', cost: 4200 },
  clearRedCanyon: { kind: 'clear', mapId: 'red-canyon', cost: 7600 },
  clearRailYard: { kind: 'clear', mapId: 'rail-yard', cost: 13000 },
};

export const MAPS = [
  {
    id: 'main-street',
    name: 'Main Street',
    subtitle: 'Dusty Gulch',
    blurb: 'Noon, one street, and a lot of men who want your hat. The classic.',
    difficulty: 1,
    waves: 8,
    enemyScale: 1,
    rewardScale: 1,
    spawnRate: 1,
    unlock: UNLOCK_RULES.free,
    palette: {
      ground: '#c9a86a',
      groundAlt: '#b8975c',
      dirt: '#a5834c',
      accent: '#8a6a3f',
      obstacle: '#7d5a3a',
      obstacleTop: '#9a7347',
      obstacleEdge: '#4f3520',
      dust: '#e6d3a8',
      fog: 'rgba(210, 170, 110, 0.10)',
      vignette: 'rgba(60, 34, 14, 0.42)',
      shadow: 'rgba(74, 48, 24, 0.35)',
      sky: '#e8c789',
    },
    props: ['cactus', 'crate', 'barrel', 'bush', 'tumbleweed', 'wagon', 'trough'],
    structures: [
      { kind: 'building', x: 0.02, y: 0.03, w: 0.17, h: 0.16 },
      { kind: 'building', x: 0.24, y: 0.02, w: 0.15, h: 0.13 },
      { kind: 'building', x: 0.44, y: 0.03, w: 0.19, h: 0.15 },
      { kind: 'building', x: 0.7, y: 0.02, w: 0.16, h: 0.14 },
      { kind: 'building', x: 0.03, y: 0.36, w: 0.1, h: 0.22 },
      { kind: 'building', x: 0.88, y: 0.34, w: 0.1, h: 0.24 },
      { kind: 'wall', x: 0.3, y: 0.34, w: 0.16, h: 0.045 },
      { kind: 'wall', x: 0.58, y: 0.5, w: 0.17, h: 0.045 },
      { kind: 'wagon', x: 0.16, y: 0.63, w: 0.13, h: 0.075 },
      { kind: 'trough', x: 0.68, y: 0.76, w: 0.1, h: 0.035 },
      { kind: 'wall', x: 0.35, y: 0.72, w: 0.045, h: 0.14 },
      { kind: 'rock', x: 0.82, y: 0.86, w: 0.06, h: 0.05 },
    ],
    scatter: [
      { kind: 'crate', count: 7, w: 0.032, h: 0.032 },
      { kind: 'barrel', count: 4, w: 0.026, h: 0.026 },
      { kind: 'cactus', count: 6, w: 0.022, h: 0.03 },
      { kind: 'bush', count: 9, w: 0.03, h: 0.024 },
    ],
  },
  {
    id: 'saloon-alley',
    name: 'Saloon Alley',
    subtitle: 'Behind the Last Chance',
    blurb: 'Tight lanes and swinging doors. Every corner is a coin flip.',
    difficulty: 2,
    waves: 9,
    enemyScale: 1.18,
    rewardScale: 1.25,
    spawnRate: 1.1,
    unlock: UNLOCK_RULES.clearMainStreet,
    palette: {
      ground: '#a8895d',
      groundAlt: '#987a50',
      dirt: '#7d6242',
      accent: '#6b5236',
      obstacle: '#5e4430',
      obstacleTop: '#7c5c3e',
      obstacleEdge: '#33241a',
      dust: '#c9b18a',
      fog: 'rgba(90, 66, 44, 0.22)',
      vignette: 'rgba(24, 14, 8, 0.6)',
      shadow: 'rgba(30, 18, 10, 0.45)',
      sky: '#7a5f3e',
    },
    props: ['crate', 'barrel', 'bush', 'tumbleweed'],
    structures: [
      { kind: 'building', x: 0.02, y: 0.02, w: 0.28, h: 0.2 },
      { kind: 'building', x: 0.68, y: 0.02, w: 0.3, h: 0.2 },
      { kind: 'wall', x: 0.02, y: 0.4, w: 0.26, h: 0.05 },
      { kind: 'wall', x: 0.72, y: 0.4, w: 0.26, h: 0.05 },
      { kind: 'wall', x: 0.42, y: 0.26, w: 0.16, h: 0.05 },
      { kind: 'wall', x: 0.475, y: 0.55, w: 0.05, h: 0.18 },
      { kind: 'wagon', x: 0.13, y: 0.72, w: 0.14, h: 0.07 },
      { kind: 'trough', x: 0.7, y: 0.7, w: 0.11, h: 0.035 },
      { kind: 'building', x: 0.02, y: 0.86, w: 0.16, h: 0.12 },
      { kind: 'building', x: 0.82, y: 0.86, w: 0.16, h: 0.12 },
    ],
    scatter: [
      { kind: 'crate', count: 10, w: 0.032, h: 0.032 },
      { kind: 'barrel', count: 7, w: 0.026, h: 0.026 },
      { kind: 'bush', count: 5, w: 0.028, h: 0.022 },
    ],
  },
  {
    id: 'ghost-town',
    name: 'Ghost Town',
    subtitle: 'Purgatory Flats',
    blurb: 'Everyone left in a hurry. The graves say why.',
    difficulty: 3,
    waves: 10,
    enemyScale: 1.32,
    rewardScale: 1.5,
    spawnRate: 1.18,
    unlock: UNLOCK_RULES.clearSaloonAlley,
    palette: {
      ground: '#b3a98f',
      groundAlt: '#a29880',
      dirt: '#8c8268',
      accent: '#766c56',
      obstacle: '#6d6350',
      obstacleTop: '#8a7f68',
      obstacleEdge: '#3b3529',
      dust: '#d6cdb6',
      fog: 'rgba(150, 148, 138, 0.26)',
      vignette: 'rgba(30, 28, 24, 0.6)',
      shadow: 'rgba(40, 36, 28, 0.4)',
      sky: '#b9b09a',
    },
    props: ['crate', 'barrel', 'tombstone', 'bush', 'tumbleweed', 'rock'],
    structures: [
      { kind: 'building', x: 0.04, y: 0.05, w: 0.14, h: 0.17 },
      { kind: 'building', x: 0.3, y: 0.03, w: 0.12, h: 0.13 },
      { kind: 'building', x: 0.55, y: 0.06, w: 0.15, h: 0.15 },
      { kind: 'building', x: 0.8, y: 0.04, w: 0.16, h: 0.16 },
      { kind: 'wall', x: 0.2, y: 0.42, w: 0.18, h: 0.045 },
      { kind: 'wall', x: 0.62, y: 0.42, w: 0.2, h: 0.045 },
      { kind: 'rock', x: 0.44, y: 0.5, w: 0.07, h: 0.06 },
      { kind: 'wagon', x: 0.74, y: 0.6, w: 0.13, h: 0.07 },
      { kind: 'building', x: 0.03, y: 0.66, w: 0.13, h: 0.15 },
      { kind: 'wall', x: 0.22, y: 0.74, w: 0.16, h: 0.045 },
    ],
    scatter: [
      { kind: 'tombstone', count: 12, w: 0.026, h: 0.028 },
      { kind: 'crate', count: 6, w: 0.032, h: 0.032 },
      { kind: 'barrel', count: 4, w: 0.026, h: 0.026 },
      { kind: 'rock', count: 5, w: 0.045, h: 0.038 },
      { kind: 'bush', count: 7, w: 0.03, h: 0.024 },
    ],
  },
  {
    id: 'red-canyon',
    name: 'Red Canyon',
    subtitle: "Vulture's Cut",
    blurb: 'Red rock, long shadows, and snipers on every ledge.',
    difficulty: 4,
    waves: 10,
    enemyScale: 1.48,
    rewardScale: 1.8,
    spawnRate: 1.25,
    unlock: UNLOCK_RULES.clearGhostTown,
    palette: {
      ground: '#b4643c',
      groundAlt: '#a35733',
      dirt: '#8c4527',
      accent: '#7a3a1f',
      obstacle: '#8f4a2a',
      obstacleTop: '#b0623a',
      obstacleEdge: '#4a2312',
      dust: '#e0a277',
      fog: 'rgba(190, 96, 56, 0.16)',
      vignette: 'rgba(58, 20, 8, 0.55)',
      shadow: 'rgba(66, 28, 12, 0.45)',
      sky: '#d98a5c',
    },
    props: ['rock', 'cactus', 'barrel', 'bush', 'tumbleweed'],
    structures: [
      { kind: 'mesa', x: 0.02, y: 0.02, w: 0.2, h: 0.3 },
      { kind: 'mesa', x: 0.78, y: 0.02, w: 0.2, h: 0.26 },
      { kind: 'mesa', x: 0.02, y: 0.62, w: 0.17, h: 0.36 },
      { kind: 'mesa', x: 0.83, y: 0.66, w: 0.15, h: 0.32 },
      { kind: 'rock', x: 0.34, y: 0.2, w: 0.09, h: 0.07 },
      { kind: 'rock', x: 0.56, y: 0.42, w: 0.11, h: 0.08 },
      { kind: 'rock', x: 0.3, y: 0.68, w: 0.08, h: 0.06 },
      { kind: 'mesa', x: 0.24, y: 0.86, w: 0.14, h: 0.12 },
      { kind: 'rock', x: 0.68, y: 0.78, w: 0.07, h: 0.06 },
    ],
    scatter: [
      { kind: 'rock', count: 9, w: 0.05, h: 0.042 },
      { kind: 'cactus', count: 8, w: 0.022, h: 0.032 },
      { kind: 'barrel', count: 5, w: 0.026, h: 0.026 },
      { kind: 'bush', count: 8, w: 0.03, h: 0.024 },
    ],
  },
  {
    id: 'rail-yard',
    name: 'Rail Yard',
    subtitle: 'Ironhorse Junction',
    blurb: 'Long sightlines between the boxcars. Duck or die.',
    difficulty: 4,
    waves: 11,
    enemyScale: 1.62,
    rewardScale: 2.05,
    spawnRate: 1.3,
    unlock: UNLOCK_RULES.clearRedCanyon,
    palette: {
      ground: '#8d8577',
      groundAlt: '#7e766a',
      dirt: '#6a6357',
      accent: '#5a5449',
      obstacle: '#54504a',
      obstacleTop: '#6e6a61',
      obstacleEdge: '#2b2824',
      dust: '#b8b0a2',
      fog: 'rgba(120, 116, 108, 0.2)',
      vignette: 'rgba(22, 20, 18, 0.6)',
      shadow: 'rgba(28, 26, 22, 0.45)',
      sky: '#9a9488',
    },
    props: ['crate', 'barrel', 'bush', 'rock'],
    structures: [
      { kind: 'train', x: 0.06, y: 0.14, w: 0.42, h: 0.075 },
      { kind: 'train', x: 0.55, y: 0.3, w: 0.4, h: 0.075 },
      { kind: 'train', x: 0.08, y: 0.5, w: 0.36, h: 0.075 },
      { kind: 'train', x: 0.5, y: 0.66, w: 0.42, h: 0.075 },
      { kind: 'waterTower', x: 0.86, y: 0.04, w: 0.11, h: 0.11 },
      { kind: 'building', x: 0.02, y: 0.86, w: 0.18, h: 0.12 },
      { kind: 'wall', x: 0.2, y: 0.82, w: 0.17, h: 0.045 },
      { kind: 'waterTower', x: 0.03, y: 0.03, w: 0.1, h: 0.1 },
    ],
    scatter: [
      { kind: 'crate', count: 12, w: 0.034, h: 0.034 },
      { kind: 'barrel', count: 8, w: 0.026, h: 0.026 },
      { kind: 'bush', count: 4, w: 0.028, h: 0.022 },
    ],
  },
  {
    id: 'sunset-mesa',
    name: 'Sunset Mesa',
    subtitle: "Hangman's Flat",
    blurb: 'The Bandit King waits here. Open ground, no excuses.',
    difficulty: 5,
    waves: 12,
    enemyScale: 1.8,
    rewardScale: 2.6,
    spawnRate: 1.35,
    unlock: UNLOCK_RULES.clearRailYard,
    palette: {
      ground: '#d98f4f',
      groundAlt: '#c67f43',
      dirt: '#a86a34',
      accent: '#8f5527',
      obstacle: '#9c5a30',
      obstacleTop: '#c1743f',
      obstacleEdge: '#522a12',
      dust: '#f0bd84',
      fog: 'rgba(230, 130, 60, 0.2)',
      vignette: 'rgba(70, 22, 6, 0.55)',
      shadow: 'rgba(78, 34, 12, 0.42)',
      sky: '#f0a35e',
    },
    props: ['rock', 'cactus', 'barrel', 'crate', 'bush', 'tumbleweed'],
    structures: [
      { kind: 'mesa', x: 0.02, y: 0.02, w: 0.24, h: 0.18 },
      { kind: 'mesa', x: 0.74, y: 0.02, w: 0.24, h: 0.2 },
      { kind: 'mesa', x: 0.04, y: 0.74, w: 0.2, h: 0.24 },
      { kind: 'mesa', x: 0.76, y: 0.76, w: 0.22, h: 0.22 },
      { kind: 'rock', x: 0.42, y: 0.14, w: 0.1, h: 0.08 },
      { kind: 'rock', x: 0.6, y: 0.7, w: 0.11, h: 0.08 },
      { kind: 'wall', x: 0.36, y: 0.46, w: 0.28, h: 0.045 },
    ],
    scatter: [
      { kind: 'rock', count: 10, w: 0.05, h: 0.04 },
      { kind: 'cactus', count: 7, w: 0.022, h: 0.032 },
      { kind: 'barrel', count: 6, w: 0.026, h: 0.026 },
      { kind: 'crate', count: 6, w: 0.032, h: 0.032 },
      { kind: 'bush', count: 6, w: 0.03, h: 0.024 },
    ],
  },
];

const MAP_INDEX = new Map(MAPS.map((m) => [m.id, m]));
export const MAP_IDS = MAPS.map((m) => m.id);
export const FIRST_MAP_ID = MAPS[0].id;
export const FINAL_MAP_ID = MAPS[MAPS.length - 1].id;

export function getMap(id) {
  return MAP_INDEX.get(id) ?? null;
}

export function getMapOrDefault(id) {
  return MAP_INDEX.get(id) ?? MAPS[0];
}

/**
 * Build world-space geometry for a map.
 * Returns { obstacles, decor } where obstacles are solid rects (with optional
 * hp for destructibles) and decor are non-blocking draw-only props.
 */
export function buildMapGeometry(mapId, seed = mapId) {
  const map = getMapOrDefault(mapId);
  const rng = makeRng(`${map.id}:${seed}`);
  const W = WORLD.width;
  const H = WORLD.height;

  const obstacles = [];
  const decor = [];

  // Player start lives here -- nothing solid may occupy it, hand-placed or not.
  const safe = { x: W * 0.44, y: H * 0.78, w: W * 0.12, h: H * 0.16 };
  const safePad = 34;

  for (const s of map.structures) {
    const rect = { x: s.x * W, y: s.y * H, w: s.w * W, h: s.h * H };
    if (overlapsAny(rect, safe, safePad)) continue; // safety net for bad map data
    obstacles.push(makeProp(s.kind, rect.x, rect.y, rect.w, rect.h, rng));
  }

  for (const spec of map.scatter) {
    for (let i = 0; i < spec.count; i += 1) {
      let placed = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const w = spec.w * W * rng.range(0.85, 1.15);
        const h = spec.h * H * rng.range(0.85, 1.15);
        const x = rng.range(30, W - w - 30);
        const y = rng.range(30, H - h - 30);
        const rect = { x, y, w, h };
        if (overlapsAny(rect, safe, 26)) continue;
        if (overlapsAny(rect, ...obstacles, 18)) continue;
        placed = rect;
        break;
      }
      if (!placed) continue;
      const prop = makeProp(spec.kind, placed.x, placed.y, placed.w, placed.h, rng);
      if (prop.solid) obstacles.push(prop);
      else decor.push(prop);
    }
  }

  return { map, obstacles, decor };
}

function overlapsAny(rect, ...others) {
  for (const o of others) {
    if (rect.x < o.x + o.w && rect.x + rect.w > o.x && rect.y < o.y + o.h && rect.y + rect.h > o.y) {
      return true;
    }
  }
  return false;
}

function makeProp(kind, x, y, w, h, rng) {
  const meta = PROP_KINDS[kind] ?? PROP_KINDS.rock;
  return {
    kind,
    x,
    y,
    w,
    h,
    solid: meta.solid,
    destructible: Boolean(meta.destructible),
    explosive: Boolean(meta.explosive),
    hp: meta.hp ?? 0,
    maxHp: meta.hp ?? 0,
    seed: rng.range(0, 1000),
  };
}

/**
 * Pick a spawn point for an enemy: on the world edge, away from the player,
 * and never inside a solid obstacle.
 */
export function findSpawnPoint(obstacles, playerX, playerY, rng, minDistanceFromPlayer = 360) {
  const W = WORLD.width;
  const H = WORLD.height;
  const margin = 46;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const edge = rng.int(0, 3);
    let x;
    let y;
    if (edge === 0) {
      x = rng.range(margin, W - margin);
      y = margin;
    } else if (edge === 1) {
      x = W - margin;
      y = rng.range(margin, H - margin);
    } else if (edge === 2) {
      x = rng.range(margin, W - margin);
      y = H - margin;
    } else {
      x = margin;
      y = rng.range(margin, H - margin);
    }
    if (Math.hypot(x - playerX, y - playerY) < minDistanceFromPlayer) continue;
    if (pointInsideObstacle(obstacles, x, y, 22)) continue;
    return { x, y };
  }
  return { x: margin, y: margin };
}

export function pointInsideObstacle(obstacles, x, y, pad = 0) {
  for (const o of obstacles) {
    if (!o.solid) continue;
    if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return true;
  }
  return false;
}

export function mapUnlockStatus(map, progress) {
  if (map.unlock.kind === 'free') return { unlocked: true, reason: 'unlocked' };
  if (progress.clearedMaps?.includes(map.unlock.mapId)) {
    return { unlocked: true, reason: 'cleared' };
  }
  if (progress.boughtMaps?.includes(map.id)) return { unlocked: true, reason: 'purchased' };
  return { unlocked: false, reason: 'locked', cost: map.unlock.cost, requires: map.unlock.mapId };
}
