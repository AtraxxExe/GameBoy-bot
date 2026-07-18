const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require("discord.js");
const { addWarning, removeWarnings, getWarnings, getPenaltyForWarningCount } = require("../warningManager.js");
const { audit, notifyAdmin, redact } = require("../moderationUtils.js");

module.exports = {
  category: "Moderation",
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Add or remove warnings for a member")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("Record a warning for a member")
        .addUserOption(option => option.setName("user").setDescription("Member to warn").setRequired(true))
        .addStringOption(option => option.setName("reason").setDescription("Reason for the warning").setRequired(true).setMaxLength(240))
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("Remove recent warnings from a member")
        .addUserOption(option => option.setName("user").setDescription("Member whose warnings should be removed").setRequired(true))
        .addIntegerOption(option => option.setName("count").setDescription("How many newest warnings to remove").setMinValue(1).setMaxValue(100).setRequired(true))
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("Show warning history for a member")
        .addUserOption(option => option.setName("user").setDescription("Member to inspect").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: "Moderate Members permission is required to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user", true);

    if (subcommand === "add") {
      const reason = interaction.options.getString("reason", true);
      const result = await addWarning(interaction.guildId, user.id, {
        guild: interaction.guild,
        source: "admin",
        reason,
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
      });

      audit("moderation_actions", {
        action: "Warning added",
        actor: interaction.user,
        target: user,
        reason,
        context: `total=${result.totalWarnings}`,
      });

      await notifyAdmin(interaction.guild, {
        embeds: [
          new EmbedBuilder()
            .setColor(result.penalty.type === "ban" ? 0x992d22 : result.penalty.type === "kick" ? 0xe67e22 : 0xf1c40f)
            .setTitle(result.penalty.type === "ban" ? "Warning limit reached: member banned" : result.penalty.type === "kick" ? "Warning limit reached: member kicked" : "Warning recorded")
            .setDescription(`Member: <@${user.id}>\nModerator: <@${interaction.user.id}>\nReason: ${redact(reason, 220)}\nTotal warnings: **${result.totalWarnings}**`)
            .setTimestamp(),
        ],
      });

      return interaction.reply({
        content: `Warning recorded for ${user} for: ${redact(reason, 160)}. Total warnings: ${result.totalWarnings}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (subcommand === "remove") {
      const count = interaction.options.getInteger("count", true) || 1;
      const removed = removeWarnings(interaction.guildId, user.id, count, {
        actorId: interaction.user.id,
        actorTag: interaction.user.tag,
      });

      audit("moderation_actions", {
        action: "Warnings removed",
        actor: interaction.user,
        target: user,
        reason: removed.map(entry => entry.id).join(",") || "none",
      });

      await notifyAdmin(interaction.guild, {
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("Warnings removed")
            .setDescription(`Member: <@${user.id}>\nModerator: <@${interaction.user.id}>\nRemoved: **${removed.length}** warning(s)`)
            .setTimestamp(),
        ],
      });

      return interaction.reply({
        content: removed.length ? `Removed ${removed.length} warning(s) from ${user}.` : `No warnings were removed from ${user}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (subcommand === "list") {
      const warnings = getWarnings(interaction.guildId, user.id);
      const totalWarnings = warnings.length;
      const nextPenalty = getPenaltyForWarningCount(totalWarnings + 1);

      const embed = new EmbedBuilder()
        .setColor(totalWarnings ? 0xf1c40f : 0x2ecc71)
        .setTitle(`Warning history for ${user.tag}`)
        .setDescription(totalWarnings ? `Total warnings: **${totalWarnings}**\nNext action threshold: **${nextPenalty.type}**` : "This member has no recorded warnings.")
        .setTimestamp();

      if (warnings.length > 0) {
        const recent = warnings.slice(-5).reverse().map((entry, index) => {
          const warningNumber = totalWarnings - index;
          return `**#${warningNumber}** • ${new Date(entry.timestamp).toLocaleString()}\nReason: ${redact(entry.reason, 140)}`;
        });
        embed.addFields({ name: "Recent warnings", value: recent.join("\n\n"), inline: false });
      }

      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    return interaction.reply({ content: "Use /warn add, /warn remove, or /warn list.", flags: [MessageFlags.Ephemeral] });
  },
};
