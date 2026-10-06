/**
 * Pure shooting maths: turning a trigger pull into a list of bullets, and
 * resolving a bullet hit into damage. The engine calls these; the tests
 * call them directly.
 */

import { BULLET } from '../config.js';
import { effectiveSpread, rollDamage, shotPellets } from '../data/guns.js';

/**
 * Build every pellet released by one trigger pull.
 *  origin       {x, y} muzzle position
 *  angle        radians the player is facing
 *  heat         0..1 recoil heat, widens the cone
 *  rng          injected rng so tests can pin the spread
 */
export function createShot(gun, origin, angle, heat = 0, rng = Math.random) {
  const pellets = shotPellets(gun);
  const spread = effectiveSpread(gun, heat);
  const bullets = [];
  const rand = typeof rng === 'function' ? rng : () => rng;

  for (let i = 0; i < pellets; i += 1) {
    // Gaussian-ish spread: average of two uniforms looks better than a flat cone.
    const jitter = pellets === 1 ? (rand() + rand() - 1) * spread : (rand() + rand() - 1) * spread;
    const a = angle + jitter;
    const speed = gun.bulletSpeed * (0.94 + rand() * 0.12);
    bullets.push({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage: gun.damage,
      gunId: gun.id,
      pierce: gun.pierce ?? 0,
      hitsLeft: (gun.pierce ?? 0) + 1,
      splash: gun.splash ?? 0,
      range: gun.range ?? 800,
      travelled: 0,
      radius: BULLET.radius,
      lifetime: BULLET.maxLifetime,
      critChance: gun.critChance ?? 0,
      critMult: gun.critMult ?? 2,
      knockback: gun.knockback ?? 60,
      trail: [],
    });
  }
  return bullets;
}

/** Resolve a bullet hitting something at a given travel distance. */
export function resolveHit(bullet, distanceTravelled, roll) {
  const result = rollDamage(
    { ...bullet, damage: bullet.damage, range: bullet.range, critChance: bullet.critChance, critMult: bullet.critMult },
    distanceTravelled,
    roll,
  );
  return result;
}

/** Heat update: rises per shot, decays over time, clamped to [0, 1]. */
export function updateHeat(heat, gun, dt, fired) {
  let next = heat;
  if (fired) next += gun.heatPerShot ?? 0.05;
  next -= (gun.heatDecay ?? 1.5) * dt;
  return Math.min(1, Math.max(0, next));
}

/** Enemy shot spread helper (their accuracy stat is a cone in radians). */
export function enemyShotAngle(baseAngle, accuracy, rng = Math.random) {
  const rand = typeof rng === 'function' ? rng : () => rng;
  return baseAngle + (rand() + rand() - 1) * accuracy;
}

/**
 * Line of sight between two points through a list of solid rects.
 * Marches in fixed steps; good enough for a 1600x1000 arena.
 */
export function hasLineOfSight(obstacles, x1, y1, x2, y2, step = 22) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return true;
  const steps = Math.max(1, Math.ceil(len / step));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const o of obstacles) {
      if (!o.solid) continue;
      if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) return false;
    }
  }
  return true;
}
