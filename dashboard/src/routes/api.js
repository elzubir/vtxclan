import express from 'express';
import {
  getEvents,
  getErrors,
  getLogs,
  getStats,
  getActivitySeries,
} from '../db.js';
import { requireApiAuth } from '../middleware/auth.js';
import { getBotStatus } from '../bot.js';
import { config } from '../config.js';
import { recordEvent } from '../store.js';

const router = express.Router();

router.use(requireApiAuth);

const SIMULATABLE = new Set([
  'ban_add', 'ban_remove', 'kick', 'member_join', 'member_leave',
  'message_delete', 'message_bulk_delete', 'message_edit', 'timeout',
]);

// Simulate a moderation event to verify dashboard wiring (realtime + storage).
// Disabled unless ALLOW_SIMULATE=true so it never runs in production by default.
router.post('/simulate', (req, res) => {
  if (!config.allowSimulate) {
    return res.status(403).json({ error: 'Simulation disabled. Set ALLOW_SIMULATE=true to enable.' });
  }
  const type = SIMULATABLE.has(req.body?.type) ? req.body.type : 'ban_add';
  const saved = recordEvent({
    type,
    guild_name: req.body?.guild_name || 'VTX Clan',
    user_tag: req.body?.user_tag || 'SimulatedUser#0000',
    actor_tag: req.body?.actor_tag || 'Dashboard Simulator',
    channel_name: req.body?.channel_name || null,
    reason: req.body?.reason || 'Simulated event (wiring test)',
    content: req.body?.content || null,
  });
  return res.json({ ok: true, saved });
});

function clampLimit(value, fallback, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

router.get('/stats', (req, res) => {
  res.json({
    ...getStats(),
    botStatus: getBotStatus(),
    activity: getActivitySeries(7),
  });
});

router.get('/events', (req, res) => {
  const limit = clampLimit(req.query.limit, 100);
  const offset = clampLimit(req.query.offset, 0, 100000) || 0;
  res.json(getEvents({ type: req.query.type, limit, offset }));
});

router.get('/errors', (req, res) => {
  const limit = clampLimit(req.query.limit, 100);
  const offset = clampLimit(req.query.offset, 0, 100000) || 0;
  res.json(getErrors({ limit, offset }));
});

router.get('/logs', (req, res) => {
  const limit = clampLimit(req.query.limit, 200);
  const offset = clampLimit(req.query.offset, 0, 100000) || 0;
  res.json(getLogs({ level: req.query.level, limit, offset }));
});

export default router;
