const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "kick",
    description: "Kick a member from the server",
    options: [
      {
        name: "user",
        description: "User to kick",
        type: 6,
        required: true,
      },
      {
        name: "reason",
        description: "Reason for the kick",
        type: 3,
        required: false,
      },
    ],
  },

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: "You need moderator permissions to do that.", flags: [MessageFlags.Ephemeral] });
    }

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "I can’t find that member in this server.", flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: "You can’t kick someone with an equal or higher role than you.", flags: [MessageFlags.Ephemeral] });
    }
    if (!member.kickable) {
      return interaction.reply({ content: "Missing permissions.", flags: [MessageFlags.Ephemeral] });
    }

    await user.send(`⚠️ You have been kicked from **${interaction.guild.name}**\n**Reason:** ${reason}`).catch(() => {});

    await member.kick(`${reason} — by ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setTitle("Member kicked")
      .setColor(0xff4b4b)
      .addFields(
        { name: "User", value: `${user} (${user.id})`, inline: false },
        { name: "Reason", value: reason, inline: true },
      )
      .setFooter({ text: "GameBoy Moderation" })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};