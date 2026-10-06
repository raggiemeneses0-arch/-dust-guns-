import test from 'node:test';
import assert from 'node:assert/strict';

import { createShot, enemyShotAngle, hasLineOfSight, updateHeat } from '../src/game/ballistics.js';
import { GUNS, getGun } from '../src/data/guns.js';
import { effectiveSpread } from '../src/data/guns.js';
import { makeRng } from '../src/core/rng.js';
import { BULLET } from '../src/config.js';

const ORIGIN = { x: 100, y: 100 };

test('one trigger pull releases exactly the gun\'s pellet count', () => {
  for (const gun of GUNS) {
    const shots = createShot(gun, ORIGIN, 0, 0, makeRng('pellets').next);
    assert.equal(shots.length, gun.pellets ?? 1, `${gun.id} pellet count`);
    for (const s of shots) {
      assert.equal(s.gunId, gun.id);
      assert.equal(s.damage, gun.damage);
      assert.equal(s.radius, BULLET.radius);
      assert.equal(s.hitsLeft, (gun.pierce ?? 0) + 1);
      assert.equal(s.splash, gun.splash ?? 0);
      assert.ok(Math.hypot(s.vx, s.vy) > 0, `${gun.id} produced a stationary bullet`);
    }
  }
});

test('bullets travel roughly along the aim direction and stay inside the cone', () => {
  const gun = getGun('winchester-73');
  const aim = 0.7;
  const spread = effectiveSpread(gun, 0);
  const shots = createShot(gun, ORIGIN, aim, 0, makeRng('cone').next);
  for (const s of shots) {
    const actual = Math.atan2(s.vy, s.vx);
    let delta = Math.abs(actual - aim);
    if (delta > Math.PI) delta = 2 * Math.PI - delta;
    assert.ok(delta <= spread + 1e-6, `shot deviated ${delta} beyond cone ${spread}`);
    const speed = Math.hypot(s.vx, s.vy);
    assert.ok(speed > gun.bulletSpeed * 0.9 && speed < gun.bulletSpeed * 1.1, 'velocity jitter out of range');
  }
});

test('a hot barrel spreads shots wider than a cold one', () => {
  const gun = getGun('henry-repeater');
  const deviation = (heat) => {
    const rng = makeRng(`heat-${heat}`);
    let max = 0;
    for (let i = 0; i < 400; i += 1) {
      const [s] = createShot(gun, ORIGIN, 0, heat, rng.next);
      const actual = Math.atan2(s.vy, s.vx);
      let delta = Math.abs(actual);
      if (delta > Math.PI) delta = 2 * Math.PI - delta;
      max = Math.max(max, delta);
    }
    return max;
  };
  const cold = deviation(0);
  const hot = deviation(1);
  assert.ok(cold > 0, 'even a cold barrel has some jitter');
  assert.ok(hot > cold * 1.5, `hot deviation ${hot} should clearly exceed cold ${cold}`);
});

test('the injected rng makes shots reproducible', () => {
  const gun = getGun('coach-gun');
  const a = createShot(gun, ORIGIN, 1.2, 0.3, makeRng('same').next);
  const b = createShot(gun, ORIGIN, 1.2, 0.3, makeRng('same').next);
  assert.deepEqual(a.map((s) => [s.vx, s.vy]), b.map((s) => [s.vx, s.vy]));
});

test('heat rises on a shot and decays back to zero', () => {
  const gun = getGun('hand-crank-gatling');
  let heat = 0;
  for (let i = 0; i < 10; i += 1) heat = updateHeat(heat, gun, 0, true);
  assert.ok(heat > 0.1, 'heat should build');
  assert.ok(heat <= 1, 'heat is clamped');
  for (let i = 0; i < 200; i += 1) heat = updateHeat(heat, gun, 0.05, false);
  assert.equal(heat, 0, 'heat fully decays');
});

test('enemy accuracy produces angles inside its cone', () => {
  const rng = makeRng('enemy');
  for (let i = 0; i < 500; i += 1) {
    const a = enemyShotAngle(1.0, 0.1, rng.next);
    assert.ok(Math.abs(a - 1.0) <= 0.1 + 1e-9, `enemy shot escaped its cone: ${a}`);
  }
});

test('line of sight is blocked by solid cover but not by decor', () => {
  const wall = { x: 200, y: 0, w: 20, h: 400, solid: true };
  const bush = { x: 200, y: 0, w: 20, h: 400, solid: false };
  assert.equal(hasLineOfSight([wall], 100, 100, 400, 100), false, 'wall blocks');
  assert.equal(hasLineOfSight([bush], 100, 100, 400, 100), true, 'brush does not block');
  assert.equal(hasLineOfSight([wall], 100, 100, 100, 300), true, 'parallel to the wall is clear');
  assert.equal(hasLineOfSight([], 0, 0, 900, 900), true, 'open ground is clear');
  assert.equal(hasLineOfSight([wall], 100, 100, 100, 100), true, 'zero length ray');
});
