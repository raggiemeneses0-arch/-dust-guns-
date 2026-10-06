/**
 * Save file handling. The storage object is injected so the same code runs
 * in the browser (localStorage) and under `node --test` (a Map-backed fake).
 */

import { SAVE_KEY } from '../config.js';
import { STARTER_GUN_ID } from '../data/guns.js';
import { DEFAULT_GUN_SKIN, DEFAULT_PLAYER_SKIN } from '../data/skins.js';

export const SAVE_VERSION = 1;

export function createDefaultSave() {
  return {
    version: SAVE_VERSION,
    name: 'Stranger',
    coins: 0,
    bounty: 0,
    ownedGuns: [STARTER_GUN_ID],
    ownedPlayerSkins: [DEFAULT_PLAYER_SKIN],
    ownedGunSkins: [DEFAULT_GUN_SKIN],
    equipped: {
      playerSkin: DEFAULT_PLAYER_SKIN,
      gunSkin: DEFAULT_GUN_SKIN,
      loadout: [STARTER_GUN_ID],
      activeSlot: 0,
    },
    clearedMaps: [],
    boughtMaps: [],
    best: {},
    stats: {
      runs: 0,
      kills: 0,
      bossKills: 0,
      deaths: 0,
      shotsFired: 0,
      shotsHit: 0,
      coinsEarned: 0,
      bountyEarned: 0,
      highestWave: 0,
      mapsCleared: 0,
    },
    settings: {
      sfx: true,
      music: true,
      screenShake: true,
      showDamageNumbers: true,
    },
    tutorialSeen: false,
  };
}

/**
 * Merge a raw (possibly older / partial / hostile) object onto the defaults.
 * Anything missing or the wrong type falls back instead of crashing.
 */
export function normaliseSave(raw) {
  const base = createDefaultSave();
  if (!raw || typeof raw !== 'object') return base;

  const strArray = (v, fallback) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string') : fallback;
  const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

  const out = {
    ...base,
    version: SAVE_VERSION,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 20) : base.name,
    coins: Math.max(0, Math.floor(num(raw.coins, 0))),
    bounty: Math.max(0, Math.floor(num(raw.bounty, 0))),
    ownedGuns: strArray(raw.ownedGuns, base.ownedGuns),
    ownedPlayerSkins: strArray(raw.ownedPlayerSkins, base.ownedPlayerSkins),
    ownedGunSkins: strArray(raw.ownedGunSkins, base.ownedGunSkins),
    clearedMaps: strArray(raw.clearedMaps, []),
    boughtMaps: strArray(raw.boughtMaps, []),
    best: raw.best && typeof raw.best === 'object' ? raw.best : {},
    tutorialSeen: bool(raw.tutorialSeen, false),
  };

  // Never allow an empty arsenal.
  if (!out.ownedGuns.length) out.ownedGuns = [STARTER_GUN_ID];
  if (!out.ownedPlayerSkins.includes(DEFAULT_PLAYER_SKIN)) out.ownedPlayerSkins.unshift(DEFAULT_PLAYER_SKIN);
  if (!out.ownedGunSkins.includes(DEFAULT_GUN_SKIN)) out.ownedGunSkins.unshift(DEFAULT_GUN_SKIN);

  const eq = raw.equipped && typeof raw.equipped === 'object' ? raw.equipped : {};
  const loadout = strArray(eq.loadout, [STARTER_GUN_ID]).filter((id) => out.ownedGuns.includes(id));
  out.equipped = {
    playerSkin: out.ownedPlayerSkins.includes(eq.playerSkin) ? eq.playerSkin : DEFAULT_PLAYER_SKIN,
    gunSkin: out.ownedGunSkins.includes(eq.gunSkin) ? eq.gunSkin : DEFAULT_GUN_SKIN,
    loadout: loadout.length ? loadout : [out.ownedGuns[0]],
    activeSlot: Math.min(Math.max(0, num(eq.activeSlot, 0)), Math.max(0, loadout.length - 1)),
  };

  out.stats = { ...base.stats };
  if (raw.stats && typeof raw.stats === 'object') {
    for (const key of Object.keys(base.stats)) {
      out.stats[key] = Math.max(0, Math.floor(num(raw.stats[key], base.stats[key])));
    }
  }

  out.settings = { ...base.settings };
  if (raw.settings && typeof raw.settings === 'object') {
    for (const key of Object.keys(base.settings)) {
      out.settings[key] = bool(raw.settings[key], base.settings[key]);
    }
  }

  return out;
}

/** In-memory storage used by tests and by browsers with storage disabled. */
export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    get length() {
      return map.size;
    },
  };
}

export function resolveStorage(explicit) {
  if (explicit) return explicit;
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return memoryStorage();
}

export function loadSave(storage = resolveStorage()) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return { save: createDefaultSave(), fresh: true };
    return { save: normaliseSave(JSON.parse(raw)), fresh: false };
  } catch {
    return { save: createDefaultSave(), fresh: true };
  }
}

export function persistSave(save, storage = resolveStorage()) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage = resolveStorage()) {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
  return createDefaultSave();
}

export function exportSaveString(save) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(save))));
}

export function importSaveString(str) {
  try {
    const json = decodeURIComponent(escape(atob(str.trim())));
    return normaliseSave(JSON.parse(json));
  } catch {
    return null;
  }
}
