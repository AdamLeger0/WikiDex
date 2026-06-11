const Database = require('better-sqlite3');
const db = new Database('economy.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    guildId TEXT, userId TEXT, balance INTEGER DEFAULT 500, energy INTEGER DEFAULT 3,
    alexandrite INTEGER DEFAULT 0, wishCapacity INTEGER DEFAULT 4,
    enhancedSlots INTEGER DEFAULT 0, towerFloors INTEGER DEFAULT 0, towerData TEXT DEFAULT '[0,0,0,0,0,0,0,0,0,0]',
    badges TEXT DEFAULT '[0,0,0,0]',
    statsPacksOpened INTEGER DEFAULT 0, statsLexiconsSpent INTEGER DEFAULT 0, 
    statsCardsClaimed INTEGER DEFAULT 0, statsCardsMelted INTEGER DEFAULT 0,
    lastPackUpdate INTEGER DEFAULT 0, lastEnergyUpdate INTEGER DEFAULT 0, lastDaily INTEGER DEFAULT 0,
    buffDailyEnd INTEGER DEFAULT 0, buffDailyMult REAL DEFAULT 1.0, buffLexiconEnd INTEGER DEFAULT 0,
    PRIMARY KEY (guildId, userId)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guildId TEXT, userId TEXT, 
    wikiTitle TEXT, wikiUrl TEXT, imageUrl TEXT, description TEXT,
    rarity TEXT, value INTEGER, quality REAL, 
    FOREIGN KEY(guildId, userId) REFERENCES users(guildId, userId)
  );

  CREATE TABLE IF NOT EXISTS packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, guildId TEXT, userId TEXT, packType TEXT, 
    FOREIGN KEY(guildId, userId) REFERENCES users(guildId, userId)
  );

  CREATE TABLE IF NOT EXISTS wishes (
    guildId TEXT, userId TEXT, wikiTitle TEXT, isEnhanced INTEGER DEFAULT 0, 
    PRIMARY KEY(guildId, userId, wikiTitle), 
    FOREIGN KEY(guildId, userId) REFERENCES users(guildId, userId)
  );
`);

function safeAddColumn(tableName, columnName, dataType) {
  const columns = db.pragma(`table_info(${tableName})`);
  const exists = columns.some(col => col.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${dataType}`);
    console.log(`[Migration] Safely injected new column '${columnName}' into '${tableName}'`);
  }
}

module.exports = {
  getUser: (guildId, userId) => {
    let user = db.prepare('SELECT * FROM users WHERE guildId = ? AND userId = ?').get(guildId, userId);
    if (!user) {
      const now = Date.now();
      db.prepare("INSERT INTO users (guildId, userId, lastPackUpdate, lastEnergyUpdate, lastDaily, wishCapacity, towerFloors, towerData, badges) VALUES (?, ?, ?, ?, 0, 4, 0, '[0,0,0,0,0,0,0,0,0,0]', '[0,0,0,0]')").run(guildId, userId, now, now);
      user = { guildId, userId, balance: 500, energy: 3, alexandrite: 0, wishCapacity: 4, towerFloors: 0, towerData: '[0,0,0,0,0,0,0,0,0,0]', badges: '[0,0,0,0]', statsPacksOpened: 0, statsLexiconsSpent: 0, statsCardsClaimed: 0, statsCardsMelted: 0, lastPackUpdate: now, lastEnergyUpdate: now, lastDaily: 0, buffDailyEnd: 0, buffDailyMult: 1.0, buffLexiconEnd: 0 };
    }
    return user;
  },
  
  addMoney: (guildId, userId, amount) => db.prepare('UPDATE users SET balance = balance + ? WHERE guildId = ? AND userId = ?').run(amount, guildId, userId),
  removeMoney: (guildId, userId, amount) => db.prepare('UPDATE users SET balance = balance - ?, statsLexiconsSpent = statsLexiconsSpent + ? WHERE guildId = ? AND userId = ?').run(amount, amount, guildId, userId),
  addAlexandrite: (guildId, userId, amount) => db.prepare('UPDATE users SET alexandrite = alexandrite + ? WHERE guildId = ? AND userId = ?').run(amount, guildId, userId),
  removeAlexandrite: (guildId, userId, amount) => db.prepare('UPDATE users SET alexandrite = alexandrite - ? WHERE guildId = ? AND userId = ?').run(amount, guildId, userId),
  useEnergy: (guildId, userId, amount) => db.prepare('UPDATE users SET energy = energy - ? WHERE guildId = ? AND userId = ?').run(amount, guildId, userId),
  addEnergy: (guildId, userId, amount) => db.prepare('UPDATE users SET energy = energy + ? WHERE guildId = ? AND userId = ?').run(amount, guildId, userId),
  setLastEnergyUpdate: (guildId, userId, time) => db.prepare('UPDATE users SET lastEnergyUpdate = ? WHERE guildId = ? AND userId = ?').run(time, guildId, userId),

  claimPage: (guildId, userId, title, url, imageUrl, description, rarity, value, quality) => {
    db.prepare('INSERT INTO inventory (guildId, userId, wikiTitle, wikiUrl, imageUrl, description, rarity, value, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(guildId, userId, title, url, imageUrl, description, rarity, value, quality);
    db.prepare('UPDATE users SET statsCardsClaimed = statsCardsClaimed + 1 WHERE guildId = ? AND userId = ?').run(guildId, userId);
  },
  getInventory: (guildId, userId) => db.prepare('SELECT * FROM inventory WHERE guildId = ? AND userId = ?').all(guildId, userId),
  isClaimed: (guildId, title) => db.prepare('SELECT * FROM inventory WHERE guildId = ? AND wikiTitle = ? COLLATE NOCASE').get(guildId, title),
  divorcePage: (guildId, userId, title) => db.prepare('DELETE FROM inventory WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(guildId, userId, title),
  
  meltPage: (guildId, userId, title, alexandriteGain) => {
    db.prepare('DELETE FROM inventory WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(guildId, userId, title);
    db.prepare('UPDATE users SET alexandrite = alexandrite + ?, statsCardsMelted = statsCardsMelted + 1 WHERE guildId = ? AND userId = ?').run(alexandriteGain, guildId, userId);
  },

  upgradeCardQuality: (guildId, userId, title, multiplier, maxTierCap) => {
    const card = db.prepare('SELECT quality FROM inventory WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').get(guildId, userId, title);
    if (card) {
      const newQ = Math.min(maxTierCap, (card.quality || 0.01) * multiplier);
      db.prepare('UPDATE inventory SET quality = ? WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(newQ, guildId, userId, title);
      return newQ;
    }
    return null;
  },
  
  setCardQuality: (guildId, userId, title, newQuality) => db.prepare('UPDATE inventory SET quality = ? WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(newQuality, guildId, userId, title),
  getRandomClaimedCards: (guildId, limit) => db.prepare('SELECT wikiTitle FROM inventory WHERE guildId = ? ORDER BY RANDOM() LIMIT ?').all(guildId, limit),
  
  addPack: (guildId, userId, packType) => db.prepare('INSERT INTO packs (guildId, userId, packType) VALUES (?, ?, ?)').run(guildId, userId, packType),
  getPacks: (guildId, userId) => db.prepare('SELECT * FROM packs WHERE guildId = ? AND userId = ? ORDER BY id ASC').all(guildId, userId),
  removePackByType: (guildId, userId, type) => {
    const pack = db.prepare('SELECT id FROM packs WHERE guildId = ? AND userId = ? AND packType = ? LIMIT 1').get(guildId, userId, type);
    if (pack) {
      db.prepare('DELETE FROM packs WHERE id = ?').run(pack.id);
      db.prepare('UPDATE users SET statsPacksOpened = statsPacksOpened + 1 WHERE guildId = ? AND userId = ?').run(guildId, userId);
    }
  },
  removePacksByTypeAmount: (guildId, userId, type, amount) => {
    const packs = db.prepare('SELECT id FROM packs WHERE guildId = ? AND userId = ? AND packType = ? LIMIT ?').all(guildId, userId, type, amount);
    if (packs.length < amount) return false;
    const ids = packs.map(p => p.id);
    db.prepare(`DELETE FROM packs WHERE id IN (${ids.join(',')})`).run();
    return true;
  },
  
  setLastPackUpdate: (guildId, userId, time) => db.prepare('UPDATE users SET lastPackUpdate = ? WHERE guildId = ? AND userId = ?').run(time, guildId, userId),
  setDaily: (guildId, userId, time) => db.prepare('UPDATE users SET lastDaily = ? WHERE guildId = ? AND userId = ?').run(time, guildId, userId),
  
  setDailyBuff: (guildId, userId, endTime, multiplier) => db.prepare('UPDATE users SET buffDailyEnd = ?, buffDailyMult = ? WHERE guildId = ? AND userId = ?').run(endTime, multiplier, guildId, userId),
  setLexiconBuff: (guildId, userId, endTime) => db.prepare('UPDATE users SET buffLexiconEnd = ? WHERE guildId = ? AND userId = ?').run(endTime, guildId, userId),
  
  addWish: (guildId, userId, title) => db.prepare('INSERT OR IGNORE INTO wishes (guildId, userId, wikiTitle) VALUES (?, ?, ?)').run(guildId, userId, title),
  removeWish: (guildId, userId, title) => db.prepare('DELETE FROM wishes WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(guildId, userId, title),
  getWishes: (guildId, userId) => db.prepare('SELECT * FROM wishes WHERE guildId = ? AND userId = ?').all(guildId, userId),
  checkWishedBy: (guildId, title) => db.prepare('SELECT userId FROM wishes WHERE guildId = ? AND wikiTitle = ? COLLATE NOCASE').all(guildId, title),
  enhanceWish: (guildId, userId, title, cost) => db.prepare('UPDATE wishes SET isEnhanced = ? WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(cost, guildId, userId, title),

  buildTowerFloor: (guildId, userId, cost, towerDataStr) => db.prepare('UPDATE users SET towerFloors = towerFloors + 1, balance = balance - ?, statsLexiconsSpent = statsLexiconsSpent + ?, towerData = ? WHERE guildId = ? AND userId = ?').run(cost, cost, towerDataStr, guildId, userId),
  destroyTower: (guildId, userId, refund) => db.prepare("UPDATE users SET towerFloors = 0, balance = balance + ?, towerData = '[0,0,0,0,0,0,0,0,0,0]' WHERE guildId = ? AND userId = ?").run(refund, guildId, userId),
  upgradeBadge: (guildId, userId, cost, badgesStr) => db.prepare('UPDATE users SET balance = balance - ?, statsLexiconsSpent = statsLexiconsSpent + ?, badges = ? WHERE guildId = ? AND userId = ?').run(cost, cost, badgesStr, guildId, userId),
  
  transferPage: (guildId, fromUserId, toUserId, title) => db.prepare('UPDATE inventory SET userId = ? WHERE guildId = ? AND userId = ? AND wikiTitle = ? COLLATE NOCASE').run(toUserId, guildId, fromUserId, title),

  getTopBalances: (guildId) => db.prepare('SELECT userId, balance FROM users WHERE guildId = ? ORDER BY balance DESC LIMIT 10').all(guildId),
  getTopLibraryValue: (guildId) => db.prepare('SELECT userId, SUM(value) as totalValue FROM inventory WHERE guildId = ? GROUP BY userId ORDER BY totalValue DESC LIMIT 10').all(guildId)
};