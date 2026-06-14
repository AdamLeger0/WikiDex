const MAX_PACKS = 10;
const MAX_ENERGY = 5; 
const BASIC_LEXICON_EMOJI = '<:Basic_Lexicon:1513502433983332352>';
const ALEXANDRITE_EMOJI = '<:Alexandrite:1513707257336959046>';

const WISH_MAX = 4;

const PACK_SELL_PRICES = {
  'Standard': 50, 'Graded': 300, 'Fixed': 500, 'Mega': 400, 'Mega Graded': 1000, 
  'Mega Fixed': 1500, 'Duo': 200, 'Energy': 150, 'Discount': 100, 'Wish': 2000, 'Scrap': 100
};

const PACK_WEIGHTS = [
  { type: 'Standard', weight: 90 }, { type: 'Graded', weight: 9 }, { type: 'Fixed', weight: 1 },
  { type: 'Mega', weight: 0 }, { type: 'Mega Graded', weight: 0 }, { type: 'Mega Fixed', weight: 0 },
  { type: 'Duo', weight: 0 }, { type: 'Energy', weight: 0 }, { type: 'Discount', weight: 0 },
  { type: 'Wish', weight: 0 }, { type: 'Scrap', weight: 0 }
];

const RARITY_VIEWS = [
  { type: 'Artifact', minViews: 15000000 }, 
  { type: 'Legendary', minViews: 1000000 }, 
  { type: 'Epic', minViews: 300000 },       
  { type: 'Rare', minViews: 50000 },        
  { type: 'Uncommon', minViews: 5000 },     
  { type: 'Common', minViews: 0 }           
];

const CONDITION_TIERS = {
  Standard: [
    { name: 'Ruined', weight: 20, min: 0.000, max: 0.2499999999 },
    { name: 'Damaged', weight: 50, min: 0.250, max: 0.4499999999 },
    { name: 'Worn', weight: 15, min: 0.450, max: 0.6999999999 },
    { name: 'Good', weight: 10, min: 0.700, max: 0.8499999999 },
    { name: 'Excellent', weight: 5, min: 0.850, max: 0.9999999999 },
    { name: 'Perfect', weight: 0, min: 1.0, max: 1.0 } 
  ],
  Premium: [
    { name: 'Ruined', weight: 0, min: 0.000, max: 0.2499999999 },
    { name: 'Damaged', weight: 20, min: 0.250, max: 0.4499999999 },
    { name: 'Worn', weight: 50, min: 0.450, max: 0.6999999999 },
    { name: 'Good', weight: 15, min: 0.700, max: 0.8499999999 },
    { name: 'Excellent', weight: 15, min: 0.850, max: 0.9999999999 },
    { name: 'Perfect', weight: 0, min: 1.0, max: 1.0 }
  ]
};

const FORGE_COSTS = {
  'Ruined': { cost: 1000, nextTier: 'Damaged', nextBase: 0.250 },
  'Damaged': { cost: 2000, nextTier: 'Worn', nextBase: 0.450 },
  'Worn': { cost: 4000, nextTier: 'Good', nextBase: 0.700 },
  'Good': { cost: 8000, nextTier: 'Excellent', nextBase: 0.850 },
  'Excellent': { cost: 16000, nextTier: 'Perfect', nextBase: 1.0 }
};

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

const LEXICON_HIERARCHY = [
  'Indigo (Cracked)', 'White', 'Violet', 'Blue', 'Green', 'Yellow', 'Orange', 'Red', 'Rainbow'
];

const COLORS = { 
  'Artifact': '#ff00ff', 'Legendary': '#ffd700', 'Epic': '#a335ee', 'Rare': '#0070dd', 
  'Uncommon': '#1eff00', 'Common': '#2b2d31', 'Energy': '#00ffcc' 
};

const BADGES_CONFIG = [
  { name: 'Knowledge', baseCost: 1000, desc: [ "Energy Pack Chance (1%)", "Max Packs Capacity +2", "Non-Standard Pack Boost", "Bonus: Energy Pack Chance (3%) & Mega Packs Unlocked" ] },
  { name: 'World', baseCost: 2000, desc: [ "Cracked Lexicon 0.75x Buff", "Wishlist Slots +2", "Max Energy +2", "Bonus: White Lexicons turn Green & Duo Packs Unlocked" ] },
  { name: 'Economy', baseCost: 4000, desc: [ "Max Energy +2", "Lexicon Drops +5%", "Unlocks Stock Market", "Bonus: Max Energy +4 & Claiming grants Card Value" ] },
  { name: 'Science', baseCost: 8000, desc: [ "Wish Chance +15%", "Enhanced Wish Chance +15%", "Wish Cards Damage Immune", "Bonus: Wish Slots +4 & 1/100k Wish Pack Mutation" ] }
];

const SHOP_BUFFS = {
  daily_1: { category: 'daily', label: '1 Day (1.5x)', name: 'Brew of the Chronicler - Vial', cost: 5000, mult: 1.5, ms: 86400000 },
  daily_3: { category: 'daily', label: '3 Days (2.0x)', name: 'Brew of the Chronicler - Flask', cost: 13500, mult: 2.0, ms: 259200000 },
  daily_5: { category: 'daily', label: '5 Days (2.5x)', name: 'Brew of the Chronicler - Carafe', cost: 20000, mult: 2.5, ms: 432000000 },
  daily_7: { category: 'daily', label: '7 Days (3.0x)', name: 'Brew of the Chronicler - Cauldron', cost: 25000, mult: 3.0, ms: 604800000 },
  lex_1: { category: 'lex', label: '1 Hour', name: 'Elixir of Resonance - Drop', cost: 10000, ms: 3600000 },
  lex_2: { category: 'lex', label: '2 Hours', name: 'Elixir of Resonance - Vial', cost: 18000, ms: 7200000 },
  lex_4: { category: 'lex', label: '4 Hours', name: 'Elixir of Resonance - Flask', cost: 32000, ms: 14400000 },
  lex_12: { category: 'lex', label: '12 Hours', name: 'Elixir of Resonance - Carafe', cost: 85000, ms: 43200000 }
};

// NEW: Hand-picked pool of highly viewed pages to guarantee real rarities when a pack demands it
const PREMIUM_TITLES = [
  'United States', 'Earth', 'World War II', 'Donald Trump', 'Elon Musk', 'Elizabeth II', 'Cristiano Ronaldo', 'YouTube', 'Google',
  'Albert Einstein', 'Michael Jackson', 'William Shakespeare', 'Adolf Hitler', 'New York City', 'Bitcoin', 'Lionel Messi', 'Taylor Swift',
  'Periodic table', 'Leonardo da Vinci', 'Isaac Newton', 'Winston Churchill', 'Abraham Lincoln', 'George Washington', 'Nelson Mandela',
  'Game of Thrones', 'Star Wars', 'Harry Potter', 'Avengers: Endgame', 'Internet', 'COVID-19 pandemic', 'India', 'United Kingdom',
  'Eminem', 'Marilyn Monroe', 'Steve Jobs', 'Muhammad Ali', 'Mahatma Gandhi', 'Julius Caesar', 'Cleopatra', 'Napoleon'
];

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
  if (float >= 1.0) return 'Perfect';
  if (float >= 0.850) return 'Excellent';
  if (float >= 0.700) return 'Good';
  if (float >= 0.450) return 'Worn';
  if (float >= 0.250) return 'Damaged';
  return 'Ruined';
}

function getMaxQualityForTier(float) {
  if (float >= 0.850) return 0.9999999999;
  if (float >= 0.700) return 0.8499999999;
  if (float >= 0.450) return 0.6999999999;
  if (float >= 0.250) return 0.4499999999;
  return 0.2499999999;
}

function generateConditionFloat(packType, isWishSpawn = false, buffs = {}) {
  if (packType === 'Discount') return (Math.random() * 0.2499999999); 
  
  const isPremium = packType.includes('Graded') || packType.includes('Fixed');
  const tierSet = isPremium ? CONDITION_TIERS.Premium : CONDITION_TIERS.Standard;
  const selectedTier = getWeightedRandom(tierSet);
  
  let min = selectedTier.min;
  let max = selectedTier.max;

  if (isWishSpawn && buffs.wishNoDamage && selectedTier.name === 'Damaged') {
      min = 0.450; 
      max = Math.max(0.6999999999, max);
  }
  
  return (Math.random() * (max - min)) + min;
}

function processLexiconModifiers(lexDrop, buffs, hasLexiconBuff) {
  let finalDrop = { ...lexDrop, crackedBonus: false, doubleSpawn: false };

  if (buffs.worldBadgeLvl >= 1 && finalDrop.name === 'Indigo (Cracked)') finalDrop.mult = 0.75;
  if (buffs.worldBadgeLvl >= 4 && finalDrop.name === 'White') finalDrop = { ...LEXICON_ENERGY.find(l => l.name === 'Green') };

  if (hasLexiconBuff) {
    if (finalDrop.name === 'Black' || finalDrop.name === 'Rainbow') {
      finalDrop.doubleSpawn = true;
    } else {
      let idx = LEXICON_HIERARCHY.indexOf(finalDrop.name);
      if (idx === 0) finalDrop.crackedBonus = true; 
      if (idx >= 0 && idx < LEXICON_HIERARCHY.length - 1) {
          const newName = LEXICON_HIERARCHY[idx + 1];
          finalDrop = { ...LEXICON_ENERGY.find(l => l.name === newName), crackedBonus: finalDrop.crackedBonus };
      }
    }
  }
  return finalDrop;
}

function getPlayerBuffs(towerDataStr, badgeDataStr) {
  const tData = JSON.parse(towerDataStr || '[0,0,0,0,0,0,0,0,0,0]');
  const bData = JSON.parse(badgeDataStr || '[0,0,0,0]');
  
  let towerMaxE = tData[0] * 1;
  let badgeMaxE = (bData[2] >= 4 ? 4 : (bData[2] >= 1 ? 2 : 0)) + (bData[1] >= 3 ? 2 : 0); 
  let badgeWishSlots = (bData[3] >= 4 ? 4 : 0) + (bData[1] >= 2 ? 2 : 0); 

  let buffs = {
    maxEnergy: towerMaxE + badgeMaxE,
    freeEnergyChance: (tData[1] * 0.10) + (tData[6] * 0.10),
    wishSlots: (tData[2] * 1) + badgeWishSlots,
    packBoost: (tData[3] * 1) + (bData[0] >= 3 ? 5 : 0),
    regenReduction: tData[4] * 0.05,
    wishMult: Math.pow(1.05, tData[5]) * (bData[3] >= 1 ? 1.15 : 1),
    enhancedWishMult: Math.pow(1.10, tData[7]) * (bData[3] >= 2 ? 1.15 : 1),
    lexiconPayoutMult: Math.pow(1.10, tData[8]) * (bData[2] >= 2 ? 1.05 : 1),
    blackLexMult: Math.pow(1.10, tData[9]),
    
    maxPacksBoost: bData[0] >= 2 ? 2 : 0,
    energyPackChance: bData[0] >= 4 ? 0.03 : (bData[0] >= 1 ? 0.01 : 0),
    megaPackUnlocked: bData[0] >= 4,
    duoPackUnlocked: bData[1] >= 4,
    worldBadgeLvl: bData[1], 
    claimCashback: bData[2] >= 4,
    wishNoDamage: bData[3] >= 3,
    wishPackMutation: bData[3] >= 4
  };
  return buffs;
}

module.exports = {
  MAX_PACKS, MAX_ENERGY, WISH_MAX, PACK_SELL_PRICES, FORGE_COSTS, BASIC_LEXICON_EMOJI, ALEXANDRITE_EMOJI, PACK_WEIGHTS, RARITY_VIEWS, LEXICON_ENERGY, COLORS, BADGES_CONFIG, SHOP_BUFFS, PREMIUM_TITLES,
  getWeightedRandom, getConditionString, generateConditionFloat, getPlayerBuffs, getMaxQualityForTier, processLexiconModifiers
};