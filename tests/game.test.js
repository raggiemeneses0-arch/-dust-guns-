/**
 * Integration tests. These drive the real Game class headlessly -- no DOM,
 * no stubs -- so the wave director, collisions, economy and bankRun that
 * ship in src/game/game.js are the code actually being executed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLD } from '../src/config.js';
import { Game, PHASE } from '../src/game/game.js';
import { createDefaultSave } from '../src/core/save.js';
import { MAPS, buildMapGeometry } from '../src/data/maps.js';
import { getEnemyType, planWave, totalEnemiesIn } from '../src/data/enemies.js';
import { getGun, STARTER_GUN_ID } from '../src/data/guns.js';
import { buyGun } from '../src/core/store.js';

const DT = 1 / 60;

/** Aim at the nearest enemy, back off when it gets close, hold the trigger. */
function combatInput(game) {
  const p = game.player;
  let target = null;
  let best = Infinity;
  for (const e of game.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < best) {
      best = d;
      target = e;
    }
  }
  let moveX = 0;
  let moveY = 0;
  let aimX = p.x + Math.cos(p.angle) * 100;
  let aimY = p.y + Math.sin(p.angle) * 100;

  if (target) {
    aimX = target.x;
    aimY = target.y;
    const away = Math.atan2(p.y - target.y, p.x - target.x);
    if (best < 170) {
      moveX = Math.cos(away);
      moveY = Math.sin(away);
    } else {
      moveX = Math.cos(away + Math.PI / 2);
      moveY = Math.sin(away + Math.PI / 2);
    }
  }
  return {
    moveX,
    moveY,
    aimX,
    aimY,
    firing: true,
    fireEdge: true,
    sprint: false,
    reload: false,
    dash: false,
    cycle: false,
  };
}

function run(game, frames, inputFor = combatInput) {
  for (let i = 0; i < frames; i += 1) {
    game.update(DT, inputFor(game));
    game.drainEvents();
  }
}

function newGame(mapId = 'main-street', save = createDefaultSave(), seed = 'test-seed') {
  return new Game({ save, mapId, seed });
}

/** Godmode helper so long-run assertions are about systems, not about dying. */
function godmode(game) {
  game.player.maxHp = 100000;
  game.player.hp = 100000;
}

test('every map boots into a valid world', () => {
  for (const m of MAPS) {
    const game = newGame(m.id, createDefaultSave(), `boot-${m.id}`);
    assert.equal(game.map.id, m.id);
    assert.equal(game.phase, PHASE.WARMUP);
    assert.equal(game.wave, 0);
    assert.equal(game.enemies.length, 0);
    assert.ok(game.obstacles.length >= m.structures.length);
    assert.equal(game.gun.id, STARTER_GUN_ID);
    assert.equal(game.magAmmo, getGun(STARTER_GUN_ID).mag);
    assert.ok(game.player.x > 0 && game.player.y > 0);
  }
});

test('the warmup rolls into wave 1 and spawns exactly the planned enemies', () => {
  const game = newGame();
  const map = game.map;
  assert.equal(game.phase, PHASE.WARMUP);

  // warmup is 4s; run 5s of frames
  run(game, 60 * 5);
  assert.equal(game.phase, PHASE.WAVE);
  assert.equal(game.wave, 1);
  const planned = totalEnemiesIn(planWave(1, map));
  assert.equal(game.waveTotal, planned);
  assert.equal(game.waveQueue.length, planned);
  assert.ok(game.enemies.length > 0, 'wave 1 should have started spawning');
  assert.ok(game.enemies.length <= planned);
});

test('a full wave is fought to completion and pays a bonus', () => {
  const save = createDefaultSave();
  const game = newGame('main-street', save, 'full-wave');
  godmode(game);

  run(game, 60 * 5); // finish warmup
  const waveBonusStart = game.run.coins;
  let guard = 0;
  while (game.phase === PHASE.WAVE && guard < 60 * 240) {
    game.update(DT, combatInput(game));
    game.drainEvents();
    guard += 1;
  }

  assert.notEqual(game.phase, PHASE.WAVE, 'wave 1 never finished');
  assert.equal(game.run.wavesCleared, 1);
  assert.ok(game.run.kills > 0, 'nothing was killed');
  assert.ok(game.run.shotsFired > 0);
  assert.ok(game.run.shotsHit > 0, 'shots were fired but none connected');
  assert.ok(game.run.coins > waveBonusStart, 'no coins were earned');
  assert.equal(game.enemies.length, 0);
  assert.equal(game.phase, PHASE.INTERMISSION, 'should rest between waves');
  assert.ok(game.intermissionTime > 0);
});

test('killing everything across a short map clears it and banks the reward', () => {
  const game = newGame('main-street', createDefaultSave(), 'clear-run');
  game.map = { ...game.map, waves: 2 }; // shorten, exercises the real clear path
  godmode(game);

  let guard = 0;
  while (game.phase !== PHASE.CLEARED && guard < 60 * 60 * 3) {
    game.update(DT, combatInput(game));
    game.drainEvents();
    guard += 1;
  }

  assert.equal(game.phase, PHASE.CLEARED, 'map never cleared');
  assert.equal(game.run.wavesCleared, 2);

  const before = createDefaultSave();
  const after = game.bankRun(before);
  assert.equal(after.coins, before.coins + Math.round(game.run.coins));
  assert.deepEqual(after.clearedMaps, ['main-street']);
  assert.equal(after.stats.runs, 1);
  assert.equal(after.stats.kills, game.run.kills);
  assert.equal(after.stats.mapsCleared, 1);
  assert.equal(after.best['main-street'].wave, 2);
});

test('bankRun after a death records the loss but keeps the coins', () => {
  const game = newGame();
  run(game, 60 * 6);
  game.run.coins = 123;
  game.run.bounty = 1;
  game.run.kills = 4;
  game.phase = PHASE.DEAD;

  const before = createDefaultSave();
  const after = game.bankRun(before);
  assert.equal(after.coins, 123);
  assert.equal(after.bounty, 1);
  assert.equal(after.stats.deaths, 1);
  assert.equal(after.stats.runs, 1);
  assert.deepEqual(after.clearedMaps, [], 'a death must not clear the map');
});

test('the player dies when shot enough times', () => {
  const game = newGame();
  run(game, 60 * 6);
  assert.ok(game.enemies.length > 0);

  let guard = 0;
  const standStill = () => ({ moveX: 0, moveY: 0, aimX: game.player.x, aimY: game.player.y, firing: false, fireEdge: false, sprint: false, reload: false, dash: false, cycle: false });
  while (game.phase !== PHASE.DEAD && guard < 60 * 180) {
    game.player.invulnUntil = -1; // strip i-frames so this test terminates
    game.update(DT, standStill());
    game.drainEvents();
    guard += 1;
  }
  assert.equal(game.phase, PHASE.DEAD);
  assert.equal(game.player.hp, 0);
});

test('shooting drains the magazine, dry-fires, and reload refills it', () => {
  const game = newGame();
  const gun = game.gun;
  assert.equal(game.magAmmo, gun.mag);

  const aimUp = () => ({ moveX: 0, moveY: 0, aimX: game.player.x + 100, aimY: game.player.y, firing: true, fireEdge: true, sprint: false, reload: false, dash: false, cycle: false });
  run(game, 30, aimUp);
  assert.ok(game.magAmmo < gun.mag, 'magazine did not drain');
  assert.ok(game.run.shotsFired > 0);

  // empty it
  for (let i = 0; i < 400 && game.magAmmo > 0; i += 1) {
    game.update(DT, aimUp());
    game.drainEvents();
  }
  assert.equal(game.magAmmo, 0);
  assert.ok(game.player.reloading, 'an empty gun should auto-reload');

  const reloadSeconds = gun.reload / 1000;
  run(game, Math.ceil((reloadSeconds + 0.1) * 60), () => ({ moveX: 0, moveY: 0, aimX: game.player.x, aimY: game.player.y, firing: false, fireEdge: false, sprint: false, reload: false, dash: false, cycle: false }));
  assert.equal(game.player.reloading, null);
  assert.equal(game.magAmmo, gun.mag, 'reload did not refill');
});

test('nothing ever escapes the arena or turns into NaN', () => {
  const game = newGame('rail-yard', createDefaultSave(), 'bounds');
  godmode(game);
  run(game, 60 * 45);

  const check = (label, x, y) => {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `${label} went NaN`);
    assert.ok(x >= -20 && x <= WORLD.width + 20, `${label} escaped horizontally: ${x}`);
    assert.ok(y >= -20 && y <= WORLD.height + 20, `${label} escaped vertically: ${y}`);
  };
  check('player', game.player.x, game.player.y);
  for (const e of game.enemies) check(`enemy ${e.typeId}`, e.x, e.y);
  for (const b of game.bullets) check('bullet', b.x, b.y);
  for (const b of game.enemyBullets) check('enemy bullet', b.x, b.y);
  for (const k of game.pickups) check('pickup', k.x, k.y);
  assert.ok(Number.isFinite(game.player.hp));
  assert.ok(game.particles.length <= 700 + 40, 'particle pool grew without bound');
});

test('enemies never spawn inside solid geometry', () => {
  for (const m of MAPS) {
    const game = newGame(m.id, createDefaultSave(), `spawn-${m.id}`);
    godmode(game);
    run(game, 60 * 20);
    const { obstacles } = buildMapGeometry(m.id, game.seed);
    for (const e of game.enemies) {
      const inside = obstacles.some(
        (o) => o.solid && e.x > o.x + 4 && e.x < o.x + o.w - 4 && e.y > o.y + 4 && e.y < o.y + o.h - 4,
      );
      assert.equal(inside, false, `${m.id} enemy centre is inside a ${e.typeId}`);
    }
  }
});

test('kills pay coins that scale with the map payout multiplier', () => {
  const easy = newGame('main-street', createDefaultSave(), 'pay-easy');
  const hard = newGame('sunset-mesa', createDefaultSave(), 'pay-hard');
  godmode(easy);
  godmode(hard);
  run(easy, 60 * 40);
  run(hard, 60 * 40);
  assert.ok(easy.run.kills > 0 && hard.run.kills > 0, 'both runs need kills to compare');
  const perEasy = easy.run.coins / easy.run.kills;
  const perHard = hard.run.coins / hard.run.kills;
  assert.ok(perHard > perEasy, `hard map pays ${perHard} vs easy ${perEasy}`);
});

test('weapon cycling switches the gun in hand and resets the reload', () => {
  let save = createDefaultSave();
  save = buyGun({ ...save, coins: 5000 }, 'coach-gun').save;
  assert.equal(save.equipped.activeSlot, 1, 'a new purchase goes in hand');

  const game = newGame('main-street', save, 'cycle');
  const carried = game.gun.id; // coach-gun, the active slot
  game.player.reloading = { gunId: carried, endsAt: 999 };

  game.selectSlot(0);
  assert.notEqual(game.gun.id, carried, 'slot 0 should hold the starter gun');
  assert.equal(game.gun.id, STARTER_GUN_ID);
  assert.equal(game.player.reloading, null, 'cycling cancels a reload');

  game.selectSlot(1);
  assert.equal(game.gun.id, carried);

  game.selectSlot(99); // out of range is a no-op, not a crash
  assert.equal(game.gun.id, carried);
  assert.equal(game.save.equipped.activeSlot, 1);
});

test('setSave keeps magazines for newly added guns', () => {
  const game = newGame();
  let save = buyGun({ ...createDefaultSave(), coins: 5000 }, 'henry-repeater').save;
  game.setSave(save);
  assert.equal(game.mags['henry-repeater'], getGun('henry-repeater').mag);
  assert.equal(game.mags[STARTER_GUN_ID], getGun(STARTER_GUN_ID).mag);
});

test('exploding a powder keg damages nearby enemies', () => {
  const game = newGame('main-street', createDefaultSave(), 'keg');
  godmode(game);
  run(game, 60 * 6);
  assert.ok(game.enemies.length > 0);

  const enemy = game.enemies[0];
  enemy.hp = enemy.maxHp;
  const before = enemy.hp;
  const nearby = game.enemies.filter((e) => Math.hypot(e.x - enemy.x, e.y - enemy.y) < 60);
  for (const e of nearby) e.hp = e.maxHp;

  game.explode(enemy.x, enemy.y, 150, 400, 'player');
  assert.ok(enemy.hp < before || game.enemies.indexOf(enemy) === -1, 'blast did nothing to a point-blank enemy');
});

test('destructible cover breaks and is removed from the world', () => {
  const game = newGame('main-street', createDefaultSave(), 'cover');
  const crate = game.obstacles.find((o) => o.destructible);
  assert.ok(crate, 'main street should have destructible cover');
  const before = game.obstacles.length;

  crate.hp = 1;
  game.hitObstacle(crate, { damage: 50, x: crate.x, y: crate.y });
  assert.equal(game.obstacles.length, before - 1, 'crate should be gone');
  assert.equal(game.obstacles.includes(crate), false);
});

test('the intermission can be skipped and starts the next wave', () => {
  const game = newGame();
  godmode(game);
  run(game, 60 * 5);
  let guard = 0;
  while (game.phase === PHASE.WAVE && guard < 60 * 240) {
    game.update(DT, combatInput(game));
    game.drainEvents();
    guard += 1;
  }
  assert.equal(game.phase, PHASE.INTERMISSION);
  const wave = game.wave;
  game.skipIntermission();
  assert.equal(game.phase, PHASE.WAVE);
  assert.equal(game.wave, wave + 1);
});

test('later waves deploy the nastier archetypes', () => {
  const game = newGame('sunset-mesa', createDefaultSave(), 'roster-late');
  godmode(game);
  game.startWave(game.map.waves);
  const types = new Set(game.waveQueue.map((q) => q.typeId));
  assert.ok(types.has('boss'), 'final wave must include the boss');
  const lateWaveTypes = new Set(planWave(game.map.waves, game.map).map((o) => o.type));
  const earlyWaveTypes = new Set(planWave(1, game.map).map((o) => o.type));
  assert.ok(lateWaveTypes.size >= earlyWaveTypes.size, 'late waves should not be less varied');
  assert.ok(getEnemyType('boss').isBoss);
});

test('pickups are collected and credited', () => {
  const game = newGame();
  godmode(game);
  game.player.hp = 10;
  game.dropLoot(game.player.x, game.player.y, 100, 2, true);
  assert.ok(game.pickups.length >= 3, 'boss loot should drop coins, bounty, ammo and health');

  const before = game.run.coins;
  run(game, 60 * 3, () => ({ moveX: 0, moveY: 0, aimX: game.player.x, aimY: game.player.y, firing: false, fireEdge: false, sprint: false, reload: false, dash: false, cycle: false }));
  assert.ok(game.run.coins > before, 'coins were not collected');
  assert.equal(game.run.bounty, 2, 'bounty stars were not collected');
  assert.equal(game.pickups.length, 0, 'loot should be swept up');
  assert.ok(game.player.hp > 10, 'health flask did not heal');
});
