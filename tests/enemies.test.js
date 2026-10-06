import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENEMY_IDS,
  ENEMY_TYPES,
  getEnemyType,
  planWave,
  rosterFor,
  scaleEnemy,
  totalEnemiesIn,
} from '../src/data/enemies.js';
import { MAPS, getMapOrDefault } from '../src/data/maps.js';

test('enemy archetypes are internally consistent', () => {
  for (const t of Object.values(ENEMY_TYPES)) {
    assert.ok(t.hp > 0, `${t.id} hp`);
    assert.ok(t.speed > 0, `${t.id} speed`);
    assert.ok(t.damage > 0, `${t.id} damage`);
    assert.ok(t.fireRate > 100, `${t.id} fireRate`);
    assert.ok(t.coins > 0, `${t.id} coins`);
    assert.ok(t.preferredRange >= t.minRange, `${t.id} range ordering`);
    assert.ok(t.accuracy >= 0 && t.accuracy < 1, `${t.id} accuracy`);
    assert.ok(['strafe', 'charge', 'circle', 'kite', 'advance', 'boss'].includes(t.behaviour), `${t.id} behaviour`);
    assert.ok(t.palette.coat && t.palette.hat, `${t.id} palette`);
    assert.equal(getEnemyType(t.id).id, t.id);
  }
  assert.equal(getEnemyType('ghost').id, 'bandit', 'unknown types fall back to bandit');
  assert.equal(ENEMY_TYPES.boss.isBoss, true);
  assert.equal(ENEMY_IDS.length, Object.keys(ENEMY_TYPES).length);
});

test('map rosters only reference archetypes that exist', () => {
  for (const m of MAPS) {
    const roster = rosterFor(m.id);
    assert.ok(roster.length >= 3, `${m.id} roster too thin`);
    for (const t of roster) assert.ok(ENEMY_TYPES[t], `${m.id} unknown archetype ${t}`);
  }
  assert.ok(rosterFor('made-up-map').length >= 3, 'unknown map falls back to a roster');
});

test('planWave is deterministic and never empty', () => {
  for (const m of MAPS) {
    for (let w = 1; w <= m.waves; w += 1) {
      const a = planWave(w, m);
      const b = planWave(w, m);
      assert.deepEqual(a, b, `${m.id} wave ${w} is not deterministic`);
      assert.ok(a.length > 0, `${m.id} wave ${w} is empty`);
      assert.ok(totalEnemiesIn(a) > 0, `${m.id} wave ${w} has no enemies`);
      for (const o of a) {
        assert.ok(ENEMY_TYPES[o.type], `${m.id} wave ${w} unknown type ${o.type}`);
        assert.ok(o.count > 0);
        assert.ok(o.delay >= 0);
        assert.ok(rosterFor(m.id).includes(o.type) || o.type === 'boss', `${m.id} wave ${w} off-roster ${o.type}`);
      }
    }
  }
});

test('waves get bigger and the boss only shows up on the last one', () => {
  const map = getMapOrDefault('main-street');
  const first = totalEnemiesIn(planWave(1, map));
  const last = totalEnemiesIn(planWave(map.waves, map));
  assert.ok(last > first, `wave 1 (${first}) should be smaller than wave ${map.waves} (${last})`);

  for (let w = 1; w < map.waves; w += 1) {
    assert.equal(planWave(w, map).some((o) => o.type === 'boss'), false, `boss appeared early on wave ${w}`);
  }
  const finalOrders = planWave(map.waves, map);
  const bosses = finalOrders.filter((o) => o.type === 'boss');
  assert.equal(bosses.length, 1, 'exactly one boss on the final wave');
  assert.equal(bosses[0].count, 1);
});

test('scaling raises hp and payout monotonically with the wave', () => {
  const type = ENEMY_TYPES.bandit;
  const map = getMapOrDefault('red-canyon');
  let prevHp = 0;
  let prevCoins = 0;
  for (let w = 1; w <= 12; w += 1) {
    const s = scaleEnemy(type, w, map);
    assert.ok(s.hp > prevHp, `hp did not rise at wave ${w}`);
    assert.ok(s.coins >= prevCoins, `payout fell at wave ${w}`);
    assert.ok(s.damage > 0 && s.speed > 0);
    prevHp = s.hp;
    prevCoins = s.coins;
  }
});

test('harder maps scale harder and pay better for the same wave', () => {
  const easy = getMapOrDefault('main-street');
  const hard = getMapOrDefault('sunset-mesa');
  const a = scaleEnemy(ENEMY_TYPES.bandit, 5, easy);
  const b = scaleEnemy(ENEMY_TYPES.bandit, 5, hard);
  assert.ok(b.hp > a.hp);
  assert.ok(b.coins > a.coins);
});

test('bosses are worth far more than mooks', () => {
  const map = getMapOrDefault('sunset-mesa');
  const boss = scaleEnemy(ENEMY_TYPES.boss, map.waves, map);
  const mook = scaleEnemy(ENEMY_TYPES.bandit, map.waves, map);
  assert.ok(boss.hp > mook.hp * 8);
  assert.ok(boss.coins > mook.coins * 8);
});
