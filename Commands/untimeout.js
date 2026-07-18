const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "untimeout",
    description: "Remove a member’s timeout",
    options: [
      { name: "user", description: "User to untimeout", type: 6, required: true },
      { name: "reason", description: "Reason", type: 3, required: false },
    ],
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      return interaction.reply({ content: "You don’t have permission to use this.", flags: [MessageFlags.Ephemeral] });
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: "I can’t find that member.", flags: [MessageFlags.Ephemeral] });

    if (!member.moderatable) {
      return interaction.reply({ content: "I can’t modify that member (role hierarchy / missing permissions).", flags: [MessageFlags.Ephemeral] });
    }

    await member.timeout(null, `${reason} — by ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setTitle("✅ Timeout removed")
      .setColor(0x57f287)
      .addFields(
        { name: "User", value: `${user} (${user.id})`, inline: false },
        { name: "Reason", value: reason, inline: false },
      )
      .setFooter({ text: "GameBoy moderation" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};