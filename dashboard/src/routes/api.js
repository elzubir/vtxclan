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

const router = express.Router();

router.use(requireApiAuth);

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
