require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  REST, 
  Routes 
} = require('discord.js');
const db = require('./database');
const { getRandomWikiPage } = require('./wikiService');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  { name: 'roll', description: 'Discover and claim a random Wikipedia article!' },
  { name: 'balance', description: 'Check your current WikiCoin balance.' },
  { name: 'dex', description: 'Browse your personal WikiDex library.' }
];

// Lexicon Loot Table - 'weight' determines how often it spawns
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
  { name: 'Black', emoji: '<:Dark_Lexicon:1513505715099013250>', mult: 'random', weight: 5 } // Random multiplier
];

// Helper function to pick a Lexicon based on their weights
function getRandomLexicon() {
  const totalWeight = lexicons.reduce((sum, lex) => sum + lex.weight, 0);
  let randomNum = Math.random() * totalWeight;
  for (const lex of lexicons) {
    if (randomNum < lex.weight) return lex;
    randomNum -= lex.weight;
  }
  return lexicons[0]; // Fallback
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register commands with Discord
(async () => {
  try {
    console.log('Deploying WikiDex slash commands...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('WikiDex commands successfully deployed globally.');
  } catch (error) {
    console.error('Error deploying slash commands:', error);
  }
})();

client.once('ready', () => {
  console.log(`⚡ WikiDex is online! Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;
  db.getUser(user.id); // Seed user into database if new

 if (commandName === 'balance') {
        const userData = db.getUser(user.id);
        // Updated to Lexicons
        return interaction.reply(`🪙 **${user.username}**, you currently possess **${userData.balance} Lexicons**.`);
      }

  if (commandName === 'dex') {
    const inventory = db.getInventory(user.id);
    if (inventory.length === 0) {
      return interaction.reply("Your WikiDex is completely empty! Run `/roll` to start collecting knowledge.");
    }
    
    const list = inventory.map(item => `• [${item.wikiTitle}](${item.wikiUrl}) — *${item.rarity}*`).join('\n');
    
    const embed = new EmbedBuilder()
      .setTitle(`📖 ${user.username}'s Personal WikiDex`)
      .setColor('#ffffff')
      .setDescription(list.length > 2000 ? list.substring(0, 1950) + '\n*...and more entries!*' : list)
      .setFooter({ text: `Total Articles Claimed: ${inventory.length}` });

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'roll') {
        const userData = db.getUser(user.id);
        const now = Date.now();

        // 1. CHECK ROLL COOLDOWN (Resets to 10 rolls every 1 hour)
        if (now > userData.nextRollReset) {
          userData.rollsLeft = 10; // Give them 10 rolls
          userData.nextRollReset = now + (60 * 60 * 1000); // 1 hour from now in milliseconds
          db.resetRolls(user.id, userData.rollsLeft, userData.nextRollReset);
        }

        // 2. BLOCK IF OUT OF ROLLS
        if (userData.rollsLeft <= 0) {
          const timeLeft = Math.ceil((userData.nextRollReset - now) / 60000);
          return interaction.reply(`⏳ You are out of rolls! The archives are recharging. Please wait **${timeLeft} minutes**.`);
        }

        // 3. PROCEED WITH ROLL
        await interaction.deferReply();
        db.useRoll(user.id); // Deduct 1 roll
        const rollsRemaining = userData.rollsLeft - 1; // For display purposes

        const page = await getRandomWikiPage();
        if (!page) return interaction.editReply('The library archives are jammed. Try rolling again!');

        const alreadyClaimed = db.isClaimed(page.title);
        const colors = { 'Legendary': '#ffd700', 'Epic': '#a335ee', 'Rare': '#0070dd', 'Common': '#cccccc' };

        const embed = new EmbedBuilder()
          .setTitle(page.title)
          .setURL(page.url)
          .setDescription(page.description.length > 400 ? page.description.substring(0, 395) + '...' : page.description)
          .setColor(colors[page.rarity] || '#ffffff')
          .addFields(
            { name: '✨ Rarity', value: page.rarity, inline: true },
            { name: '🪙 Value', value: `${page.value} Lexicons`, inline: true }, // Updated to Lexicons
            { name: '🔒 Status', value: alreadyClaimed ? `Claimed by <@${alreadyClaimed.userId}>` : 'Available!', inline: true }
          )
          .setFooter({ text: `${user.username} has ${rollsRemaining} rolls left this hour.` }); // Added roll tracker

        if (page.imageUrl) embed.setThumbnail(page.imageUrl);

 if (alreadyClaimed) {
          // Pick a random Lexicon drop based on weights
          const lexiconDrop = getRandomLexicon();
          
          const lexiconButton = new ButtonBuilder()
            .setCustomId('claim_lexicon')
            .setEmoji(lexiconDrop.emoji)
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder().addComponents(lexiconButton);
          const response = await interaction.editReply({ embeds: [embed], components: [row] });

          const collector = response.createMessageComponentCollector({ time: 30000 });

          collector.on('collect', async i => {
            if (i.customId === 'claim_lexicon') {
              // Calculate payout based on the page's base value and the Lexicon's multiplier
              let multiplier = lexiconDrop.mult;
              
              // If it's a Black Lexicon, assign a random multiplier between 0.1x and 20.0x
              if (multiplier === 'random') {
                multiplier = (Math.random() * 19.9) + 0.1;
              }

              // Floor the payout so we don't get decimal WikiCoins, ensure at least 1 WC payout
              const payout = Math.max(1, Math.floor(page.value * multiplier));
              
              // Add the money to the user who clicked the button
              db.addMoney(i.user.id, payout);

              // Remove the button from the original message to prevent double-claiming
              await interaction.editReply({ components: [] });

              // Announce the claim in the channel
              await i.reply({ 
                content: `**${i.user.username}** claimed the ${lexiconDrop.emoji} **${lexiconDrop.name} Lexicon** and earned **${payout} WikiCoins**!` 
              });
              
              collector.stop();
            }
          });

          collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
              await interaction.editReply({ components: [] }).catch(() => null);
            }
          });

          return; // Stop execution here so it doesn't run the normal "Claim Article" code below
        }

    const claimButton = new ButtonBuilder()
          .setCustomId('claim_page')
          .setLabel('Claim Article!')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(claimButton);
        const response = await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ time: 30000 });

        collector.on('collect', async i => {
          if (i.customId === 'claim_page') {
            if (db.isClaimed(page.title)) {
              return i.reply({ content: 'Too slow! Someone else claimed this piece of history.', ephemeral: true });
            }

            db.claimPage(i.user.id, page.title, page.url, page.rarity, page.value);
            
            embed.setFields(
              { name: '✨ Rarity', value: page.rarity, inline: true },
              { name: '🪙 Value', value: `${page.value} Lexicons`, inline: true }, // Updated to Lexicons
              { name: '🔒 Status', value: `Claimed by ${i.user.username}!`, inline: true }
            );

            await i.update({ embeds: [embed], components: [] });
            collector.stop();
          }
        });

        collector.on('end', async (collected, reason) => {
          if (reason === 'time') {
            await interaction.editReply({ components: [] }).catch(() => null);
          }
        });
      }
})
client.login(process.env.DISCORD_TOKEN);