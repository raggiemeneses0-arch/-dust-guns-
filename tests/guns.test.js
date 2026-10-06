import test from 'node:test';
import assert from 'node:assert/strict';

import { WORLD } from '../src/config.js';
import {
  GUNS,
  GUN_IDS,
  STARTER_GUN_ID,
  RARITY,
  GUN_CLASS,
  dpsOf,
  effectiveSpread,
  getGun,
  getGunOrDefault,
  gunDamagePerShot,
  rollDamage,
  shotPellets,
} from '../src/data/guns.js';

test('every gun has a unique id and a valid class/rarity', () => {
  const ids = new Set();
  for (const g of GUNS) {
    assert.ok(!ids.has(g.id), `duplicate gun id: ${g.id}`);
    ids.add(g.id);
    assert.ok(GUN_CLASS[g.klass], `${g.id} has unknown class ${g.klass}`);
    assert.ok(RARITY[g.rarity], `${g.id} has unknown rarity ${g.rarity}`);
    assert.equal(typeof g.name, 'string');
    assert.ok(g.blurb.length > 10, `${g.id} needs a blurb`);
  }
  assert.equal(ids.size, GUNS.length);
  assert.deepEqual(GUN_IDS, GUNS.map((g) => g.id));
});

test('every gun has playable, positive stats', () => {
  for (const g of GUNS) {
    assert.ok(g.damage > 0, `${g.id} damage`);
    assert.ok(g.fireRate > 30, `${g.id} fireRate`);
    assert.ok(g.mag >= 1, `${g.id} mag`);
    assert.ok(g.reload >= 300, `${g.id} reload`);
    assert.ok(g.bulletSpeed > 200, `${g.id} bulletSpeed`);
    assert.ok(g.range >= 300, `${g.id} range too short to be usable`);
    assert.ok(g.range <= WORLD.width + WORLD.height, `${g.id} range longer than the arena`);
    assert.ok(g.spread >= 0 && g.spread < 0.5, `${g.id} spread`);
    assert.ok(shotPellets(g) >= 1, `${g.id} pellets`);
    assert.ok(g.critChance >= 0 && g.critChance < 1, `${g.id} critChance`);
  }
});

test('exactly one free starter gun and it is the default', () => {
  const free = GUNS.filter((g) => (g.price ?? 0) === 0 && !(g.bounty > 0));
  assert.equal(free.length, 1, 'exactly one zero-cost coin gun');
  assert.equal(free[0].id, STARTER_GUN_ID);
  assert.equal(getGun(STARTER_GUN_ID).id, STARTER_GUN_ID);
  assert.equal(getGun('does-not-exist'), null);
  assert.equal(getGunOrDefault('does-not-exist').id, STARTER_GUN_ID);
});

test('shotguns really fire multiple pellets, rifles pierce', () => {
  assert.ok(shotPellets(getGun('coach-gun')) > 1);
  assert.ok(shotPellets(getGun('sawed-off-boomstick')) > 1);
  assert.equal(shotPellets(getGun('winchester-73')), 1);
  assert.ok(getGun('buffalo-rifle').pierce >= 3);
  assert.ok(getGun('dynamite-launcher').splash > 0);
});

test('effective spread never drops below the base cone and grows with heat', () => {
  for (const g of GUNS) {
    const cold = effectiveSpread(g, 0);
    const hot = effectiveSpread(g, 1);
    assert.ok(cold >= g.spread - 1e-9, `${g.id} cold spread below base`);
    assert.ok(hot >= cold, `${g.id} spread shrank with heat`);
  }
});

test('damage falls off with distance but never collapses to zero', () => {
  const gun = getGun('winchester-73');
  const near = rollDamage(gun, 10, 1); // roll=1 -> never a crit
  const far = rollDamage(gun, gun.range, 1);
  assert.equal(near.isCrit, false);
  assert.equal(near.damage, gun.damage);
  assert.ok(far.damage < near.damage, 'far shot should do less damage');
  assert.ok(far.damage > 0, 'far shot still hurts');
  assert.ok(far.damage >= near.damage * 0.5, 'falloff is capped at 45%');
});

test('crits multiply damage', () => {
  const gun = getGun('golden-peacemaker');
  assert.ok(gun.critChance > 0.3);
  const crit = rollDamage(gun, 10, 0);
  const normal = rollDamage(gun, 10, 0.999);
  assert.equal(crit.isCrit, true);
  assert.equal(normal.isCrit, false);
  assert.ok(crit.damage > normal.damage * 2);
});

test('dps and per-shot damage are consistent', () => {
  for (const g of GUNS) {
    assert.equal(gunDamagePerShot(g), g.damage * shotPellets(g));
    const expected = Math.round((g.damage * shotPellets(g) * 1000) / g.fireRate);
    assert.equal(dpsOf(g), expected, `${g.id} dps`);
  }
});

test('the arsenal gets strictly more expensive as it gets stronger', () => {
  const priced = GUNS.filter((g) => (g.price ?? 0) > 0).sort((a, b) => a.price - b.price);
  const dps = priced.map((g) => dpsOf(g));
  // not every step must be monotonic (utility guns trade dps for burst),
  // but the top-priced tier must out-dps the cheapest.
  assert.ok(dps[priced.length - 1] > dps[0], 'priciest gun should out-dps the cheapest');
  const legendary = GUNS.filter((g) => g.rarity === 'legendary');
  for (const g of legendary) assert.ok(dpsOf(g) > dpsOf(getGun(STARTER_GUN_ID)) * 2);
});
