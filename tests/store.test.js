import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_LOADOUT,
  activeGun,
  addToLoadout,
  buyGun,
  buyGunSkin,
  buyMap,
  buyPlayerSkin,
  equipGun,
  equipGunSkin,
  equipPlayerSkin,
  equippedSkins,
  ownsGun,
  ownsGunSkin,
  ownsPlayerSkin,
  sellGun,
  setActiveSlot,
  shopCatalog,
} from '../src/core/store.js';
import { createDefaultSave, memoryStorage, normaliseSave } from '../src/core/save.js';
import { GUNS, STARTER_GUN_ID, getGun } from '../src/data/guns.js';
import { DEFAULT_GUN_SKIN, DEFAULT_PLAYER_SKIN, GUN_SKINS, PLAYER_SKINS } from '../src/data/skins.js';
import { MAPS } from '../src/data/maps.js';

const rich = (coins = 1_000_000, bounty = 100) => ({ ...createDefaultSave(), coins, bounty });

/* ------------------------------------------------------------- guns */

test('a fresh save owns only the starter gun', () => {
  const save = createDefaultSave();
  assert.deepEqual(save.ownedGuns, [STARTER_GUN_ID]);
  assert.equal(save.coins, 0);
  assert.equal(save.bounty, 0);
  assert.equal(activeGun(save).id, STARTER_GUN_ID);
});

test('buying a gun you cannot afford is refused and costs nothing', () => {
  const save = createDefaultSave();
  const result = buyGun(save, 'winchester-73');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'poor');
  assert.equal(result.save.coins, 0);
  assert.equal(ownsGun(result.save, 'winchester-73'), false);
});

test('buying a gun deducts exactly its price and equips it', () => {
  const save = rich();
  const gun = getGun('winchester-73');
  const result = buyGun(save, gun.id);
  assert.equal(result.ok, true);
  assert.equal(result.save.coins, save.coins - gun.price);
  assert.equal(ownsGun(result.save, gun.id), true);
  assert.equal(activeGun(result.save).id, gun.id, 'a new gun should be put in hand');
  assert.equal(result.save.equipped.loadout.includes(gun.id), true);
});

test('buying a legendary costs bounty, not coins', () => {
  const coinRich = rich(1_000_000, 0);
  const refused = buyGun(coinRich, 'golden-peacemaker');
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'poor');

  const bountyRich = rich(1_000_000, 50);
  const bought = buyGun(bountyRich, 'golden-peacemaker');
  assert.equal(bought.ok, true);
  assert.equal(bought.save.bounty, 50 - getGun('golden-peacemaker').bounty);
  assert.equal(bought.save.coins, 1_000_000, 'coins untouched by a bounty purchase');
});

test('you cannot buy the same gun twice, or a gun that does not exist', () => {
  const save = rich();
  const first = buyGun(save, 'cattleman-six');
  assert.equal(first.ok, true);
  const second = buyGun(first.save, 'cattleman-six');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'owned');
  assert.equal(buyGun(save, 'not-a-gun').reason, 'unknown');
});

test('the loadout holds at most four guns and a fifth replaces the one in hand', () => {
  let save = rich();
  const picks = ['cattleman-six', 'coach-gun', 'winchester-73', 'henry-repeater', 'volcanic-repeater'];
  let displaced = null;
  for (const id of picks) {
    const activeBefore = save.equipped.loadout[save.equipped.activeSlot];
    const fullBefore = save.equipped.loadout.length >= MAX_LOADOUT;
    const r = buyGun(save, id);
    assert.equal(r.ok, true, `buying ${id}`);
    save = r.save;
    if (fullBefore) displaced = activeBefore;
    assert.ok(save.equipped.loadout.length <= MAX_LOADOUT, `loadout overflowed at ${id}`);
    assert.equal(activeGun(save).id, id, `${id} should be in hand after purchase`);
  }

  assert.equal(save.equipped.loadout.length, MAX_LOADOUT);
  assert.equal(save.equipped.loadout.includes(displaced), false, `the gun in hand (${displaced}) should have been swapped out`);
  assert.equal(new Set(save.equipped.loadout).size, MAX_LOADOUT, 'loadout has duplicate slots');
  for (const id of save.equipped.loadout) assert.equal(ownsGun(save, id), true, `${id} in loadout but not owned`);
  // everything displaced is still owned, just not carried
  for (const id of picks) if (id !== displaced) assert.equal(ownsGun(save, id), true);
  assert.equal(ownsGun(save, displaced), true, 'a swapped-out gun must not be destroyed');
});

test('addToLoadout is idempotent and respects the cap', () => {
  const base = ['a'];
  assert.deepEqual(addToLoadout(base, 'a', 0), ['a']);
  assert.deepEqual(addToLoadout(base, 'b', 0), ['a', 'b']);
  const full = ['a', 'b', 'c', 'd'];
  assert.equal(addToLoadout(full, 'e', 2).length, MAX_LOADOUT);
  assert.deepEqual(addToLoadout(full, 'e', 2), ['a', 'b', 'e', 'd']);
});

test('equipping needs ownership, and slot selection is bounds checked', () => {
  const save = createDefaultSave();
  assert.equal(equipGun(save, 'buffalo-rifle').reason, 'not-owned');
  assert.equal(setActiveSlot(save, 9).reason, 'bad-slot');
  assert.equal(setActiveSlot(save, -1).reason, 'bad-slot');

  const owned = rich();
  const bought = buyGun(owned, 'coach-gun').save;
  const equipped = equipGun(bought, STARTER_GUN_ID);
  assert.equal(equipped.ok, true);
  assert.equal(activeGun(equipped.save).id, STARTER_GUN_ID);
  const slotted = setActiveSlot(equipped.save, 1);
  assert.equal(slotted.ok, true);
  assert.equal(slotted.save.equipped.activeSlot, 1);
});

test('selling refunds 45% and never leaves you unarmed', () => {
  const save = rich();
  const bought = buyGun(save, 'winchester-73').save;
  const sold = sellGun(bought, 'winchester-73');
  assert.equal(sold.ok, true);
  assert.equal(sold.save.coins, bought.coins + Math.round(getGun('winchester-73').price * 0.45));
  assert.equal(ownsGun(sold.save, 'winchester-73'), false);
  assert.ok(sold.save.equipped.loadout.length >= 1, 'loadout must never be empty');
  assert.ok(sold.save.ownedGuns.length >= 1);

  const last = sellGun(createDefaultSave(), STARTER_GUN_ID);
  assert.equal(last.ok, false);
  assert.equal(last.reason, 'last-gun');
});

test('the free starter gun cannot be sold for profit', () => {
  let save = rich();
  save = buyGun(save, 'cattleman-six').save;
  const sold = sellGun(save, STARTER_GUN_ID);
  assert.equal(sold.ok, true);
  assert.equal(sold.save.coins, save.coins, 'starter gun is worthless');
});

/* ------------------------------------------------------------ skins */

test('skins buy, equip and refuse like everything else', () => {
  const save = createDefaultSave();
  assert.equal(buyPlayerSkin(save, 'the-marshal').reason, 'poor');
  assert.equal(buyGunSkin(save, 'silver-engraved').reason, 'poor');

  const r = rich();
  const ps = buyPlayerSkin(r, 'the-marshal');
  assert.equal(ps.ok, true);
  assert.equal(ps.save.equipped.playerSkin, 'the-marshal', 'a bought outfit goes straight on');
  assert.equal(ownsPlayerSkin(ps.save, 'the-marshal'), true);
  assert.equal(buyPlayerSkin(ps.save, 'the-marshal').reason, 'owned');

  const gs = buyGunSkin(ps.save, 'silver-engraved');
  assert.equal(gs.ok, true);
  assert.equal(gs.save.equipped.gunSkin, 'silver-engraved');
  assert.equal(ownsGunSkin(gs.save, 'silver-engraved'), true);

  assert.equal(equipPlayerSkin(r, 'el-diablo').reason, 'not-owned');
  assert.equal(equipGunSkin(r, 'gold-inlaid').reason, 'not-owned');
  const back = equipPlayerSkin(ps.save, DEFAULT_PLAYER_SKIN);
  assert.equal(back.ok, true);
  assert.equal(back.save.equipped.playerSkin, DEFAULT_PLAYER_SKIN);
});

test('bounty-only skins cannot be bought with coins', () => {
  const save = rich(10_000_000, 0);
  const bountySkin = PLAYER_SKINS.find((s) => (s.bounty ?? 0) > 0);
  assert.ok(bountySkin, 'there should be at least one bounty outfit');
  assert.equal(buyPlayerSkin(save, bountySkin.id).reason, 'poor');
  assert.equal(buyPlayerSkin({ ...save, bounty: bountySkin.bounty }, bountySkin.id).ok, true);

  const bountyGun = GUN_SKINS.find((s) => (s.bounty ?? 0) > 0);
  assert.equal(buyGunSkin(save, bountyGun.id).reason, 'poor');
});

/* ------------------------------------------------------------- maps */

test('territory deeds cost coins and unlock the map', () => {
  const save = createDefaultSave();
  const target = MAPS[1];
  assert.equal(buyMap(save, MAPS[0].id).reason, 'free');
  assert.equal(buyMap(save, target.id).reason, 'poor');

  const broke = buyMap(rich(10), target.id);
  assert.equal(broke.ok, false);

  const bought = buyMap(rich(), target.id);
  assert.equal(bought.ok, true);
  assert.equal(bought.save.coins, 1_000_000 - target.unlock.cost);
  assert.deepEqual(bought.save.boughtMaps, [target.id]);
  assert.equal(buyMap(bought.save, target.id).reason, 'owned');

  // clearing the prerequisite unlocks it for free
  const cleared = buyMap({ ...createDefaultSave(), clearedMaps: [MAPS[0].id] }, target.id);
  assert.equal(cleared.reason, 'unlocked');
});

/* ---------------------------------------------------------- catalog */

test('shopCatalog reports state for every purchasable thing', () => {
  const save = rich();
  const catalog = shopCatalog(save);
  assert.deepEqual(catalog.map((c) => c.id), ['guns', 'player-skins', 'gun-skins', 'maps']);

  const guns = catalog[0].items;
  assert.equal(guns.length, GUNS.length);
  assert.equal(guns.find((g) => g.id === STARTER_GUN_ID).state.owned, true);
  assert.equal(guns.find((g) => g.id === STARTER_GUN_ID).state.equipped, true);
  assert.equal(guns.find((g) => g.id === 'buffalo-rifle').state.owned, false);

  const maps = catalog[3].items;
  assert.equal(maps[0].state.owned, true, 'first map is open range');
  assert.equal(maps[1].state.owned, false);
  assert.equal(maps[1].state.locked, true);
});

test('equippedSkins resolves to real skin objects', () => {
  const save = createDefaultSave();
  const { player, gun } = equippedSkins(save);
  assert.equal(player.id, DEFAULT_PLAYER_SKIN);
  assert.equal(gun.id, DEFAULT_GUN_SKIN);
});

/* ------------------------------------------------------------- save */

test('a save round-trips through injected storage', () => {
  const storage = memoryStorage();
  let save = rich(4242, 7);
  save = buyGun(save, 'henry-repeater').save;
  save = { ...save, name: 'Calamity', stats: { ...save.stats, kills: 99 } };

  const json = JSON.stringify(save);
  storage.setItem('dust-and-guns:save:v1', json);
  const restored = normaliseSave(JSON.parse(storage.getItem('dust-and-guns:save:v1')));
  assert.equal(restored.coins, save.coins);
  assert.equal(restored.bounty, save.bounty);
  assert.equal(restored.name, 'Calamity');
  assert.equal(restored.stats.kills, 99);
  assert.deepEqual(restored.ownedGuns, save.ownedGuns);
});

test('normaliseSave survives garbage input', () => {
  for (const junk of [null, undefined, 0, '', 'nope', [], { coins: 'lots' }, { equipped: null }, { ownedGuns: 'x' }]) {
    const save = normaliseSave(junk);
    assert.ok(save.ownedGuns.length >= 1, 'never unarmed');
    assert.ok(Number.isFinite(save.coins) && save.coins >= 0);
    assert.ok(Number.isFinite(save.bounty) && save.bounty >= 0);
    assert.ok(save.equipped.loadout.length >= 1);
    assert.equal(typeof save.settings.sfx, 'boolean');
  }
});

test('normaliseSave drops equipped items you do not own', () => {
  const save = normaliseSave({
    ownedGuns: [STARTER_GUN_ID],
    equipped: { playerSkin: 'el-diablo', gunSkin: 'gold-inlaid', loadout: ['buffalo-rifle'], activeSlot: 5 },
  });
  assert.equal(save.equipped.playerSkin, DEFAULT_PLAYER_SKIN);
  assert.equal(save.equipped.gunSkin, DEFAULT_GUN_SKIN);
  assert.deepEqual(save.equipped.loadout, [STARTER_GUN_ID]);
  assert.equal(save.equipped.activeSlot, 0);
});

test('negative currency and NaN stats are clamped', () => {
  const save = normaliseSave({ coins: -500, bounty: -3, stats: { kills: -9, shotsFired: NaN } });
  assert.equal(save.coins, 0);
  assert.equal(save.bounty, 0);
  assert.equal(save.stats.kills, 0);
  assert.equal(save.stats.shotsFired, 0);
});
