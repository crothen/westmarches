# WestMarches Discord Bot

A lightweight Discord bot that bridges D&D group feedback to GitHub Issues on the `crothen/westmarches` repo.

## Commands

| Command | Description | GitHub Label |
|---------|-------------|--------------|
| `/bug <description>` | Report a bug | `bug` |
| `/feature <description>` | Request a feature | `enhancement` |
| `/feedback <description>` | General feedback | `feedback` |

Commands are restricted to a single designated channel.

## Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** → name it "WestMarches Bot" (or whatever)
3. Go to **Bot** → click **Reset Token** → copy the token
4. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
5. Copy the generated URL and use it to invite the bot to the D&D server

### 2. Configure

```bash
cd bot
cp .env.example .env
```

Fill in `.env`:
- `DISCORD_TOKEN` — bot token from step 1
- `DISCORD_CLIENT_ID` — application ID from the Developer Portal
- `DISCORD_CHANNEL_ID` — right-click the feedback channel in Discord → Copy Channel ID
- `GITHUB_TOKEN` — a GitHub PAT with `repo` scope (can reuse existing)

### 3. Install & Register Commands

```bash
npm install
npm run register
```

### 4. Run

```bash
npm start
```

For persistent running, use pm2 or a systemd service:

```bash
# pm2
pm2 start bot.js --name westmarches-bot

# systemd — create /etc/systemd/system/westmarches-bot.service
```

## How It Works

1. D&D player runs `/bug something is broken` in the designated channel
2. Bot creates a GitHub Issue with the `bug` label on `crothen/westmarches`
3. Bot replies with a confirmation embed linking to the issue
4. (Optional) Bot pings Niv via webhook for immediate pickup

## Future Plans

- Bidirectional sync (GitHub comments ↔ Discord replies)
- Modal forms for structured data entry (`/new-npc`, `/new-location`)
- Status updates when issues are closed
