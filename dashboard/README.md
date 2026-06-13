# VTX Clan Dashboard

A self-hosted admin dashboard for the VTX Clan Discord server. It runs a Discord
bot that listens to moderation/server events and surfaces them in a live,
password-protected web dashboard alongside application statistics, errors and logs.

## Features

- **Live Discord logs** — bans, unbans, kicks, joins, leaves, message deletes
  (single + bulk), message edits and timeouts, streamed in real time over websockets.
- **Statistics** — at-a-glance counters (total events, last 24h, bans, kicks,
  deletes, edits, joins, timeouts, errors) plus a 7-day activity chart.
- **Errors panel** — captured Discord/bot/process errors with stack traces.
- **Application logs** — info/warn/error/debug log stream with filtering.
- **Auth** — single dashboard password; sessions via signed cookies.
- **Demo mode** — runs with realistic seed data when no Discord token is set, so
  you can explore the UI without connecting a bot.

## Tech stack

- Node.js + Express (HTTP API + static hosting)
- `discord.js` v14 (gateway event listener)
- `better-sqlite3` (persistence)
- `socket.io` (realtime push)
- Vanilla HTML/CSS/JS frontend (no build step)

## Quick start

```bash
cd dashboard
cp .env.example .env        # then edit .env
npm install
npm start
```

Open http://localhost:3000 and log in with `DASHBOARD_PASSWORD`.

With no `DISCORD_TOKEN` set, the dashboard boots in **demo mode** and seeds
example data. To connect a real bot, fill in `DISCORD_TOKEN` (and optionally
`DISCORD_GUILD_ID`) in `.env`.

## Configuration (`.env`)

| Variable             | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `PORT`               | Web server port (default `3000`).                                  |
| `DASHBOARD_PASSWORD` | Password required to log into the dashboard.                       |
| `SESSION_SECRET`     | Secret used to sign session cookies.                               |
| `DISCORD_TOKEN`      | Bot token. Empty = demo mode.                                      |
| `DISCORD_GUILD_ID`   | Restrict logging to one server. Empty = all servers the bot is in. |
| `SEED_ON_START`      | Insert demo data on first start when the DB is empty.              |

## Discord bot setup

1. Create an application + bot at <https://discord.com/developers/applications>.
2. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent**
   and **Message Content Intent**.
3. Invite the bot to your server with permissions to **View Audit Log** (needed
   to attribute bans/kicks/deletes to the moderator who performed them).
4. Put the token in `.env` as `DISCORD_TOKEN` and restart.

## Scripts

- `npm start` — run the dashboard + bot.
- `npm run dev` — run with `--watch` auto-reload.
- `npm run seed` — insert demo data into the database.
- `npm run lint` — lint the source.
- `npm test` — run the smoke tests.

## Notes

The original marketing site (`../vxtclanoffical.html`, served at `vtxclan.com`
via GitHub Pages) is unchanged. This dashboard is a separate backend app that you
host yourself (it cannot run on GitHub Pages because it needs a long-running
Node process for the Discord bot, database and websockets).
