const Database = require('better-sqlite3');
const db = new Database('economy.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 500,
    packsLeft INTEGER DEFAULT 1,
    nextPackReset INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    wikiTitle TEXT,
    wikiUrl TEXT,
    rarity TEXT,
    value INTEGER,
    FOREIGN KEY(userId) REFERENCES users(userId)
  );
`);

module.exports = {
  getUser: (userId) => {
    let user = db.prepare('SELECT * FROM users WHERE userId = ?').get(userId);
    if (!user) {
      // Defaults to 1 pack per hour now
      db.prepare('INSERT INTO users (userId, packsLeft, nextPackReset) VALUES (?, 1, 0)').run(userId);
      user = { userId, balance: 500, packsLeft: 1, nextPackReset: 0 };
    }
    return user;
  },
  addMoney: (userId, amount) => {
    db.prepare('UPDATE users SET balance = balance + ? WHERE userId = ?').run(amount, userId);
  },
  removeMoney: (userId, amount) => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE userId = ?').run(amount, userId);
  },
  claimPage: (userId, title, url, rarity, value) => {
    db.prepare('INSERT INTO inventory (userId, wikiTitle, wikiUrl, rarity, value) VALUES (?, ?, ?, ?, ?)')
      .run(userId, title, url, rarity, value);
  },
  getInventory: (userId) => {
    return db.prepare('SELECT * FROM inventory WHERE userId = ?').all(userId);
  },
  isClaimed: (title) => {
    return db.prepare('SELECT * FROM inventory WHERE wikiTitle = ? COLLATE NOCASE').get(title);
  },
  divorcePage: (userId, title) => {
    db.prepare('DELETE FROM inventory WHERE userId = ? AND wikiTitle = ? COLLATE NOCASE').run(userId, title);
  },
  transferPage: (fromUserId, toUserId, title) => {
    db.prepare('UPDATE inventory SET userId = ? WHERE userId = ? AND wikiTitle = ? COLLATE NOCASE').run(toUserId, fromUserId, title);
  },
  usePack: (userId, amount) => {
    db.prepare('UPDATE users SET packsLeft = packsLeft - ? WHERE userId = ?').run(amount, userId);
  },
  resetPacks: (userId, amount, resetTime) => {
    db.prepare('UPDATE users SET packsLeft = ?, nextPackReset = ? WHERE userId = ?').run(amount, resetTime, userId);
  }
};