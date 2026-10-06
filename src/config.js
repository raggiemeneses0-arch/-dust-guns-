/**
 * Global tuning constants for Dust & Guns.
 * Keeping them in one place makes balancing the game a single-file job.
 */

export const WORLD = {
  width: 1600,
  height: 1000,
};

export const PLAYER = {
  radius: 15,
  speed: 215, // px per second
  sprintMultiplier: 1.55,
  maxHp: 100,
  maxStamina: 100,
  staminaDrain: 26, // per second while sprinting
  staminaRegen: 18, // per second while walking
  dashSpeed: 780,
  dashDuration: 0.16, // seconds
  dashCooldown: 1.1, // seconds
  dashInvuln: 0.28,
  pickupMagnetRange: 78,
  invulnAfterHit: 0.35, // i-frames after taking damage
};

export const BULLET = {
  radius: 3.5,
  maxLifetime: 2.2, // seconds
  enemySpeed: 460,
  enemyRadius: 4,
};

export const PICKUP = {
  coinValue: 1,
  ammoCrateMagRefill: 2, // how many magazines worth of ammo a crate restores
  healthFlaskHeal: 35,
  lifetime: 22, // seconds before a pickup fades
};

export const ECONOMY = {
  /** Coins awarded for a kill scale with the map reward modifier. */
  baseKillCoins: 1,
  /** Flat coin bonus for clearing a wave: waveBonusPerWave * wave. */
  waveBonusPerWave: 28,
  /** Coins awarded for finishing a map. */
  mapClearBonus: 400,
  /** Sell price = purchase price * refundRate. */
  refundRate: 0.45,
  /** Boss drops this much bounty currency. */
  bossBounty: 2,
  /** Every completed map awards bounty currency. */
  mapClearBounty: 1,
};

export const WAVES = {
  intermissionSeconds: 12,
  maxActiveEnemies: 22,
  spawnMargin: 40,
};

export const SAVE_KEY = 'dust-and-guns:save:v1';

export const CONTROLS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'],
  dash: ['Space'],
  shop: ['Tab', 'KeyB'],
  pause: ['Escape', 'KeyP'],
  cycleWeapon: ['KeyQ'],
  pickup: ['KeyE'],
  nextWeapon: ['KeyE'],
};
