import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
} from "discord.js";
import { Octokit } from "octokit";
import "dotenv/config";

// --- Config ---
const ALLOWED_CHANNEL = process.env.DISCORD_CHANNEL_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER || "crothen";
const GITHUB_REPO = process.env.GITHUB_REPO || "westmarches";
const NIV_WEBHOOK_URL = process.env.NIV_WEBHOOK_URL || null;

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

// --- Bot ready ---
client.once(Events.ClientReady, (c) => {
  console.log(`✅ WestMarches Bot online as ${c.user.tag}`);
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
