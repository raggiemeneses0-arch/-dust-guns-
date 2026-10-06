/**
 * Cosmetic skins. Player skins recolour the cowboy; gun skins recolour
 * whatever you are holding. Both are bought with currency in the shop.
 *   - price  > 0  costs coins
 *   - bounty > 0  costs bounty stars (rare drops from bosses / map clears)
 */

export const SKIN_RARITY = {
  common: { key: 'common', label: 'Common', color: '#b9b0a2' },
  uncommon: { key: 'uncommon', label: 'Uncommon', color: '#7fd07a' },
  rare: { key: 'rare', label: 'Rare', color: '#6fb4ff' },
  epic: { key: 'epic', label: 'Epic', color: '#c58cff' },
  legendary: { key: 'legendary', label: 'Legendary', color: '#ffbe4d' },
};

export const DEFAULT_PLAYER_SKIN = 'dust-drifter';
export const DEFAULT_GUN_SKIN = 'blued-steel';

/**
 * colours: hat / hatBand / coat / shirt / bandana / skin / boots
 */
export const PLAYER_SKINS = [
  {
    id: 'dust-drifter',
    name: 'Dust Drifter',
    rarity: 'common',
    price: 0,
    bounty: 0,
    blurb: 'Trail-worn browns. Free with the hat.',
    colours: { hat: '#8a6a45', hatBand: '#3f2f21', coat: '#6b5335', shirt: '#c9b48d', bandana: '#a8412f', skin: '#d9a06b', boots: '#3a2a1c' },
  },
  {
    id: 'red-bandana',
    name: 'Red Bandana',
    rarity: 'common',
    price: 250,
    bounty: 0,
    blurb: 'Ranch hand colours. Honest work, mostly.',
    colours: { hat: '#7d6248', hatBand: '#7d1f1f', coat: '#5c4a3a', shirt: '#e0d3b4', bandana: '#d13b2a', skin: '#c98f5f', boots: '#3d2b1d' },
  },
  {
    id: 'prospector',
    name: 'Old Prospector',
    rarity: 'uncommon',
    price: 700,
    bounty: 0,
    blurb: 'Forty years in the hills and one very good week.',
    colours: { hat: '#a38352', hatBand: '#5b4a2c', coat: '#7a6a4a', shirt: '#b6a177', bandana: '#4a6b45', skin: '#c98a5a', boots: '#4a3620' },
  },
  {
    id: 'black-duster',
    name: 'Black Duster',
    rarity: 'rare',
    price: 1800,
    bounty: 0,
    blurb: 'Long coat, longer shadow. Nobody asks questions.',
    colours: { hat: '#232124', hatBand: '#6b1f2a', coat: '#1c1a1d', shirt: '#3a373d', bandana: '#6b1f2a', skin: '#cf9a6b', boots: '#141214' },
  },
  {
    id: 'the-marshal',
    name: 'The Marshal',
    rarity: 'rare',
    price: 2600,
    bounty: 0,
    blurb: 'Star on the chest, law in the holster.',
    colours: { hat: '#4a4f57', hatBand: '#c8a53f', coat: '#39434f', shirt: '#dbe4ec', bandana: '#2f5f7a', skin: '#d5a274', boots: '#20242a' },
  },
  {
    id: 'el-diablo',
    name: 'El Diablo',
    rarity: 'epic',
    price: 5200,
    bounty: 0,
    blurb: 'They say the desert taught him to shoot. The desert disagrees.',
    colours: { hat: '#5a1414', hatBand: '#e0a02a', coat: '#3d0f10', shirt: '#7a1f1f', bandana: '#e8c15a', skin: '#b8763f', boots: '#2a0a0a' },
  },
  {
    id: 'pale-rider',
    name: 'Pale Rider',
    rarity: 'epic',
    price: 0,
    bounty: 6,
    blurb: 'White as bone dust. Earned by clearing the Mesa.',
    colours: { hat: '#e3e0d6', hatBand: '#8d8b82', coat: '#d5d1c4', shirt: '#f2efe6', bandana: '#9c9a91', skin: '#d7ab7e', boots: '#a49f92' },
  },
  {
    id: 'golden-marshal',
    name: 'Golden Marshal',
    rarity: 'legendary',
    price: 0,
    bounty: 14,
    blurb: 'Gold star, gold iron. The territory is yours.',
    colours: { hat: '#e0b34a', hatBand: '#7a5a17', coat: '#b98a2c', shirt: '#f5e0a8', bandana: '#7a5a17', skin: '#e0b183', boots: '#5c4413' },
  },
];

export const GUN_SKINS = [
  {
    id: 'blued-steel',
    name: 'Blued Steel',
    rarity: 'common',
    price: 0,
    bounty: 0,
    blurb: 'Factory finish. Honest iron.',
    colours: { body: '#3c4046', trim: '#22252a', grip: '#4a3524' },
  },
  {
    id: 'worn-brass',
    name: 'Worn Brass',
    rarity: 'common',
    price: 400,
    bounty: 0,
    blurb: 'Sweat and sunburn baked into the metal.',
    colours: { body: '#8a7340', trim: '#5d4c26', grip: '#3f2d1c' },
  },
  {
    id: 'rosewood',
    name: 'Rosewood',
    rarity: 'uncommon',
    price: 950,
    bounty: 0,
    blurb: 'Carved grip, hand-oiled. Someone loved this gun.',
    colours: { body: '#4a4d55', trim: '#8a3b34', grip: '#7a3a2e' },
  },
  {
    id: 'silver-engraved',
    name: 'Silver Engraved',
    rarity: 'rare',
    price: 2200,
    bounty: 0,
    blurb: 'Scrollwork on the receiver. Bought with blood money, spent twice.',
    colours: { body: '#c8ccd4', trim: '#8f95a1', grip: '#2f3a2c' },
  },
  {
    id: 'bone-white',
    name: 'Bone White',
    rarity: 'epic',
    price: 4300,
    bounty: 0,
    blurb: 'Bleached in the sun. It has been out there a long time.',
    colours: { body: '#ddd8c8', trim: '#9d988a', grip: '#57534a' },
  },
  {
    id: 'gold-inlaid',
    name: 'Gold Inlaid',
    rarity: 'legendary',
    price: 0,
    bounty: 10,
    blurb: 'Every part of it worth more than the town it defends.',
    colours: { body: '#e3b64c', trim: '#8a6a1c', grip: '#3a2a12' },
  },
];

const PLAYER_INDEX = new Map(PLAYER_SKINS.map((s) => [s.id, s]));
const GUN_SKIN_INDEX = new Map(GUN_SKINS.map((s) => [s.id, s]));

export function getPlayerSkin(id) {
  return PLAYER_INDEX.get(id) ?? PLAYER_INDEX.get(DEFAULT_PLAYER_SKIN);
}

export function getGunSkin(id) {
  return GUN_SKIN_INDEX.get(id) ?? GUN_SKIN_INDEX.get(DEFAULT_GUN_SKIN);
}

export const PLAYER_SKIN_IDS = PLAYER_SKINS.map((s) => s.id);
export const GUN_SKIN_IDS = GUN_SKINS.map((s) => s.id);
