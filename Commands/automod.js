const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField, MessageFlags } = require("discord.js");
const { getAutomodConfig, setAutomodConfig } = require("../warningManager.js");
const { isAdmin, audit } = require("../moderationUtils.js");

module.exports = {
  category: "Moderation",
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Manage automatic moderation settings")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand(sub =>
      sub
        .setName("settings")
        .setDescription("View or update main automod configuration")
        .addStringOption(option => option.setName("preset").setDescription("Choose moderation preset: light or strict").addChoices(
          { name: "Light", value: "light" },
          { name: "Strict", value: "strict" }
        ))
        .addBooleanOption(option => option.setName("enable").setDescription("Turn automod on or off"))
        .addBooleanOption(option => option.setName("invites").setDescription("Block Discord server invite links (True = Block, False = Allow)"))
    )
    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("Set the private moderation alert channel")
        .addChannelOption(option => option.setName("channel").setDescription("Private text channel for alerts").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("ignore")
        .setDescription("Ignore a channel from automod checks")
        .addChannelOption(option => option.setName("channel").setDescription("Text channel to ignore").addChannelTypes(ChannelType.GuildText).setRequired(true))
    ),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "Administrator permission is required to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const subcommand = interaction.options.getSubcommand(false);

    if (subcommand === "setup") {
      const channel = interaction.options.getChannel("channel", true);
      setAutomodConfig(interaction.guildId, { adminChannelId: channel.id });
      audit("automod", {
        action: "Automod alert channel configured",
        actor: interaction.user,
        reason: `channel=${channel.id}`,
      });

      return interaction.reply({
        content: `Moderation alerts will now go to ${channel}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (subcommand === "ignore") {
      const channel = interaction.options.getChannel("channel", true);
      const config = getAutomodConfig(interaction.guildId);
      const ignoredChannels = new Set(config.ignoredChannels || []);
      ignoredChannels.add(channel.id);
      const updated = setAutomodConfig(interaction.guildId, { ignoredChannels: Array.from(ignoredChannels) });
      audit("automod", { action: "Automod ignore channel updated", actor: interaction.user, reason: `channel=${channel.id}; count=${updated.ignoredChannels.length}` });
      return interaction.reply({ content: `${channel} will now be ignored by automod.`, flags: [MessageFlags.Ephemeral] });
    }

    if (subcommand === "settings") {
      const enable = interaction.options.getBoolean("enable");
      const preset = interaction.options.getString("preset");
      const invites = interaction.options.getBoolean("invites");

      if (enable === null && !preset && invites === null) {
        const config = getAutomodConfig(interaction.guildId);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("Automod status")
              .addFields(
                { name: "Preset", value: config.preset || "light", inline: true },
                { name: "Enabled", value: config.enabled ? "Yes" : "No", inline: true },
                { name: "Admin alerts", value: config.adminChannelId ? `<#${config.adminChannelId}>` : "Not configured", inline: false },
                { name: "Ignored channels", value: config.ignoredChannels?.length ? config.ignoredChannels.map(id => `<#${id}>`).join(", ") : "None", inline: false },
                { name: "Policies", value: `Invite links: ${config.policies?.inviteLinks === true ? "On" : "Off"}; Mention spam: ${config.policies?.mentionSpam !== false ? "On" : "Off"}; Spam repeat: ${config.policies?.spamRepeat !== false ? "On" : "Off"}`, inline: false }
              )
              .setTimestamp(),
          ],
          flags: [MessageFlags.Ephemeral],
        });
      }

      const currentConfig = getAutomodConfig(interaction.guildId);
      const currentPolicies = currentConfig.policies || {};
      
      const newPolicies = {
        ...currentPolicies,
        ...(invites !== null ? { inviteLinks: invites } : {})
      };

      const config = setAutomodConfig(interaction.guildId, {
        ...(enable !== null ? { enabled: enable } : {}),
        ...(preset ? { preset } : {}),
        policies: newPolicies,
      });

      audit("automod", {
        action: "Automod configured",
        actor: interaction.user,
        reason: `enabled=${config.enabled}; preset=${config.preset}; inviteLinks=${config.policies?.inviteLinks}`,
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("Automod updated")
            .setDescription(`Preset: **${config.preset || "light"}**\nAutomod is now **${config.enabled ? "enabled" : "disabled"}**.\nBlocking server invites: **${config.policies?.inviteLinks === true ? "Enabled" : "Disabled"}**.`)
            .setTimestamp(),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }
  },
};