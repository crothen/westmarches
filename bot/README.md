# West Marches Discord Bot

Discord bot for the West Marches D&D campaign. Handles:
- `/bug`, `/feature`, `/feedback` commands → GitHub Issues
- Notifications from Cloud Functions (session scheduling, player signups)

## Setup

1. Copy `.env.example` to `.env` and fill in the values
2. Install dependencies: `npm install`
3. Register slash commands: `npm run register`
4. Start the bot: `npm start`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID for registering commands |
| `DISCORD_CHANNEL_ID` | Channel ID where `/bug`, `/feature`, `/feedback` commands are allowed |
| `DISCORD_NOTIFICATIONS_CHANNEL_ID` | Channel ID for session notifications |
| `GITHUB_TOKEN` | GitHub PAT with repo access |
| `GITHUB_OWNER` | GitHub repo owner (default: crothen) |
| `GITHUB_REPO` | GitHub repo name (default: westmarches) |
| `NIV_WEBHOOK_URL` | (Optional) Webhook to notify Niv about new issues |
| `WEBHOOK_PORT` | Port for the notification webhook server (default: 3001) |
| `WEBHOOK_SECRET` | (Optional) Bearer token for authenticating Cloud Functions |

## Notification Webhook

The bot runs an Express server on `WEBHOOK_PORT` that accepts POST requests from Cloud Functions:

```
POST /notify
Content-Type: application/json
Authorization: Bearer <WEBHOOK_SECRET>  (if configured)

{
  "event": "session_created" | "player_signup" | "player_withdrawal",
  "data": { ... }
}
```

## Running with systemd

Create `/etc/systemd/system/westmarches-bot.service`:

```ini
[Unit]
Description=West Marches Discord Bot
After=network.target

[Service]
Type=simple
User=chris
WorkingDirectory=/path/to/westmarches/bot
ExecStart=/usr/bin/node bot.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable westmarches-bot
sudo systemctl start westmarches-bot
```
