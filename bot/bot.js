import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} from "discord.js";
import { Octokit } from "octokit";
import express from "express";
import "dotenv/config";

// --- Config ---
const ALLOWED_CHANNEL = process.env.DISCORD_CHANNEL_ID;
const NOTIFICATIONS_CHANNEL = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "crothen";
const GITHUB_REPO = process.env.GITHUB_REPO || "westmarches";
const NIV_WEBHOOK_URL = process.env.NIV_WEBHOOK_URL || null;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || null;
const SITE_URL = "https://westmarches-dnd.web.app";

// --- Clients ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// --- Label map ---
const LABELS = {
  bug: { label: "bug", emoji: "🐛", color: 0xd73a4a },
  feature: { label: "enhancement", emoji: "✨", color: 0xa2eeef },
  feedback: { label: "feedback", emoji: "💬", color: 0x7057ff },
};

// --- Helpers ---
async function ensureLabel(name) {
  try {
    await octokit.rest.issues.getLabel({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      name,
    });
  } catch {
    const colors = { bug: "d73a4a", enhancement: "a2eeef", feedback: "7057ff" };
    await octokit.rest.issues.createLabel({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      name,
      color: colors[name] || "ededed",
    });
  }
}

async function createGitHubIssue(type, description, discordUser) {
  const { label, emoji } = LABELS[type];

  await ensureLabel(label);

  const title = `${emoji} [${type.toUpperCase()}] ${description.slice(0, 80)}${description.length > 80 ? "..." : ""}`;
  const body = [
    `**Type:** ${type}`,
    `**Submitted by:** ${discordUser} (via Discord)`,
    "",
    "---",
    "",
    description,
  ].join("\n");

  const { data: issue } = await octokit.rest.issues.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title,
    body,
    labels: [label],
  });

  return issue;
}

async function notifyNiv(issue, type) {
  if (!NIV_WEBHOOK_URL) return;

  try {
    await fetch(NIV_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `📋 New **${type}** from the D&D group: [#${issue.number} — ${issue.title}](${issue.html_url})`,
      }),
    });
  } catch (err) {
    console.error("Failed to notify Niv:", err.message);
  }
}

// --- Notification handlers ---
async function getNotificationsChannel() {
  if (!NOTIFICATIONS_CHANNEL) {
    console.warn("DISCORD_NOTIFICATIONS_CHANNEL_ID not configured");
    return null;
  }
  try {
    return await client.channels.fetch(NOTIFICATIONS_CHANNEL);
  } catch (err) {
    console.error("Failed to fetch notifications channel:", err.message);
    return null;
  }
}

async function handleSessionCreated(data) {
  const channel = await getNotificationsChannel();
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x10b981) // green
    .setTitle("📅 New Session Scheduled!")
    .setDescription(data.description || null)
    .addFields(
      { name: "📆 Date", value: data.date, inline: true },
      { name: "🎮 Title", value: data.title, inline: true },
    )
    .setURL(`${SITE_URL}/schedule`)
    .setTimestamp();

  if (data.location) {
    embed.addFields({ name: "📍 Location", value: data.location, inline: true });
  }
  if (data.maxPlayers) {
    embed.addFields({ name: "👥 Max Players", value: String(data.maxPlayers), inline: true });
  }

  await channel.send({
    content: "🎲 **A new session has been scheduled!** Sign up now:",
    embeds: [embed],
  });
}

async function handlePlayerSignup(data) {
  const channel = await getNotificationsChannel();
  if (!channel) return;

  const playerMention = data.playerDiscordId
    ? `<@${data.playerDiscordId}>`
    : `**${data.playerName}**`;

  const spotsInfo = data.maxPlayers
    ? ` (${data.currentSignups}/${data.maxPlayers})`
    : ` (${data.currentSignups} signed up)`;

  await channel.send({
    content: `✋ ${playerMention} signed up for **${data.sessionTitle}** on ${data.sessionDate}${spotsInfo}`,
  });
}

async function handlePlayerWithdrawal(data) {
  const channel = await getNotificationsChannel();
  if (!channel) return;

  const playerMention = data.playerDiscordId
    ? `<@${data.playerDiscordId}>`
    : `**${data.playerName}**`;

  const spotsInfo = data.maxPlayers
    ? ` (${data.currentSignups}/${data.maxPlayers})`
    : ` (${data.currentSignups} remaining)`;

  await channel.send({
    content: `👋 ${playerMention} withdrew from **${data.sessionTitle}** on ${data.sessionDate}${spotsInfo}`,
  });
}

// --- Webhook server ---
const app = express();
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", botReady: client.isReady() });
});

// Notification webhook
app.post("/notify", async (req, res) => {
  // Optional secret validation
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const { event, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: "Missing event or data" });
  }

  console.log(`📬 Received notification: ${event}`);

  try {
    switch (event) {
      case "session_created":
        await handleSessionCreated(data);
        break;
      case "player_signup":
        await handlePlayerSignup(data);
        break;
      case "player_withdrawal":
        await handlePlayerWithdrawal(data);
        break;
      default:
        console.warn(`Unknown event type: ${event}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(`Failed to handle ${event}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// --- Bot ready ---
client.once(Events.ClientReady, (c) => {
  console.log(`✅ WestMarches Bot online as ${c.user.tag}`);

  // Start webhook server
  app.listen(WEBHOOK_PORT, () => {
    console.log(`🌐 Webhook server listening on port ${WEBHOOK_PORT}`);
  });
});

// --- Handle slash commands ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Channel restriction
  if (ALLOWED_CHANNEL && interaction.channelId !== ALLOWED_CHANNEL) {
    await interaction.reply({
      content: "⚠️ This command can only be used in the designated feedback channel.",
      ephemeral: true,
    });
    return;
  }

  const type = interaction.commandName;
  if (!LABELS[type]) return;

  const description = interaction.options.getString("description");
  const discordUser = interaction.user.displayName || interaction.user.username;

  await interaction.deferReply();

  try {
    const issue = await createGitHubIssue(type, description, discordUser);

    const embed = new EmbedBuilder()
      .setColor(LABELS[type].color)
      .setTitle(`${LABELS[type].emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} #${issue.number}`)
      .setDescription(description)
      .setURL(issue.html_url)
      .setFooter({ text: `Submitted by ${discordUser}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify Niv
    await notifyNiv(issue, type);
  } catch (err) {
    console.error(`Error creating ${type}:`, err);
    await interaction.editReply({
      content: `❌ Failed to create ${type}. Error: ${err.message}`,
    });
  }
});

// --- Start ---
client.login(process.env.DISCORD_TOKEN);
