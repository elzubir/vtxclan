import crypto from 'node:crypto';
import { config } from '../config.js';

const COOKIE_NAME = 'vtx_session';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function sign(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}

// Issue a tamper-proof session token: "<issuedAt>.<hmac>"
export function createSessionToken() {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

function isValidToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) return false;
  const expected = sign(issuedAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Date.now() - Number(issuedAt) < MAX_AGE_MS;
}

export function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

export function isAuthenticated(req) {
  return isValidToken(req.cookies?.[COOKIE_NAME]);
}

// Constant-time password check.
export function checkPassword(password) {
  if (typeof password !== 'string') return false;
  const a = Buffer.from(password);
  const b = Buffer.from(config.dashboardPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Gate API routes.
export function requireApiAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// Gate page routes (redirect to login).
export function requirePage(req, res, next) {
  if (isAuthenticated(req)) return next();
  return res.redirect('/login');
}
