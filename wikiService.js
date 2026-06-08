const axios = require('axios');

async function getRandomWikiPage() {
  try {
    const response = await axios.get('https://en.wikipedia.org/api/rest_v1/page/random/summary');
    const data = response.data;

    // Skip meta pages or talk pages if they slip through
    if (!data.title || data.type === 'no-title') return null;

    const articleLength = data.extract ? data.extract.length : 100;
    let rarity = 'Common';
    let value = Math.floor(Math.random() * 30) + 40; // Base 40-70 WikiCoins

    if (articleLength > 500) {
      rarity = 'Legendary';
      value = Math.floor(Math.random() * 200) + 400;
    } else if (articleLength > 350) {
      rarity = 'Epic';
      value = Math.floor(Math.random() * 100) + 200;
    } else if (articleLength > 200) {
      rarity = 'Rare';
      value = Math.floor(Math.random() * 50) + 100;
    }

    return {
      title: data.title,
      description: data.extract || 'A mysterious entry in the annals of history...',
      url: data.content_urls.desktop.page,
      imageUrl: data.thumbnail ? data.thumbnail.source : null,
      rarity,
      value
    };
  } catch (error) {
    console.error('Error fetching Wikipedia entry:', error);
    return null;
  }
}

module.exports = { getRandomWikiPage };