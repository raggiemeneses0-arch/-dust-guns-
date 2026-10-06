/**
 * Currency maths. Two currencies:
 *   coins   -- earned on every kill, spent on guns, skins and map access
 *   bounty  -- rare stars from bosses and map clears, for legendary gear
 */

import { ECONOMY } from '../config.js';
import { getEnemyType } from '../data/enemies.js';
import { getMap } from '../data/maps.js';

export function canAfford(save, { coins = 0, bounty = 0 } = {}) {
  return save.coins >= coins && save.bounty >= bounty;
}

export function priceOf(item) {
  if (!item) return { coins: 0, bounty: 0 };
  return { coins: item.price ?? 0, bounty: item.bounty ?? 0 };
}

/** Coins a single kill pays out. */
export function coinsForKill(enemyTypeId, map) {
  const type = getEnemyType(enemyTypeId);
  return Math.max(1, Math.round(type.coins * map.rewardScale * ECONOMY.baseKillCoins));
}

/** Bounty stars a kill pays out (bosses only). */
export function bountyForKill(enemyTypeId, map) {
  const type = getEnemyType(enemyTypeId);
  if (!type.bounty) return 0;
  return Math.max(1, Math.round(type.bounty * (map.id === 'sunset-mesa' ? 1 : 0.5) + 1));
}

/** Flat bonus for surviving a wave. */
export function waveClearBonus(wave, map) {
  return Math.round(ECONOMY.waveBonusPerWave * wave * map.rewardScale);
}

/** Payout for finishing every wave of a map. */
export function mapClearReward(map) {
  return {
    coins: Math.round(ECONOMY.mapClearBonus * map.rewardScale),
    bounty: ECONOMY.mapClearBounty,
  };
}

/** What you get back for selling a gun. Legendary / free gear cannot be sold. */
export function sellValueOf(gun) {
  if (!gun || gun.bounty > 0 || (gun.price ?? 0) <= 0) return 0;
  return Math.round(gun.price * ECONOMY.refundRate);
}

/**
 * Apply a reward bundle to a save. Returns a NEW save object.
 * Bundle: { coins, bounty }
 */
export function applyReward(save, { coins = 0, bounty = 0 } = {}) {
  return {
    ...save,
    coins: save.coins + coins,
    bounty: save.bounty + bounty,
    stats: {
      ...save.stats,
      coinsEarned: save.stats.coinsEarned + coins,
      bountyEarned: save.stats.bountyEarned + bounty,
    },
  };
}

export function spend(save, { coins = 0, bounty = 0 } = {}) {
  return {
    ...save,
    coins: Math.max(0, save.coins - coins),
    bounty: Math.max(0, save.bounty - bounty),
  };
}

/** Total coins ever paid out across a run, for the run summary screen. */
export function summariseRun(run) {
  const kills = run.kills ?? 0;
  const waves = run.wavesCleared ?? 0;
  const accuracy = run.shotsFired > 0 ? Math.round((run.shotsHit / run.shotsFired) * 100) : 0;
  return {
    kills,
    wavesCleared: waves,
    coins: run.coins ?? 0,
    bounty: run.bounty ?? 0,
    accuracy,
    headshots: run.headshots ?? 0,
  };
}

/** Convenience: is a map purchasable right now? */
export function mapPurchaseStatus(map, save) {
  if (map.unlock.kind === 'free') return { purchasable: false, reason: 'free' };
  if (save.clearedMaps?.includes(map.unlock.mapId)) return { purchasable: false, reason: 'cleared' };
  if (save.boughtMaps?.includes(map.id)) return { purchasable: false, reason: 'owned' };
  return {
    purchasable: true,
    reason: 'purchasable',
    cost: map.unlock.cost,
    affordable: save.coins >= map.unlock.cost,
  };
}

export function getMapById(id) {
  return getMap(id);
}
