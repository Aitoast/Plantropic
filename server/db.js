import Database from "better-sqlite3";
const db = new Database("scheduler.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       TEXT PRIMARY KEY,
    email    TEXT UNIQUE NOT NULL,
    pw_hash  TEXT NOT NULL,
    created  INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id),
    cal      TEXT NOT NULL,
    title    TEXT NOT NULL,
    day      INTEGER NOT NULL,
    start    REAL NOT NULL,
    end      REAL NOT NULL,
    loc      TEXT,
    descr    TEXT,
    updated  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
`);
export default db;