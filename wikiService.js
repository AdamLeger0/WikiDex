require('dotenv').config();
const axios = require('axios');
const config = require('./config');

const userPoint = process.env.USER_POINT || 'https://github.com/adamleger0/wikidex';
const userEmail = process.env.USER_EMAIL || 'bot-admin@example.com';
const USER_AGENT = `WikiDexBot/1.0 (${userPoint}; ${userEmail})`;

function getBaseValue(rarity) {
  if (rarity === 'Artifact') return Math.floor(Math.random() * 500) + 1000;
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

async function getPageViews(title) {
  try {
    const cleanTitle = encodeURIComponent(title.replace(/ /g, '_'));
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${cleanTitle}/monthly/2015070100/2030010100`;
    
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
    const items = res.data.items;
    if (!items || items.length === 0) return 0;
    
    let total = 0;
    for (let item of items) {
      total += item.views;
    }
    return total;
  } catch (e) {
    return 0;
  }
}

function getRarityFromViews(views) {
  for (let tier of config.RARITY_VIEWS) {
      if (views >= tier.minViews) return tier.type;
  }
  return 'Common';
}

async function getRandomWikiPage(buffs, hasLexBuff) {
  try {
    if (Math.random() < 0.01) {
      let lex = config.getWeightedRandom(config.LEXICON_ENERGY);
      lex = config.processLexiconModifiers(lex, buffs, hasLexBuff);
      return {
        isLexiconCard: true, title: `${lex.name} Lexicon Card`, description: `A pure energy card radiating with ${lex.name} energy!`,
        url: null, imageUrl: null, rarity: 'Energy', value: getExponentialLexiconValue(), quality: 1.0, lexiconDrop: lex
      };
    }

    const response = await axios.get('https://en.wikipedia.org/api/rest_v1/page/random/summary', { headers: { 'User-Agent': USER_AGENT } });
    const data = response.data;
    if (!data.title || data.type === 'no-title') return null;

    const views = await getPageViews(data.title);
    const rarity = getRarityFromViews(views);

    return {
      isLexiconCard: false, title: data.title, description: data.extract || '...',
      url: data.content_urls.desktop.page, imageUrl: data.thumbnail ? data.thumbnail.source : null,
      rarity: rarity, value: getBaseValue(rarity), quality: null, views: views
    };
  } catch (error) { return null; }
}

async function getSpecificWikiPage(title) {
  try {
    const response = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { 'User-Agent': USER_AGENT } });
    const data = response.data;
    if (!data.title || data.type === 'no-title') return null;

    const views = await getPageViews(data.title);
    const rarity = getRarityFromViews(views);

    return {
      isLexiconCard: false, title: data.title, description: data.extract || '...', url: data.content_urls ? data.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      imageUrl: data.thumbnail ? data.thumbnail.source : null, rarity: rarity, value: getBaseValue(rarity), quality: null, views: views
    };
  } catch (error) { return null; } 
}

async function getWikiPack(packType = 'Standard', userWishes = [], buffs = {wishMult: 1, enhancedWishMult: 1}, scrapTitles = [], hasLexBuff = false) {
  let size = 10;
  if (packType.startsWith('Mega')) size = 20;
  if (packType === 'Energy') size = 3;
  if (packType === 'Discount') size = 5;
  if (packType === 'Scrap') size = 5;
  if (packType === 'Wish') size = 1;

  const results = [];
  const stdWishes = userWishes.filter(w => w.isEnhanced === 0);
  const enhWishes = userWishes.filter(w => w.isEnhanced > 0);

  for (let i = 0; i < size; i++) {
    let page = null;
    let isWishSpawn = false;

    if (packType === 'Wish') {
      if (userWishes.length === 0) return []; 
      const w = userWishes[Math.floor(Math.random() * userWishes.length)];
      page = await getSpecificWikiPage(w.wikiTitle);
      isWishSpawn = true;
    } else if (packType === 'Scrap') {
      if (scrapTitles.length > i) page = await getSpecificWikiPage(scrapTitles[i]);
      else page = await getRandomWikiPage(buffs, hasLexBuff);
    } else if (packType === 'Energy') {
      let lex = config.getWeightedRandom(config.LEXICON_ENERGY);
      lex = config.processLexiconModifiers(lex, buffs, hasLexBuff);
      page = { isLexiconCard: true, title: `${lex.name} Lexicon Card`, description: `A pure energy card radiating with ${lex.name} energy!`, url: null, imageUrl: null, rarity: 'Energy', value: getExponentialLexiconValue(), quality: 1.0, lexiconDrop: lex };
    } else {
      
      let forcePremium = false;
      if (packType === 'Discount') forcePremium = true;
      if ((packType === 'Fixed' || packType === 'Mega Fixed') && i === 0) forcePremium = true;

      if (!forcePremium) {
          if (enhWishes.length > 0 && Math.random() < (0.01 * buffs.enhancedWishMult)) {
            const w = enhWishes[Math.floor(Math.random() * enhWishes.length)];
            page = await getSpecificWikiPage(w.wikiTitle);
            isWishSpawn = true;
          } else if (stdWishes.length > 0 && Math.random() < (0.005 * buffs.wishMult)) {
            const w = stdWishes[Math.floor(Math.random() * stdWishes.length)];
            page = await getSpecificWikiPage(w.wikiTitle);
            isWishSpawn = true;
          }
      }

      if (!page) {
          if (forcePremium) {
              // Guaranteed fetch from the high-view pool ensures views matching labels
              const rTitle = config.PREMIUM_TITLES[Math.floor(Math.random() * config.PREMIUM_TITLES.length)];
              page = await getSpecificWikiPage(rTitle);
          } else {
              page = await getRandomWikiPage(buffs, hasLexBuff);
          }
      }
    }

    if (!page) continue;
    if (isWishSpawn) page.isWishSpawn = true;

    if (!page.isLexiconCard) {
        // If a graded pack rolls a common naturally, we swap it out for a premium fetch
        if ((packType === 'Graded' || packType === 'Mega Graded') && (page.rarity === 'Common' || page.rarity === 'Uncommon')) {
            const rTitle = config.PREMIUM_TITLES[Math.floor(Math.random() * config.PREMIUM_TITLES.length)];
            page = await getSpecificWikiPage(rTitle) || page;
        }
    }
    
    results.push(page);
  }
  
  if (packType === 'Fixed' || packType === 'Mega Fixed') results.sort(() => Math.random() - 0.5);
  return results;
}

module.exports = { getRandomWikiPage, getWikiPack, getSpecificWikiPage, getBaseValue };