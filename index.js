require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const db = require('./database');
const { getWikiPack, getSpecificWikiPage } = require('./wikiService'); 

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  { 
    name: 'open', 
    description: 'Open a pack of Wikipedia articles! (1 pack = 10 pages)',
    options: [{ name: 'amount', description: 'Number of packs to open at once', type: ApplicationCommandOptionType.Integer, required: false, min_value: 1, max_value: 5 }]
  },
  { name: 'balance', description: 'Check your current Lexicon balance.' },
  { name: 'dex', description: 'Browse your personal WikiDex library.' },
  { 
    name: 'divorce', 
    description: 'Release a claimed card back into the wild for Lexicons.',
    options: [{ name: 'card', description: 'Exact title of the card to divorce', type: ApplicationCommandOptionType.String, required: true }]
  },
  {
    name: 'view',
    description: 'Look up any Wikipedia article to see its rarity, value, and owner.',
    options: [{ name: 'card', description: 'Title of the article', type: ApplicationCommandOptionType.String, required: true }]
  },
  {
    name: 'trade',
    description: 'Trade cards and Lexicons with another player.',
    options: [
      { name: 'user', description: 'The user you want to trade with', type: ApplicationCommandOptionType.User, required: true },
      { name: 'give_card', description: 'Card you are offering', type: ApplicationCommandOptionType.String, required: false },
      { name: 'give_lexicons', description: 'Lexicons you are offering', type: ApplicationCommandOptionType.Integer, required: false },
      { name: 'request_card', description: 'Card you are requesting', type: ApplicationCommandOptionType.String, required: false },
      { name: 'request_lexicons', description: 'Lexicons you are requesting', type: ApplicationCommandOptionType.Integer, required: false }
    ]
  }
];

const basicLexicon = '<:Basic_Lexicon:1513502433983332352>';
const colors = { 'Legendary': '#ffd700', 'Epic': '#a335ee', 'Rare': '#0070dd', 'Common': '#2b2d31' }; 

const lexicons = [
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

function getRandomLexicon() {
  const totalWeight = lexicons.reduce((sum, lex) => sum + lex.weight, 0);
  let randomNum = Math.random() * totalWeight;
  for (const lex of lexicons) {
    if (randomNum < lex.weight) return lex;
    randomNum -= lex.weight;
  }
  return lexicons[0];
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('WikiDex commands successfully deployed globally.');
  } catch (error) { console.error(error); }
})();

client.once('ready', () => console.log(`⚡ WikiDex is online! Logged in as ${client.user.tag}`));

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, user } = interaction;
  db.getUser(user.id); 

  if (commandName === 'balance') {
    const userData = db.getUser(user.id);
    return interaction.reply(`${basicLexicon} **${user.username}**, you possess **${userData.balance} Lexicons**.`);
  }

  if (commandName === 'dex') {
    const inventory = db.getInventory(user.id);
    if (inventory.length === 0) return interaction.reply("Your WikiDex is completely empty! Run `/open`.");
    
    const list = inventory.map(item => `• [${item.wikiTitle}](${item.wikiUrl}) — *${item.rarity}*`).join('\n');
    const embed = new EmbedBuilder()
      .setTitle(`📖 ${user.username}'s Personal WikiDex`)
      .setColor('#ffffff')
      .setDescription(list.length > 2000 ? list.substring(0, 1950) + '\n*...and more entries!*' : list)
      .setFooter({ text: `Total Articles Claimed: ${inventory.length}` });
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'divorce') {
    const targetCard = interaction.options.getString('card');
    const claimedData = db.isClaimed(targetCard);
    
    if (!claimedData || claimedData.userId !== user.id) {
      return interaction.reply({ content: `You do not own **${targetCard}**!`, ephemeral: true });
    }

    db.divorcePage(user.id, targetCard);
    db.addMoney(user.id, claimedData.value);
    return interaction.reply(`💔 You have divorced **${claimedData.wikiTitle}** and received **${claimedData.value} Lexicons**.`);
  }

  if (commandName === 'view') {
    await interaction.deferReply();
    const targetCard = interaction.options.getString('card');
    
    // First, check if it exists in the database
    const claimedData = db.isClaimed(targetCard);
    let page = claimedData;

    // If not in database, fetch it dynamically from Wikipedia to see potential value
    if (!claimedData) {
      page = await getSpecificWikiPage(targetCard);
      if (!page) return interaction.editReply(`Could not find a Wikipedia article matching "**${targetCard}**".`);
    }

    const embed = new EmbedBuilder()
      .setTitle(page.wikiTitle || page.title)
      .setURL(page.wikiUrl || page.url)
      .setDescription(`**${page.value}** ${basicLexicon}`)
      .setColor(colors[page.rarity] || colors['Common'])
      .addFields(
        { name: '✨ Rarity', value: page.rarity, inline: true },
        { name: '🔒 Status', value: claimedData ? `Claimed by <@${claimedData.userId}>` : 'Available to Claim!', inline: true }
      );
      
    if (page.imageUrl) embed.setImage(page.imageUrl);
    return interaction.editReply({ embeds: [embed] });
  }

  if (commandName === 'trade') {
    const targetUser = interaction.options.getUser('user');
    const giveCard = interaction.options.getString('give_card');
    const reqCard = interaction.options.getString('request_card');
    const giveLex = interaction.options.getInteger('give_lexicons') || 0;
    const reqLex = interaction.options.getInteger('request_lexicons') || 0;

    if (targetUser.bot || targetUser.id === user.id) return interaction.reply({ content: "Invalid trade target.", ephemeral: true });
    if (!giveCard && !reqCard && giveLex === 0 && reqLex === 0) return interaction.reply({ content: "You must offer or request something!", ephemeral: true });

    const initiator = db.getUser(user.id);
    const target = db.getUser(targetUser.id);

    // Initial validations
    if (giveLex > initiator.balance) return interaction.reply({ content: `You don't have ${giveLex} Lexicons!`, ephemeral: true });
    if (reqLex > target.balance) return interaction.reply({ content: `<@${targetUser.id}> does not have ${reqLex} Lexicons!`, ephemeral: true });
    
    if (giveCard) {
      const card = db.isClaimed(giveCard);
      if (!card || card.userId !== user.id) return interaction.reply({ content: `You do not own **${giveCard}**!`, ephemeral: true });
    }
    if (reqCard) {
      const card = db.isClaimed(reqCard);
      if (!card || card.userId !== targetUser.id) return interaction.reply({ content: `<@${targetUser.id}> does not own **${reqCard}**!`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🤝 Trade Request')
      .setDescription(`<@${user.id}> wants to trade with <@${targetUser.id}>!`)
      .addFields(
        { name: `${user.username} Offers:`, value: `${giveCard ? `🃏 **${giveCard}**\n` : ''}${giveLex > 0 ? `🪙 **${giveLex}** Lexicons` : ''}` || 'Nothing', inline: true },
        { name: `${targetUser.username} Gives:`, value: `${reqCard ? `🃏 **${reqCard}**\n` : ''}${reqLex > 0 ? `🪙 **${reqLex}** Lexicons` : ''}` || 'Nothing', inline: true }
      )
      .setColor('#00ff00');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('accept_trade').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('decline_trade').setLabel('Decline').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.reply({ content: `<@${targetUser.id}>, you have a trade offer!`, embeds: [embed], components: [row] });
    
    const collector = response.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async i => {
      if (i.user.id !== targetUser.id) return i.reply({ content: "This trade isn't for you!", ephemeral: true });
      
      if (i.customId === 'decline_trade') {
        await i.update({ content: 'Trade declined.', embeds: [], components: [] });
        return collector.stop();
      }

      if (i.customId === 'accept_trade') {
        // Double-check ownerships in case they divorced mid-trade
        if (giveLex > db.getUser(user.id).balance || reqLex > db.getUser(targetUser.id).balance) return i.reply({ content: "Someone's balance changed! Trade canceled.", ephemeral: true });
        if (giveCard && db.isClaimed(giveCard)?.userId !== user.id) return i.reply({ content: `${user.username} no longer owns the card!`, ephemeral: true });
        if (reqCard && db.isClaimed(reqCard)?.userId !== targetUser.id) return i.reply({ content: `You no longer own the requested card!`, ephemeral: true });

        // Execute DB transactions
        if (giveLex > 0) { db.removeMoney(user.id, giveLex); db.addMoney(targetUser.id, giveLex); }
        if (reqLex > 0) { db.removeMoney(targetUser.id, reqLex); db.addMoney(user.id, reqLex); }
        if (giveCard) db.transferPage(user.id, targetUser.id, giveCard);
        if (reqCard) db.transferPage(targetUser.id, user.id, reqCard);

        embed.setTitle('✅ Trade Successful!').setColor('#00aa00');
        await i.update({ content: null, embeds: [embed], components: [] });
        collector.stop();
      }
    });
  }

  if (commandName === 'open') {
    const amount = interaction.options.getInteger('amount') || 1; 
    const userData = db.getUser(user.id);
    const now = Date.now();

    if (now > userData.nextPackReset) {
      userData.packsLeft = 1; // Resets to 1 pack per hour!
      userData.nextPackReset = now + (60 * 60 * 1000); 
      db.resetPacks(user.id, userData.packsLeft, userData.nextPackReset);
    }

    if (userData.packsLeft < amount) {
      const timeLeft = Math.ceil((userData.nextPackReset - now) / 60000);
      return interaction.reply(`⏳ You only have **${userData.packsLeft}** packs left! The archives grant a new pack in **${timeLeft} minutes**.`);
    }

    await interaction.deferReply();
    db.usePack(user.id, amount);

    let allPages = [];
    let packTypesDisplay = [];

    // Process each pack individually to calculate odds
    for (let p = 0; p < amount; p++) {
      let roll = Math.random() * 100;
      let pType = 'Standard';
      if (roll > 99) pType = 'Fixed'; // 1% Chance
      else if (roll > 90) pType = 'Graded'; // 9% Chance

      packTypesDisplay.push(pType);
      const packPages = await getWikiPack(10, pType);
      allPages.push(...packPages);
    }

    if (allPages.length === 0) return interaction.editReply('The library archives are jammed. Try opening a pack again!');

    const pageData = allPages.map(page => {
      const claimedBy = db.isClaimed(page.title);
      return { ...page, claimedBy: claimedBy ? claimedBy.userId : null, lexiconDrop: claimedBy ? getRandomLexicon() : null };
    });

    let currentIndex = 0;
    let packClaimed = false; 

    // The timer logic UI generator
    const generateUI = (index, disabled = false, timeLeftStr = '60s', warning = '') => {
      const page = pageData[index];
      const currentPackIndex = Math.floor(index / 10);
      const currentPackType = packTypesDisplay[currentPackIndex];
      
      const embed = new EmbedBuilder()
        .setTitle(page.title)
        .setURL(page.url)
        .setDescription(`**${page.value}** ${basicLexicon}\n\n${page.description.length > 800 ? page.description.substring(0, 795) + '...' : page.description}`)
        .setColor(colors[page.rarity] || colors['Common'])
        .setFooter({ text: `Card ${index + 1} of ${pageData.length} • ${currentPackType} Pack • Time: ${timeLeftStr}${warning}` });

      if (page.imageUrl) embed.setImage(page.imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back').setLabel('Back').setStyle(ButtonStyle.Primary).setDisabled(disabled || packClaimed),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(disabled || packClaimed),
        page.claimedBy 
          ? new ButtonBuilder().setCustomId('claim_lexicon').setEmoji(page.lexiconDrop.emoji).setStyle(ButtonStyle.Secondary).setDisabled(disabled || packClaimed)
          : new ButtonBuilder().setCustomId('claim_page').setLabel('Claim').setStyle(ButtonStyle.Success).setDisabled(disabled || packClaimed)
      );

      return { content: `You've opened **${amount}** pack(s)! Pick **one** card below!`, embeds: [embed], components: [row] };
    };

    // The Timer Logic
    let timeLeft = 60;
    const timerInterval = setInterval(async () => {
      if (packClaimed || timeLeft <= 0) return clearInterval(timerInterval);
      timeLeft -= 15;
      
      if (timeLeft > 0) {
        let warning = timeLeft === 15 ? ' ⚠️ WARNING: 15 seconds left!' : '';
        await interaction.editReply(generateUI(currentIndex, false, `${timeLeft}s`, warning)).catch(() => {});
      }
    }, 15000);

    const response = await interaction.editReply(generateUI(currentIndex, false, '60s', ''));
    const collector = response.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id && (i.customId === 'back' || i.customId === 'next')) {
        return i.reply({ content: "This isn't your pack to page through!", ephemeral: true });
      }

      if (i.customId === 'next') {
        currentIndex = (currentIndex + 1) % pageData.length; 
        await i.update(generateUI(currentIndex, false, `${timeLeft}s`));
      } else if (i.customId === 'back') {
        currentIndex = (currentIndex - 1 + pageData.length) % pageData.length; 
        await i.update(generateUI(currentIndex, false, `${timeLeft}s`));
      } else if (i.customId === 'claim_page') {
        const page = pageData[currentIndex];
        if (db.isClaimed(page.title)) return i.reply({ content: 'Someone sniped this page while you were reading!', ephemeral: true });

        db.claimPage(i.user.id, page.title, page.url, page.rarity, page.value);
        packClaimed = true; 
        clearInterval(timerInterval);
        
        await i.update(generateUI(currentIndex, true, 'Claimed')); 
        await i.followUp({ content: `🎉 **${i.user.username}** successfully claimed **${page.title}**!` });
        collector.stop();
      } else if (i.customId === 'claim_lexicon') {
        const page = pageData[currentIndex];
        const lexiconDrop = page.lexiconDrop;
        
        let multiplier = lexiconDrop.mult;
        if (multiplier === 'random') multiplier = (Math.random() * 19.9) + 0.1;
        const payout = Math.max(1, Math.floor(page.value * multiplier));
        
        db.addMoney(i.user.id, payout);
        packClaimed = true; 
        clearInterval(timerInterval);
        
        await i.update(generateUI(currentIndex, true, 'Claimed'));
        await i.followUp({ content: `**${i.user.username}** claimed the ${lexiconDrop.emoji} **${lexiconDrop.name} Lexicon** off **${page.title}** and earned **${payout} Lexicons**!` });
        collector.stop();
      }
    });

    collector.on('end', async (collected, reason) => {
      clearInterval(timerInterval);
      if (reason === 'time' && !packClaimed) {
        await interaction.editReply(generateUI(currentIndex, true, 'Expired')).catch(() => null);
      }
    });
  }
});

client.login(process.env.DISCORD_TOKEN);