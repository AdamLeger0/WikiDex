require('dotenv').config();
const axios = require('axios');
const config = require('./config');

const userPoint = process.env.USER_POINT || 'https://github.com/adamleger0/wikidex';
const userEmail = process.env.USER_EMAIL || 'bot-admin@example.com';
const USER_AGENT = `WikiDexBot/1.0 (${userPoint}; ${userEmail})`;

function getBaseValue(rarity) {
  if (rarity === 'Legendary') return Math.floor(Math.random() * 200) + 400;
  if (rarity === 'Epic') return Math.floor(Math.random() * 100) + 200;
  if (rarity === 'Rare') return Math.floor(Math.random() * 50) + 100;
  if (rarity === 'Uncommon') return Math.floor(Math.random() * 30) + 70;
  return Math.floor(Math.random() * 30) + 40; 
}

function getExponentialLexiconValue() {
  const skew = Math.pow(Math.random(), 4); 
  return 50 + Math.floor(skew * 151); 
}

async function getRandomWikiPage() {
  try {
    if (Math.random() < 0.10) {
      const lex = config.getWeightedRandom(config.LEXICON_ENERGY);
      const lexValue = getExponentialLexiconValue();
      return {
        isLexiconCard: true, title: `${lex.name} Lexicon Card`, description: `A pure energy card radiating with ${lex.name} energy!`,
        url: null, imageUrl: null, rarity: 'Energy', value: lexValue, quality: 1.0, lexiconDrop: lex
      };
    }

    const response = await axios.get('https://en.wikipedia.org/api/rest_v1/page/random/summary', { headers: { 'User-Agent': USER_AGENT } });
    const data = response.data;
    if (!data.title || data.type === 'no-title') return null;

    const rarityDrop = config.getWeightedRandom(config.RARITY_WEIGHTS);
    return {
      isLexiconCard: false, title: data.title, description: data.extract || '...',
      url: data.content_urls.desktop.page, imageUrl: data.thumbnail ? data.thumbnail.source : null,
      rarity: rarityDrop.type, value: getBaseValue(rarityDrop.type), quality: null
    };
  } catch (error) { return null; }
}

async function getSpecificWikiPage(title) {
  try {
    const response = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { 'User-Agent': USER_AGENT } });
    const data = response.data;
    if (!data.title || data.type === 'no-title') return null;

    const rarityDrop = config.getWeightedRandom(config.RARITY_WEIGHTS);
    return {
      isLexiconCard: false, title: data.title, description: data.extract || '...', url: data.content_urls ? data.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      imageUrl: data.thumbnail ? data.thumbnail.source : null, rarity: rarityDrop.type, value: getBaseValue(rarityDrop.type), quality: null
    };
  } catch (error) { return null; } 
}

async function getWikiPack(size = 10, packType = 'Standard', userWishes = []) {
  const results = [];
  const stdWishes = userWishes.filter(w => w.isEnhanced === 0);
  const enhWishes = userWishes.filter(w => w.isEnhanced === 1);

  for (let i = 0; i < size; i++) {
    let page = null;
    let isWishSpawn = false;

    if (enhWishes.length > 0 && Math.random() < 0.01) {
      const w = enhWishes[Math.floor(Math.random() * enhWishes.length)];
      page = await getSpecificWikiPage(w.wikiTitle);
      isWishSpawn = true;
    } else if (stdWishes.length > 0 && Math.random() < 0.005) {
      const w = stdWishes[Math.floor(Math.random() * stdWishes.length)];
      page = await getSpecificWikiPage(w.wikiTitle);
      isWishSpawn = true;
    }

    if (!page) page = await getRandomWikiPage();
    if (!page) continue;

    if (isWishSpawn) page.isWishSpawn = true;

    if (!page.isLexiconCard) {
      if (packType === 'Graded' && page.rarity === 'Common') {
        page.rarity = 'Rare'; page.value = getBaseValue('Rare');
      } else if (packType === 'Fixed' && i === 0 && !isWishSpawn) {
        page.rarity = 'Legendary'; page.value = getBaseValue('Legendary');
      }
    }
    results.push(page);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (packType === 'Fixed') results.sort(() => Math.random() - 0.5);
  return results;
}

// Exporting getBaseValue so index.js can use it for repairs
module.exports = { getRandomWikiPage, getWikiPack, getSpecificWikiPage, getBaseValue };