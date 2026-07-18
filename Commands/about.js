const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getBotConfig } = require("../botConfig.js");

const ABOUT_BANNER_URL = process.env.ABOUT_BANNER_URL || process.env.ABOUT_IMAGE_URL || "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80";
const COMMUNITY_SERVER_URL = process.env.COMMUNITY_SERVER_URL || "https://discord.gg/your-community-server";
const DEFAULT_INVITE_URL = "https://discord.com/api/oauth2/authorize?client_id=REPLACE_ME&permissions=8&scope=bot%20applications.commands";

function formatUptime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return [days ? `${days}d` : null, hours ? `${hours}h` : null, minutes ? `${minutes}m` : null, secs ? `${secs}s` : null]
    .filter(Boolean)
    .join(" ") || "0s";
}

function getInviteUrl() {
  const { clientId } = getBotConfig();
  if (clientId) {
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
  }
  return DEFAULT_INVITE_URL;
}

function buildAboutButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Add Gameboy")
      .setURL(getInviteUrl())
      .setStyle(ButtonStyle.Link),
    new ButtonBuilder()
      .setLabel("Support Server")
      .setURL(COMMUNITY_SERVER_URL)
      .setStyle(ButtonStyle.Link)
  );
}

function buildWelcomeAboutEmbed() {
  return new EmbedBuilder()
    .setColor(0xD8A7E8)
    .setTitle("Hi there!")
    .setDescription(
      "I'm **GameBoy**, your new multi-purpose assistant, and I am so excited to join your community! Thank you so much for bringing me along for the ride.\n\n" +
      "My main goal is to make managing your server as smooth and fun as possible. Whether you need powerful moderation tools, leveling systems, or automated features, I've got your back!\n\n" +
      "🚀 **Getting Started:**\n" +
      "• Type `/help` to discover everything I can do.\n" +
      "• Want to set up features like Autoroles, Welcome messages, or Levels? Dive right into my commands!\n\n" +
      "💬 **Need a hand or want to share feedback?**\n" +
      "Hop into our **Support Server** using the link below! You'll find step-by-step setup guides, stay updated on maintenance breaks, and you can even request new features or commands you'd love to see.\n\n" +
      "Let's build an amazing community together! 🤍"
    )
    .setImage(ABOUT_BANNER_URL)
    .setTimestamp()
    .setFooter({ text: "Gameboy • Your multi-purpose assistant" });
}

function buildAboutEmbed(client) {
  const guildCount = client?.guilds?.cache?.size || 0;
  const totalUsers = client?.guilds?.cache?.reduce((sum, guild) => sum + (guild.memberCount || 0), 0) || 0;
  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const latency = client?.ws?.ping ?? 0;
  const uptimeText = formatUptime(process.uptime());
  const commandCount = client?.commands?.size || 0;

  return new EmbedBuilder()
    .setColor(0xD8A7E8)
    .setTitle("Gameboy • Your loyal Assistant")
    .setDescription("Developed by Atrax.exe")
    .setImage(ABOUT_BANNER_URL)
    .addFields(
      {
        name: "> Quick stats",
        value: [
          `> Commands: ${commandCount}`,
          `> Latency: ${latency}ms`,
          `> Uptime: ${uptimeText}`,
          `> Users: ${totalUsers}`,
          `> Servers: ${guildCount}`,
          `> Memory: ${memoryMb} MB`
        ].join("\n"),
        inline: false,
      }
    )
    .setTimestamp()
    .setFooter({ text: "Gameboy • Your loyal assistant" });
}

module.exports = {
  category: "Other",
  data: new SlashCommandBuilder()
    .setName("about")
    .setDescription("Send a short introduction about GameBoy."),

  buildAboutEmbed,
  buildWelcomeAboutEmbed,
  buildAboutButtons,

  async execute(interaction) {
    await interaction.reply({ embeds: [buildAboutEmbed(interaction.client)], components: [buildAboutButtons()] });
  },
};
