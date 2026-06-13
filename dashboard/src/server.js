import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';

import { config, PUBLIC_DIR } from './config.js';
import { logger, installProcessHandlers } from './logger.js';
import { bus, CHANNELS } from './bus.js';
import { requirePage, isAuthenticated } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { startBot } from './bot.js';
import { seed } from './seed.js';
import { countAll } from './db.js';

installProcessHandlers();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server);

app.use(express.json());
app.use(cookieParser(config.sessionSecret));

// Public assets (login page, css, js, socket.io client).
app.use('/css', express.static(path.join(PUBLIC_DIR, 'css')));
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js')));

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/', requirePage, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// --- Realtime: relay bus events to authenticated socket clients ---
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const token = Object.fromEntries(
    cookieHeader.split(';').map((c) => c.trim().split('=').map(decodeURIComponent)),
  ).vtx_session;
  if (isAuthenticated({ cookies: { vtx_session: token } })) return next();
  return next(new Error('unauthorized'));
});

io.on('connection', (socket) => {
  logger.debug('Dashboard client connected via websocket', 'ws');
  socket.on('disconnect', () => logger.debug('Dashboard client disconnected', 'ws'));
});

for (const channel of Object.values(CHANNELS)) {
  bus.on(channel, (payload) => io.emit(channel, payload));
}

function start() {
  if (config.seedOnStart) {
    const counts = countAll();
    if (counts.events === 0) {
      seed();
      logger.info('Inserted demo data (database was empty).', 'app');
    }
  }

  server.listen(config.port, () => {
    logger.info(`Dashboard server started on port ${config.port}`, 'app');
  });

  startBot();
}

start();

export { app, server };
