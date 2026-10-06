/**
 * The full arsenal. Every number here drives real behaviour in the sim:
 *  - damage        per pellet, before falloff and crits
 *  - fireRate      ms between shots (auto guns fire while held)
 *  - mag / reload  magazine size and reload time in ms
 *  - pellets       >1 turns the gun into a shotgun
 *  - spread        base cone in radians; grows with heat
 *  - heatPerShot / heatDecay  recoil model, spread climbs while firing
 *  - pierce        how many bodies a shot passes through
 *  - splash        explosion radius in px (0 = no blast)
 *  - range         px travelled before the bullet dies
 */

export const RARITY = {
  common: { key: 'common', label: 'Common', color: '#b9b0a2' },
  uncommon: { key: 'uncommon', label: 'Uncommon', color: '#7fd07a' },
  rare: { key: 'rare', label: 'Rare', color: '#6fb4ff' },
  epic: { key: 'epic', label: 'Epic', color: '#c58cff' },
  legendary: { key: 'legendary', label: 'Legendary', color: '#ffbe4d' },
};

export const GUN_CLASS = {
  revolver: { key: 'revolver', label: 'Revolver' },
  shotgun: { key: 'shotgun', label: 'Shotgun' },
  rifle: { key: 'rifle', label: 'Rifle' },
  repeater: { key: 'repeater', label: 'Repeater' },
  heavy: { key: 'heavy', label: 'Heavy' },
  exotic: { key: 'exotic', label: 'Exotic' },
};

const gun = (g) => ({
  pellets: 1,
  pierce: 0,
  splash: 0,
  knockback: 60,
  auto: false,
  heatPerShot: 0.05,
  heatDecay: 1.5,
  spreadPerShot: 0,
  critChance: 0.06,
  critMult: 2,
  ...g,
});

export const STARTER_GUN_ID = 'rusty-peacemaker';

export const GUNS = [
  gun({
    id: 'rusty-peacemaker',
    name: "Rusty Peacemaker",
    klass: 'revolver',
    rarity: 'common',
    price: 0,
    blurb: "Granddad's iron. Pitted barrel, but it has never missed once.",
    damage: 26,
    fireRate: 420,
    mag: 6,
    reload: 1200,
    spread: 0.018,
    bulletSpeed: 900,
    range: 700,
    knockback: 90,
  }),
  gun({
    id: 'boot-derringer',
    name: 'Boot Derringer',
    klass: 'revolver',
    rarity: 'common',
    price: 320,
    blurb: 'Two shots, enormous holes. The surprise is the whole point.',
    damage: 58,
    fireRate: 700,
    mag: 2,
    reload: 850,
    spread: 0.008,
    bulletSpeed: 1000,
    range: 620,
    knockback: 170,
    critChance: 0.18,
  }),
  gun({
    id: 'cattleman-six',
    name: "Cattleman's Six",
    klass: 'revolver',
    rarity: 'uncommon',
    price: 520,
    blurb: 'The frontier standard. Six clean shots and no arguments.',
    damage: 33,
    fireRate: 330,
    mag: 6,
    reload: 1150,
    spread: 0.022,
    bulletSpeed: 960,
    range: 760,
  }),
  gun({
    id: 'coach-gun',
    name: 'Coach Gun',
    klass: 'shotgun',
    rarity: 'uncommon',
    price: 980,
    blurb: 'Twin barrels of bad manners, sawed down for the stagecoach seat.',
    damage: 14,
    pellets: 7,
    fireRate: 800,
    mag: 2,
    reload: 1500,
    spread: 0.19,
    bulletSpeed: 820,
    range: 420,
    knockback: 260,
  }),
  gun({
    id: 'winchester-73',
    name: "Winchester '73",
    klass: 'rifle',
    rarity: 'uncommon',
    price: 1250,
    blurb: 'The gun that won the West, one lever-pump at a time.',
    damage: 44,
    fireRate: 640,
    mag: 8,
    reload: 1650,
    spread: 0.012,
    bulletSpeed: 1250,
    range: 980,
    pierce: 1,
  }),
  gun({
    id: 'sawed-off-boomstick',
    name: 'Sawed-Off Boomstick',
    klass: 'shotgun',
    rarity: 'rare',
    price: 1600,
    blurb: 'Illegal in four territories. Loud in all of them.',
    damage: 16,
    pellets: 8,
    fireRate: 620,
    mag: 3,
    reload: 1750,
    spread: 0.26,
    bulletSpeed: 760,
    range: 360,
    knockback: 380,
    heatPerShot: 0.16,
  }),
  gun({
    id: 'henry-repeater',
    name: 'Henry Repeater',
    klass: 'repeater',
    rarity: 'rare',
    price: 2450,
    blurb: 'Sixteen in the tube. Bandits count to eight, then stop counting.',
    damage: 29,
    fireRate: 255,
    mag: 14,
    reload: 1950,
    spread: 0.03,
    spreadPerShot: 0.012,
    bulletSpeed: 1150,
    range: 900,
    heatPerShot: 0.06,
  }),
  gun({
    id: 'twin-peacemakers',
    name: 'Twin Peacemakers',
    klass: 'revolver',
    rarity: 'rare',
    price: 3000,
    blurb: 'Two barrels of diplomacy, fired at the same moment.',
    damage: 24,
    pellets: 2,
    fireRate: 200,
    mag: 12,
    reload: 1500,
    spread: 0.055,
    bulletSpeed: 980,
    range: 720,
    heatPerShot: 0.07,
  }),
  gun({
    id: 'volcanic-repeater',
    name: 'Volcanic Repeater',
    klass: 'repeater',
    rarity: 'epic',
    price: 3900,
    blurb: 'Sprays lead like a saloon brawl. Accuracy is a rumour.',
    damage: 17,
    fireRate: 105,
    mag: 30,
    reload: 2200,
    spread: 0.06,
    spreadPerShot: 0.006,
    bulletSpeed: 1050,
    range: 820,
    auto: true,
    heatPerShot: 0.035,
  }),
  gun({
    id: 'sharpshooter',
    name: "Sharpshooter's Rifle",
    klass: 'rifle',
    rarity: 'epic',
    price: 4600,
    blurb: 'Long barrel, longer reach. Picks a bandit off the ridge.',
    damage: 105,
    fireRate: 900,
    mag: 5,
    reload: 1800,
    spread: 0.004,
    bulletSpeed: 1650,
    range: 1500,
    pierce: 2,
    critChance: 0.22,
  }),
  gun({
    id: 'buffalo-rifle',
    name: 'Buffalo Rifle',
    klass: 'heavy',
    rarity: 'epic',
    price: 6200,
    blurb: 'Built for buffalo. Works equally well on anything wearing a hat.',
    damage: 165,
    fireRate: 1400,
    mag: 1,
    reload: 2400,
    spread: 0.002,
    bulletSpeed: 1750,
    range: 1600,
    pierce: 4,
    knockback: 420,
  }),
  gun({
    id: 'dynamite-launcher',
    name: 'Dynamite Launcher',
    klass: 'heavy',
    rarity: 'epic',
    price: 7400,
    blurb: 'A trimmed-down cannon. The blast does the arguing.',
    damage: 70,
    fireRate: 1500,
    mag: 1,
    reload: 2600,
    spread: 0.02,
    bulletSpeed: 640,
    range: 700,
    splash: 130,
    knockback: 520,
    critChance: 0,
  }),
  gun({
    id: 'hand-crank-gatling',
    name: 'Hand-Crank Gatling',
    klass: 'heavy',
    rarity: 'legendary',
    price: 10500,
    blurb: 'Ninety rounds of pure frontier enthusiasm. Heavy as sin.',
    damage: 15,
    fireRate: 68,
    mag: 90,
    reload: 3500,
    spread: 0.1,
    spreadPerShot: 0.0025,
    bulletSpeed: 1100,
    range: 860,
    auto: true,
    heatPerShot: 0.018,
    heatDecay: 1.1,
  }),
  gun({
    id: 'golden-peacemaker',
    name: 'Golden Peacemaker',
    klass: 'exotic',
    rarity: 'legendary',
    price: 0,
    bounty: 12,
    blurb: 'Engraved with every name it has ever settled. Legendary.',
    damage: 66,
    fireRate: 300,
    mag: 6,
    reload: 1050,
    spread: 0.01,
    bulletSpeed: 1200,
    range: 900,
    critChance: 0.4,
    critMult: 2.6,
    knockback: 200,
  }),
];

const GUN_INDEX = new Map(GUNS.map((g) => [g.id, g]));

export function getGun(id) {
  return GUN_INDEX.get(id) ?? null;
}

export function getGunOrDefault(id) {
  return GUN_INDEX.get(id) ?? GUN_INDEX.get(STARTER_GUN_ID);
}

/** Total pellets a single trigger pull releases. */
export function shotPellets(gunDef) {
  return Math.max(1, gunDef.pellets ?? 1);
}

/**
 * Effective spread for a shot, in radians.
 * Base cone + accumulated heat + per-shot climb, floored at the base cone.
 */
export function effectiveSpread(gunDef, heat = 0) {
  const base = gunDef.spread ?? 0;
  const climb = (gunDef.spreadPerShot ?? 0) * Math.min(heat * 6, 1);
  const heatSpread = heat * base * 1.4;
  return base + climb + heatSpread;
}

/** Damage roll for one pellet, applying falloff over range and crits. */
export function rollDamage(gunDef, distanceTravelled, roll) {
  const falloffStart = (gunDef.range ?? 800) * 0.55;
  const falloffEnd = gunDef.range ?? 800;
  let mult = 1;
  if (distanceTravelled > falloffStart) {
    const t = Math.min(1, (distanceTravelled - falloffStart) / Math.max(1, falloffEnd - falloffStart));
    mult = 1 - t * 0.45;
  }
  const isCrit = roll < (gunDef.critChance ?? 0);
  return {
    damage: Math.round(gunDef.damage * mult * (isCrit ? (gunDef.critMult ?? 2) : 1)),
    isCrit,
  };
}

export function dpsOf(gunDef) {
  const perShot = gunDef.damage * shotPellets(gunDef);
  const perSecond = 1000 / gunDef.fireRate;
  return Math.round(perShot * perSecond);
}

export function gunDamagePerShot(gunDef) {
  return gunDef.damage * shotPellets(gunDef);
}

export const GUN_IDS = GUNS.map((g) => g.id);
