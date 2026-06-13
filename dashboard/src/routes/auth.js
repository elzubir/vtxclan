import express from 'express';
import {
  checkPassword,
  setSessionCookie,
  clearSessionCookie,
  isAuthenticated,
} from '../middleware/auth.js';
import { logger } from '../logger.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body ?? {};
  if (checkPassword(password)) {
    setSessionCookie(res);
    logger.info('Dashboard login successful', 'auth');
    return res.json({ ok: true });
  }
  logger.warn('Failed dashboard login attempt', 'auth');
  return res.status(401).json({ ok: false, error: 'Invalid password' });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

export default router;
