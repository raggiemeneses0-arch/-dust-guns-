/**
 * The shop. Every function here is pure: pass a save in, get a save out,
 * plus a reason when something is refused. The UI and the tests both call
 * exactly these functions -- no separate "test copy" of the logic.
 */

import { GUNS, getGun, STARTER_GUN_ID } from '../data/guns.js';
import { GUN_SKINS, PLAYER_SKINS, getPlayerSkin, getGunSkin, DEFAULT_GUN_SKIN, DEFAULT_PLAYER_SKIN } from '../data/skins.js';
import { MAPS } from '../data/maps.js';
import { canAfford, priceOf, sellValueOf, spend } from './economy.js';

export const MAX_LOADOUT = 4;

export const SHOP_TABS = [
  { id: 'guns', label: 'Arsenal', items: GUNS },
  { id: 'player-skins', label: 'Outfits', items: PLAYER_SKINS },
  { id: 'gun-skins', label: 'Gun Finishes', items: GUN_SKINS },
  { id: 'maps', label: 'Territories', items: MAPS },
];

function ok(save, message) {
  return { ok: true, save, message };
}

function fail(save, reason, message) {
  return { ok: false, save, reason, message };
}

/* ------------------------------------------------------------------ guns */

export function ownsGun(save, gunId) {
  return save.ownedGuns.includes(gunId);
}

export function buyGun(save, gunId) {
  const gun = getGun(gunId);
  if (!gun) return fail(save, 'unknown', `No such weapon: ${gunId}`);
  if (ownsGun(save, gunId)) return fail(save, 'owned', `You already carry the ${gun.name}.`);

  const price = priceOf(gun);
  if (!canAfford(save, price)) {
    return fail(save, 'poor', `The ${gun.name} costs more coin than you're packing.`);
  }

  const paid = spend(save, price);
  const ownedGuns = [...paid.ownedGuns, gunId];
  const loadout = paid.equipped.loadout.includes(gunId)
    ? paid.equipped.loadout
    : addToLoadout(paid.equipped.loadout, gunId, paid.equipped.activeSlot);

  return ok(
    { ...paid, ownedGuns, equipped: { ...paid.equipped, loadout, activeSlot: loadout.length - 1 } },
    `Bought the ${gun.name}.`,
  );
}

export function sellGun(save, gunId) {
  const gun = getGun(gunId);
  if (!gun) return fail(save, 'unknown', `No such weapon: ${gunId}`);
  if (!ownsGun(save, gunId)) return fail(save, 'not-owned', 'You do not own that weapon.');
  if (save.ownedGuns.length <= 1) return fail(save, 'last-gun', "You can't walk out unarmed.");

  const refund = sellValueOf(gun);
  const ownedGuns = save.ownedGuns.filter((id) => id !== gunId);
  let loadout = save.equipped.loadout.filter((id) => id !== gunId);
  if (!loadout.length) loadout = [ownedGuns[0]];
  const activeSlot = Math.min(save.equipped.activeSlot, loadout.length - 1);

  return ok(
    {
      ...save,
      coins: save.coins + refund,
      ownedGuns,
      equipped: { ...save.equipped, loadout, activeSlot },
    },
    refund > 0 ? `Sold the ${gun.name} for $${refund}.` : `Passed the ${gun.name} along.`,
  );
}

export function addToLoadout(loadout, gunId, activeSlot = 0) {
  if (loadout.includes(gunId)) return [...loadout];
  const next = [...loadout];
  if (next.length < MAX_LOADOUT) {
    next.push(gunId);
    return next;
  }
  const idx = Math.min(Math.max(0, activeSlot), next.length - 1);
  next[idx] = gunId;
  return next;
}

export function equipGun(save, gunId) {
  const gun = getGun(gunId);
  if (!gun) return fail(save, 'unknown', `No such weapon: ${gunId}`);
  if (!ownsGun(save, gunId)) return fail(save, 'not-owned', 'Buy that one first, partner.');

  const loadout = addToLoadout(save.equipped.loadout, gunId, save.equipped.activeSlot);
  const activeSlot = loadout.indexOf(gunId);
  return ok({ ...save, equipped: { ...save.equipped, loadout, activeSlot } }, `${gun.name} in hand.`);
}

export function setActiveSlot(save, index) {
  const loadout = save.equipped.loadout;
  if (index < 0 || index >= loadout.length) return fail(save, 'bad-slot', 'No weapon in that hand.');
  return ok({ ...save, equipped: { ...save.equipped, activeSlot: index } }, '');
}

export function activeGun(save) {
  const id = save.equipped.loadout[save.equipped.activeSlot] ?? STARTER_GUN_ID;
  return getGun(id) ?? getGun(STARTER_GUN_ID);
}

/* ----------------------------------------------------------------- skins */

export function ownsPlayerSkin(save, skinId) {
  return save.ownedPlayerSkins.includes(skinId);
}

export function ownsGunSkin(save, skinId) {
  return save.ownedGunSkins.includes(skinId);
}

export function buyPlayerSkin(save, skinId) {
  const skin = PLAYER_SKINS.find((s) => s.id === skinId);
  if (!skin) return fail(save, 'unknown', `No such outfit: ${skinId}`);
  if (ownsPlayerSkin(save, skinId)) return fail(save, 'owned', `You already wear ${skin.name}.`);
  const price = priceOf(skin);
  if (!canAfford(save, price)) {
    return fail(save, 'poor', `${skin.name} is out of reach right now.`);
  }
  const paid = spend(save, price);
  return ok(
    {
      ...paid,
      ownedPlayerSkins: [...paid.ownedPlayerSkins, skinId],
      equipped: { ...paid.equipped, playerSkin: skinId },
    },
    `Bought the ${skin.name} outfit.`,
  );
}

export function buyGunSkin(save, skinId) {
  const skin = GUN_SKINS.find((s) => s.id === skinId);
  if (!skin) return fail(save, 'unknown', `No such finish: ${skinId}`);
  if (ownsGunSkin(save, skinId)) return fail(save, 'owned', `That finish is already yours.`);
  const price = priceOf(skin);
  if (!canAfford(save, price)) {
    return fail(save, 'poor', `${skin.name} costs more than you've got.`);
  }
  const paid = spend(save, price);
  return ok(
    {
      ...paid,
      ownedGunSkins: [...paid.ownedGunSkins, skinId],
      equipped: { ...paid.equipped, gunSkin: skinId },
    },
    `Bought the ${skin.name} finish.`,
  );
}

export function equipPlayerSkin(save, skinId) {
  if (!getPlayerSkin(skinId)) return fail(save, 'unknown', `No such outfit: ${skinId}`);
  if (!ownsPlayerSkin(save, skinId)) return fail(save, 'not-owned', 'Buy that outfit first.');
  return ok({ ...save, equipped: { ...save.equipped, playerSkin: skinId } }, '');
}

export function equipGunSkin(save, skinId) {
  if (!getGunSkin(skinId)) return fail(save, 'unknown', `No such finish: ${skinId}`);
  if (!ownsGunSkin(save, skinId)) return fail(save, 'not-owned', 'Buy that finish first.');
  return ok({ ...save, equipped: { ...save.equipped, gunSkin: skinId } }, '');
}

/* ------------------------------------------------------------------ maps */

export function buyMap(save, mapId) {
  const map = MAPS.find((m) => m.id === mapId);
  if (!map) return fail(save, 'unknown', `No such territory: ${mapId}`);
  if (map.unlock.kind === 'free') return fail(save, 'free', `${map.name} is already open range.`);
  if (save.clearedMaps?.includes(map.unlock.mapId)) {
    return fail(save, 'unlocked', `${map.name} opened up when you cleared the last territory.`);
  }
  if (save.boughtMaps?.includes(mapId)) return fail(save, 'owned', `You already hold the deed to ${map.name}.`);
  if (save.coins < map.unlock.cost) return fail(save, 'poor', `${map.name} needs $${map.unlock.cost}.`);

  return ok(
    {
      ...save,
      coins: save.coins - map.unlock.cost,
      boughtMaps: [...(save.boughtMaps ?? []), mapId],
    },
    `Bought the deed to ${map.name}.`,
  );
}

/* --------------------------------------------------------------- summary */

/**
 * Flat list of every purchasable thing with its state, used to render the shop.
 * Keeps the UI dumb: it just maps over this.
 */
export function shopCatalog(save) {
  return SHOP_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    items: tab.items.map((item) => {
      const price = priceOf(item);
      const state = itemState(save, tab.id, item);
      return { ...item, price, state };
    }),
  }));
}

function itemState(save, tabId, item) {
  if (tabId === 'guns') {
    const owned = ownsGun(save, item.id);
    return {
      owned,
      equipped: owned && save.equipped.loadout[save.equipped.activeSlot] === item.id,
      inLoadout: owned && save.equipped.loadout.includes(item.id),
    };
  }
  if (tabId === 'player-skins') {
    const owned = ownsPlayerSkin(save, item.id);
    return { owned, equipped: owned && save.equipped.playerSkin === item.id };
  }
  if (tabId === 'gun-skins') {
    const owned = ownsGunSkin(save, item.id);
    return { owned, equipped: owned && save.equipped.gunSkin === item.id };
  }
  const unlocked =
    item.unlock.kind === 'free' ||
    save.clearedMaps?.includes(item.unlock.mapId) ||
    save.boughtMaps?.includes(item.id);
  return { owned: unlocked, equipped: false, locked: !unlocked, cost: item.unlock.cost };
}

export function equippedSkins(save) {
  return {
    player: getPlayerSkin(save.equipped.playerSkin ?? DEFAULT_PLAYER_SKIN),
    gun: getGunSkin(save.equipped.gunSkin ?? DEFAULT_GUN_SKIN),
  };
}
