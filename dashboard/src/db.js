import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'dashboard.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    guild_id TEXT,
    guild_name TEXT,
    channel_id TEXT,
    channel_name TEXT,
    user_id TEXT,
    user_tag TEXT,
    actor_id TEXT,
    actor_tag TEXT,
    reason TEXT,
    content TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    source TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events (type);
  CREATE INDEX IF NOT EXISTS idx_errors_created_at ON errors (created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at);
`);

const insertEventStmt = db.prepare(`
  INSERT INTO events
    (type, guild_id, guild_name, channel_id, channel_name, user_id, user_tag,
     actor_id, actor_tag, reason, content, metadata, created_at)
  VALUES
    (@type, @guild_id, @guild_name, @channel_id, @channel_name, @user_id, @user_tag,
     @actor_id, @actor_tag, @reason, @content, @metadata, COALESCE(@created_at, datetime('now')))
`);

const insertErrorStmt = db.prepare(`
  INSERT INTO errors (source, message, stack, created_at)
  VALUES (@source, @message, @stack, COALESCE(@created_at, datetime('now')))
`);

const insertLogStmt = db.prepare(`
  INSERT INTO logs (level, source, message, created_at)
  VALUES (@level, @source, @message, COALESCE(@created_at, datetime('now')))
`);

function normalizeEvent(event) {
  const meta = event.metadata && typeof event.metadata === 'object'
    ? JSON.stringify(event.metadata)
    : (event.metadata ?? null);
  return {
    type: event.type,
    guild_id: event.guild_id ?? null,
    guild_name: event.guild_name ?? null,
    channel_id: event.channel_id ?? null,
    channel_name: event.channel_name ?? null,
    user_id: event.user_id ?? null,
    user_tag: event.user_tag ?? null,
    actor_id: event.actor_id ?? null,
    actor_tag: event.actor_tag ?? null,
    reason: event.reason ?? null,
    content: event.content ?? null,
    metadata: meta,
    created_at: event.created_at ?? null,
  };
}

export function insertEvent(event) {
  const info = insertEventStmt.run(normalizeEvent(event));
  return getEventById(info.lastInsertRowid);
}

export function insertError(error) {
  const row = {
    source: error.source ?? 'app',
    message: error.message ?? String(error),
    stack: error.stack ?? null,
    created_at: error.created_at ?? null,
  };
  const info = insertErrorStmt.run(row);
  return db.prepare('SELECT * FROM errors WHERE id = ?').get(info.lastInsertRowid);
}

export function insertLog(log) {
  const row = {
    level: log.level ?? 'info',
    source: log.source ?? 'app',
    message: log.message ?? '',
    created_at: log.created_at ?? null,
  };
  const info = insertLogStmt.run(row);
  return db.prepare('SELECT * FROM logs WHERE id = ?').get(info.lastInsertRowid);
}

export function getEventById(id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

export function getEvents({ type, limit = 100, offset = 0 } = {}) {
  if (type && type !== 'all') {
    return db.prepare(
      'SELECT * FROM events WHERE type = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(type, limit, offset);
  }
  return db.prepare(
    'SELECT * FROM events ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

export function getErrors({ limit = 100, offset = 0 } = {}) {
  return db.prepare(
    'SELECT * FROM errors ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

export function getLogs({ level, limit = 200, offset = 0 } = {}) {
  if (level && level !== 'all') {
    return db.prepare(
      'SELECT * FROM logs WHERE level = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(level, limit, offset);
  }
  return db.prepare(
    'SELECT * FROM logs ORDER BY id DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

export function getStats() {
  const countByType = db.prepare(
    'SELECT type, COUNT(*) AS count FROM events GROUP BY type'
  ).all();
  const totals = Object.fromEntries(countByType.map((r) => [r.type, r.count]));

  const totalEvents = db.prepare('SELECT COUNT(*) AS c FROM events').get().c;
  const totalErrors = db.prepare('SELECT COUNT(*) AS c FROM errors').get().c;
  const totalLogs = db.prepare('SELECT COUNT(*) AS c FROM logs').get().c;
  const last24h = db.prepare(
    "SELECT COUNT(*) AS c FROM events WHERE created_at >= datetime('now', '-1 day')"
  ).get().c;

  return {
    totalEvents,
    totalErrors,
    totalLogs,
    last24h,
    bans: totals.ban_add ?? 0,
    unbans: totals.ban_remove ?? 0,
    kicks: totals.kick ?? 0,
    leaves: totals.member_leave ?? 0,
    joins: totals.member_join ?? 0,
    messageDeletes: totals.message_delete ?? 0,
    messageEdits: totals.message_edit ?? 0,
    timeouts: totals.timeout ?? 0,
    byType: totals,
  };
}

export function getActivitySeries(days = 7) {
  return db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM events
    WHERE created_at >= datetime('now', ?)
    GROUP BY day
    ORDER BY day ASC
  `).all(`-${days} day`);
}

export function countAll() {
  return {
    events: db.prepare('SELECT COUNT(*) AS c FROM events').get().c,
    errors: db.prepare('SELECT COUNT(*) AS c FROM errors').get().c,
    logs: db.prepare('SELECT COUNT(*) AS c FROM logs').get().c,
  };
}

export default db;
