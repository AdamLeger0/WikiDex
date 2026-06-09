require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, ApplicationCommandOptionType, Events, MessageFlags } = require('discord.js');
const db = require('./database');
const config = require('./config');
const { getWikiPack, getSpecificWikiPage, getBaseValue } = require('./wikiService'); 

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  { name: 'inventory', description: 'View your profile, wishlist stats, and available packs.' },
  { name: 'open', description: 'Open a pack from your inventory!' },
  { name: 'balance', description: 'Check your current Lexicon balance.' },
  { 
    name: 'library', description: 'Browse your personal Wiki Collection.',
    options: [{ name: 'mode', description: 'How to view your library', type: ApplicationCommandOptionType.String, required: false, choices: [{name: 'List', value: 'list'}, {name: 'View', value: 'view'}] }]
  },
  { name: 'daily', description: 'Claim your daily allowance of Lexicons and a free random pack.' },
  { name: 'top', description: 'View the richest players in the server.' },
  { 
    name: 'wish', description: 'Manage your wishlist.',
    options: [
      { name: 'add', description: 'Add a card to your wishlist', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] },
      { name: 'remove', description: 'Remove a card from your wishlist', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] },
      { name: 'list', description: 'View your wishlist', type: ApplicationCommandOptionType.Subcommand },
      { name: 'upgrade_slot', description: 'Sacrifice normal wish capacity to unlock an Enhanced Slot', type: ApplicationCommandOptionType.Subcommand },
      { name: 'enhance', description: 'Enhance a wish (uses an enhanced slot)', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] },
      { name: 'unenhance', description: 'Remove Enhanced status from a wish', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'card', description: 'Title', type: ApplicationCommandOptionType.String, required: true }] }
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
          { name: 'type', description: 'Type', type: ApplicationCommandOptionType.String, required: true, choices: [{name: 'Standard', value: 'Standard'}, {name: 'Graded', value: 'Graded'}, {name: 'Fixed', value: 'Fixed'}] },
          { name: 'amount', description: 'Number of packs to give', type: ApplicationCommandOptionType.Integer, required: false, min_value: 1 }
        ] 
      },
      { name: 'addmoney', description: 'Give lexicons to a user', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'user', description: 'User', type: ApplicationCommandOptionType.User, required: true }, { name: 'amount', description: 'Amount', type: ApplicationCommandOptionType.Integer, required: true }] }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => { await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands }); })();

client.once(Events.ClientReady, () => console.log(`⚡ WikiDex is online! Logged in as ${client.user.tag}`));

function processHourlyStats(userId) {
  const user = db.getUser(userId);
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  
  const elapsedPacks = now - user.lastPackUpdate;
  if (elapsedPacks >= hourMs) {
    const packsToGive = Math.floor(elapsedPacks / hourMs);
    const maxToAdd = Math.max(0, config.MAX_PACKS - db.getPacks(userId).length);
    for(let i=0; i < Math.min(packsToGive, maxToAdd); i++) db.addPack(userId, config.getWeightedRandom(config.PACK_WEIGHTS).type);
    db.setLastPackUpdate(userId, user.lastPackUpdate + (packsToGive * hourMs));
  }

  const elapsedEnergy = now - user.lastEnergyUpdate;
  if (elapsedEnergy >= hourMs) {
    const energyToGive = Math.floor(elapsedEnergy / hourMs);
    const maxEToAdd = Math.max(0, config.MAX_ENERGY - user.energy);
    if (Math.min(energyToGive, maxEToAdd) > 0) db.addEnergy(userId, Math.min(energyToGive, maxEToAdd));
    db.setLastEnergyUpdate(userId, user.lastEnergyUpdate + (energyToGive * hourMs));
  }
}

async function processPackSession(interaction, allPages, packType, user) {
  let wishPings = new Set();
  
  const pageData = allPages.map(page => {
    let claimedBy = null; let lexDrop = null;
    if (page.isLexiconCard) { lexDrop = page.lexiconDrop; } 
    else {
      const claimObj = db.isClaimed(page.title);
      if (claimObj) { 
        claimedBy = claimObj.userId; 
        lexDrop = config.getWeightedRandom(config.LEXICON_ENERGY); 
        // Fallback repair: Fixes old cards that had a 'null' quality or value in the database
        page.quality = claimObj.quality != null ? claimObj.quality : Math.random();
        page.value = claimObj.value != null ? claimObj.value : getBaseValue(page.rarity || 'Common'); 
      }
      db.checkWishedBy(page.title).forEach(w => wishPings.add(w.userId));
    }
    return { ...page, claimedBy, lexiconDrop: lexDrop };
  });

  let pingStr = wishPings.size > 0 ? Array.from(wishPings).map(id => `<@${id}>`).join(', ') + ' 🌠 A Wished card appeared!\n' : '';
  let currentIndex = 0; 
  let packClaimed = false; 
  let scrapedLexicons = new Set(); 

  const generateUI = (index, disabled = false, timeLeftStr = '60s', warning = '') => {
    const page = pageData[index];
    const userStats = db.getUser(user.id);
    const isScraped = scrapedLexicons.has(index);
    
    let statsDesc = `**Rarity:** ${page.rarity}\n**Value:** ${page.value} ${config.BASIC_LEXICON_EMOJI} ${!page.quality && !page.isLexiconCard ? '*(Base)*' : ''}\n**Condition:** ${page.quality ? `${config.getConditionString(page.quality)} (${page.quality.toFixed(9)})` : '??? *(Determined on Claim)*'}\n\n`;
    if (page.isWishSpawn) statsDesc = `🌠 **WISH SPAWN!**\n` + statsDesc;

    const embed = new EmbedBuilder()
      .setTitle(page.title)
      .setDescription(statsDesc + (page.description.length > 700 ? page.description.substring(0, 695) + '...' : page.description))
      .setColor(config.COLORS[page.rarity] || config.COLORS['Common'])
      .setFooter({ text: `Card ${index + 1} of ${pageData.length} • ${packType} Pack • ⚡ ${userStats.energy}/${config.MAX_ENERGY} • Time: ${timeLeftStr}${warning}` });

    if (page.url) embed.setURL(page.url);
    if (page.imageUrl) embed.setImage(page.imageUrl);

    let actionBtn;
    if (page.isLexiconCard) {
      const isIndigo = page.lexiconDrop.name.includes('Indigo');
      const energyCost = isIndigo ? 0 : 1;
      actionBtn = new ButtonBuilder().setCustomId('claim_lexicon_card')
        .setLabel(isScraped ? 'Absorbed' : `Absorb (Cost: ${energyCost} ⚡)`)
        .setEmoji(page.lexiconDrop.emoji).setStyle(ButtonStyle.Success)
        .setDisabled(disabled || packClaimed || (userStats.energy < energyCost && !isScraped) || isScraped);
    } else if (page.claimedBy) {
      actionBtn = new ButtonBuilder().setCustomId('claim_lexicon')
        .setLabel(isScraped ? 'Scraped' : 'Scrape')
        .setEmoji(page.lexiconDrop.emoji).setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || packClaimed || isScraped);
    } else {
      actionBtn = new ButtonBuilder().setCustomId('claim_page')
        .setLabel('Claim').setStyle(ButtonStyle.Success).setDisabled(disabled || packClaimed);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(ButtonStyle.Primary).setDisabled(disabled || packClaimed),
      new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(disabled || packClaimed),
      actionBtn
    );

    return { content: `${pingStr}You opened a **${packType}** pack! Pick **one** card below!`, embeds: [embed], components: [row] };
  };

  let timeLeft = 60;
  const timerInterval = setInterval(async () => {
    if (packClaimed || timeLeft <= 0) return clearInterval(timerInterval);
    timeLeft -= 15;
    if (timeLeft > 0) await interaction.editReply(generateUI(currentIndex, false, `${timeLeft}s`, timeLeft === 15 ? ' ⚠️ 15s left!' : '')).catch(()=>{});
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
      if (db.isClaimed(page.title)) return i.reply({ content: 'Sniped!', flags: MessageFlags.Ephemeral });

      const quality = Math.random();
      const finalValue = Math.max(1, Math.floor(page.value * quality));
      db.claimPage(user.id, page.title, page.url, page.imageUrl, page.description, page.rarity, finalValue, quality);
      
      page.quality = quality;
      page.value = finalValue;
      page.claimedBy = user.id;
      page.lexiconDrop = config.getWeightedRandom(config.LEXICON_ENERGY);

      packClaimed = true; clearInterval(timerInterval);
      await i.update(generateUI(currentIndex, true, 'Claimed')); 
      await i.followUp(`🎉 **${user.username}** successfully claimed **${page.title}**! Condition: **${config.getConditionString(quality)}**!`);
      collector.stop();
    } 
    else if (i.customId === 'claim_lexicon_card' || i.customId === 'claim_lexicon') {
      const page = pageData[currentIndex]; const drop = page.lexiconDrop;
      
      if (i.customId === 'claim_lexicon_card') {
        const uData = db.getUser(user.id);
        const isIndigo = drop.name.includes('Indigo');
        const energyCost = isIndigo ? 0 : 1;
        
        if (uData.energy < energyCost) return i.reply({ content: "Not enough energy!", flags: MessageFlags.Ephemeral });
        if (energyCost > 0) db.useEnergy(user.id, energyCost); 
      }

      let mult = drop.mult === 'random' ? (Math.random() * 19.9) + 0.1 : drop.mult;
      const payout = Math.max(1, Math.floor(page.value * mult));
      db.addMoney(user.id, payout); 
      scrapedLexicons.add(currentIndex); 
      
      await i.update(generateUI(currentIndex, false, `${timeLeft}s`));
      await i.followUp({ content: `⚡ **${user.username}** absorbed ${drop.emoji} **${drop.name} Energy** and earned **${payout} Lexicons**!`, flags: MessageFlags.Ephemeral });
    }
  });

  collector.on('end', async (collected, reason) => {
    clearInterval(timerInterval);
    if (reason === 'time' && !packClaimed) await interaction.editReply(generateUI(currentIndex, true, 'Expired')).catch(()=>null);
  });
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user, options } = interaction;
  
  db.getUser(user.id); 
  processHourlyStats(user.id); 

  if (commandName === 'inventory') {
    await interaction.deferReply();
    try {
      const uData = db.getUser(user.id);
      const packs = db.getPacks(user.id);
      const wishes = db.getWishes(user.id);
      const activeEnhanced = wishes.filter(w => w.isEnhanced === 1).length;
      
      const nextPackTime = Math.floor((uData.lastPackUpdate + 3600000) / 1000);
      const nextEnergyTime = Math.floor((uData.lastEnergyUpdate + 3600000) / 1000);

      const counts = {};
      packs.forEach(p => { counts[p.packType] = (counts[p.packType] || 0) + 1; });
      const packList = Object.entries(counts).map(([type, count]) => `**${count}x** ${type} Pack`).join('\n') || '*No packs available.*';

      const embed = new EmbedBuilder()
        .setTitle(`🎒 ${user.username}'s Profile`)
        .setColor('#a335ee')
        .addFields(
          { name: '💰 Wealth', value: `**${uData.balance}** ${config.BASIC_LEXICON_EMOJI}`, inline: true },
          { name: '⚡ Energy', value: `**${uData.energy}** / ${config.MAX_ENERGY}`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true }, 
          { name: '📦 Packs', value: packList, inline: true },
          { name: '🌠 Wishes', value: `Slots: **${wishes.length}/${uData.wishCapacity}**\nEnhanced: **${activeEnhanced}/${uData.enhancedSlots}**\nBoosts: **Base (5%) | Enhanced (10%)**`, inline: true },
          { name: '⏱️ Background Timers', value: `**Next Pack Drop:** <t:${nextPackTime}:R>\n**Next Energy Regen:** <t:${nextEnergyTime}:R>`, inline: false }
        )
        .setThumbnail(interaction.user.displayAvatarURL());
        
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.editReply("An error occurred fetching your inventory.");
    }
  }

  if (commandName === 'wish') {
    const sub = options.getSubcommand();
    const wishes = db.getWishes(user.id);
    const uData = db.getUser(user.id);

    if (sub === 'add') {
      if (wishes.length >= uData.wishCapacity) return interaction.reply({content: `Max wishes reached (${uData.wishCapacity})!`, flags: MessageFlags.Ephemeral});
      const card = options.getString('card');
      db.addWish(user.id, card);
      return interaction.reply(`🌠 Added **${card}** to your wishlist!`);
    }
    if (sub === 'remove') {
      const card = options.getString('card');
      db.removeWish(user.id, card);
      return interaction.reply(`🗑️ Removed **${card}** from your wishlist.`);
    }
    if (sub === 'list') {
      if (wishes.length === 0) return interaction.reply("Your wishlist is empty!");
      const list = wishes.map(w => `• ${w.isEnhanced ? '🌟' : '🌠'} **${w.wikiTitle}**`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🌠 ${user.username}'s Wishlist`).setDescription(list).setColor('#a335ee')] });
    }
    if (sub === 'upgrade_slot') {
      const cost = Math.pow(2, uData.enhancedSlots);
      const emptySlots = uData.wishCapacity - wishes.length;

      if (uData.wishCapacity <= cost) {
        return interaction.reply({content: `You don't have enough base wish capacity to sacrifice! You need **${cost}**, but your max capacity is **${uData.wishCapacity}**.`, flags: MessageFlags.Ephemeral});
      }
      if (emptySlots < cost) {
        return interaction.reply({content: `You need **${cost} empty wish slot(s)** to sacrifice! You currently have ${emptySlots} empty slots. Remove some wishes first!`, flags: MessageFlags.Ephemeral});
      }

      db.upgradeWishSlot(user.id, cost);
      return interaction.reply(`🌟 Upgraded! You sacrificed **${cost} wish slot(s)**. You now have **${uData.enhancedSlots + 1}** Enhanced Wish Slots. Your new base capacity is **${uData.wishCapacity - cost}**.`);
    }
    if (sub === 'enhance') {
      const card = options.getString('card');
      const wish = wishes.find(w => w.wikiTitle.toLowerCase() === card.toLowerCase());
      if (!wish) return interaction.reply({content: "That card isn't on your wishlist!", flags: MessageFlags.Ephemeral});
      if (wish.isEnhanced) return interaction.reply({content: "Already enhanced!", flags: MessageFlags.Ephemeral});
      
      const activeEnh = wishes.filter(w => w.isEnhanced).length;
      if (activeEnh >= uData.enhancedSlots) return interaction.reply({content: `You have no open Enhanced Slots! Buy more with \`/wish upgrade_slot\`.`, flags: MessageFlags.Ephemeral});
      
      db.enhanceWish(user.id, wish.wikiTitle, 1);
      return interaction.reply(`🌟 **${wish.wikiTitle}** is now an Enhanced Wish!`);
    }
    if (sub === 'unenhance') {
      const card = options.getString('card');
      db.enhanceWish(user.id, card, 0);
      return interaction.reply(`Removed Enhanced status from **${card}**.`);
    }
  }

  if (commandName === 'open') {
    const packs = db.getPacks(user.id);
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
      const pType = i.customId.split('_')[1];
      
      db.removePackByType(user.id, pType);
      await i.update({ content: `⏳ Opening a **${pType}** pack...`, components: [] });
      collector.stop('opened');
      
      const userWishes = db.getWishes(user.id);
      const packPages = await getWikiPack(10, pType, userWishes);
      if (packPages.length === 0) return interaction.followUp('API Error: No pages found.');
      return processPackSession(interaction, packPages, pType, user); 
    });

    collector.on('end', (collected, reason) => {
      if (reason !== 'opened') interaction.editReply({ components: [] }).catch(()=>{});
    });
  }

  if (commandName === 'library') {
    const mode = options.getString('mode') || 'list';
    const inventory = db.getInventory(user.id);
    if (inventory.length === 0) return interaction.reply("Your Library is empty!");

    if (mode === 'list') {
      const totalValue = inventory.reduce((sum, item) => sum + item.value, 0);
      const list = inventory.map(item => `• [${item.wikiTitle}](${item.wikiUrl}) — *${item.rarity}* | Cond: ${config.getConditionString(item.quality)} (${item.quality.toFixed(9)})`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📖 ${user.username}'s Personal Library`).setColor('#ffffff').setDescription(list.length > 2000 ? list.substring(0, 1950) + '\n*...and more entries!*' : list).setFooter({ text: `Total Articles: ${inventory.length} | Value: ${totalValue} Lexicons` })] });
    } else {
      let currentIndex = 0;
      const generateLibUI = (index) => {
        const item = inventory[index];
        // Repair fallback check just in case
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
  if (commandName === 'daily') {
    const uData = db.getUser(user.id); const now = Date.now(); const cooldown = 20 * 60 * 60 * 1000; 
    if (now - uData.lastDaily < cooldown) {
      const timeLeft = Math.ceil((cooldown - (now - uData.lastDaily)) / 60000);
      return interaction.reply(`⏳ You've already claimed your daily! Come back in **${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m**.`);
    }
    const freePack = config.getWeightedRandom(config.PACK_WEIGHTS);
    db.addMoney(user.id, 200); db.addPack(user.id, freePack.type); db.setDaily(user.id, now);
    return interaction.reply(`🎁 **${user.username}** claimed the daily reward!\n+ **200** ${config.BASIC_LEXICON_EMOJI}\n+ **1x ${freePack.type} Pack**`);
  }
  if (commandName === 'admin') {
    const sub = options.getSubcommand();
    if (sub === 'givepack') {
      const target = options.getUser('user'); 
      const pType = options.getString('type');
      const amt = options.getInteger('amount') || 1;
      
      db.getUser(target.id); 
      for(let i=0; i<amt; i++) db.addPack(target.id, pType);
      
      return interaction.reply({ content: `✅ Gave ${amt}x ${pType} Pack(s) to ${target.username}.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'addmoney') {
      const target = options.getUser('user'); const amt = options.getInteger('amount');
      db.addMoney(target.id, amt); return interaction.reply({ content: `✅ Added ${amt} Lexicons to ${target.username}.`, flags: MessageFlags.Ephemeral });
    }
  }
  if (commandName === 'balance') return interaction.reply(`${config.BASIC_LEXICON_EMOJI} **${user.username}**, you possess **${db.getUser(user.id).balance} Lexicons**.`);
  if (commandName === 'top') return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 Richest Players').setColor('#ffd700').setDescription(db.getTopBalances().map((u, i) => `**${i + 1}.** <@${u.userId}> — **${u.balance}** ${config.BASIC_LEXICON_EMOJI}`).join('\n') || 'No players found.')] });
  if (commandName === 'divorce') {
    const targetCard = options.getString('card'); const claim = db.isClaimed(targetCard);
    if (!claim || claim.userId !== user.id) return interaction.reply({ content: `You do not own **${targetCard}**!`, flags: MessageFlags.Ephemeral });
    db.divorcePage(user.id, targetCard); db.addMoney(user.id, claim.value);
    return interaction.reply(`💔 You divorced **${claim.wikiTitle}** for **${claim.value} Lexicons**.`);
  }
  if (commandName === 'view') {
    await interaction.deferReply();
    const targetCard = options.getString('card');
    const claimedData = db.isClaimed(targetCard);
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
      .addFields(
        { name: '✨ Rarity', value: page.rarity, inline: true },
        { name: '🔒 Status', value: claimedData ? `Claimed by <@${claimedData.userId}>` : 'Available to Claim!', inline: true }
      );
      
    if (page.imageUrl) embed.setImage(page.imageUrl);
    return interaction.editReply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);