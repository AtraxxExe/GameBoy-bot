const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField } = require("discord.js");
const { isAdmin } = require("../moderationUtils.js");
const { getBotConfig } = require("../botConfig.js");
const { getAutomodConfig } = require("../warningManager.js");

module.exports = {
  category: "Moderation",
  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("Show bot health status and operational details")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "Administrator permission is required.", flags: [MessageFlags.Ephemeral] });
    }

    const errors = interaction.client.health?.errors || 0;
    const guild = interaction.guild;
    const botMember = guild.members.me;
    const config = getAutomodConfig(guild.id);
    const botConfig = getBotConfig();

    const permissionChecks = [
      ["View Channel", PermissionsBitField.Flags.ViewChannel],
      ["Send Messages", PermissionsBitField.Flags.SendMessages],
      ["Manage Messages", PermissionsBitField.Flags.ManageMessages],
      ["Kick Members", PermissionsBitField.Flags.KickMembers],
      ["Ban Members", PermissionsBitField.Flags.BanMembers],
      ["Manage Roles", PermissionsBitField.Flags.ManageRoles],
      ["Moderate Members", PermissionsBitField.Flags.ModerateMembers],
    ];

    const missingPerms = permissionChecks
      .filter(([, bit]) => !botMember?.permissions.has(bit))
      .map(([label]) => label);

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(errors ? 0xe67e22 : 0x2ecc71)
          .setTitle("GameBoy health snapshot")
          .addFields(
            { name: "Gateway latency", value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
            { name: "Started", value: `<t:${Math.floor(interaction.client.readyTimestamp / 1000)}:R>`, inline: true },
            { name: "Handled event errors", value: String(errors), inline: true },
            { name: "Guilds", value: String(interaction.client.guilds.cache.size), inline: true },
            { name: "Automod", value: config.enabled ? "Enabled" : "Disabled", inline: true },
            { name: "Preset", value: config.preset || "light", inline: true },
            { name: "Admin alerts", value: config.adminChannelId ? `<#${config.adminChannelId}>` : "Not configured", inline: false },
            { name: "Token source", value: botConfig.token ? "Resolved" : "Missing", inline: true },
            { name: "Client ID source", value: botConfig.clientId ? "Resolved" : "Missing", inline: true },
            { name: "Bot permission status", value: missingPerms.length ? `Missing: ${missingPerms.join(", ")}` : "All key permissions present", inline: false }
          )
          .setTimestamp(),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  },
};
