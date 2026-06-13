const state = {
  eventFilter: 'all',
  logFilter: 'all',
  statValues: {},
  ready: false,
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
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 5) return 'just now';
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

/* ---------- Clock ---------- */
function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour12: false });
}

/* ---------- Count-up animation ---------- */
function animateCount(el, from, to) {
  const start = performance.now();
  const dur = 700;
  function frame(now) {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- Stat cards ---------- */
function renderStats(s) {
  const cards = [
    { key: 'totalEvents', label: 'Total Events', value: s.totalEvents, icon: '📊' },
    { key: 'last24h', label: 'Last 24h', value: s.last24h, icon: '⚡', cls: 'pink' },
    { key: 'bans', label: 'Bans', value: s.bans, icon: '🔨', cls: 'bad' },
    { key: 'kicks', label: 'Kicks', value: s.kicks, icon: '👢', cls: 'bad' },
    { key: 'messageDeletes', label: 'Msg Deleted', value: s.messageDeletes, icon: '🗑️' },
    { key: 'messageEdits', label: 'Msg Edited', value: s.messageEdits, icon: '✏️' },
    { key: 'joins', label: 'Joins', value: s.joins, icon: '➕', cls: 'good' },
    { key: 'timeouts', label: 'Timeouts', value: s.timeouts, icon: '⏳' },
    { key: 'totalErrors', label: 'Errors', value: s.totalErrors, icon: '🚨', cls: s.totalErrors ? 'bad' : 'good' },
  ];
  const grid = document.getElementById('stats-grid');

  if (!state.ready) {
    grid.innerHTML = cards.map((c, i) => `
      <div class="stat-card" style="animation-delay:${i * 60}ms">
        <div class="icon">${c.icon}</div>
        <div class="label">${c.label}</div>
        <div class="value ${c.cls || ''}" data-key="${c.key}">0</div>
      </div>`).join('');
    state.ready = true;
  }

  cards.forEach((c) => {
    const el = grid.querySelector(`[data-key="${c.key}"]`);
    if (!el) return;
    const prev = state.statValues[c.key] ?? 0;
    const next = c.value ?? 0;
    if (prev !== next) animateCount(el, prev, next);
    state.statValues[c.key] = next;
  });
}

function setBotStatus(status) {
  const dot = document.getElementById('bot-dot');
  const txt = document.getElementById('bot-status');
  dot.className = `dot ${status}`;
  const labels = {
    connected: 'bot live',
    demo: 'demo mode',
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
  const chart = document.getElementById('chart');
  chart.innerHTML = days.map((d) => {
    const v = map[d] || 0;
    const h = Math.round((v / max) * 100);
    const label = new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short' });
    return `<div class="bar-col" title="${label}: ${v} events">
        <span class="bar-val">${v}</span>
        <div class="bar-track"><div class="bar" style="height:0%" data-h="${h}"></div></div>
        <span class="bar-label">${label}</span>
      </div>`;
  }).join('');
  requestAnimationFrame(() => {
    chart.querySelectorAll('.bar').forEach((bar) => {
      bar.style.height = `${bar.dataset.h}%`;
    });
  });
}

/* ---------- Event feed ---------- */
function eventTitle(e) {
  switch (e.type) {
    case 'ban_add': return `<b>${esc(e.user_tag)}</b> was banned`;
    case 'ban_remove': return `<b>${esc(e.user_tag)}</b> was unbanned`;
    case 'kick': return `<b>${esc(e.user_tag)}</b> was kicked`;
    case 'member_join': return `<b>${esc(e.user_tag)}</b> joined the server`;
    case 'member_leave': return `<b>${esc(e.user_tag)}</b> left the server`;
    case 'message_delete': return `Message from <b>${esc(e.user_tag)}</b> deleted`;
    case 'message_bulk_delete': return `${esc(e.content)}`;
    case 'message_edit': return `<b>${esc(e.user_tag)}</b> edited a message`;
    case 'timeout': return `<b>${esc(e.user_tag)}</b> was timed out`;
    default: return esc(e.type);
  }
}

function eventRow(e, flash) {
  const label = EVENT_LABELS[e.type] || e.type.toUpperCase();
  const metaParts = [];
  if (e.channel_name) metaParts.push(`#${esc(e.channel_name)}`);
  if (e.actor_tag) metaParts.push(`by ${esc(e.actor_tag)}`);
  if (e.reason) metaParts.push(`reason: ${esc(e.reason)}`);
  if (e.content && (e.type === 'message_delete' || e.type === 'message_edit')) {
    metaParts.push(`“${esc(e.content)}”`);
  }
  return `<div class="row ${e.type} ${flash ? 'flash' : ''}">
      <span class="badge ${e.type}">${label}</span>
      <div class="main">
        <div class="title">${eventTitle(e)}</div>
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
    ? data.map((e) => eventRow(e, false)).join('')
    : '<div class="empty">No events yet.</div>';
}

function prependEvent(e) {
  if (state.eventFilter !== 'all' && e.type !== state.eventFilter) return;
  const body = document.getElementById('events-body');
  const empty = body.querySelector('.empty');
  if (empty) empty.remove();
  body.insertAdjacentHTML('afterbegin', eventRow(e, true));
}

/* ---------- Toasts ---------- */
function toast(e) {
  const labels = {
    ban_add: '🔨 Member banned',
    kick: '👢 Member kicked',
    message_delete: '🗑️ Message deleted',
    timeout: '⏳ Member timed out',
    member_join: '➕ Member joined',
    ban_remove: '✅ Member unbanned',
  };
  const head = labels[e.type];
  if (!head) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${head}<br><b>${esc(e.user_tag || '')}</b>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
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
        <summary><span>[${esc(er.source)}] ${esc(er.message)}</span><span class="time">${timeAgo(er.created_at)}</span></summary>
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
    toast(e);
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
tickClock();
setInterval(tickClock, 1000);
loadStats();
loadEvents();
loadErrors();
loadLogs();
initSocket();
setInterval(loadStats, 30000);
setInterval(() => { if (state.eventFilter === 'all') loadEvents(); }, 60000);
