const Database = require('better-sqlite3');
const db = new Database('economy.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 500,
    energy INTEGER DEFAULT 3,
    enhancedSlots INTEGER DEFAULT 0,
    wishCapacity INTEGER DEFAULT 4,
    lastPackUpdate INTEGER DEFAULT 0,
    lastEnergyUpdate INTEGER DEFAULT 0,
    lastDaily INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT, wikiTitle TEXT, wikiUrl TEXT, imageUrl TEXT, description TEXT,
    rarity TEXT, value INTEGER, quality REAL, FOREIGN KEY(userId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, packType TEXT, FOREIGN KEY(userId) REFERENCES users(userId)
  );

  CREATE TABLE IF NOT EXISTS wishes (
    userId TEXT, wikiTitle TEXT, isEnhanced INTEGER DEFAULT 0, PRIMARY KEY(userId, wikiTitle), FOREIGN KEY(userId) REFERENCES users(userId)
  );
`);

module.exports = {
  getUser: (userId) => {
    let user = db.prepare('SELECT * FROM users WHERE userId = ?').get(userId);
    if (!user) {
      const now = Date.now();
      db.prepare('INSERT INTO users (userId, lastPackUpdate, lastEnergyUpdate, lastDaily, enhancedSlots, wishCapacity) VALUES (?, ?, ?, 0, 0, 4)').run(userId, now, now);
      user = { userId, balance: 500, energy: 3, enhancedSlots: 0, wishCapacity: 4, lastPackUpdate: now, lastEnergyUpdate: now, lastDaily: 0 };
    }
    return user;
  },
  addMoney: (userId, amount) => db.prepare('UPDATE users SET balance = balance + ? WHERE userId = ?').run(amount, userId),
  removeMoney: (userId, amount) => db.prepare('UPDATE users SET balance = balance - ? WHERE userId = ?').run(amount, userId),
  useEnergy: (userId, amount) => db.prepare('UPDATE users SET energy = energy - ? WHERE userId = ?').run(amount, userId),
  addEnergy: (userId, amount) => db.prepare('UPDATE users SET energy = energy + ? WHERE userId = ?').run(amount, userId),
  setLastEnergyUpdate: (userId, time) => db.prepare('UPDATE users SET lastEnergyUpdate = ? WHERE userId = ?').run(time, userId),

  claimPage: (userId, title, url, imageUrl, description, rarity, value, quality) => {
    db.prepare('INSERT INTO inventory (userId, wikiTitle, wikiUrl, imageUrl, description, rarity, value, quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(userId, title, url, imageUrl, description, rarity, value, quality);
  },
  getInventory: (userId) => db.prepare('SELECT * FROM inventory WHERE userId = ?').all(userId),
  isClaimed: (title) => db.prepare('SELECT * FROM inventory WHERE wikiTitle = ? COLLATE NOCASE').get(title),
  divorcePage: (userId, title) => db.prepare('DELETE FROM inventory WHERE userId = ? AND wikiTitle = ? COLLATE NOCASE').run(userId, title),
  
  addPack: (userId, packType) => db.prepare('INSERT INTO packs (userId, packType) VALUES (?, ?)').run(userId, packType),
  getPacks: (userId) => db.prepare('SELECT * FROM packs WHERE userId = ? ORDER BY id ASC').all(userId),
  removePackByType: (userId, type) => {
    const pack = db.prepare('SELECT id FROM packs WHERE userId = ? AND packType = ? LIMIT 1').get(userId, type);
    if (pack) db.prepare('DELETE FROM packs WHERE id = ?').run(pack.id);
  },
  setLastPackUpdate: (userId, time) => db.prepare('UPDATE users SET lastPackUpdate = ? WHERE userId = ?').run(time, userId),
  setDaily: (userId, time) => db.prepare('UPDATE users SET lastDaily = ? WHERE userId = ?').run(time, userId),
  
  addWish: (userId, title) => db.prepare('INSERT OR IGNORE INTO wishes (userId, wikiTitle) VALUES (?, ?)').run(userId, title),
  removeWish: (userId, title) => db.prepare('DELETE FROM wishes WHERE userId = ? AND wikiTitle = ? COLLATE NOCASE').run(userId, title),
  getWishes: (userId) => db.prepare('SELECT * FROM wishes WHERE userId = ?').all(userId),
  checkWishedBy: (title) => db.prepare('SELECT userId FROM wishes WHERE wikiTitle = ? COLLATE NOCASE').all(title),
  
  // Trades Wish Capacity for Enhanced Slots
  upgradeWishSlot: (userId, cost) => db.prepare('UPDATE users SET enhancedSlots = enhancedSlots + 1, wishCapacity = wishCapacity - ? WHERE userId = ?').run(cost, userId),
  enhanceWish: (userId, title, state) => db.prepare('UPDATE wishes SET isEnhanced = ? WHERE userId = ? AND wikiTitle = ? COLLATE NOCASE').run(state, userId, title),

  getTopBalances: () => db.prepare('SELECT userId, balance FROM users ORDER BY balance DESC LIMIT 10').all()
};