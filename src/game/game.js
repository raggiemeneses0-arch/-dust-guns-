/**
 * The Dust & Guns simulation.
 *
 * This file owns all mutable game state: player, enemies, bullets, pickups,
 * particles and the wave director. It has no DOM references -- main.js drives
 * it with an input object each frame and render.js draws the result. That
 * split is what makes the whole thing runnable (and testable) headless.
 */

import { BULLET, PICKUP, PLAYER, WAVES, WORLD } from '../config.js';
import { makeRng } from '../core/rng.js';
import {
  clamp,
  dist,
  resolveCircleRect,
  rotateToward,
  segmentHitsCircle,
  segmentHitsRect,
} from '../core/utils.js';
import { getEnemyType, planWave, scaleEnemy, totalEnemiesIn } from '../data/enemies.js';
import { buildMapGeometry, findSpawnPoint, getMapOrDefault } from '../data/maps.js';
import { applyReward, bountyForKill, coinsForKill, mapClearReward, waveClearBonus } from '../core/economy.js';
import { activeGun } from '../core/store.js';
import { createShot, enemyShotAngle, hasLineOfSight, updateHeat } from './ballistics.js';

let nextId = 1;
const uid = (prefix) => `${prefix}-${nextId++}`;

export const PHASE = {
  WARMUP: 'warmup',
  WAVE: 'wave',
  INTERMISSION: 'intermission',
  CLEARED: 'cleared',
  DEAD: 'dead',
};

export class Game {
  /**
   * @param {object} opts
   * @param {object} opts.save     progression save (coins, loadout, skins)
   * @param {string} opts.mapId    which map to fight on
   * @param {string|number} [opts.seed]  deterministic layout seed
   * @param {object} [opts.audio]  AudioKit instance
   */
  constructor({ save, mapId, seed, audio }) {
    this.save = save;
    this.map = getMapOrDefault(mapId);
    this.seed = seed ?? `${this.map.id}:${Math.floor(Math.random() * 1e9)}`;
    this.rng = makeRng(String(this.seed));
    const geometry = buildMapGeometry(this.map.id, this.seed);
    this.obstacles = geometry.obstacles;
    this.decor = geometry.decor;
    this.audio = audio ?? null;
    this.events = [];

    this.run = {
      kills: 0,
      coins: 0,
      bounty: 0,
      shotsFired: 0,
      shotsHit: 0,
      wavesCleared: 0,
      bossKills: 0,
      startedAt: Date.now(),
    };

    this.camera = { x: 0, y: 0, shake: 0 };
    this.time = 0;
    this.phase = PHASE.WARMUP;
    this.warmupTime = 4;

    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];

    this.wave = 0;
    this.waveOrders = [];
    this.waveQueue = [];
    this.waveTotal = 0;
    this.intermissionTime = 0;
    this.announce = null;

    this.player = this.makePlayer();
    this.resetMags();
    this.emit('mapstart', { mapId: this.map.id });
  }

  /* ------------------------------------------------------------- setup */

  makePlayer() {
    return {
      x: WORLD.width * 0.5,
      y: WORLD.height * 0.84,
      vx: 0,
      vy: 0,
      radius: PLAYER.radius,
      angle: -Math.PI / 2,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      stamina: PLAYER.maxStamina,
      heat: 0,
      dashUntil: -1,
      dashCdUntil: -1,
      invulnUntil: -1,
      reloading: null,
      nextShotAt: 0,
      muzzleFlash: 0,
      bob: 0,
      hurtFlash: 0,
    };
  }

  resetMags() {
    const mags = {};
    for (const id of this.save.equipped.loadout) {
      const gun = activeGun({ equipped: { loadout: [id], activeSlot: 0 } });
      mags[id] = gun.mag;
    }
    this.mags = mags;
  }

  /** Swap in an updated save (after a shop purchase) without losing the run. */
  setSave(save) {
    const prev = this.save;
    this.save = save;
    for (const id of save.equipped.loadout) {
      if (this.mags[id] === undefined) {
        const gun = activeGun({ equipped: { loadout: [id], activeSlot: 0 } });
        this.mags[id] = gun.mag;
      }
    }
    const currentId = save.equipped.loadout[save.equipped.activeSlot];
    if (prev && currentId !== prev.equipped.loadout[prev.equipped.activeSlot]) {
      this.player.reloading = null;
    }
  }

  get gun() {
    return activeGun(this.save);
  }

  get magAmmo() {
    return this.mags[this.gun.id] ?? 0;
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /* ------------------------------------------------------------ update */

  /**
   * @param {number} dt   seconds since last frame
   * @param {object} input  { moveX, moveY, aimX, aimY, firing, fireEdge,
   *                          sprint, dash, reload, cycle }
   */
  update(dt, input) {
    this.time += dt;
    this.events.length = 0;

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateWave(dt);
    this.updateCamera(dt);

    if (this.announce) {
      this.announce.t -= dt;
      if (this.announce.t <= 0) this.announce = null;
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    if (this.phase === PHASE.DEAD) return;

    // --- movement -------------------------------------------------
    let mx = input?.moveX ?? 0;
    let my = input?.moveY ?? 0;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }

    const dashing = this.time < p.dashUntil;
    const sprinting = Boolean(input?.sprint) && (mx !== 0 || my !== 0) && p.stamina > 1 && !dashing;

    if (sprinting) {
      p.stamina = Math.max(0, p.stamina - PLAYER.staminaDrain * dt);
    } else {
      p.stamina = Math.min(PLAYER.maxStamina, p.stamina + PLAYER.staminaRegen * dt);
    }

    const speed = PLAYER.speed * (sprinting ? PLAYER.sprintMultiplier : 1);

    if (dashing) {
      p.vx = p.dashDirX * PLAYER.dashSpeed;
      p.vy = p.dashDirY * PLAYER.dashSpeed;
    } else {
      const accel = 12;
      p.vx += (mx * speed - p.vx) * Math.min(1, accel * dt);
      p.vy += (my * speed - p.vy) * Math.min(1, accel * dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // world bounds
    p.x = clamp(p.x, p.radius, WORLD.width - p.radius);
    p.y = clamp(p.y, p.radius, WORLD.height - p.radius);

    // obstacle collision
    for (const o of this.obstacles) {
      if (!o.solid) continue;
      const r = resolveCircleRect(p.x, p.y, p.radius, o);
      if (r.hit) {
        p.x = r.x;
        p.y = r.y;
      }
    }

    p.bob += Math.hypot(p.vx, p.vy) * dt * 0.03;
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);

    // --- dash ------------------------------------------------------
    if (input?.dash && this.time >= p.dashCdUntil && !dashing && (mx !== 0 || my !== 0 || true)) {
      const dirX = mx !== 0 || my !== 0 ? mx : Math.cos(p.angle);
      const dirY = mx !== 0 || my !== 0 ? my : Math.sin(p.angle);
      const dl = Math.hypot(dirX, dirY) || 1;
      p.dashDirX = dirX / dl;
      p.dashDirY = dirY / dl;
      p.dashUntil = this.time + PLAYER.dashDuration;
      p.dashCdUntil = this.time + PLAYER.dashCooldown;
      p.invulnUntil = Math.max(p.invulnUntil, this.time + PLAYER.dashInvuln);
      this.camera.shake = Math.max(this.camera.shake, 3);
      this.emit('dash');
      this.puff(p.x, p.y, 8, this.map.palette.dust);
    }

    // --- aiming ----------------------------------------------------
    if (input && Number.isFinite(input.aimX)) {
      p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    }

    // --- reload ----------------------------------------------------
    if (input?.reload) this.startReload();
    if (p.reloading && this.time >= p.reloading.endsAt) {
      const gun = activeGun({ equipped: { loadout: [p.reloading.gunId], activeSlot: 0 } });
      this.mags[p.reloading.gunId] = gun.mag;
      this.emit('reloadend', { gunId: gun.id });
      p.reloading = null;
    }

    // --- weapon cycling -------------------------------------------
    if (input?.cycle) this.cycleWeapon();

    // --- shooting --------------------------------------------------
    p.heat = updateHeat(p.heat, this.gun, dt, false);
    p.muzzleFlash = Math.max(0, p.muzzleFlash - dt * 9);

    const gun = this.gun;
    const wantsFire = gun.auto ? Boolean(input?.firing) : Boolean(input?.fireEdge);
    if (wantsFire && this.phase !== PHASE.DEAD) {
      if (p.reloading) {
        /* busy */
      } else if (this.magAmmo <= 0) {
        if (this.time >= (p.nextShotAt || 0)) {
          this.emit('dryfire');
          p.nextShotAt = this.time + 0.28;
          this.startReload();
        }
      } else if (this.time >= p.nextShotAt) {
        this.shoot();
      }
    }
  }

  cycleWeapon() {
    const loadout = this.save.equipped.loadout;
    if (loadout.length < 2) return;
    const next = (this.save.equipped.activeSlot + 1) % loadout.length;
    this.save = { ...this.save, equipped: { ...this.save.equipped, activeSlot: next } };
    this.player.reloading = null;
    this.player.heat = 0;
    this.emit('swap', { gunId: loadout[next] });
  }

  selectSlot(index) {
    const loadout = this.save.equipped.loadout;
    if (index < 0 || index >= loadout.length) return;
    if (index === this.save.equipped.activeSlot) return;
    this.save = { ...this.save, equipped: { ...this.save.equipped, activeSlot: index } };
    this.player.reloading = null;
    this.emit('swap', { gunId: loadout[index] });
  }

  startReload() {
    const gun = this.gun;
    const p = this.player;
    if (p.reloading) return;
    if ((this.mags[gun.id] ?? 0) >= gun.mag) return;
    p.reloading = { gunId: gun.id, endsAt: this.time + gun.reload / 1000 };
    this.emit('reload', { gunId: gun.id, duration: gun.reload / 1000 });
  }

  shoot() {
    const p = this.player;
    const gun = this.gun;
    const muzzle = {
      x: p.x + Math.cos(p.angle) * (p.radius + 12),
      y: p.y + Math.sin(p.angle) * (p.radius + 12),
    };

    const shots = createShot(gun, muzzle, p.angle, p.heat, () => this.rng.next());
    for (const b of shots) {
      b.friendly = true;
      this.bullets.push(b);
    }

    this.mags[gun.id] = Math.max(0, (this.mags[gun.id] ?? 0) - 1);
    p.nextShotAt = this.time + gun.fireRate / 1000;
    p.heat = updateHeat(p.heat, gun, 0, true);
    p.muzzleFlash = 1;
    this.run.shotsFired += shots.length;

    // recoil shove
    p.vx -= Math.cos(p.angle) * gun.knockback * 0.16;
    p.vy -= Math.sin(p.angle) * gun.knockback * 0.16;

    this.camera.shake = Math.max(this.camera.shake, Math.min(9, 1.4 + gun.pellets * 0.5 + gun.damage * 0.02));
    this.muzzleParticles(muzzle.x, muzzle.y, p.angle);
    this.emit('shot', { gunId: gun.id });

    if (this.mags[gun.id] === 0) this.startReload();
  }

  /* ----------------------------------------------------------- enemies */

  spawnEnemy(typeId, at = null) {
    const type = getEnemyType(typeId);
    const scaled = scaleEnemy(type, Math.max(1, this.wave), this.map);
    const pos = at ?? findSpawnPoint(this.obstacles, this.player.x, this.player.y, this.rng, 340);
    const enemy = {
      id: uid('e'),
      typeId: type.id,
      def: type,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      radius: type.radius,
      hp: scaled.hp,
      maxHp: scaled.hp,
      damage: scaled.damage,
      speed: scaled.speed,
      coins: scaled.coins,
      angle: Math.atan2(this.player.y - pos.y, this.player.x - pos.x),
      cooldown: this.rng.range(0.4, 1.4),
      strafeDir: this.rng.chance(0.5) ? 1 : -1,
      strafeTimer: this.rng.range(1.2, 2.6),
      telegraph: 0,
      hitFlash: 0,
      spawnAnim: 0.4,
      kx: 0,
      ky: 0,
      behaviourTimer: this.rng.range(4, 8),
      charging: 0,
    };
    this.enemies.push(enemy);
    this.emit('spawn', { typeId: type.id, x: pos.x, y: pos.y });
    return enemy;
  }

  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const type = e.def;
      e.spawnAnim = Math.max(0, e.spawnAnim - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeDir *= -1;
        e.strafeTimer = this.rng.range(1.1, 2.8);
      }
      e.behaviourTimer -= dt;
      if (e.behaviourTimer <= 0) {
        e.behaviourTimer = this.rng.range(4, 8);
        e.strafeDir *= -1;
      }

      const d = dist(e.x, e.y, p.x, p.y);
      const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = rotateToward(e.angle, toPlayer, 6 * dt);

      let moveX = 0;
      let moveY = 0;
      const perp = e.angle + Math.PI / 2;
      const pref = type.preferredRange;
      const min = type.minRange;

      switch (type.behaviour) {
        case 'charge':
          if (d > min * 0.8) {
            moveX = Math.cos(toPlayer);
            moveY = Math.sin(toPlayer);
          }
          moveX += Math.cos(perp) * e.strafeDir * 0.3;
          moveY += Math.sin(perp) * e.strafeDir * 0.3;
          break;
        case 'advance':
          if (d > pref * 0.7) {
            moveX = Math.cos(toPlayer);
            moveY = Math.sin(toPlayer);
          }
          break;
        case 'circle':
          moveX = Math.cos(perp) * e.strafeDir;
          moveY = Math.sin(perp) * e.strafeDir;
          if (d > pref * 1.15) {
            moveX += Math.cos(toPlayer) * 0.8;
            moveY += Math.sin(toPlayer) * 0.8;
          } else if (d < min) {
            moveX -= Math.cos(toPlayer) * 0.8;
            moveY -= Math.sin(toPlayer) * 0.8;
          }
          break;
        case 'kite':
          if (d < min) {
            moveX = -Math.cos(toPlayer);
            moveY = -Math.sin(toPlayer);
          } else if (d > pref * 1.2) {
            moveX = Math.cos(toPlayer);
            moveY = Math.sin(toPlayer);
          } else {
            moveX = Math.cos(perp) * e.strafeDir * 0.7;
            moveY = Math.sin(perp) * e.strafeDir * 0.7;
          }
          break;
        case 'boss': {
          if (e.charging > 0) {
            e.charging -= dt;
            moveX = Math.cos(e.chargeAngle) * 1.7;
            moveY = Math.sin(e.chargeAngle) * 1.7;
          } else {
            moveX = Math.cos(perp) * e.strafeDir;
            moveY = Math.sin(perp) * e.strafeDir;
            if (d > pref) {
              moveX += Math.cos(toPlayer) * 0.9;
              moveY += Math.sin(toPlayer) * 0.9;
            } else if (d < min) {
              moveX -= Math.cos(toPlayer) * 0.9;
              moveY -= Math.sin(toPlayer) * 0.9;
            }
            if (e.behaviourTimer < 0.1) {
              e.charging = 0.7;
              e.chargeAngle = toPlayer;
              this.emit('bosscharge');
            }
          }
          break;
        }
        default: // strafe
          if (d > pref) {
            moveX = Math.cos(toPlayer);
            moveY = Math.sin(toPlayer);
          } else if (d < min) {
            moveX = -Math.cos(toPlayer) * 0.8;
            moveY = -Math.sin(toPlayer) * 0.8;
          }
          moveX += Math.cos(perp) * e.strafeDir * 0.85;
          moveY += Math.sin(perp) * e.strafeDir * 0.85;
          break;
      }

      const ml = Math.hypot(moveX, moveY) || 1;
      const speed = e.speed * (e.spawnAnim > 0 ? 0.3 : 1);
      e.vx = (moveX / ml) * speed + e.kx;
      e.vy = (moveY / ml) * speed + e.ky;
      e.kx *= Math.pow(0.0015, dt);
      e.ky *= Math.pow(0.0015, dt);

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = clamp(e.x, e.radius, WORLD.width - e.radius);
      e.y = clamp(e.y, e.radius, WORLD.height - e.radius);

      for (const o of this.obstacles) {
        if (!o.solid) continue;
        const r = resolveCircleRect(e.x, e.y, e.radius, o);
        if (r.hit) {
          e.x = r.x;
          e.y = r.y;
        }
      }

      // --- firing -------------------------------------------------
      e.cooldown -= dt;
      const maxRange = type.preferredRange * 1.7;
      const los = hasLineOfSight(this.obstacles, e.x, e.y, p.x, p.y);

      if (e.telegraph > 0) {
        e.telegraph -= dt;
        if (e.telegraph <= 0) {
          this.enemyFire(e);
          e.cooldown = type.fireRate / 1000;
        }
      } else if (e.cooldown <= 0 && los && d < maxRange && this.phase !== PHASE.DEAD) {
        if (type.telegraph) {
          e.telegraph = type.telegraph;
          this.emit('telegraph', { id: e.id });
        } else {
          this.enemyFire(e);
          e.cooldown = type.fireRate / 1000;
        }
      }
    }

    this.separateEnemies();
  }

  separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (minD - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }

  enemyFire(e) {
    const type = e.def;
    const pellets = type.pellets ?? 1;
    const base = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    for (let i = 0; i < pellets; i += 1) {
      const spread = (type.spread ?? 0) * (pellets > 1 ? (i / (pellets - 1) - 0.5) * 2 : 1);
      const angle = enemyShotAngle(base + spread, type.accuracy, () => this.rng.next());
      const speed = type.bulletSpeed;
      this.enemyBullets.push({
        x: e.x + Math.cos(angle) * (e.radius + 8),
        y: e.y + Math.sin(angle) * (e.radius + 8),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage: e.damage,
        splash: type.splash ?? 0,
        radius: BULLET.enemyRadius,
        lifetime: 3,
        travelled: 0,
        hostile: true,
        trail: [],
      });
    }
    this.emit('enemyshot', { typeId: type.id });
    this.muzzleParticles(e.x + Math.cos(base) * (e.radius + 8), e.y + Math.sin(base) * (e.radius + 8), base, 3, '#ffd27a');
  }

  /* ----------------------------------------------------------- bullets */

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      const px = b.x;
      const py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const step = Math.hypot(b.x - px, b.y - py);
      b.travelled += step;
      b.lifetime -= dt;

      let dead = b.lifetime <= 0 || b.travelled > b.range || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;

      if (!dead) {
        for (const o of this.obstacles) {
          if (!o.solid) continue;
          if (segmentHitsRect(px, py, b.x, b.y, o)) {
            this.hitObstacle(o, b);
            dead = true;
            break;
          }
        }
      }

      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
          const e = this.enemies[j];
          if (segmentHitsCircle(px, py, b.x, b.y, e.x, e.y, e.radius + b.radius)) {
            this.hitEnemy(e, b);
            b.hitsLeft -= 1;
            if (b.hitsLeft <= 0) {
              dead = true;
              break;
            }
          }
        }
      }

      if (dead) {
        if (b.splash > 0) this.explode(b.x, b.y, b.splash, b.damage * 1.4, 'player');
        this.bullets.splice(i, 1);
      }
    }
  }

  updateEnemyBullets(dt) {
    const p = this.player;
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = this.enemyBullets[i];
      const px = b.x;
      const py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.travelled += Math.hypot(b.x - px, b.y - py);
      b.lifetime -= dt;
      let dead = b.lifetime <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;

      if (!dead) {
        for (const o of this.obstacles) {
          if (!o.solid) continue;
          if (segmentHitsRect(px, py, b.x, b.y, o)) {
            this.impact(b.x, b.y, 4, '#d8c39a');
            dead = true;
            break;
          }
        }
      }

      if (!dead && this.phase !== PHASE.DEAD && segmentHitsCircle(px, py, b.x, b.y, p.x, p.y, p.radius + b.radius)) {
        this.damagePlayer(b.damage, b);
        dead = true;
      }

      if (dead) {
        if (b.splash > 0) this.explode(b.x, b.y, b.splash, b.damage, 'enemy');
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  hitEnemy(e, b) {
    const roll = this.rng.next();
    const crit = roll < b.critChance;
    const falloffStart = b.range * 0.55;
    let mult = 1;
    if (b.travelled > falloffStart) {
      const t = Math.min(1, (b.travelled - falloffStart) / Math.max(1, b.range - falloffStart));
      mult = 1 - t * 0.45;
    }
    const damage = Math.max(1, Math.round(b.damage * mult * (crit ? b.critMult : 1)));

    e.hp -= damage;
    e.hitFlash = 1;
    e.kx += Math.cos(Math.atan2(b.vy, b.vx)) * b.knockback * 0.35;
    e.ky += Math.sin(Math.atan2(b.vy, b.vx)) * b.knockback * 0.35;
    this.run.shotsHit += 1;

    this.floaters.push({
      x: e.x + this.rng.range(-6, 6),
      y: e.y - e.radius - 4,
      text: `${damage}`,
      crit,
      t: 0.85,
      vy: -46,
      colour: crit ? '#ffcf5a' : '#fff2d6',
    });
    this.impact(b.x, b.y, 6, '#c0392b');
    this.emit(crit ? 'crit' : 'hit', { damage });

    if (b.splash > 0) this.explode(b.x, b.y, b.splash, b.damage * 1.4, 'player', e.id);

    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    this.enemies.splice(idx, 1);

    const coins = coinsForKill(e.typeId, this.map);
    const bounty = bountyForKill(e.typeId, this.map);
    this.run.kills += 1;
    if (e.def.isBoss) this.run.bossKills += 1;

    this.dropLoot(e.x, e.y, coins, bounty, e.def.isBoss);
    this.blood(e.x, e.y, e.def.isBoss ? 34 : 14);
    this.camera.shake = Math.max(this.camera.shake, e.def.isBoss ? 18 : 4);
    this.emit('kill', { typeId: e.typeId, boss: Boolean(e.def.isBoss) });
  }

  hitObstacle(o, b) {
    if (!o.destructible) {
      this.impact(b.x, b.y, 5, '#e2d3ae');
      return;
    }
    o.hp -= b.damage;
    this.impact(b.x, b.y, 6, '#d9b877');
    if (o.hp <= 0) {
      const idx = this.obstacles.indexOf(o);
      if (idx !== -1) this.obstacles.splice(idx, 1);
      this.impact(o.x + o.w / 2, o.y + o.h / 2, 12, '#c8a165');
      if (o.explosive) this.explode(o.x + o.w / 2, o.y + o.h / 2, 130, 55, 'both');
      else if (this.rng.chance(0.5)) this.dropLoot(o.x + o.w / 2, o.y + o.h / 2, 6, 0, false);
    }
  }

  explode(x, y, radius, damage, source = 'player', ignoreId = null) {
    this.camera.shake = Math.max(this.camera.shake, 14);
    this.emit('explosion', { x, y, radius });
    for (let i = 0; i < 26; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(60, 320);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        t: this.rng.range(0.3, 0.8),
        max: 0.8,
        size: this.rng.range(3, 11),
        colour: this.rng.pick(['#ffcf6a', '#ff8f3c', '#c0392b', '#5b4a3a']),
        gravity: 0.6,
      });
    }
    this.particles.push({ x, y, vx: 0, vy: 0, t: 0.32, max: 0.32, size: radius, colour: 'rgba(255,190,110,0.35)', ring: true });

    if (source !== 'enemy') {
      for (const e of [...this.enemies]) {
        if (e.id === ignoreId) continue;
        const d = dist(x, y, e.x, e.y);
        if (d > radius + e.radius) continue;
        const falloff = 1 - Math.min(1, d / (radius + e.radius)) * 0.6;
        const dmg = Math.round(damage * falloff);
        e.hp -= dmg;
        e.hitFlash = 1;
        const a = Math.atan2(e.y - y, e.x - x);
        e.kx += Math.cos(a) * 420 * falloff;
        e.ky += Math.sin(a) * 420 * falloff;
        this.floaters.push({ x: e.x, y: e.y - e.radius, text: `${dmg}`, crit: false, t: 0.8, vy: -40, colour: '#ffb26a' });
        if (e.hp <= 0) this.killEnemy(e);
      }
    }

    if (source !== 'player') {
      const d = dist(x, y, this.player.x, this.player.y);
      if (d < radius + this.player.radius) {
        this.damagePlayer(Math.round(damage * (1 - (d / (radius + this.player.radius)) * 0.5)));
      }
    }

    // chain powder kegs
    for (const o of [...this.obstacles]) {
      if (!o.destructible) continue;
      const cx = o.x + o.w / 2;
      const cy = o.y + o.h / 2;
      if (dist(x, y, cx, cy) > radius + Math.max(o.w, o.h) / 2) continue;
      o.hp -= damage;
        if (o.hp <= 0) {
        const idx = this.obstacles.indexOf(o);
        if (idx !== -1) this.obstacles.splice(idx, 1);
        if (o.explosive) this.explode(cx, cy, 120, 50, 'both');
      }
    }
  }

  damagePlayer(amount, from = null) {
    const p = this.player;
    if (this.phase === PHASE.DEAD) return;
    if (this.time < p.invulnUntil) return;
    p.hp -= amount;
    p.hurtFlash = 1;
    p.invulnUntil = this.time + PLAYER.invulnAfterHit;
    this.camera.shake = Math.max(this.camera.shake, Math.min(16, 4 + amount * 0.2));
    this.emit('hurt', { amount });
    if (from && from.x !== undefined) {
      const a = Math.atan2(p.y - from.y, p.x - from.x);
      p.vx += Math.cos(a) * 130;
      p.vy += Math.sin(a) * 130;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.phase = PHASE.DEAD;
      this.emit('dead', { kills: this.run.kills, wave: this.wave });
    }
  }

  /* ----------------------------------------------------------- pickups */

  dropLoot(x, y, coins, bounty, isBoss) {
    const piles = Math.max(1, Math.min(isBoss ? 10 : 5, Math.ceil(coins / 14)));
    const each = coins / piles;
    for (let i = 0; i < piles; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(0, 26);
      this.pickups.push({
        id: uid('p'),
        kind: 'coin',
        value: each,
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: Math.cos(a) * 60,
        vy: Math.sin(a) * 60,
        t: PICKUP.lifetime,
        spin: this.rng.range(0, 6),
      });
    }
    if (bounty > 0) {
      for (let i = 0; i < bounty; i += 1) {
        this.pickups.push({
          id: uid('p'),
          kind: 'bounty',
          value: 1,
          x: x + this.rng.range(-20, 20),
          y: y + this.rng.range(-20, 20),
          vx: 0,
          vy: 0,
          t: PICKUP.lifetime,
          spin: 0,
        });
      }
    }
    if (this.rng.chance(isBoss ? 1 : 0.09)) {
      this.pickups.push({ id: uid('p'), kind: 'ammo', value: PICKUP.ammoCrateMagRefill, x, y: y + 14, vx: 0, vy: 0, t: PICKUP.lifetime, spin: 0 });
    }
    if (this.rng.chance(isBoss ? 1 : this.player.hp < this.player.maxHp * 0.6 ? 0.14 : 0.05)) {
      this.pickups.push({ id: uid('p'), kind: 'health', value: PICKUP.healthFlaskHeal, x: x + 16, y: y - 10, vx: 0, vy: 0, t: PICKUP.lifetime, spin: 0 });
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const k = this.pickups[i];
      k.t -= dt;
      k.spin += dt * 4;
      if (k.t <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }

      const d = dist(k.x, k.y, p.x, p.y);
      if (k.kind === 'coin' && d < PLAYER.pickupMagnetRange) {
        const a = Math.atan2(p.y - k.y, p.x - k.x);
        const pull = 320 * (1 - d / PLAYER.pickupMagnetRange) + 60;
        k.vx = Math.cos(a) * pull;
        k.vy = Math.sin(a) * pull;
      } else if (k.kind === 'coin') {
        k.vx *= Math.pow(0.02, dt);
        k.vy *= Math.pow(0.02, dt);
      }

      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.x = clamp(k.x, 8, WORLD.width - 8);
      k.y = clamp(k.y, 8, WORLD.height - 8);

      if (d < p.radius + 14) {
        this.collect(k);
        this.pickups.splice(i, 1);
      }
    }
  }

  collect(k) {
    const p = this.player;
    if (k.kind === 'coin') {
      this.run.coins += k.value;
      this.emit('coin', { value: k.value });
    } else if (k.kind === 'bounty') {
      this.run.bounty += k.value;
      this.emit('bounty', { value: k.value });
    } else if (k.kind === 'health') {
      p.hp = Math.min(p.maxHp, p.hp + k.value);
      this.floaters.push({ x: p.x, y: p.y - 24, text: `+${k.value}`, crit: false, t: 0.9, vy: -34, colour: '#7fd07a' });
      this.emit('heal', { value: k.value });
    } else if (k.kind === 'ammo') {
      for (const id of this.save.equipped.loadout) {
        const gun = activeGun({ equipped: { loadout: [id], activeSlot: 0 } });
        this.mags[id] = gun.mag;
      }
      p.reloading = null;
      this.floaters.push({ x: p.x, y: p.y - 24, text: 'AMMO', crit: false, t: 0.9, vy: -34, colour: '#e8c789' });
      this.emit('ammo', {});
    }
  }

  /* --------------------------------------------------------- particles */

  puff(x, y, n, colour) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(20, 90);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        t: this.rng.range(0.25, 0.6),
        max: 0.6,
        size: this.rng.range(2, 6),
        colour,
        gravity: 0,
      });
    }
  }

  impact(x, y, n, colour) {
    this.puff(x, y, n, colour);
  }

  blood(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(30, 220);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        t: this.rng.range(0.3, 0.9),
        max: 0.9,
        size: this.rng.range(2, 7),
        colour: this.rng.pick(['#8e2b20', '#b03a2a', '#6d2118']),
        gravity: 1.4,
      });
    }
  }

  muzzleParticles(x, y, angle, n = 7, colour = '#ffd27a') {
    for (let i = 0; i < n; i += 1) {
      const a = angle + this.rng.range(-0.4, 0.4);
      const s = this.rng.range(120, 340);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        t: this.rng.range(0.05, 0.18),
        max: 0.18,
        size: this.rng.range(2, 5),
        colour,
        gravity: 0,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const pt = this.particles[i];
      pt.t -= dt;
      if (pt.t <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (!pt.ring) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.gravity) pt.vy += pt.gravity * 260 * dt;
        pt.vx *= Math.pow(0.25, dt);
        pt.vy *= Math.pow(0.25, dt);
      }
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);

    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.t -= dt;
      f.y += f.vy * dt;
      f.vy *= Math.pow(0.2, dt);
      if (f.t <= 0) this.floaters.splice(i, 1);
    }
  }

  /* -------------------------------------------------------------- wave */

  startWave(n) {
    this.wave = n;
    this.waveOrders = planWave(n, this.map);
    this.waveTotal = totalEnemiesIn(this.waveOrders);
    this.waveQueue = [];
    let spawned = 0;
    for (const order of this.waveOrders) {
      for (let i = 0; i < order.count; i += 1) {
        this.waveQueue.push({
          typeId: order.type,
          at: order.delay + (spawned * 0.42) / this.map.spawnRate,
          spawned: false,
        });
        spawned += 1;
      }
    }
    this.waveStartTime = this.time;
    this.waveKilled = 0;
    this.phase = PHASE.WAVE;
    this.announce = { title: `Wave ${n}`, sub: `${this.waveTotal} hostiles`, t: 2.2 };
    this.emit('wavestart', { wave: n, total: this.waveTotal });
  }

  updateWave(dt) {
    if (this.phase === PHASE.WARMUP) {
      this.warmupTime -= dt;
      if (this.warmupTime <= 0) this.startWave(1);
      return;
    }

    if (this.phase === PHASE.INTERMISSION) {
      this.intermissionTime -= dt;
      if (this.intermissionTime <= 0) this.startWave(this.wave + 1);
      return;
    }

    if (this.phase !== PHASE.WAVE) return;

    const elapsed = this.time - this.waveStartTime;
    const activeCap = WAVES.maxActiveEnemies;
    for (const item of this.waveQueue) {
      if (item.spawned) continue;
      if (elapsed < item.at) continue;
      if (this.enemies.length >= activeCap) continue;
      item.spawned = true;
      this.spawnEnemy(item.typeId);
    }

    const allSpawned = this.waveQueue.every((i) => i.spawned);
    if (allSpawned && this.enemies.length === 0) this.completeWave();
  }

  completeWave() {
    const bonus = waveClearBonus(this.wave, this.map);
    this.run.coins += bonus;
    this.run.wavesCleared += 1;
    this.emit('waveclear', { wave: this.wave, bonus });

    if (this.wave >= this.map.waves) {
      const reward = mapClearReward(this.map);
      this.run.coins += reward.coins;
      this.run.bounty += reward.bounty;
      this.phase = PHASE.CLEARED;
      this.announce = { title: `${this.map.name} cleared`, sub: `+$${reward.coins} and ${reward.bounty} bounty`, t: 4 };
      this.emit('mapclear', { mapId: this.map.id, reward });
      return;
    }

    this.phase = PHASE.INTERMISSION;
    this.intermissionTime = WAVES.intermissionSeconds;
    this.announce = { title: `Wave ${this.wave} cleared`, sub: `+$${bonus} — restock at the shop`, t: 3 };
    // small breather heal
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
    this.emit('intermission', { seconds: this.intermissionTime });
  }

  skipIntermission() {
    if (this.phase !== PHASE.INTERMISSION) return;
    this.intermissionTime = 0;
    this.startWave(this.wave + 1);
  }

  /* ------------------------------------------------------------ camera */

  updateCamera(dt) {
    const c = this.camera;
    const targetX = clamp(this.player.x, WORLD.width / 2, WORLD.width - WORLD.width / 2);
    const targetY = clamp(this.player.y, WORLD.height / 2, WORLD.height - WORLD.height / 2);
    c.x += (targetX - c.x) * Math.min(1, 8 * dt);
    c.y += (targetY - c.y) * Math.min(1, 8 * dt);
    c.shake = Math.max(0, c.shake - dt * 26);
  }

  /* ------------------------------------------------------------- query */

  /**
   * Bank everything earned this run into the save.
   * Called on death and on map clear. Returns the updated save.
   */
  bankRun(save) {
    const coins = Math.round(this.run.coins);
    const bounty = Math.round(this.run.bounty);
    const next = applyReward(save, { coins, bounty });

    const stats = { ...next.stats };
    stats.runs += 1;
    stats.kills += this.run.kills;
    stats.bossKills += this.run.bossKills;
    stats.shotsFired += this.run.shotsFired;
    stats.shotsHit += this.run.shotsHit;
    stats.highestWave = Math.max(stats.highestWave, this.wave);
    if (this.phase === PHASE.DEAD) stats.deaths += 1;

    const clearedMaps = [...(next.clearedMaps ?? [])];
    let mapsCleared = stats.mapsCleared;
    if (this.phase === PHASE.CLEARED && !clearedMaps.includes(this.map.id)) {
      clearedMaps.push(this.map.id);
      mapsCleared += 1;
    }
    stats.mapsCleared = mapsCleared;

    const best = { ...next.best };
    const prev = best[this.map.id] ?? { wave: 0, kills: 0, coins: 0 };
    best[this.map.id] = {
      wave: Math.max(prev.wave, this.wave),
      kills: Math.max(prev.kills, this.run.kills),
      coins: Math.max(prev.coins, coins),
    };

    return { ...next, stats, clearedMaps, best };
  }
}
