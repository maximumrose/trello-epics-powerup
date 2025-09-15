import Database from 'better-sqlite3';
const db = new Database(process.env.SQLITE_PATH || './data.db');

db.exec(`
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  desc TEXT
);
CREATE TABLE IF NOT EXISTS theme_cards (
  theme_id INTEGER NOT NULL,
  card_id TEXT NOT NULL,
  card_name TEXT,
  card_url TEXT,
  board_id TEXT,
  board_name TEXT,
  UNIQUE(theme_id, card_id)
);
CREATE TABLE IF NOT EXISTS hierarchy (
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  UNIQUE(parent_id, child_id)
);
CREATE TABLE IF NOT EXISTS related (
  a_id TEXT NOT NULL,
  b_id TEXT NOT NULL,
  UNIQUE(a_id, b_id)
);
`);

export default db;