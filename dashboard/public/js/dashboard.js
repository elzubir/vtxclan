/* global io */

const state = {
  eventFilter: 'all',
  logFilter: 'all',
};

const EVENT_LABELS = {
  ban_add: 'BAN',
  ban_remove: 'UNBAN',
  kick: 'KICK',
  member_join: 'JOIN',
  member_leave: 'LEAVE',
  message_delete: 'DELETE',
  message_bulk_delete: 'BULK DEL',
  message_edit: 'EDIT',
  timeout: 'TIMEOUT',
};

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  // SQLite stores UTC "YYYY-MM-DD HH:MM:SS"
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function api(path) {
  const res = await fetch(path);
  if (res.status === 401) {
    window.location.href = '/login';
    return null;
  }
  return res.json();
}

/* ---------- Stat cards ---------- */
function renderStats(s) {
  const cards = [
    { label: 'Total Events', value: s.totalEvents, icon: '📊' },
    { label: 'Last 24h', value: s.last24h, icon: '⚡', cls: 'pink' },
    { label: 'Bans', value: s.bans, icon: '🔨', cls: 'bad' },
    { label: 'Kicks', value: s.kicks, icon: '👢', cls: 'bad' },
    { label: 'Msg Deleted', value: s.messageDeletes, icon: '🗑️' },
    { label: 'Msg Edited', value: s.messageEdits, icon: '✏️' },
    { label: 'Joins', value: s.joins, icon: '➕', cls: 'good' },
    { label: 'Timeouts', value: s.timeouts, icon: '⏳' },
    { label: 'Errors', value: s.totalErrors, icon: '🚨', cls: s.totalErrors ? 'bad' : 'good' },
  ];
  document.getElementById('stats-grid').innerHTML = cards.map((c) => `
    <div class="stat-card">
      <div class="icon">${c.icon}</div>
      <div class="label">${c.label}</div>
      <div class="value ${c.cls || ''}">${c.value ?? 0}</div>
    </div>`).join('');
}

function setBotStatus(status) {
  const dot = document.getElementById('bot-dot');
  const txt = document.getElementById('bot-status');
  dot.className = `dot ${status}`;
  const labels = {
    connected: 'bot connected',
    demo: 'demo mode (no token)',
    connecting: 'bot connecting…',
    error: 'bot error',
  };
  txt.textContent = labels[status] || status;
}

/* ---------- Activity chart ---------- */
function renderChart(series) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const map = Object.fromEntries((series || []).map((r) => [r.day, r.count]));
  const max = Math.max(1, ...days.map((d) => map[d] || 0));
  document.getElementById('chart').innerHTML = days.map((d) => {
    const v = map[d] || 0;
    const h = Math.round((v / max) * 100);
    const label = new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short' });
    return `<div class="bar-col">
        <span class="bar-val">${v}</span>
        <div class="bar-track"><div class="bar" style="height:${h}%"></div></div>
        <span class="bar-label">${label}</span>
      </div>`;
  }).join('');
}

/* ---------- Event feed ---------- */
function eventRow(e) {
  const label = EVENT_LABELS[e.type] || e.type.toUpperCase();
  let title = '';
  switch (e.type) {
    case 'ban_add': title = `<b>${esc(e.user_tag)}</b> was banned`; break;
    case 'ban_remove': title = `<b>${esc(e.user_tag)}</b> was unbanned`; break;
    case 'kick': title = `<b>${esc(e.user_tag)}</b> was kicked`; break;
    case 'member_join': title = `<b>${esc(e.user_tag)}</b> joined the server`; break;
    case 'member_leave': title = `<b>${esc(e.user_tag)}</b> left the server`; break;
    case 'message_delete': title = `Message from <b>${esc(e.user_tag)}</b> deleted`; break;
    case 'message_bulk_delete': title = `${esc(e.content)}`; break;
    case 'message_edit': title = `<b>${esc(e.user_tag)}</b> edited a message`; break;
    case 'timeout': title = `<b>${esc(e.user_tag)}</b> was timed out`; break;
    default: title = esc(e.type);
  }
  const metaParts = [];
  if (e.channel_name) metaParts.push(`#${esc(e.channel_name)}`);
  if (e.actor_tag) metaParts.push(`by ${esc(e.actor_tag)}`);
  if (e.reason) metaParts.push(`reason: ${esc(e.reason)}`);
  if (e.content && (e.type === 'message_delete' || e.type === 'message_edit')) {
    metaParts.push(`“${esc(e.content)}”`);
  }
  return `<div class="row">
      <span class="badge ${e.type}">${label}</span>
      <div class="main">
        <div class="title">${title}</div>
        ${metaParts.length ? `<div class="meta">${metaParts.join(' · ')}</div>` : ''}
      </div>
      <span class="time">${timeAgo(e.created_at)}</span>
    </div>`;
}

async function loadEvents() {
  const data = await api(`/api/events?type=${state.eventFilter}&limit=100`);
  if (!data) return;
  const body = document.getElementById('events-body');
  body.innerHTML = data.length
    ? data.map(eventRow).join('')
    : '<div class="empty">No events yet.</div>';
}

function prependEvent(e) {
  if (state.eventFilter !== 'all' && e.type !== state.eventFilter) return;
  const body = document.getElementById('events-body');
  const empty = body.querySelector('.empty');
  if (empty) empty.remove();
  body.insertAdjacentHTML('afterbegin', eventRow(e));
}

/* ---------- Errors ---------- */
async function loadErrors() {
  const data = await api('/api/errors?limit=50');
  if (!data) return;
  document.getElementById('errors-count').textContent = `${data.length} shown`;
  const body = document.getElementById('errors-body');
  body.innerHTML = data.length
    ? data.map((er) => `
      <details class="err">
        <summary>[${esc(er.source)}] ${esc(er.message)} <span class="time">${timeAgo(er.created_at)}</span></summary>
        ${er.stack ? `<pre>${esc(er.stack)}</pre>` : ''}
      </details>`).join('')
    : '<div class="empty">No errors logged. 🎉</div>';
}

/* ---------- Logs ---------- */
function logRow(l) {
  return `<div class="row">
      <span class="badge"><span class="lvl ${esc(l.level)}">${esc(l.level.toUpperCase())}</span></span>
      <div class="main">
        <div class="title">${esc(l.message)}</div>
        <div class="meta mono">${esc(l.source)}</div>
      </div>
      <span class="time">${timeAgo(l.created_at)}</span>
    </div>`;
}

async function loadLogs() {
  const data = await api(`/api/logs?level=${state.logFilter}&limit=200`);
  if (!data) return;
  const body = document.getElementById('logs-body');
  body.innerHTML = data.length
    ? data.map(logRow).join('')
    : '<div class="empty">No logs.</div>';
}

async function loadStats() {
  const s = await api('/api/stats');
  if (!s) return;
  renderStats(s);
  renderChart(s.activity);
  setBotStatus(s.botStatus);
}

/* ---------- Filters ---------- */
document.getElementById('event-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  state.eventFilter = btn.dataset.type;
  document.querySelectorAll('#event-filters .chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  loadEvents();
});

document.getElementById('log-filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  state.logFilter = btn.dataset.level;
  document.querySelectorAll('#log-filters .chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  loadLogs();
});

document.getElementById('logout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
});

/* ---------- Realtime ---------- */
function initSocket() {
  const socket = io();
  const liveDot = document.getElementById('live-dot');
  socket.on('connect', () => { liveDot.className = 'dot connected'; });
  socket.on('disconnect', () => { liveDot.className = 'dot error'; });

  socket.on('event', (e) => {
    prependEvent(e);
    loadStats();
  });
  socket.on('error', () => { loadErrors(); loadStats(); });
  socket.on('log', (l) => {
    if (state.logFilter === 'all' || state.logFilter === l.level) {
      const body = document.getElementById('logs-body');
      const empty = body.querySelector('.empty');
      if (empty) empty.remove();
      body.insertAdjacentHTML('afterbegin', logRow(l));
    }
  });
  socket.on('status', (s) => { if (s.discord) setBotStatus(s.discord); });
}

/* ---------- Init ---------- */
loadStats();
loadEvents();
loadErrors();
loadLogs();
initSocket();
setInterval(loadStats, 30000);
