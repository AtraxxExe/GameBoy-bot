const { PermissionsBitField, EmbedBuilder, MessageFlags } = require("discord.js");
const { audit, notifyAdmin } = require("../moderationUtils.js");

module.exports = {
  category: "Moderation",
  data: {
    name: "kick",
    description: "Kick a member from the server",
    default_member_permissions: PermissionsBitField.Flags.Administrator.toString(),
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
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "You need moderator permissions to do that.", flags: [MessageFlags.Ephemeral] });
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const user = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      return interaction.editReply({ content: "I can’t find that member in this server." });
    }

    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.editReply({ content: "You can’t kick someone with an equal or higher role than you." });
    }
    
    if (!member.kickable) {
      return interaction.editReply({ 
        content: "❌ **Cannot kick this member.** Please ensure my bot role is positioned **higher** than their highest role in the server settings, and that I have the **Kick Members** permission enabled." 
      });
    }

    await user.send(`⚠️ You have been kicked from **${interaction.guild.name}**\n**Reason:** ${reason}`).catch(() => {});

    await member.kick(`${reason} — by ${interaction.user.tag}`);
    audit("kick", { action: "Kick command used", actor: interaction.user, target: user, reason });
    await notifyAdmin(interaction.guild, { embeds: [new EmbedBuilder().setColor(0xff4b4b).setTitle("Member kicked").setDescription(`Admin: <@${interaction.user.id}>\nUser: <@${user.id}>\nReason: ${reason}`).setTimestamp()] });

    const embed = new EmbedBuilder()
      .setTitle("Member kicked")
      .setColor(0xff4b4b)
      .addFields(
        { name: "User", value: `${user} (${user.id})`, inline: false },
        { name: "Reason", value: reason, inline: true },
      )
      .setFooter({ text: "GameBoy Moderation" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};