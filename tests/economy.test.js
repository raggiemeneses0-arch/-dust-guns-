import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyReward,
  bountyForKill,
  canAfford,
  coinsForKill,
  mapClearReward,
  mapPurchaseStatus,
  priceOf,
  sellValueOf,
  spend,
  summariseRun,
  waveClearBonus,
} from '../src/core/economy.js';
import { createDefaultSave } from '../src/core/save.js';
import { MAPS, getMapOrDefault } from '../src/data/maps.js';
import { getGun } from '../src/data/guns.js';
import { ENEMY_TYPES } from '../src/data/enemies.js';

test('affordability checks both currencies', () => {
  const save = { ...createDefaultSave(), coins: 100, bounty: 1 };
  assert.equal(canAfford(save, { coins: 100 }), true);
  assert.equal(canAfford(save, { coins: 101 }), false);
  assert.equal(canAfford(save, { bounty: 2 }), false);
  assert.equal(canAfford(save, { coins: 50, bounty: 1 }), true);
  assert.equal(canAfford(save), true, 'free is always affordable');
});

test('priceOf reads coins and bounty independently', () => {
  assert.deepEqual(priceOf(getGun('winchester-73')), { coins: 1250, bounty: 0 });
  assert.deepEqual(priceOf(getGun('golden-peacemaker')), { coins: 0, bounty: 12 });
  assert.deepEqual(priceOf(null), { coins: 0, bounty: 0 });
});

test('kills pay more on richer maps and never less than one coin', () => {
  for (const m of MAPS) {
    const coins = coinsForKill('bandit', m);
    assert.ok(Number.isInteger(coins) && coins >= 1, `${m.id} paid ${coins}`);
  }
  assert.ok(
    coinsForKill('bandit', getMapOrDefault('sunset-mesa')) > coinsForKill('bandit', getMapOrDefault('main-street')),
    'richer map should pay more per kill',
  );
  assert.ok(coinsForKill('boss', getMapOrDefault('main-street')) > coinsForKill('bandit', getMapOrDefault('main-street')));
});

test('only bosses pay bounty stars', () => {
  for (const id of Object.keys(ENEMY_TYPES)) {
    const bounty = bountyForKill(id, getMapOrDefault('main-street'));
    if (id === 'boss') assert.ok(bounty > 0, 'bosses must pay bounty');
    else assert.equal(bounty, 0, `${id} should not pay bounty`);
  }
});

test('wave and map bonuses scale with the wave and the map', () => {
  const map = getMapOrDefault('main-street');
  assert.ok(waveClearBonus(5, map) > waveClearBonus(1, map));
  assert.ok(
    waveClearBonus(5, getMapOrDefault('sunset-mesa')) > waveClearBonus(5, map),
    'richer maps pay a bigger wave bonus',
  );
  const reward = mapClearReward(map);
  assert.ok(reward.coins > 0 && reward.bounty > 0);
  assert.ok(mapClearReward(getMapOrDefault('sunset-mesa')).coins > reward.coins);
});

test('applying a reward and spending are inverse and never go negative', () => {
  const save = createDefaultSave();
  const paid = applyReward(save, { coins: 500, bounty: 3 });
  assert.equal(paid.coins, 500);
  assert.equal(paid.bounty, 3);
  assert.equal(paid.stats.coinsEarned, 500);
  assert.equal(paid.stats.bountyEarned, 3);

  const spent = spend(paid, { coins: 200, bounty: 1 });
  assert.equal(spent.coins, 300);
  assert.equal(spent.bounty, 2);

  const overdrawn = spend(save, { coins: 9999, bounty: 99 });
  assert.equal(overdrawn.coins, 0);
  assert.equal(overdrawn.bounty, 0);

  // the original save must not be mutated
  assert.equal(save.coins, 0);
  assert.equal(save.bounty, 0);
});

test('selling refunds 45% and legendary gear is not for sale', () => {
  assert.equal(sellValueOf(getGun('winchester-73')), Math.round(1250 * 0.45));
  assert.equal(sellValueOf(getGun('rusty-peacemaker')), 0, 'starter gear has no resale');
  assert.equal(sellValueOf(getGun('golden-peacemaker')), 0, 'bounty gear cannot be sold');
  assert.equal(sellValueOf(null), 0);
});

test('map purchase status reports free / cleared / owned / purchasable', () => {
  const save = createDefaultSave();
  assert.equal(mapPurchaseStatus(MAPS[0], save).reason, 'free');
  assert.equal(mapPurchaseStatus(MAPS[1], save).reason, 'purchasable');
  assert.equal(mapPurchaseStatus(MAPS[1], { ...save, coins: 0 }).affordable, false);
  assert.equal(mapPurchaseStatus(MAPS[1], { ...save, coins: 99999 }).affordable, true);
  assert.equal(mapPurchaseStatus(MAPS[1], { ...save, clearedMaps: [MAPS[0].id] }).reason, 'cleared');
  assert.equal(mapPurchaseStatus(MAPS[1], { ...save, boughtMaps: [MAPS[1].id] }).reason, 'owned');
});

test('the run summary computes accuracy and rounds cleanly', () => {
  const summary = summariseRun({ kills: 10, wavesCleared: 3, coins: 42.6, bounty: 1, shotsFired: 40, shotsHit: 10 });
  assert.equal(summary.accuracy, 25);
  assert.equal(summary.kills, 10);
  assert.equal(summary.coins, 42.6);

  const empty = summariseRun({ shotsFired: 0, shotsHit: 0 });
  assert.equal(empty.accuracy, 0, 'no shots should not divide by zero');
});
