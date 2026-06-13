import {
  Client,
  GatewayIntentBits,
  Partials,
  AuditLogEvent,
  Events,
} from 'discord.js';
import { config } from './config.js';
import { recordEvent, emitStatus } from './store.js';
import { logger } from './logger.js';

let client = null;

function inScope(guild) {
  if (!guild) return false;
  if (!config.discordGuildId) return true;
  return guild.id === config.discordGuildId;
}

function userTag(user) {
  if (!user) return null;
  return user.tag || user.username || user.id;
}

// Look up the most recent audit-log entry of a given type for a target user.
async function findAuditEntry(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const entry = logs.entries.find(
      (e) => e.target?.id === targetId && Date.now() - e.createdTimestamp < 10_000,
    );
    return entry ?? null;
  } catch {
    return null;
  }
}

function attachHandlers(c) {
  c.once(Events.ClientReady, (ready) => {
    logger.info(`Discord bot online as ${ready.user.tag}`, 'discord');
    emitStatus({ discord: 'connected', tag: ready.user.tag });
  });

  c.on(Events.GuildBanAdd, async (ban) => {
    if (!inScope(ban.guild)) return;
    const entry = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    recordEvent({
      type: 'ban_add',
      guild_id: ban.guild.id,
      guild_name: ban.guild.name,
      user_id: ban.user.id,
      user_tag: userTag(ban.user),
      actor_id: entry?.executor?.id ?? null,
      actor_tag: userTag(entry?.executor),
      reason: ban.reason ?? entry?.reason ?? null,
    });
    logger.info(`Member banned: ${userTag(ban.user)}`, 'discord');
  });

  c.on(Events.GuildBanRemove, async (ban) => {
    if (!inScope(ban.guild)) return;
    const entry = await findAuditEntry(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    recordEvent({
      type: 'ban_remove',
      guild_id: ban.guild.id,
      guild_name: ban.guild.name,
      user_id: ban.user.id,
      user_tag: userTag(ban.user),
      actor_id: entry?.executor?.id ?? null,
      actor_tag: userTag(entry?.executor),
    });
    logger.info(`Member unbanned: ${userTag(ban.user)}`, 'discord');
  });

  c.on(Events.GuildMemberAdd, (member) => {
    if (!inScope(member.guild)) return;
    recordEvent({
      type: 'member_join',
      guild_id: member.guild.id,
      guild_name: member.guild.name,
      user_id: member.id,
      user_tag: userTag(member.user),
    });
  });

  c.on(Events.GuildMemberRemove, async (member) => {
    if (!inScope(member.guild)) return;
    const entry = await findAuditEntry(member.guild, AuditLogEvent.MemberKick, member.id);
    const isKick = Boolean(entry);
    recordEvent({
      type: isKick ? 'kick' : 'member_leave',
      guild_id: member.guild.id,
      guild_name: member.guild.name,
      user_id: member.id,
      user_tag: userTag(member.user),
      actor_id: entry?.executor?.id ?? null,
      actor_tag: userTag(entry?.executor),
      reason: entry?.reason ?? null,
    });
  });

  c.on(Events.MessageDelete, async (message) => {
    if (!inScope(message.guild)) return;
    if (message.author?.bot) return;
    let actor = null;
    const entry = await findAuditEntry(
      message.guild,
      AuditLogEvent.MessageDelete,
      message.author?.id,
    );
    if (entry) actor = entry.executor;
    recordEvent({
      type: 'message_delete',
      guild_id: message.guild?.id,
      guild_name: message.guild?.name,
      channel_id: message.channel?.id,
      channel_name: message.channel?.name,
      user_id: message.author?.id,
      user_tag: userTag(message.author),
      actor_id: actor?.id ?? null,
      actor_tag: userTag(actor),
      content: message.content ?? '(uncached message)',
    });
  });

  c.on(Events.MessageBulkDelete, (messages, channel) => {
    if (!inScope(channel?.guild)) return;
    recordEvent({
      type: 'message_bulk_delete',
      guild_id: channel?.guild?.id,
      guild_name: channel?.guild?.name,
      channel_id: channel?.id,
      channel_name: channel?.name,
      content: `${messages.size} messages bulk deleted`,
      metadata: { count: messages.size },
    });
  });

  c.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (!inScope(newMessage.guild)) return;
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    recordEvent({
      type: 'message_edit',
      guild_id: newMessage.guild?.id,
      guild_name: newMessage.guild?.name,
      channel_id: newMessage.channel?.id,
      channel_name: newMessage.channel?.name,
      user_id: newMessage.author?.id,
      user_tag: userTag(newMessage.author),
      content: newMessage.content ?? '',
      metadata: { before: oldMessage.content ?? '(uncached)' },
    });
  });

  c.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    if (!inScope(newMember.guild)) return;
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
    const newTimeout = newMember.communicationDisabledUntilTimestamp;
    if (newTimeout && newTimeout !== oldTimeout && newTimeout > Date.now()) {
      recordEvent({
        type: 'timeout',
        guild_id: newMember.guild.id,
        guild_name: newMember.guild.name,
        user_id: newMember.id,
        user_tag: userTag(newMember.user),
        metadata: { until: new Date(newTimeout).toISOString() },
      });
    }
  });

  c.on(Events.Error, (err) => logger.error('Discord client error', 'discord', err));
  c.on(Events.Warn, (msg) => logger.warn(msg, 'discord'));
  c.on(Events.ShardError, (err) => logger.error('Shard error', 'discord', err));
}

export async function startBot() {
  if (!config.discordToken) {
    logger.warn('No DISCORD_TOKEN set - running in demo mode (no live Discord events).', 'discord');
    emitStatus({ discord: 'demo' });
    return null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
  });

  attachHandlers(client);

  try {
    await client.login(config.discordToken);
  } catch (err) {
    logger.error('Failed to log in to Discord', 'discord', err);
    emitStatus({ discord: 'error', message: err.message });
  }
  return client;
}

export function getBotStatus() {
  if (!config.discordToken) return 'demo';
  if (client?.isReady()) return 'connected';
  return 'connecting';
}
