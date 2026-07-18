const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionsBitField } = require("discord.js");
const { getCase, listCases, closeCase } = require("../warningManager.js");
const { isAdmin, redact } = require("../moderationUtils.js");

module.exports = {
  category: "Moderation",
  data: new SlashCommandBuilder()
    .setName("modcases")
    .setDescription("Review moderation case activity")
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("Show the current open moderation case queue")
    )
    .addSubcommand(sub =>
      sub
        .setName("close")
        .setDescription("Close an open moderation case by ID")
        .addStringOption(option => option.setName("case_id").setDescription("The moderation case ID to close").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    if (!isAdmin(interaction)) {
      return interaction.reply({ content: "Administrator permission is required to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "close") {
      const caseId = interaction.options.getString("case_id", true);
      const caseItem = getCase(interaction.guildId, caseId);

      if (!caseItem) {
        return interaction.reply({ content: "That case ID was not found in this server’s open moderation queue.", flags: [MessageFlags.Ephemeral] });
      }

      closeCase(interaction.guildId, caseId);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("Case closed")
            .setDescription(`Case **${caseId}** has been marked as closed.`)
            .setTimestamp(),
        ],
        flags: [MessageFlags.Ephemeral],
      });
    }

    const cases = listCases(interaction.guildId).slice(0, 5);
    const embed = new EmbedBuilder()
      .setColor(cases.length ? 0xf1c40f : 0x2ecc71)
      .setTitle("Moderation case queue")
      .setTimestamp();

    if (cases.length === 0) {
      embed.setDescription("No open moderation cases are currently queued.");
    } else {
      embed.setDescription(cases.map((item) => {
        const since = `<t:${Math.floor((item.createdAt || Date.now()) / 1000)}:R>`;
        return `**${item.id}** • ${item.type || "manual"} • ${item.status || "open"} • ${since}\nTarget: <@${item.subjectId || item.targetId || "unknown"}>\nReason: ${redact(item.reason || "No reason provided", 180)}`;
      }).join("\n\n"));
    }

    return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  },
};
