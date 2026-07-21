const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "unban",
    description: "Unban a user by their username or account ID",
    options: [
      {
        name: "target",
        description: "Exact Discord username or User ID",
        type: 3,
        required: true,
      },
      {
        name: "reason",
        description: "Reason?",
        type: 3,
        required: false,
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "You don’t have permission to use this command.", flags: [MessageFlags.Ephemeral] });
    }

    const input = interaction.options.getString("target", true).trim();
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    await interaction.deferReply();

    try {
      const bans = await interaction.guild.bans.fetch();
      
      const banEntry = bans.find(b => b.user.id === input || b.user.username.toLowerCase() === input.toLowerCase());

      if (!banEntry) {
        return interaction.editReply({ content: `Could not find any active ban record matching **"${input}"**.` });
      }

      await interaction.guild.members.unban(banEntry.user.id, `${reason} — by ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setTitle("✅ Member unbanned")
        .setColor(0x57f287)
        .addFields(
          { name: "User", value: `${banEntry.user.tag} (${banEntry.user.id})`, inline: false },
          { name: "Reason", value: reason, inline: true },
        )
        .setFooter({ text: "GameBoy Moderation" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      return interaction.editReply({ content: "An error occurred while attempting to lift the user's ban." });
    }
  },
};