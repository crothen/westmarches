import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

const commands = [
  new SlashCommandBuilder()
    .setName("bug")
    .setDescription("Report a bug on the West Marches website")
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription("Describe the bug — what happened, what you expected")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("feature")
    .setDescription("Request a new feature for the West Marches website")
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription("Describe the feature you'd like to see")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Share general feedback about the West Marches website")
    .addStringOption((opt) =>
      opt
        .setName("description")
        .setDescription("Your feedback")
        .setRequired(true)
    ),
].map((cmd) => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), {
    body: commands,
  });
  console.log("✅ Commands registered globally.");
} catch (error) {
  console.error("❌ Failed to register commands:", error);
}
