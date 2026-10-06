import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLD } from '../src/config.js';
import {
  FINAL_MAP_ID,
  FIRST_MAP_ID,
  MAPS,
  MAP_IDS,
  PROP_KINDS,
  buildMapGeometry,
  findSpawnPoint,
  getMap,
  getMapOrDefault,
  mapUnlockStatus,
  pointInsideObstacle,
} from '../src/data/maps.js';
import { makeRng } from '../src/core/rng.js';
import { PLAYER_SKINS, GUN_SKINS, DEFAULT_GUN_SKIN, DEFAULT_PLAYER_SKIN, getPlayerSkin, getGunSkin } from '../src/data/skins.js';
import { createDefaultSave } from '../src/core/save.js';

test('maps have unique ids, rising difficulty and rising payout', () => {
  const ids = new Set();
  let prevDifficulty = 0;
  let prevReward = 0;
  for (const m of MAPS) {
    assert.ok(!ids.has(m.id), `duplicate map ${m.id}`);
    ids.add(m.id);
    assert.ok(m.waves >= 6, `${m.id} needs a real wave count`);
    assert.ok(m.enemyScale >= 1, `${m.id} enemyScale`);
    assert.ok(m.rewardScale >= 1, `${m.id} rewardScale`);
    assert.ok(m.palette.ground && m.palette.obstacle && m.palette.vignette, `${m.id} palette`);
    assert.ok(m.difficulty >= prevDifficulty, `${m.id} difficulty regresses`);
    assert.ok(m.rewardScale >= prevReward, `${m.id} payout regresses`);
    prevDifficulty = m.difficulty;
    prevReward = m.rewardScale;
  }
  assert.equal(MAP_IDS.length, MAPS.length);
  assert.equal(getMap(FIRST_MAP_ID).unlock.kind, 'free', 'first map must be free');
  assert.equal(FINAL_MAP_ID, MAPS[MAPS.length - 1].id);
  assert.equal(getMap('nowhere'), null);
  assert.equal(getMapOrDefault('nowhere').id, FIRST_MAP_ID);
});

test('every non-first map chains off a map that exists before it', () => {
  for (let i = 1; i < MAPS.length; i += 1) {
    const m = MAPS[i];
    assert.equal(m.unlock.kind, 'clear', `${m.id} should unlock by clearing`);
    assert.equal(m.unlock.mapId, MAPS[i - 1].id, `${m.id} must chain off ${MAPS[i - 1].id}`);
    assert.ok(m.unlock.cost > MAPS[i - 1].unlock.cost || MAPS[i - 1].unlock.kind === 'free', `${m.id} cost should rise`);
  }
});

test('every structure/scatter prop kind is defined and sanely specified', () => {
  for (const m of MAPS) {
    for (const s of m.structures) {
      assert.ok(PROP_KINDS[s.kind], `${m.id} unknown structure ${s.kind}`);
      assert.ok(s.x >= 0 && s.x <= 1, `${m.id} ${s.kind} x out of range`);
      assert.ok(s.y >= 0 && s.y <= 1, `${m.id} ${s.kind} y out of range`);
      assert.ok(s.w > 0 && s.h > 0, `${m.id} ${s.kind} degenerate`);
      assert.ok(s.x + s.w <= 1.001, `${m.id} ${s.kind} overflows right`);
      assert.ok(s.y + s.h <= 1.001, `${m.id} ${s.kind} overflows bottom`);
    }
    for (const s of m.scatter) {
      assert.ok(PROP_KINDS[s.kind], `${m.id} unknown scatter ${s.kind}`);
      assert.ok(s.count > 0, `${m.id} ${s.kind} scatter count`);
      assert.ok(s.w > 0 && s.w <= 0.2, `${m.id} ${s.kind} scatter width`);
      assert.ok(s.h > 0 && s.h <= 0.2, `${m.id} ${s.kind} scatter height`);
    }
    for (const p of m.props) assert.ok(PROP_KINDS[p], `${m.id} unknown prop ${p}`);
  }
});

test('no hand-placed structure sits on the player spawn', () => {
  const pad = 34;
  const safe = {
    x: WORLD.width * 0.44 - pad,
    y: WORLD.height * 0.78 - pad,
    w: WORLD.width * 0.12 + pad * 2,
    h: WORLD.height * 0.16 + pad * 2,
  };
  for (const m of MAPS) {
    for (const s of m.structures) {
      const r = { x: s.x * WORLD.width, y: s.y * WORLD.height, w: s.w * WORLD.width, h: s.h * WORLD.height };
      const overlaps = r.x < safe.x + safe.w && r.x + r.w > safe.x && r.y < safe.y + safe.h && r.y + r.h > safe.y;
      assert.equal(overlaps, false, `${m.id} ${s.kind} covers the spawn square`);
    }
  }
});

test('geometry builds inside the world and is deterministic per seed', () => {
  for (const m of MAPS) {
    const a = buildMapGeometry(m.id, 'fixed-seed');
    const b = buildMapGeometry(m.id, 'fixed-seed');
    assert.ok(a.obstacles.length >= m.structures.length, `${m.id} lost structures`);
    assert.equal(a.obstacles.length, b.obstacles.length, `${m.id} not deterministic`);
    assert.deepEqual(
      a.obstacles.map((o) => [Math.round(o.x), Math.round(o.y), o.kind]),
      b.obstacles.map((o) => [Math.round(o.x), Math.round(o.y), o.kind]),
    );

    for (const o of a.obstacles) {
      assert.ok(o.solid, `${m.id} obstacle list holds a non-solid prop`);
      assert.ok(o.w > 0 && o.h > 0, `${m.id} degenerate obstacle`);
      assert.ok(o.x >= 0 && o.y >= 0, `${m.id} obstacle outside world`);
      assert.ok(o.x + o.w <= WORLD.width + 1, `${m.id} obstacle overflows right`);
      assert.ok(o.y + o.h <= WORLD.height + 1, `${m.id} obstacle overflows bottom`);
    }
    for (const d of a.decor) assert.equal(d.solid, false, `${m.id} decor should not block`);

    // a different seed must produce a different scatter
    const c = buildMapGeometry(m.id, 'other-seed');
    const same = JSON.stringify(a.obstacles.map((o) => [o.x, o.y])) === JSON.stringify(c.obstacles.map((o) => [o.x, o.y]));
    assert.equal(same, false, `${m.id} scatter ignored the seed`);
  }
});

test('the player start square is kept clear of solid props', () => {
  const start = { x: WORLD.width * 0.5, y: WORLD.height * 0.84 };
  for (const m of MAPS) {
    const { obstacles } = buildMapGeometry(m.id, 'seed-check');
    assert.equal(
      pointInsideObstacle(obstacles, start.x, start.y, start.radius ?? 16),
      false,
      `${m.id} spawns the player inside geometry`,
    );
  }
});

test('spawn points land in bounds, away from the player and out of walls', () => {
  const rng = makeRng('spawns');
  for (const m of MAPS) {
    const { obstacles } = buildMapGeometry(m.id, 'seed-check');
    for (let i = 0; i < 60; i += 1) {
      const p = findSpawnPoint(obstacles, WORLD.width / 2, WORLD.height * 0.84, rng, 340);
      assert.ok(p.x >= 0 && p.x <= WORLD.width, `${m.id} spawn x`);
      assert.ok(p.y >= 0 && p.y <= WORLD.height, `${m.id} spawn y`);
      assert.ok(Math.hypot(p.x - WORLD.width / 2, p.y - WORLD.height * 0.84) >= 340, `${m.id} spawn too close`);
      assert.equal(pointInsideObstacle(obstacles, p.x, p.y, 10), false, `${m.id} spawn inside a wall`);
    }
  }
});

test('map unlock status reflects clears and purchases', () => {
  const save = createDefaultSave();
  const second = MAPS[1];
  assert.equal(mapUnlockStatus(MAPS[0], save).unlocked, true);
  assert.equal(mapUnlockStatus(second, save).unlocked, false);

  assert.equal(mapUnlockStatus(second, { ...save, clearedMaps: [MAPS[0].id] }).unlocked, true);
  assert.equal(mapUnlockStatus(second, { ...save, boughtMaps: [second.id] }).unlocked, true);
  const locked = mapUnlockStatus(second, save);
  assert.equal(locked.reason, 'locked');
  assert.equal(locked.cost, second.unlock.cost);
});

test('skins are unique and the defaults are the free ones', () => {
  const ids = new Set();
  for (const s of PLAYER_SKINS) {
    assert.ok(!ids.has(s.id), `duplicate player skin ${s.id}`);
    ids.add(s.id);
    for (const key of ['hat', 'hatBand', 'coat', 'shirt', 'bandana', 'skin', 'boots']) {
      assert.match(s.colours[key], /^#[0-9a-f]{6}$/i, `${s.id} colour ${key}`);
    }
    assert.ok((s.price ?? 0) > 0 || (s.bounty ?? 0) > 0 || s.id === DEFAULT_PLAYER_SKIN, `${s.id} is free but not the default`);
  }
  const gids = new Set();
  for (const s of GUN_SKINS) {
    assert.ok(!gids.has(s.id), `duplicate gun skin ${s.id}`);
    gids.add(s.id);
    for (const key of ['body', 'trim', 'grip']) assert.match(s.colours[key], /^#[0-9a-f]{6}$/i, `${s.id} colour ${key}`);
  }
  assert.equal(getPlayerSkin(DEFAULT_PLAYER_SKIN).price ?? 0, 0);
  assert.equal(getGunSkin(DEFAULT_GUN_SKIN).price ?? 0, 0);
  assert.equal(getPlayerSkin('nope').id, DEFAULT_PLAYER_SKIN);
  assert.equal(getGunSkin('nope').id, DEFAULT_GUN_SKIN);
});
