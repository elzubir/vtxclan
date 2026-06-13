import { insertEvent, insertError, insertLog, countAll } from './db.js';

const USERS = [
  'ShadowStrike#1042', 'NeonViper#2210', 'GhostByte#7781', 'CryoFlux#3390',
  'VortexKid#9921', 'PixelRogue#5567', 'IronHavoc#4412', 'LunarApex#8830',
  'ZeroCool#0001', 'BlazeRunner#6654',
];
const MODS = ['elzubir#0001', 'VTX-Mod#1111', 'AutoMod#0000'];
const CHANNELS = ['general', 'memes', 'clips', 'recruitment', 'voice-text'];
const REASONS = [
  'Spamming invite links', 'Toxic behaviour', 'NSFW content', 'Ban evasion',
  'Advertising', 'Breaking rule #3', 'Raid participation',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const GUILD = { id: '111111111111111111', name: 'VTX Clan' };

function isoAgo(maxDays) {
  const ms = Date.now() - Math.floor(Math.random() * maxDays * 24 * 60 * 60 * 1000);
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

const EVENT_BUILDERS = {
  ban_add: () => ({
    type: 'ban_add', user_tag: pick(USERS), actor_tag: pick(MODS), reason: pick(REASONS),
  }),
  ban_remove: () => ({ type: 'ban_remove', user_tag: pick(USERS), actor_tag: pick(MODS) }),
  kick: () => ({ type: 'kick', user_tag: pick(USERS), actor_tag: pick(MODS), reason: pick(REASONS) }),
  member_join: () => ({ type: 'member_join', user_tag: pick(USERS) }),
  member_leave: () => ({ type: 'member_leave', user_tag: pick(USERS) }),
  message_delete: () => ({
    type: 'message_delete', user_tag: pick(USERS), actor_tag: pick(MODS),
    channel_name: pick(CHANNELS), content: 'check out free nitro at scam-link.example',
  }),
  message_edit: () => ({
    type: 'message_edit', user_tag: pick(USERS), channel_name: pick(CHANNELS),
    content: 'edited: ok my bad', metadata: { before: 'original message text' },
  }),
  timeout: () => ({
    type: 'timeout', user_tag: pick(USERS), actor_tag: pick(MODS),
    metadata: { until: new Date(Date.now() + 3600000).toISOString() },
  }),
};

const WEIGHTS = [
  'member_join', 'member_join', 'message_delete', 'message_delete', 'message_edit',
  'ban_add', 'kick', 'member_leave', 'timeout', 'ban_remove',
];

export function seed({ events = 120, errors = 8, logs = 40 } = {}) {
  for (let i = 0; i < events; i += 1) {
    const type = pick(WEIGHTS);
    const base = EVENT_BUILDERS[type]();
    insertEvent({
      ...base,
      guild_id: GUILD.id,
      guild_name: GUILD.name,
      created_at: isoAgo(7),
    });
  }

  const ERRORS = [
    ['discord', 'DiscordAPIError[50013]: Missing Permissions'],
    ['discord', 'WebSocket connection closed unexpectedly (code 1006)'],
    ['app', 'Failed to fetch audit logs: Missing Access'],
    ['process', 'Unhandled promise rejection: timeout exceeded'],
    ['discord', 'RateLimitError: hit global rate limit'],
  ];
  for (let i = 0; i < errors; i += 1) {
    const [source, message] = pick(ERRORS);
    insertError({
      source, message,
      stack: `${message}\n    at Client.<anonymous> (bot.js:42:13)\n    at processTicksAndRejections`,
      created_at: isoAgo(7),
    });
  }

  const LOGS = [
    ['info', 'discord', 'Discord bot online as VTX-Watcher#4821'],
    ['info', 'app', 'Dashboard server started on port 3000'],
    ['warn', 'discord', 'Could not resolve member in cache, fetching...'],
    ['info', 'auth', 'Dashboard login successful'],
    ['debug', 'app', 'Stats recalculated'],
    ['warn', 'process', 'High memory usage detected'],
  ];
  for (let i = 0; i < logs; i += 1) {
    const [level, source, message] = pick(LOGS);
    insertLog({ level, source, message, created_at: isoAgo(7) });
  }
}

// Run directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
  console.log('Seeded demo data:', countAll());
}
