const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const afkManager = require("../afkManager.js");

module.exports = {
  category: "Utilities",
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Toggle your AFK status in text channels")
    .addStringOption(option =>
      option.setName("reason")
        .setDescription("Optional reason for going AFK")
        .setRequired(false)
    ),

  async execute(interaction) {
    const reason = interaction.options.getString("reason") || null;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const existing = afkManager.getAfk(guildId, userId);

    if (existing) {
      afkManager.removeAfk(guildId, userId);

      await interaction.reply({ content: `Welcome back ${interaction.user}, afk mode ended.` });

      const summary = existing.mentions.length;
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("AFK mode ended")
        .setDescription(`Welcome back, ${interaction.user}! Here is a summary of the activity you missed while you were away.`)
        .addFields(
          { name: "Reason", value: existing.reason || "No reason provided", inline: false },
          { name: "Mentions received", value: summary > 0 ? `${summary}` : "None", inline: false }
        )
        .setTimestamp();

      if (summary > 0) {
        const directMentions = existing.mentions.filter(m => m.type === "direct");
        const otherMentions = existing.mentions.filter(m => m.type !== "direct");

        const directLines = directMentions.slice(0, 8).map(mention => `- ${mention.authorTag} in #${mention.channelName}: ${mention.content}`);
        const otherLines = otherMentions.slice(0, 4).map(mention => `- ${mention.authorTag} in #${mention.channelName} (${mention.type})`);

        embed.addFields(
          { name: "Direct mentions", value: directLines.join("\n") || "None", inline: false },
          { name: "Other mentions", value: otherLines.join("\n") || "None", inline: false }
        );
      }

      await interaction.user.send({ embeds: [embed] }).catch(() => {});
      return;
    }

    afkManager.setAfk(guildId, userId, { reason, startedAt: Date.now() });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("AFK mode enabled")
      .setDescription(reason ? `${interaction.user} is now AFK: ${reason}` : `${interaction.user} is now AFK. I will notify you when you return with anything important.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};