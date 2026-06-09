const MAX_PACKS = 10;
const MAX_ENERGY = 5; 
const BASIC_LEXICON_EMOJI = '<:Basic_Lexicon:1513502433983332352>';

const PACK_WEIGHTS = [
  { type: 'Standard', weight: 90 },
  { type: 'Graded', weight: 9 },
  { type: 'Fixed', weight: 1 }
];

const RARITY_WEIGHTS = [
  { type: 'Common', weight: 50 },
  { type: 'Uncommon', weight: 40 },
  { type: 'Rare', weight: 15 },
  { type: 'Epic', weight: 4.25 },
  { type: 'Legendary', weight: 0.25 }
];

const LEXICON_ENERGY = [
  { name: 'White', emoji: '<:Basic_Lexicon:1513502433983332352>', mult: 1, weight: 100 },
  { name: 'Indigo (Cracked)', emoji: '<:Indigo_Cracked_Lexicon:1513502436134883478>', mult: 0.5, weight: 80 },
  { name: 'Violet', emoji: '<:Violet_Lexicon:1513502441285619823>', mult: 1.5, weight: 60 },
  { name: 'Blue', emoji: '<:Blue_Lexicon:1513502434608021604>', mult: 2, weight: 50 },
  { name: 'Green', emoji: '<:Green_Lexicon:1513502435329704046>', mult: 4, weight: 30 },
  { name: 'Yellow', emoji: '<:Yellow_Lexicon:1513502442539712593>', mult: 6, weight: 15 },
  { name: 'Orange', emoji: '<:Orange_Lexicon:1513502438605197492>', mult: 8, weight: 8 },
  { name: 'Red', emoji: '<:Red_Lexicon:1513502440929099837>', mult: 10, weight: 4 },
  { name: 'Rainbow', emoji: '<:Rainbow_Lexicon:1513502440253816902>', mult: 35, weight: 1 },
  { name: 'Black', emoji: '<:Dark_Lexicon:1513505715099013250>', mult: 'random', weight: 5 }
];

const COLORS = { 
  'Legendary': '#ffd700', 'Epic': '#a335ee', 'Rare': '#0070dd', 
  'Uncommon': '#1eff00', 'Common': '#2b2d31', 'Energy': '#00ffcc' 
};

function getWeightedRandom(array) {
  const totalWeight = array.reduce((sum, item) => sum + item.weight, 0);
  let randomNum = Math.random() * totalWeight;
  for (const item of array) {
    if (randomNum < item.weight) return item;
    randomNum -= item.weight;
  }
  return array[0];
}

function getConditionString(float) {
  if (float > 0.90) return 'Mint';
  if (float > 0.70) return 'Excellent';
  if (float > 0.40) return 'Good';
  if (float > 0.15) return 'Worn';
  return 'Damaged';
}

module.exports = {
  MAX_PACKS, MAX_ENERGY, BASIC_LEXICON_EMOJI, PACK_WEIGHTS, RARITY_WEIGHTS, LEXICON_ENERGY, COLORS,
  getWeightedRandom, getConditionString
};