import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const DATA_DIR = process.env.DATA_DIR_OVERRIDE || path.join(ROOT_DIR, 'data');

export const config = {
  port: Number(process.env.PORT) || 3000,
  dashboardPassword: process.env.DASHBOARD_PASSWORD || 'changeme',
  sessionSecret: process.env.SESSION_SECRET || 'insecure-dev-secret',
  discordToken: process.env.DISCORD_TOKEN || '',
  discordGuildId: process.env.DISCORD_GUILD_ID || '',
  seedOnStart: String(process.env.SEED_ON_START || 'true').toLowerCase() === 'true',
  allowSimulate: String(process.env.ALLOW_SIMULATE || 'false').toLowerCase() === 'true',
};

export const hasDiscordToken = Boolean(config.discordToken);
