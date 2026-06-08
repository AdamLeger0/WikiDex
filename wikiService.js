require('dotenv').config();
const axios = require('axios');

const userPoint = process.env.USER_POINT;
const userEmail = process.env.USER_EMAIL;
const USER_AGENT = `WikiDexBot/1.0 (${userPoint}; ${userEmail})`;

async function getRandomWikiPage() {
  try {
    const response = await axios.get('https://en.wikipedia.org/api/rest_v1/page/random/summary', {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = response.data;
    if (!data.title || data.type === 'no-title') return null;

    const articleLength = data.extract ? data.extract.length : 100;
    let rarity = 'Common';
    let value = Math.floor(Math.random() * 30) + 40; 

    if (articleLength > 500) { rarity = 'Legendary'; value = Math.floor(Math.random() * 200) + 400; } 
    else if (articleLength > 350) { rarity = 'Epic'; value = Math.floor(Math.random() * 100) + 200; } 
    else if (articleLength > 200) { rarity = 'Rare'; value = Math.floor(Math.random() * 50) + 100; }

    return {
      title: data.title,
      description: data.extract || 'A mysterious entry in the annals of history...',
      url: data.content_urls.desktop.page,
      imageUrl: data.thumbnail ? data.thumbnail.source : null,
      rarity, value
    };
  } catch (error) { return null; }
}

// Added support for finding specific cards for the /view command
async function getSpecificWikiPage(title) {
  try {
    const response = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = response.data;
    if (!data.title || data.type === 'no-title') return null;

    const articleLength = data.extract ? data.extract.length : 100;
    let rarity = 'Common';
    let value = Math.floor(Math.random() * 30) + 40; 
    if (articleLength > 500) { rarity = 'Legendary'; value = Math.floor(Math.random() * 200) + 400; } 
    else if (articleLength > 350) { rarity = 'Epic'; value = Math.floor(Math.random() * 100) + 200; } 
    else if (articleLength > 200) { rarity = 'Rare'; value = Math.floor(Math.random() * 50) + 100; }

    return {
      title: data.title,
      description: data.extract || 'A mysterious entry in the annals of history...',
      url: data.content_urls ? data.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      imageUrl: data.thumbnail ? data.thumbnail.source : null,
      rarity, value
    };
  } catch (error) { return null; } // Fails gracefully if the wiki page doesn't exist
}

async function getWikiPack(size = 10, packType = 'Standard') {
  const results = [];
  for (let i = 0; i < size; i++) {
    let page = await getRandomWikiPage();
    if (!page) continue;

    // Apply special pack logic
    if (packType === 'Graded' && page.rarity === 'Common') {
      page.rarity = 'Rare';
      page.value = Math.floor(Math.random() * 50) + 100;
    } else if (packType === 'Fixed' && i === 0) {
      // Force the very first card drawn to be Legendary
      page.rarity = 'Legendary';
      page.value = Math.floor(Math.random() * 200) + 400;
    }

    results.push(page);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Shuffle the Fixed pack so the legendary isn't always the first page you see
  if (packType === 'Fixed') results.sort(() => Math.random() - 0.5);
  
  return results;
}

module.exports = { getRandomWikiPage, getWikiPack, getSpecificWikiPage };