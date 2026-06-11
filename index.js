require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, REST, Routes, ApplicationCommandOptionType, Events, MessageFlags, ActivityType } = require('discord.js');
const db = require('./database');
const config = require('./config');
const { getWikiPack, getSpecificWikiPage, getBaseValue } = require('./wikiService'); 

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  { 
    name: 'trade', description: 'Trade cards and Lexicons with another player in this server.',
    options: [
      { name: 'user', description: 'The user you want to trade with', type: ApplicationCommandOptionType.User, required: true },
      { name: 'give_card', description: 'Card you are offering', type: ApplicationCommandOptionType.String, required: false },
      { name: 'give_lexicons', description: 'Lexicons you are offering', type: ApplicationCommandOptionType.Integer, required: false },
      { name: 'request_card', description: 'Card you are requesting', type: ApplicationCommandOptionType.String, required: false },
      { name: 'request_lexicons', description: 'Lexicons you are requesting', type: ApplicationCommandOptionType.Integer, required: false }
    ]
  },
  {
    name: 'give', description: 'Give Lexicons directly to another player.',
    options: [
      { name: 'user', description: 'User to give Lexicons to', type: ApplicationCommandOptionType.User, required: true },
      { name: 'amount', description: 'Amount of Lexicons', type: ApplicationCommandOptionType.Integer, required: true, min_value: 1 }
    ]
  },
  { name: 'melt', description: 'Melt a card to extract Alexandrite.', options: [{ name: 'card', description: 'Title of the card', type: ApplicationCommandOptionType.String, required: true }] },
  { name: 'forge', description: 'Upgrade a maxed-tier card to the next Condition tier using Alexandrite.', options: [{ name: 'card', description: 'Title of the card', type: ApplicationCommandOptionType.String, required: true }] },
  { name: 'shop', description: 'Visit the WikiDex Exchange!', options: [
      { name: 'alchemy', description: 'Buy temporary boosts and buffs', type: ApplicationCommandOptionType.Subcommand },
      { name: 'merge', description: 'Trade standard packs for premium ones', type: ApplicationCommandOptionType.Subcommand },
      { name: 'sell', description: 'Sell unopened packs for Lexicons', type: ApplicationCommandOptionType.Subcommand }
  ]},
  { name: 'encyclopedia', description: 'Unlock Badges for unique passive abilities!', options: [
      { name: 'view', description: 'View your Encyclopedias', type: ApplicationCommandOptionType.Subcommand },
      { name: 'buy', description: 'Upgrade an Encyclopedia level', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'badge', description: 'Which encyclopedia?', type: ApplicationCommandOptionType.String, required: true, choices: [{name: 'Knowledge', value: '0'}, {name: 'World', value: '1'}, {name: 'Economy', value: '2'}, {name: 'Science', value: '3'}]}]}
  ]},
  { name: 'tower', description: 'Manage your Tower of Babel to gain permanent buffs!', options: [
      { name: 'view', description: 'View your tower floors and active buffs', type: ApplicationCommandOptionType.Subcommand },
      { name: 'build', description: 'Build a specific floor of your tower', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'floor', description: 'Floor number (1-10)', type: ApplicationCommandOptionType.Integer, required: true, min_value: 1, max_value: 10 }] },
      { name: 'destroy', description: 'Destroy your tower to refund all Lexicons spent', type: ApplicationCommandOptionType.Subcommand }
  ]},
  { name: 'inventory', description: 'View your multi-page profile, stats, and items.' },
  { name: 'open', description: 'Open a pack from your inventory!' },
  { name: 'balance', description: 'Check your current Lexicon balance.' },
  { 
    name: 'library', description: 'Browse your personal Wiki Collection.',
    options: [{ name: 'mode', description: 'How to view your library', type: ApplicationCommandOptionType.String, required: false, choices: [{name: 'List', value: 'list'}, {name: 'View', value: 'view'}] }]
  },
  { name: 'daily', description: 'Claim your daily allowance of Lexicons and a free random pack.' },
  { 
    name: 'top', description: 'View the server leaderboards.',
    options: [
        { name: 'balance', description: 'Richest players by Lexicons', type: ApplicationCommandOptionType.Subcommand },
        { name: 'library', description: 'Most valuable card libraries', type: ApplicationCommandOptionType.Subcommand }
    ]
  },
  { 
    name: 'wish', description: 'Manage your wishlist.',
    options: [
      { name: 'add', description: 'Add a card to your wishlist', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] },
      { name: 'remove', description: 'Remove a card from your wishlist', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] },
      { name: 'list', description: 'View your wishlist', type: ApplicationCommandOptionType.Subcommand },
      { name: 'enhance', description: 'Turn a normal wish into a Star wish (consumes wish slots dynamically)', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] },
      { name: 'unenhance', description: 'Remove Enhanced status from a wish, returning the slots', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] }
    ]
  },
  { name: 'divorce', description: 'Release a claimed card back into the wild for Lexicons.', options: [{ name: 'card', description: 'Title of the card', type: ApplicationCommandOptionType.String, required: true }] },
  { name: 'view', description: 'Look up any Wikipedia article.', options: [{ name: 'card', description: 'Title of the article', type: ApplicationCommandOptionType.String, required: true }] },
  {
    name: 'admin', description: 'Developer Tools', default_member_permissions: '8',
    options: [
      { 
        name: 'givepack', description: 'Give packs to a user', type: ApplicationCommandOptionType.Subcommand, 
        options: [
          { name: 'user', description: 'User', type: ApplicationCommandOptionType.User, required: true }, 
          { name: 'type', description: 'Type', type: ApplicationCommandOptionType.String, required: true, choices: [
              {name: 'Standard', value: 'Standard'}, {name: 'Graded', value: 'Graded'}, {name: 'Fixed', value: 'Fixed'},
              {name: 'Mega', value: 'Mega'}, {name: 'Mega Graded', value: 'Mega Graded'}, {name: 'Mega Fixed', value: 'Mega Fixed'},
              {name: 'Duo', value: 'Duo'}, {name: 'Energy', value: 'Energy'}, {name: 'Discount', value: 'Discount'},
              {name: 'Wish', value: 'Wish'}, {name: 'Scrap', value: 'Scrap'}
          ] },
          { name: 'amount', description: 'Number of packs to give', type: ApplicationCommandOptionType.Integer, required: false, min_value: 1 }
        ] 
      },
      { name: 'addmoney', description: 'Give lexicons to a user', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'user', description: 'User', type: ApplicationCommandOptionType.User, required: true }, { name: 'amount', description: 'Amount', type: ApplicationCommandOptionType.Integer, required: true }] },
      { name: 'addalexandrite', description: 'Give Alexandrite to a user', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'user', description: 'User', type: ApplicationCommandOptionType.User, required: true }, { name: 'amount', description: 'Amount', type: ApplicationCommandOptionType.Integer, required: true }] }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => { await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands }); })();

client.once(Events.ClientReady, () => {
  console.log(`⚡ WikiDex is online! Logged in as ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'Initializing Archives...' }], status: 'idle' });
  setTimeout(() => { 
      client.user.setPresence({ 
          activities: [{ name: "Exploring Wikipedia, the internet's best encyclopedia...", type: ActivityType.Custom, state: "Exploring Wikipedia, the internet's best encyclopedia..." }], 
          status: 'online' 
      }); 
  }, 5000);
});

function processHourlyStats(guildId, userId) {
  const user = db.getUser(guildId, userId);
  const buffs = config.getPlayerBuffs(user.towerData, user.badges);
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  
  const elapsedPacks = now - user.lastPackUpdate;
  if (elapsedPacks >= hourMs) {
    const packsToGive = Math.floor(elapsedPacks / hourMs);
    const maxPacksCap = config.MAX_PACKS + buffs.maxPacksBoost;
    const maxToAdd = Math.max(0, maxPacksCap - db.getPacks(guildId, userId).length);
    
    let pWeights = [...config.PACK_WEIGHTS];
    if (buffs.packBoost > 0) {
      pWeights[1] = { ...pWeights[1], weight: pWeights[1].weight + (2 * buffs.packBoost) }; 
      pWeights[2] = { ...pWeights[2], weight: pWeights[2].weight + (1 * buffs.packBoost) }; 
    }

    for(let i=0; i < Math.min(packsToGive, maxToAdd); i++) {
        let pType = config.getWeightedRandom(pWeights).type;
        if (buffs.megaPackUnlocked && Math.random() < 1/500) pType = 'Mega';
        else if (buffs.duoPackUnlocked && Math.random() < 1/5000) pType = 'Duo';
        db.addPack(guildId, userId, pType);
    }
    
    if (buffs.energyPackChance > 0 && Math.random() < buffs.energyPackChance) {
        if (db.getPacks(guildId, userId).length < maxPacksCap) db.addPack(guildId, userId, 'Energy');
    }

    db.setLastPackUpdate(guildId, userId, user.lastPackUpdate + (packsToGive * hourMs));
  }

  const regenTime = hourMs * Math.max(0.1, (1 - buffs.regenReduction));
  const elapsedEnergy = now - user.lastEnergyUpdate;
  if (elapsedEnergy >= regenTime) {
    const energyToGive = Math.floor(elapsedEnergy / regenTime);
    const maxEnergyCap = config.MAX_ENERGY + buffs.maxEnergy; 
    const maxEToAdd = Math.max(0, maxEnergyCap - user.energy);
    
    if (Math.min(energyToGive, maxEToAdd) > 0) db.addEnergy(guildId, userId, Math.min(energyToGive, maxEToAdd));
    db.setLastEnergyUpdate(guildId, userId, user.lastEnergyUpdate + (energyToGive * regenTime));
  }
}

async function processPackSession(interaction, allPages, packType, user, buffs) {
  const gId = interaction.guildId;
  let wishPings = new Set();
  const maxClaims = packType === 'Duo' ? 2 : 1;
  let claimsMade = 0;
  let claimedIndices = new Set(); 
  let scrapedLexicons = new Set(); 
  const uData = db.getUser(gId, user.id);
  const hasLexBuff = Date.now() < uData.buffLexiconEnd;

  const pageData = allPages.map(page => {
    let claimedBy = null; let lexDrop = null; let claimedByName = null;
    if (page.isLexiconCard) { lexDrop = page.lexiconDrop; } 
    else {
      const claimObj = db.isClaimed(gId, page.title);
      if (claimObj) { 
        claimedBy = claimObj.userId; 
        claimedByName = claimObj.userId === user.id ? user.username : 'Another Player'; 
        
        let baseLex = config.getWeightedRandom(config.LEXICON_ENERGY); 
        lexDrop = config.processLexiconModifiers(baseLex, buffs, hasLexBuff);
        
        page.quality = claimObj.quality != null ? claimObj.quality : Math.random();
        page.value = claimObj.value != null ? claimObj.value : getBaseValue(page.rarity || 'Common'); 
      }
      db.checkWishedBy(gId, page.title).forEach(w => wishPings.add(w.userId));
    }
    return { ...page, claimedBy, claimedByName, lexiconDrop: lexDrop };
  });

  let pingStr = wishPings.size > 0 ? Array.from(wishPings).map(id => `<@${id}>`).join(', ') + ' 🌠 A Wished card appeared!\n' : '';
  let currentIndex = 0; 
  let timeExpired = false;

  const generateUI = (index, isFinalState = false, timeLeftStr = '60s', warning = '') => {
    const page = pageData[index];
    const userStats = db.getUser(gId, user.id);
    const maxE = config.MAX_ENERGY + buffs.maxEnergy;
    const isScraped = scrapedLexicons.has(index);
    const isClaimedInSession = claimedIndices.has(index);
    const packLocked = isFinalState || claimsMade >= maxClaims;
    
    let statsDesc = `**Rarity:** ${page.rarity} ${page.views ? `*(Views: ${page.views.toLocaleString()})*` : ''}\n**Value:** ${page.value} ${config.BASIC_LEXICON_EMOJI} ${!page.quality && !page.isLexiconCard ? '*(Base)*' : ''}\n**Condition:** ${page.quality ? `${config.getConditionString(page.quality)} (${page.quality.toFixed(9)})` : '??? *(Determined on Claim)*'}\n`;
    if (page.claimedBy) statsDesc += `**Owned By:** ${page.claimedByName || 'You'}\n`;
    statsDesc += `\n`;
    if (page.isWishSpawn) statsDesc = `🌠 **WISH SPAWN!**\n` + statsDesc;

    let footerTime = `${timeLeftStr}`;
    if (claimsMade >= maxClaims) footerTime = 'Claimed';
    else if (isFinalState) footerTime = 'Expired';

    const embed = new EmbedBuilder()
      .setTitle(page.title)
      .setDescription(statsDesc + (page.description.length > 700 ? page.description.substring(0, 695) + '...' : page.description))
      .setColor(config.COLORS[page.rarity] || config.COLORS['Common'])
      .setFooter({ text: `Card ${index + 1} of ${pageData.length} • ${packType} Pack • ⚡ ${userStats.energy}/${maxE} • Claims: ${claimsMade}/${maxClaims} • Time: ${footerTime}${warning}` });

    if (page.url) embed.setURL(page.url);
    if (page.imageUrl) embed.setImage(page.imageUrl);

    if (packLocked || isFinalState) {
        return { content: `${pingStr}Pack finished!`, embeds: [embed], components: [] };
    }

    let actionBtns = [];
    if (page.isLexiconCard) {
      const isIndigo = page.lexiconDrop.name.includes('Indigo');
      const energyCost = isIndigo ? 0 : 1;
      actionBtns.push(new ButtonBuilder().setCustomId('claim_lexicon_card').setLabel(isScraped ? 'Absorbed' : `Absorb (Cost: ${energyCost} ⚡)`).setEmoji(page.lexiconDrop.emoji).setStyle(ButtonStyle.Success).setDisabled((userStats.energy < energyCost && !isScraped) || isScraped));
    } else if (page.claimedBy === user.id) {
      actionBtns.push(new ButtonBuilder().setCustomId('claim_lexicon').setLabel(isScraped ? 'Scraped' : 'Scrap (Cost: 1 ⚡)').setEmoji(page.lexiconDrop.emoji).setStyle(ButtonStyle.Secondary).setDisabled(isScraped || isClaimedInSession || userStats.energy < 1));
      actionBtns.push(new ButtonBuilder().setCustomId('upgrade_quality').setLabel(isClaimedInSession ? 'Upgraded' : 'Upgrade (1 Claim)').setStyle(ButtonStyle.Primary).setDisabled(isClaimedInSession || config.getConditionString(page.quality) === 'Perfect'));
    } else if (page.claimedBy) {
      actionBtns.push(new ButtonBuilder().setCustomId('claim_lexicon').setLabel(isScraped ? 'Scraped' : 'Scrap (Cost: 1 ⚡)').setEmoji(page.lexiconDrop.emoji).setStyle(ButtonStyle.Secondary).setDisabled(isScraped || isClaimedInSession || userStats.energy < 1));
    } else {
      actionBtns.push(new ButtonBuilder().setCustomId('claim_page').setLabel(isClaimedInSession ? 'Claimed' : 'Claim (1 Claim)').setStyle(ButtonStyle.Success).setDisabled(isClaimedInSession));
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary),
      ...actionBtns
    );

    return { content: `${pingStr}You opened a **${packType}** pack! Pick **${maxClaims}** card(s) below!`, embeds: [embed], components: [row] };
  };

  let timeLeft = 60;
  const timerInterval = setInterval(async () => {
    if (timeExpired || claimsMade >= maxClaims) return clearInterval(timerInterval);
    timeLeft -= 15;
    if (timeLeft > 0) await interaction.editReply(generateUI(currentIndex, false, `${timeLeft}s`)).catch(()=>{});
  }, 15000);

  const response = await interaction.editReply(generateUI(currentIndex, false, '60s', ''));
  const collector = response.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async i => {
    if (i.user.id !== user.id && (i.customId === 'back' || i.customId === 'next')) return i.reply({ content: "Not your pack!", flags: MessageFlags.Ephemeral });

    if (i.customId === 'next' || i.customId === 'back') {
      currentIndex = i.customId === 'next' ? (currentIndex + 1) % pageData.length : (currentIndex - 1 + pageData.length) % pageData.length;
      await i.update(generateUI(currentIndex, false, `${timeLeft}s`));
    } 
    else if (i.customId === 'claim_page') {
      const page = pageData[currentIndex];
      if (db.isClaimed(gId, page.title)) return i.reply({ content: 'Sniped!', flags: MessageFlags.Ephemeral });

      let quality = config.generateConditionFloat(packType, page.isWishSpawn, buffs);
      const finalValue = Math.max(1, Math.floor(page.value * quality));
      db.claimPage(gId, user.id, page.title, page.url, page.imageUrl, page.description, page.rarity, finalValue, quality);
      
      page.quality = quality; page.value = finalValue; page.claimedBy = user.id; page.claimedByName = user.username; 
      page.lexiconDrop = config.getWeightedRandom(config.LEXICON_ENERGY);
      
      claimsMade++; claimedIndices.add(currentIndex);
      if (claimsMade >= maxClaims) clearInterval(timerInterval);
      
      await i.update(generateUI(currentIndex, claimsMade >= maxClaims, `${timeLeft}s`)); 
      
      let bonusMsg = ``;
      if (buffs.claimCashback) {
         db.addMoney(gId, user.id, finalValue);
         bonusMsg = `\n*(Economy Badge: Earned **${finalValue}** Lexicons!)*`;
      }
      
      await i.followUp(`🎉 **${user.username}** successfully claimed **${page.title}**! Condition: **${config.getConditionString(quality)}**!${bonusMsg}`);
      if (claimsMade >= maxClaims) collector.stop();
    } 
    else if (i.customId === 'upgrade_quality') {
      const page = pageData[currentIndex];
      const maxTierCap = config.getMaxQualityForTier(page.quality || 0.01);
      const newQ = db.upgradeCardQuality(gId, user.id, page.title, 1.15, maxTierCap);
      
      page.quality = newQ;
      claimsMade++; claimedIndices.add(currentIndex);
      if (claimsMade >= maxClaims) clearInterval(timerInterval);
      
      await i.update(generateUI(currentIndex, claimsMade >= maxClaims, `${timeLeft}s`));
      await i.followUp(`✨ **${user.username}** upgraded the condition of **${page.title}**! New Condition: **${config.getConditionString(newQ)}**!`);
      if (claimsMade >= maxClaims) collector.stop();
    }
    else if (i.customId === 'claim_lexicon_card' || i.customId === 'claim_lexicon') {
      const page = pageData[currentIndex]; const drop = page.lexiconDrop;
      let usedFreeEnergy = false;
      const u = db.getUser(gId, user.id);
      
      let energyCost = 1;
      if (i.customId === 'claim_lexicon_card' && drop.name.includes('Indigo')) energyCost = 0;
      
      if (energyCost > 0 && Math.random() < buffs.freeEnergyChance) {
          energyCost = 0; usedFreeEnergy = true;
      }
      if (u.energy < energyCost) return i.reply({ content: "Not enough energy!", flags: MessageFlags.Ephemeral });
      if (energyCost > 0) db.useEnergy(gId, user.id, energyCost); 

      let mult = drop.mult === 'random' ? (Math.random() * 19.9) + 0.1 : drop.mult;
      if (drop.name.includes('Black')) mult *= buffs.blackLexMult;

      let payout = Math.max(1, Math.floor(page.value * mult * buffs.lexiconPayoutMult));
      if (drop.doubleSpawn) payout *= 2; 

      db.addMoney(gId, user.id, payout); 
      scrapedLexicons.add(currentIndex); 
      
      await i.update(generateUI(currentIndex, false, `${timeLeft}s`));
      
      let msg = `⚡ **${user.username}** ${i.customId === 'claim_lexicon' ? 'scraped' : 'absorbed'} ${drop.emoji} **${drop.name} Energy** and earned **${payout} Lexicons**!`;
      if (usedFreeEnergy) msg += ` *(Tower Buff: 0 Energy used!)*`;
      if (drop.doubleSpawn) msg += ` *(Shop Buff: Double payout triggered!)*`;
      if (drop.crackedBonus) {
          const extraLex = config.getWeightedRandom(config.LEXICON_ENERGY);
          let extraMult = extraLex.mult === 'random' ? (Math.random() * 19.9) + 0.1 : extraLex.mult;
          const extraPayout = Math.max(1, Math.floor(page.value * extraMult));
          db.addMoney(gId, user.id, extraPayout);
          msg += `\n🎁 *(Shop Buff: Free random ${extraLex.emoji} **${extraLex.name} Lexicon** found inside! +${extraPayout})*`;
      }
      await i.followUp({ content: msg, flags: MessageFlags.Ephemeral });
    }
  });

  collector.on('end', async (collected, reason) => {
    clearInterval(timerInterval);
    timeExpired = true;
    if (claimsMade < maxClaims) await interaction.editReply(generateUI(currentIndex, true, 'Expired')).catch(()=>null);
  });
}

function generateShopUI(guildId, userId, shopType, selectedVal = null) {
    const packs = db.getPacks(guildId, userId);
    const standardCount = packs.filter(p => p.packType === 'Standard').length;
    
    let embed = new EmbedBuilder().setColor('#2b2d31');
    let selectRow1 = null; let selectRow2 = null; let actionRow = null;

    if (shopType === 'alchemy') {
        const u = db.getUser(guildId, userId);
        const now = Date.now();
        const dActive = u.buffDailyEnd > now ? `<t:${Math.floor(u.buffDailyEnd/1000)}:R>` : 'None';
        const lActive = u.buffLexiconEnd > now ? `<t:${Math.floor(u.buffLexiconEnd/1000)}:R>` : 'None';
        
        embed.setTitle('🧪 The Alchemy Shop')
             .setDescription(`Our stock today is quite exquisite...\n\n**Brew of the Chronicler:** Enhances your daily pulls, multiplying Lexicons and guaranteeing premium packs.\n\n**Elixir of Resonance:** Mutates Lexicon Energy cards during pack openings, bumping their tier and unlocking double payouts.\n\n*Active Daily Brew:* ${dActive}\n*Active Lexicon Enhancer:* ${lActive}`);
        
        const catOptions = [
            { label: 'Brew of the Chronicler', value: 'buffcat_daily', description: 'Daily pack boost and Lexicon multiplier', emoji: '☕' },
            { label: 'Elixir of Resonance', value: 'buffcat_lex', description: 'Mutate Lexicon energy drops for big payouts', emoji: '🧪' }
        ];
        selectRow1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`shop_select_${shopType}`).setPlaceholder('Select a Potion Type...').addOptions(catOptions));

        let activeCat = null; let activeBuff = null;

        if (selectedVal) {
            if (selectedVal.startsWith('buffcat_')) { activeCat = selectedVal.replace('buffcat_', ''); } 
            else if (selectedVal.startsWith('buff_')) {
                activeBuff = selectedVal.replace('buff_', '');
                activeCat = config.SHOP_BUFFS[activeBuff].category;
            }
        }

        if (activeCat) {
            const buffKeys = Object.keys(config.SHOP_BUFFS).filter(k => config.SHOP_BUFFS[k].category === activeCat);
            const subOpts = buffKeys.map(k => ({ label: config.SHOP_BUFFS[k].label, value: `buff_${k}`, description: `Cost: ${config.SHOP_BUFFS[k].cost} Lexicons` }));
            selectRow2 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`shop_select_${shopType}_sub`).setPlaceholder('Select Duration/Potency...').addOptions(subOpts));
        }

        if (activeBuff) {
            const b = config.SHOP_BUFFS[activeBuff];
            embed.setFooter({ text: `Selected: ${b.name} for ${b.cost} Lexicons` });
            actionRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`shop_buy_${shopType}_${activeBuff}`).setLabel(`Purchase (${b.cost} Lexicons)`).setStyle(ButtonStyle.Success));
        }
    } 
    else if (shopType === 'merge') {
        embed.setTitle('♻️ Merging Center')
             .setDescription(`We can combine your bulk Standard Packs into high-quality goods.\n\n**Premium Packs:** Trade 5 standard for Graded or Fixed.\n\n**Specialty Packs:** Trade for Mega, Discount, or Energy packs.\n\n*You have **${standardCount}** Standard Packs available.*`);
        
        const recipes = [
            { label: 'Merge to Graded Pack', value: 'merge_Graded', description: 'Cost: 5 Standard Packs' },
            { label: 'Merge to Fixed Pack', value: 'merge_Fixed', description: 'Cost: 5 Standard Packs' },
            { label: 'Merge to Mega Pack', value: 'merge_Mega', description: 'Cost: 8 Standard Packs' },
            { label: 'Merge to Discount Pack', value: 'merge_Discount', description: 'Cost: 2 Standard Packs' },
            { label: 'Merge to 2x Energy Packs', value: 'merge_Energy', description: 'Cost: 3 Standard Packs' }
        ];
        
        selectRow1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`shop_select_${shopType}`).setPlaceholder('Select a Recipe...').addOptions(recipes));

        if (selectedVal && selectedVal.startsWith('merge_')) {
            const reqMap = { 'merge_Graded': 5, 'merge_Fixed': 5, 'merge_Mega': 8, 'merge_Discount': 2, 'merge_Energy': 3 };
            const cost = reqMap[selectedVal.replace('merge_', '')];
            actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`shop_buy_${shopType}_${selectedVal}`).setLabel(`Confirm Merge (${cost} Packs)`).setStyle(ButtonStyle.Success).setDisabled(standardCount < cost)
            );
        }
    } 
    else if (shopType === 'sell') {
        embed.setTitle('🏷️ The Exchange')
             .setDescription(`Got packs you don't want to open? We pay cold hard Lexicons for sealed goods.\n\nSelect a pack from your inventory below to offload it for quick cash.`);
        
        const uniquePacks = [...new Set(packs.map(p => p.packType))];
        const sellOptions = uniquePacks.map(pType => ({ label: `Sell 1x ${pType} Pack`, value: `sell_${pType}`, description: `Yields ${config.PACK_SELL_PRICES[pType] || 0} Lexicons` }));
        
        if (sellOptions.length > 0) {
            selectRow1 = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`shop_select_${shopType}`).setPlaceholder('Select a pack to sell...').addOptions(sellOptions));
        } else {
            embed.setDescription(embed.data.description + "\n\n**You have no packs to sell!**");
        }

        if (selectedVal && selectedVal.startsWith('sell_') && uniquePacks.includes(selectedVal.replace('sell_', ''))) {
            const pType = selectedVal.replace('sell_', '');
            const price = config.PACK_SELL_PRICES[pType] || 0;
            actionRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`shop_buy_${shopType}_${selectedVal}`).setLabel(`Confirm Sell (+${price} Lexicons)`).setStyle(ButtonStyle.Success));
        }
    }

    const components = [];
    if (selectRow1) components.push(selectRow1);
    if (selectRow2) components.push(selectRow2);
    if (actionRow) components.push(actionRow);

    return { embeds: [embed], components: components };
}

function generateInventoryUI(guildId, userId, pageNum) {
    const uData = db.getUser(guildId, userId);
    const buffs = config.getPlayerBuffs(uData.towerData, uData.badges);
    
    const packs = db.getPacks(guildId, userId);
    const wishes = db.getWishes(guildId, userId);
    const stdWishes = wishes.filter(w => w.isEnhanced === 0).length;
    const enhancedWishes = wishes.filter(w => w.isEnhanced > 0);
    
    let slotsUsed = stdWishes;
    enhancedWishes.forEach(w => { slotsUsed += w.isEnhanced; });

    const maxE = config.MAX_ENERGY + buffs.maxEnergy;
    const maxW = uData.wishCapacity + buffs.wishSlots;

    let embed = new EmbedBuilder().setColor('#a335ee').setThumbnail(`https://cdn.discordapp.com/embed/avatars/0.png`); 

    if (pageNum === 1) {
        const regenTime = 3600000 * Math.max(0.1, (1 - buffs.regenReduction));
        const nextPackTime = Math.floor((uData.lastPackUpdate + 3600000) / 1000);
        const nextEnergyTime = Math.floor((uData.lastEnergyUpdate + regenTime) / 1000);

        const counts = {}; packs.forEach(p => { counts[p.packType] = (counts[p.packType] || 0) + 1; });
        const packList = Object.entries(counts).map(([type, count]) => `**${count}x** ${type} Pack`).join('\n') || '*No packs available.*';

        embed.setTitle(`🎒 Inventory Overview`)
          .addFields(
            { name: '💰 Currency', value: `**${uData.balance}** ${config.BASIC_LEXICON_EMOJI}\n**${uData.alexandrite}** ${config.ALEXANDRITE_EMOJI}`, inline: true },
            { name: '⚡ Energy', value: `**${uData.energy}** / ${maxE}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }, 
            { name: '📦 Packs', value: packList, inline: true },
            { name: '🌠 Wishes', value: `Slots Used: **${slotsUsed}/${maxW}**\nEnhanced: **${enhancedWishes.length} Active**`, inline: true },
            { name: '⏱️ Background Timers', value: `**Next Pack Drop:** <t:${nextPackTime}:R>\n**Next Energy Regen:** <t:${nextEnergyTime}:R>`, inline: false }
          );
    } 
    else if (pageNum === 2) {
        const bData = JSON.parse(uData.badges || '[0,0,0,0]');
        const encStr = `📘 Knowledge: **Lv${bData[0]}/4**\n🌍 World: **Lv${bData[1]}/4**\n⚖️ Economy: **Lv${bData[2]}/4**\n🔬 Science: **Lv${bData[3]}/4**`;

        let activeBuffs = [];
        if (buffs.maxEnergy > 0) activeBuffs.push(`• Max Energy: **+${buffs.maxEnergy}**`);
        if (buffs.freeEnergyChance > 0) activeBuffs.push(`• Free Scrap Chance: **${Math.round(buffs.freeEnergyChance * 100)}%**`);
        if (buffs.wishSlots > 0) activeBuffs.push(`• Extra Wish Slots: **+${buffs.wishSlots}**`);
        if (buffs.packBoost > 0) activeBuffs.push(`• Pack Drop Boost: **+${buffs.packBoost}**`);
        if (buffs.regenReduction > 0) activeBuffs.push(`• Energy Regen Reduction: **-${Math.round(buffs.regenReduction * 100)}%**`);
        if (buffs.wishMult > 1) activeBuffs.push(`• Base Wish Chance: **x${buffs.wishMult.toFixed(2)}**`);
        if (buffs.enhancedWishMult > 1) activeBuffs.push(`• Enhanced Wish Chance: **x${buffs.enhancedWishMult.toFixed(2)}**`);
        if (buffs.lexiconPayoutMult > 1) activeBuffs.push(`• Lexicon Payout: **x${buffs.lexiconPayoutMult.toFixed(2)}**`);
        if (buffs.blackLexMult > 1) activeBuffs.push(`• Black Lexicon Value: **x${buffs.blackLexMult.toFixed(2)}**`);
        if (buffs.maxPacksBoost > 0) activeBuffs.push(`• Max Pack Capacity: **+${buffs.maxPacksBoost}**`);
        if (buffs.energyPackChance > 0) activeBuffs.push(`• Hourly Energy Pack: **${Math.round(buffs.energyPackChance * 100)}%**`);
        if (buffs.claimCashback) activeBuffs.push(`• Claim Cashback: **Active**`);
        if (buffs.wishNoDamage) activeBuffs.push(`• Wish Damage Immunity: **Active**`);
        if (buffs.worldBadgeLvl >= 1) activeBuffs.push(`• Cracked Lexicon Buff: **0.75x**`);
        if (buffs.worldBadgeLvl >= 4) activeBuffs.push(`• White Lexicons ➡️ Green: **Active**`);

        const now = Date.now();
        if (uData.buffDailyEnd > now) activeBuffs.push(`• Temp Daily Boost: **x${uData.buffDailyMult} Lexicons & Non-Std Pack** (<t:${Math.floor(uData.buffDailyEnd/1000)}:R>)`);
        if (uData.buffLexiconEnd > now) activeBuffs.push(`• Temp Lexicon Enhance: **Active** (<t:${Math.floor(uData.buffLexiconEnd/1000)}:R>)`);

        embed.setTitle(`🏅 Badges & Buffs`)
          .addFields(
            { name: '🎓 Encyclopedias', value: encStr, inline: true },
            { name: '🛠️ Active Buffs', value: activeBuffs.length > 0 ? activeBuffs.join('\n') : '*None active.*', inline: false }
          );
    }
    else if (pageNum === 3) {
        embed.setTitle(`📊 Global Statistics`)
          .addFields(
            { name: '📦 Total Packs Opened', value: `**${uData.statsPacksOpened}**`, inline: true },
            { name: '💸 Lexicons Spent', value: `**${uData.statsLexiconsSpent}**`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🃏 Cards Claimed', value: `**${uData.statsCardsClaimed}**`, inline: true },
            { name: '🔥 Cards Melted', value: `**${uData.statsCardsMelted}**`, inline: true },
            { name: '🏰 Tower Floors Built', value: `**${uData.towerFloors}**`, inline: true }
          );
    }

    embed.setFooter({ text: `Page ${pageNum} of 3` });
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`inv_prev_${userId}_${pageNum}`).setLabel('Back').setStyle(ButtonStyle.Primary).setDisabled(pageNum === 1),
      new ButtonBuilder().setCustomId(`inv_next_${userId}_${pageNum}`).setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(pageNum === 3)
    );

    return { embeds: [embed], components: [row] };
}

client.on('interactionCreate', async interaction => {
  if (!interaction.guildId) return interaction.reply({ content: 'Commands must be run in a server!', flags: MessageFlags.Ephemeral });
  const gId = interaction.guildId;

  if (interaction.isButton() && interaction.customId.startsWith('inv_')) {
      const parts = interaction.customId.split('_');
      const action = parts[1]; 
      const userId = parts[2];
      let currentPage = parseInt(parts[3]);
      
      if (interaction.user.id !== userId) return interaction.reply({ content: "Not your inventory!", flags: MessageFlags.Ephemeral });
      
      currentPage = action === 'next' ? currentPage + 1 : currentPage - 1;
      const uiData = generateInventoryUI(gId, userId, currentPage);
      uiData.embeds[0].setThumbnail(interaction.user.displayAvatarURL());
      await interaction.update(uiData);
      return;
  }
    
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('shop_select_')) {
      const parts = interaction.customId.replace('shop_select_', '').split('_');
      const shopType = parts[0]; 
      const selectedVal = interaction.values[0];
      await interaction.update(generateShopUI(gId, interaction.user.id, shopType, selectedVal));
      return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('shop_buy_')) {
      const parts = interaction.customId.split('_');
      const shopType = parts[2]; 
      const itemKey = parts.slice(3).join('_'); 
      const uData = db.getUser(gId, interaction.user.id);
      
      if (itemKey.startsWith('merge_')) {
          const pType = itemKey.replace('merge_', '');
          const reqMap = { 'Graded': 5, 'Fixed': 5, 'Mega': 8, 'Discount': 2, 'Energy': 3 };
          const cost = reqMap[pType];
          
          const success = db.removePacksByTypeAmount(gId, interaction.user.id, 'Standard', cost);
          if (!success) return interaction.reply({ content: "You do not have enough Standard Packs!", flags: MessageFlags.Ephemeral });
          
          if (pType === 'Energy') {
              db.addPack(gId, interaction.user.id, 'Energy'); db.addPack(gId, interaction.user.id, 'Energy');
          } else {
              db.addPack(gId, interaction.user.id, pType);
          }
          await interaction.update(generateShopUI(gId, interaction.user.id, shopType, null));
          return interaction.followUp({ content: `✅ Merged ${cost} Standard Packs into ${pType === 'Energy' ? '2x Energy Packs' : `1x ${pType} Pack`}!`, flags: MessageFlags.Ephemeral });
      } 
      else if (itemKey.startsWith('sell_')) {
          const pType = itemKey.replace('sell_', '');
          const price = config.PACK_SELL_PRICES[pType] || 0;
          db.removePackByType(gId, interaction.user.id, pType);
          db.addMoney(gId, interaction.user.id, price);
          await interaction.update(generateShopUI(gId, interaction.user.id, shopType, null));
          return interaction.followUp({ content: `🏷️ Sold 1x ${pType} Pack for **${price} Lexicons**!`, flags: MessageFlags.Ephemeral });
      } 
      else {
          const bData = config.SHOP_BUFFS[itemKey]; 
          if (uData.balance < bData.cost) return interaction.reply({ content: `You need **${bData.cost} Lexicons**!`, flags: MessageFlags.Ephemeral });
          
          db.removeMoney(gId, interaction.user.id, bData.cost);
          const newEnd = Date.now() + bData.ms;

          if (itemKey.startsWith('daily')) {
              db.setDailyBuff(gId, interaction.user.id, newEnd, bData.mult);
          } else if (itemKey.startsWith('lex')) {
              db.setLexiconBuff(gId, interaction.user.id, newEnd);
          }
          await interaction.update(generateShopUI(gId, interaction.user.id, shopType, null));
          return interaction.followUp({ content: `🧪 Successfully purchased the **${bData.name}**!`, flags: MessageFlags.Ephemeral });
      }
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName, user, options } = interaction;
  db.getUser(gId, user.id); processHourlyStats(gId, user.id); 

  if (commandName === 'trade') {
    const targetUser = options.getUser('user');
    const giveCard = options.getString('give_card');
    const reqCard = options.getString('request_card');
    const giveLex = options.getInteger('give_lexicons') || 0;
    const reqLex = options.getInteger('request_lexicons') || 0;

    if (targetUser.bot || targetUser.id === user.id) return interaction.reply({ content: "Invalid trade target.", flags: MessageFlags.Ephemeral });
    if (!giveCard && !reqCard && giveLex === 0 && reqLex === 0) return interaction.reply({ content: "You must offer or request something!", flags: MessageFlags.Ephemeral });

    const initiator = db.getUser(gId, user.id);
    const target = db.getUser(gId, targetUser.id);

    if (giveLex > initiator.balance) return interaction.reply({ content: `You don't have ${giveLex} Lexicons!`, flags: MessageFlags.Ephemeral });
    if (reqLex > target.balance) return interaction.reply({ content: `<@${targetUser.id}> does not have ${reqLex} Lexicons!`, flags: MessageFlags.Ephemeral });
    
    let gCardObj = null; let rCardObj = null;
    if (giveCard) {
      gCardObj = db.isClaimed(gId, giveCard);
      if (!gCardObj || gCardObj.userId !== user.id) return interaction.reply({ content: `You do not own **${giveCard}**!`, flags: MessageFlags.Ephemeral });
    }
    if (reqCard) {
      rCardObj = db.isClaimed(gId, reqCard);
      if (!rCardObj || rCardObj.userId !== targetUser.id) return interaction.reply({ content: `<@${targetUser.id}> does not own **${reqCard}**!`, flags: MessageFlags.Ephemeral });
    }

    const offerEmbed = new EmbedBuilder()
      .setTitle('🤝 Trade Request')
      .setDescription(`<@${user.id}> wants to trade with <@${targetUser.id}>!`)
      .addFields(
        { name: `${user.username} Offers:`, value: `${gCardObj ? `🃏 **${gCardObj.wikiTitle}**\n` : ''}${giveLex > 0 ? `🪙 **${giveLex}** Lexicons` : ''}` || 'Nothing', inline: true },
        { name: `${targetUser.username} Gives:`, value: `${rCardObj ? `🃏 **${rCardObj.wikiTitle}**\n` : ''}${reqLex > 0 ? `🪙 **${reqLex}** Lexicons` : ''}` || 'Nothing', inline: true }
      )
      .setColor('#ffff00');

    const acceptRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade_accept_${targetUser.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade_decline_${targetUser.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.reply({ content: `<@${targetUser.id}>, you have a trade offer!`, embeds: [offerEmbed], components: [acceptRow], fetchReply: true });
    
    try {
        const tInteraction = await response.awaitMessageComponent({ filter: i => i.user.id === targetUser.id, time: 30000 });
        if (tInteraction.customId.startsWith('trade_decline')) {
            return tInteraction.update({ content: 'Trade declined by target.', embeds: [], components: [] });
        }

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`trade_confirm_${user.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`trade_cancel_${user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`trade_counter_${user.id}`).setLabel('Counter').setStyle(ButtonStyle.Secondary)
        );

        offerEmbed.setColor('#0099ff').setDescription(`<@${targetUser.id}> accepted the terms. <@${user.id}>, finalize the trade?`);
        await tInteraction.update({ content: `<@${user.id}>`, embeds: [offerEmbed], components: [confirmRow] });

        const iInteraction = await response.awaitMessageComponent({ filter: i => i.user.id === user.id, time: 30000 });
        
        if (iInteraction.customId.startsWith('trade_cancel')) return iInteraction.update({ content: 'Trade cancelled by initiator.', embeds: [], components: [] });
        if (iInteraction.customId.startsWith('trade_counter')) return iInteraction.update({ content: 'Trade cancelled. Please run a new `/trade` command to propose a counter-offer.', embeds: [], components: [] });
        
        if (giveLex > db.getUser(gId, user.id).balance || reqLex > db.getUser(gId, targetUser.id).balance) return iInteraction.reply({ content: "Someone's balance changed! Trade canceled.", flags: MessageFlags.Ephemeral });
        if (gCardObj && db.isClaimed(gId, gCardObj.wikiTitle)?.userId !== user.id) return iInteraction.reply({ content: `You no longer own the card!`, flags: MessageFlags.Ephemeral });
        if (rCardObj && db.isClaimed(gId, rCardObj.wikiTitle)?.userId !== targetUser.id) return iInteraction.reply({ content: `They no longer own the requested card!`, flags: MessageFlags.Ephemeral });

        if (giveLex > 0) { db.removeMoney(gId, user.id, giveLex); db.addMoney(gId, targetUser.id, giveLex); }
        if (reqLex > 0) { db.removeMoney(gId, targetUser.id, reqLex); db.addMoney(gId, user.id, reqLex); }
        if (gCardObj) db.transferPage(gId, user.id, targetUser.id, gCardObj.wikiTitle);
        if (rCardObj) db.transferPage(gId, targetUser.id, user.id, rCardObj.wikiTitle);

        offerEmbed.setTitle('✅ Trade Successful!').setColor('#00ff00').setDescription('Items have been transferred securely.');
        await iInteraction.update({ content: null, embeds: [offerEmbed], components: [] });

    } catch (e) {
        interaction.editReply({ content: 'Trade expired (30s timeout).', embeds: [], components: [] }).catch(()=>{});
    }
  }

  if (commandName === 'give') {
      const targetUser = options.getUser('user');
      const amount = options.getInteger('amount');
      
      if (targetUser.bot || targetUser.id === user.id) return interaction.reply({ content: "Invalid target.", flags: MessageFlags.Ephemeral });
      
      const initiator = db.getUser(gId, user.id);
      if (amount > initiator.balance) return interaction.reply({ content: `You don't have ${amount} Lexicons!`, flags: MessageFlags.Ephemeral });
      
      db.getUser(gId, targetUser.id);
      db.removeMoney(gId, user.id, amount);
      db.addMoney(gId, targetUser.id, amount);
      
      return interaction.reply(`💸 <@${user.id}> gave **${amount} Lexicons** to <@${targetUser.id}>!`);
  }

  if (commandName === 'shop') {
      const sub = options.getSubcommand();
      return interaction.reply(generateShopUI(gId, user.id, sub, null));
  }

  if (commandName === 'melt') {
      const targetCard = options.getString('card');
      const claim = db.isClaimed(gId, targetCard);
      if (!claim || claim.userId !== user.id) return interaction.reply({ content: `You do not own **${targetCard}**!`, flags: MessageFlags.Ephemeral });
      
      let baseAlex = 1;
      if (claim.rarity === 'Artifact') baseAlex = 12;
      else if (claim.rarity === 'Legendary') baseAlex = 8;
      else if (claim.rarity === 'Epic') baseAlex = 5;
      else if (claim.rarity === 'Rare') baseAlex = 3;
      else if (claim.rarity === 'Uncommon') baseAlex = 2;
      
      let condMult = 0.5;
      const condStr = config.getConditionString(claim.quality);
      if (condStr === 'Perfect') condMult = 3;
      else if (condStr === 'Excellent') condMult = 2;
      else if (condStr === 'Good') condMult = 1.5;
      else if (condStr === 'Worn') condMult = 1;
      else if (condStr === 'Damaged') condMult = 0.8;
      
      const payout = Math.max(1, Math.floor(baseAlex * condMult));
      
      db.meltPage(gId, user.id, targetCard, payout);
      return interaction.reply(`🔥 You melted **${claim.wikiTitle}** down and extracted **${payout} ${config.ALEXANDRITE_EMOJI} Alexandrite**!`);
  }
  
  if (commandName === 'forge') {
      const targetCard = options.getString('card');
      const claim = db.isClaimed(gId, targetCard);
      if (!claim || claim.userId !== user.id) return interaction.reply({ content: `You do not own **${targetCard}**!`, flags: MessageFlags.Ephemeral });
      
      const currentCondStr = config.getConditionString(claim.quality || 0.01);
      if (currentCondStr === 'Perfect') return interaction.reply({ content: `**${claim.wikiTitle}** is already in Perfect condition!`, flags: MessageFlags.Ephemeral });
      
      const maxQualityForTier = config.getMaxQualityForTier(claim.quality || 0.01);
      if (claim.quality < maxQualityForTier) {
          return interaction.reply({ content: `**${claim.wikiTitle}** is not ready to be forged. You must use Lexicons during pulls to upgrade it to its max current condition limit first!`, flags: MessageFlags.Ephemeral });
      }

      const forgeData = config.FORGE_COSTS[currentCondStr];
      if (!forgeData) return interaction.reply({ content: `System Error: Missing Forge data.`, flags: MessageFlags.Ephemeral });
      
      const uData = db.getUser(gId, user.id);
      
      const embed = new EmbedBuilder()
        .setTitle('⚒️ The Forge')
        .setDescription(`Upgrade **${claim.wikiTitle}** to the next condition tier!\n\n**Current:** ${currentCondStr}\n**Upgrade To:** ${forgeData.nextTier}\n**Cost:** ${forgeData.cost} ${config.ALEXANDRITE_EMOJI}\n**Your Alexandrite:** ${uData.alexandrite} ${config.ALEXANDRITE_EMOJI}`)
        .setColor('#ff4500');
        
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`confirm_forge_${claim.wikiTitle}`).setLabel('Forge Card').setStyle(ButtonStyle.Danger).setDisabled(uData.alexandrite < forgeData.cost)
      );

      const response = await interaction.reply({ embeds: [embed], components: [row] });
      const collector = response.createMessageComponentCollector({ time: 30000, max: 1 });
      
      collector.on('collect', async i => {
          if (i.user.id !== user.id) return i.reply({ content: "Not your forge!", flags: MessageFlags.Ephemeral });
          
          db.removeAlexandrite(gId, user.id, forgeData.cost);
          db.setCardQuality(gId, user.id, claim.wikiTitle, forgeData.nextBase);
          
          await i.update({ embeds: [embed.setDescription(`✅ Successfully forged **${claim.wikiTitle}** into **${forgeData.nextTier}** condition!`).setColor('#00ff00')], components: [] });
      });
      return;
  }

  if (commandName === 'encyclopedia') {
      const sub = options.getSubcommand();
      const uData = db.getUser(gId, user.id);
      const bData = JSON.parse(uData.badges || '[0,0,0,0]');
      
      if (sub === 'view') {
          let list = config.BADGES_CONFIG.map((b, idx) => {
              const lvl = bData[idx];
              let desc = lvl === 0 ? '*No buffs unlocked.*' : `**Active:** ${b.desc[lvl-1]}\n`;
              if (lvl < 4) desc += `**Next Lv:** ${b.desc[lvl]}`;
              return `**📘 ${b.name} Encyclopedia (Lv${lvl}/4)**\n${desc}`;
          }).join('\n\n');
          
          return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📘 ${user.username}'s Encyclopedias`).setColor('#1eff00').setDescription(list)] });
      }
      
      if (sub === 'buy') {
          const badgeIdx = parseInt(options.getString('badge'));
          const lvl = bData[badgeIdx];
          const badgeConfig = config.BADGES_CONFIG[badgeIdx];
          
          if (lvl >= 4) return interaction.reply({content: "Max level reached!", flags: MessageFlags.Ephemeral});
          const cost = badgeConfig.baseCost * Math.pow(2, lvl);
          
          if (uData.balance < cost) return interaction.reply({content: `You need **${cost} Lexicons** to upgrade!`, flags: MessageFlags.Ephemeral});
          
          bData[badgeIdx]++;
          db.upgradeBadge(gId, user.id, cost, JSON.stringify(bData));
          return interaction.reply(`📘 **${user.username}** spent **${cost} Lexicons** and leveled up their **${badgeConfig.name} Encyclopedia** to **Lv${lvl+1}**!`);
      }
  }

  if (commandName === 'tower') {
    const sub = options.getSubcommand();
    const uData = db.getUser(gId, user.id);
    const floors = uData.towerFloors;
    const cost = 5000 * (floors + 1);
    
    const floorDescriptions = [
      "+1 Max Energy", "10% Free Scrap", "+1 Wishlist Slot", "Pack Drop Quality Boost",
      "5% Faster Energy Regen", "+5% Base Wish Chance", "10% Free Scrap",
      "+10% Enhanced Wish Chance", "+10% Lexicon Payouts", "+10% Black Lexicon Value (Exp.)"
    ];

    if (sub === 'view') {
      const tData = JSON.parse(uData.towerData || '[0,0,0,0,0,0,0,0,0,0]');
      const currentTier = Math.floor(floors / 10) + 1;
      
      let floorStatus = '';
      for(let i=0; i<10; i++) {
          const hasFloor = tData[i] >= currentTier ? '✅' : '❌';
          floorStatus += `Floor ${i+1} (${floorDescriptions[i]}): ${hasFloor}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏰 ${user.username}'s Tower of Babel (Floor ${floors})`)
        .setColor('#ffd700')
        .setDescription(`**Next Floor Cost:** ${cost} ${config.BASIC_LEXICON_EMOJI}\n**Current Tower Tier:** ${currentTier}\n\n**Floors Built This Tier:**\n${floorStatus}`);
      return interaction.reply({ embeds: [embed] });
    }
    
    if (sub === 'build') {
      const floorNum = options.getInteger('floor');
      const floorIndex = floorNum - 1;
      const currentTier = Math.floor(floors / 10);
      const tData = JSON.parse(uData.towerData || '[0,0,0,0,0,0,0,0,0,0]');

      if (tData[floorIndex] > currentTier) return interaction.reply({content: `You already built Floor ${floorNum} for this tier!`, flags: MessageFlags.Ephemeral});
      if (uData.balance < cost) return interaction.reply({content: `You need **${cost} Lexicons**!`, flags: MessageFlags.Ephemeral});
      
      tData[floorIndex]++;
      db.buildTowerFloor(gId, user.id, cost, JSON.stringify(tData));
      return interaction.reply(`🏗️ **${user.username}** spent **${cost} Lexicons** and built **Floor ${floorNum} (${floorDescriptions[floorIndex]})**!`);
    }

    if (sub === 'destroy') {
      if (floors === 0) return interaction.reply({content: "You don't have a tower!", flags: MessageFlags.Ephemeral});
      let refund = 0; for (let i = 1; i <= floors; i++) refund += (5000 * i);
      db.destroyTower(gId, user.id, refund);
      return interaction.reply(`🧨 **${user.username}** destroyed their Tower and received **${refund} Lexicons**!`);
    }
  }

  if (commandName === 'inventory') {
      await interaction.deferReply();
      const uiData = generateInventoryUI(gId, user.id, 1);
      uiData.embeds[0].setThumbnail(interaction.user.displayAvatarURL());
      return interaction.editReply(uiData);
  }

  if (commandName === 'wish') {
    const sub = options.getSubcommand();
    const wishes = db.getWishes(gId, user.id);
    const uData = db.getUser(gId, user.id);
    const buffs = config.getPlayerBuffs(uData.towerData, uData.badges);
    
    const maxW = uData.wishCapacity + buffs.wishSlots;
    const stdWishes = wishes.filter(w => w.isEnhanced === 0).length;
    const enhancedWishes = wishes.filter(w => w.isEnhanced > 0);
    
    let slotsUsed = stdWishes;
    enhancedWishes.forEach(w => { slotsUsed += w.isEnhanced; });

    if (sub === 'add') {
      if (slotsUsed >= maxW) return interaction.reply({content: `Max wish slots reached (${slotsUsed}/${maxW})!`, flags: MessageFlags.Ephemeral});
      const card = options.getString('card');
      db.addWish(gId, user.id, card);
      return interaction.reply(`🌠 Added **${card}** to your wishlist!`);
    }
    if (sub === 'remove') {
      const card = options.getString('card');
      db.removeWish(gId, user.id, card);
      return interaction.reply(`🗑️ Removed **${card}** from your wishlist.`);
    }
    if (sub === 'list') {
      if (wishes.length === 0) return interaction.reply("Your wishlist is empty!");
      const list = wishes.map(w => `• ${w.isEnhanced > 0 ? '🌟' : '🌠'} **${w.wikiTitle}**`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🌠 ${user.username}'s Wishlist`).setDescription(list).setColor('#a335ee')] });
    }
    if (sub === 'enhance') {
      const card = options.getString('card');
      const wish = wishes.find(w => w.wikiTitle.toLowerCase() === card.toLowerCase());
      if (!wish) return interaction.reply({content: "That card isn't on your wishlist!", flags: MessageFlags.Ephemeral});
      if (wish.isEnhanced > 0) return interaction.reply({content: "Already enhanced!", flags: MessageFlags.Ephemeral});
      
      const cost = Math.pow(2, enhancedWishes.length);
      const emptySlots = maxW - slotsUsed;
      
      if (emptySlots < cost) {
          return interaction.reply({content: `You need **${cost}** free wish slots to enhance this card, but you only have ${emptySlots} available!`, flags: MessageFlags.Ephemeral});
      }
      
      db.enhanceWish(gId, user.id, wish.wikiTitle, cost);
      return interaction.reply(`🌟 **${wish.wikiTitle}** is now an Enhanced Wish! (Occupying ${cost} slots)`);
    }
    if (sub === 'unenhance') {
      const card = options.getString('card');
      db.enhanceWish(gId, user.id, card, 0);
      return interaction.reply(`Removed Enhanced status from **${card}**, returning the slots to your pool.`);
    }
  }

  if (commandName === 'open') {
    const packs = db.getPacks(gId, user.id);
    if (packs.length === 0) return interaction.reply(`⏳ You don't have any packs in your inventory!`);

    const counts = {}; packs.forEach(p => { counts[p.packType] = (counts[p.packType] || 0) + 1; });
    const row = new ActionRowBuilder();
    Object.keys(counts).forEach(type => {
      row.addComponents(new ButtonBuilder().setCustomId(`openpack_${type}`).setLabel(`Open ${type} (${counts[type]})`).setStyle(ButtonStyle.Primary));
    });

    const response = await interaction.reply({ content: '📦 Which pack would you like to open?', components: [row] });
    const collector = response.createMessageComponentCollector({ time: 30000 });
    
    collector.on('collect', async i => {
      if (i.user.id !== user.id) return i.reply({ content: "Not your packs!", flags: MessageFlags.Ephemeral });
      let pType = i.customId.split('_')[1];
      
      const uData = db.getUser(gId, user.id);
      const buffs = config.getPlayerBuffs(uData.towerData, uData.badges);
      
      if (buffs.wishPackMutation && pType === 'Standard' && Math.random() < 0.00001) pType = 'Wish';
      
      db.removePackByType(gId, user.id, pType);
      await i.update({ content: `⏳ Opening a **${pType}** pack...`, components: [] });
      collector.stop('opened');
      
      const userWishes = db.getWishes(gId, user.id);
      
      let scrapTitles = [];
      if (pType === 'Scrap') {
          scrapTitles = db.getRandomClaimedCards(gId, 5).map(c => c.wikiTitle);
      }
      
      const hasLexBuff = Date.now() < uData.buffLexiconEnd;
      const packPages = await getWikiPack(pType, userWishes, buffs, scrapTitles, hasLexBuff); 
      if (packPages.length === 0) return interaction.followUp('API Error: No pages found.');
      return processPackSession(interaction, packPages, pType, user, buffs); 
    });

    collector.on('end', (collected, reason) => {
      if (reason !== 'opened') interaction.editReply({ components: [] }).catch(()=>{});
    });
  }

  if (commandName === 'library') {
    const mode = options.getString('mode') || 'list';
    const inventory = db.getInventory(gId, user.id);
    if (inventory.length === 0) return interaction.reply("Your Library is empty!");

    if (mode === 'list') {
      const totalValue = inventory.reduce((sum, item) => sum + item.value, 0);
      const list = inventory.map(item => `• [${item.wikiTitle}](${item.wikiUrl}) — *${item.rarity}* | Cond: ${config.getConditionString(item.quality)} (${item.quality.toFixed(9)})`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📖 ${user.username}'s Personal Library`).setColor('#ffffff').setDescription(list.length > 2000 ? list.substring(0, 1950) + '\n*...and more entries!*' : list).setFooter({ text: `Total Articles: ${inventory.length} | Value: ${totalValue} Lexicons` })] });
    } else {
      let currentIndex = 0;
      const generateLibUI = (index) => {
        const item = inventory[index];
        item.quality = item.quality != null ? item.quality : 0.01;
        item.value = item.value != null ? item.value : getBaseValue(item.rarity || 'Common');
        
        const embed = new EmbedBuilder()
          .setTitle(item.wikiTitle)
          .setURL(item.wikiUrl)
          .setDescription(`**Rarity:** ${item.rarity}\n**Value:** ${item.value} ${config.BASIC_LEXICON_EMOJI}\n**Condition:** ${config.getConditionString(item.quality)} (${item.quality.toFixed(9)})\n\n${item.description ? (item.description.length > 700 ? item.description.substring(0, 695) + '...' : item.description) : '*No description saved.*'}`)
          .setColor(config.COLORS[item.rarity] || config.COLORS['Common'])
          .setFooter({ text: `Card ${index + 1} of ${inventory.length}` });

        if (item.imageUrl) embed.setImage(item.imageUrl);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('lib_back').setLabel('Back').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('lib_next').setLabel('Next').setStyle(ButtonStyle.Primary)
        );
        return { content: `📖 Browsing **${user.username}'s** Library`, embeds: [embed], components: [row] };
      };

      const response = await interaction.reply(generateLibUI(currentIndex));
      const collector = response.createMessageComponentCollector({ time: 120000 });
      collector.on('collect', async i => {
        if (i.user.id !== user.id) return i.reply({ content: "Not your library!", flags: MessageFlags.Ephemeral });
        if (i.customId === 'lib_next') currentIndex = (currentIndex + 1) % inventory.length;
        if (i.customId === 'lib_back') currentIndex = (currentIndex - 1 + inventory.length) % inventory.length;
        await i.update(generateLibUI(currentIndex));
      });
      collector.on('end', () => interaction.editReply({ components: [] }).catch(()=>null));
    }
  }

  // --- PASS THROUGHS ---
  if (commandName === 'top') {
    const sub = options.getSubcommand();
    const embed = new EmbedBuilder().setColor('#ffd700');
    
    if (sub === 'balance') {
        embed.setTitle('🏆 Richest Players').setDescription(db.getTopBalances(gId).map((u, i) => `**${i + 1}.** <@${u.userId}> — **${u.balance}** ${config.BASIC_LEXICON_EMOJI}`).join('\n') || 'No players found.');
    } else if (sub === 'library') {
        embed.setTitle('🏆 Highest Valued Libraries').setDescription(db.getTopLibraryValue(gId).map((u, i) => `**${i + 1}.** <@${u.userId}> — **${u.totalValue}** ${config.BASIC_LEXICON_EMOJI}`).join('\n') || 'No players found.');
    }
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'daily') {
    const uData = db.getUser(gId, user.id); const now = Date.now(); const cooldown = 20 * 60 * 60 * 1000; 
    if (now - uData.lastDaily < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - uData.lastDaily)) / 60000);
      return interaction.reply(`⏳ You've already claimed your daily! Come back in **${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m**.`);
    }
    
    let mult = 1.0; let forcePremium = false;
    if (now < uData.buffDailyEnd) { mult = uData.buffDailyMult; forcePremium = true; }

    const freePack = forcePremium ? { type: 'Graded' } : config.getWeightedRandom(config.PACK_WEIGHTS);
    const lexPayout = Math.floor(200 * mult);
    
    db.addMoney(gId, user.id, lexPayout); 
    db.addPack(gId, user.id, freePack.type); 
    db.setDaily(gId, user.id, now);
    
    let msg = `🎁 **${user.username}** claimed the daily reward!\n+ **${lexPayout}** ${config.BASIC_LEXICON_EMOJI}\n+ **1x ${freePack.type} Pack**`;
    if (forcePremium) msg += `\n*(Shop Buff: Active!)*`;
    return interaction.reply(msg);
  }
  if (commandName === 'admin') {
    const sub = options.getSubcommand();
    if (sub === 'givepack') {
      const target = options.getUser('user'); 
      const pType = options.getString('type');
      const amt = options.getInteger('amount') || 1;
      db.getUser(gId, target.id); 
      for(let i=0; i<amt; i++) db.addPack(gId, target.id, pType);
      return interaction.reply({ content: `✅ Gave ${amt}x ${pType} Pack(s) to ${target.username}.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'addmoney') {
      const target = options.getUser('user'); const amt = options.getInteger('amount');
      db.addMoney(gId, target.id, amt); return interaction.reply({ content: `✅ Added ${amt} Lexicons to ${target.username}.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'addalexandrite') {
      const target = options.getUser('user'); const amt = options.getInteger('amount');
      db.addAlexandrite(gId, target.id, amt); return interaction.reply({ content: `✅ Added ${amt} Alexandrite to ${target.username}.`, flags: MessageFlags.Ephemeral });
    }
  }
  if (commandName === 'balance') return interaction.reply(`${config.BASIC_LEXICON_EMOJI} **${user.username}**, you possess **${db.getUser(gId, user.id).balance} Lexicons**.`);
  if (commandName === 'divorce') {
    const targetCard = options.getString('card'); const claim = db.isClaimed(gId, targetCard);
    if (!claim || claim.userId !== user.id) return interaction.reply({ content: `You do not own **${targetCard}**!`, flags: MessageFlags.Ephemeral });
    db.divorcePage(gId, user.id, targetCard); db.addMoney(gId, user.id, claim.value);
    return interaction.reply(`💔 You divorced **${claim.wikiTitle}** for **${claim.value} Lexicons**.`);
  }
  if (commandName === 'view') {
    await interaction.deferReply();
    const targetCard = options.getString('card');
    const claimedData = db.isClaimed(gId, targetCard);
    let page = claimedData;

    if (!claimedData) {
      page = await getSpecificWikiPage(targetCard);
      if (!page) return interaction.editReply(`Could not find a Wikipedia article matching "**${targetCard}**".`);
    } else {
      page.quality = claimedData.quality != null ? claimedData.quality : 0.01;
      page.value = claimedData.value != null ? claimedData.value : getBaseValue(page.rarity || 'Common');
    }

    const embed = new EmbedBuilder()
      .setTitle(page.wikiTitle || page.title)
      .setURL(page.wikiUrl || page.url)
      .setDescription(`**Value:** ${page.value} ${config.BASIC_LEXICON_EMOJI}\n**Condition:** ${page.quality ? `${config.getConditionString(page.quality)} (${page.quality.toFixed(9)})` : '??? *(Determined on Claim)*'}`)
      .setColor(config.COLORS[page.rarity] || config.COLORS['Common'])
      .addFields({ name: '✨ Rarity', value: page.rarity, inline: true }, { name: '🔒 Status', value: claimedData ? `Claimed by <@${claimedData.userId}>` : 'Available to Claim!', inline: true });
      
    if (page.imageUrl) embed.setImage(page.imageUrl);
    return interaction.editReply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);