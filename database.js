const Database = require('better-sqlite3');
const db = new Database('economy.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 500,
    rollsLeft INTEGER DEFAULT 10,
    nextRollReset INTEGER DEFAULT 0
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
      db.prepare('INSERT INTO users (userId, rollsLeft, nextRollReset) VALUES (?, 10, 0)').run(userId);
      user = { userId, balance: 500, rollsLeft: 10, nextRollReset: 0 };
    }
    return user;
  },
  addMoney: (userId, amount) => {
    db.prepare('UPDATE users SET balance = balance + ? WHERE userId = ?').run(amount, userId);
  },
  claimPage: (userId, title, url, rarity, value) => {
    db.prepare('INSERT INTO inventory (userId, wikiTitle, wikiUrl, rarity, value) VALUES (?, ?, ?, ?, ?)')
      .run(userId, title, url, rarity, value);
  },
  getInventory: (userId) => {
    return db.prepare('SELECT * FROM inventory WHERE userId = ?').all(userId);
  },
  isClaimed: (title) => {
    return db.prepare('SELECT * FROM inventory WHERE wikiTitle = ?').get(title);
  },
  useRoll: (userId) => {
    db.prepare('UPDATE users SET rollsLeft = rollsLeft - 1 WHERE userId = ?').run(userId);
  },
  resetRolls: (userId, amount, resetTime) => {
    db.prepare('UPDATE users SET rollsLeft = ?, nextRollReset = ? WHERE userId = ?').run(amount, resetTime, userId);
  }
};