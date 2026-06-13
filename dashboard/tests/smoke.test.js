import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Use a throwaway data dir so tests never touch the real DB.
process.env.DATA_DIR_OVERRIDE = fs.mkdtempSync(path.join(os.tmpdir(), 'vtx-test-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.DASHBOARD_PASSWORD = 'test-pass';

const db = await import('../src/db.js');
const { createSessionToken, isAuthenticated, checkPassword } = await import('../src/middleware/auth.js');

test('events can be recorded and read back', () => {
  const before = db.countAll().events;
  db.insertEvent({ type: 'ban_add', user_tag: 'tester#1', actor_tag: 'mod#1', reason: 'spam' });
  const after = db.getEvents({ limit: 1 });
  assert.equal(db.countAll().events, before + 1);
  assert.equal(after[0].type, 'ban_add');
  assert.equal(after[0].user_tag, 'tester#1');
});

test('stats aggregate by type', () => {
  db.insertEvent({ type: 'kick', user_tag: 'kicked#1' });
  const stats = db.getStats();
  assert.ok(stats.totalEvents >= 1);
  assert.ok(stats.kicks >= 1);
});

test('errors and logs persist', () => {
  db.insertError({ source: 'test', message: 'boom', stack: 'stack' });
  db.insertLog({ level: 'warn', source: 'test', message: 'careful' });
  assert.ok(db.getErrors({ limit: 1 })[0].message === 'boom');
  assert.ok(db.getLogs({ limit: 1 })[0].message === 'careful');
});

test('session tokens validate and password check is strict', () => {
  const token = createSessionToken();
  assert.ok(isAuthenticated({ cookies: { vtx_session: token } }));
  assert.ok(!isAuthenticated({ cookies: { vtx_session: 'forged.signature' } }));
  assert.ok(checkPassword('test-pass'));
  assert.ok(!checkPassword('wrong'));
});
